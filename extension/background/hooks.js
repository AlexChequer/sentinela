'use strict';
// Indicadores de hijacking/hook. Na rede (webRequest):
//  - WebSocket para domínio de terceiro (canal de comando e controle);
//  - polling persistente: o mesmo endpoint de terceiro chamado repetidamente
//    em intervalos regulares (o hook do BeEF faz polling do servidor);
//  - assinaturas do BeEF: hook.js, porta 3000, cookie BEEFHOOK, global `beef`.
// Na página (content/hook-world.js): globais novas, nativas substituídas,
// scripts injetados dinamicamente e listeners de teclado.

PL.POLLING = { minCount: 5, minSpanMs: 10000, maxCv: 0.5 };
const POLL_TYPES = new Set(['xmlhttprequest', 'script', 'image', 'ping', 'beacon', 'other']);
const MAX_TIMES = 30;

PL.newThreats = () => ({ websockets: [], endpoints: {}, beef: [], frames: {}, injected: [], keyListeners: [] });

function addBeef(r, signal) {
  if (!r.threats.beef.includes(signal)) r.threats.beef.push(signal);
}

// Chamado por PL.recordRequest para cada requisição.
PL.inspectThreatRequest = (r, d, host, site, party) => {
  let u;
  try { u = new URL(d.url); } catch { return; }
  if (/\/hook\.js$/i.test(u.pathname)) addBeef(r, `script hook.js em ${host}`);
  if (u.port === '3000' && party === 'third') addBeef(r, `requisição à porta 3000 de ${host}`);
  if (party !== 'third') return;
  if (d.type === 'websocket') {
    if (r.threats.websockets.length < 50) r.threats.websockets.push({ t: Date.now(), host, site, url: PL.trunc(u.origin + u.pathname, 200) });
    return;
  }
  if (!POLL_TYPES.has(d.type)) return;
  const key = u.origin + u.pathname;
  const e = r.threats.endpoints[key] || (r.threats.endpoints[key] = { host, site, type: d.type, times: [] });
  e.times.push(Date.now());
  if (e.times.length > MAX_TIMES) e.times.shift();
};

// Polling: >= minCount chamadas, espalhadas por >= minSpanMs, com intervalos
// regulares (coeficiente de variação dos intervalos <= maxCv).
PL.findPolling = (r) => {
  const P = PL.POLLING;
  const out = [];
  for (const [endpoint, e] of Object.entries(r.threats.endpoints)) {
    const n = e.times.length;
    if (n < P.minCount) continue;
    const span = e.times[n - 1] - e.times[0];
    if (span < P.minSpanMs) continue;
    const gaps = e.times.slice(1).map((t, i) => t - e.times[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    const cv = mean ? sd / mean : 0;
    if (cv > P.maxCv) continue;
    out.push({ endpoint, host: e.host, site: e.site, count: n, intervalMs: Math.round(mean), cv: Math.round(cv * 100) / 100 });
  }
  return out;
};

PL.recordThreatEvent = (r, frame, ev) => {
  const T = r.threats;
  const origin = frame.origin;
  switch (ev.type) {
    case 'hook-check': {
      const f = T.frames[origin] || (T.frames[origin] = { origin, isTop: frame.isTop, addedGlobals: [], replaced: [] });
      for (const g of ev.addedGlobals || []) if (!f.addedGlobals.includes(g) && f.addedGlobals.length < 150) f.addedGlobals.push(g);
      for (const n of ev.replaced || []) if (!f.replaced.includes(n)) f.replaced.push(n);
      if (f.addedGlobals.includes('beef') || f.addedGlobals.includes('beef_init')) addBeef(r, `global beef em ${origin}`);
      break;
    }
    case 'script-inject': {
      if (T.injected.length >= 200) break;
      const site = PL.siteOf(ev.src);
      const injectorSite = ev.injector ? PL.siteOf(ev.injector) : null;
      T.injected.push({ t: ev.t, src: ev.src, site, party: site ? PL.partyOf(r, site) : null, injector: ev.injector, injectorParty: injectorSite ? PL.partyOf(r, injectorSite) : null, frame: origin });
      break;
    }
    case 'key-listener': {
      if (T.keyListeners.length >= 200) break;
      const site = ev.script ? PL.siteOf(ev.script) : null;
      T.keyListeners.push({ event: ev.event, target: ev.target, script: ev.script, party: site ? PL.partyOf(r, site) : null, frame: origin });
      break;
    }
  }
  PL.persist();
};

PL.summarizeThreats = (r) => {
  const T = r.threats;
  const frames = Object.values(T.frames);
  if (r.cookies.some((c) => /^BEEFHOOK$/i.test(c.name))) addBeef(r, 'cookie BEEFHOOK');
  return {
    websockets: T.websockets,
    polling: PL.findPolling(r),
    replacedNatives: [...new Set(frames.flatMap((f) => f.replaced))],
    addedGlobals: frames.reduce((a, f) => a + f.addedGlobals.length, 0),
    injectedThirdParty: T.injected.filter((i) => i.party === 'third').length,
    keyListenersThirdParty: T.keyListeners.filter((k) => k.party === 'third').length,
    beef: T.beef,
  };
};
