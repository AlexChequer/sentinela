'use strict';
// Popup: consulta o background a cada segundo e desenha o relatório da aba ativa.
// Todo conteúdo vindo das páginas é inserido com textContent (nunca innerHTML):
// nomes de cookies e chaves de storage são dados controlados por terceiros.

let tabId = null;
let current = 'domains';

function renderTally(s) {
  const t = document.getElementById('tally');
  t.replaceChildren(
    el('div', { class: `main ${s.domains.trackers ? '' : 'zero'}` }, el('b', {}, s.domains.trackers), el('span', {}, 'rastreadores de terceiros')),
    el('div', {}, el('b', {}, s.domains.thirdParty), el('span', {}, 'domínios de terceiros')),
    el('div', {}, el('b', {}, s.cookies.unique), el('span', {}, 'cookies definidos')),
    el('div', {}, el('b', {}, s.storage.localStorageKeys + s.storage.sessionStorageKeys + s.storage.indexedDBs + s.storage.cacheStorages), el('span', {}, 'itens em storage')),
  );
}

function renderDomains(r) {
  const list = Object.values(r.domains)
    .filter((d) => d.party === 'third')
    .sort((a, b) => (b.tracker - a.tracker) || (b.requests - a.requests));
  if (!list.length) return el('p', { class: 'empty' }, 'Nenhuma conexão a domínios de terceiros até agora.');
  // Cada host do site aparece com a própria classificação.
  const hostLine = ([name, h]) => el('span', { class: 'sub' },
    name, ' ', h.tracker ? tag('rastreador', 'trk') : tag('terceiro'),
    h.tracker && h.company ? ` ${h.company}` : '');
  return el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Domínio'), el('th', {}, 'Classificação'), el('th', { class: 'num' }, 'Req.'), el('th', { class: 'num' }, 'Cookies'))),
    el('tbody', {}, list.map((d) => el('tr', {},
      el('td', { class: 'host' }, d.site, Object.entries(d.hosts).map(hostLine)),
      el('td', {},
        d.tracker ? tag('rastreador', 'trk') : tag('terceiro'),
        d.categories.length ? el('span', { class: 'sub' }, d.categories.join(', ')) : null,
        d.firefoxFlags.length ? el('span', { class: 'sub' }, `Firefox: ${d.firefoxFlags.join(', ')}`) : null),
      el('td', { class: 'num' }, d.requests),
      el('td', { class: 'num' }, d.cookiesSet || '',
        blockState.domains.includes(d.site)
          ? el('button', { type: 'button', class: 'mini on', 'data-unblock': d.site, title: 'Remover da lista de bloqueio' }, 'desbloquear')
          : el('button', { type: 'button', class: 'mini', 'data-block': d.site, title: 'Bloquear este domínio e subdomínios' }, 'bloquear'))))));
}

function renderCookies(r, s) {
  const m = s.cookies.matrix;
  const matrix = el('div', { class: 'matrix' },
    el('div', { class: 'h' }, ''), el('div', { class: 'h' }, 'Sessão'), el('div', { class: 'h' }, 'Persistente'),
    el('div', {}, '1ª parte'), el('div', { class: 'n' }, m.first.session), el('div', { class: 'n' }, m.first.persistent),
    el('div', {}, '3ª parte'), el('div', { class: 'n' }, m.third.session), el('div', { class: 'n' }, m.third.persistent));
  const note = el('p', { class: 'note' },
    `${s.cookies.unique} cookies únicos em ${s.cookies.events} eventos de definição `,
    `(${s.cookies.bySource.http} via cabeçalho HTTP, ${s.cookies.bySource.js} via JavaScript).`);
  if (!r.cookies.length) return [matrix, el('p', { class: 'empty' }, 'Nenhum cookie definido nesta página.')];
  const rows = [...r.cookies].reverse().slice(0, 300).map((c) => el('tr', {},
    el('td', { class: 'host' }, c.name || '(sem nome)', el('span', { class: 'sub' }, c.domain)),
    el('td', {},
      partyTag(c.party),
      c.lifetime === 'deleted' ? tag('remoção') : tag(c.lifetime === 'session' ? 'sessão' : `${c.lifetimeDays} d`),
      tag(c.api === 'cookieStore' ? 'cookieStore' : c.source.toUpperCase()),
      c.accepted === false ? tag('não aceito', 'warn') : null,
      c.domainMatches === false ? tag('domínio inválido', 'warn') : null,
      c.setBy ? el('span', { class: 'sub' }, `por ${c.setBy}`) : null)));
  return [matrix, note, el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Cookie'), el('th', {}, 'Tipo'))),
    el('tbody', {}, rows))];
}

function renderStorage(r) {
  const frames = Object.values(r.storage);
  if (!frames.length) return el('p', { class: 'empty' }, 'Sem dados de armazenamento ainda. Aguarde o carregamento terminar.');
  const cell = (s, area) => {
    if (s.errors[area]) return tag(`bloqueado: ${s.errors[area]}`, 'warn');
    const a = s[area];
    if (!a) return '—';
    return [el('b', {}, a.count), ` chaves, ${Math.round(a.bytes / 1024 * 10) / 10} KB`,
      a.keys.length ? el('span', { class: 'sub' }, a.keys.slice(0, 8).join(', ')) : null];
  };
  const names = (s, area, list) => (s.errors[area] ? tag(`bloqueado: ${s.errors[area]}`, 'warn') : (list.join(', ') || '—'));
  return el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Origem'), el('th', {}, 'localStorage'), el('th', {}, 'sessionStorage'), el('th', {}, 'IndexedDB'), el('th', {}, 'Cache API'))),
    el('tbody', {}, frames.map((s) => el('tr', {},
      el('td', { class: 'host' }, s.origin, el('span', { class: 'sub' }, partyTag(s.party), s.isTop ? ' topo' : ' iframe')),
      el('td', {}, cell(s, 'localStorage')),
      el('td', {}, cell(s, 'sessionStorage')),
      el('td', {}, names(s, 'indexedDB', s.indexedDB.databases)),
      el('td', {}, names(s, 'cacheStorage', s.cacheStorage.caches))))));
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
