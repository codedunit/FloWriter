// =====================================================================
// FloWriter backend adapter (Supabase).
// Loads only when config.js sets window.FLOWRITER_CONFIG = { url, anonKey }.
// On sign-in it pulls everything this account may see into the in-memory
// `DB` the views read, then mirrors each write to Postgres. Teachers see new
// student work when the dashboard refreshes (every minute, or the refresh
// button). Row level security in schema.sql decides who can see what.
// =====================================================================
const Backend = (() => {
  const CFG = (typeof window !== 'undefined' && window.FLOWRITER_CONFIG) || null;
  const enabled = !!(CFG && CFG.url && CFG.anonKey);
  const STUDENT_DOMAIN = (CFG && CFG.studentEmailDomain) || 'students.flowriter.app';
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  let sb = null, failures = 0;

  const ms = v => v ? new Date(v).getTime() : null;
  const fromProfile = r => ({ id: r.id, username: r.username, role: r.role, name: r.name, school: r.school, classId: r.class_id, attested: ms(r.attested), joined: ms(r.joined), lastSeen: ms(r.last_seen), handed: r.handed || 'right' });
  const fromClass = r => ({ id: r.id, teacherId: r.teacher_id, name: r.name, code: r.code, school: r.school, archived: r.archived, message: r.message || '', sequential: !!r.sequential, created: ms(r.created) });
  const fromLesson = r => ({ id: r.id, classId: r.class_id, title: r.title, preset: r.preset, text: r.text, songId: r.song_id, mult: +r.mult, bps: r.bps, rest: r.rest, difficulty: r.difficulty, theme: r.theme || '', due: ms(r.due), studentIds: r.student_ids, kind: r.kind || 'lesson', created: ms(r.created) });
  const fromAttempt = r => ({ id: r.id, userId: r.user_id, lessonId: r.lesson_id, mode: r.mode, score: r.score == null ? null : +r.score, valid: r.valid, total: r.total, reversed: r.reversed, gate: r.gate, bpm: r.bpm == null ? null : +r.bpm, seconds: r.seconds, letters: r.letters, date: ms(r.created) });
  const fromSong = r => ({ id: r.id, ownerId: r.owner_id, title: r.title, artist: r.artist, bpm: +r.bpm, offset: r.offset == null ? null : +r.offset, duration: r.duration == null ? null : +r.duration, path: r.path, kind: r.kind, created: ms(r.created) });
  const toLesson = l => ({ id: l.id, class_id: l.classId, title: l.title, preset: l.preset || null, text: l.text, song_id: l.songId || null, mult: l.mult, bps: l.bps, rest: l.rest, difficulty: l.difficulty, theme: l.theme || '', due: l.due ? new Date(l.due).toISOString() : null, student_ids: l.studentIds && l.studentIds.length ? l.studentIds : null, kind: l.kind || 'lesson' });

  function warn(e, what){
    failures++; console.error('[flowriter] ' + what, e);
    if (failures <= 3 && typeof toast === 'function') toast(`Couldn’t save ${what} to the server. Check the connection and try again.`, 5000);
  }
  const push = (p, what) => Promise.resolve(p).then(r => { if (r && r.error) warn(r.error, what); return r; }, e => warn(e, what));
  const must = r => { if (r.error) throw new Error(r.error.message); return r.data; };

  function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
  async function connect(){
    if (sb) return sb;
    if (!window.supabase) await loadScript(SUPABASE_JS);
    sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    // a teacher's "reset password" email link lands here with a recovery session
    sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { state.recovery = true; go('reset'); } });
    return sb;
  }
  // Supabase returns at most 1000 rows per request, so read in pages.
  async function fetchAll(table, cols = '*', order = 'created'){
    const out = [];
    for (let from = 0; ; from += 1000){
      const r = await sb.from(table).select(cols).order(order, { ascending: true }).range(from, from + 999);
      if (r.error) throw new Error(r.error.message);
      out.push(...r.data); if (r.data.length < 1000) return out;
    }
  }

  // ---------- outbox: a run is kept on this device until the server has it ----------
  const OUTBOX = 'flowriter-outbox';
  const readBox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (e) { return []; } };
  const writeBox = b => { try { localStorage.setItem(OUTBOX, JSON.stringify(b)); } catch (e) { try { localStorage.setItem(OUTBOX, JSON.stringify(b.map(x => ({ ...x, trace: null })))); } catch (e2) {} } };
  let flushing = false, retryTimer = null;
  function saveState(n){ dispatchEvent(new CustomEvent('fw-save', { detail: { pending: n } })); }
  async function flush(){
    if (flushing || !sb) return; flushing = true;
    let box = readBox();
    for (const row of box.slice()){
      const r = await sb.from('attempts').insert(row).then(x => x, e => ({ error: e }));
      const dup = r.error && (r.error.code === '23505' || /duplicate/i.test(r.error.message || ''));
      if (!r.error || dup) { box = readBox().filter(x => x.id !== row.id); writeBox(box); }
      else { console.error('[flowriter] saving a run', r.error); if (r.error.code === '42501') { box = readBox().filter(x => x.id !== row.id); writeBox(box); } else break; }
    }
    flushing = false; box = readBox(); saveState(box.length);
    clearTimeout(retryTimer); if (box.length) retryTimer = setTimeout(flush, 15000);
  }
  addEventListener('online', () => flush());

  async function hydrate(userId){
    const q = (t, cols = '*') => sb.from(t).select(cols);
    const [profiles, classes, lessons, attemptRows, songs, admin] = await Promise.all([
      q('profiles'), q('classes'), q('lessons'),
      fetchAll('attempts', 'id,user_id,lesson_id,mode,score,valid,total,reversed,gate,bpm,seconds,letters,created'),
      q('songs'), sb.rpc('is_admin'),
    ]);
    [profiles, classes, lessons, songs].forEach(must);
    const attempts = { data: attemptRows };
    DB = {
      v: 1,
      users: profiles.data.map(fromProfile),
      classes: classes.data.map(fromClass),
      lessons: lessons.data.map(fromLesson),
      attempts: attempts.data.map(fromAttempt),
      songs: [...STARTER_SONGS.map(s => ({ ...s })), ...songs.data.map(fromSong).filter(s => s.kind === 'upload')],
      feedback: [],
    };
    // runs still waiting on this device count as done, so a test is never offered twice
    readBox().filter(r => r.user_id === userId && !DB.attempts.some(a => a.id === r.id)).forEach(r => DB.attempts.push(fromAttempt(r)));
    const me = DB.users.find(u => u.id === userId);
    if (!me) throw new Error('This account has no FloWriter profile yet.');
    me.admin = !!(admin && admin.data);
    if (me.admin) { const f = await sb.from('feedback').select('*').order('created', { ascending: false }).limit(500); if (!f.error) DB.feedback = f.data.map(x => ({ id: x.id, userId: x.user_id, role: x.role, rating: x.rating, body: x.body, page: x.page, date: ms(x.created) })); }
    if (me.role === 'teacher') live(); flush();
    push(sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId), 'your sign-in time');
    return me;
  }

  // live updates: new runs from students appear on teacher pages without a refresh
  let channel = null;
  function live(){
    if (channel) return;
    channel = sb.channel('fw-attempts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attempts' }, ({ new: r }) => {
      if (!r || DB.attempts.some(a => a.id === r.id)) return;
      DB.attempts.push(fromAttempt(r)); if (r.trace) RUNTIME.traces[r.id] = r.trace;
      const u = userById(r.user_id); if (u) u.lastSeen = Date.now();
      dispatchEvent(new Event('fw-data'));
    }).subscribe();
  }
  // a second client that never touches this browser's sign-in, for making student accounts
  let side = null;
  const sideClient = () => side || (side = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'fw-side' } }));
  async function uniqueUsername(base){
    base = (base || 'teacher').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 18) || 'teacher';
    for (let i = 0; i < 6; i++){ const u = i ? base + Math.floor(10 + Math.random() * 990) : base; const { data } = await sb.rpc('username_taken', { u }); if (!data) return u; }
    return base + Date.now().toString(36);
  }

  function install(){
    api.demo = false;
    api.login = async (id, password) => {
      let email = id.trim();
      if (!email.includes('@')) {
        const { data } = await sb.rpc('email_for_username', { u: email });
        if (!data) throw new Error('No account with that username or email.');
        email = data;
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/Invalid/i.test(error.message) ? 'That password doesn’t match this account.' : error.message);
      return hydrate(data.user.id);
    };
    api.signupTeacher = async f => {
      if (!f.name) throw new Error('Enter your name as students know it, like Ms. Rivera.');
      if (!RULES.email(f.email)) throw new Error('Enter a valid email address.');
      if (!RULES.teacherPassword(f.password)) throw new Error('Passwords need at least 8 characters and no spaces.');
      if (!f.attest) throw new Error('Confirm that your school allows students to use FloWriter.');
      const { data, error } = await sb.auth.signUp({ email: f.email.trim(), password: f.password });
      if (error) throw new Error(/registered|already/i.test(error.message) ? 'An account already uses that email.' : error.message);
      if (!data.session) throw new Error('Check your email to confirm the account, then log in.');
      const username = await uniqueUsername(f.email.split('@')[0]);
      const pe = await sb.from('profiles').insert({ id: data.user.id, username, role: 'teacher', name: f.name, school: f.school || null, attested: new Date().toISOString() });
      if (pe.error) { await sb.auth.signOut(); throw new Error(/row-level|policy/i.test(pe.error.message) ? 'This email isn’t on the pilot’s teacher list. Ask the FloWriter team to add it.' : pe.error.message); }
      must(await sb.from('classes').insert({ teacher_id: data.user.id, name: 'My class', code: newCode(), school: f.school || null }));
      return hydrate(data.user.id);
    };
    api.lookupClass = async code => {
      const { data } = await sb.rpc('class_for_code', { c: (code || '').trim() });
      return data && data[0] ? data[0] : null;
    };
    api.joinClass = async f => {
      const username = (f.username || '').trim().toLowerCase();
      if (!f.name) throw new Error('Type your first name and the first letter of your last name.');
      if (!RULES.username(username)) throw new Error('Usernames are 3 to 24 letters or numbers, with no spaces.');
      if (!RULES.studentPassword(f.password)) throw new Error('Passwords need at least 6 characters and no spaces.');
      const cls = await api.lookupClass(f.code);
      if (!cls) throw new Error('That class code doesn’t match an open class. Check the code with your teacher.');
      const { data: taken } = await sb.rpc('username_taken', { u: username });
      if (taken) throw new Error('That username is taken. Try adding a number.');
      // students have no email: the account uses a generated address that never receives mail
      const { data, error } = await sb.auth.signUp({ email: `${username}@${STUDENT_DOMAIN}`, password: f.password });
      if (error) throw new Error(/registered|already/i.test(error.message) ? 'That username is taken. Try adding a number.' : error.message);
      if (!data.session) throw new Error('Student accounts need email confirmation turned off in Supabase. See SETUP.md.');
      must(await sb.from('profiles').insert({ id: data.user.id, username, role: 'student', name: f.name, class_id: cls.id }));
      return hydrate(data.user.id);
    };
    api.logout = () => { if (channel) { sb.removeChannel(channel); channel = null; } return sb.auth.signOut(); };
    api.requestReset = async email => {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.href.split('#')[0] });
      if (error) throw new Error(error.message);
      return {};
    };
    api.updatePassword = async pw => {
      const { data, error } = await sb.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      state.recovery = false; return hydrate(data.user.id);
    };
    api.updateProfile = patch => {
      Object.assign(state.user, patch);
      const row = {}; if ('name' in patch) row.name = patch.name; if ('school' in patch) row.school = patch.school; if ('handed' in patch) row.handed = patch.handed;
      push(sb.from('profiles').update(row).eq('id', state.user.id), 'your settings');
    };
    api.changeClass = async code => {
      const c = await api.lookupClass(code); if (!c) throw new Error('That code doesn’t match an open class. Check it with your teacher.');
      const { error } = await sb.from('profiles').update({ class_id: c.id }).eq('id', state.user.id); if (error) throw new Error(error.message);
      state.user = await hydrate(state.user.id); return c;
    };
    api.moveStudent = (id, cid) => { userById(id).classId = cid; push(sb.from('profiles').update({ class_id: cid }).eq('id', id), 'the class change'); };
    api.deleteStudent = async id => { const { error } = await sb.rpc('delete_student', { student: id }); if (error) throw new Error(error.message); DB.users = DB.users.filter(u => u.id !== id); DB.attempts = DB.attempts.filter(a => a.userId !== id); return true; };
    api.createStudents = async (cid, names, onEach) => {
      const c = classById(cid), out = [], tmp = sideClient();
      for (const name of names){
        let username = uniqueStudentName(name);
        for (let i = 0; i < 5; i++){ const { data: taken } = await sb.rpc('username_taken', { u: username }); if (!taken) break; username = uniqueStudentName(name); }
        const password = kidPassword();
        const su = await tmp.auth.signUp({ email: `${username}@${STUDENT_DOMAIN}`, password });
        if (su.error) throw new Error(`Couldn’t make an account for ${name}: ${su.error.message}` + (/rate/i.test(su.error.message) ? ' Raise the sign-up rate limit in Supabase (see the launch guide), then add the rest.' : ''));
        if (!su.data.session) throw new Error('Student accounts need email confirmation turned off in Supabase.');
        const pr = await tmp.from('profiles').insert({ id: su.data.user.id, username, role: 'student', name, class_id: cid });
        if (pr.error) throw new Error(pr.error.message);
        await tmp.auth.signOut();
        const u = { id: su.data.user.id, username, role: 'student', name, classId: cid, school: c.school, joined: Date.now(), lastSeen: null, handed: 'right' };
        DB.users.push(u); out.push({ user: u, password }); onEach && onEach(out.length);
      }
      return out;
    };
    api.newPasswords = async ids => { const out = []; for (const id of ids){ const password = kidPassword(); const { error } = await sb.rpc('reset_student_password', { student: id, new_password: password }); if (error) throw new Error(error.message); out.push({ user: userById(id), password }); } return out; };
    api.sendFeedback = async f => { const { error } = await sb.from('feedback').insert({ user_id: state.user.id, role: state.user.role, rating: f.rating || null, body: f.body || null, page: f.page || null }); if (error) throw new Error(error.message); return true; };
    api.setSequential = (cid, on) => { classById(cid).sequential = on; push(sb.from('classes').update({ sequential: on }).eq('id', cid), 'that setting'); };
    api.pendingSaves = () => readBox().length;

    api.recordAttempt = a => {
      if (a.mode === 'test') { const had = DB.attempts.find(x => x.userId === a.userId && x.lessonId === a.lessonId && x.mode === 'test'); if (had) return had; }
      const rec = { id: crypto.randomUUID(), date: Date.now(), ...a }; const trace = rec.trace; delete rec.trace;
      if (trace) RUNTIME.traces[rec.id] = trace;
      DB.attempts.push(rec);
      const row = { id: rec.id, user_id: rec.userId, lesson_id: rec.lessonId, mode: rec.mode, score: rec.score, valid: rec.valid || 0, total: rec.total || 0,
        reversed: rec.reversed || 0, gate: rec.gate || null, bpm: rec.bpm ?? null, seconds: rec.seconds || 0, letters: rec.letters || null, trace: trace || null, created: new Date(rec.date).toISOString() };
      writeBox([...readBox(), row]); saveState(readBox().length); flush();
      return rec;
    };
    api.addSeconds = (attemptId, seconds) => {
      const a = DB.attempts.find(a => a.id === attemptId); if (!a || a.mode === 'test') return;
      a.seconds = (a.seconds || 0) + seconds;
      const box = readBox(), q = box.find(x => x.id === a.id);
      if (q) { q.seconds = a.seconds; writeBox(box); return; }   // not on the server yet: update the queued copy
      push(sb.from('attempts').update({ seconds: a.seconds }).eq('id', a.id), 'practice time');
    };
    api.saveLesson = l => {
      let row;
      if (l.id) { const i = DB.lessons.findIndex(x => x.id === l.id); DB.lessons[i] = row = { ...DB.lessons[i], ...l }; }
      else { row = { ...l, id: crypto.randomUUID(), created: Date.now() }; DB.lessons.push(row); }
      push(sb.from('lessons').upsert(toLesson(row)), 'this lesson');
      return row;
    };
    api.deleteLesson = id => { DB.lessons = DB.lessons.filter(l => l.id !== id); push(sb.from('lessons').delete().eq('id', id), 'that deletion'); };
    api.addClass = (teacher, name) => {
      const c = { id: crypto.randomUUID(), teacherId: teacher.id, name, code: newCode(), school: teacher.school, archived: false, created: Date.now() };
      DB.classes.push(c); push(sb.from('classes').insert({ id: c.id, teacher_id: c.teacherId, name, code: c.code, school: c.school }), 'the new class'); return c;
    };
    api.renameClass = (cid, name) => { classById(cid).name = name; push(sb.from('classes').update({ name }).eq('id', cid), 'the class name'); };
    api.saveClassMessage = (cid, message) => push(sb.from('classes').update({ message }).eq('id', cid), 'the class message');
    api.regenCode = cid => { const c = classById(cid); c.code = newCode(); push(sb.from('classes').update({ code: c.code }).eq('id', cid), 'the new class code'); return c.code; };
    api.archiveClass = (cid, on) => { classById(cid).archived = on; push(sb.from('classes').update({ archived: on }).eq('id', cid), 'that change'); };
    api.removeStudent = id => { userById(id).classId = null; push(sb.from('profiles').update({ class_id: null }).eq('id', id), 'that change'); };
    api.resetStudentPassword = async id => { const pw = kidPassword(); const { error } = await sb.rpc('reset_student_password', { student: id, new_password: pw }); if (error) throw new Error(error.message); return pw; };
    api.addSong = async (s, file) => {
      const me = state.user, id = 'sg_' + crypto.randomUUID().slice(0, 12), path = `${me.id}/${id}.mp3`;
      const up = await sb.storage.from('songs').upload(path, file, { contentType: 'audio/mpeg', upsert: false });
      if (up.error) throw new Error('The MP3 didn’t upload: ' + up.error.message);
      const row = { id, owner_id: me.id, title: s.title, artist: s.artist || null, bpm: s.bpm, offset: s.offset ?? null, duration: s.duration ?? null, path, kind: 'upload' };
      const ins = await sb.from('songs').insert(row); if (ins.error) throw new Error(ins.error.message);
      const song = fromSong({ ...row, created: new Date().toISOString() }); DB.songs.push(song); RUNTIME.songFiles[id] = file; return song;
    };
    api.updateSong = (id, patch) => { const s = songById(id); Object.assign(s, patch); push(sb.from('songs').update({ title: s.title, artist: s.artist, bpm: s.bpm, offset: s.offset }).eq('id', id), 'the song'); };
    api.deleteSong = id => { const s = songById(id); DB.songs = DB.songs.filter(x => x.id !== id); push(sb.from('songs').delete().eq('id', id), 'that deletion'); if (s && s.path) sb.storage.from('songs').remove([s.path]); };
    api.songFile = async song => {
      if (song.kind === 'starter') return Music.starterFile(song);
      if (RUNTIME.songFiles[song.id]) return RUNTIME.songFiles[song.id];
      const { data, error } = await sb.storage.from('songs').download(song.path);
      if (error) throw new Error(error.message);
      return RUNTIME.songFiles[song.id] = new File([data], song.title + '.mp3', { type: 'audio/mpeg' });
    };
    api.trace = async a => {
      if (RUNTIME.traces[a.id]) return RUNTIME.traces[a.id];
      const { data } = await sb.from('attempts').select('trace').eq('id', a.id).maybeSingle();
      return RUNTIME.traces[a.id] = (data && data.trace) || null;
    };
    api.refresh = async () => { if (state.user) state.user = await hydrate(state.user.id); };
    api.resetDemo = () => {};
  }

  async function boot(){
    const recovering = /type=recovery/.test(location.hash);
    await connect(); install();
    if (recovering) state.recovery = true;
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      try { state.user = await hydrate(data.session.user.id); }
      catch (e) { console.error('[flowriter] session restore', e); await sb.auth.signOut(); }
    }
  }
  return { enabled, boot, client: () => sb };
})();
