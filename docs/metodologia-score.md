# Metodologia do score de privacidade da Sentinela

O score vai de **0 a 100**: quanto maior, mais privada é a página. Toda página
começa com 100 e perde pontos para cada prática de rastreamento ou indicador de
ameaça observado durante o carregamento. Cada critério tem um **teto de
desconto**, para que uma única categoria (por exemplo, dezenas de cookies de
terceiros) não zere a nota sozinha. O resultado é limitado a 0.

Implementação: `extension/background/score.js`. O cálculo usa só o que a
extensão observou na aba (requisições, cookies, storage, leituras de canvas,
navegação e eventos da página). Nenhum dado é enviado para fora.

## Critérios e pesos

Os critérios 1 a 9 são as nove verificações que o **Blacklight** (The Markup)
faz hoje, na mesma ordem e com o mesmo nome, para que a comparação com ele seja
direta. Os critérios 10 a 14 medem o que o Blacklight não mede.

| # | Critério | Equivalente no Blacklight | Como a Sentinela mede | Desconto |
|---|---|---|---|---|
| 1 | Rastreadores de anúncio | Ad trackers | domínios de terceiros na categoria *Advertising* da lista Disconnect ou marcados `tracking_ad` pelo Firefox | −4 por domínio, até −20 |
| 2 | Cookies de terceiros | Third-party cookies | cookies únicos cujo site (eTLD+1) difere do site da aba, via `Set-Cookie` ou JS | −2 por cookie, até −15 |
| 3 | Canvas fingerprint | Tracking that evades cookie blockers | leitura de canvas classificada como fingerprint (Englehardt & Narayanan 2016) | −15 |
| 4 | Gravação de sessão | Session-monitoring scripts | requisição a fornecedor de *session replay* (Hotjar, FullStory, Clarity, Mouseflow, Smartlook, Lucky Orange, Yandex Webvisor…) | −10 |
| 5 | Captura de teclado por terceiro | Keystroke capturing | listener de `keydown`/`keyup`/`keypress`/`input`/`change`/`paste` registrado por script de terceiro em campo, formulário, documento ou janela | −10 |
| 6 | Pixel do Facebook | Facebook | requisição a `connect.facebook.net` ou `facebook.com/tr` | −5 |
| 7 | Pixel do TikTok | TikTok | requisição a `analytics.tiktok.com` | −5 |
| 8 | Pixel do Twitter/X | Twitter/X | requisição a `ads-twitter.com`, `analytics.twitter.com` ou `t.co/i/adsct` | −5 |
| 9 | Google Analytics com remarketing | Google Analytics | requisição a `stats.g.doubleclick.net` ou `…/ads/ga-audiences` (recurso "públicos de remarketing" do GA) | −5 |
| 10 | Storage em frames de terceiros | não mede | frame de terceiro com localStorage, sessionStorage, IndexedDB ou Cache API em uso | −1 por frame, até −5 |
| 11 | Bounce tracking / cookie sync | não mede | bounce detectado na cadeia de navegação ou identificador enviado a outro site | −10 por ocorrência, até −15 |
| 12 | Assinatura de BeEF | não mede | `hook.js`, porta 3000, cookie `BEEFHOOK` ou global `beef` | −40 |
| 13 | Funções nativas substituídas | não mede | `fetch`, XHR, `WebSocket`, `addEventListener`, `eval`… trocadas depois do carregamento | −10 |
| 14 | WebSocket / polling para terceiro | não mede | WebSocket aberto para terceiro ou endpoint de terceiro chamado em intervalos regulares | −5 cada, até −10 |

Faixas: **A** ≥ 85, **B** ≥ 70, **C** ≥ 50, **D** ≥ 30, **F** < 30.

## Justificativa dos pesos

Os pesos seguem dois princípios: **quanto o usuário consegue se defender** e
**quanto a prática permite ligar a pessoa entre sites diferentes**.

- **Hijacking pesa mais que tudo (−40 BeEF, −10 nativas).** Não é rastreamento,
  é comprometimento: quem controla o hook executa comandos arbitrários no
  navegador. Uma assinatura de BeEF sozinha já leva a nota para D.
- **Fingerprint (−15) pesa mais que cookies.** Apagar cookies, usar aba anônima
  ou bloquear cookies de terceiros não impede o fingerprint, e é por isso que o
  Blacklight chama a categoria de "rastreamento que escapa de bloqueadores de
  cookies".
- **Bounce tracking e cookie sync (−10 cada, até −15)** também contornam
  proteções: o bounce transforma um rastreador de terceiro em primeira parte por
  um instante, e o sync junta identificadores de empresas diferentes.
- **Gravação de sessão e captura de teclado (−10)** expõem o conteúdo do que a
  pessoa faz e digita, inclusive dados que ela não chegou a enviar.
- **Rastreadores de anúncio (−4 cada, até −20) e cookies de terceiros (−2 cada,
  até −15)** são as práticas mais comuns. Descontam por item porque o volume
  importa (cada empresa a mais é mais um perfil sobre o usuário), mas com teto
  para não dominar a nota.
- **Pixels de redes sociais e GA com remarketing (−5 cada)** são rastreadores
  específicos que ligam a visita à conta da pessoa na rede social ou alimentam
  campanhas de anúncio. O domínio já pode ter contado no critério 1; o desconto
  extra reflete a identificação direta da conta.
- **Storage em frames de terceiros (−1, até −5)** pesa pouco porque, com o Total
  Cookie Protection do Firefox, esse storage fica particionado por site.

## Diferenças de medição em relação ao Blacklight

Estas diferenças são esperadas e vão para a comparação crítica do relatório:

- **Navegador e ambiente.** O Blacklight visita o site com um Chromium
  automatizado (Puppeteer) a partir dos servidores da The Markup, sem proteções
  de privacidade ativas. A Sentinela mede o Firefox real do
  usuário, com ETP Padrão, no Brasil. Os anúncios servidos e o consentimento de
  cookies (LGPD) podem mudar o que carrega.
- **Captura de teclado.** O Blacklight digita nos campos e verifica se o texto
  sai na rede antes do envio. A Sentinela detecta o listener registrado por
  terceiro, o que é um indicador mais amplo (pode haver listener que não envia
  nada).
- **Fingerprint.** O Blacklight também usa a heurística do OpenWPM para canvas.
  A Sentinela aplica o mesmo critério, mas só enxerga o que roda enquanto a
  página está aberta.
- **Cookies de terceiros.** A Sentinela conta cookies definidos (`Set-Cookie`
  ou JS). Com o Total Cookie Protection, eles existem, mas ficam particionados:
  o desconto mede a tentativa de rastrear, não o sucesso.
- **O Blacklight dá contagens, não uma nota.** Para comparar, aplicamos esta
  mesma tabela às categorias que o Blacklight marcou como encontradas.
