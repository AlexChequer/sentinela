'use strict';
// Bounce tracking: a navegação passa por um site intermediário (em geral um
// rastreador), que lê ou grava um identificador em 1ª parte e redireciona para
// o destino, às vezes repassando esse identificador na URL. Cada página vista
// na aba vira um "salto" em PL.nav; a análise olha a sequência de saltos.
//
// Regra (inspirada na mitigação de bounce tracking do Firefox e na página
// bounce-tracking do DDG): um salto é bounce se
//  - o site dele difere do site anterior e do seguinte;
//  - a saída foi um redirecionamento (servidor ou script) ou a permanência
//    foi curta (< BOUNCE_MAX_DWELL_MS), o que cobre location.href via setTimeout;
//  - ele tinha estado (cookie ou storage) ou repassou um valor dele na URL.

const BOUNCE_MAX_DWELL_MS = 5000;
const REDIRECTS = new Set(['server_redirect', 'client_redirect']);
// Valores triviais não servem como prova de repasse de identificador.
const TRIVIAL_HASHES = new Set(['', '0', '1', 'true', 'false', 'null', 'undefined'].map((v) => PL.hash(v)));

let hopSeq = 0;

function newHop(url, arrivedBy) {
  const u = new URL(url);
  const cls = PL.classifyHost(u.hostname);
  return {
    id: `${Date.now()}-${hopSeq++}`, t: Date.now(), dwellMs: null,
    site: PL.siteOf(url), host: u.hostname, page: PL.trunc(u.origin + u.pathname, 200),
    arrivedBy, qualifiers: [], tracker: cls.isTracker,
    // Parâmetros da URL de chegada: só nome e hash (é por onde chega um UID repassado).
    params: PL.paramsOf(url).slice(0, 30).map(([name, v]) => ({ name, hash: PL.hash(v), len: v.length })),
    hadState: false, cookieNames: [], idHashes: [],
  };
}

// Encerra a página atual da aba (se houver) e abre um relatório e um salto novos.
PL.startPage = (tabId, url, navRequestId, arrivedBy) => {
  const hops = PL.nav.get(tabId) || [];
  const last = hops[hops.length - 1];
  if (last && last.dwellMs === null) last.dwellMs = Date.now() - last.t;
  const hop = newHop(url, arrivedBy);
  hops.push(hop);
  if (hops.length > PL.LIMITS.hops) hops.splice(0, hops.length - PL.LIMITS.hops);
  PL.nav.set(tabId, hops);
  const r = PL.newReport(tabId, url, navRequestId);
  r.hopId = hop.id;
  PL.tabs.set(tabId, r);
  return r;
};

// Registra como a navegação foi confirmada (webNavigation.onCommitted).
PL.markArrival = (tabId, d) => {
  const hops = PL.nav.get(tabId) || [];
  const hop = hops[hops.length - 1];
  if (!hop) return;
  hop.qualifiers = d.transitionQualifiers || [];
  const redirect = hop.qualifiers.find((q) => REDIRECTS.has(q));
  if (redirect) hop.arrivedBy = redirect;
  else if (hop.arrivedBy === 'navigation' && d.transitionType) hop.arrivedBy = d.transitionType;
};

// Salto mais recente de um site (eventos atrasados da página anterior chegam
// depois que a aba já trocou de relatório).
PL.hopOf = (tabId, site) => {
  const hops = PL.nav.get(tabId) || [];
  for (let i = hops.length - 1; i >= Math.max(0, hops.length - 4); i--) if (hops[i].site === site) return hops[i];
  return null;
};

function addHash(hop, h) {
  if (h && !TRIVIAL_HASHES.has(h) && !hop.idHashes.includes(h) && hop.idHashes.length < PL.LIMITS.hashes) hop.idHashes.push(h);
}

// Alimenta o salto com o estado que a página de topo gravou ou já tinha.
PL.feedHop = (hop, ev, cookie) => {
  if (!hop) return;
  if (cookie) {
    if (cookie.lifetime !== 'deleted') hop.hadState = true;
    if (!hop.cookieNames.includes(cookie.name) && hop.cookieNames.length < 30) hop.cookieNames.push(cookie.name);
    addHash(hop, cookie.valueHash);
    return;
  }
  if (ev.type === 'storage-write' && ev.op === 'set') {
    hop.hadState = true;
    addHash(hop, ev.valueHash);
  } else if (ev.type === 'storage-snapshot') {
    for (const area of ['localStorage', 'sessionStorage']) {
      const a = ev[area];
      if (!a || a.error) continue;
      if (a.count) hop.hadState = true;
      for (const h of a.hashes || []) addHash(hop, h);
    }
    for (const c of ev.cookies || []) {
      hop.hadState = true;
      if (!hop.cookieNames.includes(c.name) && hop.cookieNames.length < 30) hop.cookieNames.push(c.name);
      addHash(hop, c.hash);
    }
  }
};

const quick = (h) => h.dwellMs !== null && h.dwellMs < BOUNCE_MAX_DWELL_MS;

// Cadeia de saltos que levou à página atual e os bounces nela.
PL.analyzeNav = (r) => {
  const hops = PL.nav.get(r.tabId) || [];
  const idx = hops.findIndex((h) => h.id === r.hopId);
  if (idx < 0) return { chain: [], bounces: [] };
  // Recua enquanto a chegada foi por redirecionamento ou o salto anterior foi rápido.
  let start = idx;
  while (start > 0 && (REDIRECTS.has(hops[start].arrivedBy) || quick(hops[start - 1]))) start--;
  const bounces = [];
  for (let i = start; i < idx; i++) {
    const h = hops[i];
    const prev = i > 0 ? hops[i - 1] : null;
    const next = hops[i + 1];
    const crossSite = h.site !== next.site && (!prev || h.site !== prev.site);
    if (!crossSite || !(REDIRECTS.has(next.arrivedBy) || quick(h))) continue;
    const uidParams = next.params.filter((p) => h.idHashes.includes(p.hash)).map((p) => p.name);
    if (!h.hadState && !uidParams.length) continue;
    bounces.push({
      site: h.site, host: h.host, page: h.page, tracker: h.tracker, dwellMs: h.dwellMs,
      from: prev ? prev.site : null, to: next.site, via: next.arrivedBy,
      cookieNames: h.cookieNames, uidParams,
    });
  }
  const chain = hops.slice(Math.max(0, start - 1), idx + 1).map((h) => ({
    site: h.site, page: h.page, arrivedBy: h.arrivedBy, dwellMs: h.dwellMs, tracker: h.tracker,
    bounce: bounces.some((b) => b.page === h.page && b.site === h.site),
  }));
  return { chain, bounces };
};
