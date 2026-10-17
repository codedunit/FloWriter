// =====================================================================
// Teacher pages
// =====================================================================
const myClasses = (all = false) => DB.classes.filter(c => c.teacherId === state.user.id && (all || !c.archived)).sort((a, b) => a.created - b.created);
function scope(cid = 'all'){
  const classes = myClasses().filter(c => cid === 'all' || c.id === cid), ids = new Set(classes.map(c => c.id));
  const kids = DB.users.filter(u => u.role === 'student' && ids.has(u.classId)), kidIds = new Set(kids.map(k => k.id));
  return { classes, kids, lessons: DB.lessons.filter(l => ids.has(l.classId)), attempts: DB.attempts.filter(a => kidIds.has(a.userId)) };
}
function period(d, from, to){
  const at = d.attempts.filter(a => a.date >= from && a.date < to), tests = at.filter(a => a.mode === 'test');
  return { at, tests, seconds: at.reduce((s, a) => s + (a.seconds || 0), 0), avgTest: tests.length ? tests.reduce((s, a) => s + a.score, 0) / tests.length : null,
    completed: tests.length, active: new Set(at.map(a => a.userId)).size, reversed: tests.reduce((s, a) => s + (a.reversed || 0), 0) };
}
const nameOf = id => (userById(id) || {}).name || 'Student';
const medal = i => `<span class="medal ${i ? 'm' + (i + 1) : ''}">${i + 1}</span>`;
function awards(d, from, to){
  const at = d.attempts.filter(a => a.date >= from && a.date < to), by = new Map();
  at.forEach(a => { const e = by.get(a.userId) || { best: null, secs: 0, prac: [] }; e.secs += a.seconds || 0; if (a.mode === 'test') e.best = Math.max(e.best ?? 0, a.score); if (a.mode === 'practice' && a.score != null) e.prac.push(a); by.set(a.userId, e); });
  const rows = [...by.entries()];
  const top = rows.filter(([, e]) => e.best != null).sort((a, b) => b[1].best - a[1].best).slice(0, 3).map(([id, e]) => [id, pct(e.best)]);
  const most = rows.sort((a, b) => b[1].secs - a[1].secs).filter(([, e]) => e.secs > 0).slice(0, 3).map(([id, e]) => [id, fmtMin(e.secs)]);
  const imp = rows.map(([id, e]) => { const byL = new Map(); e.prac.forEach(a => { const l = byL.get(a.lessonId) || []; l.push(a); byL.set(a.lessonId, l); });
    let g = -1; byL.forEach(l => { if (l.length > 1) { l.sort((a, b) => a.date - b.date); g = Math.max(g, l[l.length - 1].score - l[0].score); } }); return [id, g]; })
    .filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, g]) => [id, '+' + Math.round(g * 100) + ' pts']);
  const card = (title, c, ic, col, list, empty) => `<div class="award" style="--c:var(${c})"><div class="t"><span class="ic">${ic}</span><h3>${title}</h3></div>
    ${list.length ? `<table><thead><tr><th>Name</th><th>${col}</th></tr></thead><tbody>${list.map(([id, v], i) => `<tr><td>${medal(i)}<a href="#/student?id=${id}" style="color:inherit;text-decoration:none">${esc(nameOf(id))}</a></td><td class="num">${v}</td></tr>`).join('')}</tbody></table>` : `<p class="note">${empty}</p>`}</div>`;
  return `<div class="awards">${card('Top test scores', '--gold', IC.star, 'Score', top, 'No tests taken in this period.')}${card('Most practice', '--coral', IC.clock, 'Time', most, 'No practice yet.')}${card('Most improved', '--sky', IC.trend, 'Practice gain', imp, 'Shows once students practice a lesson more than once.')}</div>`;
}
function needsHand(d){
  const now = Date.now(), list = [];
  d.kids.forEach(k => {
    const tests = d.attempts.filter(a => a.userId === k.id && a.mode === 'test' && a.date > now - 30 * DAY), why = [];
    const avg = tests.length ? tests.reduce((s, a) => s + a.score, 0) / tests.length : null;
    if (avg != null && avg < .7) why.push(`<span class="pill bad">Tests ${pct(avg)}</span>`);
    const rev = tests.reduce((s, a) => s + (a.reversed || 0), 0); if (rev >= 2) why.push(`<span class="pill warn">${rev} backwards strokes</span>`);
    const late = d.lessons.filter(l => l.due && l.due < now && (!l.studentIds || l.studentIds.includes(k.id)) && l.classId === k.classId && !progress(k.id, l.id).done).length;
    if (late) why.push(`<span class="pill warn">${late} past due</span>`);
    if (why.length) list.push({ k, why, w: why.length + (avg != null ? 1 - avg : 0) });
  });
  return list.sort((a, b) => b.w - a.w).slice(0, 6);
}

// ---------------------------------------------------------------- dashboard
route('dashboard', { auth: 'teacher', nav: 'dashboard', title: 'Dashboard' }, () => {
  const T = state.teach, cls = myClasses();
  if (!cls.some(c => c.id === T.chartClass)) T.chartClass = 'all';
  const d = scope(T.chartClass), now = Date.now(), today = dayStart(now) + DAY, R = 7 * DAY;
  const cur = period(d, today - R, today), prev = period(d, today - 2 * R, today - R);
  const days = [...Array(7)].map((_, i) => today - (7 - i) * DAY);
  const mins = (from) => days.map(t => Math.round(d.attempts.filter(a => a.date >= t - from && a.date < t - from + DAY).reduce((s, a) => s + (a.seconds || 0), 0) / 60 / Math.max(1, d.kids.length) * 10) / 10);
  const live = d.attempts.filter(a => a.date > now - 30 * 6e4), liveKids = new Set(live.map(a => a.userId));
  const buckets = [...Array(15)].map((_, i) => live.filter(a => a.date >= now - (15 - i) * 2 * 6e4 && a.date < now - (14 - i) * 2 * 6e4).length);
  const bmax = Math.max(1, ...buckets);
  const hand = needsHand(d), letters = letterReport(d.attempts);
  return `<div class="sec-head"><div><h2><span class="ico">${IC.dash}</span>Class performance</h2><p>Your students from ${fmtShort(today - R)} to ${fmtShort(today - DAY)}, compared with the week before.</p></div>
      <div class="row"><label class="sr-only" for="chartClass">Class</label><select class="input" id="chartClass" data-change="chart-class" style="width:auto"><option value="all">All classes</option>${cls.map(c => `<option value="${c.id}" ${c.id === T.chartClass ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <button class="btn" type="button" data-act="refresh">${IC.refresh} Refresh</button></div></div>
    <div class="kpis">
      ${kpi('Practice time', fmtMin(cur.seconds), 'Prev week', fmtMin(prev.seconds), delta(cur.seconds, prev.seconds))}
      ${kpi('Average test score', pct(cur.avgTest), 'Prev week', pct(prev.avgTest), delta(cur.avgTest, prev.avgTest))}
      ${kpi('Lessons completed', cur.completed, 'Prev week', prev.completed, delta(cur.completed, prev.completed))}
      ${kpi('Students writing', `${cur.active}<small>/ ${d.kids.length}</small>`, 'Prev week', prev.active, delta(cur.active, prev.active))}
    </div>
    <div class="two-col">
      <div class="card"><div class="card-head"><h2>Practice minutes per student</h2><span class="legend"><span><i style="background:var(--blue)"></i>This week</span><span><i style="background:var(--faint)"></i>Last week</span></span></div>
        ${lineChart({ label: 'Average practice minutes per student per day, this week and last', labels: days.map(t => fmtShort(t)), now: mins(0), prev: mins(R), nowName: 'This week', prevName: 'Last week', fmt: v => (Math.round(v * 10) / 10) + 'm' })}</div>
      <div class="card"><div class="card-head"><h2>${IC.live.replace('<svg', '<svg style="width:20px;height:20px;color:var(--blue);vertical-align:-4px;margin-right:6px"')}Live activity</h2><a href="#/classes" class="note" style="font-weight:800">Classes →</a></div>
        <div class="row" style="align-items:baseline;gap:8px"><span style="font-size:34px;font-weight:900" class="num">${liveKids.size}</span><span class="muted" style="font-weight:700">students writing in the last 30 mins</span></div>
        <div class="live-bars" aria-hidden="true" style="margin:12px 0 14px">${buckets.map(b => `<i style="height:${Math.max(4, b / bmax * 100)}%;opacity:${b ? .9 : .25}"></i>`).join('')}</div>
        <table class="t" style="min-width:0"><thead><tr><th>Class</th><th style="text-align:right">Writing now</th></tr></thead><tbody>${d.classes.map(c => { const n = classStudents(c.id).length, a = classStudents(c.id).filter(k => liveKids.has(k.id)).length; return `<tr class="click" data-act="nav" data-to="class?id=${c.id}"><td><b>${esc(c.name)}</b><div class="bar blue" style="margin-top:6px"><i style="width:${n ? a / n * 100 : 0}%"></i></div></td><td class="num" style="text-align:right">${a}/${n}</td></tr>`; }).join('') || '<tr><td colspan="2" class="empty">No classes yet.</td></tr>'}</tbody></table></div>
    </div>
    <div class="sec-head"><div><h2><span class="ico">${IC.star}</span>This week’s awards</h2><p>Who has been writing the most and the best across your classes.</p></div></div>
    ${awards(d, today - R, today)}
    <div class="two-col">
      <div class="card"><div class="card-head"><h2>Could use a hand</h2><span class="note">Last 30 days</span></div>
        ${hand.length ? `<div class="stack" style="gap:10px">${hand.map(({ k, why }) => `<a href="#/student?id=${k.id}" class="row" style="text-decoration:none;color:inherit;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:10px"><span class="row"><span class="avatar">${esc(initials(k))}</span><b>${esc(k.name)}</b></span><span class="row" style="gap:6px">${why.join('')}</span></a>`).join('')}</div>` : '<p class="note">Nobody is behind or struggling right now.</p>'}</div>
      <div class="card"><div class="card-head"><h2>Hardest letters</h2><span class="note">Average test score per letter</span></div>${letterGrid(letters, 8)}
        ${letters.length ? `<button class="btn sm" style="margin-top:14px" type="button" data-act="review-lesson" data-letters="${esc(letters.slice(0, 4).map(l => l.ch).join(''))}" data-class="${T.chartClass === 'all' ? (cls[0] || {}).id || '' : T.chartClass}">${IC.plus} Make a review lesson for these letters</button>` : ''}</div>
    </div>`;
}, () => { paintGlyphs(); const t = setInterval(() => { if (!api.demo) api.refresh().then(() => { if (parseHash().path === 'dashboard') rerender(); }); }, 60000); cleanup.push(() => clearInterval(t)); });
Object.assign(ACT, {
  refresh: async t => { t.disabled = true; await api.refresh(); rerender(); toast('Up to date'); },
  'review-lesson': t => { newDraft({ classIds: t.dataset.class ? [t.dataset.class] : [], title: 'Review: ' + t.dataset.letters.split('').join(' '), text: generateText({ focus: t.dataset.letters, kind: 'words', count: 6 }), gen: { focus: t.dataset.letters } }); go('lesson-edit'); },
});
const CHANGE = {};
document.addEventListener('change', e => { const k = e.target.dataset.change; if (k && CHANGE[k]) CHANGE[k](e.target, e); });
CHANGE['chart-class'] = t => { state.teach.chartClass = t.value; rerender(); };

// ---------------------------------------------------------------- search
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return; const q = e.target.value.trim().toLowerCase(), box = $('#qres'); if (!q) { box.hidden = true; return; }
  const ids = new Set(myClasses(true).map(c => c.id));
  const kids = DB.users.filter(u => u.role === 'student' && ids.has(u.classId) && (u.name.toLowerCase().includes(q) || u.username.includes(q))).slice(0, 6);
  const ls = DB.lessons.filter(l => ids.has(l.classId) && l.title.toLowerCase().includes(q)).slice(0, 4);
  box.innerHTML = [...kids.map(k => `<a href="#/student?id=${k.id}"><span class="avatar" style="width:26px;height:26px;font-size:11px">${esc(initials(k))}</span>${esc(k.name)} <small>${esc((classById(k.classId) || {}).name)}</small></a>`), ...ls.map(l => `<a href="#/lesson-edit?id=${l.id}">${IC.book}${esc(l.title)} <small>${esc((classById(l.classId) || {}).name)}</small></a>`)].join('') || '<a>No matches</a>';
  box.hidden = false;
});
document.addEventListener('click', e => { const box = $('#qres'); if (box && !e.target.closest('.search')) box.hidden = true; });

// ---------------------------------------------------------------- classes
route('classes', { auth: 'teacher', nav: 'classes', title: 'Classes' }, () => {
  const cls = myClasses(true);
  return `<div class="page-title"><h1>Your classes</h1><button class="btn primary" type="button" data-act="new-class">${IC.plus} New class</button></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${cls.map(c => { const kids = classStudents(c.id), ls = lessonsForClass(c.id), comp = ls.map(lessonCompletion), done = comp.reduce((s, x) => s + x.done, 0), tot = comp.reduce((s, x) => s + x.total, 0);
    return `<a class="card" href="#/class?id=${c.id}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:12px">
      <div class="row" style="justify-content:space-between"><h2 style="font-size:19px">${esc(c.name)}</h2>${c.archived ? '<span class="pill">Archived</span>' : `<span class="pill blue mono">${esc(c.code)}</span>`}</div>
      <div class="facts"><div class="fact"><div class="k">Students</div><div class="v">${kids.length}</div></div><div class="fact"><div class="k">Lessons</div><div class="v">${ls.length}</div></div></div>
      <div><div class="row note" style="justify-content:space-between;font-weight:700"><span>Lessons completed</span><span class="num">${done}/${tot}</span></div><div class="bar" style="margin-top:6px"><i style="width:${tot ? done / tot * 100 : 0}%"></i></div></div></a>`; }).join('')}
    <button type="button" class="card" data-act="new-class" style="border-style:dashed;display:grid;place-items:center;min-height:180px;cursor:pointer;font-weight:800;color:var(--blue-ink)">${IC.plus} Add a class</button></div>`;
});
ACT['new-class'] = () => openModal(`<form data-form="new-class" class="stack" novalidate><h2>New class</h2><div class="field"><label for="ncName">Class name</label><input class="input" id="ncName" name="name" placeholder="Period 4 · 3rd grade" required></div><p class="note">FloWriter makes a 6-character join code for it.</p><p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Create class</button></div></form>`);

// ---------------------------------------------------------------- one class
function classHeader(c, tab){
  const kids = classStudents(c.id), ls = lessonsForClass(c.id);
  const t = (k, l) => `<a href="#/class?id=${c.id}&tab=${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}</a>`;
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/classes">Classes</a><span>›</span><span style="color:var(--ink)">${esc(c.name)}</span></nav>
  <div class="page-title"><div class="row"><h1>${esc(c.name)}</h1><button class="icon-btn" type="button" data-act="class-settings" data-id="${c.id}" aria-label="Class settings">${IC.gear}</button>${c.archived ? '<span class="pill">Archived</span>' : ''}</div>
    <div class="row"><div style="text-align:right"><div class="note" style="font-weight:800">Class join code</div><button type="button" class="btn ghost mono" style="padding:2px 0;font-size:18px;letter-spacing:.12em;color:var(--blue-ink)" data-act="copy-code" data-code="${esc(c.code)}">${IC.copy}${esc(c.code)}</button></div>
    <button class="btn" type="button" data-act="join-sheet" data-id="${c.id}">${IC.link} Invite students</button><a class="btn primary" href="#/lesson-edit?class=${c.id}">${IC.plus} New lesson</a></div></div>
  <nav class="tabs" aria-label="Class sections">${t('overview', 'Overview')}${t('students', `Students (${kids.length})`)}${t('lessons', `Lessons (${ls.length})`)}${t('checks', 'Handwriting checks')}${t('letters', 'Letters')}</nav>`;
}
route('class', { auth: 'teacher', nav: 'classes', title: q => (classById(q.get('id')) || {}).name || 'Class' }, q => {
  const c = classById(q.get('id')); if (!c || c.teacherId !== state.user.id) { go('classes'); return null; }
  const tab = q.get('tab') || 'overview', kids = classStudents(c.id), ls = lessonsForClass(c.id), d = scope(c.id);
  d.classes = [c]; d.kids = kids; d.lessons = ls; d.attempts = DB.attempts.filter(a => kids.some(k => k.id === a.userId));
  let body = '';
  if (tab === 'overview') {
    const today = dayStart(Date.now()) + DAY, R = 7 * DAY, cur = period(d, today - R, today), prev = period(d, today - 2 * R, today - R);
    body = `<div class="two-col">
      <div class="stack"><div class="sec-head"><h2><span class="ico">${IC.book}</span>Recent lessons</h2><a class="note" style="font-weight:800" href="#/class?id=${c.id}&tab=lessons">View all lessons</a></div>
        <div class="table-wrap"><table class="t" style="min-width:520px"><thead><tr><th>Title</th><th>Song</th><th>Due</th><th>Completed</th></tr></thead><tbody>${ls.slice(0, 5).map(l => { const s = songById(l.songId), cm = lessonCompletion(l); return `<tr class="click" data-act="nav" data-to="lesson-edit?id=${l.id}"><td><b>${esc(l.title)}</b><div class="note">${Cursive.build(l.text).strokes.length} strokes</div></td><td>${esc(s ? s.title : 'Built-in beat')}<div class="note num">${s ? Math.round(s.bpm * l.mult) : 84} BPM</div></td><td>${l.due ? fmtShort(l.due) : '–'}</td><td><div class="minibar"><span class="bar"><i style="width:${cm.pct * 100}%"></i></span><span class="num note">${cm.done}/${cm.total}</span></div></td></tr>`; }).join('') || `<tr><td colspan="4" class="empty">No lessons yet. <a href="#/lesson-edit?class=${c.id}">Make the first one</a>.</td></tr>`}</tbody></table></div></div>
      <div class="stack"><div class="sec-head"><h2><span class="ico">${IC.flag}</span>Class message</h2></div>
        <div class="msg-card"><small>Message from ${esc(state.user.name)}</small><p class="q">${c.message ? esc(c.message) : 'No message yet. Students see this on their lesson page.'}</p><div class="row" style="justify-content:flex-end"><button class="btn sm" type="button" data-act="edit-message" data-id="${c.id}">${IC.edit} Edit message</button></div></div></div></div>
      <div class="sec-head"><div><h2><span class="ico">${IC.chart}</span>Class performance</h2><p>${fmtShort(today - R)} to ${fmtShort(today - DAY)}, compared with the week before</p></div></div>
      <div class="kpis">${kpi('Practice time', fmtMin(cur.seconds), 'Prev week', fmtMin(prev.seconds), delta(cur.seconds, prev.seconds))}${kpi('Average test score', pct(cur.avgTest), 'Prev week', pct(prev.avgTest), delta(cur.avgTest, prev.avgTest))}${kpi('Lessons completed', cur.completed, 'Prev week', prev.completed, delta(cur.completed, prev.completed))}${kpi('Backwards strokes', cur.reversed, 'Prev week', prev.reversed, delta(cur.reversed, prev.reversed, { invert: true }))}</div>
      <div class="sec-head"><h2><span class="ico">${IC.star}</span>This week’s awards</h2></div>${awards(d, today - R, today)}`;
  } else if (tab === 'checks') {
    const checks = ls.filter(isCheck).sort((a, b) => a.created - b.created);
    const rows = kids.map(k => { const sc = checks.map(l => { const p = progress(k.id, l.id); return p.test ? p.test.score : null; }), got = sc.filter(x => x != null); return { k, sc, change: got.length > 1 ? got[got.length - 1] - got[0] : null }; });
    const avgCol = i => { const v = rows.map(r => r.sc[i]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const ch = rows.filter(r => r.change != null), avgCh = ch.length ? ch.reduce((a, r) => a + r.change, 0) / ch.length : null;
    body = `<div class="card"><div class="card-head"><div><h2>Handwriting checks</h2><p class="note">A check is the test alone: no demo, no music, one try. Give the same check at the start of the pilot and again at the end, and the change shows whether the practice carried over.</p></div>
      <a class="btn primary" href="#/lesson-edit?class=${c.id}&kind=check">${IC.plus} New handwriting check</a></div>
      ${checks.length ? `<div class="kpis" style="grid-template-columns:repeat(${Math.min(4, checks.length + 1)},minmax(0,1fr));margin-bottom:16px">${checks.map((l, i) => kpi(esc(l.title), pct(avgCol(i)), 'Taken by', `${rows.filter(r => r.sc[i] != null).length}/${kids.length}`)).join('')}${checks.length > 1 ? kpi('Average change', avgCh == null ? '–' : `${avgCh >= 0 ? '+' : ''}${Math.round(avgCh * 100)}<small>pts</small>`, 'Students with 2+ checks', ch.length) : ''}</div>
      <div class="table-wrap" style="box-shadow:none"><table class="t"><thead><tr><th>Student</th>${checks.map(l => `<th>${esc(l.title)}<div class="note" style="text-transform:none;letter-spacing:0">${fmtShort(l.created)}</div></th>`).join('')}${checks.length > 1 ? '<th>Change</th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.k.name)}</b></td>${r.sc.map(x => `<td>${x == null ? '<span class="note">Not taken</span>' : scorePill(x)}</td>`).join('')}${checks.length > 1 ? `<td class="num">${r.change == null ? '–' : `<b style="color:var(${r.change >= 0 ? '--ok' : '--bad'})">${r.change >= 0 ? '+' : ''}${Math.round(r.change * 100)}</b>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>`
      : `<p class="empty">No handwriting checks yet. Start with one before the first lesson.</p>`}</div>`;
  } else if (tab === 'students') {
    body = `<div class="row" style="justify-content:space-between"><p class="note" style="max-width:56ch">Younger students can sign in by scanning a login card with the tablet camera. Older students can join with the class code and make their own password.</p>
      <div class="row"><button class="btn" type="button" data-act="add-students" data-id="${c.id}">${IC.plus} Add students</button><button class="btn" type="button" data-act="login-cards" data-id="${c.id}">${IC.users} Login cards</button><button class="btn" type="button" data-act="export-class" data-id="${c.id}">${IC.download} Export CSV</button></div></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Student</th><th>Last active</th><th>Lessons done</th><th>Current lesson</th><th>Avg test</th><th>Practice (7 days)</th><th></th></tr></thead><tbody>${kids.map(k => {
      const mine = lessonsForStudent(k), pr = mine.map(l => ({ l, p: progress(k.id, l.id) })), done = pr.filter(x => x.p.done).length, curL = pr.find(x => !x.p.done), st = studentStats(k.id), wk = studentStats(k.id, Date.now() - 7 * DAY);
      return `<tr class="click" data-act="nav" data-to="student?id=${k.id}" tabindex="0"><td><div class="name-cell"><span class="avatar">${esc(initials(k))}</span><span><b>${esc(k.name)}</b><small class="mono">@${esc(k.username)}</small></span></div></td><td>${fmtAgo(k.lastSeen)}</td>
        <td><div class="minibar"><span class="bar"><i style="width:${mine.length ? done / mine.length * 100 : 0}%"></i></span><span class="num note">${done}/${mine.length}</span></div></td>
        <td>${curL ? `<div class="row" style="gap:8px;flex-wrap:nowrap">${stepsMini(curL.p)}<span class="note" style="font-weight:700">${esc(curL.l.title)}</span></div>` : '<span class="pill ok">All done</span>'}</td>
        <td>${scorePill(st.avgTest)}</td><td class="num">${fmtMin(wk.seconds)}</td>
        <td><div class="acts"><button class="btn sm" type="button" data-act="reset-pw" data-id="${k.id}" title="Set a new password">${IC.lock}</button></div></td></tr>`; }).join('') || `<tr><td colspan="7" class="empty">No students yet. Share the code <b class="mono">${esc(c.code)}</b> or the invite link.</td></tr>`}</tbody></table></div>`;
  } else if (tab === 'lessons') {
    body = `<div class="table-wrap"><table class="t"><thead><tr><th>Lesson</th><th>Song and tempo</th><th>Theme</th><th>Due</th><th>Completed</th><th></th></tr></thead><tbody>${ls.map(l => { const s = songById(l.songId), cm = lessonCompletion(l);
      return `<tr><td><b>${esc(l.title)}</b><div class="note">“${esc(l.text.length > 34 ? l.text.slice(0, 32) + '…' : l.text)}”${l.studentIds ? ` · ${l.studentIds.length} student${l.studentIds.length > 1 ? 's' : ''}` : ''}</div></td>
        <td>${esc(s ? s.title : 'Built-in beat')}<div class="note num">${s ? Math.round(s.bpm * l.mult) : 84} BPM${l.mult !== 1 ? ` · ${l.mult}×` : ''}${l.bps === 2 ? ' · 2 beats a stroke' : ''}</div></td>
        <td>${esc((THEMES.find(t => t.id === l.theme) || THEMES[0]).label)}</td><td>${l.due ? `<span class="pill ${l.due < Date.now() ? '' : l.due - Date.now() < 2 * DAY ? 'warn' : 'blue'}">${fmtShort(l.due)}</span>` : '–'}</td>
        <td><div class="minibar"><span class="bar"><i style="width:${cm.pct * 100}%"></i></span><span class="num note">${cm.done}/${cm.total}</span></div></td>
        <td><div class="acts"><a class="btn sm" href="#/preview?id=${l.id}" title="Preview as a student">${IC.eye}</a><a class="btn sm" href="#/lesson-edit?id=${l.id}" title="Edit">${IC.edit}</a><button class="btn sm" type="button" data-act="copy-lesson" data-id="${l.id}" title="Copy to another class">${IC.copy}</button><button class="btn sm danger" type="button" data-act="delete-lesson" data-id="${l.id}" title="Delete">${IC.trash}</button></div></td></tr>`; }).join('') || `<tr><td colspan="6" class="empty">No lessons yet.</td></tr>`}</tbody></table></div>`;
  } else {
    const rep = letterReport(d.attempts);
    body = `<div class="card"><div class="card-head"><div><h2>Letter report</h2><p class="note">Average test score for every letter this class has been tested on, hardest first. ↺ counts strokes written in the wrong direction.</p></div>
      ${rep.length ? `<button class="btn" type="button" data-act="review-lesson" data-letters="${esc(rep.slice(0, 4).map(l => l.ch).join(''))}" data-class="${c.id}">${IC.plus} Review lesson for the 4 hardest</button>` : ''}</div>${letterGrid(rep, 60)}</div>`;
  }
  return classHeader(c, tab) + body;
}, () => paintGlyphs());
Object.assign(ACT, {
  'copy-code': t => copyText(t.dataset.code, 'class code ' + t.dataset.code),
  'join-sheet': t => { const c = classById(t.dataset.id), link = joinLink(c.code);
    openModal(`<h2>Invite students to ${esc(c.name)}</h2><p class="muted">Put this on the board. Students go to the link, or open FloWriter, choose <b>Join a class</b>, and type the code.</p>
      <div style="text-align:center;padding:10px;border:1px dashed var(--line-2);border-radius:14px"><div class="note" style="font-weight:800">Class code</div><div class="code-big">${esc(c.code)}</div></div>
      <div class="field"><label for="jlink">Invite link</label><div class="row" style="flex-wrap:nowrap"><input class="input mono" id="jlink" value="${esc(link)}" readonly><button class="btn" type="button" data-act="copy-link" data-link="${esc(link)}">${IC.copy} Copy</button></div></div>
      <p class="note">Students pick a username and a password. They are not asked for an email or a birth date.</p>
      <div class="row" style="justify-content:space-between"><button class="btn" type="button" data-act="regen-code" data-id="${c.id}">${IC.refresh} Make a new code</button><button class="btn primary" type="button" data-act="close-modal">Done</button></div>`); },
  'copy-link': t => copyText(t.dataset.link, 'invite link'),
  'regen-code': t => confirmBox('Make a new join code?', 'The old code stops working right away. Students already in the class stay in it.', 'Make new code', () => { const code = api.regenCode(t.dataset.id); rerender(); toast(`New class code: <span class="mono">${esc(code)}</span>`); }, false),
  'class-settings': t => { const c = classById(t.dataset.id); openModal(`<form data-form="class-settings" class="stack" novalidate><h2>Class settings</h2><input type="hidden" name="id" value="${c.id}">
    <div class="field"><label for="csName">Class name</label><input class="input" id="csName" name="name" value="${esc(c.name)}" required></div>
    <label class="check"><input type="checkbox" name="sequential" ${c.sequential ? 'checked' : ''}><span>Open lessons one at a time, in the order they were assigned. A lesson opens when the one before it is done. Handwriting checks are always open.</span></label>
    <label class="check"><input type="checkbox" name="archived" ${c.archived ? 'checked' : ''}><span>Archive this class. Its code stops working and it leaves the dashboard. Student work is kept.</span></label>
    <p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`); },
  'edit-message': t => { const c = classById(t.dataset.id); openModal(`<form data-form="class-message" class="stack" novalidate><h2>Class message</h2><input type="hidden" name="id" value="${c.id}"><div class="field"><label for="cmText">Students see this on their lessons page</label><textarea class="input" id="cmText" name="message" maxlength="200" placeholder="Ten minutes of FloWriter every day this week!">${esc(c.message || '')}</textarea><small>Up to 200 characters.</small></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Save message</button></div></form>`); },
  'reset-pw': (t, e) => { e.stopPropagation(); const k = userById(t.dataset.id); confirmBox(`Set a new password for ${k.name}?`, 'Their old password stops working. You’ll see the new one to give them.', 'Set new password', async () => { try { const pw = await api.resetStudentPassword(k.id); openModal(`<h2>New password for ${esc(k.name)}</h2><dl class="creds"><dt>Username</dt><dd>${esc(k.username)}</dd><dt>Password</dt><dd>${esc(pw)}</dd></dl><p class="note">Write it down for the student. It isn’t shown again.</p><div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-act="close-modal">Done</button></div>`); } catch (err) { toast(esc(err.message)); } }, false); },
  'remove-student': t => { const k = userById(t.dataset.id); confirmBox(`Remove ${k.name} from the class?`, 'They lose this class’s lessons. Their past work stays in their account.', 'Remove', () => { const cid = k.classId; api.removeStudent(k.id); go('class?id=' + cid + '&tab=students'); toast(`${esc(k.name)} removed`); }); },
  'delete-lesson': t => { const l = lessonById(t.dataset.id); confirmBox(`Delete “${l.title}”?`, 'Students lose it from their lessons, and its results are deleted.', 'Delete lesson', () => { api.deleteLesson(l.id); rerender(); toast('Lesson deleted'); }); },
  'copy-lesson': t => { const l = lessonById(t.dataset.id), others = myClasses().filter(c => c.id !== l.classId);
    if (!others.length) { toast('Make another class first, then copy lessons into it.'); return; }
    openModal(`<form data-form="copy-lesson" class="stack" novalidate><h2>Copy “${esc(l.title)}”</h2><input type="hidden" name="id" value="${l.id}"><div class="field"><span class="lbl">To these classes</span>${others.map(c => `<label class="check"><input type="checkbox" name="cls" value="${c.id}"> ${esc(c.name)}</label>`).join('')}</div><p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Copy lesson</button></div></form>`); },
});

// ---------------------------------------------------------------- one student
route('student', { auth: 'teacher', nav: 'classes', title: q => nameOf(q.get('id')) }, q => {
  const k = userById(q.get('id')), c = k && classById(k.classId);
  if (!k || k.role !== 'student') { go('classes'); return null; }
  if (c && c.teacherId !== state.user.id) { go('classes'); return null; }
  const sib = c ? classStudents(c.id) : [k], i = sib.findIndex(x => x.id === k.id), prevK = sib[i - 1], nextK = sib[i + 1];
  const mine = lessonsForStudent(k), pr = mine.map(l => ({ l, p: progress(k.id, l.id) }));
  const all = DB.attempts.filter(a => a.userId === k.id), cal = activityCalendar(all);
  const R = 7 * DAY, now = Date.now(), cur = studentStats(k.id, now - R), prevS = studentStats(k.id, now - 2 * R, now - R), life = studentStats(k.id);
  const peers = c ? classStudents(c.id) : [], avgOf = f => { const v = peers.map(f).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const classSecs = avgOf(p => studentStats(p.id, now - R).seconds), classTest = avgOf(p => studentStats(p.id).avgTest), classDone = avgOf(p => lessonsForStudent(p).filter(l => progress(p.id, l.id).done).length);
  const done = pr.filter(x => x.p.done).length;
  const cmp = (good, label, val) => `<div class="cmp ${good == null ? '' : good ? 'good' : 'weak'}"><span>Class avg: <b>${val}</b></span><span class="muted">${label}</span></div>`;
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/classes">Classes</a><span>›</span>${c ? `<a href="#/class?id=${c.id}&tab=students">${esc(c.name)}</a><span>›</span>` : ''}<span style="color:var(--ink)">${esc(k.name)}</span></nav>
  <div class="page-title"><div class="row"><span class="avatar" style="width:48px;height:48px;font-size:19px">${esc(initials(k))}</span><h1>${esc(k.name)}</h1></div>
    <div class="row"><button class="btn" type="button" data-act="reset-pw" data-id="${k.id}">${IC.lock} New password</button><button class="btn" type="button" data-act="move-student" data-id="${k.id}">${IC.arrow} Move</button><button class="btn danger" type="button" data-act="remove-student" data-id="${k.id}">Remove</button><button class="btn danger" type="button" data-act="delete-student" data-id="${k.id}">${IC.trash} Delete</button>
    <a class="icon-btn" ${prevK ? `href="#/student?id=${prevK.id}"` : 'aria-disabled="true" style="opacity:.4"'} aria-label="Previous student">${IC.left}</a><a class="icon-btn" ${nextK ? `href="#/student?id=${nextK.id}"` : 'aria-disabled="true" style="opacity:.4"'} aria-label="Next student">${IC.right}</a></div></div>
  <div class="grid" style="grid-template-columns:minmax(0,.8fr) minmax(0,2fr);align-items:start" id="stuTop">
    <div class="card stack" style="gap:12px"><h2 style="font-size:17px">Student details</h2>
      <div><div class="note">Username</div><b class="mono">${esc(k.username)}</b></div>
      <div class="row" style="justify-content:space-between"><span class="note">Joined</span><b>${fmtShort(k.joined)}</b></div>
      <div class="row" style="justify-content:space-between"><span class="note">Last active</span><b>${fmtAgo(k.lastSeen)}</b></div>
      <div class="row" style="justify-content:space-between"><span class="note">Total writing time</span><b>${fmtMin(life.seconds)}</b></div></div>
    <div class="card"><div class="card-head"><h2>Activity tracker · ${esc(cal.title)}</h2>${cal.weeks ? `<span class="streak">${IC.bolt.replace('<svg', '<svg style="width:14px;height:14px"')}${cal.weeks} week streak</span>` : ''}</div>
      <div class="cal-split">${cal.html}<div class="stack" style="gap:10px"><h3 style="font-size:14px">Recent activity</h3>${recentDays(cal.byDay)}<p class="note">Daily goal: 10 minutes</p></div></div>
      <div class="legend" style="margin-top:10px"><span><i style="background:var(--gold)"></i>10 mins or more</span><span><i style="background:color-mix(in srgb,var(--gold) 30%,var(--surface))"></i>Under 10 mins</span><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>No writing</span></div></div>
  </div>
  <div class="sec-head"><div><h2><span class="ico">${IC.chart}</span>${esc(firstName(k))}’s performance</h2><p>Last 7 days compared with the 7 before, and with the class.</p></div></div>
  <div class="kpis">
    ${kpi('Practice time', fmtMin(cur.seconds), 'Prev week', fmtMin(prevS.seconds), delta(cur.seconds, prevS.seconds), cmp(classSecs == null ? null : cur.seconds >= classSecs, 'this week', fmtMin(classSecs)))}
    ${kpi('Average test score', pct(life.avgTest), 'Tests taken', life.tests.length, '', cmp(classTest == null || life.avgTest == null ? null : life.avgTest >= classTest, 'all tests', pct(classTest)))}
    ${kpi('Lessons completed', `${done}<small>/ ${mine.length}</small>`, 'In progress', pr.filter(x => x.p.started && !x.p.done).length, '', cmp(classDone == null ? null : done >= classDone, 'lessons', classDone == null ? '–' : Math.round(classDone * 10) / 10))}
    ${kpi('Backwards strokes', life.reversed, 'In tests', life.tests.length + ' tests', '', '')}
  </div>
  <div class="sec-head"><div><h2><span class="ico">${IC.book}</span>Lesson progress</h2><p>D = demo watched, P = practiced, T = test taken.</p></div></div>
  <div class="table-wrap"><table class="t"><thead><tr><th>Lesson</th><th>Steps</th><th>Demo</th><th>Practice</th><th>Test</th><th>Time</th><th></th></tr></thead><tbody>${pr.slice().reverse().map(({ l, p }) => `<tr><td><b>${esc(l.title)}</b><div class="note">${l.due ? relDue(l.due) : 'No due date'}</div></td><td>${stepsMini(p)}</td><td class="num">${p.demo ? p.demo + '×' : '–'}</td><td>${p.practice ? `<span class="num">${p.practice} run${p.practice > 1 ? 's' : ''}</span><div class="note">best ${pct(p.bestPractice)}</div>` : '–'}</td><td>${p.test ? scorePill(p.test.score) : '–'}</td><td class="num">${fmtMin(p.seconds)}</td><td><div class="acts">${p.practice || p.test ? `<button class="btn sm" type="button" data-act="view-runs" data-u="${k.id}" data-l="${l.id}">${IC.eye} Writing</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No lessons assigned.</td></tr>'}</tbody></table></div>
  <div class="card"><div class="card-head"><h2>Letters to work on</h2><span class="note">Average test score per letter</span></div>${letterGrid(letterReport(all), 16)}</div>`;
}, () => { paintGlyphs(); const top = $('#stuTop'); if (top && innerWidth < 900) top.style.gridTemplateColumns = '1fr'; });
ACT['view-trace'] = async t => {
  const a = DB.attempts.find(x => x.id === t.dataset.id), l = lessonById(a.lessonId), k = userById(a.userId);
  openModal(`<h2>${esc(k.name)} · ${esc(l ? l.title : 'Test')}</h2><p class="muted">Test taken ${fmtDate(a.date)} at ${fmtTime(a.date)} · score <b>${pct(a.score)}</b> · ${a.valid} of ${a.total} strokes on the line${a.reversed ? ` · ${a.reversed} backwards` : ''}</p><div id="traceBox" class="empty">Loading the test…</div>
    ${a.letters ? `<div><h3 style="font-size:15px;margin-bottom:8px">Letters in this test</h3>${letterGrid(a.letters.map(x => ({ ch: x.ch, avg: x.score, n: 1, rev: x.rev })).sort((p, q) => p.avg - q.avg), 30)}</div>` : ''}
    <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-act="close-modal">Close</button></div>`, true);
  paintGlyphs($('#overlay'));
  const img = await api.trace(a), box = $('#traceBox'); if (!box) return;
  box.outerHTML = img ? `<img src="${img}" alt="The student’s test: green strokes were on the line, red strokes were off it">` : `<canvas id="traceCv" class="pv-canvas" style="border:1px solid var(--line)"></canvas><p class="note">Demo data: this is the model text. Real tests show the student’s own ink.</p>`;
  const cv = $('#traceCv'); if (cv && l) paintPreview(cv, l.text, { xh: 24, maxLines: 6 });
};

// ---------------------------------------------------------------- all lessons
route('lessons', { auth: 'teacher', nav: 'lessons', title: 'Lessons' }, () => {
  const cls = myClasses();
  return `<div class="page-title"><div><h1>Lessons</h1><p class="muted">Every lesson you’ve assigned, by class.</p></div><a class="btn primary" href="#/lesson-edit">${IC.plus} New lesson</a></div>
  <div class="card"><div class="card-head"><div><h2>The FloWriter sequence</h2><p class="note">Thirteen lessons on Zaner-Bloser letterforms, in teaching order. Start any of them as a lesson for your class.</p></div></div>
    <div class="preset-units">${CURRICULUM.map(u => `<div class="u"><span>${esc(u.title)}</span>${u.lessons.map(l => `<button class="chip" type="button" data-act="start-preset" data-id="${l.id}">${esc(l.title)}</button>`).join('')}</div>`).join('')}</div></div>
  ${cls.map(c => { const ls = lessonsForClass(c.id); return `<div class="stack" style="gap:10px"><div class="sec-head"><h2 style="font-size:18px">${esc(c.name)}</h2><a class="note" style="font-weight:800" href="#/class?id=${c.id}&tab=lessons">Manage in class →</a></div>
    <div class="table-wrap"><table class="t" style="min-width:560px"><thead><tr><th>Lesson</th><th>Song</th><th>Due</th><th>Completed</th><th></th></tr></thead><tbody>${ls.map(l => { const s = songById(l.songId), cm = lessonCompletion(l); return `<tr><td><b>${esc(l.title)}</b></td><td>${esc(s ? s.title : 'Built-in beat')} <span class="note num">· ${s ? Math.round(s.bpm * l.mult) : 84} BPM</span></td><td>${l.due ? fmtShort(l.due) : '–'}</td><td><div class="minibar"><span class="bar"><i style="width:${cm.pct * 100}%"></i></span><span class="num note">${cm.done}/${cm.total}</span></div></td><td><div class="acts"><a class="btn sm" href="#/preview?id=${l.id}" title="Preview">${IC.eye}</a><a class="btn sm" href="#/lesson-edit?id=${l.id}" title="Edit">${IC.edit}</a></div></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">No lessons in this class yet.</td></tr>'}</tbody></table></div></div>`; }).join('')}`;
});
ACT['start-preset'] = t => { const p = findPreset(t.dataset.id); newDraft({ title: p.lesson.title, text: p.lesson.text, preset: p.lesson.id }); go('lesson-edit'); };

// ---------------------------------------------------------------- lesson editor
const CHECK_TEXT = 'The quick brown fox jumps over the lazy dog.';
function setKind(D, k){ D.kind = k; if (k === 'check') { if (!D.title || CURRICULUM.some(u => u.lessons.some(l => l.title === D.title))) D.title = 'Handwriting check: start'; D.text = CHECK_TEXT; D.preset = null; D.theme = ''; } else if (D.text === CHECK_TEXT) { D.text = 'i t u w it wit tutu'; D.preset = 'zb1'; D.title = ''; D.theme = 'classroom'; } }
function newDraft(over = {}){
  const cls = myClasses();
  state.lessonDraft = { id: null, kind: 'lesson', classIds: cls.length ? [cls[0].id] : [], title: '', text: 'i t u w it wit tutu', preset: 'zb1', songId: 'sg_paper', mult: 1, bps: 1, rest: 1, difficulty: 'standard', theme: 'classroom', due: (() => { const d = new Date(Date.now() + 7 * DAY); d.setHours(15, 0, 0, 0); return d.getTime(); })(), studentIds: null,
    songQ: '', songLevel: 'all', gen: { focus: '', kind: 'words', count: 6, known: '' }, ...over, gen: { focus: '', kind: 'words', count: 6, known: '', ...(over.gen || {}) } };
}
route('lesson-edit', { auth: 'teacher', nav: 'lessons', title: 'Lesson' }, q => {
  const id = q.get('id');
  if (id) { const l = lessonById(id); if (!l) { go('lessons'); return null; } if (!state.lessonDraft || state.lessonDraft.id !== id) state.lessonDraft = { ...l, classIds: [l.classId], songQ: '', songLevel: 'all', gen: { focus: '', kind: 'words', count: 6, known: '' } }; }
  else if (!state.lessonDraft || state.lessonDraft.id) newDraft();
  if (q.get('class') && !id) state.lessonDraft.classIds = [q.get('class')];
  if (q.get('kind') === 'check' && !id && state.lessonDraft.kind !== 'check') setKind(state.lessonDraft, 'check');
  const D = state.lessonDraft, cls = myClasses(), editing = !!D.id;
  const one = D.classIds.length === 1 ? D.classIds[0] : null, kids = one ? classStudents(one) : [];
  const started = editing && DB.attempts.some(a => a.lessonId === D.id), chk = D.kind === 'check';
  return `<nav class="crumbs"><a href="#/lessons">Lessons</a><span>›</span><span style="color:var(--ink)">${editing ? 'Edit lesson' : 'New lesson'}</span></nav>
  <div class="page-title"><h1>${editing ? esc(D.title || 'Lesson') : 'New lesson'}</h1><div class="row"><button class="btn" type="button" data-act="ed-preview">${IC.eye} Preview as a student</button><button class="btn primary" type="button" data-act="ed-save">${editing ? 'Save changes' : 'Assign lesson'}</button></div></div>
  <p class="form-error" id="edErr" role="alert"></p>
  <div class="editor">
    <div class="stack">
      ${editing ? `<p class="pill ${chk ? 'warn' : 'blue'}" style="align-self:flex-start">${chk ? 'Handwriting check: the test only, no music' : 'Lesson: demo, practice with music, then the test'}</p>`
        : `<div class="seg" role="group" aria-label="What kind of assignment" style="align-self:flex-start"><button type="button" data-act="ed-kind" data-k="lesson" aria-pressed="${!chk}">Lesson</button><button type="button" data-act="ed-kind" data-k="check" aria-pressed="${chk}">Handwriting check</button></div>
        ${chk ? '<p class="note">A handwriting check is the test alone: no demo, no music, one try. Give the same one at the start and the end of the pilot.</p>' : ''}`}
      <section class="card stack"><h2 style="font-size:17px">1. What students write</h2>
        <div class="field"><label for="edTitle">Lesson title</label><input class="input" id="edTitle" data-ed="title" value="${esc(D.title)}" placeholder="Undercurve letters" maxlength="80"></div>
        <div class="field"><label for="edText">Text</label><textarea class="input" id="edText" data-ed="text" maxlength="300" spellcheck="false" ${started ? 'readonly' : ''}>${esc(D.text)}</textarea>${started ? `<div class="banner blue" style="padding:10px 14px"><span class="note" style="flex:1;min-width:200px">Students have started this lesson, so the words are locked. Their results are for these words. Song, theme and due date can still change.</span><button class="btn sm" type="button" data-act="ed-copy">${IC.copy} Copy with new words</button></div>` : ''}<small><span id="edCount">${D.text.length}</span>/300 · letters A to Z and . , ! ? ' · the text stays the same size however long it is</small></div>
        <details ${D.preset ? '' : 'open'}><summary style="cursor:pointer;font-weight:800">Start from the FloWriter sequence</summary><div class="preset-units" style="margin-top:10px">${CURRICULUM.map(u => `<div class="u"><span>${esc(u.title)}</span>${u.lessons.map(l => `<button class="chip" type="button" data-act="ed-preset" data-id="${l.id}" aria-pressed="${D.preset === l.id}">${esc(l.title)}</button>`).join('')}</div>`).join('')}</div></details>
        <details><summary style="cursor:pointer;font-weight:800">Generate practice text</summary><div class="stack" style="margin-top:12px;gap:12px">
          <div class="two-col" style="grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label for="genFocus">Letters to practice</label><input class="input mono" id="genFocus" data-gen="focus" value="${esc(D.gen.focus)}" placeholder="e l h k"></div>
          <div class="field"><label for="genKnown">Use only letters through</label><select class="input" id="genKnown" data-gen="known"><option value="">Any letters</option>${CURRICULUM[0].lessons.map(l => `<option value="${ZB_ORDER.slice(0, ZB_ORDER.indexOf(l.focus[l.focus.length - 1]) + 1)}" ${D.gen.known && D.gen.known === ZB_ORDER.slice(0, ZB_ORDER.indexOf(l.focus[l.focus.length - 1]) + 1) ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select></div></div>
          <div class="row"><div class="seg" role="group" aria-label="Kind of text">${[['letters', 'Letter drill'], ['words', 'Words'], ['sentence', 'Sentences']].map(([k, l]) => `<button type="button" data-act="gen-kind" data-k="${k}" aria-pressed="${D.gen.kind === k}">${l}</button>`).join('')}</div>
            <label class="row note" style="font-weight:800" for="genCount">How many <input class="input" id="genCount" data-gen="count" type="number" min="1" max="12" value="${D.gen.count}" style="width:70px"></label>
            <button class="btn" type="button" data-act="gen-go">${IC.sparkle} Generate</button></div></div></details>
      </section>
      ${chk ? `<section class="card stack"><h2 style="font-size:17px">2. Music</h2><p class="note">Handwriting checks have no music, so they measure writing on its own.</p></section>` : ''}
      <section class="card stack" ${chk ? 'hidden' : ''}><h2 style="font-size:17px">2. Music</h2>
        <div class="row"><div class="search" style="flex:1 1 220px"><label class="sr-only" for="songQ">Search songs</label>${IC.search}<input class="input" id="songQ" type="search" data-ed-live="songQ" value="${esc(D.songQ)}" placeholder="Search the song library"></div>
          <div class="seg" role="group" aria-label="Difficulty">${[['all', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([k, l]) => `<button type="button" data-act="song-level" data-k="${k}" aria-pressed="${D.songLevel === k}">${l}</button>`).join('')}</div></div>
        <div class="songs" id="edSongs">${songRows(D)}</div>
        <p class="note">Easy songs are under 80 BPM, medium 80 to 104, hard 105 and up. <a href="#/songs">Add MP3s to the library</a>.</p>
        <div class="field"><span class="lbl" id="multL">Stroke tempo</span><div class="row"><div class="seg" role="group" aria-labelledby="multL">${[.5, .75, 1, 1.5, 2].map(m => `<button type="button" data-act="ed-mult" data-m="${m}" aria-pressed="${D.mult === m}">${m === .5 ? '½' : m === .75 ? '¾' : m === 1.5 ? '1½' : m}×</button>`).join('')}</div>
          <label class="row note" style="font-weight:800" for="edMult">Custom <input class="input" id="edMult" type="number" min="0.05" step="0.05" data-ed="mult" value="${D.mult}" style="width:90px">×</label></div>
          <small id="edTempo"></small></div>
        <div class="field"><span class="lbl" id="bpsL">Beats for each stroke</span><div class="seg" role="group" aria-labelledby="bpsL">${[1, 2].map(n => `<button type="button" data-act="ed-bps" data-n="${n}" aria-pressed="${D.bps === n}">${n} beat${n > 1 ? 's' : ''}</button>`).join('')}</div><small>2 beats a stroke halves the writing speed without changing the song.</small></div>
      </section>
      <section class="card stack"><h2 style="font-size:17px">3. Theme and difficulty</h2>
        <div class="themes">${THEMES.map(t => `<button type="button" class="theme" data-act="ed-theme" data-id="${t.id}" aria-pressed="${D.theme === t.id}"><div class="img ${t.id ? '' : 'plain'}" style="${t.id ? `background-image:url(${themeImg(t.id)})` : ''}"></div><span>${esc(t.label)}</span></button>`).join('')}</div>
        <div class="field"><span class="lbl" id="difL">Margin of error</span><div class="seg" role="group" aria-labelledby="difL">${Object.entries(DIFF).map(([k, v]) => `<button type="button" data-act="ed-diff" data-k="${k}" aria-pressed="${D.difficulty === k}">${v.label}</button>`).join('')}</div><small>How far from the line a stroke can stray and still count. Easy suits 1st and 2nd grade.</small></div>
      </section>
      <section class="card stack"><h2 style="font-size:17px">4. Who and when</h2>
        ${editing ? `<p><b>${esc((classById(D.classIds[0]) || {}).name)}</b></p>` : `<div class="field"><span class="lbl">Assign to</span>${cls.map(c => `<label class="check"><input type="checkbox" data-ed-class value="${c.id}" ${D.classIds.includes(c.id) ? 'checked' : ''}> ${esc(c.name)} <span class="note">· ${classStudents(c.id).length} students</span></label>`).join('') || '<p class="note">Make a class first.</p>'}</div>`}
        ${one ? `<div class="field"><span class="lbl">Students</span><label class="check"><input type="radio" name="edWho" value="all" data-ed-who ${!D.studentIds ? 'checked' : ''}> The whole class</label><label class="check"><input type="radio" name="edWho" value="some" data-ed-who ${D.studentIds ? 'checked' : ''}> Only some students</label>
          <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;${D.studentIds ? '' : 'display:none'}" id="edKids">${kids.map(k => `<label class="check"><input type="checkbox" data-ed-kid value="${k.id}" ${D.studentIds && D.studentIds.includes(k.id) ? 'checked' : ''}> ${esc(k.name)}</label>`).join('')}</div></div>` : ''}
        <div class="field"><label for="edDue">Due date (optional)</label><input class="input" id="edDue" type="datetime-local" data-ed="due" value="${toLocalInput(D.due)}" style="max-width:260px"></div>
      </section>
    </div>
    <aside class="preview card" aria-label="Lesson preview"><h2 style="font-size:17px">What students will see</h2>
      <div class="pv-frame" id="edFrame" style="${D.theme ? `background-image:url(${themeImg(D.theme)})` : ''}"><canvas class="pv-canvas" id="edCanvas"></canvas></div>
      <div class="facts" id="edFacts"></div>
      <div class="note">Students watch the demo, practice with the music, then take one test without music. Each stroke takes one beat${D.bps === 2 ? ' (two in this lesson)' : ''}, with a beat to lift the pen before every dot and cross.</div>
    </aside>
  </div>`;
}, () => { edRefresh(); });
function songRows(D){
  const q = (D.songQ || '').toLowerCase(), list = DB.songs.filter(s => (D.songLevel === 'all' || songLevel(s.bpm) === D.songLevel) && (!q || (s.title + ' ' + (s.artist || '')).toLowerCase().includes(q))).sort((a, b) => a.bpm - b.bpm);
  return list.map(s => `<div class="song" data-act="ed-song" data-id="${s.id}" data-on="${D.songId === s.id}">${songDisc(s)}<button type="button" class="song-pick" data-act="ed-song" data-id="${s.id}" aria-pressed="${D.songId === s.id}"><b>${esc(s.title)}</b><small>${esc(s.artist || '')}${s.kind === 'upload' ? ' · uploaded' : ''}</small></button><span class="num note">${Math.round(s.bpm)} BPM</span>${levelPill(s.bpm)}</div>`).join('') || '<p class="empty">No songs match.</p>';
}
function edRefresh(){
  const D = state.lessonDraft; if (!D) return;
  const cv = $('#edCanvas'); if (cv) paintPreview(cv, D.text, { xh: 22, maxLines: 4 });
  const s = songById(D.songId), bpm = (s ? s.bpm : 84) * D.mult, b = Cursive.beats(cleanText(D.text), D.bps, D.rest), secs = b.beats * 60 / bpm;
  const f = $('#edFacts');
  if (f && D.kind === 'check') { f.innerHTML = `<div class="fact"><div class="k">Strokes</div><div class="v">${b.strokes}</div></div><div class="fact"><div class="k">Music</div><div class="v">None</div></div><div class="fact"><div class="k">Steps</div><div class="v">Test only</div></div><div class="fact"><div class="k">Tries</div><div class="v">One</div></div>`; const fr = $('#edFrame'); if (fr) fr.style.backgroundImage = D.theme ? `url(${themeImg(D.theme)})` : ''; return; }
  if (f) f.innerHTML = `<div class="fact"><div class="k">Strokes</div><div class="v">${b.strokes}</div></div><div class="fact"><div class="k">Stroke tempo</div><div class="v">${Math.round(bpm * 10) / 10} BPM</div></div><div class="fact"><div class="k">One run takes</div><div class="v">${secs < 60 ? Math.round(secs) + ' sec' : Math.floor(secs / 60) + ' min ' + Math.round(secs % 60) + ' s'}</div></div><div class="fact"><div class="k">Song</div><div class="v" style="font-size:14px">${esc(s ? s.title : 'Built-in beat')}</div></div>`;
  const t = $('#edTempo'); if (t) t.textContent = s ? `${s.title} is ${Math.round(s.bpm)} BPM, so strokes land at ${Math.round(bpm * 10) / 10} BPM. Any multiplier works, with no upper limit.` : '';
  const fr = $('#edFrame'); if (fr) fr.style.backgroundImage = D.theme ? `url(${themeImg(D.theme)})` : '';
}
document.addEventListener('input', e => {
  const t = e.target, D = state.lessonDraft; if (!D || parseHash().path !== 'lesson-edit') return;
  if (t.dataset.ed) { const k = t.dataset.ed;
    if (k === 'text') { const c = t.value.replace(/[^A-Za-z.,!?' \n]/g, ''); if (c !== t.value) t.value = c; D.text = c.replace(/\n/g, ' '); D.preset = null; $('#edCount').textContent = D.text.length; $$('[data-act="ed-preset"]').forEach(b => b.setAttribute('aria-pressed', 'false')); }
    else if (k === 'mult') { const v = parseFloat(t.value); if (v > 0) { D.mult = v; $$('[data-act="ed-mult"]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === v))); } }
    else if (k === 'due') D.due = t.value ? new Date(t.value).getTime() : null;
    else D[k] = t.value;
    edRefresh(); }
  if (t.dataset.gen) D.gen[t.dataset.gen] = t.dataset.gen === 'count' ? Math.max(1, Math.min(12, +t.value || 6)) : t.value;
  if (t.dataset.edLive === 'songQ') { D.songQ = t.value; $('#edSongs').innerHTML = songRows(D); }
});
document.addEventListener('change', e => {
  const t = e.target, D = state.lessonDraft; if (!D || parseHash().path !== 'lesson-edit') return;
  if (t.matches('[data-ed-class]')) { D.classIds = $$('[data-ed-class]').filter(x => x.checked).map(x => x.value); D.studentIds = null; rerender(); }
  if (t.matches('[data-ed-who]')) { D.studentIds = t.value === 'some' ? [] : null; $('#edKids').style.display = t.value === 'some' ? '' : 'none'; }
  if (t.matches('[data-ed-kid]')) { D.studentIds = $$('[data-ed-kid]').filter(x => x.checked).map(x => x.value); }
  if (t.dataset.gen === 'known') D.gen.known = t.value;
});
const pressOne = (sel, el) => $$(sel).forEach(b => b.setAttribute('aria-pressed', String(b === el)));
Object.assign(ACT, {
  'ed-preset': t => { const D = state.lessonDraft, p = findPreset(t.dataset.id); D.text = p.lesson.text; D.preset = p.lesson.id; if (!D.title || CURRICULUM.some(u => u.lessons.some(l => l.title === D.title))) D.title = p.lesson.title; $('#edText').value = D.text; $('#edTitle').value = D.title; $('#edCount').textContent = D.text.length; pressOne('[data-act="ed-preset"]', t); edRefresh(); },
  'gen-kind': t => { state.lessonDraft.gen.kind = t.dataset.k; pressOne('[data-act="gen-kind"]', t); },
  'gen-go': () => { const D = state.lessonDraft, g = D.gen; const out = generateText({ focus: g.focus, known: g.known, kind: g.kind, count: g.count });
    if (!out) { toast(g.kind === 'letters' ? 'Type the letters to practice first.' : 'No words fit those letters. Try more letters.'); return; }
    D.text = cleanText(out); D.preset = null; $('#edText').value = D.text; $('#edCount').textContent = D.text.length; if (!D.title) { D.title = g.focus ? 'Practice: ' + g.focus.replace(/[^A-Za-z]/g, '').split('').join(' ') : 'Practice words'; $('#edTitle').value = D.title; } edRefresh(); },
  'song-level': t => { const D = state.lessonDraft; D.songLevel = t.dataset.k; pressOne('[data-act="song-level"]', t); $('#edSongs').innerHTML = songRows(D); },
  'ed-song': (t, e) => { if (e.target.closest('.disc')) return; const id = t.dataset.id; state.lessonDraft.songId = id; $$('#edSongs .song').forEach(r => r.dataset.on = String(r.dataset.id === id)); $$('#edSongs .song-pick').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id))); edRefresh(); },
  'ed-mult': t => { const D = state.lessonDraft; D.mult = +t.dataset.m; $('#edMult').value = D.mult; pressOne('[data-act="ed-mult"]', t); edRefresh(); },
  'ed-bps': t => { state.lessonDraft.bps = +t.dataset.n; pressOne('[data-act="ed-bps"]', t); edRefresh(); },
  'ed-theme': t => { state.lessonDraft.theme = t.dataset.id; pressOne('[data-act="ed-theme"]', t); edRefresh(); },
  'ed-diff': t => { state.lessonDraft.difficulty = t.dataset.k; pressOne('[data-act="ed-diff"]', t); },
  'ed-kind': t => { setKind(state.lessonDraft, t.dataset.k); rerender(); },
  'ed-copy': () => { const D = state.lessonDraft; D.id = null; D.title = D.title + ' (new words)'; D.studentIds = null; go('lesson-edit'); toast('This is a new copy. Change the words, then assign it.'); },
  'ed-preview': () => { const D = state.lessonDraft, err = edCheck(D, true); if (err) { $('#edErr').textContent = err; return; } state.launch = { lesson: { ...D, id: 'draft', classId: D.classIds[0], text: cleanText(D.text) }, back: 'lesson-edit' + (D.id ? '?id=' + D.id : '') }; go('preview?id=draft'); },
  'ed-save': () => { const D = state.lessonDraft, err = edCheck(D); if (err) { $('#edErr').textContent = err; window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const base = { kind: D.kind || 'lesson', title: D.title.trim(), preset: D.preset || null, text: cleanText(D.text), songId: D.kind === 'check' ? null : D.songId, mult: D.mult, bps: D.bps, rest: D.rest, difficulty: D.difficulty, theme: D.theme, due: D.due || null };
    if (D.id) { api.saveLesson({ ...base, id: D.id, studentIds: D.studentIds && D.studentIds.length ? D.studentIds : null }); toast('Lesson saved'); }
    else { D.classIds.forEach(cid => api.saveLesson({ ...base, classId: cid, studentIds: D.classIds.length === 1 && D.studentIds && D.studentIds.length ? D.studentIds : null })); toast(`Assigned “${esc(base.title)}” to ${D.classIds.length > 1 ? D.classIds.length + ' classes' : esc(classById(D.classIds[0]).name)}`); }
    const cid = D.classIds[0]; state.lessonDraft = null; go('class?id=' + cid + '&tab=lessons'); },
});
function edCheck(D, preview){
  if (!preview && !D.title.trim()) return 'Give the lesson a title.';
  if (!cleanText(D.text)) return 'Add the text students will write.';
  if (!preview && !D.classIds.length) return 'Pick at least one class to assign it to.';
  if (!preview && D.studentIds && !D.studentIds.length) return 'Pick at least one student, or assign it to the whole class.';
  if (!(D.mult > 0)) return 'The tempo multiplier has to be more than 0.';
  return '';
}

// ---------------------------------------------------------------- preview a lesson as a student
route('preview', { auth: 'teacher', nav: 'lessons', title: 'Preview' }, q => {
  const id = q.get('id'), l = id === 'draft' ? state.launch && state.launch.lesson : lessonById(id);
  if (!l) { go('lessons'); return null; }
  return lessonPage(l, { preview: true, back: id === 'draft' ? state.launch.back : 'class?id=' + l.classId + '&tab=lessons' });
}, () => lessonAfter({ preview: true }));

// ---------------------------------------------------------------- song library
route('songs', { auth: 'teacher', nav: 'songs', title: 'Song library' }, () => {
  const T = state.teach; T.songQ = T.songQ || ''; T.songLevel = T.songLevel || 'all';
  const q = T.songQ.toLowerCase(), list = DB.songs.filter(s => (T.songLevel === 'all' || songLevel(s.bpm) === T.songLevel) && (!q || (s.title + ' ' + (s.artist || '')).toLowerCase().includes(q))).sort((a, b) => a.bpm - b.bpm);
  return `<div class="page-title"><div><h1>Song library</h1><p class="muted">Every teacher in the pilot shares this library. Upload MP3s and FloWriter finds the tempo.</p></div>
    <label class="btn primary" for="songFile">${IC.upload} Upload MP3</label><input id="songFile" class="sr-only" type="file" accept=".mp3,audio/mpeg" data-change="song-upload"></div>
  <div class="row"><div class="search" style="flex:1 1 260px"><label class="sr-only" for="libQ">Search songs</label>${IC.search}<input class="input" id="libQ" type="search" value="${esc(T.songQ)}" placeholder="Search by title or artist"></div>
    <div class="seg" role="group" aria-label="Difficulty">${[['all', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([k, l]) => `<button type="button" data-act="lib-level" data-k="${k}" aria-pressed="${T.songLevel === k}">${l}</button>`).join('')}</div></div>
  <div class="table-wrap"><table class="t"><thead><tr><th></th><th>Song</th><th>Tempo</th><th>Difficulty</th><th>Length</th><th>Added by</th><th></th></tr></thead><tbody id="libRows">${list.map(s => { const own = s.ownerId === state.user.id;
    return `<tr><td style="width:50px">${songDisc(s)}</td><td><b>${esc(s.title)}</b><div class="note">${esc(s.artist || '')}</div></td><td class="num">${Math.round(s.bpm * 10) / 10} BPM ${own ? `<span class="row" style="gap:4px;display:inline-flex;margin-left:6px"><button class="btn sm" type="button" data-act="song-bpm" data-id="${s.id}" data-f=".5" title="Half tempo">½×</button><button class="btn sm" type="button" data-act="song-bpm" data-id="${s.id}" data-f="2" title="Double tempo">2×</button></span>` : ''}</td>
      <td>${levelPill(s.bpm)}</td><td class="num">${s.duration ? Math.floor(s.duration / 60) + ':' + String(Math.round(s.duration % 60)).padStart(2, '0') : s.kind === 'starter' ? 'loops' : '–'}</td><td>${s.kind === 'starter' ? 'FloWriter' : own ? 'You' : 'Another teacher'}</td>
      <td><div class="acts">${own ? `<button class="btn sm danger" type="button" data-act="song-delete" data-id="${s.id}" title="Delete">${IC.trash}</button>` : ''}</div></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">No songs match.</td></tr>'}</tbody></table></div>
  <p class="note">Tip: if a song feels twice as fast or slow as it should, use ½× or 2× to fix the detected tempo. Lessons can still play any song faster or slower with the stroke tempo setting.${api.demo ? ' In this demo build, uploaded songs last until the page reloads.' : ''}</p>`;
});
document.addEventListener('input', e => { if (e.target.id === 'libQ') { state.teach.songQ = e.target.value; clearTimeout(window._libT); window._libT = setTimeout(() => { rerender(); const i = $('#libQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });
Object.assign(ACT, {
  'lib-level': t => { state.teach.songLevel = t.dataset.k; rerender(); },
  'song-bpm': t => { const s = songById(t.dataset.id); api.updateSong(s.id, { bpm: Math.round(s.bpm * +t.dataset.f * 100) / 100 }); rerender(); },
  'song-delete': t => { const s = songById(t.dataset.id), used = DB.lessons.filter(l => l.songId === s.id).length; confirmBox(`Delete “${s.title}”?`, used ? `${used} lesson${used > 1 ? 's use' : ' uses'} it. Those lessons switch to the built-in beat.` : 'It is removed from the library for every teacher.', 'Delete song', () => { api.deleteSong(s.id); rerender(); toast('Song deleted'); }); },
});
let pendingSong = null;
CHANGE['song-upload'] = async t => {
  const file = t.files[0]; t.value = ''; if (!file) return;
  if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') { toast(`“${esc(file.name)}” isn’t an MP3. Only MP3 files can be added.`); return; }
  openModal(`<h2>Listening for the beat…</h2><p class="muted">${esc(file.name)}</p>`);
  let r; try { r = await Music.detectBpm(file); } catch (e) { closeModal(); toast('That file couldn’t be read as audio.'); return; }
  pendingSong = { file, duration: r.duration || null };
  const title = file.name.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').replace(/\s*\d{2,3}\s*bpm/i, '').trim().slice(0, 60);
  openModal(`<form data-form="song-add" class="stack" novalidate><h2>Add to the library</h2>
    <div class="field"><label for="sgTitle">Title</label><input class="input" id="sgTitle" name="title" value="${esc(title)}" required></div>
    <div class="field"><label for="sgArtist">Artist</label><input class="input" id="sgArtist" name="artist"></div>
    <div class="field"><label for="sgBpm">Tempo (BPM)</label><div class="row" style="flex-wrap:nowrap"><input class="input num" id="sgBpm" name="bpm" type="number" step="0.1" min="1" value="${Math.round(r.bpm * 10) / 10}" style="max-width:130px"><button class="btn sm" type="button" data-act="sg-scale" data-f=".5">½×</button><button class="btn sm" type="button" data-act="sg-scale" data-f="2">2×</button><button class="btn sm" type="button" data-act="sg-tap" id="sgTap">Tap along</button></div>
      <small>${r.from === 'name' ? 'Read from the file name.' : 'Detected from the audio.'} If it sounds twice as fast or slow, use ½× or 2×, or tap along with the beat.</small></div>
    <p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Add song</button></div></form>`);
};
let taps = [];
Object.assign(ACT, {
  'sg-scale': t => { const i = $('#sgBpm'); i.value = Math.round(+i.value * +t.dataset.f * 10) / 10; },
  'sg-tap': () => { const n = performance.now(); taps = taps.filter(x => n - x < 3000); taps.push(n); if (taps.length >= 4) { const gaps = taps.slice(1).map((x, i) => x - taps[i]), avg = gaps.reduce((a, b) => a + b, 0) / gaps.length; $('#sgBpm').value = Math.round(60000 / avg * 10) / 10; } $('#sgTap').textContent = taps.length < 4 ? `Tap ${4 - taps.length} more` : 'Keep tapping'; },
});

// ---------------------------------------------------------------- teacher forms
const FORMS = {
  'new-class': async f => { const n = f.name.value.trim(); if (!n) throw new Error('Name the class.'); const c = api.addClass(state.user, n); closeModal(); go('class?id=' + c.id); setTimeout(() => toast(`Created ${esc(c.name)} · join code <span class="mono">${c.code}</span>`, 5000), 60); },
  'class-settings': async f => { const id = f.id.value, n = f.name.value.trim(); if (!n) throw new Error('Name the class.'); api.renameClass(id, n); if (f.sequential.checked !== !!classById(id).sequential) api.setSequential(id, f.sequential.checked); const arch = f.archived.checked; if (arch !== !!classById(id).archived) api.archiveClass(id, arch); closeModal(); if (arch) go('classes'); else rerender(); toast('Class saved'); },
  'class-message': async f => { const c = classById(f.id.value); c.message = f.message.value.trim(); api.saveClassMessage ? api.saveClassMessage(c.id, c.message) : saveDB(); closeModal(); rerender(); toast('Message saved'); },
  'copy-lesson': async f => { const l = lessonById(f.id.value), ids = [...f.querySelectorAll('input[name="cls"]:checked')].map(x => x.value); if (!ids.length) throw new Error('Pick a class.'); ids.forEach(cid => { const { id, created, classId, studentIds, ...rest } = l; api.saveLesson({ ...rest, classId: cid, studentIds: null }); }); closeModal(); toast(`Copied to ${ids.length} class${ids.length > 1 ? 'es' : ''}`); },
  'song-add': async f => { const bpm = parseFloat(f.bpm.value); if (!(bpm > 0)) throw new Error('Enter the tempo in BPM.'); if (!f.title.value.trim()) throw new Error('Give the song a title.');
    const s = await api.addSong({ title: f.title.value.trim(), artist: f.artist.value.trim(), bpm, offset: null, duration: pendingSong.duration, ownerId: state.user.id, hue: Math.floor(Math.random() * 360) }, pendingSong.file);
    pendingSong = null; closeModal(); rerender(); toast(`Added “${esc(s.title)}” · ${Math.round(s.bpm)} BPM`); },
};

// ---------------------------------------------------------------- students: add, cards, move, delete, runs
Object.assign(ACT, {
  'add-students': t => openModal(`<form data-form="add-students" class="stack" novalidate><h2>Add students to ${esc(classById(t.dataset.id).name)}</h2><input type="hidden" name="id" value="${t.dataset.id}">
    <div class="field"><label for="asNames">One student per line: first name and last initial</label><textarea class="input" id="asNames" name="names" placeholder="Maya A.&#10;Leo B.&#10;Ava C." style="min-height:180px"></textarea><small>FloWriter makes a username and a simple password for each student, then shows login cards to print.</small></div>
    <p class="note" id="asProg"></p><p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Add students and make cards</button></div></form>`),
  'login-cards': t => { const c = classById(t.dataset.id), kids = classStudents(c.id); if (!kids.length) { toast('Add students first.'); return; }
    openModal(`<form data-form="login-cards" class="stack" novalidate><h2>Login cards for ${esc(c.name)}</h2><input type="hidden" name="id" value="${c.id}">
      <p class="muted">Each card has the student’s username, a password, and a QR code they scan with the tablet camera to sign in. Making cards gives the chosen students <b>new passwords</b>; their old ones stop working.</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;max-height:300px;overflow:auto">${kids.map(k => `<label class="check"><input type="checkbox" name="kid" value="${k.id}" checked> ${esc(k.name)}</label>`).join('')}</div>
      <p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Make new passwords and cards</button></div></form>`); },
  'export-class': t => { const c = classById(t.dataset.id); exportCSV(`${c.name.replace(/[^A-Za-z0-9]+/g, '-')}-results.csv`, resultRows(classStudents(c.id))); },
  'move-student': t => { const k = userById(t.dataset.id), others = myClasses().filter(c => c.id !== k.classId);
    if (!others.length) { toast('You have no other class to move them to.'); return; }
    openModal(`<form data-form="move-student" class="stack" novalidate><h2>Move ${esc(k.name)}</h2><input type="hidden" name="id" value="${k.id}"><div class="field"><label for="mvCls">To class</label><select class="input" id="mvCls" name="cls">${others.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><small>They keep their login. Their past work stays with them.</small></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Move student</button></div></form>`); },
  'delete-student': t => { const k = userById(t.dataset.id);
    openModal(`<form data-form="delete-student" class="stack" novalidate><h2>Delete ${esc(k.name)}’s account?</h2><input type="hidden" name="id" value="${k.id}"><p class="muted">This permanently deletes the student’s login and every lesson, score and writing sample they have. Use it when a family asks for their child’s data to be deleted. It can’t be undone.</p>
      <div class="field"><label for="delName">Type <b>${esc(k.username)}</b> to confirm</label><input class="input mono" id="delName" name="confirm" autocomplete="off"></div><p class="form-error" role="alert"></p>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn danger" type="submit">Delete permanently</button></div></form>`); },
  'view-runs': async t => {
    const k = userById(t.dataset.u), l = lessonById(t.dataset.l), runs = DB.attempts.filter(a => a.userId === k.id && a.lessonId === l.id && a.mode !== 'demo').sort((a, b) => b.date - a.date);
    openModal(`<h2>${esc(k.name)} · ${esc(l.title)}</h2><p class="muted">Every practice run and the test, newest first. Green strokes were on the line, red ones were off it.</p>
      <div class="stack" style="gap:14px">${runs.map(a => `<div><div class="row" style="justify-content:space-between"><b>${a.mode === 'test' ? (isCheck(l) ? 'Handwriting check' : 'Test') : 'Practice'} · ${fmtDate(a.date)}, ${fmtTime(a.date)}</b><span class="row" style="gap:6px">${scorePill(a.score)}${a.reversed ? `<span class="pill warn">${a.reversed} backwards</span>` : ''}</span></div><div data-trace="${a.id}" class="note" style="margin-top:6px">Loading…</div></div>`).join('')}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-act="close-modal">Close</button></div>`, true);
    for (const a of runs){ const img = await api.trace(a), box = $(`[data-trace="${a.id}"]`); if (!box) return; box.outerHTML = img ? `<img src="${img}" alt="${esc(k.name)}’s ${a.mode} writing">` : '<p class="note">No picture saved for this run (sample data, or saved before pictures were kept).</p>'; }
  },
});
Object.assign(FORMS, {
  'add-students': async f => {
    const cid = f.id.value, names = f.names.value.split('\n').map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 60);
    if (!names.length) throw new Error('Type at least one name.');
    const clean = names.map(n => { const [a, ...r] = n.split(' '); const first = a.replace(/[^A-Za-z'-]/g, ''), last = (r.join('').replace(/[^A-Za-z]/g, '')[0] || ''); if (!first) throw new Error(`“${n}” needs a first name.`); return first[0].toUpperCase() + first.slice(1) + (last ? ' ' + last.toUpperCase() + '.' : ''); });
    f.querySelector('button[type="submit"]').disabled = true;
    const made = await api.createStudents(cid, clean, n => { const pEl = $('#asProg'); if (pEl) pEl.textContent = `Making accounts: ${n} of ${clean.length}…`; });
    state.cards = { cls: classById(cid).name, list: made }; closeModal(); go('cards');
  },
  'login-cards': async f => { const ids = [...f.querySelectorAll('input[name="kid"]:checked')].map(x => x.value); if (!ids.length) throw new Error('Pick at least one student.');
    f.querySelector('button[type="submit"]').disabled = true; const made = await api.newPasswords(ids); state.cards = { cls: classById(f.id.value).name, list: made }; closeModal(); go('cards'); },
  'move-student': async f => { api.moveStudent(f.id.value, f.cls.value); closeModal(); go('class?id=' + f.cls.value + '&tab=students'); toast('Student moved'); },
  'delete-student': async f => { const k = userById(f.id.value); if (f.confirm.value.trim().toLowerCase() !== k.username.toLowerCase()) throw new Error('Type the username exactly to confirm.'); const cid = k.classId; await api.deleteStudent(k.id); closeModal(); go('class?id=' + cid + '&tab=students'); toast('Student and all their work deleted'); },
  feedback: async f => { if (!f.body.value.trim() && !f.rating.value) throw new Error('Pick a number or write a note.'); await api.sendFeedback({ rating: +f.rating.value || null, body: f.body.value.trim(), page: parseHash().path }); closeModal(); toast('Thanks. The FloWriter team reads every note.'); },
  account: async f => { const n = f.name.value.trim(); if (!n) throw new Error('Enter your name.'); api.updateProfile({ name: n, school: f.school.value.trim() }); rerender(); toast('Saved'); },
  'change-password': async f => { const pw = f.password.value; if (!RULES.teacherPassword(pw)) throw new Error('Passwords need at least 8 characters and no spaces.'); await api.updatePassword(pw); f.reset(); toast('Password changed'); },
});

// ---------------------------------------------------------------- login cards (print)
route('cards', { auth: 'teacher', nav: 'classes', title: 'Login cards' }, () => {
  const C = state.cards; if (!C || !C.list.length) return `<div class="card stack"><h1 style="font-size:24px">No cards to print</h1><p class="muted">Open a class, then choose Add students or Login cards.</p><a class="btn" href="#/classes">Classes</a></div>`;
  const base = location.href.split('#')[0];
  const qr = text => { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { return ''; } };
  return `<div class="page-title no-print"><div><h1>Login cards · ${esc(C.cls)}</h1><p class="muted">Print these now and cut them apart. The passwords aren’t shown again; to replace a lost card, make a new one.</p></div><div class="row"><button class="btn primary" type="button" data-act="print">Print cards</button><a class="btn" href="#/classes">Done</a></div></div>
  <div class="cards">${C.list.map(({ user, password }) => `<div class="lcard"><div><div class="cls">${esc(C.cls)}</div><h3>${esc(user.name)}</h3><dl><dt>Username</dt><dd>${esc(user.username)}</dd><dt>Password</dt><dd>${esc(password)}</dd></dl></div>
    <div class="qr" aria-label="QR code that signs ${esc(user.name)} in">${qr(`${base}#/card?u=${encodeURIComponent(user.username)}&k=${encodeCard(password)}`)}</div><div class="scan">Scan with the tablet camera, or go to FloWriter and type your username and password.</div></div>`).join('')}</div>`;
});
ACT.print = () => { try { window.print(); } catch (e) { toast('Use your browser’s Print command.'); } };

// ---------------------------------------------------------------- my account
route('account', { auth: 'teacher', nav: 'account', title: 'My account' }, () => {
  const u = state.user;
  return `<div class="page-title"><h1>My account</h1></div>
  <div class="two-col" style="grid-template-columns:repeat(2,minmax(0,1fr))">
    <form class="card stack" data-form="account" novalidate><h2 style="font-size:17px">Profile</h2>
      <div class="field"><label for="acName">Name, as students say it</label><input class="input" id="acName" name="name" value="${esc(u.name)}"></div>
      <div class="field"><label for="acSchool">School</label><input class="input" id="acSchool" name="school" value="${esc(u.school || '')}"></div>
      ${u.email ? `<p class="note">Email: <span class="mono">${esc(u.email)}</span></p>` : ''}<p class="form-error" role="alert"></p><button class="btn primary" type="submit" style="align-self:flex-start">Save</button></form>
    <form class="card stack" data-form="change-password" novalidate><h2 style="font-size:17px">Password</h2>
      <div class="field"><label for="acPw">New password</label><input class="input" id="acPw" name="password" type="password" autocomplete="new-password"><small>At least 8 characters, no spaces.</small></div>
      <p class="form-error" role="alert"></p><button class="btn primary" type="submit" style="align-self:flex-start">Change password</button></form>
  </div>
  <div class="card stack"><h2 style="font-size:17px">Feedback</h2><p class="muted">Tell the FloWriter team what’s working and what isn’t. We read every note during the pilot.</p><button class="btn" type="button" data-act="feedback" style="align-self:flex-start">${IC.flag} Send feedback</button></div>`;
});

// ---------------------------------------------------------------- pilot admin (FloWriter team)
route('admin', { auth: 'teacher', nav: 'admin', title: 'Pilot admin' }, () => {
  if (!state.user.admin) { go('dashboard'); return null; }
  const now = Date.now(), wk = now - 7 * DAY;
  const teachers = DB.users.filter(u => u.role === 'teacher'), classes = DB.classes.filter(c => !c.archived), kids = DB.users.filter(u => u.role === 'student' && classes.some(c => c.id === u.classId));
  const lessonTests = DB.attempts.filter(a => a.mode === 'test' && !isCheck(lessonById(a.lessonId)));
  const avgTest = lessonTests.length ? lessonTests.reduce((s, a) => s + a.score, 0) / lessonTests.length : null;
  const wkSecs = DB.attempts.filter(a => a.date >= wk).reduce((s, a) => s + (a.seconds || 0), 0), activeWk = new Set(DB.attempts.filter(a => a.date >= wk).map(a => a.userId)).size;
  const checkPairs = kids.map(k => { const t = DB.attempts.filter(a => a.userId === k.id && a.mode === 'test' && isCheck(lessonById(a.lessonId))).sort((a, b) => a.date - b.date); return t.length > 1 ? [t[0].score, t[t.length - 1].score] : null; }).filter(Boolean);
  const first = checkPairs.length ? checkPairs.reduce((s, p) => s + p[0], 0) / checkPairs.length : null, last = checkPairs.length ? checkPairs.reduce((s, p) => s + p[1], 0) / checkPairs.length : null;
  const schools = new Set(classes.map(c => c.school || '–'));
  const rowsFor = c => { const ks = classStudents(c.id), ls = lessonsForClass(c.id).filter(l => !isCheck(l)), at = DB.attempts.filter(a => ks.some(k => k.id === a.userId)), t = userById(c.teacherId) || {};
    const comp = ls.map(lessonCompletion), done = comp.reduce((s, x) => s + x.done, 0), tot = comp.reduce((s, x) => s + x.total, 0), tests = at.filter(a => a.mode === 'test' && !isCheck(lessonById(a.lessonId)));
    const cp = ks.map(k => { const tt = at.filter(a => a.userId === k.id && a.mode === 'test' && isCheck(lessonById(a.lessonId))).sort((a, b) => a.date - b.date); return tt.length > 1 ? tt[tt.length - 1].score - tt[0].score : null; }).filter(x => x != null);
    return { c, t, n: ks.length, active: new Set(at.filter(a => a.date >= wk).map(a => a.userId)).size, lessons: ls.length, comp: tot ? done / tot : null, avg: tests.length ? tests.reduce((s, a) => s + a.score, 0) / tests.length : null, mins: ks.length ? at.filter(a => a.date >= wk).reduce((s, a) => s + (a.seconds || 0), 0) / 60 / ks.length / 7 : 0, change: cp.length ? cp.reduce((a, b) => a + b, 0) / cp.length : null, cpN: cp.length }; };
  const rows = classes.map(rowsFor).sort((a, b) => (a.c.school || '').localeCompare(b.c.school || '') || a.c.name.localeCompare(b.c.name));
  const fb = (DB.feedback || []).slice().sort((a, b) => b.date - a.date);
  return `<div class="page-title"><div><p class="eyebrow">FloWriter team only</p><h1>Pilot admin</h1><p class="muted">Every school, class and result in the pilot.</p></div><div class="row"><button class="btn" type="button" data-act="admin-export">${IC.download} Export all results</button><button class="btn" type="button" data-act="refresh">${IC.refresh} Refresh</button></div></div>
  <div class="kpis">${kpi('Schools · teachers', `${schools.size}<small>· ${teachers.length}</small>`)}${kpi('Students writing this week', `${activeWk}<small>/ ${kids.length}</small>`)}${kpi('Practice per student per day', `${kids.length ? Math.round(wkSecs / 60 / kids.length / 7 * 10) / 10 : 0}<small>min</small>`, 'Goal', '10 min')}${kpi('Lesson test average', pct(avgTest), 'Tests taken', lessonTests.length)}</div>
  <div class="card"><div class="card-head"><div><h2>Handwriting checks: first vs latest</h2><p class="note">Students who have taken at least two checks. Checks have no music, so this is the pilot’s main measure.</p></div></div>
    ${checkPairs.length ? `<div class="row" style="gap:28px;align-items:baseline"><div><div class="note">First check</div><div style="font-size:34px;font-weight:900">${pct(first)}</div></div><div style="font-size:26px;color:var(--faint)">→</div><div><div class="note">Latest check</div><div style="font-size:34px;font-weight:900">${pct(last)}</div></div><div>${delta(last, first, { unit: '%' })} <span class="note">relative · ${checkPairs.length} students</span></div></div>` : '<p class="note">No student has taken two checks yet. Give every class a check at the start of the pilot and the same one at the end.</p>'}</div>
  <div class="table-wrap"><table class="t" style="min-width:1080px"><thead><tr><th>School</th><th>Teacher</th><th>Class</th><th>Students</th><th>Active this week</th><th>Lessons</th><th>Completed</th><th>Test avg</th><th>Min/day</th><th>Check change</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.c.school || '–')}</td><td>${esc(r.t.name || '–')}</td><td><b>${esc(r.c.name)}</b></td><td class="num">${r.n}</td><td class="num">${r.active}</td><td class="num">${r.lessons}</td><td><div class="minibar"><span class="bar"><i style="width:${(r.comp || 0) * 100}%"></i></span><span class="num note">${pct(r.comp)}</span></div></td><td>${scorePill(r.avg)}</td><td class="num">${Math.round(r.mins * 10) / 10}</td><td class="num">${r.change == null ? '–' : `${r.change >= 0 ? '+' : ''}${Math.round(r.change * 100)} pts <span class="note">(${r.cpN})</span>`}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">No classes yet.</td></tr>'}</tbody></table></div>
  <div class="card"><div class="card-head"><h2>Teacher feedback</h2>${fb.length ? `<button class="btn sm" type="button" data-act="admin-feedback">${IC.download} Export</button>` : ''}</div>
    ${fb.length ? `<div class="stack" style="gap:12px">${fb.map(x => `<div style="border-bottom:1px solid var(--line);padding-bottom:10px"><div class="row" style="justify-content:space-between"><b>${esc((userById(x.userId) || {}).name || 'A teacher')}</b><span class="row" style="gap:8px">${x.rating ? `<span class="pill ${x.rating >= 4 ? 'ok' : x.rating <= 2 ? 'bad' : 'blue'}">${x.rating}/5</span>` : ''}<span class="note">${fmtDate(x.date)}</span></span></div>${x.body ? `<p style="margin-top:4px">${esc(x.body)}</p>` : ''}</div>`).join('')}</div>` : '<p class="note">No feedback yet. Teachers send it from the Feedback button at the top of every page.</p>'}</div>`;
});
Object.assign(ACT, {
  'admin-export': () => exportCSV('flowriter-pilot-results.csv', resultRows(DB.users.filter(u => u.role === 'student' && u.classId))),
  'admin-feedback': () => exportCSV('flowriter-feedback.csv', [['Date', 'Teacher', 'Rating', 'Feedback', 'Page'], ...(DB.feedback || []).map(x => [new Date(x.date).toISOString().slice(0, 10), (userById(x.userId) || {}).name || '', x.rating || '', x.body || '', x.page || ''])]),
});
