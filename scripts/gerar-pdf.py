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
@page { size: A4; margin: 20mm 20mm 20mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; }
p { margin: 0 0 8pt; text-align: left; }
a { color: inherit; text-decoration: none; }
code { font: 9pt Menlo, monospace; overflow-wrap: anywhere; }

/* Primeira página: título + sumário */
.title { margin-bottom: 14pt; }
.title h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 6pt; }
.title .sub { font-size: 11pt; color: #444; margin: 0 0 12pt; }
.title .info { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 0 0 10pt; }
.title .info td { border: 0; border-top: .5pt solid #ccc; padding: 4pt 0; background: none; }
.title .info tr:last-child td { border-bottom: .5pt solid #ccc; }
.title .info td:first-child { width: 28mm; color: #555; }
.toc { break-after: page; }
.toc h2 { margin-top: 10pt; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; padding: 1.5pt 0; margin: 0; }
.toc li.l2 { font-weight: bold; margin-top: 5pt; }
.toc li.l3 { padding-left: 12pt; }
.toc li .dots { flex: 1; border-bottom: .7pt dotted #999; margin: 0 4pt; transform: translateY(-3pt); }
.toc li .pg { min-width: 12pt; text-align: right; }

/* Títulos */
h2 { font-size: 15pt; margin: 18pt 0 8pt; padding-bottom: 3pt; border-bottom: .8pt solid #333; break-after: avoid; }
h2.newpage { break-before: page; margin-top: 0; }
h3 { font-size: 12pt; margin: 14pt 0 6pt; break-after: avoid; }
.keep { break-inside: avoid; }

/* Tabelas */
table { border-collapse: collapse; width: 100%; margin: 4pt 0 12pt; font-size: 9pt; line-height: 1.35; }
th, td { border: .5pt solid #bbb; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #eee; font-weight: bold; }
tr { break-inside: avoid; }
thead { display: table-header-group; }

/* Listas */
ul, ol { margin: 0 0 8pt; padding-left: 16pt; }
li { margin: 0 0 3pt; }

/* Figuras */
figure { margin: 8pt 0 14pt; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 100mm; border: .5pt solid #999; }
figcaption { font-size: 9pt; color: #444; margin-top: 3pt; }
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
                f'<figcaption>Figura {n[0]}: {html.escape(alt)}</figcaption></figure>')

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
    po.margin_top = po.margin_bottom = po.margin_left = po.margin_right = 0  # margens vêm do @page
    return base64.b64decode(driver.print_page(po))


def pages_of_sections(pdf_bytes, items):
    """Descobre em que página cada título caiu, procurando o texto dele."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    found = {}
    start = 1  # pula a página de título e sumário
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
        w, h = page.rect.width, page.rect.height
        y = h - 10 * 2.8346  # 10 mm do pé
        page.insert_text((20 * 2.8346, y), FOOTER, fontsize=7.5, color=(0.36, 0.42, 0.49))
        label = f"{i + 1} / {total}"
        page.insert_text((w - 20 * 2.8346 - pymupdf.get_text_length(label, fontsize=7.5), y), label,
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
