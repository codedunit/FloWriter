"""Writing-surface themes for both engine pages.

Purely cosmetic. Each theme is a palette plus one background image; no
mechanic, scoring rule or layout number changes.

How it stays contained: the canvas reads its colours from CSS custom
properties, so each palette is scoped to `.stage` rather than `:root`, and
readColors() is pointed at the canvas instead of the document root. The page
chrome (headings, mode cards, settings, results panels) keeps its normal
light/dark styling. Elements that live inside the stage, like the HUD pills
and the pager, pick the theme up for free by inheritance.

Why the frame is a border and not padding: layout() sizes the canvas backing
store to the stage's content box. Padding would make stage.clientWidth
disagree with the width the canvas actually renders at, which is exactly the
bug that put the ink to the right of the pointer. Borders are excluded from
clientWidth, so a border-based frame keeps the geometry identical to the
unskinned page. See fix_canvas_width.py, which hardens the same thing.

Run after fix_canvas_width.py, on clean engine source:
    python3 skin_themes.py
"""
import base64, pathlib

ROOT = pathlib.Path(__file__).parent
ART = ROOT / 'artwork'
FILES = ['FinalFWAssignment.html', 'FinalFWFreePlay.html']

# name -> (label, background file, palette)
# `sheet` is the writing surface, `ink` the child's line, `ok`/`bad` the
# on-path / off-path feedback. Those three have to stay legible on `sheet` in
# every theme: check_contrast.py asserts it.
THEMES = {
    'classroom': ('Classroom', ART / 'classroom-room.webp', dict(
        sheet='#32473C', ink='#EDF4EE', muted='#A6BCAE', line='#4A6355', surface='rgba(27,40,33,.86)',
        rule='#8CAC9C', rule_soft='#60806F', margin='#D59A95',
        accent='#FFD166', accent_ink='#FFE09A', accent_wash='rgba(255,209,102,.20)',
        graphite='#F4F9F5', ok='#7BE8B4', bad='#E8683A', missed='#9BB1A4',
        band='rgba(170,215,255,.13)', frame='#5C4639', frame_lit='#7A5E4C', tray='#885644',
        wash='rgba(14,20,16,.34)', wash2='rgba(14,20,16,.50)')),

    'space': ('Space station', ART / 'themes/space.webp', dict(
        sheet='#0E1D33', ink='#CFEFFF', muted='#7FA3BF', line='#27476B', surface='rgba(10,24,42,.86)',
        rule='#2F5F86', rule_soft='#22425E', margin='#E08A9A',
        accent='#7DD3FC', accent_ink='#BDE9FF', accent_wash='rgba(125,211,252,.20)',
        graphite='#E8F7FF', ok='#6EE7B7', bad='#E8703A', missed='#6C8CA6',
        band='rgba(125,211,252,.12)', frame='#44525F', frame_lit='#6B7C8D', tray='#2C3742',
        wash='rgba(6,12,24,.10)', wash2='rgba(6,12,24,.30)')),

    'treehouse': ('Treehouse', ART / 'themes/treehouse.webp', dict(
        sheet='#2E3A26', ink='#F2F7E6', muted='#A8BC95', line='#4A5B3C', surface='rgba(26,34,20,.86)',
        rule='#8FA87A', rule_soft='#62764F', margin='#E0A07E',
        accent='#FFD98A', accent_ink='#FFE9B8', accent_wash='rgba(255,217,138,.20)',
        graphite='#F6FAEC', ok='#A8E86A', bad='#E86B2E', missed='#94A683',
        band='rgba(255,240,180,.12)', frame='#6B4F35', frame_lit='#8A6845', tray='#7A5A3C',
        wash='rgba(12,20,10,.10)', wash2='rgba(12,20,10,.30)')),

    'submarine': ('Submarine', ART / 'themes/submarine.webp', dict(
        sheet='#07222B', ink='#B6F5E8', muted='#74A8AA', line='#14434E', surface='rgba(5,26,33,.86)',
        rule='#2E6B72', rule_soft='#1E4C55', margin='#F09AA6',
        accent='#FFD98A', accent_ink='#FFECC0', accent_wash='rgba(255,217,138,.20)',
        graphite='#D8FFF6', ok='#5FE3C0', bad='#F0734A', missed='#5F8A8C',
        band='rgba(150,240,255,.12)', frame='#8A6A3A', frame_lit='#B08A4E', tray='#6B5230',
        wash='rgba(2,18,24,.08)', wash2='rgba(2,18,24,.30)')),

    'study': ('Wizard study', ART / 'themes/study.webp', dict(
        sheet='#EFE3C6', ink='#3A2A18', muted='#8A7556', line='#C9B48A', surface='rgba(248,240,220,.90)',
        rule='#B29A6C', rule_soft='#DCCCA8', margin='#B0725F',
        accent='#8A5A2B', accent_ink='#6B4520', accent_wash='rgba(138,90,43,.18)',
        graphite='#2E2114', ok='#13492E', bad='#E05030', missed='#A8906A',
        band='rgba(138,90,43,.10)', frame='#4A3425', frame_lit='#6A4E36', tray='#3B2A1C',
        wash='rgba(20,12,6,.10)', wash2='rgba(20,12,6,.30)')),

    'studio': ('Art studio', ART / 'themes/studio.webp', dict(
        sheet='#F5F0E6', ink='#3A3A3A', muted='#8C8578', line='#D6CDBD', surface='rgba(252,249,243,.92)',
        rule='#BDB29E', rule_soft='#E4DCCE', margin='#C08A7A',
        accent='#D98A2B', accent_ink='#A8651A', accent_wash='rgba(217,138,43,.18)',
        graphite='#2F2F2F', ok='#13492E', bad='#E05030', missed='#A8A093',
        band='rgba(217,138,43,.10)', frame='#A9834F', frame_lit='#C49B68', tray='#8A6940',
        wash='rgba(40,30,16,.04)', wash2='rgba(40,30,16,.18)')),

    'campfire': ('Night camp', ART / 'themes/campfire.webp', dict(
        sheet='#141B33', ink='#E8E6FF', muted='#9A9CC4', line='#2E3558', surface='rgba(16,21,45,.86)',
        rule='#4A5288', rule_soft='#343C66', margin='#FFA08A',
        accent='#FFB347', accent_ink='#FFD08A', accent_wash='rgba(255,179,71,.20)',
        graphite='#F2F0FF', ok='#86E39B', bad='#E85F28', missed='#7B7EA8',
        band='rgba(190,190,255,.12)', frame='#3A3550', frame_lit='#55506E', tray='#2A2640',
        wash='rgba(6,8,22,.08)', wash2='rgba(6,8,22,.28)')),
}


def data_url(p):
    return 'data:image/webp;base64,' + base64.b64encode(p.read_bytes()).decode()


BEG, END = 'FW-THEMES:BEGIN', 'FW-THEMES:END'


def build_css():
    out = ["""
/* %s ===== writing-surface themes =====""" % BEG + """
   Cosmetic only. Each palette is scoped to .stage so the rest of the page
   keeps its own light/dark theme; the canvas reads these through
   readColors(), which is pointed at #pad for exactly that reason.
   The frame is a border, not padding: padding would desync the canvas
   backing store from the box it renders in and put ink off the pointer. */
:root[data-skin] #stageSlotW,
:root[data-skin] #stageSlotR{
  background-size:cover; background-position:center 38%;
  image-rendering:pixelated;
  padding:clamp(16px,3.6vw,52px); border-radius:16px;
}
:root[data-skin] .stage{
  border:clamp(8px,1.4vw,14px) solid var(--frame);
  border-top-color:var(--frame-lit); border-left-color:var(--frame-lit);
  border-radius:8px; overflow:visible;
  box-shadow:0 18px 40px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.30);
}
:root[data-skin] .stage::after{            /* the ledge under the board */
  content:""; position:absolute; left:5%; right:5%; bottom:calc(-1 * clamp(8px,1.4vw,14px) - 9px);
  height:9px; background:var(--tray); border-radius:0 0 5px 5px;
  box-shadow:0 5px 12px rgba(0,0,0,.45);
}
:root[data-skin] #pad{border-radius:3px}
/* the theme picker in the write bar */
.skin-pick{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);
  background:var(--surface);color:var(--ink);padding:9px 11px;border-radius:10px;font-weight:700}
.skin-pick .sw{width:14px;height:14px;border-radius:4px;border:1.5px solid var(--line);
  background:var(--sheet);flex:none}
.skin-pick select{border:0;background:transparent;color:inherit;font:inherit;font-weight:700;padding:0 2px}
.skin-pick:focus-within{border-color:var(--rule)}
.skin-pick select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
"""]
    for name, (_label, img, p) in THEMES.items():
        url = data_url(img)
        out.append(
            f':root[data-skin="{name}"] #stageSlotW,\n'
            f':root[data-skin="{name}"] #stageSlotR{{background-image:'
            f'linear-gradient({p["wash"]},{p["wash2"]}),url("{url}")}}\n'
            f':root[data-skin="{name}"] .stage{{\n'
            f'  --sheet:{p["sheet"]}; --ink:{p["ink"]}; --muted:{p["muted"]}; --line:{p["line"]};\n'
            f'  --surface:{p["surface"]}; --rule:{p["rule"]}; --rule-soft:{p["rule_soft"]}; --margin:{p["margin"]};\n'
            f'  --accent:{p["accent"]}; --accent-ink:{p["accent_ink"]}; --accent-wash:{p["accent_wash"]};\n'
            f'  --graphite:{p["graphite"]}; --ok:{p["ok"]}; --bad:{p["bad"]}; --missed:{p["missed"]};\n'
            f'  --band:{p["band"]}; --frame:{p["frame"]}; --frame-lit:{p["frame_lit"]}; --tray:{p["tray"]};\n'
            f'}}\n')
    out.append(f'/* {END} */')
    # no leading or trailing blank line: strip() removes whole lines, so the
    # block has to occupy exactly the lines it adds for the two to cancel out
    return ''.join(out).strip('\n')


OPTIONS = '\n'.join(
    f'        <option value="{n}">{l}</option>' for n, (l, _i, _p) in THEMES.items())

PICKER_HTML = f"""      <!-- {BEG} -->
      <label class="skin-pick">
        <span class="sw" aria-hidden="true"></span>
        <select id="skinSel" aria-label="Writing surface">
          <option value="">Plain paper</option>
{OPTIONS}
        </select>
      </label>
      <!-- {END} -->
"""

JS = f"""
// {BEG} ---------- Writing-surface themes ----------""" + """
// Cosmetic only: sets a data attribute. The palette is scoped to .stage in CSS,
// and the existing attribute observer re-reads colours and re-lays-out, which
// matters because the frame's border width changes the canvas's content box.
const SKIN_KEY='flowriter-skin', SKIN_DEFAULT='classroom';
function applySkin(v){
  if(v) document.documentElement.dataset.skin=v;
  else document.documentElement.removeAttribute('data-skin');
  const s=$('skinSel'); if(s&&s.value!==v) s.value=v;
  try{ localStorage.setItem(SKIN_KEY,v); }catch(e){}
}
$('skinSel').addEventListener('change',e=>applySkin(e.target.value));
(()=>{ let v=SKIN_DEFAULT;
  try{ const stored=localStorage.getItem(SKIN_KEY); if(stored!==null) v=stored; }catch(e){}
  if(window.__FW&&window.__FW.skin!=null) v=window.__FW.skin===true?SKIN_DEFAULT:(window.__FW.skin||'');
  if(v&&!$('skinSel').querySelector(`[value="${v}"]`)) v=SKIN_DEFAULT;
  applySkin(v); })();
// """ + END + """
"""


def strip(text):
    """Remove a previous run's injections, so this script can be re-run after a
    palette or layout tweak without hand-editing the HTML."""
    for open_, close in [('/* ' + BEG, END + ' */'), ('<!-- ' + BEG, END + ' -->'),
                         ('// ' + BEG, '// ' + END)]:
        while True:
            i = text.find(open_)
            if i < 0:
                break
            j = text.find(close, i)
            assert j > 0, f'unclosed {open_}'
            # swallow the whole line the block sits on, both ends
            a = text.rfind('\n', 0, i) + 1
            b = text.find('\n', j) + 1 or len(text)
            text = text[:a] + text[b:]
    text = text.replace("const cs=getComputedStyle($('pad')||document.documentElement)",
                        "const cs=getComputedStyle(document.documentElement)")
    text = text.replace("readColors(); layout(); renderResults();", "readColors(); renderResults();")
    text = text.replace("attributeFilter:['data-theme','data-skin']", "attributeFilter:['data-theme']")
    return text


def patch(text, name):
    def rep(a, b, n=1):
        nonlocal text
        got = text.count(a)
        assert got == n, f'{name}: expected {n} of {a[:70]!r}, found {got}'
        text = text.replace(a, b)

    anchor = '@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}'
    rep(anchor, anchor + '\n' + build_css())
    rep('      <button class="btn" id="clearBtn" type="button">Clear</button>',
        PICKER_HTML + '      <button class="btn" id="clearBtn" type="button">Clear</button>')

    # Read the canvas palette from the canvas, so a theme scoped to .stage
    # reaches it while the rest of the page keeps the document-level theme.
    rep("""function readColors(){
  const cs=getComputedStyle(document.documentElement), g=n=>cs.getPropertyValue(n).trim();""",
        """function readColors(){
  const cs=getComputedStyle($('pad')||document.documentElement), g=n=>cs.getPropertyValue(n).trim();""")

    # Switching theme changes the frame's border width, so the canvas has to be
    # re-measured, not just recoloured.
    rep("const refreshTheme=()=>{ readColors(); renderResults(); render(); drawWave(); };",
        "const refreshTheme=()=>{ readColors(); layout(); renderResults(); render(); drawWave(); };")
    rep("observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});",
        "observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-skin']});")

    rep("\nsetWord('hello');", '\n' + JS.strip('\n') + "\nsetWord('hello');")
    return text


if __name__ == '__main__':
    for f in FILES:
        p = ROOT / f
        src = p.read_text(encoding='utf-8')
        had = 'data-skin' in src
        src = strip(src) if had else src
        assert 'data-skin' not in src, f'{f}: leftovers after strip'
        p.write_text(patch(src, f), encoding='utf-8')
        print(f'{f}: {len(THEMES)} themes applied{" (re-applied)" if had else ""} '
              f'({(p.stat().st_size) // 1024} KB)')
