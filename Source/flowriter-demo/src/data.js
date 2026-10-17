// =====================================================================
// FloWriter mock backend
// Everything the UI needs goes through `api.*`, which returns Promises.
// Swap the bodies of these functions for real HTTP calls later; the
// views never touch DB directly.
// =====================================================================
const DAY = 864e5;
const STORE_KEY = 'flowriter-demo-db-v3';

// ---------- seeded random ----------
function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const uid = p => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- curriculum ----------
// Text only uses what the tracing engine can draw: A-Z a-z . , ! ? '
const CURRICULUM = [
  { id: 'letters', title: 'Letters', sub: 'Lowercase and capitals, one family at a time', lessons: [
    { id: 'l1', title: 'Undercurve letters', text: 'i t u w' },
    { id: 'l2', title: 'Ovals', text: 'a c d g o q' },
    { id: 'l3', title: 'Loops', text: 'e l h k b f' },
    { id: 'l4', title: 'Humps and tails', text: 'm n v x y z' },
    { id: 'l5', title: 'Capitals I', text: 'A C E O' },
    { id: 'l6', title: 'Capitals II', text: 'M N H K' },
  ]},
  { id: 'three', title: '3-letter phrases', sub: 'Short words that join letter to letter', lessons: [
    { id: 't1', title: 'Animals', text: 'cat dog pig hen' },
    { id: 't2', title: 'Around the house', text: 'mug cup bed rug' },
    { id: 't3', title: 'Action words', text: 'run hop dig sit' },
    { id: 't4', title: 'Music words', text: 'hum bop tap jam' },
  ]},
  { id: 'five', title: '5-letter phrases', sub: 'Longer joins and more loops', lessons: [
    { id: 'f1', title: 'Weather', text: 'sunny cloud rainy storm' },
    { id: 'f2', title: 'Orchestra', text: 'flute cello piano drums' },
    { id: 'f3', title: 'Nature', text: 'river plant ocean grass' },
    { id: 'f4', title: 'Feelings', text: 'happy proud brave eager' },
  ]},
  { id: 'sentences', title: 'Sentences', sub: 'Capitals, spaces, and punctuation', lessons: [
    { id: 's1', title: 'Hello, world', text: 'Hello, my name is on the page.' },
    { id: 's2', title: 'Keep the beat', text: 'I can write to the beat!' },
    { id: 's3', title: 'Questions', text: 'Can you hear the drum?' },
    { id: 's4', title: 'A tiny story', text: 'The cat sat on a red mat. It was happy.' },
  ]},
  { id: 'excerpts', title: 'Classic excerpts', sub: 'Real books from the public domain, with citations', live: true, lessons: [
    { id: 'e1', title: 'Excerpt I', excerpt: 0 },
    { id: 'e2', title: 'Excerpt II', excerpt: 1 },
    { id: 'e3', title: 'Excerpt III', excerpt: 2 },
  ]},
];

// Offline copies used when the live Project Gutenberg request can't be made.
const EXCERPTS = [
  { title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', year: 1865, gid: 11,
    text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do." },
  { title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', year: 1902, gid: 14838,
    text: 'Once upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cottontail, and Peter.' },
  { title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', year: 1900, gid: 55,
    text: 'Dorothy lived in the midst of the great Kansas prairies, with Uncle Henry, who was a farmer.' },
  { title: 'Peter Pan', author: 'J. M. Barrie', year: 1911, gid: 16,
    text: 'All children, except one, grow up.' },
  { title: 'The Secret Garden', author: 'Frances Hodgson Burnett', year: 1911, gid: 113,
    text: 'When Mary Lennox was sent to live with her uncle, everybody said she was the most disagreeable looking child ever seen.' },
  { title: "Aesop's Fables", author: 'Aesop, tr. G. F. Townsend', year: 1867, gid: 21,
    text: 'A Hare one day ridiculed the short feet and slow pace of the Tortoise.' },
];

// Random texts for Free Play, loosely matched to a song's feel
const FREE_TEXTS = {
  calm: ['The moon is soft and slow.', 'Quiet rivers hum along.', 'Rest your pen, then glide.', 'Stars drift over sleepy hills.'],
  bright: ['Sunny days are here!', 'Hop, skip, and write.', 'Lemons, limes, and bright blue skies.', 'Happy notes bounce on the page.'],
  bold: ['Loud drums, big loops!', 'March in time, write in line.', 'Brave hands make bold letters.', 'Faster, stronger, fortissimo!'],
};

const STARTER_SONGS = [
  { id: 'sg_paper', title: 'Paper Planes', artist: 'FloWriter Studio', bpm: 72, style: 'Lo-fi', mood: 'calm', hue: 205 },
  { id: 'sg_sunny', title: 'Sunny Steps', artist: 'FloWriter Studio', bpm: 84, style: 'Bright pop', mood: 'bright', hue: 38 },
  { id: 'sg_ovals', title: 'Moonlit Ovals', artist: 'FloWriter Studio', bpm: 66, style: 'Ballad', mood: 'calm', hue: 250 },
  { id: 'sg_march', title: 'Marching Pencils', artist: 'FloWriter Studio', bpm: 96, style: 'March', mood: 'bold', hue: 10 },
  { id: 'sg_loop', title: 'Loop de Loop', artist: 'FloWriter Studio', bpm: 108, style: 'Funk', mood: 'bright', hue: 150 },
  { id: 'sg_ff', title: 'Fortissimo', artist: 'FloWriter Studio', bpm: 120, style: 'Rock', mood: 'bold', hue: 340 },
];

const TEAM = [
  { name: 'Evan', role: 'Founder · product and curriculum', initials: 'E',
    bio: 'Neuroscience student at Johns Hopkins on the physician-scientist track, TEDx speaker, and former principal symphony musician. Built FloWriter to put rhythm back into handwriting.',
    fun: 'Plays hockey, collects antiques, and drills a 1000-entry memory palace.', linkedin: 'https://www.linkedin.com/' },
  { name: 'Teammate name', role: 'Engineering', initials: 'T',
    bio: 'Replace with a short bio: what they build on FloWriter and why handwriting matters to them.',
    fun: 'Replace with what they do for fun.', linkedin: 'https://www.linkedin.com/' },
  { name: 'Teammate name', role: 'Design and classroom research', initials: 'T',
    bio: 'Replace with a short bio: classroom pilots, teacher interviews, and the notebook look.',
    fun: 'Replace with what they do for fun.', linkedin: 'https://www.linkedin.com/' },
];

// ---------- word helpers ----------
const wordsOf = t => (t || '').toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(w => w.length > 1);
function lessonText(lesson){ return lesson.excerpt != null ? EXCERPTS[lesson.excerpt].text : lesson.text; }
function findLesson(id){ for (const m of CURRICULUM) for (const l of m.lessons) if (l.id === id) return { module: m, lesson: l }; return null; }

// ---------- seed ----------
const FIRST = ['Maya','Leo','Ava','Noah','Zoe','Eli','Ivy','Owen','Mia','Kai','Luna','Theo','Nora','Jude','Ruby','Finn','Isla','Milo','Cora','Ezra','Hazel','Omar','Lila','Axel','Jade','Remy','Sage','Nico','Tess','Hugo','Pia','Rafa','June','Otis','Wren','Arlo','Esme','Cruz','Dina','Bo'];
const LAST = 'ABCDEFGHJKLMNPRSTVWYZ'.split('');
const SEED_WORDS = ['cat','dog','pig','hen','mug','cup','bed','rug','run','hop','dig','sit','hum','bop','tap','jam','sunny','cloud','rainy','storm','flute','cello','piano','drums','river','plant','ocean','grass','happy','proud','brave','eager','hello','my','name','is','on','the','page','can','write','to','beat','you','hear','drum','red','mat','it','was','moon','soft','slow','stars','hills','loud','big','loops','march','time','line','sky','song','note','loop','glide'];

function seedDB(){
  const r = rng(20260919);
  const now = Date.now();
  const db = { v: 3, users: [], classes: [], assignments: [], attempts: [], songs: STARTER_SONGS.map(s => ({ ...s, kind: 'starter' })), resets: [] };
  const school = 'Bayou Elementary';
  db.users.push({ id: 'u_murry', username: 'mr_murry', email: 'murry@bayou.edu', password: 'teacher2026', role: 'teacher', name: 'Mr. Murry', school, joined: now - 400 * DAY });
  db.users.push({ id: 'u_rivera', username: 'ms_rivera', email: 'rivera@bayou.edu', password: 'teacher2026', role: 'teacher', name: 'Ms. Rivera', school, joined: now - 380 * DAY });
  const classes = [
    { id: 'c_p2', teacherId: 'u_murry', name: 'Period 2 · 3rd grade', code: 'MURRY2', size: 25 },
    { id: 'c_p4', teacherId: 'u_murry', name: 'Period 4 · 3rd grade', code: 'LOOPS4', size: 14 },
    { id: 'c_p6', teacherId: 'u_murry', name: 'Period 6 · Handwriting club', code: 'OVALS6', size: 9 },
    { id: 'c_r1', teacherId: 'u_rivera', name: 'Room 12 · 2nd grade', code: 'RIVR12', size: 16 },
  ];
  classes.forEach(c => db.classes.push({ id: c.id, teacherId: c.teacherId, name: c.name, code: c.code, school, archived: false, created: now - 390 * DAY }));

  // the persona from the proposal: Evan, 2nd/3rd grader who loves games
  db.users.push({ id: 'u_evan', username: 'evan_writes', email: 'evan.family@example.com', password: 'flowriter1', role: 'student', name: 'Evan', birth: '2018-04-12', classId: 'c_p2', school, joined: now - 330 * DAY, prog: 8 });
  let k = 0;
  classes.forEach(c => {
    const n = c.size - (c.id === 'c_p2' ? 1 : 0);
    for (let i = 0; i < n; i++){
      const f = FIRST[k % FIRST.length], l = LAST[(k * 7) % LAST.length]; k++;
      const joined = now - Math.floor((60 + r() * 300)) * DAY;
      db.users.push({ id: 'u_s' + k, username: (f + '_' + l).toLowerCase() + (k > FIRST.length ? k : ''), email: f.toLowerCase() + k + '@example.com', password: 'student123', role: 'student', name: f + ' ' + l + '.', birth: '2018-0' + (1 + Math.floor(r() * 9)) + '-1' + Math.floor(r() * 9), classId: c.id, school, joined, prog: Math.floor(r() * 12) });
    }
  });
  // general consumers (global leaderboard)
  ['cursive_fan','loopdeloop','inkwell_amy','quill_and_beat','grandpa_joe','penpal_sara','allegro_ben','scriptkid','slow_and_steady','the_ovalist'].forEach((u, i) => {
    db.users.push({ id: 'u_g' + i, username: u, email: u + '@example.com', password: i === 0 ? 'loopdeloop' : 'learner99', role: 'general', name: u, joined: now - Math.floor(30 + r() * 320) * DAY, prog: Math.floor(r() * 14) });
  });

  // assignments for Period 2 (and a few for others)
  const addA = (a) => db.assignments.push({ id: uid('a_'), created: now - 20 * DAY, studentIds: null, difficulty: 'standard', ...a });
  addA({ classId: 'c_p2', title: 'Ovals warm-up', module: 'letters', lessonId: 'l2', kind: 'practice', text: 'a c d g o q', due: now - 9 * DAY, songId: 'sg_paper', bpm: 72, difficulty: 'easy' });
  addA({ classId: 'c_p2', title: 'Letters check-in', module: 'letters', lessonId: 'l3', kind: 'test', text: 'e l h k b f', due: now - 4 * DAY, songId: 'sg_sunny', bpm: 84 });
  addA({ classId: 'c_p2', title: 'Animal words', module: 'three', lessonId: 't1', kind: 'practice', text: 'cat dog pig hen', due: now + 2 * DAY + 5 * 36e5, songId: 'sg_sunny', bpm: 84, created: now - 3 * DAY });
  addA({ classId: 'c_p2', title: 'Music words test', module: 'three', lessonId: 't4', kind: 'test', text: 'hum bop tap jam', due: now + 5 * DAY, songId: 'sg_loop', bpm: 108, difficulty: 'standard', created: now - 1 * DAY });
  addA({ classId: 'c_p2', title: 'First sentence', module: 'sentences', lessonId: 's1', kind: 'practice', text: 'Hello, my name is on the page.', due: now + 9 * DAY, songId: 'sg_ovals', bpm: 66, difficulty: 'easy', created: now - 1 * DAY });
  addA({ classId: 'c_p2', title: 'Extra loops for Evan', module: 'letters', lessonId: 'l3', kind: 'practice', text: 'e l h k', due: now + 4 * DAY, songId: 'sg_paper', bpm: 72, studentIds: ['u_evan'], difficulty: 'easy', created: now - 2 * DAY });
  addA({ classId: 'c_p4', title: 'Ovals warm-up', module: 'letters', lessonId: 'l2', kind: 'practice', text: 'a c d g o q', due: now + 3 * DAY, songId: 'sg_paper', bpm: 72 });
  addA({ classId: 'c_p6', title: 'Club challenge', module: 'sentences', lessonId: 's2', kind: 'test', text: 'I can write to the beat!', due: now + 6 * DAY, songId: 'sg_ff', bpm: 120, difficulty: 'challenge' });

  // attempt history
  const allLessons = CURRICULUM.flatMap(m => m.lessons.map(l => ({ m: m.id, l })));
  db.users.filter(u => u.role !== 'teacher').forEach(u => {
    const skill = u.id === 'u_evan' ? .86 : .62 + r() * .33;
    const days = Math.floor((now - u.joined) / DAY);
    const sessions = u.id === 'u_evan' ? 95 : Math.floor(20 + r() * 50);
    for (let i = 0; i < sessions; i++){
      const frac = i / sessions;
      const d = now - Math.floor(days * (1 - frac)) * DAY + Math.floor(r() * 10) * 36e5 - 5 * 36e5;
      const li = Math.min(allLessons.length - 1, Math.floor(frac * ((u.prog || 5) + 1)));
      const { m, l } = allLessons[li];
      const bpm = pick(r, [66, 72, 84, 84, 96, 108, 120]);
      const acc = clamp(skill + frac * .1 - (bpm - 84) / 400 + (r() - .5) * .18, .35, 1);
      const total = Math.max(6, Math.round(lessonText(l).replace(/\s/g, '').length * 2.1));
      const src = r() < .3 ? 'free' : 'lesson';
      db.attempts.push({ id: uid('t_'), userId: u.id, source: src, lessonId: src === 'lesson' ? l.id : null, module: m,
        mode: r() < .45 ? 'test' : 'practice', text: src === 'free' ? pick(r, Object.values(FREE_TEXTS).flat()) : lessonText(l),
        valid: Math.round(acc * total), total, bpm, date: d, seconds: Math.round(90 + r() * 600) });
    }
    // make lesson progress coherent: pass every lesson up to prog
    allLessons.slice(0, u.prog || 0).forEach(({ m, l }, j) => {
      const total = Math.max(6, Math.round(lessonText(l).replace(/\s/g, '').length * 2.1));
      const d = u.joined + (j + 1) * Math.max(DAY, (now - u.joined) / ((u.prog || 1) + 2));
      db.attempts.push({ id: uid('t_'), userId: u.id, source: 'lesson', lessonId: l.id, module: m, mode: 'test', text: lessonText(l),
        valid: Math.min(total, Math.ceil(total * (.9 + r() * .1))), total, bpm: pick(r, [72, 84, 96]), date: Math.min(d, now - DAY), seconds: Math.round(120 + r() * 300) });
    });
  });
  // Evan: 3-letter module in progress (t1, t2 passed); past assignments submitted
  const a0 = db.assignments[0], a1 = db.assignments[1];
  db.attempts.push({ id: uid('t_'), userId: 'u_evan', source: 'assignment', assignmentId: a0.id, module: 'letters', mode: 'practice', text: a0.text, valid: 13, total: 14, bpm: 72, date: now - 10 * DAY, seconds: 380 });
  db.attempts.push({ id: uid('t_'), userId: 'u_evan', source: 'assignment', assignmentId: a1.id, module: 'letters', mode: 'test', text: a1.text, valid: 15, total: 17, bpm: 84, date: now - 5 * DAY, seconds: 290 });
  // classmates on assignments
  db.users.filter(u => u.classId === 'c_p2' && u.id !== 'u_evan').forEach((u, i) => {
    const s = .55 + rng(i + 7)() * .45;
    [a0, a1].forEach((a, j) => { if (rng(i * 3 + j)() < .85) db.attempts.push({ id: uid('t_'), userId: u.id, source: 'assignment', assignmentId: a.id, module: a.module, mode: a.kind, text: a.text, valid: Math.round(16 * s), total: 16, bpm: a.bpm, date: a.due - DAY * (1 + j), seconds: Math.round(200 + s * 300) }); });
    if (i % 3 === 0) { const a = db.assignments[2]; db.attempts.push({ id: uid('t_'), userId: u.id, source: 'assignment', assignmentId: a.id, module: a.module, mode: a.kind, text: a.text, valid: Math.round(20 * s), total: 20, bpm: a.bpm, date: now - DAY, seconds: 240 }); }
  });
  db.attempts.sort((a, b) => a.date - b.date);
  return db;
}

// ---------- persistence (per-browser; demo only) ----------
let DB;
const RUNTIME = { songFiles: {}, traces: {} }; // uploaded audio Files and trace images live in memory only
function loadDB(){
  try { const raw = localStorage.getItem(STORE_KEY); if (raw){ const d = JSON.parse(raw); if (d && d.v === 3) { DB = d; return; } } } catch (e) {}
  DB = seedDB();
}
function saveDB(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) {} }
loadDB();

// ---------- validation rules ----------
const RULES = {
  password: p => p.length >= 8 && !/\s/.test(p),
  username: u => u.length >= 3 && !/\s/.test(u),
  email: e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
};
function newCode(){ const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return DB.classes.some(c => c.code === s) ? newCode() : s; }

// ---------- derived stats ----------
function userAttempts(uid_, from = 0){ return DB.attempts.filter(a => a.userId === uid_ && a.date >= from); }
function acc(a){ return a.total ? a.valid / a.total : 0; }
function statsFor(uid_, from = 0){
  const at = userAttempts(uid_);
  const inRange = at.filter(a => a.date >= from);
  const learned = new Map(); // word -> {count, first}
  at.forEach(a => { if (acc(a) >= .9) wordsOf(a.text).forEach(w => { const e = learned.get(w); if (e) e.count++; else learned.set(w, { count: 1, first: a.date }); }); });
  const seen = new Set(); at.forEach(a => wordsOf(a.text).forEach(w => seen.add(w)));
  const avg = inRange.length ? inRange.reduce((s, a) => s + acc(a), 0) / inRange.length : 0;
  let best = null; at.forEach(a => { if (acc(a) >= .9 && (!best || a.bpm > best.bpm || (a.bpm === best.bpm && a.date < best.date))) best = { bpm: a.bpm, date: a.date, text: a.text }; });
  const seconds = at.reduce((s, a) => s + (a.seconds || 0), 0);
  return { attempts: at, inRange, learned, seen: seen.size, wordsSeen: at.reduce((s, a) => s + wordsOf(a.text).length, 0), avg, best, seconds, last: at.length ? at[at.length - 1].date : null };
}
function lessonPassed(uid_, lessonId){ return DB.attempts.some(a => a.userId === uid_ && a.lessonId === lessonId && a.mode === 'test' && acc(a) >= .9); }
function lessonBest(uid_, lessonId){ let b = null; DB.attempts.forEach(a => { if (a.userId === uid_ && a.lessonId === lessonId && a.mode === 'test') b = Math.max(b ?? 0, acc(a)); }); return b; }
function moduleState(uid_){
  let open = true;
  return CURRICULUM.map(m => {
    const passed = m.lessons.filter(l => lessonPassed(uid_, l.id)).length;
    const st = { module: m, unlocked: open, passed, total: m.lessons.length, done: passed === m.lessons.length };
    open = open && st.done;
    return st;
  });
}
function assignmentsFor(user){
  if (!user.classId) return [];
  return DB.assignments.filter(a => a.classId === user.classId && (!a.studentIds || a.studentIds.includes(user.id))).sort((a, b) => a.due - b.due);
}
function submission(uid_, aid){ const s = DB.attempts.filter(a => a.userId === uid_ && a.assignmentId === aid); return s.length ? s.reduce((b, a) => acc(a) > acc(b) ? a : b) : null; }

function leaderboard(scope, user, metric){
  let pool = DB.users.filter(u => u.role !== 'teacher');
  if (scope === 'class') pool = pool.filter(u => u.classId && u.classId === user.classId);
  else if (scope === 'school') pool = pool.filter(u => u.role === 'student' && u.school === user.school);
  else if (scope === 'global') pool = pool.filter(u => u.role === 'general');
  else if (scope.startsWith('c_')) pool = pool.filter(u => u.classId === scope);
  const rows = pool.map(u => { const s = statsFor(u.id); return { u, s }; });
  if (metric === 'time') return { ranked: rows.sort((a, b) => b.s.seconds - a.s.seconds).map(r => ({ ...r, value: r.s.seconds })), unranked: 0 };
  if (metric === 'words') return { ranked: rows.sort((a, b) => b.s.wordsSeen - a.s.wordsSeen).map(r => ({ ...r, value: r.s.wordsSeen })), unranked: 0 };
  const q = rows.filter(r => r.s.best);
  return { ranked: q.sort((a, b) => b.s.best.bpm - a.s.best.bpm || a.s.best.date - b.s.best.date).map(r => ({ ...r, value: r.s.best.bpm })), unranked: rows.length - q.length };
}

// ---------- api ----------
const delay = (v, ms = 120) => new Promise(r => setTimeout(() => r(v), ms));
const fail = msg => Promise.reject(new Error(msg));
const api = {
  login(id, password){
    const u = DB.users.find(u => u.username.toLowerCase() === id.toLowerCase() || u.email.toLowerCase() === id.toLowerCase());
    if (!u) return fail('No account with that username or email.');
    if (u.password !== password) return fail('That password doesn’t match this account.');
    return delay(u);
  },
  signup(f){
    if (!RULES.email(f.email)) return fail('Enter a valid email address.');
    const username = f.username || f.email;
    if (!RULES.username(username)) return fail('Usernames need at least 3 characters and no spaces.');
    if (!RULES.password(f.password)) return fail('Passwords need at least 8 characters and no spaces.');
    if (DB.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return fail('That username is taken.');
    if (DB.users.some(u => u.email.toLowerCase() === f.email.toLowerCase())) return fail('An account already uses that email.');
    let classId = null, school = null;
    if (f.role === 'student'){
      if (!f.birth) return fail('Students need a birth date.');
      const c = DB.classes.find(c => c.code === (f.code || '').trim().toUpperCase() && !c.archived);
      if (!c) return fail('That class code doesn’t match an open class. Ask your teacher for the 6-letter code.');
      classId = c.id; school = c.school;
    }
    const u = { id: uid('u_'), username, email: f.email, password: f.password, role: f.role, name: f.name || username, birth: f.birth || null, classId, school: f.role === 'teacher' ? (f.school || 'My school') : school, joined: Date.now(), prog: 0 };
    DB.users.push(u); saveDB(); return delay(u);
  },
  requestReset(email){
    const u = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const token = uid('r');
    if (u) { DB.resets.push({ token, userId: u.id, exp: Date.now() + DAY }); saveDB(); }
    return delay({ token: u ? token : null, email }); // real backend would email the link; demo returns it
  },
  resetPassword(token, pw){
    const r = DB.resets.find(r => r.token === token && r.exp > Date.now());
    if (!r) return fail('This reset link has expired. Request a new one.');
    if (!RULES.password(pw)) return fail('Passwords need at least 8 characters and no spaces.');
    DB.users.find(u => u.id === r.userId).password = pw; DB.resets = DB.resets.filter(x => x !== r); saveDB(); return delay(true);
  },
  recordAttempt(a){ const rec = { id: uid('t_'), date: Date.now(), ...a }; DB.attempts.push(rec); saveDB(); return rec; },
  addActivity(userId, seconds){ const last = [...DB.attempts].reverse().find(a => a.userId === userId && Date.now() - a.date < 36e5); if (last) { last.seconds = (last.seconds || 0) + seconds; saveDB(); } },
  saveAssignment(a){ if (a.id){ const i = DB.assignments.findIndex(x => x.id === a.id); DB.assignments[i] = { ...DB.assignments[i], ...a }; } else DB.assignments.push({ ...a, id: uid('a_'), created: Date.now() }); saveDB(); },
  deleteAssignment(id){ DB.assignments = DB.assignments.filter(a => a.id !== id); saveDB(); },
  extendAssignment(id, days){ const a = DB.assignments.find(a => a.id === id); a.due = Math.max(a.due, Date.now()) + days * DAY; saveDB(); },
  addClass(teacher, name){ const c = { id: uid('c_'), teacherId: teacher.id, name, code: newCode(), school: teacher.school, archived: false, created: Date.now() }; DB.classes.push(c); saveDB(); return c; },
  regenCode(cid){ const c = DB.classes.find(c => c.id === cid); c.code = newCode(); saveDB(); return c.code; },
  archiveClass(cid, on){ DB.classes.find(c => c.id === cid).archived = on; saveDB(); },
  removeStudent(uid_){ const u = DB.users.find(u => u.id === uid_); u.classId = null; saveDB(); },
  addSong(s){ DB.songs.push(s); saveDB(); return s; },
  resetDemo(){ try { localStorage.removeItem(STORE_KEY); } catch (e) {} DB = seedDB(); },
  async fetchExcerpt(i){
    // Live source: Project Gutenberg through the Gutendex API. Falls back to the bundled copy.
    const e = EXCERPTS[i % EXCERPTS.length];
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
      const res = await fetch('https://gutendex.com/books/' + e.gid, { signal: ctl.signal }); clearTimeout(t);
      if (!res.ok) throw 0; const j = await res.json();
      return { ...e, title: j.title || e.title, author: (j.authors && j.authors[0] && j.authors[0].name) || e.author, live: true };
    } catch (err) { return { ...e, live: false }; }
  },
};
