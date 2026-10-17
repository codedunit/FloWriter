"""Correctness fix: size the canvas backing store to the box the canvas really
renders in.

The bug: stageWidth() read stage.clientWidth, which counts the stage's padding.
The canvas is width:100% of the stage's *content* box, so as soon as the stage
has any padding the two disagree. layout() then sets cv.width from the larger
number, the browser squeezes that backing store into the narrower element, and
every drawn point lands short of the pointer by a margin that grows left to
right. With 15px of padding each side that was ~30px of skew at the right edge.

This is independent of any skin. Run it once on clean engine source; it is
idempotent and refuses to double-apply.
"""
import pathlib

ROOT = pathlib.Path(__file__).parent
FILES = ['FinalFWAssignment.html', 'FinalFWFreePlay.html']

OLD = """// the stage is hidden on the setup page, so fall back to the width it will have once shown
const stageWidth=()=>stage.clientWidth||Math.max(280,mainEl.clientWidth-42);"""

NEW = """// The width to size the canvas to is the width the canvas actually renders at,
// i.e. its own content box. Reading stage.clientWidth instead also counts the
// stage's padding, and any disagreement makes the browser rescale the backing
// store, which puts the ink a few pixels away from the pointer (worse the
// further right you draw). The stage is hidden on the setup page, so fall back
// to the width it will have once shown.
const stageWidth=()=>{
  if(cv.clientWidth){
    const cs=getComputedStyle(cv);
    return cv.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);
  }
  return stage.clientWidth||Math.max(280,mainEl.clientWidth-42);
};"""

for f in FILES:
    p = ROOT / f
    t = p.read_text(encoding='utf-8')
    if NEW in t:
        print(f'{f}: already fixed')
        continue
    assert t.count(OLD) == 1, f'{f}: expected 1 match, found {t.count(OLD)}'
    p.write_text(t.replace(OLD, NEW), encoding='utf-8')
    print(f'{f}: canvas width fixed')
