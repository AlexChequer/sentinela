# Sentinela: contexto do projeto para o Claude Code

Extensão para Firefox que detecta rastreadores e violações de privacidade no
cliente web. É a Avaliação Intermediária de Cibersegurança do Insper
(prof. João Eduardo Luisi). O objetivo é o **conceito A**. O uso de IA é
permitido pela disciplina.

Aluno: Alex. Responda na língua em que ele escrever (normalmente português,
informal). Ele prefere ir **um passo de cada vez**: explique o que vai fazer,
faça, peça para ele validar no Firefox antes de seguir. Se ele contestar algo,
leve a sério e verifique antes de insistir.

## Enunciado resumido (rubrica)

Prazo: 1 semana a partir de 24/09/2026 (confirmar a data exata com o Alex).

Entregáveis obrigatórios:
1. Repositório Git com **histórico de commits incrementais ao longo da semana**
   + plugin instalável (manifest.json + instruções via about:debugging).
2. Relatório no DuckDuckGo Privacy Test Pages (https://privacy-test-pages.site):
   tabela teste × resultado esperado (reportado pela página) × resultado do
   plugin × explicação de cada divergência. **Cada linha com print do plugin
   rodando na página.**
3. Análise de 3 sites reais (sorteados por matrícula; o Alex vai informar):
   HAR exportado do DevTools + comparação com o Blacklight (The Markup) e com
   os bloqueios do uBlock Origin.
4. Score de privacidade aplicado aos 3 sites, com metodologia (critérios,
   pesos, justificativa), comparado ao Blacklight.

Formato: link do repo, relatório em PDF (entregáveis 2, 3 e 4), HARs e prints
em `evidencias/`.

- **C:** instala e roda sem erro; detecta terceiros, contagem de cookies e
  storage HTML5; relatório DDG cobrindo no mínimo Tracker Reporting, Storage
  blocking e Fingerprinting/canvas; HAR dos 3 sites.
- **B:** tudo do C + cookies 1ª/3ª parte e sessão/persistente; canvas
  fingerprint; bounce tracking / cookie sync (páginas Bounce tracking e Query
  parameters do DDG); relatório DDG cobre também Tracker Blocking e Storage
  partitioning com explicação técnica de cada divergência; reconciliação nos 3
  sites: todo rastreador que Blacklight ou uBlock acharam e o plugin não (ou
  vice-versa) tem explicação técnica.
- **A:** tudo do B + detecção de hijacking/hook (WebSocket ou polling
  persistente para terceiro; script que altera objetos globais; página js-leaks
  do DDG como teste); score com metodologia explícita e comparação crítica ao
  Blacklight (onde concordam, divergem e por quê); UI mostra relatório por
  página (rastreadores, cookies, storage, score) e permite **lista de bloqueio
  personalizada**.

Descontos: commit único ou histórico concentrado no último dia; relatório sem
HAR ou sem prints zera os entregáveis 2 e 3; explicações de divergência
genéricas, sem referência ao tráfego observado no HAR ou na página de teste,
não contam.

## Regras de trabalho

- **Commits pequenos e reais, conforme o trabalho acontece.** Um commit por
  funcionalidade testada, mensagens descritivas em português. Nunca altere
  datas de commit (`--date`, `GIT_COMMITTER_DATE`, rebase para reescrever
  histórico): o histórico precisa refletir o trabalho de verdade.
- Depois de cada mudança: `npm run lint` (web-ext lint, precisa dar 0 erros) e
  `node --check` nos arquivos alterados.
- Não invente resultados. Prints, HARs, relatórios do Blacklight e bloqueios do
  uBlock são evidências que o Alex coleta no navegador dele. Você prepara
  roteiros, scripts auxiliares e a análise, mas os números do relatório vêm do
  que foi realmente observado.
- Valores de cookies e de storage nunca são armazenados em claro (só nome,
  tamanho e hash FNV-1a). Mantenha isso.
- UI sem `innerHTML` com dados de páginas; use o helper `el()` / `textContent`.

## Estado atual (fase 1 pronta, ainda não testada no Firefox)

MV3, Firefox >= 128. Estrutura:

```
extension/
  manifest.json
  background/  util.js trackers.js state.js requests.js cookies.js storage.js messages.js
  content/     main-world.js (world: MAIN, document_start, all_frames) + bridge.js (isolado)
  popup/       popup.html/.css/.js (abas Terceiros, Cookies, Armazenamento; exportar JSON)
  data/trackers.js   gerado por scripts/build-tracker-db.mjs (lista Disconnect)
  lib/tldts.umd.min.js  Public Suffix List
evidencias/  docs/  scripts/
```

Já implementado:
- Terceira parte = eTLD+1 da requisição ≠ eTLD+1 da aba (tldts, com domínios
  privados da PSL).
- Rastreador = lista Disconnect (exceto Content, Anti-fraud, ConsentManagers)
  OU flag de rastreamento em `details.urlClassification` do Firefox OU domínios
  de teste do DDG (`bad.third-party.site`, `broken.third-party.site`; o
  `good.third-party.site` é terceiro não rastreador, conforme o README do repo
  do DDG).
- Cookies via `Set-Cookie` (onHeadersReceived; o Firefox junta vários
  Set-Cookie com `\n`) e via setter de `document.cookie` (com script de origem
  pela stack e campo `accepted`).
- localStorage/sessionStorage (hooks em Storage.prototype + snapshots em
  DOMContentLoaded, load, +3 s, +10 s) e IndexedDB (hook em open +
  `indexedDB.databases()`). Frames bloqueados aparecem com o erro
  (ex.: SecurityError).
- Estado por aba persistido em `storage.session` (a event page do MV3 pode ser
  suspensa). Badge com número de rastreadores de terceiros.
- Exportação JSON (via background + downloads) com log de requisições para
  cruzar com o HAR.

Decisões que devem ser preservadas: hooks via `Proxy` sobre as nativas
(preserva name/length/toString), nenhuma global nova no mundo principal,
referências nativas capturadas no início do main-world.js. Motivo: a página
js-leaks do DDG compara as globais da página com um perfil de referência, e o
plugin não pode aparecer ali como "hook".

## Armadilhas conhecidas

- **ETP e Total Cookie Protection do Firefox** bloqueiam/particionam coisas
  antes do plugin agir. O "resultado esperado" das páginas do DDG mede o
  navegador inteiro. Os testes devem rodar num perfil dedicado (about:profiles)
  com ETP em "Padrão", e isso vai documentado no relatório. Essas
  interferências são a principal fonte de explicações de divergência.
- Um `Set-Cookie` observado não significa cookie gravado.
- Requisições de service worker vêm com `tabId = -1` (aparecem no HAR, não no
  plugin): explicação de divergência válida.
- No MV3 o Firefox pode não conceder `<all_urls>` automaticamente; o popup tem
  botão para pedir a permissão.

## Roteiro

Cada fase: implementar, lint, o Alex testa no Firefox, commit(s). Idealmente
fases em dias diferentes.

### Fase 0: colocar a fase 1 de pé
1. `git init` (se ainda não houver), `npm install` (web-ext), `npm run lint`.
2. Guiar o Alex a carregar em `about:debugging#/runtime/this-firefox`
   ("Carregar extensão temporária…" → `extension/manifest.json`) e testar:
   `privacy-test-pages.site/tracker-reporting/1major-via-script.html` (aba
   Terceiros) e `privacy-test-pages.site/privacy-protections/storage-blocking/`
   (aba Armazenamento).
3. Corrigir o que quebrar (pedir erros do console: about:debugging →
   Inspecionar). Commitar a fase 1 em alguns commits lógicos. Criar repo no
   GitHub e dar push.
4. Opcional mas útil: teste de fumaça com Selenium + geckodriver
   (`driver.install_addon(path, temporary=True)`) que abre páginas do DDG e
   verifica o JSON exportado. Serve para regressão, não substitui os prints.

### Fase 2: fingerprinting e rastreamento de navegação (B)
- **Canvas fingerprint** no main-world: instrumentar `HTMLCanvasElement`
  (`toDataURL`, `toBlob`), `CanvasRenderingContext2D` (`fillText`,
  `strokeText`, `getImageData`, `fillStyle`), `OffscreenCanvas`. Heurística de
  Englehardt & Narayanan (2016, usada no OpenWPM): canvas ≥ 16×16, texto com
  ≥ 10 caracteres distintos ou ≥ 2 cores, e extração da imagem, sem
  `save/restore/addEventListener` típicos de uso legítimo. Registrar o script
  responsável. Extra: WebGL `getParameter(UNMASKED_*)` e AudioContext.
  Testar em `privacy-protections/fingerprinting/`,
  `privacy-protections/fingerprinting/canvas.html` e browserleaks.com/canvas.
- **Bounce tracking**: `webRequest.onBeforeRedirect` para `main_frame`,
  guardar a cadeia de saltos da navegação. Sinalizar quando há site
  intermediário diferente de origem e destino, especialmente se ele define
  cookie; cobrir também redirecionamentos client-side (JS/meta refresh logo
  após o load, via webNavigation). Os saltos intermediários não devem contar
  como primeira parte do destino.
- **Cookie sync / parâmetros de rastreamento**: detectar parâmetros conhecidos
  (gclid, fbclid, msclkid, dclid, yclid, twclid, igshid, mc_eid, _hsenc,
  utm_*…) e valores de alta entropia (≥ 8 caracteres) em URLs para terceiros.
  Sync = hash de valor de cookie de um domínio aparecendo em parâmetro de
  requisição para outro domínio, ou o mesmo identificador enviado a dois
  terceiros. Testar em `privacy-protections/bounce-tracking/` e
  `privacy-protections/query-parameters/`.
- Nova aba no popup para esses achados.

### Fase 3: hijacking/hook e bloqueio (A)
- WebSocket para terceiro (webRequest vê `type: websocket`) e polling
  persistente (≥ N requisições ao mesmo endpoint de terceiro em intervalos
  regulares; o hook do BeEF faz polling).
- Integridade de globais: no main-world, snapshot das propriedades próprias de
  `window` em document_start; comparar depois do load (+ alguns segundos) e
  listar globais adicionadas. Verificar se nativas críticas (`fetch`,
  `XMLHttpRequest.prototype.open/send`, `WebSocket`,
  `EventTarget.prototype.addEventListener`, `document.write`, `eval`,
  `Function`) foram substituídas (toString sem `[native code]` ou descritor
  diferente) e por qual script.
- Scripts de terceiros injetados dinamicamente (MutationObserver em `<script>`).
- Assinaturas de BeEF: `hook.js`, cookie `BEEFHOOK`, global `beef`, porta 3000.
- Página de teste própria em `tests/pages/` (servida com
  `python3 -m http.server`) que simula hook: sobrescreve `fetch`, abre
  WebSocket para outro host, faz polling. Opcional forte: BeEF em Docker contra
  página local vulnerável a XSS, só em ambiente local.
- Validar em `security/js-leaks.html` e documentar que o próprio plugin não
  deixa rastro ali.
- **Lista de bloqueio personalizada**: permissão `webRequestBlocking`,
  `onBeforeRequest` retornando `{cancel: true}`, lista em `storage.local`,
  editável no popup (adicionar/remover domínio, bloquear com um clique a partir
  da aba Terceiros), contagem de bloqueios no relatório. Opcional: modo
  "bloquear rastreadores conhecidos" para comparar com Tracker Blocking do DDG.

### Fase 4: score e relatório por página (A)
- Score 0–100 com metodologia em `docs/metodologia-score.md`: critérios, pesos
  e justificativa. Alinhar os critérios às verificações do Blacklight
  (rastreadores de anúncio, cookies de terceiros, canvas fingerprinting,
  session recording, captura de teclado, Facebook Pixel, Google Analytics
  remarketing) para a comparação ser direta, mais o que o Blacklight não mede
  (storage de terceiros, bounce/sync, hooks). Conferir as categorias atuais no
  site da The Markup antes de fixar. Session recording: lista de domínios
  conhecidos (Hotjar, FullStory, Clarity, Mouseflow…). Captura de teclado:
  listeners em inputs adicionados por scripts de terceiros + envio de dados
  antes do submit.
- Página de relatório em aba inteira (`report/report.html?tab=ID`) com tudo:
  rastreadores, cookies, storage, fingerprint, navegação, hooks, score. É a
  melhor tela para os prints.

### Fase 5: evidências e relatório
- Roteiro para o Alex coletar prints de cada página do DDG (mínimo: Tracker
  Reporting, Storage blocking, Fingerprinting/canvas, Tracker Blocking, Storage
  partitioning, Bounce tracking, Query parameters, js-leaks).
- Roteiro de HAR: DevTools → Rede → "Persistir logs" e "Desativar cache",
  recarregar, "Salvar tudo como HAR". Não logar em nada nos sites.
- Script em `scripts/` que lê o HAR e o JSON exportado e gera a tabela de
  reconciliação (domínios no HAR × plugin × Blacklight × uBlock) para embasar
  cada explicação com o tráfego observado.
- Relatório em `docs/relatorio.md` → PDF, com os entregáveis 2, 3 e 4.




