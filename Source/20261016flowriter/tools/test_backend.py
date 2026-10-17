"""The Supabase adapter (backend.js) against an in-browser fake of supabase-js:
pagination past 1000 rows, the offline outbox (failures, retries, duplicates, reloads),
creating student accounts with a side client, and the password-reset return."""
import sys, pathlib, shutil, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fwbackend'); OUT.mkdir(parents=True, exist_ok=True)
SITE = OUT / 'site'; SITE.mkdir(exist_ok=True)
shutil.copy(ROOT / 'dist' / 'index.html', SITE / 'index.html')
(SITE / 'config.js').write_text("window.FLOWRITER_CONFIG={url:'https://fake.supabase.co',anonKey:'anon',studentEmailDomain:'students.test'};")
results = []
def check(name, ok, info=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))

FAKE = r"""
(() => {
  // A shared "server" kept in localStorage so it survives page reloads.
  const K = 'fake-sb-db';
  const load = () => JSON.parse(localStorage.getItem(K) || 'null');
  const save = d => localStorage.setItem(K, JSON.stringify(d));
  if (!load()) {
    const T = 't-1', S = 's-1', C = 'c-1', L = 'l-1', now = Date.now();
    const attempts = []; for (let i = 0; i < 2500; i++) attempts.push({ id: 'old-' + i, user_id: S, lesson_id: L, mode: 'practice', score: .8, valid: 5, total: 6, reversed: 0, gate: 'hold', bpm: 84, seconds: 30, letters: null, created: new Date(now - (2600 - i) * 60000).toISOString() });
    save({ users: { 't@school.org': { id: T, pw: 'teacherpass' }, 'sam@students.test': { id: S, pw: 'tiger12' } },
      profiles: [{ id: T, username: 'teach', role: 'teacher', name: 'Ms. T', school: 'Test School', class_id: null, joined: new Date(now).toISOString() }, { id: S, username: 'sam', role: 'student', name: 'Sam K.', school: 'Test School', class_id: C, joined: new Date(now).toISOString() }],
      classes: [{ id: C, teacher_id: T, name: 'Room 1', code: 'ROOM01', school: 'Test School', archived: false, sequential: false, created: new Date(now).toISOString() }],
      lessons: [{ id: L, class_id: C, title: 'Lesson', text: 'it', song_id: null, mult: 1, bps: 1, rest: 1, difficulty: 'standard', theme: '', kind: 'lesson', created: new Date(now).toISOString() }],
      attempts, songs: [], feedback: [], session: null, failInserts: 0, loseResponses: 0, inserts: 0, calls: [] });
  }
  const db = () => load();
  const ok = data => ({ data, error: null }), err = (message, code) => ({ data: null, error: { message, code } });
  class Q {
    constructor(t){ this.t = t; this.op = 'select'; this.f = []; this.r = null; this.single = false; }
    select(){ if (this.op === 'insert') { this.ret = true; return this; } this.op = 'select'; return this; }
    order(){ return this; } limit(){ return this; }
    range(a, b){ this.r = [a, b]; return this; }
    eq(c, v){ this.f.push([c, v]); return this; }
    maybeSingle(){ this.single = true; return this; }
    insert(row){ this.op = 'insert'; this.row = row; return this; }
    upsert(row){ this.op = 'upsert'; this.row = row; return this; }
    update(v){ this.op = 'update'; this.val = v; return this; }
    delete(){ this.op = 'delete'; return this; }
    then(res, rej){ return Promise.resolve().then(() => this.run()).then(res, rej); }
    run(){
      const d = db(); d.calls.push(this.t + ':' + this.op); const rows = d[this.t]; let out;
      const match = r => this.f.every(([c, v]) => r[c] === v);
      if (this.op === 'select') { out = rows.filter(match); if (this.r) out = out.slice(this.r[0], this.r[1] + 1); else out = out.slice(0, 1000); save(d); return ok(this.single ? out[0] || null : out); }
      if (this.op === 'insert') {
        if (this.t === 'attempts') {
          d.inserts++;
          if (d.failInserts > 0) { d.failInserts--; save(d); throw new TypeError('Failed to fetch'); }
          const r = this.row; if (r.mode === 'test' && rows.some(x => x.user_id === r.user_id && x.lesson_id === r.lesson_id && x.mode === 'test')) { save(d); return err('duplicate key value violates unique constraint "attempts_one_test"', '23505'); }
          rows.push({ ...r }); if (d.loseResponses > 0) { d.loseResponses--; save(d); throw new TypeError('Failed to fetch'); }
          save(d); return ok(null);
        }
        (Array.isArray(this.row) ? this.row : [this.row]).forEach(r => rows.push({ id: r.id || (this.t + '-' + rows.length), ...r })); save(d); return ok(null);
      }
      if (this.op === 'upsert') { const i = rows.findIndex(r => r.id === this.row.id); if (i >= 0) rows[i] = { ...rows[i], ...this.row }; else rows.push(this.row); save(d); return ok(null); }
      if (this.op === 'update') { rows.filter(match).forEach(r => Object.assign(r, this.val)); save(d); return ok(null); }
      if (this.op === 'delete') { d[this.t] = rows.filter(r => !match(r)); save(d); return ok(null); }
    }
  }
  function client(url, key, opts){
    const persist = !(opts && opts.auth && opts.auth.persistSession === false); let local = null;
    const sess = () => persist ? db().session : local;
    const setSess = s => { if (persist) { const d = db(); d.session = s; save(d); } else local = s; };
    const listeners = [];
    const c = {
      from: t => new Q(t),
      rpc: async (name, args) => { const d = db(); d.calls.push('rpc:' + name); save(d);
        if (name === 'is_admin') return ok(false);
        if (name === 'username_taken') return ok(d.profiles.some(p => p.username === args.u));
        if (name === 'email_for_username') { const p = d.profiles.find(p => p.username === args.u); const e = p && Object.keys(d.users).find(k => d.users[k].id === p.id); return ok(e || null); }
        if (name === 'class_for_code') { const cl = d.classes.find(x => x.code === args.c.toUpperCase()); return ok(cl ? [{ id: cl.id, name: cl.name, teacher: 'Ms. T' }] : []); }
        if (name === 'reset_student_password') { const e = Object.keys(d.users).find(k => d.users[k].id === args.student); d.users[e].pw = args.new_password; save(d); return ok(null); }
        return ok(null); },
      auth: {
        onAuthStateChange: cb => { listeners.push(cb); if (/type=recovery/.test(location.hash)) setTimeout(() => cb('PASSWORD_RECOVERY', { user: { id: 't-1' } }), 0); return { data: { subscription: { unsubscribe(){} } } }; },
        getSession: async () => { if (/type=recovery/.test(location.hash)) setSess({ user: { id: 't-1' } }); return ok({ session: sess() }); },
        signInWithPassword: async ({ email, password }) => { const u = db().users[email]; if (!u || u.pw !== password) return err('Invalid login credentials'); setSess({ user: { id: u.id } }); return ok({ user: { id: u.id } }); },
        signUp: async ({ email, password }) => { const d = db(); if (d.users[email]) return err('User already registered'); const id = 'u-' + Object.keys(d.users).length; d.users[email] = { id, pw: password }; save(d); setSess({ user: { id } }); return ok({ user: { id }, session: { user: { id } } }); },
        signOut: async () => { setSess(null); return ok(null); },
        resetPasswordForEmail: async () => ok(null),
        updateUser: async ({ password }) => { const d = db(), id = sess().user.id, e = Object.keys(d.users).find(k => d.users[k].id === id); d.users[e].pw = password; save(d); return ok({ user: { id } }); },
      },
      channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), removeChannel(){},
      storage: { from: () => ({ upload: async () => ok(null), download: async () => ok(new Blob()), remove: async () => ok(null) }) },
    };
    return c;
  }
  window.supabase = { createClient: client };
})();
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1200, 'height': 900})
    ctx.add_init_script(FAKE)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    url = (SITE / 'index.html').as_uri()
    pg.goto(url); pg.wait_for_timeout(1200)
    sdb = lambda expr: pg.evaluate(f"(()=>{{ const d=JSON.parse(localStorage.getItem('fake-sb-db')); return {expr}; }})()")
    check('site boots in Supabase mode', pg.evaluate("api.demo") is False)

    # teacher: pagination
    pg.evaluate("location.hash='#/login'"); pg.wait_for_timeout(300)
    pg.fill('#liId', 't@school.org'); pg.fill('#liPw', 'teacherpass'); pg.click('form[data-form="login"] button[type="submit"]'); pg.wait_for_timeout(1200)
    check('teacher signs in', pg.evaluate("state.user && state.user.role") == 'teacher')
    check('all 2500 attempts load (past the 1000-row page limit)', pg.evaluate("DB.attempts.length") == 2500, str(pg.evaluate("DB.attempts.length")))
    # bulk add students with the side client
    pg.evaluate("location.hash='#/class?id=c-1&tab=students'"); pg.wait_for_timeout(500)
    pg.click('[data-act="add-students"]'); pg.fill('#asNames', 'Ana B\nLeo C'); pg.click('form[data-form="add-students"] button[type="submit"]'); pg.wait_for_timeout(1500)
    made = sdb("d.profiles.filter(p=>p.role==='student').map(p=>p.name+'|'+p.class_id)")
    check('bulk-added students get server accounts in the class', 'Ana B.|c-1' in made and 'Leo C.|c-1' in made, str(made))
    check('the teacher stays signed in as themself', sdb("d.session && d.session.user.id") == 't-1' and pg.evaluate("state.user.id") == 't-1')
    pw = pg.evaluate("document.querySelectorAll('.lcard dd')[1].textContent"); un = pg.evaluate("document.querySelectorAll('.lcard dd')[0].textContent")
    check('card password works on the server', sdb(f"d.users['{un}@students.test'].pw") == pw)
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(400)

    # student: test result while offline -> outbox -> reload -> retry
    pg.evaluate("location.hash='#/login'"); pg.wait_for_timeout(300)
    pg.fill('#liId', 'sam'); pg.fill('#liPw', 'tiger12'); pg.click('form[data-form="login"] button[type="submit"]'); pg.wait_for_timeout(1200)
    check('student signs in by username', pg.evaluate("state.user && state.user.name") == 'Sam K.')
    pg.evaluate("(()=>{ const d=JSON.parse(localStorage.getItem('fake-sb-db')); d.failInserts=99; localStorage.setItem('fake-sb-db', JSON.stringify(d)); })()")
    pg.evaluate("api.recordAttempt({userId:'s-1', lessonId:'l-1', mode:'test', score:.86, valid:5, total:6, reversed:0, letters:[{ch:'i',score:.9}], trace:'data:image/jpeg;base64,AAAA'})")
    pg.wait_for_timeout(600)
    check('a test made offline waits in the outbox', len(pg.evaluate("JSON.parse(localStorage.getItem('flowriter-outbox'))")) == 1)
    check('the student sees it is still saving', 'Saving 1 run' in (pg.text_content('#saveState') or ''), pg.text_content('#saveState'))
    pg.reload(); pg.wait_for_timeout(1500)
    check('after a reload the test still counts as taken', pg.evaluate("progress('s-1','l-1').test && progress('s-1','l-1').test.score") == .86)
    check('so it cannot be taken twice', pg.evaluate("DB.attempts.filter(a=>a.mode==='test').length") == 1)
    # connection back, but the server's reply is lost once: the retry hits the unique index and is treated as saved
    pg.evaluate("(()=>{ const d=JSON.parse(localStorage.getItem('fake-sb-db')); d.failInserts=0; d.loseResponses=1; localStorage.setItem('fake-sb-db', JSON.stringify(d)); })()")
    pg.evaluate("dispatchEvent(new Event('online'))"); pg.wait_for_timeout(800)
    pg.evaluate("dispatchEvent(new Event('online'))"); pg.wait_for_timeout(800)
    check('when the connection returns the test reaches the server once', sdb("d.attempts.filter(a=>a.mode==='test').length") == 1)
    check('and the outbox empties', pg.evaluate("JSON.parse(localStorage.getItem('flowriter-outbox')||'[]').length") == 0)
    check('the trace image is saved with it', sdb("d.attempts.find(a=>a.mode==='test').trace") == 'data:image/jpeg;base64,AAAA')
    # practice seconds added while the row is still queued
    pg.evaluate("(()=>{ const d=JSON.parse(localStorage.getItem('fake-sb-db')); d.failInserts=1; localStorage.setItem('fake-sb-db', JSON.stringify(d)); })()")
    pg.evaluate("window._r = api.recordAttempt({userId:'s-1', lessonId:'l-1', mode:'practice', score:.7, valid:4, total:6, seconds:20}); api.addSeconds(window._r.id, 40)")
    pg.wait_for_timeout(400); pg.evaluate("dispatchEvent(new Event('online'))"); pg.wait_for_timeout(800)
    check('practice time added while queued is kept', sdb("d.attempts.find(a=>a.id===%s).seconds" % json.dumps(pg.evaluate("window._r.id"))) == 60)
    pg.evaluate("ACT.logout()"); pg.wait_for_timeout(400)

    # teacher password reset return
    pg.close(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))   # the email link opens a fresh page
    sdb = lambda expr: pg.evaluate(f"(()=>{{ const d=JSON.parse(localStorage.getItem('fake-sb-db')); return {expr}; }})()")
    pg.goto(url + '#access_token=abc&type=recovery'); pg.wait_for_timeout(1500)
    check('the reset email link opens the new-password page', 'reset' in pg.url and pg.query_selector('#rsPw') is not None, pg.url)
    pg.fill('#rsPw', 'brandnew99'); pg.click('form[data-form="reset"] button[type="submit"]'); pg.wait_for_timeout(1000)
    check('the new password is saved and the teacher is in', sdb("d.users['t@school.org'].pw") == 'brandnew99' and 'dashboard' in pg.url, pg.url)
    check('no page errors', not errs, '; '.join(errs[:3]))
    b.close()
print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
