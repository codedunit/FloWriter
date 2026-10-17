"""Generate the pixel-art room backgrounds for the writing-surface themes.

Drawn in code at 256x160 and upscaled 4x with nearest-neighbour, so the chunky
pixels are baked into the file and do not depend on browser image-rendering.
Output is WebP, a few KB each. Everything here is original, which matters:
art pulled off the web cannot ship in something shown to schools.

The board covers the middle of the frame, so each scene is composed for its
outer ring: something readable along the top, the floor along the bottom, and
silhouettes down the sides.

    python3 gen_art.py
"""
import pathlib, random
from PIL import Image, ImageDraw, ImageFilter

W, H, UP = 256, 160, 4
OUT = pathlib.Path(__file__).parent / 'themes'
OUT.mkdir(exist_ok=True)


# ---------------------------------------------------------------- primitives
def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def vgrad(d, box, c0, c1, dither=True):
    """Vertical gradient with a touch of ordered dithering for banding charm."""
    x0, y0, x1, y1 = box
    span = max(1, y1 - y0)
    for y in range(y0, y1):
        t = (y - y0) / span
        base = mix(c0, c1, t)
        if not dither:
            d.line([(x0, y), (x1 - 1, y)], fill=base)
            continue
        hi = mix(c0, c1, min(1, t + 1 / span))
        for x in range(x0, x1):
            on = BAYER[y & 3][x & 3] / 16 < (t * span % 1)
            d.point((x, y), fill=hi if on else base)


def stars(d, box, n, cols, seed):
    r = random.Random(seed)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y = r.randrange(x0, x1), r.randrange(y0, y1)
        c = cols[r.randrange(len(cols))]
        d.point((x, y), fill=c)
        if r.random() < .07:                      # a few brighter cross-twinkles
            d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=mix(c, (255, 255, 255), .4))


def speckle(d, box, cols, density, seed):
    r = random.Random(seed)
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            if r.random() < density:
                d.point((x, y), fill=cols[r.randrange(len(cols))])


def planks(d, box, c, cdark, cline, step, seed, vertical=False):
    x0, y0, x1, y1 = box
    d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=c)
    r = random.Random(seed)
    rng = range(x0, x1, step) if vertical else range(y0, y1, step)
    for p in rng:
        if vertical:
            d.line([(p, y0), (p, y1 - 1)], fill=cline)
            for y in range(y0, y1):
                if r.random() < .12:
                    d.point((p + 1 + r.randrange(max(1, step - 2)), y), fill=cdark)
        else:
            d.line([(x0, p), (x1 - 1, p)], fill=cline)
            for x in range(x0, x1):
                if r.random() < .12:
                    d.point((x, p + 1 + r.randrange(max(1, step - 2))), fill=cdark)


def leafy(d, box, cols, n, rad, seed):
    """Blobby foliage: overlapping discs in a few tones."""
    r = random.Random(seed)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y = r.randrange(x0, x1), r.randrange(y0, y1)
        rr = r.randrange(rad[0], rad[1])
        c = cols[r.randrange(len(cols))]
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c)


def vignette(img, strength=.55):
    """Darken the edges so the board reads as the lit focus of the room."""
    m = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(m)
    md.ellipse([-W // 3, -H // 2, W + W // 3, H + H // 2], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(26))
    dark = Image.new('RGB', (W, H), (0, 0, 0))
    return Image.composite(img, Image.blend(img, dark, strength), m)


def new():
    img = Image.new('RGB', (W, H), (0, 0, 0))
    return img, ImageDraw.Draw(img)


# ---------------------------------------------------------------- the scenes
def space():
    """Observation deck: a station interior looking out at a planet."""
    img, d = new()
    vgrad(d, (0, 0, W, H), rgb('0b1026'), rgb('05080f'))
    stars(d, (0, 0, W, H), 150, [rgb('ffffff'), rgb('cfe3ff'), rgb('8fa8d8'), rgb('6d7fa8')], 7)
    # planet, cropped off the lower right
    cx, cy, R = 198, 132, 62
    bands = ['c97b4a', 'b9683f', 'd79a62', 'a85a36', 'e0ae7a']
    for y in range(cy - R, H):
        dx = int((R * R - (y - cy) ** 2) ** .5) if abs(y - cy) < R else 0
        if dx:
            d.line([(cx - dx, y), (cx + dx, y)], fill=rgb(bands[((y - cy + R) // 7) % len(bands)]))
    for y in range(cy - R, H):                                  # night-side terminator
        dx = int((R * R - (y - cy) ** 2) ** .5) if abs(y - cy) < R else 0
        for x in range(cx - dx, cx + dx):
            t = max(0, min(1, (cx - 26 - x) / 46))
            if t > 0:
                d.point((x, y), fill=mix(img.getpixel((x, y)), rgb('0d1020'), t * .85))
    # interior framing: side pillars, ceiling light strip, grated floor
    for px0, px1 in [(0, 30), (W - 30, W)]:
        vgrad(d, (px0, 0, px1, H), rgb('4a5664'), rgb('222a34'))
        d.line([(px0 + 24 if px0 == 0 else px1 - 25, 0),
                (px0 + 24 if px0 == 0 else px1 - 25, H)], fill=rgb('6c7b8c'))
        for y in range(8, H, 18):                               # rivets
            d.point([(px0 + 7, y), (px0 + 8, y)] if px0 == 0 else [(px1 - 8, y), (px1 - 9, y)],
                    fill=rgb('8e9eae'))
    vgrad(d, (0, 0, W, 16), rgb('2b333d'), rgb('161c24'))
    d.rectangle([34, 5, W - 35, 8], fill=rgb('bfe6ff'))
    d.rectangle([34, 9, W - 35, 10], fill=rgb('5d93b8'))
    planks(d, (0, H - 22, W, H), rgb('2f3842'), rgb('242c35'), rgb('455161'), 7, 3)
    d.rectangle([0, H - 23, W, H - 22], fill=rgb('5a6878'))
    return vignette(img, .35)


def treehouse():
    """Up in the canopy: trunks at the sides, leaves above, planks below."""
    img, d = new()
    vgrad(d, (0, 0, W, H), rgb('bfe3c8'), rgb('6fa37c'))         # hazy daylight
    leafy(d, (-10, -6, W + 10, 64), [rgb('2f5a34'), rgb('3c7340'), rgb('27492c'), rgb('4b8a4e')], 170, (7, 20), 11)
    leafy(d, (-10, 44, W + 10, 76), [rgb('27492c'), rgb('356236')], 70, (6, 15), 12)
    speckle(d, (0, 10, W, 70), [rgb('7fc07a'), rgb('a8d98f')], .02, 13)   # sun through leaves
    for tx0, tx1 in [(0, 26), (W - 24, W)]:                      # trunks
        vgrad(d, (tx0, 0, tx1, H), rgb('6b4a30'), rgb('3f2b1b'))
        r = random.Random(tx0 + 5)
        for _ in range(130):
            x, y = r.randrange(tx0, tx1), r.randrange(0, H)
            d.line([(x, y), (x, y + r.randrange(3, 11))], fill=rgb('54381f') if r.random() < .6 else rgb('7d5839'))
    planks(d, (0, H - 30, W, H), rgb('8a6440'), rgb('6e4e30'), rgb('5a3f26'), 9, 17)
    d.rectangle([0, H - 31, W, H - 29], fill=rgb('a67c50'))
    r = random.Random(21)
    for x in range(6, W, 9):                                     # nail heads
        d.point((x, H - 30 + 4 + r.randrange(3)), fill=rgb('4a3421'))
    for i, x in enumerate(range(30, W - 26, 46)):                # hanging vines
        yl = 70 + (i % 3) * 14
        d.line([(x, 0), (x, yl)], fill=rgb('2f5a34'))
        d.point([(x - 1, yl), (x + 1, yl - 3)], fill=rgb('4b8a4e'))
    return vignette(img, .4)


def submarine():
    """Below the surface: light shafts, reef silhouettes, a brass rim."""
    img, d = new()
    vgrad(d, (0, 0, W, H), rgb('1d7f92'), rgb('041f2b'))
    for i, x in enumerate(range(-40, W + 40, 34)):               # god rays
        for k in range(11):
            xx = x + k + int(i * 1.5)
            for y in range(0, H):
                if 0 <= xx + y // 3 < W:
                    p = img.getpixel((xx + y // 3, y))
                    d.point((xx + y // 3, y), fill=mix(p, rgb('bff0ff'), .07 * (1 - y / H)))
    r = random.Random(31)
    for _ in range(110):                                         # bubbles
        x, y = r.randrange(W), r.randrange(H)
        d.point((x, y), fill=rgb('9fe4f2'))
        if r.random() < .3:
            d.point((x + 1, y), fill=rgb('6fc0d4'))
    d.rectangle([0, H - 26, W, H], fill=rgb('0a2b36'))           # sea floor
    speckle(d, (0, H - 26, W, H), [rgb('14404e'), rgb('0d323e')], .3, 33)
    for cx, cw, ch, c in [(18, 26, 34, '0c3a44'), (54, 18, 22, '0a2f38'), (W - 30, 30, 40, '0c3a44'),
                          (W - 62, 16, 20, '0a2f38'), (120, 14, 16, '0a2f38')]:
        d.ellipse([cx - cw // 2, H - 26 - ch, cx + cw // 2, H - 26 + 8], fill=rgb(c))
    for i, x in enumerate([8, 34, 64, W - 14, W - 44, W - 74]):  # kelp
        amp, top = 3 + i % 3, H - 26 - 34 - (i % 4) * 10
        for y in range(top, H - 20):
            d.point((x + int(amp * __import__('math').sin(y / 7 + i)), y), fill=rgb('13564f'))
            d.point((x + 1 + int(amp * __import__('math').sin(y / 7 + i)), y), fill=rgb('1a6e60'))
    return vignette(img, .3)


def study():
    """Candlelit study: shelves of books, a warm desk, a parchment surface."""
    img, d = new()
    vgrad(d, (0, 0, W, H), rgb('3a2a1c'), rgb('1a120b'))
    r = random.Random(41)
    spines = ['7a3b2e', '5c4a2a', '34503f', '46355c', '7a5a2a', '2f4a5c', '6b2f3a']
    for sy in range(8, H - 44, 26):                              # shelves both sides
        for x0, x1 in [(2, 42), (W - 42, W - 2)]:
            d.rectangle([x0, sy + 20, x1, sy + 23], fill=rgb('4a3522'))
            x = x0 + 1
            while x < x1 - 2:
                bw = r.randrange(3, 7)
                bh = r.randrange(13, 20)
                d.rectangle([x, sy + 20 - bh, x + bw - 1, sy + 19], fill=rgb(spines[r.randrange(len(spines))]))
                if r.random() < .5:
                    d.line([(x, sy + 20 - bh + 2), (x + bw - 1, sy + 20 - bh + 2)], fill=rgb('c9a96a'))
                x += bw + 1
    planks(d, (0, H - 30, W, H), rgb('4a3423'), rgb('39281a'), rgb('2d1f14'), 10, 43)   # desk
    d.rectangle([0, H - 31, W, H - 29], fill=rgb('6b4e32'))
    cx = 24                                                      # candle, and its glow
    d.rectangle([cx - 3, H - 26, cx + 3, H - 12], fill=rgb('e8ddc0'))
    d.rectangle([cx - 5, H - 12, cx + 5, H - 9], fill=rgb('8a6a3a'))
    d.point([(cx, H - 29), (cx, H - 28)], fill=rgb('fff3c0'))
    d.ellipse([cx - 2, H - 32, cx + 2, H - 27], fill=rgb('ffd166'))
    for rr in range(34, 6, -4):
        for y in range(max(0, H - 30 - rr), min(H, H - 20 + rr)):
            for x in range(max(0, cx - rr), min(W, cx + rr)):
                if (x - cx) ** 2 + (y - (H - 28)) ** 2 < rr * rr:
                    d.point((x, y), fill=mix(img.getpixel((x, y)), rgb('ffc46b'), .035))
    d.ellipse([W - 40, H - 24, W - 26, H - 10], fill=rgb('241a12'))   # inkpot
    d.rectangle([W - 35, H - 28, W - 31, H - 22], fill=rgb('120d09'))
    return vignette(img, .42)


def studio():
    """Sunlit art studio: a window, plank floor, jars of brushes. Light surface."""
    img, d = new()
    vgrad(d, (0, 0, W, H), rgb('efe3cf'), rgb('d6c4a8'))
    d.rectangle([6, 14, 70, 96], fill=rgb('8fbcd8'))             # window onto sky
    vgrad(d, (6, 14, 70, 96), rgb('bfe2f2'), rgb('7fb0cf'))
    leafy(d, (8, 62, 68, 96), [rgb('6f9a5e'), rgb('84ae6c')], 22, (5, 12), 51)
    for x in range(6, 71, 21):
        d.rectangle([x, 14, x + 2, 96], fill=rgb('f6efe2'))
    d.rectangle([6, 52, 70, 54], fill=rgb('f6efe2'))
    d.rectangle([3, 11, 73, 13], fill=rgb('f6efe2'))
    d.rectangle([3, 96, 73, 100], fill=rgb('e2d3ba'))
    for i in range(44):                                          # light spill on the floor
        d.polygon([(74, 100 + i), (74 + i * 2, 100 + i), (74 + i * 3, 101 + i), (74, 101 + i)],
                  fill=mix(rgb('d6c4a8'), rgb('fff6e0'), .5 - i / 110))
    planks(d, (0, H - 34, W, H), rgb('b08a5c'), rgb('96733f'), rgb('8a6940'), 11, 53)
    d.rectangle([0, H - 35, W, H - 33], fill=rgb('c49b68'))
    tx = W - 54                                                  # side table with jars
    d.rectangle([tx, H - 44, W - 4, H - 40], fill=rgb('7a5a3a'))
    d.rectangle([tx + 4, H - 40, tx + 8, H - 12], fill=rgb('6b4e32'))
    d.rectangle([W - 12, H - 40, W - 8, H - 12], fill=rgb('6b4e32'))
    for i, (jx, jc) in enumerate([(tx + 8, 'cfe4ef'), (tx + 24, 'e8dcc4'), (tx + 38, 'cfe4ef')]):
        d.rectangle([jx, H - 60, jx + 11, H - 44], fill=rgb(jc))
        for k, bc in enumerate(['b3432f', '2e7d4f', '2b5c8a', 'd98a2b']):
            if (k + i) % 2:
                d.line([(jx + 2 + k * 3, H - 60), (jx + 3 + k * 3, H - 74)], fill=rgb(bc))
    r = random.Random(57)
    for _ in range(34):                                          # paint flecks
        x, y = r.randrange(W), r.randrange(H - 32, H)
        d.point((x, y), fill=rgb(['b3432f', '2e7d4f', '2b5c8a', 'd98a2b'][r.randrange(4)]))
    return vignette(img, .3)


def campfire():
    """Night camp: constellations, pines on the horizon, a fire below."""
    img, d = new()
    vgrad(d, (0, 0, W, H), rgb('11183a'), rgb('2a2550'))
    stars(d, (0, 0, W, 108), 170, [rgb('ffffff'), rgb('d6dcff'), rgb('9aa6d8')], 61)
    con = [(38, 18), (56, 28), (74, 20), (92, 34), (104, 22)]    # a drawn constellation
    for a, b in zip(con, con[1:]):
        d.line([a, b], fill=rgb('5d6aa8'))
    for p in con:
        d.ellipse([p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1], fill=rgb('ffffff'))
    d.ellipse([W - 52, 14, W - 20, 46], fill=rgb('f2eed8'))      # moon
    d.ellipse([W - 46, 18, W - 24, 40], fill=rgb('fbf8ea'))
    r = random.Random(63)
    for x in range(-6, W + 8, 7):                                # pine horizon
        h = r.randrange(22, 44)
        base = 112 + r.randrange(0, 5)
        d.polygon([(x, base), (x + 7, base), (x + 3, base - h)], fill=rgb('0e1b22'))
    d.rectangle([0, 112, W, H], fill=rgb('0b1419'))
    speckle(d, (0, 112, W, H), [rgb('13222a'), rgb('0e1a20')], .22, 65)
    fx, fy = 40, H - 16                                          # fire + its light
    for rr in range(40, 4, -4):
        for y in range(max(112, fy - rr), min(H, fy + rr)):
            for x in range(max(0, fx - rr), min(W, fx + rr)):
                if (x - fx) ** 2 + (y - fy) ** 2 < rr * rr:
                    d.point((x, y), fill=mix(img.getpixel((x, y)), rgb('ff9a3c'), .045))
    for dx, c in [(-9, '5a3f28'), (-3, '6b4a30'), (4, '5a3f28')]:
        d.line([(fx + dx, fy + 3), (fx + dx + 7, fy - 2)], fill=rgb(c))
    d.polygon([(fx - 6, fy), (fx + 6, fy), (fx, fy - 15)], fill=rgb('ff7a1c'))
    d.polygon([(fx - 3, fy), (fx + 3, fy), (fx, fy - 9)], fill=rgb('ffd166'))
    for _ in range(16):                                          # embers
        d.point((fx + r.randrange(-12, 13), fy - r.randrange(10, 40)), fill=rgb('ffb347'))
    return vignette(img, .28)


SCENES = {'space': space, 'treehouse': treehouse, 'submarine': submarine,
          'study': study, 'studio': studio, 'campfire': campfire}

if __name__ == '__main__':
    for name, fn in SCENES.items():
        img = fn().resize((W * UP, H * UP), Image.NEAREST)
        p = OUT / f'{name}.webp'
        img.save(p, 'WEBP', quality=82, method=6)
        img.save(OUT / f'{name}.png')          # kept for editing, not shipped
        print(f'{name:10s} {p.stat().st_size / 1024:6.1f} KB')
