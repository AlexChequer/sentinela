'use strict';
// Painéis de ameaças (hijacking/hook) e da lista de bloqueio personalizada.

// Espelho local de storage.local, atualizado quando a lista muda.
const blockState = { domains: [], trackers: false };
browser.storage.local.get(['blocklist', 'blockTrackers']).then((v) => {
  blockState.domains = v.blocklist || [];
  blockState.trackers = Boolean(v.blockTrackers);
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.blocklist) blockState.domains = changes.blocklist.newValue || [];
  if (changes.blockTrackers) blockState.trackers = Boolean(changes.blockTrackers.newValue);
});

// Aceita "exemplo.com", "https://sub.exemplo.com/x" etc. e devolve o host.
function normalizeDomain(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  try {
    const host = new URL(s.includes('://') ? s : `https://${s}`).hostname;
    return /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(host) ? host.replace(/^\.+/, '') : null;
  } catch { return null; }
}

async function setBlocked(domain, on) {
  const set = new Set(blockState.domains);
  if (on) set.add(domain); else set.delete(domain);
  await browser.storage.local.set({ blocklist: [...set].sort() });
}

function finding(title, detail, cls = '') {
  return el('p', { class: `finding ${cls}` }, el('b', {}, title), detail ? el('span', { class: 'sub' }, detail) : null);
}

function renderThreats(r, s) {
  const t = s.threats;
  const out = [];
  if (t.beef.length) out.push(finding('Assinatura de BeEF', t.beef.join('; ')));

  out.push(el('h3', {}, `WebSocket para terceiros (${t.websockets.length})`));
  if (!t.websockets.length) out.push(el('p', { class: 'empty' }, 'Nenhum.'));
  for (const w of t.websockets) out.push(finding(w.host, w.url));

  out.push(el('h3', {}, `Polling persistente (${t.polling.length})`));
  if (!t.polling.length) out.push(el('p', { class: 'empty' }, 'Nenhum endpoint de terceiro chamado em intervalos regulares.'));
  for (const p of t.polling) out.push(finding(p.host, `${p.count} chamadas a ${p.endpoint}, a cada ~${Math.round(p.intervalMs / 100) / 10} s`));

  out.push(el('h3', {}, `Funções nativas substituídas (${t.replacedNatives.length})`));
  out.push(t.replacedNatives.length ? finding(t.replacedNatives.join(', '), 'Comparadas por identidade com a referência capturada antes dos scripts da página.')
    : el('p', { class: 'empty' }, 'Nenhuma.'));

  const inj = r.threats.injected.filter((i) => i.party === 'third');
  out.push(el('h3', {}, `Scripts de terceiros injetados por script (${inj.length})`));
  if (!inj.length) out.push(el('p', { class: 'empty' }, 'Nenhum.'));
  for (const i of inj.slice(0, 40)) out.push(el('p', { class: 'finding soft' }, i.src, el('span', { class: 'sub' }, `injetado por ${i.injector || '(desconhecido)'}`)));

  const keys = r.threats.keyListeners.filter((k) => k.party === 'third');
  out.push(el('h3', {}, `Captura de teclado por terceiros (${keys.length})`));
  if (!keys.length) out.push(el('p', { class: 'empty' }, 'Nenhum listener de teclado/input registrado por script de terceiro.'));
  for (const k of keys.slice(0, 40)) out.push(el('p', { class: 'finding soft' }, `${k.event} em ${k.target}`, el('span', { class: 'sub' }, k.script)));

  out.push(el('h3', {}, `Globais adicionadas em window (${t.addedGlobals})`));
  for (const f of Object.values(r.threats.frames)) {
    if (!f.addedGlobals.length) continue;
    out.push(el('p', { class: 'note' }, el('b', {}, f.origin), ` ${f.addedGlobals.length}: ${f.addedGlobals.slice(0, 40).join(', ')}${f.addedGlobals.length > 40 ? '…' : ''}`));
  }
  return out;
}

function renderBlocking(r, s) {
  const out = [el('h3', {}, `Bloqueados nesta página (${s.blocked.requests} requisições)`)];
  const rows = Object.values(r.blocked).sort((a, b) => b.count - a.count);
  out.push(rows.length ? el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Host'), el('th', {}, 'Regra'), el('th', { class: 'num' }, 'Req.'))),
    el('tbody', {}, rows.map((b) => el('tr', {},
      el('td', { class: 'host' }, b.host), el('td', {}, tag(b.rule === 'lista' ? `lista: ${b.match}` : 'rastreador', 'trk')), el('td', { class: 'num' }, b.count)))))
    : el('p', { class: 'empty' }, 'Nada bloqueado nesta página.'));
  out.push(el('h3', {}, `Minha lista (${blockState.domains.length})`));
  if (!blockState.domains.length) out.push(el('p', { class: 'empty' }, 'Lista vazia. Adicione acima ou use "bloquear" na aba Terceiros.'));
  for (const d of blockState.domains) {
    out.push(el('p', { class: 'finding soft row' }, d, el('button', { type: 'button', class: 'mini', 'data-unblock': d }, 'remover')));
  }
  return out;
}

// Controles fixos da aba Bloqueio (não são redesenhados a cada segundo, para
// não apagar o que o usuário está digitando).
function setupBlockingControls() {
  const form = document.getElementById('block-form');
  const input = document.getElementById('block-input');
  const msg = document.getElementById('block-msg');
  const toggle = document.getElementById('block-trackers');
  browser.storage.local.get('blockTrackers').then((v) => { toggle.checked = Boolean(v.blockTrackers); });
  toggle.addEventListener('change', () => browser.storage.local.set({ blockTrackers: toggle.checked }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = normalizeDomain(input.value);
    if (!d) { msg.textContent = 'Domínio inválido.'; return; }
    await setBlocked(d, true);
    input.value = '';
    msg.textContent = `${d} adicionado. Recarregue a página para aplicar.`;
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-block],[data-unblock]');
    if (!b) return;
    if (b.dataset.block) setBlocked(b.dataset.block, true);
    else setBlocked(b.dataset.unblock, false);
  });
}
