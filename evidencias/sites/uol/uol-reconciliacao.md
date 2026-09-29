# Reconciliação: uol.com.br

Gerado por `scripts/reconcile.mjs` a partir de `uol.har`, `uol-sentinela.json`, `uol-ublock.txt`, `uol-blacklight.txt`.

| Fonte | Requisições | De terceiros | Sites de terceiros |
|---|---|---|---|
| HAR (DevTools) | 401 | 326 | 35 |
| Sentinela | 426 | 334 | 35 |
| uBlock Origin (bloqueados) | — | — | 7 |
| Blacklight (domínios citados) | — | — | 0 |

Score da Sentinela: **30/100 (D)**.

## Domínios de terceiros

| Site | HAR | Sentinela | Rastreador (Sentinela) | Disconnect | uBlock bloqueou | Blacklight | Explicação sugerida |
|---|---|---|---|---|---|---|---|
| googlesyndication.com | 34 | 41 | sim | Google (Advertising, FingerprintingGeneral) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| scorecardresearch.com | 23 | 28 | sim | comScore (Analytics) | sim | — |  |
| google.com | 24 | 25 | sim | Google (Content) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| newsroom.bi | 20 | 26 | sim | Marfeel (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| doubleclick.net | 20 | 23 | sim | Google (Email, Advertising, FingerprintingGeneral) | sim | — |  |
| permutive.com | 17 | 19 | sim | Permutive (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| adnxs.com | 14 | 15 | sim | Microsoft (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| seedtag.com | 11 | 12 | sim | SeedTag (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| rubiconproject.com | 10 | 11 | sim | Magnite (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| smartadserver.com | 8 | 9 | sim | Equativ (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| chartbeat.net | 5 | 7 | sim | Chartbeat (Analytics) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| adtrafficquality.google | 5 | 5 | sim | Google (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| amazon-adsystem.com | 4 | 4 | sim | Amazon (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| mrf.io | 3 | 3 | sim | Marfeel (Advertising) | sim | — |  |
| privacymanager.io | 3 | 3 | sim | LiveRamp (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| chartbeat.com | 3 | 3 | sim | Chartbeat (Analytics) | sim | — |  |
| cxense.com | 3 | 3 | sim | Piano (Advertising) | sim | — |  |
| criteo.com | 2 | 2 | sim | Criteo (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| id5-sync.com | 2 | 2 | sim | ID5 (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| im-apps.net | 2 | 2 | sim | IntimateMerger (Advertising) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| permutive.app | 1 | 1 | sim | Permutive (Advertising) | sim | — |  |
| turner.com | 1 | 1 | sim | Warner Bros. Discovery (Analytics) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| 2mdn.net | 1 | 1 | sim | Google (Advertising, FingerprintingGeneral) | — | — | Sentinela marca rastreador e o uBlock não mostra bloqueio: ou o uBlock permite o domínio (exceção para não quebrar o site, ex.: CDN/Content), ou ele nem chegou a carregar porque o script que o chamaria foi bloqueado antes (bloqueio em cadeia). |
| google-analytics.com | 1 | 1 | sim | Google (Email, Analytics, FingerprintingGeneral) | sim | — |  |
| imguol.com.br | 50 | 29 | — | — | — | — |  |
| jsuol.com.br | 37 | 37 | — | — | — | — |  |
| uol.com | 8 | 8 | — | — | — | — |  |
| googletagmanager.com | 3 | 3 | — | — | — | — |  |
| google.com.br | 2 | 2 | — | Google (Content) | — | — |  |
| imasdk.googleapis.com | 2 | 2 | — | Google (Content) | — | — |  |
| gstatic.com | 2 | 2 | — | Google (Content) | — | — |  |
| jsuol.com | 2 | 1 | — | — | — | — |  |
| youtube.com | 1 | 1 | — | Google (Content) | — | — |  |
| tinypass.com | 1 | 1 | — | Piano (Content) | — | — |  |
| piano.io | 1 | 1 | — | Piano (Content) | — | — |  |

## Score: Sentinela × Blacklight

A mesma tabela de pesos (docs/metodologia-score.md) aplicada às categorias que o
Blacklight marcou, para comparar notas.

| Categoria do Blacklight | Sentinela encontrou | Desconto Sentinela | Blacklight encontrou | Desconto aplicado ao Blacklight |
|---|---|---|---|---|
| Ad trackers | sim (18) | −20 | sim (21) | −20 |
| Third-party cookies | sim (20) | −15 | sim (14) | −15 |
| Tracking that evades cookie blockers | não | −0 | não | −0 |
| Session-monitoring scripts | não | −0 | não | −0 |
| Keystroke capturing | sim (1) | −10 | não | −0 |
| Facebook | não | −0 | sim (1) | −5 |
| TikTok | não | −0 | não | −0 |
| Twitter/X | não | −0 | não | −0 |
| Google Analytics | sim (1) | −5 | sim (1) | −5 |

Critérios que só a Sentinela mede: Bounce tracking / cookie sync (−15); WebSocket / polling para terceiro (−5).

Score equivalente do Blacklight (só os 9 critérios dele): **55/100**. Score da Sentinela só nos mesmos 9 critérios: **50/100**.
