'use strict';
// Executa no mundo principal da página em document_start, antes de qualquer
// script do site. Instrumenta APIs para observar:
//  - document.cookie (cookies definidos via JavaScript);
//  - Storage.setItem/removeItem/clear (localStorage e sessionStorage);
//  - indexedDB.open;
// e tira "fotografias" do armazenamento ao longo do carregamento.
//
// Cuidados de furtividade: usamos Proxy sobre as funções nativas (preserva
// name, length e o toString "[native code]") e não criamos propriedades
// globais novas. A página js-leaks do DDG é usada para validar isso.
(() => {
  const EVT = '__sentinela_evt__';
  const READY = '__sentinela_ready__';
  const PING = '__sentinela_ping__';

  // Referências nativas capturadas antes que a página possa sobrescrevê-las.
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
  const _setTimeout = W.setTimeout;
  const _split = String.prototype.split;
  const _indexOf = String.prototype.indexOf;
  const _slice = String.prototype.slice;
  const _exec = RegExp.prototype.exec;
  const _Proxy = W.Proxy;
  const _now = Date.now;
  const _charCodeAt = String.prototype.charCodeAt;
  const _padStart = String.prototype.padStart;
  const _toString = Number.prototype.toString;
  const _imul = Math.imul;
  const _Date = W.Date;
  const _toUTCString = Date.prototype.toUTCString;
  const _then = Promise.prototype.then;
  const _all = Promise.all;
  const _Promise = W.Promise;
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

  // Descobre qual script chamou a API, pela pilha de execução. Ignora frames
  // da própria extensão (moz-extension://).
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

  // FNV-1a 32 bits, igual a PL.hash no background. Só o hash dos valores sai
  // da página: basta para reconhecer um identificador repassado por URL.
  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= _apply(_charCodeAt, str, [i]);
      h = _imul(h, 0x01000193);
    }
    return _apply(_padStart, _apply(_toString, h >>> 0, [16]), [8, '0']);
  }

  function wrap(target, onCall) {
    return proxyOf(target, {
      apply(fn, thisArg, args) {
        try { onCall(thisArg, args); } catch { /* nunca quebrar a página */ }
        return _apply(fn, thisArg, args);
      },
    });
  }

  // --- document.cookie -----------------------------------------------------
  const cookieDesc = _getDesc(Document.prototype, 'cookie');
  const cookieGet = cookieDesc && cookieDesc.get;
  if (cookieDesc && cookieDesc.set && cookieDesc.get) {
    const nativeGet = cookieDesc.get;
    const setter = proxyOf(cookieDesc.set, {
      apply(fn, thisArg, args) {
        const str = _String(args[0]);
        const result = _apply(fn, thisArg, [str]);
        try {
          // O navegador aceitou? (pode ter sido bloqueado pelo ETP ou particionado)
          const eq = _apply(_indexOf, str, ['=']);
          const name = eq >= 0 ? _apply(_slice, str, [0, eq]).trim() : '';
          const jar = '; ' + _apply(nativeGet, thisArg, []);
          const accepted = name ? _apply(_indexOf, jar, ['; ' + name + '=']) >= 0 : null;
          send('cookie-set', { cookie: _apply(_slice, str, [0, 4096]), script: callerScript(), accepted });
        } catch { /* ignora */ }
        return result;
      },
    });
    _defineProperty(Document.prototype, 'cookie', Object.assign({}, cookieDesc, { set: setter }));
  }

  // --- Cookie Store API (cookieStore.set / cookieStore.delete) ----------------
  // Outra via de gravar cookies por JS, que não passa pelo setter de
  // document.cookie. Convertemos a chamada numa string no formato Set-Cookie
  // para o background usar o mesmo parser. A promessa diz se o navegador aceitou.
  function cookieStoreString(args, isDelete) {
    const o = args[0] !== null && typeof args[0] === 'object' ? args[0] : { name: args[0], value: args[1] };
    let s = _String(o.name) + '=' + (isDelete ? '' : _String(o.value === undefined ? '' : o.value));
    if (isDelete) s += '; max-age=0';
    else if (o.expires !== undefined && o.expires !== null) s += '; expires=' + _apply(_toUTCString, new _Date(o.expires), []);
    if (o.domain) s += '; domain=' + _String(o.domain);
    if (o.path) s += '; path=' + _String(o.path);
    if (o.sameSite) s += '; samesite=' + _String(o.sameSite);
    if (o.partitioned) s += '; partitioned';
    return s;
  }
  function wrapCookieStore(name, isDelete) {
    const CSP = W.CookieStore && CookieStore.prototype;
    if (!CSP || typeof CSP[name] !== 'function') return;
    _defineProperty(CSP, name, Object.assign({}, _getDesc(CSP, name), {
      value: proxyOf(CSP[name], {
        apply(fn, thisArg, args) {
          const result = _apply(fn, thisArg, args);
          try {
            const cookie = _apply(_slice, cookieStoreString(args, isDelete), [0, 4096]);
            const script = callerScript();
            const report = (accepted) => send('cookie-set', { cookie, script, accepted, api: 'cookieStore' });
            _apply(_then, result, [() => report(true), () => report(false)]);
          } catch { /* ignora */ }
          return result;
        },
      }),
    }));
  }
  wrapCookieStore('set', false);
  wrapCookieStore('delete', true);

  // --- Web Storage -----------------------------------------------------------
  const SP = Storage.prototype;
  const _key = SP.key;
  const _getItem = SP.getItem;
  const lsDesc = _getDesc(W, 'localStorage') || _getDesc(Window.prototype, 'localStorage');
  const ssDesc = _getDesc(W, 'sessionStorage') || _getDesc(Window.prototype, 'sessionStorage');

  function areaOf(storage) {
    try { if (lsDesc && _apply(lsDesc.get, W, []) === storage) return 'localStorage'; } catch { /* bloqueado */ }
    return 'sessionStorage';
  }

  // setItem(k, v) / removeItem(k) / clear(): mesmo evento, com a operação.
  for (const [name, op] of [['setItem', 'set'], ['removeItem', 'remove'], ['clear', 'clear']]) {
    _defineProperty(SP, name, Object.assign({}, _getDesc(SP, name), {
      value: wrap(SP[name], (self, args) => {
        const value = op === 'set' && args.length > 1 ? _String(args[1]) : '';
        send('storage-write', {
          area: areaOf(self), op, key: op === 'clear' ? '' : _String(args[0]),
          valueLength: value.length, valueHash: op === 'set' ? fnv(value) : null, script: callerScript(),
        });
      }),
    }));
  }

  // --- IndexedDB -------------------------------------------------------------
  const IDBF = W.IDBFactory && IDBFactory.prototype;
  if (IDBF && IDBF.open) {
    _defineProperty(IDBF, 'open', Object.assign({}, _getDesc(IDBF, 'open'), {
      value: wrap(IDBF.open, (self, args) => send('idb-open', { name: _String(args[0]), script: callerScript() })),
    }));
  }

  // --- Cache API ---------------------------------------------------------------
  const CS = W.CacheStorage && CacheStorage.prototype;
  if (CS && CS.open) {
    _defineProperty(CS, 'open', Object.assign({}, _getDesc(CS, 'open'), {
      value: wrap(CS.open, (self, args) => send('cache-open', { name: _String(args[0]), script: callerScript() })),
    }));
  }

  // --- Fotografias do armazenamento -------------------------------------------
  // Pegam também escritas que não passam por setItem (ex.: localStorage.x = 1).
  function readArea(desc) {
    try {
      const s = _apply(desc.get, W, []);
      const count = s.length;
      const keys = [];
      const hashes = [];
      let bytes = 0;
      for (let i = 0; i < count; i++) {
        const k = _apply(_key, s, [i]);
        const v = _apply(_getItem, s, [k]) || '';
        bytes += (k.length + v.length) * 2; // UTF-16
        if (keys.length < 50) {
          keys[keys.length] = _apply(_slice, k, [0, 100]);
          hashes[hashes.length] = fnv(v);
        }
      }
      return { count, bytes, keys, hashes };
    } catch (e) {
      return { error: (e && e.name) || 'Error' };
    }
  }

  // Lista nomes de um mecanismo assíncrono (IndexedDB, Cache API). Sempre
  // resolve: { names } ou { error } (ex.: SecurityError em frame bloqueado).
  const errorOf = (e) => ({ error: (e && e.name) || 'Error' });
  function listNames(getList) {
    try {
      const p = getList();
      if (!p) return _Promise.resolve(null);
      return _apply(_then, p, [(names) => ({ names }), errorOf]);
    } catch (e) {
      return _Promise.resolve(errorOf(e));
    }
  }

  // Hash dos valores dos cookies visíveis por JS (não HttpOnly), inclusive os
  // que já existiam antes desta visita.
  function cookieHashes() {
    try {
      const jar = _apply(cookieGet, document, []);
      const out = [];
      const parts = jar ? _apply(_split, jar, ['; ']) : [];
      for (let i = 0; i < parts.length && out.length < 50; i++) {
        const eq = _apply(_indexOf, parts[i], ['=']);
        if (eq > 0) out[out.length] = { name: _apply(_slice, parts[i], [0, eq]), hash: fnv(_apply(_slice, parts[i], [eq + 1])) };
      }
      return out;
    } catch { return null; }
  }

  function snapshot(phase) {
    const snap = {
      phase, localStorage: lsDesc && readArea(lsDesc), sessionStorage: ssDesc && readArea(ssDesc),
      cookies: cookieGet ? cookieHashes() : null,
    };
    const idb = listNames(() => {
      const f = W.indexedDB;
      if (!f || typeof f.databases !== 'function') return null;
      return _apply(_then, f.databases(), [(list) => list.map((d) => d.name)]);
    });
    // W.caches só existe em contexto seguro (HTTPS).
    const cache = listNames(() => (W.caches ? W.caches.keys() : null));
    _apply(_then, _apply(_all, _Promise, [[idb, cache]]), [([i, c]) => {
      if (i) snap.indexedDB = i;
      if (c) snap.cacheStorage = c;
      send('storage-snapshot', snap);
    }]);
  }

  _apply(_addListener, W, ['DOMContentLoaded', () => snapshot('domcontentloaded'), true]);
  _apply(_addListener, W, ['load', () => {
    snapshot('load');
    _setTimeout(() => snapshot('load+3s'), 3000);
    _setTimeout(() => snapshot('load+10s'), 10000);
  }, true]);
})();
