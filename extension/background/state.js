'use strict';
// Estado por aba. No Manifest V3 o background do Firefox é uma "event page"
// que pode ser suspensa após ~30 s ociosa; por isso espelhamos o estado em
// storage.session e o restauramos ao acordar.

PL.tabs = new Map();
// Saltos de navegação por aba. Fica fora do relatório porque o relatório é
// trocado a cada página, e o bounce tracking só aparece olhando a sequência.
PL.nav = new Map();
PL.LIMITS = { requestLog: 1500, cookies: 2000, storageWrites: 300, canvas: 200, params: 500, hops: 12, hashes: 200 };

PL.ready = (async () => {
  try {
    const { tabs, nav } = await browser.storage.session.get(['tabs', 'nav']);
    if (tabs) for (const [k, v] of Object.entries(tabs)) PL.tabs.set(Number(k), v);
    if (nav) for (const [k, v] of Object.entries(nav)) PL.nav.set(Number(k), v);
  } catch (e) {
    console.warn('[sentinela] falha ao restaurar estado', e);
  }
})();

let saveTimer = null;
PL.persist = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const tabs = Object.fromEntries(PL.tabs);
    const nav = Object.fromEntries(PL.nav);
    try { await browser.storage.session.set({ tabs, nav }); }
    catch (e) { console.warn('[sentinela] falha ao persistir', e); }
  }, 800);
};

PL.newReport = (tabId, url, navRequestId = null) => ({
  tabId,
  url,
  site: PL.siteOf(url),
  startedAt: Date.now(),
  navRequestId,
  committed: false,
  requests: { total: 0, thirdParty: 0, log: [] },
  domains: {},   // site (eTLD+1) -> agregado
  cookies: [],   // eventos de definição de cookie (HTTP e JS)
  storage: {},   // origem do frame -> uso de localStorage/sessionStorage/IndexedDB
  fingerprint: { canvas: [] }, // leituras de canvas classificadas
  tracking: { params: [], paramHashes: {} }, // parâmetros de rastreamento e hashes de valores enviados
  hopId: null,   // salto de navegação correspondente (PL.nav)
  threats: PL.newThreats(), // indicadores de hijacking/hook
  blocked: {},   // host -> requisições canceladas pela lista de bloqueio
});

// Garante que exista um relatório para a aba. Se a extensão foi carregada com a
// página já aberta, cria um a partir da URL de topo conhecida.
PL.ensureReport = (tabId, topUrl) => {
  let r = PL.tabs.get(tabId);
  if (!r && topUrl && PL.isWebUrl(topUrl)) {
    r = PL.newReport(tabId, topUrl);
    r.committed = true;
    PL.tabs.set(tabId, r);
  }
  return r || null;
};

PL.partyOf = (r, site) => (site === r.site ? 'first' : 'third');

PL.domainEntry = (r, site) => {
  let d = r.domains[site];
  if (!d) {
    d = r.domains[site] = {
      site, party: PL.partyOf(r, site), hosts: {}, requests: 0, types: {},
      tracker: false, categories: [], company: null, sources: [], firefoxFlags: [],
      cookiesSet: 0, firstSeen: Date.now(),
    };
    // Domínios que só aparecem via cookie também recebem classificação.
    const cls = PL.classifyHost(site);
    d.tracker = cls.isTracker;
    d.company = cls.company;
    d.categories = [...cls.categories];
    d.sources = [...cls.sources];
  }
  return d;
};

PL.updateBadge = (r) => {
  const n = Object.values(r.domains).filter((d) => d.tracker && d.party === 'third').length;
  if (r._badge === n) return;
  r._badge = n;
  browser.action.setBadgeText({ tabId: r.tabId, text: n ? String(n) : '' }).catch(() => {});
  browser.action.setBadgeBackgroundColor({ tabId: r.tabId, color: n ? '#c8323b' : '#2f7d5b' }).catch(() => {});
};

browser.tabs.onRemoved.addListener(async (tabId) => {
  await PL.ready;
  PL.tabs.delete(tabId);
  PL.nav.delete(tabId);
  PL.persist();
});
