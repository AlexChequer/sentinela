'use strict';
// Parâmetros de rastreamento em URLs. Duas coisas:
//  1. parâmetros conhecidos de atribuição de clique/campanha (gclid, fbclid,
//     utm_*...), em qualquer requisição, inclusive a navegação principal: é o
//     que a página query-parameters do DDG testa;
//  2. valores com cara de identificador enviados a terceiros, e o hash de todo
//     valor enviado a terceiros, para detectar cookie sync (messages/navigation).
// Só guardamos nome, tamanho e hash FNV-1a dos valores, nunca o valor.

PL.TRACKING_PARAMS = new Set([
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'fb_source', 'fb_action_ids',
  'msclkid', 'yclid', 'twclid', 'ttclid', 'igshid', 'li_fat_id', 'mc_cid', 'mc_eid',
  '_hsenc', '_hsmi', 'hsctatracking', 'oly_anon_id', 'oly_enc_id', 'vero_id', 'vero_conv',
  'mkt_tok', 'rb_clickid', 's_cid', 'wickedid', '_openstat', 'epik', 'srsltid',
]);
PL.TRACKING_PREFIXES = ['utm_', 'pk_', 'mtm_'];

// Parâmetros comuns que carregam conteúdo, não identidade.
const CONTENT_PARAMS = new Set(['q', 'query', 'search', 's', 'lang', 'hl', 'locale', 'page', 'v', 'ver', 'version', 'callback', 'format', 'url', 'ref', 'referrer', 'redirect', 'u']);
const MIN_ID_LENGTH = 8;
const MIN_SYNC_LENGTH = 6; // abaixo disso a chance de coincidência entre valores é alta

PL.isTrackingParam = (name) => {
  const n = name.toLowerCase();
  return PL.TRACKING_PARAMS.has(n) || PL.TRACKING_PREFIXES.some((p) => n.startsWith(p));
};

// Identificador provável: longo, sem espaços, misturando letras e dígitos (ou
// um número longo, como o client id do Google Analytics), e que não seja URL.
PL.looksLikeId = (v) => v.length >= MIN_ID_LENGTH && v.length <= 512
  && !/[\s/]|:\/\//.test(v)
  && ((/[a-z]/i.test(v) && /\d/.test(v)) || /^\d{10,}(\.\d+)?$/.test(v));

function paramsOf(url) {
  try { return [...new URL(url).searchParams]; } catch { return []; }
}
PL.paramsOf = paramsOf;

PL.inspectParams = (r, d, host, site, party) => {
  const seen = new Set(r.tracking.params.map((p) => `${p.host}|${p.name}|${p.valueHash}`));
  for (const [name, value] of paramsOf(d.url)) {
    const valueHash = PL.hash(value);
    if (party === 'third' && value.length >= MIN_SYNC_LENGTH) {
      const e = r.tracking.paramHashes[valueHash] || (r.tracking.paramHashes[valueHash] = { sites: [], names: [] });
      if (!e.sites.includes(site) && e.sites.length < 20) e.sites.push(site);
      if (!e.names.includes(name) && e.names.length < 20) e.names.push(name);
    }
    const known = PL.isTrackingParam(name);
    const idLike = party === 'third' && !CONTENT_PARAMS.has(name.toLowerCase()) && PL.looksLikeId(value);
    if (!known && !idLike) continue;
    const key = `${host}|${name}|${valueHash}`;
    if (seen.has(key) || r.tracking.params.length >= PL.LIMITS.params) continue;
    seen.add(key);
    r.tracking.params.push({
      t: Date.now(), name, kind: known ? 'known' : 'id', host, site, party,
      type: d.type, valueLength: value.length, valueHash,
    });
  }
};

// Cookie sync / compartilhamento de identificador, olhando os hashes:
//  - "cookie → terceiro": o valor de um cookie ou item de storage de um site
//    aparece em parâmetro de requisição para OUTRO site;
//  - "mesmo ID a vários terceiros": um mesmo valor de parâmetro (com cara de
//    identificador) enviado a 2 ou mais terceiros diferentes.
PL.findSyncs = (r) => {
  const origins = new Map(); // hash -> sites que guardam esse valor
  const add = (h, site) => {
    if (!h || !site) return;
    const set = origins.get(h) || origins.set(h, new Set()).get(h);
    set.add(site);
  };
  for (const c of r.cookies) if (c.lifetime !== 'deleted' && c.valueLength >= MIN_SYNC_LENGTH) add(c.valueHash, c.site);
  for (const s of Object.values(r.storage)) for (const h of s.valueHashes || []) add(h, s.site);

  const syncs = [];
  for (const [hash, sent] of Object.entries(r.tracking.paramHashes)) {
    const holders = [...(origins.get(hash) || [])];
    for (const from of holders) {
      const to = sent.sites.filter((x) => x !== from);
      if (to.length) syncs.push({ kind: 'cookie-to-third', from, to, params: sent.names, valueHash: hash });
    }
    const idParam = r.tracking.params.some((p) => p.valueHash === hash && p.party === 'third');
    if (!holders.length && idParam && sent.sites.length >= 2) {
      syncs.push({ kind: 'shared-id', from: null, to: sent.sites, params: sent.names, valueHash: hash });
    }
  }
  return syncs;
};
