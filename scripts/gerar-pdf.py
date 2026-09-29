"""Gera docs/relatorio.pdf a partir de docs/relatorio.md.

Markdown -> HTML (com os prints de evidencias/ embutidos por caminho relativo)
-> Firefox headless "imprimir em PDF" via Selenium. Não depende de pandoc.

Uso (na raiz do repositório):
    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python scripts/gerar-pdf.py
"""
import base64
import pathlib
import sys

import markdown
from selenium import webdriver
from selenium.webdriver.common.print_page_options import PrintOptions
from selenium.webdriver.firefox.options import Options

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "relatorio.md"
HTML = ROOT / "docs" / "relatorio.html"
PDF = ROOT / "docs" / "relatorio.pdf"
FIREFOX = "/Applications/Firefox.app/Contents/MacOS/firefox"

CSS = """
@page { size: A4; margin: 16mm 14mm; }
body { font: 10.5pt/1.45 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1b2330; }
h1 { font-size: 20pt; color: #1d3a6e; margin: 0 0 4pt; }
h2 { font-size: 15pt; color: #1d3a6e; border-bottom: 1.5pt solid #1d3a6e; padding-bottom: 2pt; margin-top: 18pt; break-after: avoid; }
h3 { font-size: 12pt; color: #1d3a6e; margin-top: 12pt; break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 8.8pt; }
th, td { border: 0.5pt solid #c9d1dc; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #eef1f4; }
tr { break-inside: avoid; }
code { font-size: 8.8pt; background: #eef1f4; padding: 0 2pt; border-radius: 2pt; overflow-wrap: anywhere; }
img { max-width: 100%; border: 0.5pt solid #c9d1dc; margin: 4pt 0; }
figure { margin: 8pt 0; break-inside: avoid; }
figcaption { font-size: 8.5pt; color: #5d6b7e; }
blockquote { margin: 6pt 0; padding: 4pt 10pt; border-left: 3pt solid #a86a12; background: #fff7e8; }
"""


def main() -> int:
    if not SRC.exists():
        print(f"não encontrei {SRC}", file=sys.stderr)
        return 1
    body = markdown.markdown(SRC.read_text(encoding="utf-8"), extensions=["tables", "fenced_code", "attr_list", "md_in_html"])
    HTML.write_text(f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><title>Relatório Sentinela</title><style>{CSS}</style></head><body>{body}</body></html>", encoding="utf-8")

    opts = Options()
    opts.add_argument("-headless")
    opts.binary_location = FIREFOX
    driver = webdriver.Firefox(options=opts)
    try:
        driver.get(HTML.as_uri())
        po = PrintOptions()
        po.background = True
        po.shrink_to_fit = True
        PDF.write_bytes(base64.b64decode(driver.print_page(po)))
    finally:
        driver.quit()
    print(f"ok: {PDF} ({PDF.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
