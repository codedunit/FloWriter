"""Screenshot tools/glyphs.html. Usage: python3 tools/shot.py out.png 'query string'"""
import sys, pathlib
from playwright.sync_api import sync_playwright
out, qs = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ''
page_url = (pathlib.Path(__file__).parent / 'glyphs.html').resolve().as_uri() + ('?' + qs if qs else '')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.goto(page_url)
    pg.wait_for_function("document.title==='done'")
    pg.locator('#c').screenshot(path=out)
    b.close()
print(out)
