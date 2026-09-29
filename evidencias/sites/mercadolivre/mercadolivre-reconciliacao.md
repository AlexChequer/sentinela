# Reconciliação: mercadolivre.com.br

Gerado por `scripts/reconcile.mjs` a partir de `mercadolivre.har`, `mercadolivre-sentinela.json`, `mercadolivre-ublock.txt`, `mercadolivre-blacklight.txt`.

| Fonte | Requisições | De terceiros | Sites de terceiros |
|---|---|---|---|
| HAR (DevTools) | 437 | 429 | 10 |
| Sentinela | 219 | 215 | 10 |
| uBlock Origin (bloqueados) | — | — | 7 |
| Blacklight (domínios citados) | — | — | 0 |

Score da Sentinela: **35/100 (D)**.

## Domínios de terceiros

| Site | HAR | Sentinela | Rastreador (Sentinela) | Disconnect | uBlock bloqueou | Blacklight | Explicação sugerida |
|---|---|---|---|---|---|---|---|
| mlstatic.com | 327 | 161 | sim | MercadoLibre (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| hotjar.com | 5 | 3 | sim | ContentSquare (Analytics) | sim | — |  |
| mercadopago.com | 1 | 1 | sim | MercadoLibre (FingerprintingInvasive) | sim | — |  |
| mercadolibre.com | 39 | 18 | — | — | sim | — | uBlock bloqueia e a Sentinela não marca rastreador: o domínio está nas listas do uBlock (EasyList/EasyPrivacy/uBO) mas não na Disconnect nem na classificação do Firefox. |
| mercadoclics.com | 26 | 13 | — | — | sim | — | uBlock bloqueia e a Sentinela não marca rastreador: o domínio está nas listas do uBlock (EasyList/EasyPrivacy/uBO) mas não na Disconnect nem na classificação do Firefox. |
| meli.com | 16 | 11 | — | — | — | — |  |
| google.com | 11 | 5 | — | Google (Content) | sim | — | uBlock bloqueia e a Sentinela não marca rastreador: o domínio está nas listas do uBlock (EasyList/EasyPrivacy/uBO) mas não na Disconnect nem na classificação do Firefox. |
| gstatic.com | 2 | 1 | — | Google (Content) | — | — |  |
| mercadolivre.com | 1 | 1 | — | — | sim | — | uBlock bloqueia e a Sentinela não marca rastreador: o domínio está nas listas do uBlock (EasyList/EasyPrivacy/uBO) mas não na Disconnect nem na classificação do Firefox. |
| mercadopago.com.br | 1 | 1 | — | — | sim | — | uBlock bloqueia e a Sentinela não marca rastreador: o domínio está nas listas do uBlock (EasyList/EasyPrivacy/uBO) mas não na Disconnect nem na classificação do Firefox. |

## Score: Sentinela × Blacklight

A mesma tabela de pesos (docs/metodologia-score.md) aplicada às categorias que o
Blacklight marcou, para comparar notas.

| Categoria do Blacklight | Sentinela encontrou | Desconto Sentinela | Blacklight encontrou | Desconto aplicado ao Blacklight |
|---|---|---|---|---|
| Ad trackers | sim (1) | −4 | sim (11) | −20 |
| Third-party cookies | sim (9) | −15 | sim (16) | −15 |
| Tracking that evades cookie blockers | não | −0 | não | −0 |
| Session-monitoring scripts | sim (1) | −10 | não | −0 |
| Keystroke capturing | sim (1) | −10 | não | −0 |
| Facebook | não | −0 | sim (1) | −5 |
| TikTok | não | −0 | sim (1) | −5 |
| Twitter/X | não | −0 | sim (1) | −5 |
| Google Analytics | não | −0 | não | −0 |

Critérios que só a Sentinela mede: Storage em frames de terceiros (−1); Bounce tracking / cookie sync (−15); Funções nativas substituídas (−10).

Score equivalente do Blacklight (só os 9 critérios dele): **50/100**. Score da Sentinela só nos mesmos 9 critérios: **61/100**.
