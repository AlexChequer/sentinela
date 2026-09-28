'use strict';
// Página de relatório: tudo o que a Sentinela sabe sobre a aba, numa tela só
// (é a tela usada nos prints do relatório). Reusa os painéis do popup.

const tabId = Number(new URLSearchParams(location.search).get('tab'));
let lastKey = '';

function card(value, label, bad = false) {
  return el('div', { class: bad ? 'bad' : '' }, el('b', {}, value), el('span', {}, label));
}

function renderHeader(r, s) {
  document.getElementById('site').textContent = r.site;
  document.getElementById('url').textContent = r.url;
  document.getElementById('meta').textContent =
    `Coletado a partir de ${new Date(r.startedAt).toLocaleString('pt-BR')} · atualizado ${new Date().toLocaleTimeString('pt-BR')} · ${s.requests.total} requisições (${s.requests.thirdParty} de terceiros)`;
  document.getElementById('score').replaceChildren(
    el('b', { class: `grade-${s.score.grade}` }, s.score.score), el('span', {}, `score de privacidade · ${s.score.grade}`));
  document.getElementById('score').className = `rscore grade-${s.score.grade}`;
  const st = s.storage;
  const t = s.threats;
  document.getElementById('cards').replaceChildren(
    card(s.domains.trackers, 'rastreadores de terceiros', s.domains.trackers > 0),
    card(s.domains.thirdParty, 'domínios de terceiros'),
    card(s.cookies.unique, `cookies (${s.cookies.matrix.third.session + s.cookies.matrix.third.persistent} de 3ª parte)`),
    card(st.localStorageKeys + st.sessionStorageKeys + st.indexedDBs + st.cacheStorages, 'itens em storage'),
    card(s.fingerprint.canvasFingerprints, 'canvas fingerprints', s.fingerprint.canvasFingerprints > 0),
    card(s.navigation.bounces.length + s.tracking.syncs.length, 'bounces / syncs', s.navigation.bounces.length + s.tracking.syncs.length > 0),
    card(t.beef.length + t.replacedNatives.length + t.websockets.length + t.polling.length, 'indicadores de hook', t.beef.length + t.replacedNatives.length > 0),
    card(s.blocked.requests, 'requisições bloqueadas'),
  );
}

const SECTIONS = [
  ['Score de privacidade', (r, s) => renderScore(s)],
  ['Terceiros e rastreadores', (r) => renderDomains(r)],
  ['Cookies', (r, s) => renderCookies(r, s)],
  ['Armazenamento no cliente (HTML5)', (r) => renderStorage(r)],
  ['Fingerprint', (r, s) => renderFingerprint(r, s)],
  ['Navegação: bounce tracking, parâmetros e cookie sync', (r, s) => renderNavigation(r, s)],
  ['Ameaças: hijacking e hooks', (r, s) => renderThreats(r, s)],
  ['Bloqueio', (r, s) => renderBlocking(r, s)],
];

async function refresh() {
  const data = await browser.runtime.sendMessage({ type: 'get-report', tabId }).catch(() => null);
  if (!data) {
    document.getElementById('site').textContent = 'Sem dados para esta aba';
    document.getElementById('url').textContent = 'A aba foi fechada ou ainda não carregou nada com a extensão ativa.';
    return;
  }
  const { report: r, summary: s } = data;
  // Só redesenha se algo mudou (evita pular a rolagem enquanto se tira print).
  const key = JSON.stringify(s) + blockState.domains.join(',');
  if (key === lastKey) return;
  lastKey = key;
  renderHeader(r, s);
  document.getElementById('sections').replaceChildren(...SECTIONS.map(([title, render]) =>
    el('section', {}, el('h2', {}, title), ...[render(r, s)].flat())));
}

// Botões "bloquear"/"remover" dentro das tabelas.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-block],[data-unblock]');
  if (!b) return;
  if (b.dataset.block) setBlocked(b.dataset.block, true); else setBlocked(b.dataset.unblock, false);
});

refresh();
setInterval(refresh, 3000);
