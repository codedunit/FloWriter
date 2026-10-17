"""Assert every writing-surface theme stays readable.

The feedback colours carry meaning: `ok` marks ink on the path, `bad` marks it
off the path. If either washes out against the surface, or the two cannot be
told apart, the theme is not just ugly, it stops the app teaching.

Thresholds are WCAG's, for the kind of thing being measured: strokes and rule
lines are large graphics, not body text, so 3:1 is the bar for the feedback
colours (SC 1.4.11 Non-text Contrast) and 4.5:1 is kept for the child's own
ink, which is the thing they actually read back.

It also measures how far apart `ok` and `bad` stay for a red-green colour-blind
child, and holds every theme to better than the app's own plain-paper palette,
which is weak on exactly that axis.

    python3 check_contrast.py
"""
import sys

# the app's own :root palettes, reported as the point of comparison
BASE = {
    'plain paper': dict(sheet='#FBFCFF', ink='#1B2440', rule='#9DB6E0', ok='#17915F', bad='#D63A32'),
    'paper, dark': dict(sheet='#141B2E', ink='#E6EBF6', rule='#3E5690', ok='#3CCB8E', bad='#FF6B61'),
}
MIN = dict(ink=4.5, ok=3.0, bad=3.0, rule=1.5)
KEYS = ['ink', 'ok', 'bad', 'rule']


def srgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lin(c):
    c /= 255
    return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4


def lum(h):
    r, g, b = (lin(c) for c in srgb(h))
    return .2126 * r + .7152 * g + .0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def deuter(h):
    """Simulate deuteranopia, the common red-green type (Viénot/Brettel)."""
    r, g, b = (lin(c) for c in srgb(h))
    L = 17.8824 * r + 43.5161 * g + 4.11935 * b
    M = 3.45565 * r + 27.1554 * g + 3.86714 * b          # noqa: F841 (kept for clarity)
    S = 0.0299566 * r + 0.184309 * g + 1.46709 * b
    M2 = 0.494207 * L + 1.24827 * S                      # deuteranope: M inferred from L and S
    return [max(0., min(1., v)) for v in (
        0.080944 * L - 0.130504 * M2 + 0.116721 * S,
        -0.0102485 * L + 0.0540194 * M2 - 0.113615 * S,
        -0.000365294 * L - 0.00412163 * M2 + 0.693513 * S)]


def apart(a, b):
    """How far apart two colours stay for a deuteranope. 0 = indistinguishable."""
    return sum((x - y) ** 2 for x, y in zip(deuter(a), deuter(b))) ** .5


def row(name, p):
    vals = {k: ratio(p[k], p['sheet']) for k in KEYS}
    cb = apart(p['ok'], p['bad'])
    print(f'{name:13s} ' + ' '.join(f'{vals[k]:6.2f}' for k in KEYS) + f' {cb:9.3f}')
    return vals, cb


def main():
    print(f'{"":13s} ' + ' '.join(f'{k:>6}' for k in KEYS) + f' {"colour-blind":>9}')
    base_cb = []
    for name, p in BASE.items():
        _v, cb = row(name, p)
        base_cb.append(cb)
    floor_cb = max(base_cb)
    print('   (the app\'s own palettes, for comparison)\n')

    from skin_themes import THEMES
    fails = []
    for name, (_label, _img, p) in THEMES.items():
        vals, cb = row(name, p)
        for k in KEYS:
            if vals[k] < MIN[k]:
                fails.append(f'  {name}.{k} = {vals[k]:.2f}, needs {MIN[k]}')
        if cb < floor_cb:
            fails.append(f'  {name}: ok/bad separate worse under colour blindness '
                         f'({cb:.3f}) than the app\'s own palette ({floor_cb:.3f})')

    print(f'\nfloors: ' + '  '.join(f'{k}>={MIN[k]}' for k in KEYS) +
          f'  colour-blind>={floor_cb:.3f}')
    if fails:
        print('\nFAIL:\n' + '\n'.join(fails)); sys.exit(1)
    print('all themes pass')
    print('\nNote: every theme separates ok/bad better than plain paper does, but all of\n'
          'them still lean on colour. A second cue for off-path strokes (dashes, weight)\n'
          'would be the real fix, and that is a change to the feedback itself, not a theme.')


if __name__ == '__main__':
    main()
