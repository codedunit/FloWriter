"""Accessibility check with axe-core on every main page (WCAG 2.1 A/AA rules).
Usage: python3 tools/test_a11y.py path/to/axe.min.js"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright
AXE = pathlib.Path(sys.argv[1]).read_text()
SITE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
PAGES = {
  'guest': ['#/', '#/login', '#/signup', '#/join?code=MURRY2', '#/forgot', '#/privacy'],
  'teacher': ['#/dashboard', '#/classes', '#/class?id=c_p2', '#/class?id=c_p2&tab=students', '#/class?id=c_p2&tab=lessons', '#/class?id=c_p2&tab=checks', '#/class?id=c_p2&tab=letters', '#/student?id=u_evan', '#/lessons', '#/lesson-edit', '#/songs', '#/account', '#/admin'],
  'student': ['#/home', '#/progress'],
}
total = 0
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.goto(SITE); pg.wait_for_timeout(800); pg.evaluate("api.resetDemo(); setSession(null)")
    for who, hashes in PAGES.items():
        if who != 'guest':
            pg.evaluate("setSession(null)"); pg.evaluate(f"setSession(userById('{'u_murry' if who == 'teacher' else 'u_evan'}'))")
        for h in hashes:
            pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(500)
            pg.evaluate(AXE)
            res = pg.evaluate("axe.run(document, {runOnly:{type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}, resultTypes:['violations']}).then(r=>r.violations.map(v=>({id:v.id, impact:v.impact, n:v.nodes.length, help:v.help, sample:v.nodes.slice(0,2).map(x=>x.target.join(' ')+' :: '+(x.failureSummary||'').split('\\n').slice(1,2).join(''))})))")
            if res:
                total += sum(v['n'] for v in res)
                print(f"\n{who} {h}")
                for v in res: print(f"  {v['impact']:9} {v['id']} x{v['n']}: {v['help']}\n      {v['sample']}")
    b.close()
print(f"\n{total} violations")
sys.exit(1 if total else 0)
