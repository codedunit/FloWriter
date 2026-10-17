// =====================================================================
// FloWriter data layer.
// Views read the in-memory `DB` synchronously and change it only through
// `api.*`. Without a backend config this is a demo database kept in this
// browser; backend.js swaps the api bodies for Supabase calls.
// =====================================================================
const DAY = 864e5;
const STORE_KEY = 'flowriter-pilot-demo-v1';

function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const uid = p => p + Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Six songs ship with the app. They are synthesized in the browser, so no
// audio files are needed for the demo; teachers add MP3s to the library.
const STARTER_SONGS = [
  { id: 'sg_ovals', title: 'Moonlit Ovals', artist: 'FloWriter Studio', bpm: 66, style: 'Ballad', mood: 'calm', hue: 250 },
  { id: 'sg_paper', title: 'Paper Planes', artist: 'FloWriter Studio', bpm: 72, style: 'Lo-fi', mood: 'calm', hue: 205 },
  { id: 'sg_sunny', title: 'Sunny Steps', artist: 'FloWriter Studio', bpm: 84, style: 'Bright pop', mood: 'bright', hue: 38 },
  { id: 'sg_march', title: 'Marching Pencils', artist: 'FloWriter Studio', bpm: 96, style: 'March', mood: 'bold', hue: 10 },
  { id: 'sg_loop', title: 'Loop de Loop', artist: 'FloWriter Studio', bpm: 108, style: 'Funk', mood: 'bright', hue: 150 },
  { id: 'sg_ff', title: 'Fortissimo', artist: 'FloWriter Studio', bpm: 120, style: 'Rock', mood: 'bold', hue: 340 },
].map(s => ({ ...s, kind: 'starter', offset: .5 }));

// Song difficulty follows tempo: slower songs give young writers more time per stroke.
const songLevel = bpm => bpm < 80 ? 'easy' : bpm < 105 ? 'medium' : 'hard';
const LEVEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
// Margin of error (percent of the x-height) and beats per stroke for each lesson difficulty.
const DIFF = { easy: { label: 'Easy', tol: 26, note: 'Wide margin' }, standard: { label: 'Standard', tol: 18, note: 'Normal margin' }, challenge: { label: 'Challenge', tol: 12, note: 'Tight margin' } };
const THEMES = [
  { id: '', label: 'Plain paper' }, { id: 'classroom', label: 'Classroom' }, { id: 'space', label: 'Space station' },
  { id: 'treehouse', label: 'Treehouse' }, { id: 'submarine', label: 'Submarine' }, { id: 'study', label: 'Wizard study' },
  { id: 'studio', label: 'Art studio' }, { id: 'campfire', label: 'Night camp' },
];
const HARD_LETTERS = { k: .1, f: .09, z: .12, q: .08, s: .07, r: .06, b: .05, x: .05, G: .1, S: .08, Q: .1 };

// ---------------------------------------------------------------- seed
const FIRST = ['Maya','Leo','Ava','Noah','Zoe','Eli','Ivy','Owen','Mia','Kai','Luna','Theo','Nora','Jude','Ruby','Finn','Isla','Milo','Cora','Ezra','Hazel','Omar','Lila','Axel','Jade','Remy','Sage','Nico','Tess','Hugo','Pia','Rafa','June','Otis','Wren','Arlo'];
const LASTI = 'ABCDEFGHJKLMNPRSTVWYZ';
function seedDB(){
  const r = rng(20261016), now = Date.now();
  const db = { v: 1, users: [], classes: [], lessons: [], attempts: [], songs: STARTER_SONGS.map(s => ({ ...s })) };
  const school = 'Bayou Elementary';
  db.users.push({ id: 'u_murry', username: 'mr_murry', email: 'murry@bayou.example', password: 'teacher2026', role: 'teacher', name: 'Mr. Murry', school, joined: now - 60 * DAY, attested: now - 60 * DAY, admin: true });
  db.users.push({ id: 'u_rivera', username: 'ms_rivera', email: 'rivera@lakeside.example', password: 'teacher2026', role: 'teacher', name: 'Ms. Rivera', school: 'Lakeside Elementary', joined: now - 50 * DAY, attested: now - 50 * DAY });
  db.classes.push({ id: 'c_l3', teacherId: 'u_rivera', name: 'Room 3 · 2nd grade', code: 'RIVER3', school: 'Lakeside Elementary', archived: false, created: now - 45 * DAY, sequential: true });
  db.classes.push({ id: 'c_p2', teacherId: 'u_murry', name: 'Period 2 · 3rd grade', code: 'MURRY2', school, archived: false, created: now - 40 * DAY, message: 'Ten minutes of FloWriter every day this week. Watch the demo before you practice!' });
  db.classes.push({ id: 'c_r12', teacherId: 'u_murry', name: 'Room 12 · 2nd grade', code: 'LOOPS4', school, archived: false, created: now - 30 * DAY });
  // the persona from the proposal: a 2nd/3rd grader who loves games
  db.users.push({ id: 'u_evan', username: 'evan_writes', password: 'flowriter1', role: 'student', name: 'Evan S.', classId: 'c_p2', school, joined: now - 38 * DAY, skill: .86, effort: .9 });
  let k = 0;
  [['c_p2', 21], ['c_r12', 14], ['c_l3', 16]].forEach(([cid, n]) => {
    for (let i = 0; i < n; i++, k++){
      const f = FIRST[k % FIRST.length], l = LASTI[(k * 7) % LASTI.length];
      db.users.push({ id: 'u_s' + k, username: (f + '_' + l).toLowerCase(), password: 'student123', role: 'student', name: `${f} ${l}.`, classId: cid, school: cid === 'c_l3' ? 'Lakeside Elementary' : school, joined: now - Math.floor((cid === 'c_l3' ? 40 : 25) + r() * 12) * DAY, skill: .55 + r() * .4, effort: .35 + r() * .65 });
    }
  });
  const L = (cid, preset, title, text, songId, created, due, extra = {}) => db.lessons.push({ id: uid('l_'), classId: cid, preset, title, text, songId, mult: 1, bps: 1, rest: 1, difficulty: 'standard', theme: 'classroom', created: now - created * DAY, due: due == null ? null : now + due * DAY, studentIds: null, kind: 'lesson', ...extra });
  const CHECK = 'The quick brown fox jumps over the lazy dog.';
  L('c_p2', null, 'Handwriting check: start', CHECK, null, 26, null, { kind: 'check', theme: '' });
  L('c_r12', null, 'Handwriting check: start', CHECK, null, 21, null, { kind: 'check', theme: '' });
  L('c_l3', null, 'Handwriting check: start', CHECK, null, 40, null, { kind: 'check', theme: '' });
  L('c_l3', 'zb1', 'Undercurve letters', 'i t u w it wit tutu', 'sg_ovals', 38, -30, { difficulty: 'easy', bps: 2 });
  L('c_l3', 'zb2', 'More undercurve letters', 'r s p j rust trip jut wisp', 'sg_paper', 30, -22, { difficulty: 'easy' });
  L('c_l3', 'zb3', 'Undercurve loops', 'e l h k f b tell help kite fish blue', 'sg_paper', 20, -12, { difficulty: 'easy', theme: 'treehouse' });
  L('c_l3', 'zb4', 'Downcurve letters', 'a d g o c q dog cat good quiet', 'sg_sunny', 10, -2, { theme: 'submarine' });
  L('c_l3', null, 'Handwriting check: end of month', CHECK, null, 3, null, { kind: 'check', theme: '' });
  L('c_p2', 'zb1', 'Undercurve letters', 'i t u w it wit tutu', 'sg_paper', 24, -17, { difficulty: 'easy' });
  L('c_p2', 'zb2', 'More undercurve letters', 'r s p j rust trip jut wisp', 'sg_paper', 17, -10, { theme: 'treehouse' });
  L('c_p2', 'zb3', 'Undercurve loops', 'e l h k f b tell help kite fish blue', 'sg_sunny', 9, 2, { theme: 'space' });
  L('c_p2', null, 'Music words', 'drum song flute piano beat tempo', 'sg_march', 4, 6, { theme: 'studio', mult: 1 });
  L('c_p2', 'zb4', 'Downcurve letters', 'a d g o c q dog cat good quiet', 'sg_ovals', 1, 9, { theme: 'campfire' });
  L('c_r12', 'zb1', 'Undercurve letters', 'i t u w it wit tutu', 'sg_ovals', 20, -12, { difficulty: 'easy', bps: 2 });
  L('c_r12', 'zb2', 'More undercurve letters', 'r s p j rust trip jut wisp', 'sg_paper', 8, 3, { difficulty: 'easy', theme: 'submarine' });

  // attempt history: each student works through each lesson at their own pace
  db.users.filter(u => u.role === 'student').forEach(u => {
    db.lessons.filter(l => l.classId === u.classId).forEach((l, li) => {
      const age = (now - l.created) / DAY; if (u.id === 'u_evan' && l.preset === 'zb4') return;
      if (l.kind === 'check') {
        if (r() > .92) return;
        const later = (now - l.created) < 15 * DAY && l.classId === 'c_l3', base = clamp(u.skill - (later ? .02 : .2) + (r() - .5) * .1, .2, .97), total = Cursive.build(l.text).strokes.length;
        const letters = [...new Set(l.text.replace(/[^A-Za-z]/g, ''))].map(ch => ({ ch, score: Math.round(clamp(base - (HARD_LETTERS[ch] || 0) * 2 + (r() - .5) * .16, 0, 1) * 1000) / 1000, n: 1, rev: r() < .1 ? 1 : 0 }));
        const sc = letters.reduce((a, x) => a + x.score, 0) / letters.length;
        db.attempts.push({ id: uid('t_'), userId: u.id, lessonId: l.id, mode: 'test', score: Math.round(sc * 1000) / 1000, valid: Math.round(total * sc), total, reversed: letters.reduce((a, x) => a + x.rev, 0), gate: null, bpm: null, seconds: Math.round(150 + r() * 120), letters, date: Math.min(now - 3600e3, l.created + r() * 2 * DAY) });
        return;
      }
      const engaged = r() < .25 + u.effort * .75 || (u.id === 'u_evan') || (l.classId === 'c_l3' && r() < .8);
      if (!engaged) return;
      const start = l.created + (r() * Math.min(3, age * .3)) * DAY;
      const total = Cursive.build(l.text).strokes.length;
      let t = start;
      const nDemo = 1 + Math.floor(r() * 2), nPrac = 1 + Math.floor(u.effort * 5 * r() + (u.id === 'u_evan' ? 3 : 0));
      const rec = (mode, score, extra = {}) => { const date = Math.min(t, now - 60e3); db.attempts.push({ id: uid('t_'), userId: u.id, lessonId: l.id, mode, score, valid: score == null ? 0 : Math.round(total * clamp(score + .08, 0, 1)), total, reversed: 0, gate: null, bpm: null, seconds: 0, letters: null, date, ...extra }); };
      for (let i = 0; i < nDemo; i++){ rec('demo', null, { seconds: 25 }); t += (2 + r() * 20) * 6e4; }
      if (t > now) return;
      const done = Math.min(nPrac, Math.max(1, Math.floor(nPrac * Math.min(1, age / 4))));
      for (let i = 0; i < done; i++){
        const sc = clamp(u.skill - .18 + i * .05 + (r() - .5) * .12, .2, .99);
        const gate = ['hold', 'hold', 'duck', 'duck', 'off'][Math.min(i, 4)];
        rec('practice', sc, { seconds: Math.round(60 + r() * 180), gate, bpm: 84 }); t += (5 + r() * 30) * 6e4 + (r() < .4 ? DAY : 0);
        if (t > now) return;
      }
      const testable = l.preset !== 'zb3' || u.id !== 'u_evan';
      if (done >= 1 && testable && r() < Math.min(.95, age / 9 + u.effort * .3)){
        const base = clamp(u.skill - .05 + done * .02 + (r() - .5) * .1, .3, .99);
        const letters = [...new Set(l.text.replace(/[^A-Za-z]/g, ''))].map(ch => ({ ch, score: Math.round(clamp(base - (HARD_LETTERS[ch] || 0) * 2 + (r() - .5) * .16, 0, 1) * 1000) / 1000, n: 2, rev: r() < .08 ? 1 : 0 }));
        const sc = letters.reduce((a, x) => a + x.score, 0) / letters.length;
        rec('test', Math.round(sc * 1000) / 1000, { seconds: Math.round(90 + r() * 120), letters, reversed: letters.reduce((a, x) => a + x.rev, 0) });
      }
    });
    u.lastSeen = Math.max(u.joined, ...db.attempts.filter(a => a.userId === u.id).map(a => a.date));
  });
  // a few students writing right now, for the live activity panel
  db.users.filter(u => u.classId === 'c_p2').slice(0, 5).forEach((u, i) => {
    const l = db.lessons.find(l => l.classId === 'c_p2' && l.preset === 'zb3');
    db.attempts.push({ id: uid('t_'), userId: u.id, lessonId: l.id, mode: 'practice', score: .7 + i * .05, valid: 30, total: 40, reversed: 0, gate: 'hold', bpm: 84, seconds: 140, letters: null, date: now - (3 + i * 5) * 6e4 });
    u.lastSeen = now - (3 + i * 5) * 6e4;
  });
  db.attempts.sort((a, b) => a.date - b.date);
  db.users.forEach(u => { delete u.skill; delete u.effort; });
  return db;
}

// ---------------------------------------------------------------- persistence (demo only)
let DB;
const RUNTIME = { songFiles: {}, traces: {} }; // uploaded audio and trace images: memory only in the demo
function loadDB(){
  try { const raw = localStorage.getItem(STORE_KEY); if (raw){ const d = JSON.parse(raw); if (d && d.v === 1) { DB = d; return; } } } catch (e) {}
  DB = seedDB();
}
function saveDB(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) {} }
loadDB();

// ---------------------------------------------------------------- rules
const RULES = {
  teacherPassword: p => p.length >= 8 && !/\s/.test(p),
  studentPassword: p => p.length >= 6 && !/\s/.test(p),
  username: u => /^[a-z0-9_.-]{3,24}$/i.test(u),
  email: e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
};
function newCode(){ const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return DB.classes.some(c => c.code === s) ? newCode() : s; }
const KID_WORDS = ['tiger','piano','comet','maple','river','otter','drum','violin','panda','rocket','lemon','robin','tulip','zebra','banjo','koala'];
// first name + last initial + 2 digits, unique: maya_a27
function uniqueStudentName(name){ const [f, l] = (name || 'student').toLowerCase().replace(/[^a-z ]/g, '').split(' '); let u; do { u = (f || 'student').slice(0, 12) + (l ? '_' + l[0] : '') + (10 + Math.floor(Math.random() * 90)); } while (DB.users.some(x => x.username === u)); return u; }
function kidPassword(){ return pick(Math.random, KID_WORDS) + (10 + Math.floor(Math.random() * 90)); }

// ---------------------------------------------------------------- derived
const userById = id => DB.users.find(u => u.id === id);
const classById = id => DB.classes.find(c => c.id === id);
const lessonById = id => DB.lessons.find(l => l.id === id);
const songById = id => DB.songs.find(s => s.id === id);
const classStudents = cid => DB.users.filter(u => u.role === 'student' && u.classId === cid).sort((a, b) => a.name.localeCompare(b.name));
const lessonsForClass = cid => DB.lessons.filter(l => l.classId === cid).sort((a, b) => b.created - a.created);
const lessonsForStudent = u => !u.classId ? [] : DB.lessons.filter(l => l.classId === u.classId && (!l.studentIds || l.studentIds.includes(u.id))).sort((a, b) => a.created - b.created);
const isCheck = l => !!l && l.kind === 'check';
// In a class set to "one at a time", a lesson opens when every earlier lesson is done (handwriting checks are always open).
function lessonLocked(u, l){
  const c = classById(l.classId); if (!c || !c.sequential || isCheck(l)) return null;
  const before = lessonsForStudent(u).filter(x => !isCheck(x) && x.created < l.created);
  const open = before.find(x => !progress(u.id, x.id).done);
  return open || null;
}
const assignedTo = l => l.studentIds ? classStudents(l.classId).filter(s => l.studentIds.includes(s.id)) : classStudents(l.classId);
// progress on one lesson: the three steps
function progress(userId, lessonId){
  const at = DB.attempts.filter(a => a.userId === userId && a.lessonId === lessonId), chk = isCheck(lessonById(lessonId));
  const demo = at.filter(a => a.mode === 'demo').length, prac = at.filter(a => a.mode === 'practice');
  const test = at.find(a => a.mode === 'test') || null;
  const seconds = at.reduce((s, a) => s + (a.seconds || 0), 0);
  const bestPractice = prac.reduce((b, a) => Math.max(b, a.score || 0), 0);
  const step = test ? 3 : prac.length ? 2 : demo ? 1 : 0;
  return { demo, practice: prac.length, test, done: chk ? !!test : !!(demo && prac.length && test), step: chk && test ? 3 : step, check: chk, seconds, bestPractice, last: at.length ? Math.max(...at.map(a => a.date)) : null, started: at.length > 0 };
}
function studentStats(uid_, from = 0, to = Infinity){
  const at = DB.attempts.filter(a => a.userId === uid_ && a.date >= from && a.date < to);
  const tests = at.filter(a => a.mode === 'test' && !isCheck(lessonById(a.lessonId)));
  return { attempts: at, tests, seconds: at.reduce((s, a) => s + (a.seconds || 0), 0), avgTest: tests.length ? tests.reduce((s, a) => s + a.score, 0) / tests.length : null,
    practice: at.filter(a => a.mode === 'practice').length, reversed: tests.reduce((s, a) => s + (a.reversed || 0), 0) };
}
function lessonCompletion(l){ const kids = assignedTo(l); const done = kids.filter(k => progress(k.id, l.id).done).length; return { done, total: kids.length, pct: kids.length ? done / kids.length : 0 }; }
// per-letter averages from test runs, worst first
function letterReport(attempts){
  const m = new Map();
  attempts.filter(a => a.mode === 'test' && a.letters).forEach(a => a.letters.forEach(x => { const e = m.get(x.ch) || { ch: x.ch, sum: 0, n: 0, rev: 0 }; e.sum += x.score; e.n++; e.rev += x.rev || 0; m.set(x.ch, e); }));
  return [...m.values()].map(e => ({ ch: e.ch, avg: e.sum / e.n, n: e.n, rev: e.rev })).sort((a, b) => a.avg - b.avg);
}

// ---------------------------------------------------------------- api (demo)
const delay = (v, ms = 150) => new Promise(r => setTimeout(() => r(v), ms));
const fail = msg => Promise.reject(new Error(msg));
const api = {
  demo: true,
  login(id, password){
    const u = DB.users.find(u => u.username.toLowerCase() === id.trim().toLowerCase() || (u.email || '').toLowerCase() === id.trim().toLowerCase());
    if (!u) return fail('No account with that username or email.');
    if (u.password !== password) return fail('That password doesn’t match this account.');
    u.lastSeen = Date.now(); saveDB(); return delay(u);
  },
  signupTeacher(f){
    if (!f.name) return fail('Enter your name as students know it, like Ms. Rivera.');
    if (!RULES.email(f.email)) return fail('Enter a valid email address.');
    if (!RULES.teacherPassword(f.password)) return fail('Passwords need at least 8 characters and no spaces.');
    if (!f.attest) return fail('Confirm that your school allows students to use FloWriter.');
    if (DB.users.some(u => (u.email || '').toLowerCase() === f.email.toLowerCase())) return fail('An account already uses that email.');
    const u = { id: uid('u_'), username: f.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20) + Math.floor(Math.random() * 90 + 10), email: f.email, password: f.password, role: 'teacher', name: f.name, school: f.school || 'My school', joined: Date.now(), attested: Date.now(), lastSeen: Date.now() };
    DB.users.push(u);
    DB.classes.push({ id: uid('c_'), teacherId: u.id, name: 'My class', code: newCode(), school: u.school, archived: false, created: Date.now() });
    saveDB(); return delay(u);
  },
  lookupClass(code){
    const c = DB.classes.find(c => c.code === (code || '').trim().toUpperCase() && !c.archived);
    return delay(c ? { id: c.id, name: c.name, teacher: (userById(c.teacherId) || {}).name || 'your teacher' } : null);
  },
  joinClass(f){
    const c = DB.classes.find(c => c.code === (f.code || '').trim().toUpperCase() && !c.archived);
    if (!c) return fail('That class code doesn’t match an open class. Check the code with your teacher.');
    if (!f.name) return fail('Type your first name and the first letter of your last name.');
    if (!RULES.username(f.username)) return fail('Usernames are 3 to 24 letters or numbers, with no spaces.');
    if (!RULES.studentPassword(f.password)) return fail('Passwords need at least 6 characters and no spaces.');
    if (DB.users.some(u => u.username.toLowerCase() === f.username.toLowerCase())) return fail('That username is taken. Try adding a number.');
    const u = { id: uid('u_'), username: f.username.toLowerCase(), password: f.password, role: 'student', name: f.name, classId: c.id, school: c.school, joined: Date.now(), lastSeen: Date.now() };
    DB.users.push(u); saveDB(); return delay(u);
  },
  logout(){},
  requestReset(email){ const u = DB.users.find(u => (u.email || '').toLowerCase() === email.trim().toLowerCase()); return delay({ demoUser: u ? u.id : null }); },
  updatePassword(pw, demoUserId){ if (!RULES.teacherPassword(pw)) return fail('Passwords need at least 8 characters and no spaces.'); const u = userById(demoUserId || (state.user || {}).id); if (!u) return fail('That reset link has expired. Ask for a new one.'); u.password = pw; saveDB(); return delay(u); },
  updateProfile(patch){ Object.assign(state.user, patch); saveDB(); },
  changeClass(code){ const c = DB.classes.find(c => c.code === (code || '').trim().toUpperCase() && !c.archived); if (!c) return fail('That code doesn’t match an open class. Check it with your teacher.'); state.user.classId = c.id; state.user.school = c.school; saveDB(); return delay(c); },
  moveStudent(id, cid){ userById(id).classId = cid; saveDB(); },
  deleteStudent(id){ DB.users = DB.users.filter(u => u.id !== id); DB.attempts = DB.attempts.filter(a => a.userId !== id); saveDB(); return delay(true); },
  // Teacher adds students by name. Usernames and passwords are made for them; the cards print them.
  async createStudents(cid, names, onEach){
    const c = classById(cid), out = [];
    for (const name of names){
      const username = uniqueStudentName(name), password = kidPassword();
      const u = { id: uid('u_'), username, password, role: 'student', name, classId: cid, school: c.school, joined: Date.now(), lastSeen: null };
      DB.users.push(u); out.push({ user: u, password }); onEach && onEach(out.length);
    }
    saveDB(); return out;
  },
  async newPasswords(ids){ const out = ids.map(id => { const u = userById(id), password = kidPassword(); u.password = password; return { user: u, password }; }); saveDB(); return out; },
  sendFeedback(f){ (DB.feedback = DB.feedback || []).push({ id: uid('f_'), userId: state.user.id, role: state.user.role, date: Date.now(), ...f }); saveDB(); return delay(true); },
  recordAttempt(a){
    if (a.mode === 'test') { const had = DB.attempts.find(x => x.userId === a.userId && x.lessonId === a.lessonId && x.mode === 'test'); if (had) return had; }
    const rec = { id: uid('t_'), date: Date.now(), ...a }; if (rec.trace) { RUNTIME.traces[rec.id] = rec.trace; delete rec.trace; }
    DB.attempts.push(rec); const u = userById(a.userId); if (u) u.lastSeen = Date.now(); saveDB(); return rec;
  },
  addSeconds(attemptId, seconds){ const a = DB.attempts.find(a => a.id === attemptId); if (a) { a.seconds = (a.seconds || 0) + seconds; saveDB(); } },
  saveLesson(l){
    if (l.id) { const i = DB.lessons.findIndex(x => x.id === l.id); DB.lessons[i] = { ...DB.lessons[i], ...l }; saveDB(); return DB.lessons[i]; }
    const n = { ...l, id: uid('l_'), created: Date.now() }; DB.lessons.push(n); saveDB(); return n;
  },
  deleteLesson(id){ DB.lessons = DB.lessons.filter(l => l.id !== id); saveDB(); },
  addClass(teacher, name){ const c = { id: uid('c_'), teacherId: teacher.id, name, code: newCode(), school: teacher.school, archived: false, created: Date.now() }; DB.classes.push(c); saveDB(); return c; },
  renameClass(cid, name){ classById(cid).name = name; saveDB(); },
  setSequential(cid, on){ classById(cid).sequential = on; saveDB(); },
  saveClassMessage(cid, message){ classById(cid).message = message; saveDB(); },
  regenCode(cid){ const c = classById(cid); c.code = newCode(); saveDB(); return c.code; },
  archiveClass(cid, on){ classById(cid).archived = on; saveDB(); },
  removeStudent(id){ userById(id).classId = null; saveDB(); },
  resetStudentPassword(id){ const pw = kidPassword(); userById(id).password = pw; saveDB(); return delay(pw); },
  addSong(s, file){ const song = { ...s, id: uid('sg_'), kind: 'upload', created: Date.now() }; DB.songs.push(song); if (file) RUNTIME.songFiles[song.id] = file; saveDB(); return delay(song); },
  updateSong(id, patch){ Object.assign(songById(id), patch); saveDB(); },
  deleteSong(id){ DB.songs = DB.songs.filter(s => s.id !== id); saveDB(); },
  async songFile(song, seconds){ if (song.kind === 'starter') return Music.starterFile(song, seconds); return RUNTIME.songFiles[song.id] || null; },
  trace(attempt){ return Promise.resolve(RUNTIME.traces[attempt.id] || null); },
  refresh(){ return Promise.resolve(); },
  resetDemo(){ try { localStorage.removeItem(STORE_KEY); } catch (e) {} DB = seedDB(); saveDB(); },
};
