// =====================================================================
// FloWriter backend adapter (Supabase)
//
// Loads only when a config is present (see config.example.js). Without one
// the app keeps running exactly as before, on the seeded demo DB in
// localStorage, so the demo still works offline.
//
// How it works: on boot it pulls the rows this account is allowed to see
// into the same in-memory `DB` the views already read synchronously, then
// mirrors every write back to Postgres in the background. That keeps the
// existing synchronous view code unchanged. It means a classroom sees each
// other's updates on refresh rather than instantly, which is the right
// trade for a pilot and the wrong one for a live product at scale.
// =====================================================================
const Backend = (() => {
  const CFG = (typeof window !== 'undefined' && window.FLOWRITER_CONFIG) || null;
  const enabled = !!(CFG && CFG.url && CFG.anonKey);
  let sb = null, failed = 0;

  const camel = r => r && { ...r, classId: r.class_id, teacherId: r.teacher_id, userId: r.user_id,
    assignmentId: r.assignment_id, lessonId: r.lesson_id, studentIds: r.student_ids, ownerId: r.owner_id,
    birth: r.birth_year ? String(r.birth_year) : null,
    due: r.due ? new Date(r.due).getTime() : undefined,
    created: r.created ? new Date(r.created).getTime() : undefined,
    joined: r.joined ? new Date(r.joined).getTime() : undefined,
    date: r.created ? new Date(r.created).getTime() : undefined };

  const snakeAttempt = a => ({ id: a.id, user_id: a.userId, source: a.source, assignment_id: a.assignmentId || null,
    lesson_id: a.lessonId || null, module: a.module || null, mode: a.mode, gate: a.gate || null,
    text: a.text, valid: a.valid, total: a.total, bpm: a.bpm ?? null, seconds: a.seconds || 0 });
  const snakeAssignment = a => ({ id: a.id, class_id: a.classId, title: a.title, module: a.module || null,
    lesson_id: a.lessonId || null, kind: a.kind, text: a.text, due: new Date(a.due).toISOString(),
    song_id: a.songId || null, bpm: a.bpm ?? null, difficulty: a.difficulty || 'standard',
    student_ids: a.studentIds && a.studentIds.length ? a.studentIds : null });

  function warn(e, what){
    failed++;
    console.error('[flowriter] ' + what, e);
    if (failed <= 2 && typeof toast === 'function') toast(`Could not save ${what} to the server. It is saved on this device.`, 5000);
  }
  // fire-and-forget write; the local copy is already updated
  const push = (p, what) => Promise.resolve(p).then(r => { if (r && r.error) warn(r.error, what); }, e => warn(e, what));

  async function connect(){
    if (sb) return sb;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    return sb;
  }

  // ---------- pull everything this account may see into the in-memory DB ----------
  async function hydrate(profile){
    const [profiles, classes, assignments, attempts, songs] = await Promise.all([
      sb.from('profiles').select('*'),
      sb.from('classes').select('*'),
      sb.from('assignments').select('*'),
      sb.from('attempts').select('*').order('created', { ascending: true }),
      sb.from('songs').select('*'),
    ]);
    const err = [profiles, classes, assignments, attempts, songs].find(r => r.error);
    if (err) throw err.error;
    DB = {
      v: 3,
      users: profiles.data.map(camel),
      classes: classes.data.map(camel),
      assignments: assignments.data.map(camel),
      attempts: attempts.data.map(camel),
      // the six built-in songs are generated in the browser, so they are always available
      songs: [...STARTER_SONGS.map(s => ({ ...s, kind: 'starter' })), ...songs.data.map(camel).filter(s => s.kind === 'upload')],
      resets: [],
    };
    return DB.users.find(u => u.id === profile.id) || camel(profile);
  }

  async function profileFor(userId){
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  }

  // ---------- the api surface the app already calls ----------
  function install(){
    api.login = async (id, password) => {
      let email = id.trim();
      if (!email.includes('@')) { // allow username login: look up the email behind it
        const { data } = await sb.rpc('email_for_username', { u: email });
        if (!data) throw new Error('No account with that username or email.');
        email = data;
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/Invalid/.test(error.message) ? 'That password doesn’t match this account.' : error.message);
      const p = await profileFor(data.user.id);
      const u = await hydrate(p);
      return u;
    };

    api.signup = async f => {
      const username = (f.username || f.email).trim();
      if (!RULES.email(f.email)) throw new Error('Enter a valid email address.');
      if (!RULES.username(username)) throw new Error('Usernames need at least 3 characters and no spaces.');
      if (!RULES.password(f.password)) throw new Error('Passwords need at least 8 characters and no spaces.');
      let classId = null, school = f.role === 'teacher' ? (f.school || 'My school') : null;
      if (f.role === 'student') {
        if (!f.birth) throw new Error('Students need a birth date.');
        const { data: cid } = await sb.rpc('class_id_for_code', { c: (f.code || '').trim() });
        if (!cid) throw new Error('That class code doesn’t match an open class. Ask your teacher for the 6-letter code.');
        classId = cid;
        const { data: cls } = await sb.from('classes').select('school').eq('id', cid).single();
        school = cls ? cls.school : null;
      }
      const { data, error } = await sb.auth.signUp({ email: f.email.trim(), password: f.password });
      if (error) throw new Error(/already/i.test(error.message) ? 'An account already uses that email.' : error.message);
      if (!data.user) throw new Error('Check your email to confirm the account, then log in.');
      // only the birth YEAR is stored, never the full date
      const row = { id: data.user.id, username, role: f.role, name: f.name || username,
        birth_year: f.birth ? +String(f.birth).slice(0, 4) : null, class_id: classId, school, prog: 0 };
      const { error: pe } = await sb.from('profiles').insert(row);
      if (pe) throw new Error(/duplicate/i.test(pe.message) ? 'That username is taken.' : pe.message);
      return await hydrate(row);
    };

    api.requestReset = async email => {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname + '#/reset' });
      if (error) throw new Error(error.message);
      return { token: null, email }; // the real email carries the link; nothing to show in-app
    };
    api.resetPassword = async (_token, pw) => {
      if (!RULES.password(pw)) throw new Error('Passwords need at least 8 characters and no spaces.');
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      return true;
    };
    api.logout = () => sb.auth.signOut();

    // ---- writes: update the local copy first so the UI stays synchronous ----
    api.recordAttempt = a => {
      const rec = { id: crypto.randomUUID(), date: Date.now(), ...a };
      DB.attempts.push(rec);
      push(sb.from('attempts').insert(snakeAttempt(rec)), 'this attempt');
      return rec;
    };
    api.addActivity = (userId, seconds) => {
      const last = [...DB.attempts].reverse().find(a => a.userId === userId && Date.now() - a.date < 36e5);
      if (!last) return;
      last.seconds = (last.seconds || 0) + seconds;
      push(sb.from('attempts').update({ seconds: last.seconds }).eq('id', last.id), 'practice time');
    };
    api.saveAssignment = a => {
      if (a.id) { const i = DB.assignments.findIndex(x => x.id === a.id); DB.assignments[i] = { ...DB.assignments[i], ...a }; }
      else { a = { ...a, id: crypto.randomUUID(), created: Date.now() }; DB.assignments.push(a); }
      push(sb.from('assignments').upsert(snakeAssignment(a)), 'this assignment');
    };
    api.deleteAssignment = id => {
      DB.assignments = DB.assignments.filter(a => a.id !== id);
      push(sb.from('assignments').delete().eq('id', id), 'that deletion');
    };
    api.extendAssignment = (id, days) => {
      const a = DB.assignments.find(a => a.id === id);
      a.due = Math.max(a.due, Date.now()) + days * DAY;
      push(sb.from('assignments').update({ due: new Date(a.due).toISOString() }).eq('id', id), 'the new due date');
    };
    api.addClass = (teacher, name) => {
      const c = { id: crypto.randomUUID(), teacherId: teacher.id, name, code: newCode(), school: teacher.school, archived: false, created: Date.now() };
      DB.classes.push(c);
      push(sb.from('classes').insert({ id: c.id, teacher_id: c.teacherId, name: c.name, code: c.code, school: c.school }), 'the new class');
      return c;
    };
    api.regenCode = cid => {
      const c = DB.classes.find(c => c.id === cid); c.code = newCode();
      push(sb.from('classes').update({ code: c.code }).eq('id', cid), 'the new class code');
      return c.code;
    };
    api.archiveClass = (cid, on) => {
      DB.classes.find(c => c.id === cid).archived = on;
      push(sb.from('classes').update({ archived: on }).eq('id', cid), 'that change');
    };
    api.removeStudent = uid_ => {
      const u = DB.users.find(u => u.id === uid_); u.classId = null;
      push(sb.from('profiles').update({ class_id: null }).eq('id', uid_), 'that change');
    };
    api.addSong = s => {
      DB.songs.push(s);
      push(sb.from('songs').insert({ id: s.id, owner_id: s.ownerId || null, title: s.title, artist: s.artist || null,
        bpm: s.bpm, style: s.style || null, mood: s.mood || null, hue: s.hue ?? null, kind: 'upload' }), 'that song');
      return s;
    };
    api.resetDemo = () => { if (typeof toast === 'function') toast('This build is connected to a real database, so there is no demo data to reset.'); };
    api.refresh = async () => { const u = state.user; if (u) await hydrate({ id: u.id }); };
  }

  // ---------- boot ----------
  async function boot(){
    await connect();
    install();
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      try {
        const p = await profileFor(data.session.user.id);
        state.user = await hydrate(p);
      } catch (e) { console.error('[flowriter] session restore', e); await sb.auth.signOut(); }
    }
  }

  return { enabled, boot, client: () => sb };
})();
