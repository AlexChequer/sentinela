'use strict';
// Classificação das leituras de canvas enviadas por content/fp-world.js.
//
// Critérios de Englehardt & Narayanan, "Online Tracking: A 1-million-site
// Measurement and Analysis" (CCS 2016), os mesmos do OpenWPM:
//  1. canvas com pelo menos 16x16 px;
//  2. texto com >= 10 caracteres distintos OU >= 2 cores;
//  3. imagem extraída (toDataURL/toBlob/getImageData);
//  4. extração sem compressão com perdas (JPEG/WebP destroem o sinal).
// O que não passa em todos vira "extração": leitura de canvas sem os sinais de
// fingerprinting (ex.: o teste 16x16 sem texto do DDG, que mede aleatorização).

PL.CANVAS_RULES = { minSide: 16, minChars: 10, minColors: 2, lossy: /jpe?g|webp/i };

PL.classifyCanvas = (ev) => {
  const R = PL.CANVAS_RULES;
  const failed = [];
  if (!(ev.width >= R.minSide && ev.height >= R.minSide)) failed.push(`canvas ${ev.width}x${ev.height} < ${R.minSide}x${R.minSide}`);
  if (ev.distinctChars < R.minChars && ev.colors < R.minColors) failed.push(`${ev.distinctChars} caracteres distintos e ${ev.colors} cor(es)`);
  if (ev.mimeType && R.lossy.test(ev.mimeType)) failed.push(`formato com perdas (${ev.mimeType})`);
  return failed.length
    ? { verdict: 'extraction', reasons: failed }
    : { verdict: 'fingerprint', reasons: [`${ev.width}x${ev.height}`, `${ev.distinctChars} caracteres distintos`, `${ev.colors} cor(es)`, `extraído via ${ev.api}`] };
};

PL.recordCanvasRead = (r, frame, ev) => {
  const scriptSite = ev.script ? PL.siteOf(ev.script) : null;
  const { verdict, reasons } = PL.classifyCanvas(ev);
  if (r.fingerprint.canvas.length >= PL.LIMITS.canvas) return;
  r.fingerprint.canvas.push({
    t: ev.t, api: ev.api, mimeType: ev.mimeType, width: ev.width, height: ev.height,
    distinctChars: ev.distinctChars, colors: ev.colors, textSample: PL.trunc(ev.textSample, 40),
    script: ev.script, scriptParty: scriptSite ? PL.partyOf(r, scriptSite) : null,
    frame: PL.trunc(frame.url), verdict, reasons,
  });
  PL.persist();
};
