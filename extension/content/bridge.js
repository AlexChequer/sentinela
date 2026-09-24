'use strict';
// Content script no mundo isolado. Recebe os eventos do script do mundo
// principal (main-world.js), agrupa e repassa ao background. O script do
// mundo principal não tem acesso à API browser.*, por isso a ponte.
(() => {
  const EVT = '__sentinela_evt__';
  const READY = '__sentinela_ready__';
  const PING = '__sentinela_ping__';

  let buffer = [];
  let timer = null;

  function flush() {
    timer = null;
    if (!buffer.length) return;
    const events = buffer;
    buffer = [];
    browser.runtime.sendMessage({
      type: 'content-events',
      url: location.href,
      origin: location.origin,
      isTop: window === window.top,
      events,
    }).catch(() => {});
  }

  window.addEventListener(EVT, (e) => {
    let ev;
    try { ev = JSON.parse(e.detail); } catch { return; }
    if (!ev || typeof ev.type !== 'string') return;
    buffer.push(ev);
    if (!timer) timer = setTimeout(flush, 200);
  }, true);

  // Aperto de mão: o script principal guarda eventos em fila até saber que a
  // ponte está ouvindo (a ordem de execução dos dois scripts não é garantida).
  const announce = () => window.dispatchEvent(new CustomEvent(READY));
  window.addEventListener(PING, announce, true);
  announce();

  window.addEventListener('pagehide', flush, true);
})();
