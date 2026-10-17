"""Pilot features on the built site (demo data): password reset, login cards + QR sign-in, handwriting checks,
lessons in order, locked words, move/delete student, left hand, idle sign-out, admin, CSV, feedback."""
import sys, pathlib, json, re
from playwright.sync_api import sync_playwright
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fwpilot'); OUT.mkdir(parents=True, exist_ok=True)
SITE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
results = []
def check(name, ok, info=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1300, 'height': 950}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('window.__FW_DEBUG=true')
    pg.goto(SITE); pg.wait_for_timeout(800)
    pg.evaluate("api.resetDemo(); setSession(null); location.hash='#/login'"); pg.wait_for_timeout(400)
    go = lambda h, w=500: (pg.evaluate(f"location.hash='{h}'"), pg.wait_for_timeout(w))

    # ---- teacher forgot password (demo flow)
    pg.click('a[href="#/forgot"]'); pg.wait_for_timeout(300); pg.fill('#fgEmail', 'murry@bayou.example'); pg.click('form[data-form="forgot"] button[type="submit"]'); pg.wait_for_timeout(500)
    pg.fill('#rsPw', 'newpass2026'); pg.click('form[data-form="reset"] button[type="submit"]'); pg.wait_for_timeout(600)
    check('teacher resets a forgotten password and is signed in', 'dashboard' in pg.url and pg.evaluate("userById('u_murry').password") == 'newpass2026')

    # ---- account page
    go('#/account'); pg.fill('#acSchool', 'Bayou Elementary School'); pg.click('form[data-form="account"] button[type="submit"]'); pg.wait_for_timeout(300)
    check('teacher edits their profile', pg.evaluate("userById('u_murry').school") == 'Bayou Elementary School')

    # ---- add students -> cards with QR codes
    go('#/class?id=c_r12&tab=students'); pg.click('[data-act="add-students"]'); pg.fill('#asNames', 'Lena k\nomar t.\nBo'); pg.click('form[data-form="add-students"] button[type="submit"]'); pg.wait_for_timeout(800)
    cards = pg.evaluate("[...document.querySelectorAll('.lcard')].map(c=>({name:c.querySelector('h3').textContent, user:c.querySelectorAll('dd')[0].textContent, pw:c.querySelectorAll('dd')[1].textContent, qr:!!c.querySelector('.qr svg')}))")
    check('bulk add makes 3 accounts and cards with QR codes', len(cards) == 3 and all(c['qr'] for c in cards) and cards[0]['name'] == 'Lena K.', json.dumps(cards))
    pg.screenshot(path=str(OUT / 'cards.png'), full_page=True)
    link = pg.evaluate("(()=>{ const u=document.querySelectorAll('.lcard dd')[0].textContent, k=encodeCard(document.querySelectorAll('.lcard dd')[1].textContent); return '#/card?u='+u+'&k='+k; })()")
    # ---- card sign-in (as if scanned)
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(300)
    go(link, 900)
    check('scanning a login card signs the student in', pg.evaluate("state.user && state.user.name") == 'Lena K.' and 'home' in pg.url, pg.url)
    check('the password is not left in the address bar', 'k=' not in pg.url)
    # ---- left-hand setting
    go('#/progress'); pg.click('[data-change="handed"]'); pg.wait_for_timeout(200)
    check('student sets left hand', pg.evaluate("state.user.handed") == 'left')
    # ---- idle sign-out on shared devices
    pg.evaluate("lastActive = Date.now() - 11*60000"); pg.wait_for_timeout(31500)
    check('idle student is signed out for the next student', pg.evaluate("state.user") is None and 'login' in pg.url)
    check('login page says why', 'signed out after 10 minutes' in (pg.text_content('.auth-card') or ''))

    # ---- teacher: handwriting check + lessons in order + locked words
    pg.click('[data-u="mr_murry"]') if pg.query_selector('[data-u="mr_murry"]') else None
    pg.fill('#liId', 'mr_murry'); pg.fill('#liPw', 'newpass2026'); pg.click('form[data-form="login"] button[type="submit"]'); pg.wait_for_timeout(700)
    go('#/classes'); pg.click('button[data-act="new-class"] >> nth=0'); pg.fill('#ncName', 'Order Test'); pg.click('form[data-form="new-class"] button[type="submit"]'); pg.wait_for_timeout(500)
    cid = pg.evaluate("DB.classes.find(c=>c.name==='Order Test').id"); code = pg.evaluate(f"classById('{cid}').code")
    go(f'#/lesson-edit?class={cid}&kind=check', 700)
    check('editor opens a handwriting check with the standard sentence', pg.input_value('#edText').startswith('The quick brown fox'))
    pg.click('[data-act="ed-save"]'); pg.wait_for_timeout(500)
    for t in ['First', 'Second']:
        go(f'#/lesson-edit?class={cid}', 600); pg.fill('#edTitle', t); pg.fill('#edText', 'it'); pg.click('[data-act="ed-save"]'); pg.wait_for_timeout(400)
    pg.evaluate(f"api.setSequential('{cid}', true)")
    # a student joins
    pg.evaluate("ACT.logout()"); go(f'#/join?code={code}', 900)
    pg.fill('#jnFirst', 'Kit'); pg.fill('#jnUser', 'kit_seq'); pg.fill('#jnPw', 'secret11'); pg.click('form[data-form="join"] button[type="submit"]'); pg.wait_for_timeout(600)
    go('#/home', 600)
    txt = pg.text_content('#main') or ''
    check('second lesson is locked until the first is done', 'Opens after you finish “First”' in txt, txt[:300])
    check('handwriting check is open and labeled', 'Handwriting check' in txt)
    sec = pg.evaluate(f"DB.lessons.find(l=>l.classId==='{cid}'&&l.title==='Second').id")
    go(f'#/lesson?id={sec}', 600)
    check('a locked lesson cannot be opened by link', 'home' in pg.url)
    # do the check: test only
    chk = pg.evaluate(f"DB.lessons.find(l=>l.classId==='{cid}'&&l.kind==='check').id")
    go(f'#/lesson?id={chk}'); pg.wait_for_function("document.querySelector('#engineWrap iframe') && !document.getElementById('engineLoading')", timeout=20000)
    fr = pg.frames[-1]; fr.wait_for_function("window.__fw")
    vis = fr.evaluate("[getComputedStyle(demoBtn).display, getComputedStyle(pracBtn).display, testBtn.disabled, !!document.getElementById('sndMusic')]")
    check('check shows only the test, with no sound controls', vis == ['none', 'none', False, False], str(vis))
    fr.evaluate("testBtn.click(); testBtn.click()"); fr.wait_for_function("__fw.S.checking")
    fr.evaluate("""(()=>{ const F=__fw,S=F.S,cv=document.getElementById('pad'),r=cv.getBoundingClientRect(); const ev=(t,x,y)=>cv.dispatchEvent(new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,pointerId:1,bubbles:true}));
      S.strokes.forEach(s=>{ if(s.page!==S.page) return; s.pts.forEach((p,i)=>ev(i?'pointermove':'pointerdown',F.X(p[0])+3,F.Y(p[1])+2)); ev('pointerup',0,0); }); document.getElementById('checkDone').click(); })()""")
    pg.wait_for_function(f"DB.attempts.some(a=>a.lessonId==='{chk}'&&a.mode==='test')", timeout=10000)
    check('check is recorded as done', pg.evaluate(f"progress(state.user.id,'{chk}').done"))
    # do lesson 1 quickly via api so lesson 2 unlocks
    first = pg.evaluate(f"DB.lessons.find(l=>l.classId==='{cid}'&&l.title==='First').id")
    pg.evaluate(f"['demo','practice','test'].forEach(m=>api.recordAttempt({{userId:state.user.id, lessonId:'{first}', mode:m, score:m==='demo'?null:.9, valid:5,total:6}}))")
    go('#/home', 500)
    dbg = pg.evaluate(f"JSON.stringify({{done: progress(state.user.id,'{first}'), lock: lessonLocked(state.user, lessonById('{sec}')), hash: location.hash}})")
    check('finishing the first lesson opens the second', 'Opens after you finish' not in (pg.text_content('#main') or ''), dbg[:400])
    # sound controls in a normal lesson
    go(f'#/lesson?id={sec}'); pg.wait_for_function("document.querySelector('#engineWrap iframe') && !document.getElementById('engineLoading')", timeout=20000)
    fr = pg.frames[-1]; fr.wait_for_function("window.__fw")
    fr.evaluate("sndMusic.click()"); v = fr.evaluate("[__fw.S.sound, sndMusic.getAttribute('aria-pressed')]")
    check('student can mute the music', v == [False, 'false'], str(v))
    fr.evaluate("sndVol.value=40; sndVol.dispatchEvent(new Event('input'))")
    check('volume setting applies', abs(fr.evaluate("__fw.S.vol") - .4) < 1e-6)
    sid = pg.evaluate("state.user.id")
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(300)

    # ---- teacher: checks tab, locked words, move + delete, export, feedback, admin
    pg.fill('#liId', 'mr_murry'); pg.fill('#liPw', 'newpass2026'); pg.click('form[data-form="login"] button[type="submit"]'); pg.wait_for_timeout(700)
    go(f'#/class?id={cid}&tab=checks')
    check('checks tab shows the student’s check score', 'Kit' in (pg.text_content('#main') or '') and '%' in (pg.text_content('table.t') or ''))
    go(f'#/lesson-edit?id={first}', 600)
    check('words lock once students have started', pg.evaluate("document.getElementById('edText').readOnly") and 'words are locked' in (pg.text_content('#main') or ''))
    go('#/class?id=c_p2&tab=checks')
    check('seeded class shows a start-of-pilot check', 'Handwriting check: start' in (pg.text_content('#main') or ''))
    pg.screenshot(path=str(OUT / 'checks_tab.png'), full_page=True)
    go(f'#/student?id={sid}'); pg.click('[data-act="move-student"]'); pg.select_option('#mvCls', 'c_p2'); pg.click('form[data-form="move-student"] button[type="submit"]'); pg.wait_for_timeout(400)
    check('teacher moves a student to another class', pg.evaluate(f"userById('{sid}').classId") == 'c_p2')
    go(f'#/student?id={sid}'); pg.click('[data-act="delete-student"]'); pg.fill('#delName', 'kit_seq'); pg.click('form[data-form="delete-student"] button[type="submit"]'); pg.wait_for_timeout(400)
    check('teacher deletes a student and all their work', not pg.evaluate(f"!!userById('{sid}')") and pg.evaluate(f"DB.attempts.filter(a=>a.userId==='{sid}').length") == 0)
    go('#/class?id=c_p2&tab=students'); pg.click('[data-act="export-class"]'); pg.wait_for_timeout(400)
    csv = pg.evaluate("document.getElementById('csvText').value")
    check('class results export as CSV', csv.startswith('School,Student,Username') and csv.count('\n') > 20, csv[:80])
    pg.keyboard.press('Escape')
    pg.click('[data-act="feedback"]'); pg.click('[data-act="fb-rate"][data-n="4"]'); pg.fill('#fbBody', 'Kids love the space theme.'); pg.click('form[data-form="feedback"] button[type="submit"]'); pg.wait_for_timeout(400)
    go('#/admin', 700)
    t = pg.text_content('#main') or ''
    check('admin sees both schools and the feedback', 'Lakeside Elementary' in t and 'Bayou Elementary' in t and 'Kids love the space theme.' in t)
    check('admin shows first vs latest check', 'First check' in t, t[t.find('Handwriting checks'):][:200])
    pg.screenshot(path=str(OUT / 'admin.png'), full_page=True)
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(300); go('#/login', 300)
    pg.fill('#liId', 'ms_rivera'); pg.fill('#liPw', 'teacher2026'); pg.click('form[data-form="login"] button[type="submit"]'); pg.wait_for_timeout(700)
    check('non-admin teacher has no admin page', 'Pilot admin' not in (pg.text_content('.rail') or ''))
    go('#/admin', 500); check('and is sent away from it', 'dashboard' in pg.url)
    go('#/privacy', 400); check('privacy page renders', 'What we collect' in (pg.text_content('body') or ''))
    check('no page errors', not errs, '; '.join(errs[:3]))
    b.close()
print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
