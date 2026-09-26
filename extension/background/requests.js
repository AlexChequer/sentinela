'use strict';
// Observa todas as requisições de rede das abas e agrega por domínio.

PL.topUrlOf = function topUrlOf(d) {
  if (d.type === 'main_frame') return d.url;
  if (d.frameAncestors && d.frameAncestors.length) return d.frameAncestors[d.frameAncestors.length - 1].url;
  return d.documentUrl || d.originUrl;
};

PL.recordRequest = (r, d) => {
  const host = PL.hostOf(d.url);
  if (!host) return;
  const site = PL.siteOfHost(host);
  const party = PL.partyOf(r, site);
  const cls = PL.classifyHost(host, d.urlClassification);

  r.requests.total++;
  if (party === 'third') r.requests.thirdParty++;

  const dom = PL.domainEntry(r, site);
  dom.requests++;
  // A classificação de rastreador é por host: good.third-party.site e
  // broken.third-party.site são o mesmo site, mas só o segundo é rastreador.
  const h = dom.hosts[host] || (dom.hosts[host] = { requests: 0, tracker: false, company: null, categories: [] });
  h.requests++;
  if (cls.isTracker) h.tracker = true;
  if (cls.company && !h.company) h.company = cls.company;
  for (const c of cls.categories) if (!h.categories.includes(c)) h.categories.push(c);
  dom.types[d.type] = (dom.types[d.type] || 0) + 1;
  if (cls.isTracker) dom.tracker = true;
  if (cls.company && !dom.company) dom.company = cls.company;
  for (const c of cls.categories) if (!dom.categories.includes(c)) dom.categories.push(c);
  for (const s of cls.sources) if (!dom.sources.includes(s)) dom.sources.push(s);
  for (const f of cls.firefoxFlags) if (!dom.firefoxFlags.includes(f)) dom.firefoxFlags.push(f);

  PL.inspectParams(r, d, host, site, party);
  PL.inspectThreatRequest(r, d, host, site, party);

  if (r.requests.log.length < PL.LIMITS.requestLog) {
    r.requests.log.push({
      t: Date.now(), requestId: d.requestId, method: d.method, type: d.type,
      url: PL.trunc(d.url), host, site, party, tracker: cls.isTracker,
      frameId: d.frameId, thirdPartyFx: d.thirdParty, blocked: Boolean(PL.blockReason(d)),
    });
  }
  PL.updateBadge(r);
  PL.persist();
};

browser.webRequest.onBeforeRequest.addListener(async (d) => {
  if (d.tabId < 0 || !PL.isWebUrl(d.url)) return;
  await PL.ready;

  if (d.type === 'main_frame') {
    // Mesmo requestId = redirecionamento de servidor da navegação principal.
    // O site intermediário vira um salto próprio: os cookies que ele definiu
    // não podem contar como 1ª parte do destino.
    const cur = PL.tabs.get(d.tabId);
    const redirect = cur && cur.navRequestId === d.requestId;
    PL.startPage(d.tabId, d.url, d.requestId, redirect ? 'server_redirect' : 'navigation');
  }
  const r = PL.ensureReport(d.tabId, PL.topUrlOf(d));
  if (r) PL.recordRequest(r, d);
}, { urls: ['<all_urls>'] });

// Navegações sem requisição de rede (ex.: voltar/avançar via bfcache) também
// iniciam um relatório novo.
browser.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0 || !PL.isWebUrl(d.url)) return;
  await PL.ready;
  const r = PL.tabs.get(d.tabId);
  if (!r || r.committed) {
    PL.startPage(d.tabId, d.url, null, 'navigation').committed = true;
  } else {
    r.committed = true;
    r.url = d.url;
    r.site = PL.siteOf(d.url);
  }
  PL.markArrival(d.tabId, d);
  PL.updateBadge(PL.tabs.get(d.tabId));
  PL.persist();
});
