"""Gera docs/relatorio.pdf a partir de docs/relatorio.md.

Markdown -> HTML (capa, sumário, figuras numeradas) -> Firefox headless
"imprimir em PDF" via Selenium -> rodapé com número de página (PyMuPDF).
O sumário recebe os números de página numa segunda passada: a primeira
impressão serve para descobrir em que página cada seção caiu.

Uso (na raiz do repositório):
    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python scripts/gerar-pdf.py
"""
import base64
import html
import pathlib
import re
import sys

import markdown
import pymupdf
from selenium import webdriver
from selenium.webdriver.common.print_page_options import PrintOptions
from selenium.webdriver.firefox.options import Options

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "relatorio.md"
HTML = ROOT / "docs" / "relatorio.html"
PDF = ROOT / "docs" / "relatorio.pdf"
FIREFOX = "/Applications/Firefox.app/Contents/MacOS/firefox"
FOOTER = "Sentinela · Relatório da Avaliação Intermediária de Cibersegurança"

CSS = """
@page { size: A4; margin: 16mm 15mm 18mm; }
:root { --navy: #1d3a6e; --ink: #1b2330; --muted: #5d6b7e; --rule: #d5dbe3; --paper: #f3f5f8; --red: #b3262e; }
* { box-sizing: border-box; }
body { font: 10pt/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: var(--ink); margin: 0; }
p { margin: 0 0 7pt; text-align: justify; hyphens: auto; }
a { color: var(--navy); text-decoration: none; }
code { font: 8.6pt ui-monospace, Menlo, monospace; background: var(--paper); padding: 0 2.5pt; border-radius: 2pt; overflow-wrap: anywhere; }
strong { color: #0f1d36; }

/* Capa */
.cover { height: 257mm; display: flex; flex-direction: column; break-after: page; }
.cover .band { background: var(--navy); color: #fff; padding: 22mm 14mm 16mm; margin: 0 -15mm; }
.cover .kicker { font-size: 9.5pt; letter-spacing: .12em; text-transform: uppercase; opacity: .8; margin: 0 0 8pt; }
.cover h1 { font-size: 30pt; line-height: 1.1; margin: 0 0 8pt; color: #fff; }
.cover .sub { font-size: 13pt; opacity: .9; margin: 0; text-align: left; }
.cover .meta { margin: 14mm 0 10mm; border-collapse: collapse; width: 100%; font-size: 10.5pt; }
.cover .meta td { border: 0; border-bottom: .5pt solid var(--rule); padding: 5pt 0; background: none; }
.cover .meta td:first-child { color: var(--muted); width: 32%; }
.cover .scores { display: flex; gap: 6mm; margin-top: auto; }
.cover .score { flex: 1; border: 1pt solid var(--rule); border-radius: 4pt; padding: 8pt 10pt; }
.cover .score b { display: block; font-size: 26pt; line-height: 1.1; }
.cover .score span { color: var(--muted); font-size: 9pt; }
.cover .score.A b { color: #2f7d5b; } .cover .score.D b { color: var(--red); }
.cover .note { color: var(--muted); font-size: 8.5pt; margin-top: 6pt; text-align: left; }

/* Sumário */
.toc { break-after: page; }
.toc h2 { break-before: auto; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; gap: 4pt; padding: 2.5pt 0; }
.toc li.l2 { font-weight: 600; margin-top: 6pt; }
.toc li.l3 { padding-left: 14pt; color: #33415a; font-size: 9.5pt; }
.toc li .dots { flex: 1; border-bottom: .8pt dotted #b6c0cd; transform: translateY(-3pt); }
.toc li .pg { min-width: 14pt; text-align: right; }

/* Títulos */
h2 { font-size: 16pt; color: var(--navy); margin: 0 0 10pt; padding: 0 0 5pt; border-bottom: 2pt solid var(--navy); margin-top: 16pt; break-after: avoid; }
h2.newpage { break-before: page; margin-top: 0; }
.toc + h2 { margin-top: 0; }
h3 { font-size: 11.5pt; color: var(--navy); margin: 14pt 0 6pt; break-after: avoid; }
h3::before { content: ""; display: inline-block; width: 3pt; height: 10pt; background: var(--navy); margin-right: 6pt; vertical-align: -1pt; }
.keep { break-inside: avoid; }

/* Tabelas */
table { border-collapse: collapse; width: 100%; margin: 4pt 0 10pt; font-size: 8.4pt; line-height: 1.35; }
th { background: var(--navy); color: #fff; font-weight: 600; text-align: left; padding: 4pt 5pt; }
td { border-bottom: .5pt solid var(--rule); padding: 3.5pt 5pt; vertical-align: top; }
tr:nth-child(even) td { background: #f6f8fb; }
tr { break-inside: avoid; }
thead { display: table-header-group; }

/* Listas e destaques */
ul, ol { margin: 0 0 8pt; padding-left: 15pt; }
li { margin: 0 0 3pt; }
blockquote { margin: 6pt 0 10pt; padding: 6pt 10pt; border-left: 3pt solid #a86a12; background: #fff7e8; }

/* Figuras */
figure { margin: 6pt 0 12pt; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 108mm; border: .6pt solid #c3ccd8; border-radius: 2pt; }
figcaption { font-size: 8.4pt; color: var(--muted); margin-top: 3pt; }
figcaption b { color: var(--navy); }
"""


def build_html(page_of=None):
    """Monta o HTML. page_of: {id da seção: página} para o sumário."""
    md = SRC.read_text(encoding="utf-8")
    conv = markdown.Markdown(extensions=["tables", "fenced_code", "attr_list", "md_in_html", "toc"],
                             extension_configs={"toc": {"toc_depth": "2-3"}})
    body = conv.convert(md)

    # Figuras numeradas: <p><img alt src></p> -> <figure> com legenda.
    n = [0]

    def fig(m):
        n[0] += 1
        alt = html.unescape(m.group(1))
        return (f'<figure><img src="{m.group(2)}" alt="{html.escape(alt)}">'
                f'<figcaption><b>Figura {n[0]}.</b> {html.escape(alt)}</figcaption></figure>')

    body = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)"\s*/?></p>', fig, body)

    # Título + primeiro bloco sempre juntos (sem título órfão no pé da página).
    body = re.sub(r'(<h3[^>]*>.*?</h3>)\s*(<(p|table|ul|ol|figure)\b[\s\S]*?</\3>)',
                  r'<div class="keep">\1\2</div>', body)

    # Sumário a partir dos títulos h2/h3.
    items = []
    for tok in conv.toc_tokens:
        items.append((2, tok["id"], tok["name"]))
        for ch in tok.get("children", []):
            items.append((3, ch["id"], ch["name"]))
    toc = "".join(
        f'<li class="l{lvl}"><a href="#{i}">{html.unescape(name)}</a><span class="dots"></span>'
        f'<span class="pg">{(page_of or {}).get(i, "")}</span></li>' for lvl, i, name in items)
    toc_html = f'<section class="toc"><h2 id="sumario">Sumário</h2><ol>{toc}</ol></section>'
    body = body.replace("<!--SUMARIO-->", toc_html)

    HTML.write_text(f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>"
                    f"<title>Sentinela: relatório</title><style>{CSS}</style></head><body>{body}</body></html>",
                    encoding="utf-8")
    return items


def print_pdf(driver):
    driver.get(HTML.as_uri())
    driver.execute_script("return document.fonts.ready")
    po = PrintOptions()
    po.background = True
    po.margin_top = po.margin_bottom = po.margin_left = po.margin_right = 0
    return base64.b64decode(driver.print_page(po))


def pages_of_sections(pdf_bytes, items):
    """Descobre em que página cada título caiu, procurando o texto dele."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    found = {}
    start = 2  # pula capa e sumário
    for lvl, ident, name in items:
        needle = html.unescape(name)[:40]
        for p in range(start, len(doc)):
            if doc[p].search_for(needle):
                found[ident] = p + 1
                start = p
                break
    return found


def add_footer(pdf_bytes):
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    for i, page in enumerate(doc):
        if i == 0:
            continue  # capa sem rodapé
        w, h = page.rect.width, page.rect.height
        y = h - 8 * 2.8346  # 8 mm do pé
        page.draw_line((15 * 2.8346, y - 9), (w - 15 * 2.8346, y - 9), color=(0.84, 0.86, 0.89), width=0.5)
        page.insert_text((15 * 2.8346, y), FOOTER, fontsize=7.5, color=(0.36, 0.42, 0.49))
        label = f"{i + 1} / {total}"
        page.insert_text((w - 15 * 2.8346 - pymupdf.get_text_length(label, fontsize=7.5), y), label,
                         fontsize=7.5, color=(0.36, 0.42, 0.49))
    doc.set_metadata({"title": "Sentinela: detecção e bloqueio de rastreadores no Firefox",
                      "author": "Alex Chequer", "subject": "Avaliação Intermediária de Cibersegurança, Insper"})
    return doc.tobytes(garbage=3, deflate=True)


def main() -> int:
    if not SRC.exists():
        print(f"não encontrei {SRC}", file=sys.stderr)
        return 1
    opts = Options()
    opts.add_argument("-headless")
    opts.binary_location = FIREFOX
    driver = webdriver.Firefox(options=opts)
    try:
        items = build_html()
        first = print_pdf(driver)
        build_html(pages_of_sections(first, items))
        final = print_pdf(driver)
    finally:
        driver.quit()
    PDF.write_bytes(add_footer(final))
    print(f"ok: {PDF} ({PDF.stat().st_size // 1024} KB, {len(pymupdf.open(PDF))} páginas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
