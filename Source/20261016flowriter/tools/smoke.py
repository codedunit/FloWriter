"""Walk every page of the built site in demo mode. Reports console errors and saves screenshots.
Usage: python3 tools/smoke.py OUTDIR [width]"""
import sys, pathlib
from playwright.sync_api import sync_playwright
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1360
SITE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': W, 'height': 900})
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(f'[{pg.url.split("#")[-1]}] {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'[{pg.url.split("#")[-1]}] PAGEERROR {e}'))
    def shot(name, full=True):
        pg.wait_for_timeout(500); pg.screenshot(path=str(OUT / f'{name}.png'), full_page=full)
    def visit(h, name, wait=400):
        pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(wait); shot(name)
    pg.goto(SITE); pg.wait_for_timeout(1200); shot('01_home')
    visit('#/login', '02_login'); visit('#/signup', '03_signup'); visit('#/join?code=MURRY2', '04_join', 900)
    visit('#/try', '05_try', 2500)
    # teacher
    pg.evaluate("location.hash='#/login'"); pg.wait_for_timeout(300)
    pg.click('[data-u="mr_murry"]'); pg.wait_for_timeout(900); shot('10_dashboard')
    visit('#/classes', '11_classes')
    cid = pg.evaluate("DB.classes[0].id")
    for tab in ['overview', 'students', 'lessons', 'letters']: visit(f'#/class?id={cid}&tab={tab}', f'12_class_{tab}')
    sid = pg.evaluate("classStudents(DB.classes[0].id)[2].id"); visit(f'#/student?id={sid}', '13_student')
    visit('#/lessons', '14_lessons'); visit('#/lesson-edit', '15_editor', 700); visit('#/songs', '16_songs')
    lid = pg.evaluate("lessonsForClass(DB.classes[0].id)[0].id"); visit(f'#/preview?id={lid}', '17_preview', 2500)
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(300)
    # student
    pg.evaluate("location.hash='#/login'"); pg.wait_for_timeout(300)
    pg.click('[data-u="evan_writes"]'); pg.wait_for_timeout(900); shot('20_student_home')
    visit('#/progress', '21_progress')
    lid = pg.evaluate("lessonsForStudent(state.user).find(l=>!progress(state.user.id,l.id).done).id"); visit(f'#/lesson?id={lid}', '22_lesson', 3000)
    b.close()
print('\n'.join(errors) if errors else 'no console errors')
