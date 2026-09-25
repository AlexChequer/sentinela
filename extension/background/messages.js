'use strict';
// Roteamento de mensagens: eventos dos content scripts e consultas do popup.

PL.summarize = (r) => {
  const domains = Object.values(r.domains);
  const third = domains.filter((d) => d.party === 'third');

  // Cookies: um cookie é identificado por (domínio, caminho, nome). Contamos
  // cookies únicos definidos (ignorando remoções) e também o total de eventos.
  const unique = new Map();
  for (const c of r.cookies) {
    if (c.lifetime === 'deleted') continue;
    unique.set(`${c.domain}|${c.path}|${c.name}`, c);
  }
  const cookieMatrix = {
    first: { session: 0, persistent: 0 },
    third: { session: 0, persistent: 0 },
  };
  const bySource = { http: 0, js: 0 };
  for (const c of unique.values()) {
    cookieMatrix[c.party][c.lifetime]++;
    bySource[c.source]++;
  }

  const frames = Object.values(r.storage);
  const canvas = r.fingerprint.canvas;
  const fpScripts = new Set(canvas.filter((c) => c.verdict === 'fingerprint').map((c) => c.script));
  const sum = (area, f) => frames.reduce((a, s) => a + (s[area] ? s[area][f] : 0), 0);
  return {
    url: r.url,
    site: r.site,
    requests: { total: r.requests.total, thirdParty: r.requests.thirdParty },
    domains: { total: domains.length, thirdParty: third.length, trackers: third.filter((d) => d.tracker).length },
    cookies: { events: r.cookies.length, unique: unique.size, matrix: cookieMatrix, bySource },
    fingerprint: {
      canvasReads: canvas.length,
      canvasFingerprints: canvas.filter((c) => c.verdict === 'fingerprint').length,
      fingerprintScripts: fpScripts.size,
      thirdPartyFingerprints: canvas.filter((c) => c.verdict === 'fingerprint' && c.scriptParty === 'third').length,
    },
    storage: {
      frames: frames.length,
      localStorageKeys: sum('localStorage', 'count'),
      sessionStorageKeys: sum('sessionStorage', 'count'),
      indexedDBs: frames.reduce((a, s) => a + s.indexedDB.databases.length, 0),
      cacheStorages: frames.reduce((a, s) => a + s.cacheStorage.caches.length, 0),
      thirdPartyFrames: frames.filter((s) => s.party === 'third').length,
      blockedFrames: frames.filter((s) => Object.keys(s.errors).length).length,
    },
  };
};

async function handleContentEvents(msg, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined || tabId < 0) return;
  await PL.ready;
  const r = PL.ensureReport(tabId, sender.tab.url);
  if (!r) return;
  const frameUrl = msg.url || sender.url;
  const frame = { url: frameUrl, origin: msg.origin && msg.origin !== 'null' ? msg.origin : frameUrl, isTop: msg.isTop };
  const frameHost = PL.hostOf(frameUrl);
  for (const ev of msg.events || []) {
    if (ev.type === 'cookie-set') {
      const c = PL.parseCookieString(ev.cookie, frameHost, ev.t);
      PL.recordCookie(r, c, { source: 'js', api: ev.api || 'document.cookie', url: frameUrl, setBy: ev.script, accepted: ev.accepted });
    } else if (ev.type === 'canvas-read') {
      PL.recordCanvasRead(r, frame, ev);
    } else {
      PL.recordStorageEvent(r, frame, ev);
    }
  }
}

async function exportReport(tabId) {
  await PL.ready;
  const r = PL.tabs.get(tabId);
  if (!r) return { ok: false, error: 'Nenhum dado para esta aba.' };
  const payload = { tool: 'Sentinela', version: browser.runtime.getManifest().version, exportedAt: new Date().toISOString(), summary: PL.summarize(r), report: r };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    await browser.downloads.download({ url, filename: `sentinela/${r.site}-${stamp}.json`, saveAs: false });
    return { ok: true };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'content-events':
      return handleContentEvents(msg, sender);
    case 'get-report':
      return PL.ready.then(() => {
        const r = PL.tabs.get(msg.tabId);
        return r ? { report: r, summary: PL.summarize(r) } : null;
      });
    case 'export-report':
      return exportReport(msg.tabId);
  }
});
