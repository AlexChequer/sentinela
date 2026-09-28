'use strict';
// Score de privacidade 0-100 (maior = mais privado). Metodologia completa,
// com a justificativa dos pesos, em docs/metodologia-score.md.
//
// Os critérios 1 a 9 são as nove verificações do Blacklight (The Markup), na
// mesma ordem, para a comparação ser direta; 10 a 12 são o que o Blacklight
// não mede. Cada critério desconta pontos de 100, com teto por critério para
// que uma única categoria não zere a nota.

// Gravação de sessão: fornecedores estudados por Englehardt et al. ("No
// boundaries", Princeton 2017), a mesma base do teste do Blacklight, mais o
// Microsoft Clarity e outros atuais.
const SESSION_RECORDERS = [
  'hotjar.com', 'hotjar.io', 'fullstory.com', 'clarity.ms', 'mouseflow.com', 'smartlook.com',
  'smartlook.cloud', 'luckyorange.com', 'luckyorange.net', 'logrocket.com', 'lr-ingest.io',
  'inspectlet.com', 'crazyegg.com', 'clicktale.net', 'sessioncam.com', 'userreplay.net',
  'quantummetric.com', 'contentsquare.net', 'glassboxdigital.io', 'mc.yandex.ru', 'webvisor.com',
];
// Pixels de redes sociais e remarketing (URLs que o Blacklight também procura).
const PIXELS = {
  facebook: [/(^|\.)connect\.facebook\.net\//, /(^|\.)facebook\.com\/tr/],
  tiktok: [/(^|\.)analytics\.tiktok\.com/],
  twitter: [/(^|\.)ads-twitter\.com/, /(^|\.)analytics\.twitter\.com/, /^t\.co\/(1\/)?i\/adsct/, /(^|\.)ads\.x\.com/],
  gaRemarketing: [/^stats\.g\.doubleclick\.net/, /google\.[a-z.]+\/ads\/ga-audiences/, /ga-audiences/],
};
const KEY_TARGETS = new Set(['INPUT', 'TEXTAREA', 'FORM', 'document', 'window']);

const hostPath = (url) => { try { const u = new URL(url); return u.hostname + u.pathname; } catch { return ''; } };
const endsWithAny = (host, list) => list.find((d) => host === d || host.endsWith('.' + d));

PL.GRADES = [[85, 'A'], [70, 'B'], [50, 'C'], [30, 'D'], [0, 'F']];

function criteria(r, s) {
  const third = Object.values(r.domains).filter((d) => d.party === 'third');
  const urls = r.requests.log.map((l) => hostPath(l.url));
  const pixel = (key) => urls.find((u) => PIXELS[key].some((re) => re.test(u)));
  const ad = third.filter((d) => d.categories.includes('Advertising') || d.firefoxFlags.includes('tracking_ad'));
  const thirdCookies = s.cookies.matrix.third.session + s.cookies.matrix.third.persistent;
  const recorders = [...new Set(r.requests.log.map((l) => endsWithAny(l.host, SESSION_RECORDERS)).filter(Boolean))];
  const keys = r.threats.keyListeners.filter((k) => k.party === 'third' && KEY_TARGETS.has(k.target));
  const storageFrames = Object.values(r.storage).filter((f) => f.party === 'third'
    && ((f.localStorage && f.localStorage.count) || (f.sessionStorage && f.sessionStorage.count) || f.indexedDB.databases.length || f.cacheStorage.caches.length));
  const nav = s.navigation.bounces.length + s.tracking.syncs.length;
  const t = s.threats;
  const fb = pixel('facebook'); const tt = pixel('tiktok'); const tw = pixel('twitter'); const ga = pixel('gaRemarketing');
  return [
    { id: 'ads', label: 'Rastreadores de anúncio', blacklight: 'Ad trackers', count: ad.length, per: 4, max: 20, detail: ad.map((d) => d.site).join(', ') },
    { id: 'cookies3p', label: 'Cookies de terceiros', blacklight: 'Third-party cookies', count: thirdCookies, per: 2, max: 15, detail: `${thirdCookies} cookie(s)` },
    { id: 'fingerprint', label: 'Canvas fingerprint', blacklight: 'Tracking that evades cookie blockers', count: s.fingerprint.canvasFingerprints ? 1 : 0, per: 15, max: 15, detail: `${s.fingerprint.canvasFingerprints} leitura(s) classificada(s)` },
    { id: 'session', label: 'Gravação de sessão', blacklight: 'Session-monitoring scripts', count: recorders.length ? 1 : 0, per: 10, max: 10, detail: recorders.join(', ') },
    { id: 'keys', label: 'Captura de teclado por terceiro', blacklight: 'Keystroke capturing', count: keys.length ? 1 : 0, per: 10, max: 10, detail: [...new Set(keys.map((k) => PL.siteOf(k.script)))].join(', ') },
    { id: 'facebook', label: 'Pixel do Facebook', blacklight: 'Facebook', count: fb ? 1 : 0, per: 5, max: 5, detail: fb || '' },
    { id: 'tiktok', label: 'Pixel do TikTok', blacklight: 'TikTok', count: tt ? 1 : 0, per: 5, max: 5, detail: tt || '' },
    { id: 'twitter', label: 'Pixel do Twitter/X', blacklight: 'Twitter/X', count: tw ? 1 : 0, per: 5, max: 5, detail: tw || '' },
    { id: 'ga', label: 'Google Analytics com remarketing', blacklight: 'Google Analytics', count: ga ? 1 : 0, per: 5, max: 5, detail: ga || '' },
    { id: 'storage3p', label: 'Storage em frames de terceiros', blacklight: null, count: storageFrames.length, per: 1, max: 5, detail: storageFrames.map((f) => f.origin).join(', ') },
    { id: 'navtracking', label: 'Bounce tracking / cookie sync', blacklight: null, count: nav, per: 10, max: 15, detail: `${s.navigation.bounces.length} bounce(s), ${s.tracking.syncs.length} sync(s)` },
    { id: 'beef', label: 'Assinatura de BeEF', blacklight: null, count: t.beef.length ? 1 : 0, per: 40, max: 40, detail: t.beef.join('; ') },
    { id: 'natives', label: 'Funções nativas substituídas', blacklight: null, count: t.replacedNatives.length ? 1 : 0, per: 10, max: 10, detail: t.replacedNatives.join(', ') },
    { id: 'channels', label: 'WebSocket / polling para terceiro', blacklight: null, count: t.websockets.length + t.polling.length, per: 5, max: 10, detail: [...t.websockets.map((w) => w.host), ...t.polling.map((p) => p.host)].join(', ') },
  ];
}

PL.computeScore = (r, s) => {
  const items = criteria(r, s).map((c) => ({ ...c, found: c.count > 0, penalty: Math.min(c.count * c.per, c.max) }));
  const score = Math.max(0, 100 - items.reduce((a, c) => a + c.penalty, 0));
  const grade = PL.GRADES.find(([min]) => score >= min)[1];
  return { score, grade, items };
};
