# Páginas de teste locais

`hook.html` simula um navegador "fisgado" (hook no estilo BeEF), sem efeito real,
para validar a aba **Ameaças** da Sentinela.

```bash
# na raiz do repositório
python3 -m http.server 8000
```

Abra `http://localhost:8000/tests/pages/hook.html` e espere uns 15 s. O `hook.js`
vem de `127.0.0.1:8000`, que o navegador trata como outro site (terceiro).

Esperado na aba Ameaças:

| Indicador | Esperado |
|---|---|
| Assinatura de BeEF | `hook.js`, global `beef`, cookie `BEEFHOOK` |
| WebSocket para terceiro | `ws://127.0.0.1:8000/ws` |
| Polling persistente | `poll.json` a cada ~2 s |
| Nativas substituídas | `fetch`, `XMLHttpRequest.prototype.open` |
| Script injetado | `extra.js`, injetado por `hook.js` |
| Captura de teclado | `keydown` em `document` por `hook.js` |
