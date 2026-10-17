"""Engine checks: fixed size, travel beats, direction-aware grading, looping, uncapped BPM.
Runs the engine inside an iframe the way the app does and drives it with synthetic pointer events."""
import json, pathlib, sys, math, struct, io, wave
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from assemble import engine_html
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fwtest'); OUT.mkdir(parents=True, exist_ok=True)
ENGINE = engine_html()

def host_page(cfg):
    inject = f'<script>window.__FW={json.dumps(cfg)}</script>'
    # __FW has to exist before the engine's script runs: put it in <head>
    src = ENGINE.replace('</head>', inject + '</head>', 1)
    return ('<!doctype html><html><body style="margin:0"><iframe id="f" style="width:1100px;height:900px;border:0"></iframe><script>'
            'window.msgs=[];addEventListener("message",e=>{if(e.data&&e.data.fw){const m={...e.data};if(m.img)m.img=m.img.length;msgs.push(m);if(m.type==="h")document.getElementById("f").style.height=m.h+"px";}});'
            f'document.getElementById("f").srcdoc={json.dumps(src).replace("</", "<\\/")};</script></body></html>')

def trace(frame, reverse=False, jitter=0.0, skip=()):
    """Draw every stroke on the current page with real pointer events, forward or backward."""
    return frame.evaluate("""([reverse,jitter,skip])=>{
      const F=window.__fw, S=F.S, cv=document.getElementById('pad'), r=cv.getBoundingClientRect();
      const ev=(type,x,y)=>cv.dispatchEvent(new PointerEvent(type,{clientX:r.left+x,clientY:r.top+y,pointerId:1,bubbles:true,pointerType:'pen',pressure:.5}));
      let n=0;
      S.strokes.forEach((s,k)=>{ if(s.page!==S.page||skip.includes(k)) return;
        let pts=s.pts.slice(); if(reverse) pts.reverse();
        pts.forEach((p,i)=>{ const off=jitter*Math.sin(i*.7); const x=F.X(p[0])+off, y=F.Y(p[1])+off; ev(i?'pointermove':'pointerdown',x,y); n++; });
        const l=pts[pts.length-1]; ev('pointerup',F.X(l[0]),F.Y(l[1]));
      });
      return n; }""", [reverse, jitter, list(skip)])

def make_wav(seconds, bpm, path):
    sr = 22050; n = int(sr * seconds); buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        frames = bytearray()
        for i in range(n):
            t = i / sr; ph = (t * bpm / 60) % 1
            v = math.sin(2 * math.pi * 80 * t) * math.exp(-ph * 30) * .8
            frames += struct.pack('<h', int(v * 32767))
        w.writeframes(bytes(frames))
    path.write_bytes(buf.getvalue())

results = []
def check(name, ok, info=''):
    results.append((name, ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1200, 'height': 1000})

    def load(cfg):
        pg.set_content(host_page({'ch': 't', 'debug': 1, 'role': 'student', **cfg}))
        pg.wait_for_function("msgs.some(m=>m.type==='ready')")
        return pg.frame_locator('#f'), pg.frames[1]

    # ---- 1. fixed size: short and long text get the same x-height
    _, fr = load({'word': 'hi', 'progress': {}})
    s1, h1 = fr.evaluate('[__fw.scale, __fw.H]')
    pg.screenshot(path=str(OUT / 'size_short.png'))
    long = 'The quick brown fox jumps over the lazy dog. ' * 5
    _, fr = load({'word': long.strip(), 'progress': {}})
    s2, pages = fr.evaluate('[__fw.scale, __fw.S.pages]')
    pg.screenshot(path=str(OUT / 'size_long.png'))
    check('fixed text size for short and long text', s1 == s2 == 48, f'{s1} vs {s2}, {pages} pages')

    # ---- 2. travel beat before dots and crosses
    _, fr = load({'word': 'it', 'progress': {}})
    info = fr.evaluate("""(()=>{ const S=__fw.S; return S.strokes.map(s=>({ch:s.ch,n:s.name,b0:s.b0,gap:s.gap,travel:!!s.travel})); })()""")
    dot = [x for x in info if x['n'] == 'dot'][0]; cross = [x for x in info if x['n'] == 'cross'][0]
    check('dot gets its own travel beat', dot['gap'] == 1 and dot['travel'], json.dumps(dot))
    check('cross gets its own travel beat', cross['gap'] == 1 and cross['travel'], json.dumps(cross))
    lane = fr.evaluate("document.querySelectorAll('.cell.rest.lift').length")
    check('beat map shows lift cells', lane == 2, str(lane))

    # ---- 3. step gating
    _, fr = load({'word': 'cat', 'progress': {}})
    st = fr.evaluate("[pracBtn.disabled, testBtn.disabled, demoBtn.disabled]")
    check('practice and test locked before the demo', st == [True, True, False], str(st))
    _, fr = load({'word': 'cat', 'progress': {'demo': 1}})
    st = fr.evaluate("[pracBtn.disabled, testBtn.disabled]")
    check('practice opens after the demo', st == [False, True], str(st))

    # ---- 4. grading: forward trace scores high, backward trace is rejected, off-line trace is low
    def run_test(word, **kw):
        _, fr = load({'word': word, 'progress': {'demo': 1, 'practice': 1}})
        fr.evaluate("testBtn.click(); testBtn.click();")
        fr.wait_for_function("__fw.S.checking===true")
        trace(fr, **kw)
        fr.evaluate("document.getElementById('checkDone').click()")
        pg.wait_for_function("msgs.some(m=>m.type==='run')")
        run = pg.evaluate("msgs.find(m=>m.type==='run')")
        statuses = fr.evaluate("__fw.S.strokes.map(s=>s.res.status)")
        return run, statuses, fr
    run, st, fr = run_test('hello')
    pg.screenshot(path=str(OUT / 'test_forward.png'), full_page=True)
    check('forward trace scores high', run['score'] > .95 and run['mode'] == 'test' and run['bpm'] is None, f"score {run['score']} {st}")
    check('test goes to results', fr.evaluate("!document.getElementById('view-results').hidden"))
    run, st, fr = run_test('hello', reverse=True)
    check('backward trace is marked wrong direction', run['reversed'] >= len(st) - 1 and run['score'] < .1, f"score {run['score']} {st}")
    run, st, _ = run_test('hello', jitter=9)
    check('wobbly trace loses points smoothly', .3 < run['score'] < .97, f"score {run['score']}")
    run, st, _ = run_test('hello', skip=(1, 2))
    check('skipped strokes count as missed', st[1] == 'missed' and st[2] == 'missed', str(st[:4]))
    run, st, fr = run_test('a o d g')
    check('closed shapes (a o d g) traced forward are not flagged', 'reversed' not in st, f"score {run['score']} {st}")
    run, st, fr = run_test('a o d g', reverse=True)
    check('closed shapes traced backward are flagged', st.count('reversed') >= len(st) - 2, str(st))

    # ---- 4b. wrong direction while writing: practice waits when the pen starts at the far end, and backwards ink is flagged at once
    _, fr = load({'word': 'hello', 'progress': {'demo': 1}})
    fr.evaluate("pracBtn.click()")
    fr.evaluate("""(()=>{ const F=__fw, S=F.S, cv=document.getElementById('pad'), r=cv.getBoundingClientRect(), p=S.strokes[0].pts.at(-1);
      cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+F.X(p[0]),clientY:r.top+F.Y(p[1]),pointerId:1,bubbles:true,pointerType:'pen',pressure:.5})); })()""")
    pg.wait_for_timeout(3600)  # past the 4-beat count-in at 84 BPM
    held = fr.evaluate("__fw.S.beat < __fw.S.strokes[0].b0")
    fr.evaluate("""(()=>{ const F=__fw, S=F.S, cv=document.getElementById('pad'), r=cv.getBoundingClientRect();
      S.strokes[0].pts.slice().reverse().forEach(p=>cv.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+F.X(p[0]),clientY:r.top+F.Y(p[1]),pointerId:1,bubbles:true,pointerType:'pen',pressure:.5}))); })()""")
    live = fr.evaluate("[__fw.S.points.filter(p=>p.back).length, __fw.S.points.length, document.getElementById('hudPenTxt').textContent]")
    check('practice waits when the pen starts at the end of a stroke', held, str(held))
    check('backwards ink is flagged while writing', live[0] > live[1] * .5 and 'Wrong way' in live[2], str(live))
    run, st, fr = run_test('rr fox')  # short: a synthetic trace redraws all ink per event, so long text is slow here
    check('forward writing is never flagged live', fr.evaluate("__fw.S.points.filter(p=>p.back).length") == 0 and 'reversed' not in st, str(st))

    # ---- 5. one test only: after submitting, the test button is done
    _, fr = load({'word': 'cat', 'progress': {'demo': 1, 'practice': 2, 'test': {'score': .82}}})
    t = fr.evaluate("[testBtn.disabled, document.getElementById('testTitle').textContent, document.getElementById('testMd').textContent]")
    check('a taken test stays closed when the lesson reopens', t[0] and 'submitted' in t[1], str(t))

    # ---- 6. looping + uncapped BPM
    wav = OUT / 'short.wav'; make_wav(3.2, 120, wav)
    _, fr = load({'word': 'minimum minimum minimum', 'progress': {'demo': 1}})
    pg.evaluate("""async ()=>{ const b=await (await fetch('data:audio/wav;base64,'+arguments[0])).blob(); }""") if False else None
    import base64
    b64 = base64.b64encode(wav.read_bytes()).decode()
    pg.evaluate("""(b64)=>{ const bin=atob(b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      const f=new File([u],'short.wav',{type:'audio/wav'}); document.getElementById('f').contentWindow.postMessage({fwShell:1,track:f,bpm:480,baseBpm:120,offset:0},'*'); }""", b64)
    pg.wait_for_function("msgs.some(m=>m.type==='trackReady'||m.type==='trackFail')")
    tr = pg.evaluate("msgs.find(m=>m.type==='trackReady'||m.type==='trackFail')")
    check('track at 4x the song tempo is accepted (no BPM cap)', tr.get('type') == 'trackReady' and tr.get('bpm') == 480, str(tr))
    lr = fr.evaluate("(()=>{const L=__fw.loopRegion(); return [L.start,L.end,L.len,__fw.wrapPos(10.3)];})()")
    check('song loops on whole bars', abs(lr[2] - 2.0) < 1e-6 and 0 <= lr[3] < lr[1], str(lr))
    info = fr.evaluate("document.getElementById('trackInfo').textContent")
    check('long text on a short song says it loops', 'loops' in info, info)
    fr.evaluate("document.getElementById('bpmDouble').click(); document.getElementById('bpmDouble').click();")
    check('2x can be pressed past the old 220 limit', fr.evaluate("__fw.S.track.bpm") == 1920)
    # practice runs and reports
    fr.evaluate("document.getElementById('bpmHalf').click(); document.getElementById('bpmHalf').click(); document.getElementById('bpmHalf').click(); document.getElementById('bpmHalf').click();")
    check('½x works the other way too', fr.evaluate("__fw.S.track.bpm") == 120)
    b.close()

print(f"\n{sum(ok for _, ok in results)}/{len(results)} passed")
sys.exit(0 if all(ok for _, ok in results) else 1)
