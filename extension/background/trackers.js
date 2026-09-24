'use strict';
// Classificação de domínios como rastreadores. Três fontes, registradas
// separadamente para que o relatório possa explicar de onde veio cada decisão:
//  1. Lista Disconnect empacotada (data/trackers.js), a mesma base do ETP do Firefox;
//  2. urlClassification que o próprio Firefox anexa a cada requisição;
//  3. Domínios de teste do DuckDuckGo, que não estão em nenhuma lista pública.

// Categorias da Disconnect que NÃO consideramos rastreamento (o Firefox também
// não bloqueia essas por padrão).
PL.NON_TRACKING = new Set(['Content', 'Anti-fraud', 'ConsentManagers']);

// Domínios de teste das DuckDuckGo Privacy Test Pages. O README do projeto
// define bad.third-party.site e broken.third-party.site como rastreadores da
// blocklist deles; good.third-party.site é terceiro NÃO rastreador.
PL.TEST_TRACKERS = {
  'bad.third-party.site': { company: 'DDG test tracker', categories: ['DDG-test'] },
  'broken.third-party.site': { company: 'DDG test tracker (não bloqueável)', categories: ['DDG-test'] },
};

// Flags de urlClassification do Firefox que indicam rastreamento.
PL.FX_TRACKING_FLAGS = new Set([
  'tracking', 'tracking_ad', 'tracking_analytics', 'tracking_social',
  'fingerprinting', 'cryptomining', 'emailtracking',
  'any_basic_tracking', 'any_social_tracking',
]);

const classifyCache = new Map();

function lookupSuffix(host, table) {
  let h = host;
  while (h) {
    if (table[h]) return { match: h, entry: table[h] };
    const i = h.indexOf('.');
    if (i < 0) return null;
    h = h.slice(i + 1);
  }
  return null;
}

PL.classifyHost = (host, urlClassification) => {
  let base = classifyCache.get(host);
  if (!base) {
    base = { categories: [], company: null, sources: [], matched: null };
    const test = lookupSuffix(host, PL.TEST_TRACKERS);
    if (test) {
      base.company = test.entry.company;
      base.categories.push(...test.entry.categories);
      base.sources.push('ddg-test');
      base.matched = test.match;
    }
    const dc = lookupSuffix(host, self.TRACKER_DB.domains);
    if (dc) {
      base.company = base.company || dc.entry[0];
      base.categories.push(...dc.entry[1]);
      base.sources.push('disconnect');
      base.matched = base.matched || dc.match;
    }
    base.listTracker = base.categories.some((c) => !PL.NON_TRACKING.has(c));
    classifyCache.set(host, base);
  }
  const fx = [
    ...((urlClassification && urlClassification.firstParty) || []),
    ...((urlClassification && urlClassification.thirdParty) || []),
  ];
  const fxTracker = fx.some((f) => PL.FX_TRACKING_FLAGS.has(f));
  return {
    ...base,
    firefoxFlags: fx,
    sources: fx.length ? [...base.sources, 'firefox'] : base.sources,
    isTracker: base.listTracker || fxTracker,
  };
};
