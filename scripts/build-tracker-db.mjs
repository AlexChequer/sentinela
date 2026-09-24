// Gera extension/data/trackers.js a partir da lista Disconnect (a mesma usada pelo
// Enhanced Tracking Protection do Firefox).
// Uso: node scripts/build-tracker-db.mjs [caminho/para/services.json]
// Sem argumento, baixa a versão atual do GitHub.
import { readFile, writeFile } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json';

const raw = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(SRC)).json();

const domains = {}; // dominio -> [empresa, [categorias]]
for (const [category, entries] of Object.entries(raw.categories)) {
  for (const entry of entries) {
    for (const [company, info] of Object.entries(entry)) {
      for (const value of Object.values(info)) {
        if (!Array.isArray(value)) continue; // ignora flags como "performance"
        for (const d of value) {
          const key = d.toLowerCase();
          const cur = domains[key] || (domains[key] = [company, []]);
          if (!cur[1].includes(category)) cur[1].push(category);
        }
      }
    }
  }
}

const out = `// GERADO por scripts/build-tracker-db.mjs em ${new Date().toISOString()}
// Fonte: ${SRC}
// Licença da lista: ${raw.license?.split('\n')[0] ?? 'GPLv3 (Disconnect)'}
self.TRACKER_DB = ${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'disconnect', domains })};
`;
await writeFile(new URL('../extension/data/trackers.js', import.meta.url), out);
console.log(`trackers.js: ${Object.keys(domains).length} domínios`);
