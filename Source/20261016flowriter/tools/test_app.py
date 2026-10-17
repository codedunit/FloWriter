"""End-to-end pilot flow on the built site (demo data mode):
teacher makes a class + lesson -> student joins with the code -> demo -> practice -> test (once)
-> teacher sees completion and the trace."""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fwapp'); OUT.mkdir(parents=True, exist_ok=True)
SITE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
results = []
def check(name, ok, info=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

# Runs inside the engine frame: keeps a pen on the pacer while music plays.
DRIVER = """(()=>{ const F=window.__fw, S=F.S, cv=document.getElementById('pad');
  const ev=(t,x,y)=>{ const r=cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,pointerId:1,bubbles:true,pointerType:'pen'})); };
  let down=false;
  const step=()=>{ if(!S.playing){ if(down){ ev('pointerup',0,0); down=false; } return; }
    let k=S.active, s=k>=0?S.strokes[k]:null, p=0;
    if(!s && S.next>=0 && !S.flow){ s=S.strokes[S.next]; }
    if(s && k>=0) p=Math.min(1,Math.max(0,(S.beat-s.b0)/S.bps));
    if(!s){ if(down){ ev('pointerup',0,0); down=false; } requestAnimationFrame(step); return; }
    const q=s.pts[Math.round(p*(s.pts.length-1))], x=F.X(q[0]), y=F.Y(q[1]);
    if(!down){ ev('pointerdown',x,y); down=true; } else ev('pointermove',x,y);
    requestAnimationFrame(step); };
  requestAnimationFrame(step); })()"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1300, 'height': 950})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('window.__FW_DEBUG=true')
    pg.goto(SITE); pg.wait_for_timeout(800)
    pg.evaluate("api.resetDemo(); setSession(null); location.hash='#/login'"); pg.wait_for_timeout(400)
    pg.click('[data-u="mr_murry"]'); pg.wait_for_timeout(700)
    check('teacher lands on dashboard', 'dashboard' in pg.url)

    # new class
    pg.evaluate("location.hash='#/classes'"); pg.wait_for_timeout(300)
    pg.click('button[data-act="new-class"] >> nth=0'); pg.fill('#ncName', 'Pilot Room 7'); pg.click('form[data-form="new-class"] button[type="submit"]'); pg.wait_for_timeout(500)
    code = pg.evaluate("DB.classes.find(c=>c.name==='Pilot Room 7').code"); cid = pg.evaluate("DB.classes.find(c=>c.name==='Pilot Room 7').id")
    check('class created with a join code', len(code) == 6, code)

    # new lesson via the editor: generator + song + 2x tempo + theme
    pg.evaluate(f"location.hash='#/lesson-edit?class={cid}'"); pg.wait_for_timeout(600)
    pg.fill('#edTitle', 'Tiny test')
    pg.fill('#edText', 'it')
    pg.click('[data-act="ed-song"][data-id="sg_sunny"]')
    pg.fill('#edMult', '3.5'); pg.wait_for_timeout(100)
    tempo = pg.text_content('#edTempo')
    check('custom tempo multiplier above 2x accepted', '294' in tempo, tempo)
    pg.fill('#edMult', '1.5')
    pg.click('[data-act="ed-theme"][data-id="space"]')
    pg.click('[data-act="ed-save"]'); pg.wait_for_timeout(600)
    lesson = pg.evaluate(f"JSON.stringify(DB.lessons.find(l=>l.classId==='{cid}'))")
    L = json.loads(lesson) if lesson else {}
    check('lesson saved with song, tempo and theme', L.get('songId') == 'sg_sunny' and L.get('mult') == 1.5 and L.get('theme') == 'space', lesson)
    # generator
    gen = pg.evaluate("generateText({focus:'lhk', known:'itwurspjelhkfb', kind:'words', count:5})")
    check('generator uses only known letters and the focus letters', all(set(w) <= set('itwurspjelhkfb') for w in gen.split()) and any(c in gen for c in 'lhk'), gen)
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(300)

    # student joins with the link
    pg.evaluate(f"location.hash='#/join?code={code}'"); pg.wait_for_timeout(700)
    pg.fill('#jnFirst', 'Robin'); pg.fill('#jnLast', 'q'); pg.fill('#jnUser', 'robin_q7'); pg.click('[data-act="make-pw"]')
    pg.click('form[data-form="join"] button[type="submit"]'); pg.wait_for_timeout(700)
    creds = pg.text_content('.creds') or ''
    check('student joins and sees their login', 'robin_q7' in creds, creds)
    stu = pg.evaluate("JSON.stringify(state.user)"); S = json.loads(stu)
    check('student account holds no email or birth date', 'email' not in S and 'birth' not in S and S['classId'] == cid)
    pg.click('[data-act="nav"][data-to="home"]'); pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / 'student_home.png'), full_page=True)
    lid = L['id']
    pg.evaluate(f"location.hash='#/lesson?id={lid}'")
    pg.wait_for_function("document.querySelector('#engineWrap iframe') && !document.getElementById('engineLoading')", timeout=30000)
    fr = pg.frames[-1]
    fr.wait_for_function("window.__fw && __fw.S.track", timeout=20000)
    check('song attached at song BPM x multiplier', fr.evaluate("__fw.S.track.bpm") == 126, str(fr.evaluate("__fw.S.track.bpm")))
    check('lesson theme applied', fr.evaluate("document.documentElement.dataset.skin") == 'space')
    check('practice locked before the demo', fr.evaluate("pracBtn.disabled") is True)
    # demo
    fr.evaluate("demoBtn.click()"); fr.wait_for_function("!__fw.S.playing && __fw.S.demoWatched", timeout=30000); pg.wait_for_timeout(300)
    n = pg.evaluate(f"DB.attempts.filter(a=>a.lessonId==='{lid}'&&a.mode==='demo').length")
    check('demo recorded', n == 1)
    # practice, pen follows the pacer
    fr.evaluate("pracBtn.click()"); fr.evaluate(DRIVER)
    fr.wait_for_function("!__fw.S.playing && __fw.S.practiceRuns>0", timeout=60000); pg.wait_for_timeout(400)
    pr = pg.evaluate(f"JSON.stringify(DB.attempts.filter(a=>a.lessonId==='{lid}'&&a.mode==='practice'))")
    prs = json.loads(pr)
    check('practice recorded with a score', len(prs) == 1 and prs[0]['score'] is not None and prs[0]['score'] > .6, pr[:200])
    pg.screenshot(path=str(OUT / 'after_practice.png'), full_page=True)
    # test: no music, trace forward, submit
    fr.evaluate("testBtn.click(); testBtn.click();"); fr.wait_for_function("__fw.S.checking")
    check('test has no music running', fr.evaluate("!__fw.S.playing"))
    fr.evaluate("""(()=>{ const F=__fw,S=F.S,cv=document.getElementById('pad'),r=cv.getBoundingClientRect(); const ev=(t,x,y)=>cv.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,pointerId:1,bubbles:true}));
      S.strokes.forEach(s=>{ s.pts.forEach((p,i)=>ev(i?'pointermove':'pointerdown',F.X(p[0]),F.Y(p[1]))); ev('pointerup',0,0); }); document.getElementById('checkDone').click(); })()""")
    pg.wait_for_function(f"DB.attempts.some(a=>a.lessonId==='{lid}'&&a.mode==='test')", timeout=10000); pg.wait_for_timeout(500)
    t = json.loads(pg.evaluate(f"JSON.stringify(DB.attempts.find(a=>a.lessonId==='{lid}'&&a.mode==='test'))"))
    check('test recorded, graded, no BPM, with letters', t['score'] > .9 and t['bpm'] is None and t['letters'], f"score {t['score']}")
    check('trace image kept for the teacher', pg.evaluate(f"!!RUNTIME.traces['{t['id']}']"))
    check('lesson complete for the student', pg.evaluate(f"progress(state.user.id,'{lid}').done"))
    check('test button now closed', fr.evaluate("testBtn.disabled"))
    pg.screenshot(path=str(OUT / 'after_test.png'), full_page=True)
    # a second test can't be recorded
    pg.evaluate(f"api.recordAttempt({{userId:state.user.id, lessonId:'{lid}', mode:'test', score:.1}})")
    check('only one test per lesson', pg.evaluate(f"DB.attempts.filter(a=>a.lessonId==='{lid}'&&a.mode==='test').length") == 1)
    # reopen: progress restored in the engine
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(400); pg.evaluate(f"location.hash='#/lesson?id={lid}'")
    pg.wait_for_function("document.querySelector('#engineWrap iframe')"); pg.wait_for_timeout(1500)
    fr = pg.frames[-1]; fr.wait_for_function("window.__fw")
    check('reopened lesson keeps steps open and the test closed', fr.evaluate("[pracBtn.disabled, testBtn.disabled]") == [False, True])
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(300)

    # teacher sees it
    pg.evaluate("location.hash='#/login'"); pg.wait_for_timeout(300); pg.click('[data-u="mr_murry"]'); pg.wait_for_timeout(600)
    pg.evaluate(f"location.hash='#/class?id={cid}&tab=students'"); pg.wait_for_timeout(500)
    row = pg.text_content('table.t tbody') or ''
    check('teacher sees the student and completion', 'Robin Q.' in row and '1/1' in row, row[:120])
    sid = S['id']; pg.evaluate(f"location.hash='#/student?id={sid}'"); pg.wait_for_timeout(500)
    pg.click('[data-act="view-runs"]'); pg.wait_for_timeout(900)
    check('teacher sees the practice run and the test as pictures', pg.evaluate("document.querySelectorAll('#overlay img').length") == 2, str(pg.evaluate("document.querySelectorAll('#overlay img').length")))
    pg.screenshot(path=str(OUT / 'teacher_trace.png'), full_page=False)
    # reset password
    pg.keyboard.press('Escape'); pg.click('button[data-act="reset-pw"]'); pg.click('[data-act="confirm-ok"]'); pg.wait_for_timeout(400)
    newpw = pg.evaluate("document.querySelector('.creds dd:last-child')?.textContent")
    check('teacher can set a new student password', bool(newpw) and pg.evaluate(f"userById('{sid}').password") == newpw, str(newpw))
    check('no page errors', not errs, '; '.join(errs))
    b.close()
print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
