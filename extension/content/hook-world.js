'use strict';
// Indicadores de hijacking/hook no mundo principal (roda depois de
// main-world.js e fp-world.js, em document_start):
//  1. globais novas em window (ex.: `beef` do BeEF), comparando com a foto
//     tirada antes de qualquer script da página;
//  2. funções nativas críticas substituídas (fetch, XHR, WebSocket...). A
//     comparação é por identidade com a referência capturada aqui, então pega
//     também hooks que imitam o toString "[native code]";
//  3. scripts injetados dinamicamente (appendChild/insertBefore/append...),
//     com o script que fez a injeção;
//  4. listeners de teclado/input registrados (captura de digitação, um dos
//     testes do Blacklight).
// Nenhuma global nova e hooks só em protótipos: a página js-leaks do DDG olha
// as propriedades de window e não deve enxergar a extensão.
(() => {
  const EVT = '__sentinela_evt__';
  const READY = '__sentinela_ready__';
  const PING = '__sentinela_ping__';
  const MAX_GLOBALS = 150;

  const W = window;
  const _apply = Reflect.apply;
  const _dispatch = EventTarget.prototype.dispatchEvent;
  const _addListener = EventTarget.prototype.addEventListener;
  const _CustomEvent = W.CustomEvent;
  const _stringify = JSON.stringify;
  const _Error = W.Error;
  const _String = W.String;
  const _defineProperty = Object.defineProperty;
  const _getDesc = Object.getOwnPropertyDescriptor;
  const _getNames = Object.getOwnPropertyNames;
  const _split = String.prototype.split;
  const _indexOf = String.prototype.indexOf;
  const _slice = String.prototype.slice;
  const _exec = RegExp.prototype.exec;
  const _Proxy = W.Proxy;
  const _now = Date.now;
  const _setTimeout = W.setTimeout;
  const _Set = W.Set;
  const _setHas = Set.prototype.has;
  const _setAdd = Set.prototype.add;
  const STACK_RE = /(?:@|at |\()((?:https?|wss?|blob|data):[^\s)]+?):\d+:\d+\)?$/;

  // toString discreto. No Firefox, Function.prototype.toString de um Proxy
  // devolve "function () { [native code] }", sem o nome da função, e a página
  // js-leaks do DDG compara esse texto. Cada proxy nosso é registrado com a
  // função original, e toString responde com o texto dela. Os três scripts do
  // mundo principal fazem isso encadeados, cada um sobre o toString anterior.
  const _WeakMapT = W.WeakMap;
  const _wmHasT = WeakMap.prototype.has;
  const _wmGetT = WeakMap.prototype.get;
  const _wmSetT = WeakMap.prototype.set;
  const masked = new _WeakMapT();
  const mask = (proxy, original) => { _apply(_wmSetT, masked, [proxy, original]); return proxy; };
  const proxyOf = (target, handler) => mask(new _Proxy(target, handler), target);
  const _prevToString = Function.prototype.toString;
  _defineProperty(Function.prototype, 'toString', Object.assign({}, _getDesc(Function.prototype, 'toString'), {
    value: mask(new _Proxy(_prevToString, {
      apply(fn, thisArg, args) {
        const target = _apply(_wmHasT, masked, [thisArg]) ? _apply(_wmGetT, masked, [thisArg]) : thisArg;
        return _apply(fn, target, args);
      },
    }), _prevToString),
  }));

  let ready = false;
  const queue = [];
  function dispatchRaw(ev) {
    try { _apply(_dispatch, W, [new _CustomEvent(EVT, { detail: _stringify(ev) })]); } catch { /* ignora */ }
  }
  function send(type, data) {
    const ev = Object.assign({ type, t: _apply(_now, Date, []) }, data);
    if (ready) dispatchRaw(ev); else queue[queue.length] = ev;
  }
  _apply(_addListener, W, [READY, () => {
    if (ready) return;
    ready = true;
    for (let i = 0; i < queue.length; i++) dispatchRaw(queue[i]);
    queue.length = 0;
  }, true]);
  try { _apply(_dispatch, W, [new _CustomEvent(PING)]); } catch { /* ignora */ }

  function callerScript() {
    try {
      const lines = _apply(_split, new _Error().stack || '', ['\n']);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (_apply(_indexOf, line, ['moz-extension://']) >= 0) continue;
        const m = _apply(_exec, STACK_RE, [line]);
        if (m) return _apply(_slice, m[1], [0, 300]);
      }
    } catch { /* ignora */ }
    return null;
  }

  function wrapMethod(proto, name, onCall) {
    const desc = proto && _getDesc(proto, name);
    if (!desc || typeof desc.value !== 'function') return;
    _defineProperty(proto, name, Object.assign({}, desc, {
      value: proxyOf(desc.value, {
        apply(fn, thisArg, args) {
          try { onCall(thisArg, args); } catch { /* nunca quebrar a página */ }
          return _apply(fn, thisArg, args);
        },
      }),
    }));
  }

  // --- 3. Scripts injetados dinamicamente ------------------------------------
  const _HTMLScript = W.HTMLScriptElement;
  const srcGetter = _HTMLScript && _getDesc(HTMLScriptElement.prototype, 'src').get;
  const reported = new _Set();
  function onInsert(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!_HTMLScript || !(n instanceof _HTMLScript)) continue;
      const src = _apply(srcGetter, n, []);
      if (!src || _apply(_setHas, reported, [src])) continue;
      _apply(_setAdd, reported, [src]);
      send('script-inject', { src: _apply(_slice, src, [0, 300]), injector: callerScript() });
    }
  }
  const NP = W.Node && Node.prototype;
  const EP = W.Element && Element.prototype;
  wrapMethod(NP, 'appendChild', (self, args) => onInsert([args[0]]));
  wrapMethod(NP, 'insertBefore', (self, args) => onInsert([args[0]]));
  wrapMethod(NP, 'replaceChild', (self, args) => onInsert([args[0]]));
  for (const name of ['append', 'prepend', 'after', 'before', 'replaceWith']) {
    wrapMethod(EP, name, (self, args) => onInsert(args));
  }

  // --- 4. Listeners de teclado e digitação -------------------------------------
  const KEY_EVENTS = new _Set(['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'change', 'paste']);
  const keySeen = new _Set();
  const _Element = W.Element;
  function targetKind(t) {
    if (t === W) return 'window';
    if (t === W.document) return 'document';
    return _Element && t instanceof _Element ? _String(t.tagName) : 'outro';
  }
  wrapMethod(W.EventTarget && EventTarget.prototype, 'addEventListener', (self, args) => {
    const type = _String(args[0]);
    if (!_apply(_setHas, KEY_EVENTS, [type])) return;
    const script = callerScript();
    const kind = targetKind(self);
    const key = type + '|' + kind + '|' + script;
    if (_apply(_setHas, keySeen, [key])) return;
    _apply(_setAdd, keySeen, [key]);
    send('key-listener', { event: type, target: kind, script });
  });

  // --- 1 e 2. Globais novas e nativas substituídas ------------------------------
  // Referências capturadas depois dos nossos próprios hooks (que só mexem em
  // protótipos), então não geram falso positivo.
  const baseline = new _Set(_getNames(W));
  const read = (obj, key) => { try { return obj ? obj[key] : undefined; } catch { return undefined; } };
  const CRITICAL = [
    ['fetch', () => read(W, 'fetch')],
    ['XMLHttpRequest', () => read(W, 'XMLHttpRequest')],
    ['XMLHttpRequest.prototype.open', () => read(read(W.XMLHttpRequest, 'prototype'), 'open')],
    ['XMLHttpRequest.prototype.send', () => read(read(W.XMLHttpRequest, 'prototype'), 'send')],
    ['WebSocket', () => read(W, 'WebSocket')],
    ['WebSocket.prototype.send', () => read(read(W.WebSocket, 'prototype'), 'send')],
    ['EventTarget.prototype.addEventListener', () => read(read(W.EventTarget, 'prototype'), 'addEventListener')],
    ['navigator.sendBeacon', () => read(read(W.Navigator, 'prototype'), 'sendBeacon')],
    ['document.write', () => read(read(W.Document, 'prototype'), 'write')],
    ['window.open', () => read(W, 'open')],
    ['eval', () => read(W, 'eval')],
    ['Function', () => read(W, 'Function')],
    ['setTimeout', () => read(W, 'setTimeout')],
    ['setInterval', () => read(W, 'setInterval')],
  ];
  const originals = CRITICAL.map(([, get]) => get());

  function check(phase) {
    const names = _getNames(W);
    const added = [];
    for (let i = 0; i < names.length && added.length < MAX_GLOBALS; i++) {
      if (!_apply(_setHas, baseline, [names[i]])) added[added.length] = names[i];
    }
    const replaced = [];
    for (let i = 0; i < CRITICAL.length; i++) {
      const now = CRITICAL[i][1]();
      if (now !== originals[i]) replaced[replaced.length] = CRITICAL[i][0];
    }
    send('hook-check', { phase, addedGlobals: added, replaced });
  }
  _apply(_addListener, W, ['load', () => {
    check('load');
    _setTimeout(() => check('load+3s'), 3000);
    _setTimeout(() => check('load+10s'), 10000);
  }, true]);
})();
