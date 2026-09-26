'use strict';
// Uso de armazenamento HTML5 (localStorage, sessionStorage, IndexedDB) por
// frame. Os dados chegam do content script; aqui só agregamos. Guardamos
// nomes de chaves e tamanhos, nunca os valores.

PL.storageEntry = (r, origin, url, isTop) => {
  let s = r.storage[origin];
  if (!s) {
    const site = PL.siteOf(url) || PL.siteOf(origin) || origin;
    s = r.storage[origin] = {
      origin, site, party: PL.partyOf(r, site), isTop,
      localStorage: null, sessionStorage: null, indexedDB: { databases: [] }, cacheStorage: { caches: [] },
      writes: { localStorage: 0, sessionStorage: 0, indexedDB: 0, cacheStorage: 0 },
      writeLog: [], errors: {},
      valueHashes: [], // hashes FNV-1a dos valores (para detectar cookie sync)
    };
  }
  // A página e um iframe about:blank dela caem na mesma origem: vale o topo.
  if (isTop) s.isTop = true;
  return s;
};

PL.recordStorageEvent = (r, frame, ev) => {
  const s = PL.storageEntry(r, frame.origin, frame.url, frame.isTop);
  const addHash = (h) => { if (h && !s.valueHashes.includes(h) && s.valueHashes.length < PL.LIMITS.hashes) s.valueHashes.push(h); };
  switch (ev.type) {
    case 'storage-snapshot':
      for (const area of ['localStorage', 'sessionStorage']) {
        const a = ev[area];
        if (!a) continue;
        if (a.error) s.errors[area] = a.error;
        else s[area] = { count: a.count, bytes: a.bytes, keys: a.keys, at: ev.t };
        for (const h of a.hashes || []) addHash(h);
      }
      if (ev.indexedDB) {
        if (ev.indexedDB.error) s.errors.indexedDB = ev.indexedDB.error;
        for (const n of ev.indexedDB.names || []) if (!s.indexedDB.databases.includes(n)) s.indexedDB.databases.push(n);
      }
      if (ev.cacheStorage) {
        if (ev.cacheStorage.error) s.errors.cacheStorage = ev.cacheStorage.error;
        for (const n of ev.cacheStorage.names || []) if (!s.cacheStorage.caches.includes(n)) s.cacheStorage.caches.push(n);
      }
      break;
    case 'storage-write':
      s.writes[ev.area] = (s.writes[ev.area] || 0) + 1;
      if (ev.op === 'set') addHash(ev.valueHash);
      if (s.writeLog.length < PL.LIMITS.storageWrites) {
        s.writeLog.push({ t: ev.t, area: ev.area, op: ev.op, key: PL.trunc(ev.key, 120), valueLength: ev.valueLength, setBy: ev.script });
      }
      break;
    case 'idb-open':
      s.writes.indexedDB++;
      if (ev.name && !s.indexedDB.databases.includes(ev.name)) s.indexedDB.databases.push(ev.name);
      break;
    case 'cache-open':
      s.writes.cacheStorage++;
      if (ev.name && !s.cacheStorage.caches.includes(ev.name)) s.cacheStorage.caches.push(ev.name);
      break;
    case 'storage-error':
      s.errors[ev.area] = ev.error;
      break;
  }
  PL.persist();
};
