'use strict';
// Cookies injetados no carregamento da página, por duas vias:
//  - HTTP: cabeçalhos Set-Cookie das respostas (webRequest.onHeadersReceived);
//  - JS: atribuições a document.cookie, capturadas pelo content script.
// Cada evento é classificado em primeira/terceira parte (site do cookie vs.
// site da aba) e sessão/persistente (presença de Expires/Max-Age).

PL.recordCookie = (r, c, meta) => {
  c.site = PL.siteOfHost(c.domain);
  c.party = PL.partyOf(r, c.site);
  c.source = meta.source;          // 'http' | 'js'
  c.api = meta.api || null;        // JS: 'document.cookie' | 'cookieStore'
  c.url = PL.trunc(meta.url);      // resposta ou frame que definiu
  c.requestType = meta.type || null;
  c.setBy = meta.setBy || null;    // script responsável (apenas JS)
  c.accepted = meta.accepted ?? null; // JS: o cookie apareceu em document.cookie depois?
  c.t = Date.now();
  if (r.cookies.length < PL.LIMITS.cookies) r.cookies.push(c);
  if (c.lifetime !== 'deleted') PL.domainEntry(r, c.site).cookiesSet++;
  PL.persist();
};

browser.webRequest.onHeadersReceived.addListener(async (d) => {
  if (d.tabId < 0 || !d.responseHeaders) return;
  await PL.ready;
  const r = PL.tabs.get(d.tabId);
  if (!r) return;
  const host = PL.hostOf(d.url);
  for (const h of d.responseHeaders) {
    if (h.name.toLowerCase() !== 'set-cookie' || !h.value) continue;
    // O Firefox junta múltiplos Set-Cookie num único valor separado por \n.
    for (const line of h.value.split('\n')) {
      if (!line.trim()) continue;
      PL.recordCookie(r, PL.parseCookieString(line, host), { source: 'http', url: d.url, type: d.type });
    }
  }
}, { urls: ['<all_urls>'] }, ['responseHeaders']);
