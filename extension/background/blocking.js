'use strict';
// Lista de bloqueio personalizada. A lista (domínios) e a opção "bloquear
// rastreadores conhecidos" ficam em storage.local e são editadas pelo popup.
// O bloqueio usa webRequest bloqueante ({ cancel: true }), que o Firefox ainda
// permite no Manifest V3.
//
// Um domínio da lista bloqueia ele e seus subdomínios. A navegação principal
// nunca é bloqueada (o usuário pediu para abrir aquela página); só recursos.
// Requisições de service worker chegam sem aba (tabId -1): também são
// bloqueadas, usando originUrl (o próprio worker) para decidir a parte, mas
// não entram no relatório de nenhuma aba.

PL.block = { domains: new Set(), trackers: false };

const blockLoaded = browser.storage.local.get(['blocklist', 'blockTrackers']).then((v) => {
  PL.block.domains = new Set(v.blocklist || []);
  PL.block.trackers = Boolean(v.blockTrackers);
}).catch((e) => console.warn('[sentinela] falha ao ler a lista de bloqueio', e));

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.blocklist) PL.block.domains = new Set(changes.blocklist.newValue || []);
  if (changes.blockTrackers) PL.block.trackers = Boolean(changes.blockTrackers.newValue);
});

function listMatch(host) {
  let h = host;
  while (h) {
    if (PL.block.domains.has(h)) return h;
    const i = h.indexOf('.');
    if (i < 0) return null;
    h = h.slice(i + 1);
  }
  return null;
}

// Motivo do bloqueio, ou null.
PL.blockReason = (d) => {
  if (d.type === 'main_frame') return null;
  const host = PL.hostOf(d.url);
  if (!host) return null;
  const match = listMatch(host);
  if (match) return { rule: 'lista', match };
  if (!PL.block.trackers) return null;
  const top = PL.topUrlOf(d);
  if (!top || PL.siteOfHost(host) === PL.siteOf(top)) return null;
  const cls = PL.classifyHost(host, d.urlClassification);
  return cls.isTracker ? { rule: 'rastreador', match: cls.matched || host } : null;
};

function recordBlock(d, reason) {
  const r = d.tabId >= 0 ? PL.tabs.get(d.tabId) : null;
  if (!r) return;
  const host = PL.hostOf(d.url);
  const b = r.blocked[host] || (r.blocked[host] = { host, site: PL.siteOfHost(host), count: 0, rule: reason.rule, match: reason.match, types: {} });
  b.count++;
  b.types[d.type] = (b.types[d.type] || 0) + 1;
  PL.persist();
}

function decide(d) {
  const reason = PL.blockReason(d);
  if (!reason) return {};
  recordBlock(d, reason);
  return { cancel: true };
}

browser.webRequest.onBeforeRequest.addListener(
  // Se a event page acabou de acordar, espera a lista carregar antes de decidir.
  (d) => (PL.block.loaded ? decide(d) : blockLoaded.then(() => { PL.block.loaded = true; return decide(d); })),
  { urls: ['<all_urls>'] },
  ['blocking'],
);
