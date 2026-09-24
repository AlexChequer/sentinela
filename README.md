# Sentinela

Extensão para Firefox que detecta, por página visitada, conexões a terceiros,
rastreadores, cookies injetados e uso de armazenamento no cliente (HTML5).
Avaliação Intermediária de Cibersegurança, Insper.

## Instalação (modo desenvolvedor)

1. Firefox 128 ou superior.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária…** e selecione `extension/manifest.json`.
4. Clique no ícone da Sentinela. Se aparecer o aviso de permissão, clique em
   **Permitir acesso a todos os sites** (no Manifest V3 o Firefox pode não conceder
   permissões de host automaticamente). Também dá para liberar em
   `about:addons` → Sentinela → Permissões.
5. Recarregue a página que quer analisar: a coleta começa na navegação.

Alternativa com hot reload: `npm install` e depois `npm start` (usa `web-ext run`).

## O que detecta (v0.1)

| Item | Como |
|---|---|
| Conexões a terceiros | `webRequest.onBeforeRequest`; terceira parte = eTLD+1 da requisição diferente do eTLD+1 da aba (Public Suffix List via `tldts`) |
| Rastreadores | Lista Disconnect empacotada (mesma base do ETP do Firefox) + `urlClassification` do Firefox + domínios de teste do DDG |
| Cookies (HTTP) | Cabeçalhos `Set-Cookie` em `webRequest.onHeadersReceived` |
| Cookies (JS) | Setter de `document.cookie` instrumentado no mundo principal da página |
| 1ª × 3ª parte | Site do atributo `Domain` do cookie × site da aba |
| Sessão × persistente | Presença de `Max-Age`/`Expires` (RFC 6265, Max-Age tem precedência) |
| localStorage / sessionStorage | Instrumentação de `Storage.prototype` + leituras periódicas (DOMContentLoaded, load, +3 s, +10 s) |
| IndexedDB | Instrumentação de `IDBFactory.open` + `indexedDB.databases()` |

## Arquitetura

```
extension/
  manifest.json          MV3, Firefox >= 128
  background/            event page: agrega os dados por aba
    util.js              eTLD+1, parser de cookies, hash
    trackers.js          classificação de domínios
    state.js             estado por aba, persistido em storage.session
    requests.js          requisições e navegação
    cookies.js           Set-Cookie e cookies via JS
    storage.js           agregação de armazenamento HTML5
    messages.js          resumo, exportação JSON, mensagens
  content/
    main-world.js        roda no contexto da página (world: MAIN) e instrumenta APIs
    bridge.js            mundo isolado: repassa eventos ao background
  popup/                 interface por página
  data/trackers.js       gerado por scripts/build-tracker-db.mjs
  lib/tldts.umd.min.js   Public Suffix List (MIT)
evidencias/              HARs, prints e JSONs exportados
docs/                    metodologia e relatório
```

Decisões de projeto:

- **Mundo principal em vez de injeção de `<script>`.** Um `<script>` injetado é
  bloqueado pela CSP de sites restritivos e roda tarde demais para ver
  fingerprinting feito no primeiro script da página. `world: "MAIN"` executa em
  `document_start` e ignora a CSP.
- **Instrumentação discreta.** As funções nativas são envolvidas em `Proxy`, que
  preserva `name`, `length` e `toString()`, e nenhuma global nova é criada.
- **Privacidade do próprio relatório.** Valores de cookies e de storage nunca são
  guardados: só nome, tamanho e hash FNV-1a (necessário para detectar cookie sync).
- **Interface sem `innerHTML`.** Nomes de cookies e chaves vêm de terceiros; tudo é
  inserido com `textContent` para não abrir XSS na própria extensão.

## Limitações conhecidas

- Requisições de service workers têm `tabId = -1` e não são atribuídas à aba.
- Um `Set-Cookie` observado não garante que o cookie foi gravado: o Total Cookie
  Protection particiona cookies de terceiros e o ETP pode bloqueá-los. Para cookies
  via JS a extensão verifica se o cookie aparece em `document.cookie` depois da
  escrita (campo `accepted`).
- Uma página hostil pode detectar a instrumentação comparando descritores de
  propriedades.

## Exportação

O botão **Exportar JSON** salva o relatório da aba em `Downloads/sentinela/`.
Esses arquivos vão para `evidencias/` junto com os HARs e prints.
