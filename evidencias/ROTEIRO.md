# Roteiro de coleta de evidências

Tudo o que for salvo vai para as pastas abaixo, com **exatamente** estes nomes
(o script de reconciliação e o relatório procuram por eles).

```
evidencias/
  ddg/     prints e JSONs das páginas de teste do DuckDuckGo
  sites/   uol/  mercadolivre/  wikipedia/   (HAR, JSON, prints, Blacklight, uBlock)
  hook/    página de teste própria e js-leaks
```

## 0. Preparação (uma vez)

- [ ] Ative o **Não Perturbe** do Mac (sem notificações nos prints).
- [ ] Firefox no perfil **sentinela** (menu Profiles). Carregue a extensão em
      `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** →
      `extension/manifest.json`.
- [ ] Popup → aba **Bloqueio** → a caixa "Bloquear rastreadores" deve estar
      **desmarcada** (só é marcada no teste de Tracker Blocking).
- [ ] Janela do Firefox maximizada.
- [ ] Servidor local para a página de hook (no Terminal, na pasta do projeto):
      `python3 -m http.server 8000`

**Como tirar os prints:** `Cmd+Shift+4` e arraste um retângulo que pegue a
página **e** o popup aberto. A rubrica exige "print do plugin em execução na
página". Os prints ficam na Mesa: renomeie e mova para a pasta indicada.

**JSON:** botão **Exportar JSON** do popup → cai em `Downloads/sentinela/` →
mova para a pasta indicada com o nome indicado.

## 1. Páginas do DuckDuckGo → `evidencias/ddg/`

| # | Página | O que fazer | Salvar como |
|---|---|---|---|
| 1 | `privacy-test-pages.site/tracker-reporting/1major-via-script.html` | recarregar; popup na aba **Terceiros** | `01-tracker-reporting.png`, `01-tracker-reporting.json` |
| 2 | `privacy-test-pages.site/privacy-protections/storage-blocking/` | **Store data** → abrir "Click for details" → popup **Cookies** (print) e **Armazenamento** (print) | `02-storage-blocking-cookies.png`, `02-storage-blocking-storage.png`, `02-storage-blocking.json` |
| 3 | `privacy-test-pages.site/privacy-protections/fingerprinting/canvas.html` | esperar terminar; popup **Fingerprint** | `03-canvas-ddg.png`, `03-canvas-ddg.json` |
| 3b | `browserleaks.com/canvas` | popup **Fingerprint** | `03b-canvas-browserleaks.png`, `03b-canvas-browserleaks.json` |
| 4 | `privacy-test-pages.site/privacy-protections/request-blocking/` | **sem** bloqueio: print da página + popup **Terceiros**. Depois marcar "Bloquear rastreadores", recarregar, print da página + popup **Bloqueio**. **Desmarcar no final.** | `04-tracker-blocking-sem.png`, `04-tracker-blocking-com.png`, `04-tracker-blocking-com.json` |
| 5 | `https://www.first-party.site/privacy-protections/storage-partitioning/` (**esse endereço**: pelo privacy-test-pages.site o botão fica desabilitado e a página redireciona sozinha) | só uma aba dessa página aberta, **sem** Cmd+Shift+R; **Run Tests** (abre e fecha uma aba sozinha; se o Firefox bloquear pop-up, clique em **Allow** e rode de novo); espere ~30 s; **Show Detailed Results**; popup **Armazenamento** e **Cookies** | `05-storage-partitioning-storage.png`, `05-storage-partitioning-cookies.png`, `05-storage-partitioning.json` |
| 6 | `privacy-test-pages.site/privacy-protections/bounce-tracking/` | "Go to privacy-test-pages.site" **duas vezes** (print da aba **Navegação** em cada); depois "Go to good.third-party.site" (print) | `06-bounce-1a-visita.png`, `06-bounce-2a-visita.png`, `06-bounce-good.png`, `06-bounce-2a-visita.json` |
| 7 | `privacy-test-pages.site/privacy-protections/query-parameters/` | 1º link e 3º link; popup **Navegação** em cada | `07-query-link1.png`, `07-query-link3.png`, `07-query-link3.json` |

## 2. Hook e js-leaks → `evidencias/hook/`

| # | Página | O que fazer | Salvar como |
|---|---|---|---|
| 8 | `http://localhost:8000/tests/pages/hook.html` | esperar 15 s, digitar na caixa; popup **Ameaças** (print) e botão **Relatório** (print do topo com score) | `08-hook-ameacas.png`, `08-hook-relatorio.png`, `08-hook.json` |
| 9 | `privacy-test-pages.site/security/js-leaks.html` | **Check**; print da página com o popup | `09-js-leaks.png` |

## 3. Os 3 sites → `evidencias/sites/<site>/`

Sites: `https://www.uol.com.br` (pasta `uol`), `https://www.mercadolivre.com.br`
(pasta `mercadolivre`), `https://pt.wikipedia.org` (pasta `wikipedia`).

**Regras iguais para os três:** não logar, **não clicar** no banner de
cookies, esperar ~20 s parado, sem rolar a página.

### 3a. Sentinela + HAR (perfil **sentinela**)

- [ ] Abra uma aba nova vazia e o DevTools de Rede: `Cmd+Option+E`.
- [ ] No DevTools, ⚙️ (engrenagem da aba Network) → marque **Persist Logs**;
      marque **Disable Cache**.
- [ ] Digite a URL do site e dê Enter. Se o site já foi visitado: cadeado →
      **Clear cookies and site data…** → **Remove**, e dê Enter na URL de novo.
- [ ] Espere ~20 s.
- [ ] HAR: clique com o botão direito em qualquer linha da lista de rede →
      **Save All As HAR** → `<site>.har` (ex.: `uol.har`).
- [ ] Popup → **Exportar JSON** → `<site>-sentinela.json`.
- [ ] Popup → **Relatório** → prints: topo com score e cartões
      (`<site>-relatorio-1.png`), seção Score inteira (`<site>-relatorio-2.png`),
      Terceiros (`<site>-relatorio-3.png`). Se alguma seção tiver algo
      interessante (Fingerprint, Navegação, Ameaças), um print a mais.

### 3b. Blacklight (qualquer navegador)

- [ ] `https://themarkup.org/blacklight` → cole a URL → espere o resultado.
- [ ] Print da página inteira do resultado: no Firefox, `Cmd+Shift+S` →
      **Save full page** → `<site>-blacklight.png`.
- [ ] Copie a URL da página de resultado para `<site>-blacklight.txt`.

### 3c. uBlock Origin (perfil **ublock**, com o uBlock instalado)

- [ ] Limpe os dados do site (cadeado → Clear cookies and site data).
- [ ] Abra a URL, espere ~20 s.
- [ ] Clique no ícone do uBlock → clique em **Mais** / "More" até aparecer a
      lista de domínios (conectados × bloqueados) → print → `<site>-ublock.png`.
- [ ] Se a lista for longa, role e tire mais prints (`<site>-ublock-2.png`…).

## 4. Fim

- [ ] Me avise quando cada site estiver pronto (não precisa esperar os três).
- [ ] Não commite nada: eu confiro os nomes e commito junto com o relatório.
