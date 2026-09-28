'use strict';
// Popup: consulta o background a cada segundo e desenha o relatório da aba ativa.
// Todo conteúdo vindo das páginas é inserido com textContent (nunca innerHTML):
// nomes de cookies e chaves de storage são dados controlados por terceiros.

let tabId = null;
let current = 'domains';

function renderTally(s) {
  const t = document.getElementById('tally');
  t.replaceChildren(
    el('div', { class: `main grade-${s.score.grade}` }, el('b', {}, s.score.score), el('span', {}, `score (${s.score.grade})`)),
    el('div', { class: s.domains.trackers ? 'bad' : '' }, el('b', {}, s.domains.trackers), el('span', {}, 'rastreadores de terceiros')),
    el('div', {}, el('b', {}, s.domains.thirdParty), el('span', {}, 'domínios de terceiros')),
    el('div', {}, el('b', {}, s.cookies.unique), el('span', {}, 'cookies definidos')),
    el('div', {}, el('b', {}, s.storage.localStorageKeys + s.storage.sessionStorageKeys + s.storage.indexedDBs + s.storage.cacheStorages), el('span', {}, 'itens em storage')),
  );
}

async function refresh() {
  const data = await browser.runtime.sendMessage({ type: 'get-report', tabId }).catch(() => null);
  if (!data) {
    document.getElementById('site').textContent = 'Sem dados';
    document.getElementById('url').textContent = 'Recarregue a página com a extensão ativa.';
    return;
  }
  const { report: r, summary: s } = data;
  document.getElementById('site').textContent = r.site;
  document.getElementById('url').textContent = r.url;
  renderTally(s);
  const panels = {
    domains: () => renderDomains(r),
    cookies: () => renderCookies(r, s),
    storage: () => renderStorage(r),
    score: () => renderScore(s),
    fingerprint: () => renderFingerprint(r, s),
    navigation: () => renderNavigation(r, s),
    threats: () => renderThreats(r, s),
    blocking: () => renderBlocking(r, s),
  };
  // Na aba Bloqueio só a parte dinâmica é redesenhada (o formulário fica).
  const panel = document.getElementById(current === 'blocking' ? 'blocking-dynamic' : `tab-${current}`);
  const y = document.querySelector('main').scrollTop;
  panel.replaceChildren(...[panels[current]()].flat());
  document.querySelector('main').scrollTop = y;
}

async function checkPermission() {
  const ok = await browser.permissions.contains({ origins: ['<all_urls>'] });
  document.getElementById('perm').hidden = ok;
}

document.getElementById('grant').addEventListener('click', async () => {
  await browser.permissions.request({ origins: ['<all_urls>'] });
  checkPermission();
});

document.getElementById('open-report').addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL(`report/report.html?tab=${tabId}`) });
  window.close();
});

document.getElementById('export').addEventListener('click', async (e) => {
  const res = await browser.runtime.sendMessage({ type: 'export-report', tabId });
  e.target.textContent = res && res.ok ? 'Exportado' : 'Falhou';
  setTimeout(() => { e.target.textContent = 'Exportar JSON'; }, 1500);
});

for (const b of document.querySelectorAll('[role="tab"]')) {
  b.addEventListener('click', () => {
    current = b.dataset.tab;
    for (const o of document.querySelectorAll('[role="tab"]')) {
      const on = o === b;
      o.setAttribute('aria-selected', String(on));
      document.getElementById(`tab-${o.dataset.tab}`).hidden = !on;
    }
    refresh();
  });
}

(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  checkPermission();
  setupBlockingControls();
  refresh();
  setInterval(refresh, 1000);
})();
