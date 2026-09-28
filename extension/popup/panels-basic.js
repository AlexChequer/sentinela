'use strict';
// Painéis de terceiros, cookies, armazenamento e score (popup e página de relatório).

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

// Duração legível: dias, ou horas/minutos para cookies curtos.
function lifetimeLabel(c) {
  if (c.lifetime === 'session') return 'sessão';
  const ms = c.expiry - c.t;
  if (ms >= 864e5) return `${Math.round(ms / 864e5)} d`;
  if (ms >= 36e5) return `${Math.round(ms / 36e5)} h`;
  return `${Math.max(1, Math.round(ms / 6e4))} min`;
}

function renderCookies(r, s) {
  const m = s.cookies.matrix;
  const matrix = el('div', { class: 'matrix' },
    el('div', { class: 'h' }, ''), el('div', { class: 'h' }, 'Sessão'), el('div', { class: 'h' }, 'Persistente'),
    el('div', {}, '1ª parte'), el('div', { class: 'n' }, m.first.session), el('div', { class: 'n' }, m.first.persistent),
    el('div', {}, '3ª parte'), el('div', { class: 'n' }, m.third.session), el('div', { class: 'n' }, m.third.persistent));
  const note = el('p', { class: 'note' },
    `${s.cookies.unique} cookies únicos em ${s.cookies.events} eventos de definição `,
    `(${s.cookies.bySource.http} via cabeçalho HTTP, ${s.cookies.bySource.js} via JavaScript)`,
    s.cookies.rejected ? `; ${s.cookies.rejected} tentativa(s) rejeitada(s) pelo navegador (sufixo público ou domínio inválido), fora da contagem.` : '.');
  if (!r.cookies.length) return [matrix, el('p', { class: 'empty' }, 'Nenhum cookie definido nesta página.')];
  // Uma linha por cookie (domínio, caminho, nome), com o último evento dele:
  // scripts como o do YouTube gravam e apagam o mesmo cookie várias vezes.
  const byKey = new Map();
  for (const c of r.cookies) {
    const key = `${c.domain}|${c.path}|${c.name}`;
    const prev = byKey.get(key);
    byKey.set(key, { c, events: (prev ? prev.events : 0) + 1, everSet: (prev && prev.everSet) || c.lifetime !== 'deleted' });
  }
  const rows = [...byKey.values()].reverse().slice(0, 300).map(({ c, events, everSet }) => el('tr', {},
    el('td', { class: 'host' }, c.name || '(sem nome)', el('span', { class: 'sub' }, c.domain)),
    el('td', {},
      partyTag(c.party),
      c.rejected ? tag(c.publicSuffix ? 'rejeitado: sufixo público' : 'rejeitado: domínio inválido', 'warn')
        : c.lifetime === 'deleted' ? tag(everSet ? 'gravado e removido' : 'remoção') : tag(lifetimeLabel(c)),
      tag(c.api === 'cookieStore' ? 'cookieStore' : c.source.toUpperCase()),
      events > 1 ? tag(`${events} eventos`) : null,
      c.accepted === false && c.lifetime !== 'deleted' ? tag('não aceito', 'warn') : null,
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

// Quebra do score por critério, com o equivalente no Blacklight.
function renderScore(s) {
  const sc = s.score;
  const rows = sc.items.map((c) => el('tr', { class: c.found ? 'hit' : '' },
    el('td', {}, c.label, c.detail && c.found ? el('span', { class: 'sub' }, c.detail) : null),
    el('td', {}, c.blacklight ? c.blacklight : el('span', { class: 'sub' }, 'só Sentinela')),
    el('td', {}, c.found ? tag('encontrado', 'trk') : tag('não')),
    el('td', { class: 'num' }, c.penalty ? `−${c.penalty}` : '0')));
  return [
    el('p', { class: 'note' }, `Score ${sc.score}/100 (${sc.grade}). Começa em 100 e cada critério desconta até um teto. Metodologia: docs/metodologia-score.md.`),
    el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Critério'), el('th', {}, 'Blacklight'), el('th', {}, 'Resultado'), el('th', { class: 'num' }, 'Pontos'))),
      el('tbody', {}, rows)),
  ];
}
