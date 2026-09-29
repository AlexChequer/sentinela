# Reconciliação: wikipedia.org

Gerado por `scripts/reconcile.mjs` a partir de `wikipedia.har`, `wikipedia-sentinela.json`, `wikipedia-blacklight.txt`.

| Fonte | Requisições | De terceiros | Sites de terceiros |
|---|---|---|---|
| HAR (DevTools) | 39 | 11 | 1 |
| Sentinela | 35 | 11 | 1 |
| Blacklight (domínios citados) | — | — | 0 |

Score da Sentinela: **85/100 (A)**.

## Domínios de terceiros

| Site | HAR | Sentinela | Rastreador (Sentinela) | Disconnect | uBlock bloqueou | Blacklight | Explicação sugerida |
|---|---|---|---|---|---|---|---|
| wikimedia.org | 11 | 11 | — | — | ? | — |  |

## Score: Sentinela × Blacklight

A mesma tabela de pesos (docs/metodologia-score.md) aplicada às categorias que o
Blacklight marcou, para comparar notas.

| Categoria do Blacklight | Sentinela encontrou | Desconto Sentinela | Blacklight encontrou | Desconto aplicado ao Blacklight |
|---|---|---|---|---|
| Ad trackers | não | −0 | não | −0 |
| Third-party cookies | sim (10) | −15 | sim (4) | −8 |
| Tracking that evades cookie blockers | não | −0 | não | −0 |
| Session-monitoring scripts | não | −0 | não | −0 |
| Keystroke capturing | não | −0 | não | −0 |
| Facebook | não | −0 | não | −0 |
| TikTok | não | −0 | não | −0 |
| Twitter/X | não | −0 | não | −0 |
| Google Analytics | não | −0 | não | −0 |

Critérios que só a Sentinela mede: nenhum descontou pontos.

Score equivalente do Blacklight (só os 9 critérios dele): **92/100**. Score da Sentinela só nos mesmos 9 critérios: **85/100**.
