'use strict';
// Helpers de DOM compartilhados pelos scripts do popup e da página de relatório.
// Todo conteúdo vindo das páginas entra como texto (createTextNode), nunca como
// HTML: nomes de cookies, chaves de storage e URLs são controlados por terceiros.

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v; else n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
const tag = (text, cls = '') => el('span', { class: `tag ${cls}` }, text);
const partyTag = (p) => tag(p === 'first' ? '1ª parte' : '3ª parte', p);
