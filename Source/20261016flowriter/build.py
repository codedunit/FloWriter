"""Build FloWriter.

  python3 build.py

dist/index.html           the site. Host this folder (with config.js) for the pilot.
dist/config.example.js    copy to dist/config.js (or put config.js next to build.py and rebuild)
dist/flowriter-demo.html  the same app as a page fragment, for previews (demo data only)
netlify-drop.zip          just what the live site needs; drag it onto your Netlify site's Deploys page

Without a config.js the app runs on demo data kept in the browser.
"""
import base64, json, pathlib, shutil, sys, zipfile
ROOT = pathlib.Path(__file__).parent
SRC, DIST = ROOT / 'src', ROOT / 'dist'
sys.path.insert(0, str(ROOT / 'tools'))
from assemble import engine_html

JS = ['letters.js', 'cursive.js', 'curriculum.js', 'site.js', 'data.js', 'music.js', 'backend.js',
      'app-core.js', 'app-public.js', 'app-teacher.js', 'app-student.js', 'app-boot.js']

def js_str(text):
    return json.dumps(text, ensure_ascii=False).replace('</', '<\\/').replace('<!--', '<\\!--')

def build():
    DIST.mkdir(exist_ok=True)
    themes = {f.stem: 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted((SRC / 'themes').glob('*.webp'))}
    code = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in JS)
    vendor = '<script>\n' + (SRC / 'vendor' / 'qrcode.js').read_text(encoding='utf-8').replace('</', '<\\/') + '\n</script>\n'
    script = vendor + ('<script>\n"use strict";\n'
              f'const ENGINE = {js_str(engine_html())};\n'
              f'const THEME_IMG = {json.dumps(themes)};\n'
              f'{code}\n</script>\n')
    shell = (SRC / 'shell.html').read_text(encoding='utf-8')
    has_config = (ROOT / 'config.js').exists()
    config_tag = '<script src="config.js"></script>\n'
    # Fragment for previews: always demo data
    (DIST / 'flowriter-demo.html').write_text(shell + '\n' + script, encoding='utf-8')
    # Standalone site: loads config.js if it is deployed next to index.html
    head, _, body = shell.partition('</style>')
    page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="description" content="FloWriter: cursive handwriting practice written to the beat.">\n'
            f'{head}</style>\n</head>\n<body>\n{body}\n'
            '<script>window.FLOWRITER_CONFIG=null;</script>\n' + config_tag + script + '</body>\n</html>\n')
    (DIST / 'index.html').write_text(page, encoding='utf-8')
    for f in ['schema.sql', 'config.example.js', 'SETUP.md'] + (['config.js'] if has_config else []):
        if (ROOT / f).exists(): shutil.copy(ROOT / f, DIST / f)
    shutil.copytree(SRC / 'photos', DIST / 'photos', dirs_exist_ok=True)  # team photos on the homepage
    # One file for Netlify drag-and-drop: index.html at the zip's root, no setup notes or schema on the public site
    site = ['index.html', 'config.js'] + [f'photos/{p.name}' for p in sorted((DIST / 'photos').iterdir())]
    with zipfile.ZipFile(ROOT / 'netlify-drop.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for f in site:
            if (DIST / f).exists(): z.write(DIST / f, f)
    print(f'dist/index.html {len(page) // 1024} KB' + (' (with config.js)' if has_config else ' (demo data until config.js is added)'))

if __name__ == '__main__':
    build()
