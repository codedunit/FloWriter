"""Assemble the engine page: letters + theme images inlined. Used by build.py and the tests."""
import base64, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
def engine_html():
    s = (ROOT / 'src' / 'engine.html').read_text(encoding='utf-8')
    s = s.replace('/*__LETTERS__*/', (ROOT / 'src' / 'letters.js').read_text(encoding='utf-8'))
    for f in sorted((ROOT / 'src' / 'themes').glob('*.webp')):
        s = s.replace(f'__THEME_{f.stem}__', 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode())
    assert '__THEME_' not in s and '__LETTERS__' not in s
    return s
