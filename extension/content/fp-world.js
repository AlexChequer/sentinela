'use strict';
// Detecção de canvas fingerprint. Roda no mundo principal em document_start,
// logo depois de main-world.js, e usa o mesmo canal de eventos até a ponte.
//
// Heurística de Englehardt & Narayanan (2016), usada no OpenWPM: um script
// desenha texto variado ou várias cores num canvas de pelo menos 16x16 e depois
// extrai a imagem. Aqui só coletamos os sinais por canvas; a classificação
// fica no background (background/fingerprint.js).
//
// Mesmos cuidados de main-world.js: Proxy sobre as nativas, nenhuma global nova
// e referências nativas capturadas antes de qualquer script da página.
(() => {
  const EVT = '__sentinela_evt__';
  const READY = '__sentinela_ready__';
  const PING = '__sentinela_ping__';
  const MAX_TEXT = 200;  // caracteres examinados por chamada de fillText
  const SAMPLE = 40;     // trecho de texto enviado (identifica o "pangrama" do fingerprinter)

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
  const _split = String.prototype.split;
  const _indexOf = String.prototype.indexOf;
  const _slice = String.prototype.slice;
  const _exec = RegExp.prototype.exec;
  const _Proxy = W.Proxy;
  const _now = Date.now;
  const _WeakMap = W.WeakMap;
  const _wmGet = WeakMap.prototype.get;
  const _wmSet = WeakMap.prototype.set;
  const _Set = W.Set;
  const _setAdd = Set.prototype.add;
  const _setHas = Set.prototype.has;
  const _setSize = _getDesc(Set.prototype, 'size').get;
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

  function wrapSetter(proto, name, onSet) {
    const desc = proto && _getDesc(proto, name);
    if (!desc || !desc.set) return;
    _defineProperty(proto, name, Object.assign({}, desc, {
      set: proxyOf(desc.set, {
        apply(fn, thisArg, args) {
          try { onSet(thisArg, args[0]); } catch { /* ignora */ }
          return _apply(fn, thisArg, args);
        },
      }),
    }));
  }

  // --- Estado por canvas -----------------------------------------------------
  const C2D = W.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  const O2D = W.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype;
  const HCE = W.HTMLCanvasElement && HTMLCanvasElement.prototype;
  const OFC = W.OffscreenCanvas && OffscreenCanvas.prototype;
  const _O2DCtor = W.OffscreenCanvasRenderingContext2D;
  const _OFCCtor = W.OffscreenCanvas;
  const getter = (proto, name) => { const d = proto && _getDesc(proto, name); return d && d.get; };
  const ctxCanvas = { c2d: getter(C2D, 'canvas'), o2d: getter(O2D, 'canvas') };
  const dims = {
    html: { w: getter(HCE, 'width'), h: getter(HCE, 'height') },
    off: { w: getter(OFC, 'width'), h: getter(OFC, 'height') },
  };

  const states = new _WeakMap();
  function stateOf(canvas) {
    let s = _apply(_wmGet, states, [canvas]);
    if (!s) {
      s = { chars: new _Set(), colors: new _Set(), text: '', sent: new _Set() };
      _apply(_wmSet, states, [canvas, s]);
    }
    return s;
  }
  function canvasOfContext(ctx) {
    const g = _O2DCtor && ctx instanceof _O2DCtor ? ctxCanvas.o2d : ctxCanvas.c2d;
    return g ? _apply(g, ctx, []) : null;
  }

  // --- Sinais: texto e cores desenhados ----------------------------------------
  function onText(ctx, args) {
    const canvas = canvasOfContext(ctx);
    if (!canvas) return;
    const s = stateOf(canvas);
    const text = _apply(_slice, _String(args[0]), [0, MAX_TEXT]);
    for (let i = 0; i < text.length; i++) _apply(_setAdd, s.chars, [text[i]]);
    if (s.text.length < SAMPLE) s.text = _apply(_slice, s.text + text, [0, SAMPLE]);
  }
  function onColor(ctx, value) {
    if (typeof value !== 'string') return; // gradientes e padrões não contam como cor
    const canvas = canvasOfContext(ctx);
    if (canvas) _apply(_setAdd, stateOf(canvas).colors, [value]);
  }
  for (const proto of [C2D, O2D]) {
    wrapMethod(proto, 'fillText', onText);
    wrapMethod(proto, 'strokeText', onText);
    wrapSetter(proto, 'fillStyle', onColor);
    wrapSetter(proto, 'strokeStyle', onColor);
  }

  // --- Extração da imagem ------------------------------------------------------
  // Envia um evento por (canvas, API): jogos e gráficos chamam getImageData em
  // laço e não podem inundar o background.
  function onExtract(canvas, api, type) {
    if (!canvas) return;
    const s = stateOf(canvas);
    if (_apply(_setHas, s.sent, [api])) return;
    _apply(_setAdd, s.sent, [api]);
    const d = _OFCCtor && canvas instanceof _OFCCtor ? dims.off : dims.html;
    send('canvas-read', {
      api,
      mimeType: type === undefined ? null : _String(type),
      width: d.w ? _apply(d.w, canvas, []) : null,
      height: d.h ? _apply(d.h, canvas, []) : null,
      distinctChars: _apply(_setSize, s.chars, []),
      colors: _apply(_setSize, s.colors, []),
      textSample: s.text,
      script: callerScript(),
    });
  }
  wrapMethod(HCE, 'toDataURL', (canvas, args) => onExtract(canvas, 'toDataURL', args[0]));
  wrapMethod(HCE, 'toBlob', (canvas, args) => onExtract(canvas, 'toBlob', args[1]));
  wrapMethod(OFC, 'convertToBlob', (canvas, args) => onExtract(canvas, 'convertToBlob', args[0] && args[0].type));
  wrapMethod(C2D, 'getImageData', (ctx) => onExtract(canvasOfContext(ctx), 'getImageData'));
  wrapMethod(O2D, 'getImageData', (ctx) => onExtract(canvasOfContext(ctx), 'getImageData'));
})();
