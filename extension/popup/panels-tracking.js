'use strict';
// Painéis de fingerprint e de rastreamento de navegação (bounce, parâmetros, sync).

function renderFingerprint(r, s) {
  const list = r.fingerprint.canvas;
  if (!list.length) return el('p', { class: 'empty' }, 'Nenhuma leitura de canvas nesta página.');
  const f = s.fingerprint;
  const note = el('p', { class: 'note' },
    `${f.canvasFingerprints} provável(is) fingerprint(s) por ${f.fingerprintScripts} script(s), `,
    `${f.canvasReads} leitura(s) de canvas no total. Critério: Englehardt & Narayanan (2016).`);
  const rows = list.map((c) => el('tr', {},
    el('td', { class: 'host' }, c.script || '(script desconhecido)',
      el('span', { class: 'sub' }, c.scriptParty ? partyTag(c.scriptParty) : null, c.textSample ? ` texto: "${c.textSample}"` : '')),
    el('td', {}, `${c.api}`, el('span', { class: 'sub' }, `${c.width}x${c.height}`)),
    el('td', {},
      c.verdict === 'fingerprint' ? tag('fingerprint', 'trk') : tag('extração'),
      el('span', { class: 'sub' }, c.reasons.join('; ')))));
  return [note, el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Script'), el('th', {}, 'API'), el('th', {}, 'Classificação'))),
    el('tbody', {}, rows))];
}

const VIA = { server_redirect: 'redirect HTTP', client_redirect: 'redirect por script', link: 'link', typed: 'digitado', reload: 'recarga', navigation: 'navegação' };
const secs = (ms) => (ms === null ? 'atual' : `${Math.round(ms / 100) / 10} s`);

function renderNavigation(r, s) {
  const { chain, bounces } = s.navigation;
  const out = [el('h3', {}, 'Cadeia de navegação')];
  out.push(chain.length < 2 ? el('p', { class: 'empty' }, 'Página aberta diretamente, sem saltos antes.')
    : el('ol', { class: 'chain' }, chain.map((h) => el('li', { class: h.bounce ? 'bounce' : '' },
      h.site, h.bounce ? tag('bounce', 'trk') : null, h.tracker ? tag('rastreador', 'trk') : null,
      el('span', { class: 'sub' }, `${h.page} · chegou por ${VIA[h.arrivedBy] || h.arrivedBy} · ficou ${secs(h.dwellMs)}`)))));

  out.push(el('h3', {}, `Bounce tracking (${bounces.length})`));
  if (!bounces.length) out.push(el('p', { class: 'empty' }, 'Nenhum site intermediário com estado detectado.'));
  for (const b of bounces) {
    out.push(el('p', { class: 'finding' },
      el('b', {}, b.host), ` ficou ${secs(b.dwellMs)} entre ${b.from || '(início)'} e ${b.to} (${b.via === 'server_redirect' || b.via === 'client_redirect' ? `saída por ${VIA[b.via]}` : 'saiu em menos de 5 s'}).`,
      b.cookieNames.length ? el('span', { class: 'sub' }, `Estado: ${b.cookieNames.join(', ')}`) : null,
      b.uidParams.length ? el('span', { class: 'sub warn' }, `Identificador repassado ao destino via ${b.uidParams.join(', ')}`) : null));
  }

  const params = r.tracking.params;
  out.push(el('h3', {}, `Parâmetros de rastreamento (${params.length})`));
  out.push(params.length ? el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Parâmetro'), el('th', {}, 'Destino'), el('th', {}, 'Tipo'))),
    el('tbody', {}, params.map((p) => el('tr', {},
      el('td', { class: 'host' }, p.name, el('span', { class: 'sub' }, `${p.valueLength} caracteres`)),
      el('td', { class: 'host' }, p.host, el('span', { class: 'sub' }, partyTag(p.party), ` ${p.type}`)),
      el('td', {}, p.kind === 'known' ? tag('conhecido', 'trk') : tag('identificador', 'warn'))))))
    : el('p', { class: 'empty' }, 'Nenhum parâmetro de rastreamento.'));

  const syncs = s.tracking.syncs;
  out.push(el('h3', {}, `Cookie sync (${syncs.length})`));
  if (!syncs.length) out.push(el('p', { class: 'empty' }, 'Nenhum valor de cookie/storage enviado a outro site.'));
  for (const x of syncs) {
    out.push(el('p', { class: 'finding' }, x.kind === 'cookie-to-third'
      ? `Valor guardado por ${x.from} enviado a ${x.to.join(', ')}`
      : `Mesmo identificador enviado a ${x.to.join(', ')}`,
    el('span', { class: 'sub' }, `parâmetro(s): ${x.params.join(', ')}`)));
  }
  return out;
}
