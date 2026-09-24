'use strict';
// Funções utilitárias compartilhadas pelo background.
const PL = (self.PL = self.PL || {});

PL.hostOf = (url) => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
};

// "site" = eTLD+1 (registrable domain), mesma noção que o navegador usa para
// decidir primeira vs. terceira parte. Inclui a seção privada da PSL
// (ex.: usuario.github.io é um site distinto de outro.github.io).
PL.siteOfHost = (host) => {
  if (!host) return null;
  const d = tldts.getDomain(host, { allowPrivateDomains: true });
  return d || host; // IPs e localhost não têm eTLD+1
};
PL.siteOf = (url) => PL.siteOfHost(PL.hostOf(url));

PL.isWebUrl = (url) => /^(https?|wss?):/i.test(url || '');

PL.trunc = (s, n = 300) => (s && s.length > n ? s.slice(0, n) + '…' : s);

// Hash FNV-1a 32 bits. Guardamos só o hash dos valores de cookies, nunca o valor
// em si: o relatório exportado não vaza identificadores do usuário.
PL.hash = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

// Interpreta uma linha de Set-Cookie (ou uma string atribuída a document.cookie)
// conforme a RFC 6265: Max-Age tem precedência sobre Expires; sem nenhum dos
// dois o cookie é de sessão; expiração no passado é uma remoção.
PL.parseCookieString = (str, defaultHost, now = Date.now()) => {
  const parts = str.split(';');
  const first = parts.shift() || '';
  const eq = first.indexOf('=');
  const name = (eq >= 0 ? first.slice(0, eq) : '').trim();
  const value = (eq >= 0 ? first.slice(eq + 1) : first).trim();
  const c = {
    name, valueLength: value.length, valueHash: PL.hash(value),
    domain: defaultHost, hostOnly: true, path: '/', expires: null, maxAge: null,
    secure: false, httpOnly: false, sameSite: null, partitioned: false,
  };
  for (const raw of parts) {
    const i = raw.indexOf('=');
    const k = (i >= 0 ? raw.slice(0, i) : raw).trim().toLowerCase();
    const v = i >= 0 ? raw.slice(i + 1).trim() : '';
    switch (k) {
      case 'expires': { const t = Date.parse(v); if (!Number.isNaN(t)) c.expires = t; break; }
      case 'max-age': { const n = parseInt(v, 10); if (!Number.isNaN(n)) c.maxAge = n; break; }
      case 'domain': if (v) { c.domain = v.replace(/^\./, '').toLowerCase(); c.hostOnly = false; } break;
      case 'path': if (v) c.path = v; break;
      case 'secure': c.secure = true; break;
      case 'httponly': c.httpOnly = true; break;
      case 'samesite': c.sameSite = v.toLowerCase() || null; break;
      case 'partitioned': c.partitioned = true; break;
    }
  }
  const expiry = c.maxAge !== null ? now + c.maxAge * 1000 : c.expires;
  c.expiry = expiry;
  c.lifetime = expiry === null ? 'session' : expiry <= now ? 'deleted' : 'persistent';
  c.lifetimeDays = expiry && expiry > now ? Math.round(((expiry - now) / 864e5) * 10) / 10 : null;
  // O navegador rejeita Domain= que não case com o host que definiu o cookie.
  c.domainMatches = defaultHost === c.domain || (defaultHost || '').endsWith('.' + c.domain);
  return c;
};
