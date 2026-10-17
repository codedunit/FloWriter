"""Bundle the FloWriter demo.

dist/index.html        artifact page (fragment: the host adds doctype/head/body)
dist/flowriter.html    standalone copy you can open straight from disk
The two engine files are embedded byte-for-byte and are also copied next to it unchanged.

Engine sources are read from this folder. Pass --uploads to read them from
/mnt/user-data/uploads instead, which is where the earlier build expected them.
"""
import json, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).parent
SRC, DIST = ROOT / 'src', ROOT / 'dist'
ENGINES = pathlib.Path('/mnt/user-data/uploads') if '--uploads' in sys.argv else ROOT
DIST.mkdir(exist_ok=True)

def js_str(text):
    return json.dumps(text, ensure_ascii=False).replace('</', '<\\/').replace('<!--', '<\\!--')

assignment = (ENGINES / 'FinalFWAssignment.html').read_text(encoding='utf-8')
freeplay = (ENGINES / 'FinalFWFreePlay.html').read_text(encoding='utf-8')
bridge = (SRC / 'bridge.js').read_text(encoding='utf-8')
shell = (SRC / 'shell.html').read_text(encoding='utf-8')
# backend.js sits between data.js and app.js: it overrides api.* when a config is present
code = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in ['data.js', 'music.js', 'backend.js', 'app.js'])

script = ('<script>\n// The two core engine pages, unchanged. They run inside the shell with a small bridge.\n'
          f'const ENGINE_ASSIGNMENT = {js_str(assignment)};\n'
          f'const ENGINE_FREEPLAY = {js_str(freeplay)};\n'
          f'const BRIDGE = {js_str(bridge)};\n'
          f'{code}\n</script>\n')
# config.js is optional and loads first; without it the app uses the demo data.
# The tag is only emitted when the file exists, so the demo build stays clean.
has_config = (ROOT / 'config.js').exists()
config_tag = '<script src="config.js"></script>\n' if has_config else ''
page = shell + '\n' + config_tag + script
(DIST / 'index.html').write_text(page, encoding='utf-8')

head, _, body = shell.partition('</style>')
standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              f'{head}</style>\n</head>\n<body>\n{body}\n{config_tag}{script}</body>\n</html>\n')
(DIST / 'flowriter.html').write_text(standalone, encoding='utf-8')
for f in ['FinalFWAssignment.html', 'FinalFWFreePlay.html']:
    shutil.copy(ENGINES / f, DIST / f)
for f in ['schema.sql', 'config.example.js', 'SETUP.md'] + (['config.js'] if has_config else []):
    if (ROOT / f).exists():
        shutil.copy(ROOT / f, DIST / f)
print('index.html', len(page) // 1024, 'KB')
