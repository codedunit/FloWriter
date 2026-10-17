// =====================================================================
// Student pages, and the lesson page shared by students, teacher previews
// and the no-account tryout.
// =====================================================================
route('home', { auth: 'student', nav: 'home', title: 'My lessons' }, () => {
  const u = state.user, c = classById(u.classId), t = c && userById(c.teacherId);
  if (!c) return `<form class="card stack" data-form="student-join" novalidate style="max-width:520px"><h1 style="font-size:24px">You’re not in a class right now</h1><p class="muted">Type the 6-letter code from your teacher to join their class. You keep your username and password.</p>
    <div class="field"><label for="sjCode">Class code</label><input class="input mono" id="sjCode" name="code" maxlength="6" autocomplete="off" style="font-size:22px;letter-spacing:.2em;text-transform:uppercase"></div><p class="form-error" role="alert"></p><button class="btn primary lg" type="submit" style="align-self:flex-start">Join the class</button></form>`;
  const items = lessonsForStudent(u).map(l => ({ l, p: progress(u.id, l.id) }));
  items.forEach(x => { x.lock = lessonLocked(u, x.l); });
  const todo = items.filter(x => !x.p.done).sort((a, b) => (!!a.lock - !!b.lock) || (b.p.started - a.p.started) || ((a.l.due || 9e15) - (b.l.due || 9e15))), done = items.filter(x => x.p.done).reverse();
  const next = todo.find(x => !x.lock), cal = activityCalendar(DB.attempts.filter(a => a.userId === u.id));
  const wk = studentStats(u.id, Date.now() - 7 * DAY);
  const stepTxt = p => p.check ? 'Handwriting check · no music, one try' : p.step === 0 ? 'Start with the demo' : p.step === 1 ? 'Next: practice with the music' : 'Next: take the test';
  const row = ({ l, p, lock }) => lock
    ? `<div class="lrow" style="opacity:.6;box-shadow:none"><span class="thumb" style="${l.theme ? `background-image:url(${themeImg(l.theme)})` : ''}"></span><span><b>${esc(l.title)}</b><small>Opens after you finish “${esc(lock.title)}”</small></span><span></span><span class="pill">${IC.lock} Locked</span></div>`
    : `<a class="lrow" href="#/lesson?id=${l.id}"><span class="thumb" style="${l.theme ? `background-image:url(${themeImg(l.theme)})` : ''}"></span><span><b>${esc(l.title)}</b><small>${p.done ? `Done · ${p.check ? 'check' : 'test'} ${pct(p.test.score)}` : esc(stepTxt(p))}${l.due && !p.done ? ' · ' + relDue(l.due) : ''}</small></span>${p.check ? '<span class="pill warn">Check</span>' : stepsMini(p)}${p.done ? scorePill(p.test.score) : `<span class="btn sm primary">${p.started ? 'Continue' : 'Start'}</span>`}</a>`;
  return `<div class="page-title"><div><p class="eyebrow">${esc(c.name)}</p><h1>Hi, ${esc(firstName(u))}!</h1></div>${cal.weeks ? `<span class="streak">${IC.bolt.replace('<svg', '<svg style="width:14px;height:14px"')}${cal.weeks} week streak</span>` : ''}</div>
  <div class="two-col">
    <div class="stack">
      ${next ? `<div class="card up-next"><div class="side"><p class="eyebrow">Up next</p><h2 style="font-size:24px">${esc(next.l.title)}</h2>
          <div class="tracker" style="grid-template-columns:1fr;gap:8px">${trackerSteps(next.p, next.l, true)}</div>
          <a class="btn primary lg" href="#/lesson?id=${next.l.id}">${IC.play} ${next.p.started ? 'Keep going' : 'Start the lesson'}</a></div>
        <div class="pv" style="${next.l.theme ? `background-image:url(${themeImg(next.l.theme)})` : ''}"><canvas id="nextCv" data-text="${esc(next.l.text)}"></canvas></div></div>`
        : `<div class="banner ok"><span class="big">${IC.check}</span><div><b>You’re all caught up.</b><div class="note">New lessons from ${esc(t ? t.name : 'your teacher')} show up here.</div></div></div>`}
      ${todo.filter(x => x !== next).length ? `<div class="sec-head"><h2><span class="ico">${IC.book}</span>To do</h2></div><div class="lesson-list">${todo.filter(x => x !== next).map(row).join('')}</div>` : ''}
      ${done.length ? `<div class="sec-head"><h2><span class="ico">${IC.check}</span>Finished</h2></div><div class="lesson-list">${done.map(row).join('')}</div>` : ''}
    </div>
    <div class="stack">
      ${c.message ? `<div class="msg-card"><small>Message from ${esc(t ? t.name : 'your teacher')}</small><p class="q">${esc(c.message)}</p></div>` : ''}
      <div class="card"><div class="card-head"><h2>My writing · ${esc(cal.title)}</h2></div>${cal.html}
        <div class="legend" style="margin-top:12px"><span><i style="background:var(--gold)"></i>10 mins or more</span><span><i style="background:color-mix(in srgb,var(--gold) 30%,var(--surface))"></i>Some writing</span></div>
        <p style="margin-top:12px;font-weight:800">${fmtMin(wk.seconds)} this week</p></div>
    </div>
  </div>`;
}, () => { const c = $('#nextCv'); if (c) paintPreview(c, c.dataset.text, { xh: 22, maxLines: 2 }); });

route('progress', { auth: 'student', nav: 'progress', title: 'My progress' }, () => {
  const u = state.user, all = DB.attempts.filter(a => a.userId === u.id), st = studentStats(u.id), cal = activityCalendar(all), items = lessonsForStudent(u).map(l => ({ l, p: progress(u.id, l.id) }));
  const done = items.filter(x => x.p.done);
  return `<div class="page-title"><h1>My progress</h1></div>
  <div class="kpis">${kpi('Lessons finished', `${done.length}<small>/ ${items.length}</small>`)}${kpi('Test average', pct(st.avgTest))}${kpi('Practice runs', st.practice)}${kpi('Writing time', fmtMin(st.seconds))}</div>
  <div class="two-col"><div class="card"><div class="card-head"><h2>${esc(cal.title)}</h2>${cal.weeks ? `<span class="streak">${cal.weeks} week streak</span>` : ''}</div>${cal.html}</div>
    <div class="card"><div class="card-head"><h2>Letters I’m working on</h2></div>${letterGrid(letterReport(all), 9)}</div></div>
  <div class="card stack" style="max-width:560px"><h2 style="font-size:17px">My settings</h2>
    <label class="check"><input type="checkbox" data-change="handed" ${u.handed === 'left' ? 'checked' : ''}><span>I write with my left hand. The hints move to the other side of the pen so your hand doesn’t cover them.</span></label></div>`;
}, () => paintGlyphs());

// ---------------------------------------------------------------- lesson page
route('lesson', { auth: 'student', nav: 'home', title: q => (lessonById(q.get('id')) || {}).title || 'Lesson' }, q => {
  const l = lessonById(q.get('id')); if (!l || !lessonsForStudent(state.user).includes(l)) { go('home'); return null; }
  const lock = lessonLocked(state.user, l); if (lock) { go('home'); setTimeout(() => toast(`Finish “${esc(lock.title)}” first.`), 50); return null; }
  return lessonPage(l, { back: 'home' });
}, () => lessonAfter({}));

function trackerSteps(p, l, compact){
  const s = (n, cls, title, sub) => `<div class="tstep ${cls}"><span class="n">${cls === 'done' ? IC.check : cls === 'lock' ? IC.lock : n}</span><span><b>${title}</b><small>${sub}</small></span></div>`;
  if (isCheck(l)) return s(1, p.test ? 'done' : 'now', 'Handwriting check', p.test ? `Score ${pct(p.test.score)}` : 'No music, no demo, one try. Write as neatly as you can.');
  const now = !p.demo ? 1 : !p.practice ? 2 : !p.test ? 3 : 0;
  return s(1, p.demo ? 'done' : now === 1 ? 'now' : '', 'Watch the demo', p.demo ? `Watched ${p.demo}×` : 'Start here, as often as you like')
    + s(2, p.practice ? 'done' : now === 2 ? 'now' : 'lock', 'Practice with the music', p.practice ? `${p.practice} run${p.practice > 1 ? 's' : ''} · best ${pct(p.bestPractice)}` : p.demo ? 'The music waits for you' : 'Opens after the demo')
    + s(3, p.test ? 'done' : now === 3 ? 'now' : 'lock', 'Take the test', p.test ? `Score ${pct(p.test.score)}` : p.practice ? 'No music · one try' : 'Opens after practice');
}
function lessonPage(l, { guest, preview, back } = {}){
  const s = songById(l.songId), bpm = Math.round((s ? s.bpm : 84) * l.mult * 10) / 10, c = classById(l.classId);
  state.launch = { ...(state.launch || {}), lesson: l, guest, preview, back, local: { demo: 0, practice: 0, test: null, bestPractice: 0 } };
  const theme = THEMES.find(t => t.id === l.theme) || THEMES[0];
  return `<a class="crumbs" href="#/${back || (guest ? '' : 'home')}" style="text-decoration:none">${IC.back.replace('<svg', '<svg style="width:16px;height:16px"')} ${guest ? 'Back to FloWriter' : preview ? 'Back' : 'My lessons'}</a>
  <div class="lesson-head"><div><p class="eyebrow">${guest ? 'Try a lesson' : preview ? 'Student preview' : esc(c ? c.name : 'Lesson')}</p><h1>${esc(l.title)}</h1></div>
    <div class="row">${isCheck(l) ? '<span class="pill warn">Handwriting check · no music</span>' : `<span class="pill">${IC.music}${esc(s ? s.title : 'Built-in beat')} · ${bpm} BPM</span>`}<span class="pill">${esc(theme.label)}</span><span class="pill">${DIFF[l.difficulty || 'standard'].label}</span>${l.due && !guest ? `<span class="pill ${l.due < Date.now() + 2 * DAY ? 'warn' : ''}">${relDue(l.due)}</span>` : ''}</div></div>
  ${guest ? `<div class="banner blue">${IC.eye}<div><b>Nothing is saved in a tryout.</b> <span class="note">Teachers can <a href="#/signup">start a class</a>; students can <a href="#/join">join with a code</a>.</span></div></div>`
    : preview ? `<div class="banner blue">${IC.eye}<div><b>Preview.</b> <span class="note">This is what students see. Nothing is saved, and every step is open.</span></div></div>` : ''}
  <div class="tracker" id="tracker"></div>
  <div id="doneBox"></div>
  <div class="engine-wrap" id="engineWrap"></div>`;
}
function lessonProgress(){
  const L = state.launch, u = state.user;
  if (L.guest || L.preview) return L.local;
  return progress(u.id, L.lesson.id);
}
function paintTracker(){
  const L = state.launch, p = lessonProgress(), el = $('#tracker'); if (!el) return;
  el.innerHTML = trackerSteps(p, L.lesson);
  const box = $('#doneBox');
  if (box) box.innerHTML = p.test ? `<div class="banner ok"><span class="big">${pct(p.test.score)}</span><div style="flex:1;min-width:200px"><b>${L.guest || L.preview ? 'Test scored.' : 'Lesson complete!'}</b> <span class="note">${p.test.valid} of ${p.test.total} strokes on the line${p.test.reversed ? ` · ${p.test.reversed} drawn backwards` : ''}. ${L.guest || L.preview ? '' : 'You can keep watching and practicing.'}</span></div>
    ${p.test.letters && p.test.letters.some(x => x.score < .9) ? `<div class="row" style="gap:6px"><span class="note" style="font-weight:800">Practice these:</span>${p.test.letters.filter(x => x.score < .9).sort((a, b) => a.score - b.score).slice(0, 3).map(x => `<span class="pill ${x.score < .7 ? 'bad' : 'blue'}" style="font-size:15px">${esc(x.ch)} ${pct(x.score)}</span>`).join('')}</div>` : ''}</div>` : '';
}
function lessonAfter(){
  const L = state.launch; if (!L || !L.lesson) return;
  paintTracker();
  const l = L.lesson, song = isCheck(l) ? null : songById(l.songId), p = lessonProgress();
  const role = L.guest || L.preview ? 'preview' : 'student';
  let active = 0, lastAt = Date.now(), lastRec = null;
  mountEngine($('#engineWrap'), { word: cleanText(l.text), title: l.title, bps: l.bps || 1, rest: l.rest ?? 1, tol: DIFF[l.difficulty || 'standard'].tol, skin: l.theme || '', role, checkOnly: isCheck(l),
    progress: role === 'preview' ? { demo: 1, practice: 1 } : { demo: p.demo, practice: p.practice, test: p.test ? { score: p.test.score, valid: p.test.valid, total: p.test.total } : null } }, song, l.mult || 1, m => {
    if (m.type === 'active') { active += 5; return; }
    if (m.type !== 'run') return;
    const wall = (Date.now() - lastAt) / 1000; lastAt = Date.now();
    const seconds = Math.round(m.mode === 'demo' ? Math.min(150, wall) : Math.max(5, Math.min(wall, active + 5))); active = 0;
    if (role === 'preview') {
      const loc = L.local; if (m.mode === 'demo') loc.demo++; else if (m.mode === 'practice') { loc.practice++; loc.bestPractice = Math.max(loc.bestPractice, m.score || 0); } else loc.test = { score: m.score, valid: m.valid, total: m.total, reversed: m.reversed, letters: m.letters };
    } else {
      lastRec = api.recordAttempt({ userId: state.user.id, lessonId: l.id, mode: m.mode, score: m.score, valid: m.valid, total: m.total, reversed: m.reversed || 0, gate: m.gate || null, bpm: m.bpm ?? null, seconds,
        letters: m.mode === 'test' ? m.letters : null, trace: m.mode === 'demo' ? null : m.img });
    }
    paintTracker();
    if (m.mode === 'practice') toast(`Practice: <b>${pct(m.score)}</b> · ${m.valid} of ${m.total} strokes on the line${m.reversed ? ` · ${m.reversed} backwards` : ''}`);
    if (m.mode === 'test') { toast(`Test submitted: <b>${pct(m.score)}</b>`, 4500); $('#doneBox')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  cleanup.push(() => { if (lastRec && lastRec.mode !== 'test' && active > 0) api.addSeconds(lastRec.id, active); });
}

CHANGE.handed = t => { api.updateProfile({ handed: t.checked ? 'left' : 'right' }); toast(t.checked ? 'Hints now sit on the right of the pen' : 'Hints now sit on the left of the pen'); };
FORMS['student-join'] = async f => { const c = await api.changeClass(f.code.value); state.user = userById(state.user.id) || state.user; rerender(); toast(`You joined ${esc(c.name)}`); };
