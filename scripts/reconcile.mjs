// Reconciliação de um site real: HAR × Sentinela × uBlock Origin × Blacklight.
//
// Uso: node scripts/reconcile.mjs evidencias/sites/uol
//
// A pasta precisa ter:
//   <site>.har               exportado do DevTools (Save All As HAR)
//   <site>-sentinela.json    exportado pelo botão "Exportar JSON" da Sentinela
// e pode ter (transcritos dos prints, um item por linha, "#" = comentário):
//   <site>-ublock.txt        domínios que o uBlock mostrou como bloqueados
//   <site>-blacklight.txt    "categoria: <nome no Blacklight> = <número>" e,
//                            em linhas soltas, os domínios que o Blacklight citou
//
// Gera <site>-reconciliacao.md com: resumo, tabela domínio a domínio (eTLD+1)
// com uma explicação técnica sugerida para cada divergência, e a comparação do
// score da Sentinela com o mesmo score aplicado às categorias do Blacklight.
// As sugestões são ponto de partida: a explicação final cita o tráfego do HAR.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('uso: node scripts/reconcile.mjs evidencias/sites/<site>'); process.exit(1); }
const site = basename(dir);
const root = fileURLToPath(new URL('..', import.meta.url));

// Reaproveita a PSL (tldts) e a lista Disconnect empacotadas na extensão.
const ctx = { self: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['extension/lib/tldts.umd.min.js', 'extension/data/trackers.js']) {
  vm.runInContext(await readFile(join(root, f), 'utf8'), ctx);
}
const tldts = ctx.tldts || ctx.self.tldts;
const DB = (ctx.self.TRACKER_DB || ctx.TRACKER_DB).domains;
const NON_TRACKING = new Set(['Content', 'Anti-fraud', 'ConsentManagers']);
const siteOf = (host) => tldts.getDomain(host, { allowPrivateDomains: true }) || host;
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return null; } };
function disconnect(host) {
  for (let h = host; h; h = h.includes('.') ? h.slice(h.indexOf('.') + 1) : '') {
    if (DB[h]) return { company: DB[h][0], categories: DB[h][1] };
  }
  return null;
}

async function readText(name) {
  try { return await readFile(join(dir, name), 'utf8'); } catch { return null; }
}
const lines = (t) => (t || '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// --- Entradas ---------------------------------------------------------------
const files = await readdir(dir);
const harName = files.find((f) => f.endsWith('.har'));
const jsonName = files.find((f) => f.endsWith('-sentinela.json'));
if (!harName || !jsonName) { console.error(`faltam arquivos em ${dir}: .har e/ou -sentinela.json`); process.exit(1); }
const har = JSON.parse(await readFile(join(dir, harName), 'utf8'));
const exp = JSON.parse(await readFile(join(dir, jsonName), 'utf8'));
const r = exp.report;
const s = exp.summary;
const pageSite = r.site;

const ublock = new Set(lines(await readText(`${site}-ublock.txt`)).map((l) => siteOf(l.split(/\s/)[0].toLowerCase())));
const blText = lines(await readText(`${site}-blacklight.txt`));
const blCategories = {};
const blDomains = new Set();
for (const l of blText) {
  const m = l.match(/^categoria:\s*(.+?)\s*=\s*(\d+)/i);
  if (m) blCategories[m[1].toLowerCase()] = Number(m[2]);
  else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(l)) blDomains.add(siteOf(l.toLowerCase()));
}
const haveUblock = ublock.size > 0;
const haveBlacklight = blText.length > 0;

// --- Agregação por site (eTLD+1) ------------------------------------------------
const rows = new Map();
const row = (st) => rows.get(st) || rows.set(st, { site: st, har: 0, harTypes: new Set(), sent: 0, sentTypes: new Set(), tracker: false, dc: null }).get(st);
for (const e of har.log.entries) {
  const host = hostOf(e.request.url);
  if (!host) continue;
  const x = row(siteOf(host));
  x.har++;
  const mime = (e.response && e.response.content && e.response.content.mimeType || '').split(';')[0];
  if (mime) x.harTypes.add(mime);
  if (e.request.url.startsWith('ws')) x.harTypes.add('websocket');
}
for (const l of r.requests.log) {
  const x = row(l.site);
  x.sent++;
  x.sentTypes.add(l.type);
}
for (const d of Object.values(r.domains)) {
  const x = row(d.site);
  x.tracker = d.tracker;
}
// Domínios que só o uBlock ou o Blacklight citam também viram linha: são
// justamente os que precisam de explicação.
for (const st of [...ublock, ...blDomains]) if (st !== pageSite) row(st);
for (const x of rows.values()) x.dc = disconnect(x.site);

// --- Explicação sugerida para cada divergência --------------------------------
function explain(x) {
  const out = [];
  if (x.har && !x.sent) out.push('No HAR e não na Sentinela: requisição sem aba (service worker, tabId = -1), feita antes da extensão ativar ou depois da exportação do JSON; conferir o horário e o iniciador da requisição no HAR.');
  if (x.sent && !x.har) out.push('Na Sentinela e não no HAR: o HAR só registra com o DevTools aberto e "Persist Logs"; requisições de frames/abas auxiliares ou WebSocket podem ficar fora da captura.');
  const dcTracker = x.dc && x.dc.categories.some((c) => !NON_TRACKING.has(c));
  if (haveUblock && ublock.has(x.site) && !x.tracker) out.push('uBlock bloqueia e a Sentinela não marca rastreador: o domínio está nas listas do uBlock (EasyList/EasyPrivacy/uBO) mas não na Disconnect nem na classificação do Firefox.');
  if (haveUblock && x.tracker && !ublock.has(x.site)) out.push('Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia).');
  if (!x.har && !x.sent) out.push('Nem o HAR nem a Sentinela registraram requisição a este domínio nesta visita: a ferramenta de referência o viu em outra execução (outra hora, região, navegador ou estado de consentimento).');
  if (haveBlacklight && blDomains.has(x.site) && !x.sent) out.push('Blacklight cita e a Sentinela não viu: o Blacklight roda Chromium automatizado a partir dos servidores da The Markup, sem proteções; leilões de anúncio e parceiros carregados variam por visita e região.');
  if (x.sent && !x.tracker && dcTracker) out.push('Está na Disconnect numa categoria de rastreamento, mas a Sentinela não o marcou: conferir se o host exato bate com a lista (a classificação é por host).');
  return out.join(' ');
}

const third = [...rows.values()].filter((x) => x.site !== pageSite).sort((a, b) => (b.tracker - a.tracker) || (b.har + b.sent) - (a.har + a.sent));
const yes = (b) => (b ? 'sim' : '—');

// --- Score: Sentinela × mesma tabela aplicada às categorias do Blacklight -------
let blScore = 100;
const scoreRows = s.score.items.filter((i) => i.blacklight).map((i) => {
  const blCount = blCategories[i.blacklight.toLowerCase()];
  const blPenalty = blCount ? Math.min(blCount * i.per, i.max) : 0;
  blScore -= blPenalty;
  return `| ${i.blacklight} | ${i.found ? `sim (${i.count})` : 'não'} | −${i.penalty} | ${haveBlacklight ? (blCount ? `sim (${blCount})` : 'não') : '?'} | ${haveBlacklight ? `−${blPenalty}` : '?'} |`;
});
const extra = s.score.items.filter((i) => !i.blacklight && i.penalty).map((i) => `${i.label} (−${i.penalty})`);

// --- Saída ------------------------------------------------------------------
const harThird = third.reduce((a, x) => a + x.har, 0);
const md = `# Reconciliação: ${pageSite}

Gerado por \`scripts/reconcile.mjs\` a partir de \`${harName}\`, \`${jsonName}\`${haveUblock ? `, \`${site}-ublock.txt\`` : ''}${haveBlacklight ? `, \`${site}-blacklight.txt\`` : ''}.

| Fonte | Requisições | De terceiros | Sites de terceiros |
|---|---|---|---|
| HAR (DevTools) | ${har.log.entries.length} | ${harThird} | ${third.filter((x) => x.har).length} |
| Sentinela | ${s.requests.total} | ${s.requests.thirdParty} | ${third.filter((x) => x.sent).length} |
${haveUblock ? `| uBlock Origin (bloqueados) | — | — | ${ublock.size} |\n` : ''}${haveBlacklight ? `| Blacklight (domínios citados) | — | — | ${blDomains.size} |\n` : ''}
Score da Sentinela: **${s.score.score}/100 (${s.score.grade})**.

## Domínios de terceiros

| Site | HAR | Sentinela | Rastreador (Sentinela) | Disconnect | uBlock bloqueou | Blacklight | Explicação sugerida |
|---|---|---|---|---|---|---|---|
${third.map((x) => `| ${x.site} | ${x.har || '—'} | ${x.sent || '—'} | ${yes(x.tracker)} | ${x.dc ? `${x.dc.company} (${x.dc.categories.join(', ')})` : '—'} | ${haveUblock ? yes(ublock.has(x.site)) : '?'} | ${haveBlacklight ? yes(blDomains.has(x.site)) : '?'} | ${explain(x)} |`).join('\n')}

## Score: Sentinela × Blacklight

A mesma tabela de pesos (docs/metodologia-score.md) aplicada às categorias que o
Blacklight marcou, para comparar notas.

| Categoria do Blacklight | Sentinela encontrou | Desconto Sentinela | Blacklight encontrou | Desconto aplicado ao Blacklight |
|---|---|---|---|---|
${scoreRows.join('\n')}

Critérios que só a Sentinela mede: ${extra.length ? extra.join('; ') : 'nenhum descontou pontos'}.
${haveBlacklight ? `\nScore equivalente do Blacklight (só os 9 critérios dele): **${Math.max(0, blScore)}/100**. Score da Sentinela só nos mesmos 9 critérios: **${Math.max(0, 100 - s.score.items.filter((i) => i.blacklight).reduce((a, i) => a + i.penalty, 0))}/100**.` : ''}
`;
const out = join(dir, `${site}-reconciliacao.md`);
await writeFile(out, md);
console.log(`ok: ${out} (${third.length} sites de terceiros)`);
