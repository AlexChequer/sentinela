// "Hook" simulado para testar a Sentinela. Imita o que o hook.js do BeEF faz
// numa página comprometida, mas não envia nada: as requisições vão para o
// mesmo servidor local e as teclas digitadas não são guardadas.
(() => {
  const base = `http://127.0.0.1:${location.port}/tests/pages`;
  const log = (m) => { const el = document.getElementById('log'); if (el) el.textContent += `${m}\n`; };

  // 1. Global e cookie com os nomes usados pelo BeEF.
  window.beef = { version: 'simulado', session: 'Zx81Qw7Lp2Ty9Nc4' };
  document.cookie = 'BEEFHOOK=Zx81Qw7Lp2Ty9Nc4; path=/; max-age=3600';
  log('global beef e cookie BEEFHOOK criados');

  // 2. Substitui nativas (um hook real usaria isso para espionar requisições).
  const realFetch = window.fetch;
  window.fetch = function (...args) { return realFetch.apply(this, args); };
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) { return realOpen.apply(this, args); };
  log('fetch e XMLHttpRequest.prototype.open substituídos');

  // 3. Listener de teclado (não guarda nada).
  document.addEventListener('keydown', () => {});
  log('listener de keydown registrado');

  // 4. Injeção dinâmica de outro script de terceiro.
  const extra = document.createElement('script');
  extra.src = `${base}/extra.js`;
  document.body.appendChild(extra);

  // 5. Canal de comando: WebSocket para o terceiro (vai falhar, não há servidor WS).
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${location.port}/ws`);
    ws.onerror = () => log('WebSocket: conexão recusada (esperado)');
  } catch (e) { log(`WebSocket: ${e.message}`); }

  // 6. Polling a cada 2 s, como o hook do BeEF consultando o servidor.
  let n = 0;
  setInterval(() => {
    realFetch(`${base}/poll.json?session=Zx81Qw7Lp2Ty9Nc4&n=${n++}`).catch(() => {});
    log(`polling #${n}`);
  }, 2000);
})();
