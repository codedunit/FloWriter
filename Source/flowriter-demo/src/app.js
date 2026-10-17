// =====================================================================
// FloWriter shell: routing, pages, and the bridge to the two engines
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = v => Math.round(v * 100) + '%';
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtShort = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTime = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDur = s => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };
const initials = u => (u.name || u.username).replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() || '?';
const DIFF = { easy: { label: 'Easy', tol: 26, bps: 2 }, standard: { label: 'Standard', tol: 18, bps: 1 }, challenge: { label: 'Challenge', tol: 12, bps: 1 } };
const cleanText = raw => (raw || '').replace(/\s+/g, ' ').replace(/[^A-Za-z.,!?' ]/g, '').replace(/ {2,}/g, ' ').trim().slice(0, 300);
function relDue(due){
  const d = due - Date.now(), days = Math.round(d / DAY);
  if (d < 0) { const ago = Math.max(1, Math.round(-d / DAY)); return `Closed ${ago} day${ago > 1 ? 's' : ''} ago`; }
  if (d < DAY && new Date(due).getDate() === new Date().getDate()) return `Due today, ${fmtTime(due)}`;
  if (d < 2 * DAY) return `Due tomorrow, ${fmtTime(due)}`;
  return `Due in ${days} days`;
}
const toLocalInput = ms => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// ---------- icons ----------
const I = (p, v = 20) => `<svg viewBox="0 0 ${v} ${v}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = {
  home: I('<path d="M3 9.5 10 3.5l7 6V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z"/>'),
  book: I('<path d="M3 4.5c2.5-1 5-1 7 .5v11.5c-2-1.5-4.5-1.5-7-.5zM17 4.5c-2.5-1-5-1-7 .5v11.5c2-1.5 4.5-1.5 7-.5z"/>'),
  music: I('<path d="M7.5 15V5l9-2v10"/><circle cx="5.5" cy="15" r="2"/><circle cx="14.5" cy="13" r="2"/>'),
  chart: I('<path d="M3 17h14M5.5 14V9M10 14V5M14.5 14v-3"/>'),
  users: I('<circle cx="7.5" cy="7" r="3"/><path d="M2 17c.5-3 2.7-4.5 5.5-4.5S12.5 14 13 17M13 4.2a3 3 0 0 1 0 5.6M15 12.8c1.6.6 2.6 2 3 4.2"/>'),
  lock: I('<rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>'),
  check: I('<path d="M4.5 10.5 8 14l7.5-8"/>'),
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="11.5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
  arrow: I('<path d="M4 10h12M11 5l5 5-5 5"/>'),
  back: I('<path d="M16 10H4M9 5l-5 5 5 5"/>'),
  sun: I('<circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M4.2 15.8l1.6-1.6M14.2 5.8l1.6-1.6"/>'),
  moon: I('<path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z"/>'),
  out: I('<path d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8M13 14l4-4-4-4M17 10H8"/>'),
  upload: I('<path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 16.5h13"/>'),
  shuffle: I('<path d="M3 6h3c4 0 4 8 8 8h3M14.5 11.5 17 14l-2.5 2.5M3 14h3c1.4 0 2.3-1 3-2.2M11 8.2C11.7 7 12.6 6 14 6h3M14.5 3.5 17 6l-2.5 2.5"/>'),
  plus: I('<path d="M10 4v12M4 10h12"/>'),
  copy: I('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>'),
  refresh: I('<path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3v4h-4"/>'),
  trash: I('<path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6"/>'),
  clock: I('<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>'),
  edit: I('<path d="M13.5 3.5l3 3L7 16H4v-3z"/>'),
  x: I('<path d="M5 5l10 10M15 5 5 15"/>'),
  pen: I('<path d="M13.5 3.5l3 3L7 16H4v-3zM11.5 5.5l3 3"/>'),
  eye: I('<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>'),
  archive: I('<rect x="3" y="4" width="14" height="4" rx="1"/><path d="M4.5 8v7.5h11V8M8 11.5h4"/>'),
  star: I('<path d="M10 2.8l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 8l5-.6z"/>'),
};

// ---------- state ----------
const state = { user: null, launch: null, teach: { classId: null, tab: 'students' }, stats: { range: '6m', board: 'bpm', scope: null }, play: { songId: 'sg_sunny', textMode: 'random', text: null, own: '', bps: 1 }, cover: null };
function storage(kind){ try { return kind === 'local' ? localStorage : sessionStorage; } catch (e) { return null; } }
function restoreSession(){
  for (const k of ['local', 'session']) { try { const id = storage(k)?.getItem('flowriter-session'); const u = id && DB.users.find(u => u.id === id); if (u) { state.user = u; return; } } catch (e) {} }
}
function setSession(u, remember){
  state.user = u;
  try { storage('local')?.removeItem('flowriter-session'); storage('session')?.removeItem('flowriter-session'); if (u) storage(remember ? 'local' : 'session')?.setItem('flowriter-session', u.id); } catch (e) {}
}
function currentTheme(){ const t = document.documentElement.dataset.theme; if (t) return t; return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
try { const t = localStorage.getItem('flowriter-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}

// ---------- routing ----------
function parseHash(){ const h = location.hash.replace(/^#\/?/, ''); const [path, q] = h.split('?'); return { path: path || '', q: new URLSearchParams(q || '') }; }
function go(path){ location.hash = '#/' + path; }
const ROUTES = {
  '': { v: coverView, bare: true },
  login: { v: loginView, bare: true }, signup: { v: signupView, bare: true }, forgot: { v: forgotView, bare: true }, reset: { v: resetView, bare: true },
  home: { v: homeView, auth: 'learner', tab: 'home' }, learn: { v: learnView, auth: 'learner', tab: 'learn' }, play: { v: playView, auth: 'learner', tab: 'play' }, stats: { v: statsView, auth: 'learner', tab: 'stats' },
  player: { v: playerView, tab: null },
  teach: { v: teachView, auth: 'teacher', tab: 'teach' }, assign: { v: assignView, auth: 'teacher', tab: 'teach' }, ranks: { v: ranksView, auth: 'teacher', tab: 'ranks' },
};
let cleanup = [];
function render(){
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  Music.stopPreview();
  const { path, q } = parseHash(); let r = ROUTES[path] || ROUTES[''];
  if (r.auth && !state.user) { go('login'); return; }
  if (r.auth === 'teacher' && state.user.role !== 'teacher') { go('home'); return; }
  if (r.auth === 'learner' && state.user.role === 'teacher') { go('teach'); return; }
  if ((path === 'login' || path === 'signup') && state.user) { go(state.user.role === 'teacher' ? 'teach' : 'home'); return; }
  const app = $('#app');
  const body = r.v(q);
  app.innerHTML = (r.bare ? bareBar(path) : appBar(r.tab)) + body;
  document.title = ({ '': 'FloWriter', login: 'Log in', signup: 'Sign up', home: 'Home', learn: 'Learn', play: 'Free Play', stats: 'Stats', teach: 'Classes', assign: 'New assignment', ranks: 'Class rankings', player: state.launch ? state.launch.title : 'Write' }[path] || 'FloWriter') + (path ? ' · FloWriter' : ' · make cursive a musical performance');
  const after = AFTER[path]; after && after(q);
  mountCharts();
  if (!keepScroll) window.scrollTo(0, 0); keepScroll = false;
}
let keepScroll = false;
const rerender = () => { keepScroll = true; render(); };
const AFTER = {};
addEventListener('hashchange', render);

// ---------- chrome ----------
function themeBtn(){ return `<button class="icon-btn" type="button" data-act="theme" aria-label="Switch theme" title="Switch theme">${currentTheme() === 'dark' ? IC.sun : IC.moon}</button>`; }
const logo = (href = '#/') => `<a class="logo" href="${href}" aria-label="FloWriter home"><span class="dyn">f</span><span class="scr">loWriter</span></a>`;
function bareBar(path){
  return `<header class="bar">${logo()}<span class="spacer"></span>
    ${path !== 'login' ? `<a class="btn ghost" href="#/login">Log in</a>` : ''}${path !== 'signup' ? `<a class="btn primary" href="#/signup">Sign up</a>` : ''}${themeBtn()}</header>`;
}
function appBar(tab){
  const u = state.user;
  if (!u) return `<header class="bar">${logo()}<span class="spacer"></span><a class="btn" href="#/signup">Sign up to save your scores</a>${themeBtn()}</header>`;
  const t = (id, label, ic) => `<a class="tab" href="#/${id}" ${tab === id ? 'aria-current="page"' : ''}>${ic}${label}</a>`;
  const tabs = u.role === 'teacher' ? t('teach', 'Classes', IC.users) + t('ranks', 'Class rankings', IC.star) : t('home', 'Home', IC.home) + t('learn', 'Learn', IC.book) + t('play', 'Free Play', IC.music) + t('stats', 'Leaderboard & Stats', IC.chart);
  const role = { teacher: 'Teacher', student: 'Student', general: 'Learner' }[u.role];
  return `<header class="bar">${logo(u.role === 'teacher' ? '#/teach' : '#/home')}<nav class="tabs" aria-label="Main">${tabs}</nav>
    <div class="who"><span class="avatar" aria-hidden="true">${esc(initials(u))}</span><div><div class="nm">${esc(u.username)}</div><div class="rl">${role}</div></div></div>
    ${themeBtn()}<button class="icon-btn" type="button" data-act="logout" aria-label="Log out" title="Log out">${IC.out}</button></header>`;
}

// ---------- overlays ----------
function toast(html, ms = 3400){ const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function openOverlay(html, center){ const o = $('#overlay'); o.innerHTML = `<div class="scrim${center ? ' center' : ''}" data-act="close-overlay">${html}</div>`; const f = o.querySelector(center ? 'input,select,button' : '[data-act="close-overlay"].icon-btn'); f && f.focus({ preventScroll: true }); }
function closeOverlay(){ $('#overlay').innerHTML = ''; }
addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

// =====================================================================
// COVER
// =====================================================================
function coverView(){
  const benefits = [
    ['Handwriting skills', 'Legible, fluid cursive through short, gamified practice.'],
    ['Memory and cognition', 'Handwriting links motor skills with the brain’s literacy regions.'],
    ['Fine motor control', 'Every stroke is hand-eye coordination on a beat.'],
    ['Music foundations', 'Rhythm and tempo, taught by a former principal symphony musician.'],
    ['Grammar and spelling', 'Later levels write full sentences, so spelling becomes muscle memory.'],
    ['Literacy', 'Classic public-domain books become practice pages.'],
    ['Lifelong habits', 'A love for handwriting that carries into adult life.'],
  ];
  return `
  <section class="hero">
    <div>
      <p class="eyebrow">Cursive, in time with music</p>
      <h1 class="wordmark" aria-label="FloWriter"><span class="dyn" title="f, as in fortissimo">f</span><span class="scr">loWriter</span></h1>
      <p class="tagline">Make cursive a <em>musical performance</em>.</p>
      <p class="lead">A rhythm game for handwriting. Every cursive stroke lands on a beat of the song, so practice feels like playing an instrument instead of filling a worksheet.</p>
      <div class="cta">
        <a class="btn primary lg" href="#/signup">Sign up free ${IC.arrow}</a>
        <a class="btn lg" href="#/login">Log in</a>
        <button class="btn lg ghost" type="button" data-act="guest-demo">${IC.play} Try it now</button>
      </div>
    </div>
    <div class="showcase" aria-label="Animated example: writing the word flow on the beat">
      <div class="hud"><span class="pill"><b id="cvBeat">Count-in</b></span><span class="pill">84 BPM · 1 beat per stroke</span></div>
      <canvas id="cvWrite" height="180" style="width:100%;height:180px;display:block" aria-hidden="true"></canvas>
      <div class="lane" id="cvLane"></div>
      <p class="note">Beat 1, stroke 1. Beat 2, stroke 2. Cursive gives the movement, the BPM gives the rhythm.</p>
    </div>
  </section>

  <section class="section" id="trailer">
    <h2>Trailer and demo</h2>
    <p class="sub">See a class write to the beat. The trailer and the classroom demo video will live here.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">
      <div class="video"><div><div class="play">${IC.play}</div><p class="hand" style="font-size:30px;color:var(--ink)">Trailer coming soon</p><p class="note">16:9 slot for the launch trailer</p></div></div>
      <div class="video"><div><div class="play" style="background:var(--pencil);box-shadow:0 0 0 10px var(--band)"><span style="color:#fff">${IC.play}</span></div><p class="hand" style="font-size:30px;color:var(--ink)">Classroom demo video</p><p class="note" style="margin-bottom:12px">Reserved for the walkthrough recording</p><button class="btn" type="button" data-act="guest-demo">Play the live demo instead</button></div></div>
    </div>
  </section>

  <section class="section">
    <h2>How it works</h2>
    <p class="sub">Every word is broken into strokes. Each stroke owns a beat. Trace it on time and it counts.</p>
    <div class="how-grid">
      <div><span class="hand" style="font-size:40px">1</span><h3>Cursive gives the movement</h3><p>Each letter is stored as an ordered list of strokes: lead-in, oval, downstroke, exit. Letters join end to end, so a word is one path cut at teaching points.</p></div>
      <div><span class="hand" style="font-size:40px">2</span><h3>BPM gives the rhythm</h3><p>After a 4-beat count-in, a glowing dot travels each stroke at the song’s tempo. Pick a starter song or upload your own MP3 and the beat is detected for you.</p></div>
      <div><span class="hand" style="font-size:40px">3</span><h3>You play it</h3><p>In Practice the music waits when your pen lifts. In the Test it keeps going. A stroke is valid when the ink stays inside the margin, covers the stroke, and lands on the beat.</p></div>
    </div>
  </section>

  <section class="section">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));align-items:start;gap:32px">
      <div>
        <p class="eyebrow">About us</p>
        <h2>Our mission</h2>
        <p style="font-size:17px;color:var(--muted);max-width:56ch;margin-top:8px">Handwriting is coming back to classrooms, but most tools are tracing worksheets on a screen. FloWriter gives teachers a standard cursive curriculum that children actually want to play, and gives every learner instant, musical feedback.</p>
      </div>
      <div class="panel lift" style="gap:6px">
        <span class="stat-big">4<span style="font-size:.4em;color:var(--muted);margin-left:6px">states</span></span>
        <p>passed or advanced new cursive requirements in 2025 and 2026: Pennsylvania, New Jersey, Idaho and Florida.</p>
        <p class="note">Counts of states that require cursive vary by source, from about 19 to 32, but the direction is the same: more each year.</p>
      </div>
    </div>
    <ul class="benefits" style="margin-top:32px">${benefits.map(([b, t]) => `<li>${IC.check}<span><b>${b}</b>${t}</span></li>`).join('')}</ul>
  </section>

  <section class="section">
    <h2>Built for two kinds of writers</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));margin-top:18px">
      <div class="index-card"><h3>Students and families</h3><p>Lessons from single letters to classic books, free play with any song, a to-do list from your teacher, and class leaderboards.</p></div>
      <div class="index-card"><h3>Teachers</h3><p>Class codes, assignments with due dates, music and difficulty, progress for every student, and a replay of each child’s trace.</p></div>
      <div class="index-card"><h3>Anyone learning cursive</h3><p>The same curriculum on your own schedule, with a global leaderboard.</p></div>
    </div>
  </section>

  <section class="section" id="team">
    <h2>The team</h2>
    <p class="sub">A small team of musicians, students, and builders.</p>
    <div class="team">${TEAM.map(m => `
      <article class="panel member">
        <div class="row"><span class="avatar" aria-hidden="true">${esc(m.initials)}</span><div><h3 style="font-size:19px">${esc(m.name)}</h3><div class="role">${esc(m.role)}</div></div></div>
        <p>${esc(m.bio)}</p>
        <p class="fun">For fun: ${esc(m.fun)}</p>
        <a class="btn sm" href="${esc(m.linkedin)}" target="_blank" rel="noopener"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="3" fill="currentColor"/><path d="M6 8.5v5.5M6 6v.1M9 14V8.5M9 11c0-1.5 1-2.5 2.2-2.5S13.5 9.3 13.5 11v3" stroke="var(--surface)" stroke-width="1.7" stroke-linecap="round"/></svg>LinkedIn</a>
      </article>`).join('')}</div>
  </section>
  <footer class="foot"><span>${logo()}</span><span>Demo build · test accounts and data are generated</span><a href="#/signup">Create an account</a></footer>`;
}
AFTER[''] = () => {
  const cv = $('#cvWrite'), lane = $('#cvLane'); if (!cv) return;
  const word = 'flow', cells = ['4', '3', '2', '1', ...word];
  lane.innerHTML = cells.map((c, i) => `<div class="cell${i < 4 ? ' count' : ''}"><span class="ch">${c}</span><span class="ix">${i < 4 ? 'count' : 'beat ' + (i - 3)}</span></div>`).join('');
  const g = cv.getContext('2d'); let beat = -1, t0 = performance.now(), raf; const spb = 60 / 84 * 1000, total = cells.length + 3;
  const draw = now => {
    const w = cv.clientWidth, h = 180, d = devicePixelRatio || 1; if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = h * d; }
    const cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim();
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const base = 128, xh = 34;
    [[base - xh * 2.2, col('--rule'), 1.3, []], [base - xh, col('--rule'), 1, [6, 6]], [base, col('--rule'), 1.6, []]].forEach(([y, c, lw, dash]) => { g.beginPath(); g.setLineDash(dash); g.strokeStyle = c; g.lineWidth = lw; g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
    g.setLineDash([]); g.strokeStyle = col('--margin'); g.beginPath(); g.moveTo(22, 0); g.lineTo(22, h); g.stroke();
    const size = Math.min(118, w / 3.2); g.font = `700 ${size}px "Dancing Script", cursive`; g.textBaseline = 'alphabetic';
    const tw = g.measureText(word).width, x0 = (w - tw) / 2 + 10;
    g.setLineDash([3, 6]); g.lineWidth = 1.3; g.strokeStyle = col('--missed'); g.strokeText(word, x0, base); g.setLineDash([]);
    const el = (now - t0) / spb, b = Math.floor(el) % total;
    if (b !== beat) { beat = b; $$('.cell', lane).forEach((c, i) => { c.classList.toggle('now', i === b); c.classList.toggle('valid', i >= 4 && i < b); }); const lab = $('#cvBeat'); if (lab) lab.textContent = b < 4 ? `Count-in ${4 - b}` : b < cells.length ? `Beat ${b - 3} · stroke ${b - 3}` : 'Valid · 4 of 4 strokes'; }
    let prog = 0; if (b >= 4) { const k = Math.min(word.length, (b - 4) + (el % 1)); const whole = Math.floor(k); prog = g.measureText(word.slice(0, whole)).width + (whole < word.length ? g.measureText(word[whole]).width * (k - whole) : 0); }
    if (prog > 0) { g.save(); g.beginPath(); g.rect(x0 - 20, 0, prog + 20, h); g.clip(); g.fillStyle = col('--ok'); g.fillText(word, x0, base); g.restore();
      if (b < cells.length) { g.beginPath(); g.fillStyle = col('--accent'); g.arc(x0 + prog, base - xh * .6, 7, 0, 7); g.fill(); g.beginPath(); g.strokeStyle = col('--accent-wash'); g.lineWidth = 10; g.arc(x0 + prog, base - xh * .6, 12, 0, 7); g.stroke(); } }
    raf = requestAnimationFrame(draw);
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { t0 = performance.now() - spb * (cells.length + .5); draw(performance.now()); cancelAnimationFrame(raf); }
  else raf = requestAnimationFrame(draw);
  document.fonts && document.fonts.ready.then(() => {});
  cleanup.push(() => cancelAnimationFrame(raf));
};

// =====================================================================
// AUTH
// =====================================================================
const DEMO_ACCTS = [
  { u: 'evan_writes', p: 'flowriter1', r: 'Student · Period 2', who: 'Evan, 3rd grade' },
  { u: 'mr_murry', p: 'teacher2026', r: 'Teacher · 3 periods', who: 'Mr. Murry' },
  { u: 'cursive_fan', p: 'loopdeloop', r: 'Learner · no class', who: 'General learner' },
];
function demoCard(){
  return `<aside class="index-card"><h3>Test accounts</h3>
    ${DEMO_ACCTS.map(a => `<div class="acct"><span class="avatar" aria-hidden="true">${a.u[0].toUpperCase()}</span><div class="meta"><b>${a.who}</b><br><code>${a.u} · ${a.p}</code><br><span class="note">${a.r}</span></div><button class="btn sm" type="button" data-act="quick-login" data-u="${a.u}" data-p="${a.p}">Use</button></div>`).join('')}
    <p class="note" style="margin-top:8px">Class codes for sign-up: <b style="font-family:var(--mono)">MURRY2</b>, <b style="font-family:var(--mono)">LOOPS4</b>, <b style="font-family:var(--mono)">OVALS6</b></p></aside>`;
}
const pwRules = (id) => `<ul class="rules" id="${id}"><li data-r="len">At least 8 characters</li><li data-r="ws">No spaces</li></ul>`;
function loginView(){
  return `<div class="page-head"><div><p class="eyebrow">Welcome back</p><h1>Log in</h1><p class="note">Pick up where you left off.</p></div></div>
  <div class="auth">
    <form class="panel lift" data-form="login" novalidate>
      <div class="field"><label for="liId">Username or email</label><input class="input" id="liId" name="id" autocomplete="username" required></div>
      <div class="field"><label for="liPw">Password</label><input class="input" id="liPw" name="password" type="password" autocomplete="current-password" required></div>
      <div class="row"><label class="check"><input type="checkbox" name="remember" id="liRemember" checked> Remember me</label><a class="spacer" href="#/forgot">Forgot password?</a></div>
      <p class="form-error" id="liErr" role="alert"></p>
      <button class="btn primary lg" type="submit">Log in</button>
      <p class="note">New here? <a href="#/signup">Create an account</a></p>
    </form>
    ${demoCard()}
  </div>`;
}
function signupView(q){
  const role = q.get('role') || 'student';
  return `<div class="page-head"><div><p class="eyebrow">Join FloWriter</p><h1>Create an account</h1><p class="note">Students join their class with the code from their teacher.</p></div></div>
  <div class="auth">
    <form class="panel lift" data-form="signup" novalidate>
      <div class="field"><span class="lbl" id="roleLbl">I am a…</span>
        <div class="seg" role="group" aria-labelledby="roleLbl">${[['student', 'Student'], ['teacher', 'Teacher'], ['general', 'Just learning']].map(([v, l]) => `<button type="button" data-act="role" data-role="${v}" aria-pressed="${v === role}">${l}</button>`).join('')}</div></div>
      <input type="hidden" name="role" value="${role}">
      <div class="two">
        <div class="field"><label for="suEmail">Email</label><input class="input" id="suEmail" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="suUser">Username</label><input class="input" id="suUser" name="username" autocomplete="username" placeholder="Leave blank to use your email"><small>Shown on leaderboards. No spaces.</small></div>
      </div>
      <div class="two">
        <div class="field"><label for="suPw">Password</label><input class="input" id="suPw" name="password" type="password" autocomplete="new-password" required>${pwRules('suRules')}</div>
        <div class="field"><label for="suPw2">Confirm password</label><input class="input" id="suPw2" name="password2" type="password" autocomplete="new-password" required></div>
      </div>
      <div class="two" id="suStudent" ${role === 'student' ? '' : 'hidden'}>
        <div class="field"><label for="suBirth">Birth date</label><input class="input" id="suBirth" name="birth" type="date" max="${toLocalInput(Date.now()).slice(0, 10)}" required></div>
        <div class="field"><label for="suCode">Class code</label><input class="input" id="suCode" name="code" maxlength="6" style="font-family:var(--mono);letter-spacing:.14em;text-transform:uppercase" placeholder="MURRY2" required><small>6 letters and numbers, from your teacher</small></div></div>
      <div class="field" id="suTeacher" ${role === 'teacher' ? '' : 'hidden'}><label for="suSchool">School</label><input class="input" id="suSchool" name="school" placeholder="Bayou Elementary"></div>
      <label class="check"><input type="checkbox" name="remember" id="suRemember" checked> Remember me</label>
      <p class="form-error" id="suErr" role="alert"></p>
      <button class="btn primary lg" type="submit">Create account</button>
      <p class="note">Already have one? <a href="#/login">Log in</a></p>
    </form>
    ${demoCard()}
  </div>`;
}
function forgotView(q){
  const sent = q.get('sent');
  return `<div class="page-head"><div><p class="eyebrow">Account help</p><h1>Reset your password</h1><p class="note">We’ll email you a link to choose a new one.</p></div></div>
  <div class="auth">${sent ? `
    <div class="panel lift"><p class="hand" style="font-size:32px;color:var(--ink)">Check your inbox</p>
      <p>If an account uses <b>${esc(q.get('email'))}</b>, a reset link is on its way. It works for 24 hours.</p>
      ${q.get('token') ? `<div class="index-card" style="margin-top:6px"><h3>Demo inbox</h3><p class="note">No email is sent in this demo. Here is the link the email would contain.</p><a class="btn primary" style="margin-top:10px" href="#/reset?token=${esc(q.get('token'))}">Open the reset link ${IC.arrow}</a></div>` : ''}
      <a href="#/login">Back to log in</a></div>` : `
    <form class="panel lift" data-form="forgot" novalidate>
      <div class="field"><label for="fgEmail">Email</label><input class="input" id="fgEmail" name="email" type="email" autocomplete="email" required></div>
      <p class="form-error" id="fgErr" role="alert"></p>
      <button class="btn primary lg" type="submit">Email me a reset link</button>
      <a href="#/login">Back to log in</a>
    </form>`}
    <aside class="index-card"><h3>Tip</h3><p>Try <code style="font-family:var(--mono)">evan.family@example.com</code> to see the whole reset flow.</p></aside>
  </div>`;
}
function resetView(q){
  return `<div class="page-head"><div><p class="eyebrow">Account help</p><h1>Choose a new password</h1></div></div>
  <div class="auth"><form class="panel lift" data-form="reset" novalidate>
    <input type="hidden" name="token" value="${esc(q.get('token') || '')}">
    <div class="field"><label for="rsPw">New password</label><input class="input" id="rsPw" name="password" type="password" autocomplete="new-password" required>${pwRules('rsRules')}</div>
    <div class="field"><label for="rsPw2">Type it again</label><input class="input" id="rsPw2" name="password2" type="password" autocomplete="new-password" required></div>
    <p class="form-error" id="rsErr" role="alert"></p>
    <button class="btn primary lg" type="submit">Save new password</button>
  </form></div>`;
}
function paintRules(input){
  const ul = input.closest('form').querySelector('.rules'); if (!ul) return; const v = input.value;
  ul.querySelector('[data-r="len"]').classList.toggle('ok', v.length >= 8); ul.querySelector('[data-r="ws"]').classList.toggle('ok', v.length > 0 && !/\s/.test(v));
}
async function submitForm(name, form){
  const f = Object.fromEntries(new FormData(form)); const err = form.querySelector('.form-error'); err.textContent = '';
  $$('.input', form).forEach(i => i.removeAttribute('aria-invalid'));
  const bad = (msg, field) => { err.textContent = msg; if (field) { const i = form.querySelector(`[name="${field}"]`); i && (i.setAttribute('aria-invalid', 'true'), i.focus()); } };
  try {
    if (name === 'login') {
      if (!f.id || !f.password) return bad('Enter your username or email and your password.', !f.id ? 'id' : 'password');
      const u = await api.login(f.id.trim(), f.password); setSession(u, !!f.remember); go(u.role === 'teacher' ? 'teach' : 'home');
    } else if (name === 'signup') {
      if (!RULES.email(f.email || '')) return bad('Enter a valid email address.', 'email');
      if (f.username && /\s/.test(f.username)) return bad('Usernames can’t contain spaces.', 'username');
      if (!RULES.password(f.password || '')) return bad('Passwords need at least 8 characters and no spaces.', 'password');
      if (f.password !== f.password2) return bad('The two passwords don’t match.', 'password2');
      if (f.role === 'student' && !f.birth) return bad('Add your birth date.', 'birth');
      if (f.role === 'student' && !(f.code || '').trim()) return bad('Add the class code from your teacher.', 'code');
      const u = await api.signup({ ...f, username: (f.username || '').trim() }); setSession(u, !!f.remember);
      if (u.role === 'teacher') { api.addClass(u, 'Period 1'); go('teach'); } else go('home');
      toast(`<span class="big">Welcome!</span> Account created for ${esc(u.username)}`);
    } else if (name === 'forgot') {
      if (!RULES.email(f.email || '')) return bad('Enter the email on your account.', 'email');
      const r = await api.requestReset(f.email.trim()); go(`forgot?sent=1&email=${encodeURIComponent(r.email)}${r.token ? '&token=' + r.token : ''}`);
    } else if (name === 'reset') {
      if (!RULES.password(f.password || '')) return bad('Passwords need at least 8 characters and no spaces.', 'password');
      if (f.password !== f.password2) return bad('The two passwords don’t match.', 'password2');
      await api.resetPassword(f.token, f.password); toast('Password saved. Log in with the new one.'); go('login');
    }
  } catch (e) { const m = e.message || 'Something went wrong.'; bad(m, /code/i.test(m) ? 'code' : /password/i.test(m) ? 'password' : /user/i.test(m) ? (name === 'login' ? 'id' : 'username') : /email/i.test(m) ? 'email' : null); }
}

// =====================================================================
// STUDENT / LEARNER
// =====================================================================
function greeting(){ const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function kpis(uid_){
  const s = statsFor(uid_);
  return `<div class="kpis">
    <div class="kpi"><span class="k">Words learned</span><span class="n">${s.learned.size}</span><span class="t">written at 90%+ accuracy</span></div>
    <div class="kpi"><span class="k">Average accuracy</span><span class="n">${Math.round(s.avg * 100)}<small>%</small></span><span class="t">across ${s.attempts.length} attempts</span></div>
    <div class="kpi"><span class="k">Fastest song at 90%+</span><span class="n">${s.best ? s.best.bpm : '—'}<small>${s.best ? 'BPM' : ''}</small></span><span class="t">${s.best ? 'since ' + fmtShort(s.best.date) : 'reach 90% to set one'}</span></div></div>`;
}
function todoItem(a, u){
  const sub = submission(u.id, a.id), closed = Date.now() > a.due, song = DB.songs.find(s => s.id === a.songId);
  const done = !!sub, box = done ? `<span class="box done">${IC.check}</span>` : closed ? `<span class="box lock">${IC.lock}</span>` : `<span class="box"></span>`;
  const status = done ? `<span class="pill ${acc(sub) >= .9 ? 'ok' : 'warn'}">${pct(acc(sub))}${a.kind === 'test' ? ' · submitted' : ' best'}</span>` : closed ? `<span class="pill">${IC.lock}Locked</span>` : (a.due - Date.now() < 2 * DAY ? `<span class="pill warn">Due soon</span>` : `<span class="pill">${a.kind === 'test' ? 'Test' : 'Practice'}</span>`);
  return `<button class="todo-item${closed ? ' closed' : ''}" type="button" data-act="open-assignment" data-id="${a.id}">
    ${box}<span><span class="t">${esc(a.title)}</span><span class="m" style="display:block">${a.kind === 'test' ? 'Test' : 'Practice'} · ${esc(song ? song.title : 'Built-in beat')} · ${a.bpm} BPM${a.studentIds ? ' · just for you' : ''}</span></span>
    <span class="r">${status}<span class="due">${relDue(a.due)} · ${fmtShort(a.due)}</span></span></button>`;
}
function homeView(){
  const u = state.user, cls = DB.classes.find(c => c.id === u.classId), ms = moduleState(u.id);
  const cur = ms.find(m => m.unlocked && !m.done) || ms[ms.length - 1];
  const nextLesson = cur.module.lessons.find(l => !lessonPassed(u.id, l.id)) || cur.module.lessons[0];
  const list = assignmentsFor(u), open = list.filter(a => Date.now() <= a.due), past = list.filter(a => Date.now() > a.due);
  const board = leaderboard(u.role === 'general' ? 'global' : 'class', u, 'bpm'), myRank = board.ranked.findIndex(r => r.u.id === u.id) + 1;
  return `
  <div class="page-head"><div><p class="greet">${greeting()}, ${esc(u.name.split(' ')[0])}!</p><p class="note">${cls ? esc(cls.name) + ' · ' + esc(cls.school) : 'Learning on your own schedule'} · ${fmtDate(Date.now())}</p></div></div>
  ${kpis(u.id)}
  <div class="dash" style="margin-top:24px">
    <section class="panel lift" aria-labelledby="todoH">
      <div class="panel-head"><h2 id="todoH">${u.role === 'student' ? 'To do' : 'Up next'}</h2><span class="note">${u.role === 'student' ? `${open.filter(a => !submission(u.id, a.id)).length} open` : ''}</span></div>
      ${u.role === 'student' ? `<div class="todo">${open.length ? open.map(a => todoItem(a, u)).join('') : '<p class="empty">Nothing due. Nice work!</p>'}</div>
        ${past.length ? `<details><summary class="note" style="cursor:pointer;padding:6px 0">Past assignments (${past.length})</summary><div class="todo">${past.slice().reverse().map(a => todoItem(a, u)).join('')}</div></details>` : ''}`
      : `<div class="todo"><button class="todo-item" type="button" data-act="open-lesson" data-id="${nextLesson.id}"><span class="box"></span><span><span class="t">${esc(cur.module.title)} · ${esc(nextLesson.title)}</span><span class="m" style="display:block">Next lesson in your curriculum</span></span><span class="r"><span class="pill warn">Continue</span></span></button>
        <button class="todo-item" type="button" data-act="nav" data-to="play"><span class="box"></span><span><span class="t">Free play with a new song</span><span class="m" style="display:block">Pick a song and a random text</span></span><span class="r"><span class="pill">Any time</span></span></button></div>`}
    </section>
    <div class="tiles">
      <a class="tile" href="#/learn"><span class="ico">${IC.book}</span><span><h3>Learning</h3><p>${esc(cur.module.title)} · ${cur.passed} of ${cur.total} lessons passed. Next: ${esc(nextLesson.title)}</p></span><span class="go">${IC.arrow}</span></a>
      <a class="tile" href="#/play"><span class="ico" style="background:var(--band);color:var(--pencil)">${IC.music}</span><span><h3>Free Play</h3><p>Any song, any text. ${DB.songs.filter(s => s.kind === 'starter').length} starter songs ready.</p></span><span class="go">${IC.arrow}</span></a>
      <a class="tile" href="#/stats"><span class="ico" style="background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)">${IC.chart}</span><span><h3>Leaderboard & Stats</h3><p>${myRank ? `#${myRank} in your ${u.role === 'general' ? 'global board' : 'class'} for fastest song at 90%+` : 'Reach 90% accuracy on a song to join the leaderboard'}</p></span><span class="go">${IC.arrow}</span></a>
    </div>
  </div>`;
}

function learnView(){
  const u = state.user, ms = moduleState(u.id);
  return `<div class="page-head"><div><p class="eyebrow">Curriculum</p><h1>Learn cursive, one module at a time</h1><p class="note">Each lesson has a demo, practice, and a test. Score 90% or better on every test in a module to unlock the next one.</p></div></div>
  <div class="modules">${ms.map((st, i) => {
    const m = st.module, lock = !st.unlocked;
    return `<section class="module${lock ? ' locked' : ''}${st.done ? ' done' : ''}" aria-label="${esc(m.title)}">
      <div class="module-head"><span class="module-num">${st.done ? IC.check.replace('<svg', '<svg style="width:24px;height:24px"') : lock ? IC.lock.replace('<svg', '<svg style="width:20px;height:20px"') : i + 1}</span>
        <div><h2>${esc(m.title)}</h2><p class="note">${esc(m.sub)}${lock ? ` · Unlocks after every test in ${esc(ms[i - 1].module.title)} is 90%+` : ''}</p></div>
        <div class="prog"><span>${st.passed} / ${st.total} tests passed</span><div class="meter"><i style="width:${st.passed / st.total * 100}%"></i></div></div></div>
      ${lock ? '' : `<div class="lessons">${m.lessons.map(l => { const best = lessonBest(u.id, l.id), passed = best != null && best >= .9, ex = l.excerpt != null ? EXCERPTS[l.excerpt] : null;
        return `<button class="lesson${passed ? ' passed' : ''}" type="button" data-act="open-lesson" data-id="${l.id}">
          <span class="lt"><span>${esc(ex ? ex.title : l.title)}</span>${passed ? `<span class="pill ok">${IC.check}${pct(best)}</span>` : best != null ? `<span class="pill warn">Best ${pct(best)}</span>` : `<span class="pill">New</span>`}</span>
          <span class="sample">${esc(lessonText(l))}</span>${ex ? `<span class="cite">${esc(ex.author)}, ${ex.year} · Project Gutenberg #${ex.gid}</span>` : ''}</button>`; }).join('')}</div>`}
    </section>`; }).join('')}</div>`;
}

function songDisc(s, playing){ return `<span class="disc${playing ? ' on' : ''}" style="background:conic-gradient(from 20deg,hsl(${s.hue ?? 220} 70% 55%),hsl(${(s.hue ?? 220) + 50} 70% 45%),hsl(${s.hue ?? 220} 70% 55%))" data-act="preview" data-id="${s.id}" role="button" tabindex="0" aria-label="${playing ? 'Stop preview' : 'Preview'} ${esc(s.title)}">${playing ? IC.pause : IC.play}</span>`; }
function songRow(s, selected, attr = 'pick-song'){
  const mine = s.kind === 'upload', playing = Music.playing() === s.id;
  return `<div class="song" role="button" tabindex="0" aria-pressed="${selected}" data-act="${attr}" data-id="${s.id}">${songDisc(s, playing)}
    <span><span class="t">${esc(s.title)}</span><span class="m" style="display:block">${esc(s.artist || 'You')} · ${esc(s.style || 'Your upload')}${mine ? (RUNTIME.songFiles[s.id] ? ' · MP3' : ' · file not in this session') : ''}</span></span>
    <span class="bpm">${s.bpm} BPM<br><span class="pill" style="margin-top:3px">${mine ? 'Yours' : 'Starter'}</span></span></div>`;
}
function librarySongs(u){ return DB.songs.filter(s => s.kind === 'starter' || s.ownerId === u.id || (u.role === 'student' && s.ownerId === (DB.classes.find(c => c.id === u.classId) || {}).teacherId)); }
function playView(){
  const u = state.user, P = state.play, songs = librarySongs(u), song = songs.find(s => s.id === P.songId) || songs[0];
  if (!P.text) P.text = pick(Math.random, FREE_TEXTS[song.mood || 'bright']);
  const text = P.textMode === 'own' ? P.own : P.text;
  return `<div class="page-head"><div><p class="eyebrow">Free Play</p><h1>Pick a song, then write to it</h1><p class="note">Free play counts toward your stats and the leaderboard.</p></div>
    <button class="btn" type="button" data-act="freewrite">${IC.pen} Open the free write page</button></div>
  <div class="fp">
    <section class="panel lift" aria-labelledby="libH">
      <div class="panel-head"><h2 id="libH">Song library</h2><span class="note">${songs.length} songs · tap the disc to preview</span></div>
      <div class="library" id="library">${songs.map(s => songRow(s, s.id === song.id)).join('')}</div>
      <div class="upload"><label class="btn" for="fpUpload">${IC.upload} Add your own MP3</label><input id="fpUpload" class="sr-only" type="file" accept=".mp3,audio/mpeg" data-upload="free"><span class="note" id="fpUpNote">MP3 only. The BPM is detected automatically.</span></div>
    </section>
    <section class="panel lift" aria-labelledby="txtH">
      <div class="panel-head"><h2 id="txtH">What to write</h2>
        <div class="seg" role="group" aria-label="Text source">${[['random', 'Random'], ['own', 'My own']].map(([v, l]) => `<button type="button" data-act="text-mode" data-mode="${v}" aria-pressed="${P.textMode === v}">${l}</button>`).join('')}</div></div>
      ${P.textMode === 'random' ? `<div class="textcard"><span class="script">${esc(P.text)}</span></div>
        <div class="row"><button class="btn sm" type="button" data-act="shuffle">${IC.shuffle} New text</button><span class="note">Matched to the feel of <b>${esc(song.title)}</b></span></div>`
      : `<div class="field"><label for="fpOwn" class="sr-only">Your text</label><textarea class="input" id="fpOwn" maxlength="300" placeholder="Type a word, a sentence, or a short paragraph…">${esc(P.own)}</textarea><small>Letters A to Z and . , ! ? ' · up to 300 characters</small></div>`}
      <div class="field"><span class="lbl" id="bpsL">Beats per stroke</span><div class="seg" role="group" aria-labelledby="bpsL">${[1, 2].map(n => `<button type="button" data-act="bps" data-n="${n}" aria-pressed="${P.bps === n}">${n} beat${n > 1 ? 's' : ''}</button>`).join('')}</div><small>Songs above about 110 BPM feel better at 2 beats per stroke.</small></div>
      <div class="row" style="border-top:1px solid var(--line);padding-top:14px">
        <div><div class="note">Ready</div><b>${esc(song.title)}</b> <span class="bpm">· ${song.bpm} BPM</span></div>
        <button class="btn primary lg spacer" type="button" data-act="start-free" ${cleanText(text) ? '' : 'disabled'}>Start writing ${IC.arrow}</button>
      </div>
      <p class="note">The song starts after a 4-beat count-in.</p>
    </section>
  </div>`;
}

// ---------- stats ----------
const RANGES = { '1m': { label: '1 month', days: 30, step: 'day' }, '6m': { label: '6 months', days: 182, step: 'week' }, '1y': { label: '1 year', days: 365, step: 'week' }, all: { label: 'All time', days: null, step: 'month' } };
function buckets(rangeKey, joined){
  const r = RANGES[rangeKey], now = Date.now(), start = r.days ? now - r.days * DAY : joined, out = [];
  if (r.step === 'month') { const d = new Date(start); d.setDate(1); d.setHours(0, 0, 0, 0); while (d.getTime() <= now) { const a = d.getTime(); d.setMonth(d.getMonth() + 1); out.push({ a, b: Math.min(d.getTime(), now + 1), label: new Date(a).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }); } }
  else { const step = r.step === 'day' ? DAY : 7 * DAY; const d0 = new Date(start); d0.setHours(0, 0, 0, 0); for (let a = d0.getTime(); a <= now; a += step) out.push({ a, b: a + step, label: fmtShort(a) }); }
  return out;
}
function statsView(){
  const u = state.user, S = state.stats; if (!S.scope) S.scope = u.role === 'general' ? 'global' : 'class';
  const s = statsFor(u.id), words = [...s.learned.entries()].sort((a, b) => b[1].count - a[1].count);
  const max = Math.max(1, ...words.map(w => w[1].count));
  const scopes = u.role === 'general' ? [['global', 'Global']] : [['class', 'My class'], ['school', 'My school']];
  return `<div class="page-head"><div><p class="eyebrow">Leaderboard & Stats</p><h1>${esc(u.name.split(' ')[0])}’s progress</h1></div>
    <div class="seg" role="group" aria-label="Time range">${Object.entries(RANGES).map(([k, r]) => `<button type="button" data-act="range" data-k="${k}" aria-pressed="${S.range === k}">${r.label}</button>`).join('')}</div></div>
  ${kpis(u.id)}
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));margin-top:20px">
    <section class="panel lift"><div class="panel-head"><h2>Words learned over time</h2><span class="note">Hover to see a date</span></div><div class="chart" data-chart="words"></div></section>
    <section class="panel lift"><div class="panel-head"><h2>Active writing time</h2><span class="note">Minutes with the pen moving, idle time left out</span></div><div class="chart" data-chart="activity"></div></section>
  </div>
  <section class="panel lift" style="margin-top:20px"><div class="panel-head"><h2>Word garden</h2><span class="note">${s.learned.size} words · bigger means written more often</span></div>
    <div class="words-cloud">${words.length ? words.map(([w, e]) => `<span style="font-size:${18 + e.count / max * 30}px;opacity:${.55 + e.count / max * .45}" title="${esc(w)}: written ${e.count}× at 90%+, first on ${fmtShort(e.first)}">${esc(w)}</span>`).join('') : '<p class="empty">Score 90% on a lesson to plant your first word.</p>'}</div></section>
  <section style="margin-top:28px">
    <div class="page-head" style="margin-bottom:14px"><div><h2 style="font-size:26px">Leaderboards</h2><p class="note">${u.role === 'general' ? 'Learners everywhere, by username.' : 'Your class and school, by username.'} Free play counts.</p></div>
      <div class="seg" role="group" aria-label="Leaderboard scope">${scopes.map(([k, l]) => `<button type="button" data-act="scope" data-k="${k}" aria-pressed="${S.scope === k}">${l}</button>`).join('')}</div></div>
    <div class="boards">${boardPanel(S.scope, u, 'bpm')}${boardPanel(S.scope, u, 'words')}${boardPanel(S.scope, u, 'time')}</div>
  </section>`;
}
function boardPanel(scope, u, metric){
  const b = leaderboard(scope, u, metric), me = b.ranked.findIndex(r => r.u.id === u.id);
  const title = { bpm: 'Fastest song at 90%+', words: 'Most words seen', time: 'Most time writing' }[metric];
  const fmt = r => metric === 'time' ? fmtDur(r.value) : metric === 'words' ? r.value.toLocaleString() : r.value + ' BPM';
  const sub = r => metric === 'bpm' ? 'since ' + fmtShort(r.s.best.date) : metric === 'words' ? r.s.seen + ' different' : r.s.attempts.length + ' sessions';
  const rows = b.ranked.slice(0, 8); if (me >= 8) rows.push(b.ranked[me]);
  return `<section class="panel lift"><div class="panel-head"><h2>${title}</h2></div>
    <div class="board">${rows.map(r => { const i = b.ranked.indexOf(r) + 1; return `<div class="brow top${i}${u && r.u.id === u.id ? ' me' : ''}"><span class="rk">${i}</span><span><span class="nm" style="display:block">${esc(r.u.username)}</span><span class="sb">${sub(r)}</span></span><span class="vl">${fmt(r)}</span></div>`; }).join('') || '<p class="empty">No one yet</p>'}</div>
    ${metric === 'bpm' ? `<p class="note">Only writers with 90%+ accuracy on their best-BPM song are ranked. Ties go to whoever got there first.${b.unranked ? ` ${b.unranked} not ranked yet.` : ''}</p>` : ''}</section>`;
}

// ---------- charts ----------
const CHARTS = {};
CHARTS.words = () => {
  const u = state.user, s = statsFor(u.id), bk = buckets(state.stats.range, u.joined), firsts = [...s.learned.values()].map(e => e.first);
  return { kind: 'line', labels: bk.map(b => b.label), values: bk.map(b => firsts.filter(f => f < b.b).length), dates: bk.map(b => Math.min(b.b - 1, Date.now())), unit: v => `${v} words` };
};
CHARTS.activity = () => {
  const u = state.user, at = userAttempts(u.id), bk = buckets(state.stats.range, u.joined);
  return { kind: 'bar', labels: bk.map(b => b.label), values: bk.map(b => Math.round(at.filter(a => a.date >= b.a && a.date < b.b).reduce((t, a) => t + (a.seconds || 0), 0) / 60)), dates: bk.map(b => b.a), unit: v => `${v} min`, step: RANGES[state.stats.range].step };
};
function niceMax(v){ const raw = Math.max(1, v / 4), p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p * 4; return 40 * p; }
function drawChart(el){
  const spec = CHARTS[el.dataset.chart](), W = Math.max(280, el.clientWidth), H = 230, L = 42, R = 12, T = 12, B = 30;
  const n = spec.values.length, max = niceMax(Math.max(...spec.values, 1)), iw = W - L - R, ih = H - T - B;
  const x = i => spec.kind === 'bar' ? L + (i + .5) * iw / n : L + (n > 1 ? i * iw / (n - 1) : iw / 2), y = v => T + ih - v / max * ih;
  const ticks = [0, .25, .5, .75, 1].map(f => f * max);
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 70)));
  let marks = '';
  if (spec.kind === 'line') {
    const pts = spec.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    marks = `<path class="area" d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)} Z"/><path class="lineP" d="M${pts.join(' L')}"/><circle class="dot" cx="${x(n - 1)}" cy="${y(spec.values[n - 1])}" r="4.5"/>`;
  } else {
    const bw = Math.max(2, iw / n - 2);
    marks = spec.values.map((v, i) => { const h = Math.max(v ? 2 : 0, v / max * ih); return h ? `<path class="barP" data-i="${i}" d="M${x(i) - bw / 2},${y(0)} v${-(h - Math.min(4, bw / 2, h))} q0,${-Math.min(4, bw / 2, h)} ${Math.min(4, bw / 2)},${-Math.min(4, bw / 2, h)} h${bw - 2 * Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, bw / 2, h)} V${y(0)} Z"/>` : ''; }).join('');
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${el.dataset.chart === 'words' ? 'Words learned, cumulative' : 'Active minutes'} over ${RANGES[state.stats.range].label}">
    <g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    <g class="axis">${ticks.map(t => `<text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${Math.round(t)}</text>`).join('')}
      ${spec.labels.map((l, i) => i % every === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : '').join('')}</g>
    ${marks}<line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" style="display:none"/><circle class="dot hov" r="5" style="display:none"/>
    <rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent" class="hit"/></svg><div class="tip" hidden></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cross = el.querySelector('.cross'), hov = el.querySelector('.hov');
  const show = e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
    let i = spec.kind === 'bar' ? Math.floor((px - L) / (iw / n)) : Math.round((px - L) / (iw / Math.max(1, n - 1))); i = Math.max(0, Math.min(n - 1, i));
    const v = spec.values[i], d = spec.dates[i];
    const when = spec.kind === 'bar' ? (spec.step === 'day' ? fmtDate(d) : spec.step === 'week' ? 'Week of ' + fmtShort(d) : new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })) : fmtDate(d);
    tip.hidden = false; tip.innerHTML = `${when}<br><b>${spec.unit(v)}</b>`; tip.style.left = (x(i) * r.width / W) + 'px'; tip.style.top = (y(v) * r.height / H) + 'px';
    if (spec.kind === 'line') { cross.style.display = ''; cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); hov.style.display = ''; hov.setAttribute('cx', x(i)); hov.setAttribute('cy', y(v)); }
    else $$('.barP', svg).forEach(b => b.classList.toggle('hi', +b.dataset.i === i));
  };
  const hide = () => { tip.hidden = true; cross.style.display = 'none'; hov.style.display = 'none'; $$('.barP', svg).forEach(b => b.classList.remove('hi')); };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerleave', hide);
}
function mountCharts(){
  const els = $$('[data-chart]'); if (!els.length) return;
  els.forEach(drawChart);
  const ro = new ResizeObserver(() => els.forEach(e => { if (Math.abs((e._w || 0) - e.clientWidth) > 4) { e._w = e.clientWidth; drawChart(e); } }));
  els.forEach(e => { e._w = e.clientWidth; ro.observe(e); }); cleanup.push(() => ro.disconnect());
}

// =====================================================================
// PLAYER: runs one of the two engine pages inside the notebook
// =====================================================================
function launch(cfg){ state.launch = { ch: 'c' + Math.random().toString(36).slice(2), ...cfg }; go('player'); }
function playerView(){
  const L = state.launch;
  if (!L) return `<p class="empty">Nothing to write yet. <a href="#/${state.user ? 'home' : ''}">Go back</a></p>`;
  const song = L.songId && DB.songs.find(s => s.id === L.songId);
  return `<button class="back" type="button" data-act="back">${IC.back} ${esc(L.backLabel || 'Back')}</button>
  <div class="player-head"><div><p class="eyebrow">${esc(L.eyebrow)}</p><h1>${esc(L.title)}</h1>${L.cite ? `<p class="cite" style="margin-top:4px">From <b>${esc(L.cite.title)}</b> by ${esc(L.cite.author)} (${L.cite.year}), Project Gutenberg${L.cite.live ? '' : ' · offline copy'}</p>` : ''}</div>
    <div class="row">${L.due ? `<span class="pill ${L.due - Date.now() < 2 * DAY ? 'warn' : ''}">${IC.clock}${relDue(L.due)} · ${fmtDate(L.due)}</span>` : ''}
      ${song ? `<span class="pill">${IC.music}${esc(song.title)} · ${song.bpm} BPM</span>` : L.bpm ? `<span class="pill">${IC.music}Built-in beat · ${L.bpm} BPM</span>` : ''}
      ${L.difficulty ? `<span class="pill">${DIFF[L.difficulty].label}</span>` : ''}${L.preview ? `<span class="pill ink">${IC.eye}Student preview · not saved</span>` : ''}${!state.user ? `<span class="pill ink">Guest demo · not saved</span>` : ''}</div></div>
  <div class="frame-wrap"><div class="loading" id="engineLoading"><span id="loadingMsg">Sharpening pencils<span class="dots"></span></span></div><iframe id="engine" title="FloWriter writing page" allow="autoplay"></iframe></div>`;
}
AFTER.player = () => {
  const L = state.launch; if (!L) return;
  const fr = $('#engine'), load = $('#engineLoading');
  const src = L.engine === 'assignment' ? ENGINE_ASSIGNMENT : ENGINE_FREEPLAY;
  const cfg = { ch: L.ch, word: L.word, lesson: L.lessonName, bpm: L.bpm, bps: L.bps, tol: L.tol, role: L.role, start: L.start, theme: currentTheme() };
  let css = '#themeBtn{display:none!important}.wrap{padding-block:18px 32px}';
  if (L.role === 'student') css += '#lockBtn{display:none!important}';
  if (L.engine === 'assignment') css += '#view-write>.view-head .eyebrow,#lessonTitle{display:none!important}';
  if (L.testLocked) css += '#testBtn{pointer-events:none!important;opacity:.45!important}';
  const inject = `<script>window.__FW=${JSON.stringify(cfg).replace(/</g, '\\u003c')}<\/script><script>${BRIDGE}<\/script>`;
  const cut = src.lastIndexOf('</body>');
  fr.srcdoc = src.slice(0, cut).replace('</head>', `<style id="fw-embed">${css}</style></head>`) + inject + src.slice(cut);
  let active = 0, lastRec = Date.now();
  const send = m => fr.contentWindow && fr.contentWindow.postMessage({ fwShell: 1, ...m }, '*');
  const onMsg = async e => {
    const m = e.data; if (!m || !m.fw || m.ch !== L.ch) return;
    if (m.type === 'h') fr.style.height = Math.max(640, m.h) + 'px';
    else if (m.type === 'ready') {
      const song = L.songId && DB.songs.find(s => s.id === L.songId);
      const file = song && (song.kind === 'starter' ? null : RUNTIME.songFiles[song.id]);
      if (song && song.kind === 'starter') {
        $('#loadingMsg').innerHTML = `Tuning up “${esc(song.title)}”<span class="dots"></span>`;
        try { const f = await Music.starterFile(song, L.word, L.bps || 1); send({ track: f }); } catch (err) { load.remove(); toast('This browser couldn’t make the song. Using the built-in beat.'); }
      } else if (file) { $('#loadingMsg').innerHTML = `Loading your MP3<span class="dots"></span>`; send({ track: file }); }
      else load.remove();
    }
    else if (m.type === 'trackReady' || m.type === 'trackFail') { const l = $('#engineLoading'); l && l.remove(); if (m.type === 'trackFail') toast('Couldn’t attach the song, so the built-in beat is on.'); }
    else if (m.type === 'view' && m.v === 'results') fr.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (m.type === 'active') active += 5;
    else if (m.type === 'result') onResult(L, m, Math.max(20, Math.min(active, (Date.now() - lastRec) / 1000))), active = 0, lastRec = Date.now();
  };
  addEventListener('message', onMsg); cleanup.push(() => removeEventListener('message', onMsg));
  const onTheme = () => send({ theme: currentTheme() }); addEventListener('fw-theme', onTheme); cleanup.push(() => removeEventListener('fw-theme', onTheme));
};
const MODE_LABEL = { test: 'Test', practice: 'Practice', check: 'On your own' };
function onResult(L, m, seconds){
  const a = m.total ? m.valid / m.total : 0, score = `<span class="big">${pct(a)}</span>`;
  const label = MODE_LABEL[m.mode] || 'Practice';
  if (!state.user || L.preview) { toast(`${score} ${label} · ${m.valid} of ${m.total} strokes${L.preview ? ' · preview, not saved' : ''}`); return; }
  // check attempts carry no tempo and no help level; both are recorded so the two can be compared later
  const rec = api.recordAttempt({ userId: state.user.id, source: L.source, assignmentId: L.assignmentId || null, lessonId: L.lessonId || null, module: L.module || null, mode: m.mode, gate: m.gate || null, text: m.word || L.word, valid: m.valid, total: m.total, bpm: m.mode === 'check' ? null : Math.round(m.bpm || L.bpm || 84), seconds: Math.round(seconds) });
  if (m.img) RUNTIME.traces[rec.id] = m.img;
  let extra = '';
  if (L.source === 'lesson' && m.mode === 'test') {
    if (a >= .9) { const before = L.unlockedCount, now = moduleState(state.user.id).filter(s => s.unlocked).length; extra = now > before ? ' · Lesson passed. New module unlocked!' : ' · Lesson passed!'; L.unlockedCount = now; }
    else extra = ' · 90% passes. Practice and try again.';
  } else if (L.source === 'assignment') extra = m.mode === 'test' ? ' · Test submitted to your teacher' : ' · Saved to your assignment';
  toast(`${score} ${label} · ${m.valid} of ${m.total} strokes valid${extra}`, 4200);
}

// ---------- launching things ----------
function openLesson(id){
  const u = state.user, f = findLesson(id); if (!f) return;
  const st = moduleState(u.id).find(s => s.module.id === f.module.id); if (!st.unlocked) { toast('Finish the module before this one to unlock it.'); return; }
  const ex = f.lesson.excerpt != null;
  const start = cite => launch({ engine: 'assignment', role: 'student', source: 'lesson', lessonId: id, module: f.module.id, eyebrow: `${f.module.title} · lesson`, title: ex ? cite.title : f.lesson.title, lessonName: ex ? cite.title : `${f.module.title}: ${f.lesson.title}`,
    word: cleanText(ex ? cite.text : f.lesson.text), bpm: f.module.id === 'letters' ? 72 : 84, songId: f.module.id === 'letters' ? 'sg_paper' : 'sg_sunny', bps: 1, cite: ex ? cite : null, back: 'learn', backLabel: 'Back to lessons', unlockedCount: moduleState(u.id).filter(s => s.unlocked).length });
  if (ex) api.fetchExcerpt(f.lesson.excerpt).then(start); else start();
}
function openAssignment(id, asTeacherPreview){
  const a = DB.assignments.find(a => a.id === id); if (!a) return;
  const u = state.user;
  if (!asTeacherPreview && Date.now() > a.due) { toast(`${IC.lock.replace('<svg', '<svg style="width:18px;height:18px"')} This assignment locked on ${fmtDate(a.due)}.`); return; }
  const sub = !asTeacherPreview && submission(u.id, a.id), d = DIFF[a.difficulty || 'standard'];
  launch({ engine: 'assignment', role: 'student', source: 'assignment', assignmentId: a.id, module: a.module, eyebrow: `Assignment · ${a.kind === 'test' ? 'Test' : 'Practice'}`, title: a.title, lessonName: a.title, word: cleanText(a.text),
    bpm: a.bpm, songId: a.songId, bps: d.bps, tol: d.tol, difficulty: a.difficulty || 'standard', due: a.due, testLocked: a.kind === 'practice' || (a.kind === 'test' && sub && sub.mode === 'test'),
    preview: !!asTeacherPreview, back: asTeacherPreview ? 'teach' : 'home', backLabel: asTeacherPreview ? 'Back to class' : 'Back to home' });
}

// =====================================================================
// TEACHER
// =====================================================================
function myClasses(){ return DB.classes.filter(c => c.teacherId === state.user.id); }
function classStudents(cid){ return DB.users.filter(u => u.classId === cid && u.role === 'student'); }
function teachView(q){
  const T = state.teach, classes = myClasses();
  if (q.get('c')) T.classId = q.get('c');
  if (!classes.some(c => c.id === T.classId)) T.classId = (classes.find(c => !c.archived) || classes[0] || {}).id;
  const cls = classes.find(c => c.id === T.classId);
  if (!cls) return `<div class="page-head"><div><h1>Your classes</h1></div></div><div class="panel"><p class="empty">No class periods yet.</p><button class="btn primary" type="button" data-act="new-class">${IC.plus} Add a class period</button></div>`;
  const kids = classStudents(cls.id), as = DB.assignments.filter(a => a.classId === cls.id).sort((a, b) => b.due - a.due);
  const rows = kids.map(k => ({ k, s: statsFor(k.id), done: as.filter(a => (!a.studentIds || a.studentIds.includes(k.id)) && submission(k.id, a.id)).length, total: as.filter(a => !a.studentIds || a.studentIds.includes(k.id)).length })).sort((a, b) => a.k.name.localeCompare(b.k.name));
  const avg = rows.length ? rows.reduce((t, r) => t + r.s.avg, 0) / rows.length : 0, help = rows.filter(r => r.s.avg < .75).length;
  const openA = as.filter(a => a.due > Date.now()).length;
  return `<div class="page-head"><div><p class="eyebrow">Teacher dashboard</p><h1>${esc(state.user.name)}’s classes</h1></div>
    <a class="btn primary" href="#/assign?c=${cls.id}">${IC.plus} New assignment</a></div>
  <div class="class-bar">
    <label for="classSel" class="sr-only">Class period</label>
    <select class="input" id="classSel" data-act="class-select">${classes.map(c => `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.name)}${c.archived ? ' (archived)' : ''}</option>`).join('')}</select>
    <span class="note">Class code</span><span class="code" id="codeTxt">${esc(cls.code)}</span>
    <button class="btn sm" type="button" data-act="copy-code">${IC.copy} Copy</button>
    <button class="btn sm" type="button" data-act="regen-code">${IC.refresh} New code</button>
    <span class="spacer"></span>
    <button class="btn sm" type="button" data-act="new-class">${IC.plus} Add period</button>
    <button class="btn sm ghost" type="button" data-act="archive-class">${IC.archive} ${cls.archived ? 'Unarchive' : 'Archive'}</button>
  </div>
  ${cls.archived ? `<p class="pill warn" style="margin-bottom:16px">This period is archived. Students can’t join with its code.</p>` : ''}
  <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:22px">
    <div class="kpi"><span class="k">Students</span><span class="n">${kids.length}</span><span class="t">joined with ${esc(cls.code)}</span></div>
    <div class="kpi"><span class="k">Class accuracy</span><span class="n">${Math.round(avg * 100)}<small>%</small></span><span class="t">average of all attempts</span></div>
    <div class="kpi"><span class="k">Open assignments</span><span class="n">${openA}</span><span class="t">${as.length - openA} closed</span></div>
    <div class="kpi"><span class="k">Need a hand</span><span class="n" style="color:${help ? 'var(--bad)' : 'inherit'}">${help}</span><span class="t">below 75% accuracy</span></div>
  </div>
  <div class="subtabs" role="tablist">${[['students', 'Students'], ['assignments', 'Assignments']].map(([k, l]) => `<button role="tab" type="button" data-act="teach-tab" data-k="${k}" aria-selected="${T.tab === k}">${l}</button>`).join('')}</div>
  ${T.tab === 'students' ? `<div class="table-wrap"><table>
    <thead><tr><th>Student</th><th>Last active</th><th>Accuracy</th><th>Words learned</th><th>Best BPM</th><th>Assignments</th><th>Module</th></tr></thead>
    <tbody>${rows.map(({ k, s, done, total }) => { const ms = moduleState(k.id), cur = ms.find(m => m.unlocked && !m.done) || ms[ms.length - 1];
      return `<tr class="click" data-act="student" data-id="${k.id}" tabindex="0"><td><div class="name-cell"><span class="avatar" aria-hidden="true">${esc(initials(k))}</span><span><b>${esc(k.name)}</b><small>${esc(k.username)}</small></span></div></td>
      <td class="num">${s.last ? fmtShort(s.last) : '—'}</td>
      <td><div class="mini"><div class="meter acc"><i style="width:${s.avg * 100}%;background:${s.avg < .75 ? 'var(--bad)' : s.avg >= .9 ? 'var(--ok)' : 'var(--accent)'}"></i></div><span class="num">${pct(s.avg)}</span></div></td>
      <td class="num">${s.learned.size}</td><td class="num">${s.best ? s.best.bpm : '—'}</td><td class="num">${done} / ${total}</td><td>${esc(cur.module.title)}</td></tr>`; }).join('') || `<tr><td colspan="7"><p class="empty">No students yet. Share the code ${esc(cls.code)}.</p></td></tr>`}</tbody></table></div>`
  : `<div class="table-wrap"><table>
    <thead><tr><th>Assignment</th><th>For</th><th>Due</th><th>Music</th><th>Difficulty</th><th>Turned in</th><th></th></tr></thead>
    <tbody>${as.map(a => { const target = a.studentIds ? a.studentIds.length : kids.length, inn = (a.studentIds || kids.map(k => k.id)).filter(id => submission(id, a.id)).length, closed = Date.now() > a.due, song = DB.songs.find(s => s.id === a.songId);
      return `<tr><td><b>${esc(a.title)}</b><br><span class="note">${a.kind === 'test' ? 'Test' : 'Practice'} · ${esc((CURRICULUM.find(m => m.id === a.module) || {}).title || 'Custom')} · “${esc(a.text.length > 28 ? a.text.slice(0, 26) + '…' : a.text)}”</span></td>
        <td>${a.studentIds ? a.studentIds.map(id => esc((DB.users.find(u => u.id === id) || {}).name || '?')).join(', ') : 'Whole period'}</td>
        <td>${closed ? `<span class="pill">${IC.lock}Locked</span>` : `<span class="pill ${a.due - Date.now() < 2 * DAY ? 'warn' : ''}">${relDue(a.due).replace(/,.*/, '')}</span>`}<br><span class="note">${fmtDate(a.due)}</span></td>
        <td>${esc(song ? song.title : 'Built-in beat')}<br><span class="note">${a.bpm} BPM</span></td><td>${DIFF[a.difficulty || 'standard'].label}</td>
        <td><div class="mini"><div class="meter"><i style="width:${target ? inn / target * 100 : 0}%"></i></div><span class="num">${inn}/${target}</span></div></td>
        <td><div class="acts"><button class="btn sm" type="button" data-act="preview-a" data-id="${a.id}" title="Preview as student">${IC.eye}</button><a class="btn sm" href="#/assign?c=${cls.id}&id=${a.id}" title="Edit">${IC.edit}</a><button class="btn sm" type="button" data-act="extend" data-id="${a.id}" title="Extend 2 days">+2d</button><button class="btn sm danger" type="button" data-act="delete-a" data-id="${a.id}" title="Delete">${IC.trash}</button></div></td></tr>`; }).join('') || `<tr><td colspan="7"><p class="empty">No assignments yet.</p></td></tr>`}</tbody></table></div>`}`;
}
function traceFor(att){
  if (RUNTIME.traces[att.id]) return RUNTIME.traces[att.id];
  const c = document.createElement('canvas'), W = 560, H = 170; c.width = W; c.height = H; const g = c.getContext('2d');
  const cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim();
  g.fillStyle = col('--sheet'); g.fillRect(0, 0, W, H);
  [[46, col('--rule'), []], [86, col('--rule'), [6, 6]], [118, col('--rule'), []]].forEach(([y, cc, d]) => { g.setLineDash(d); g.strokeStyle = cc; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); });
  g.setLineDash([]); g.strokeStyle = col('--margin'); g.beginPath(); g.moveTo(20, 0); g.lineTo(20, H); g.stroke();
  const text = att.text.length > 26 ? att.text.slice(0, 25) + '…' : att.text; let size = 72; g.font = `700 ${size}px "Dancing Script", cursive`;
  while (g.measureText(text).width > W - 60 && size > 26) { size -= 4; g.font = `700 ${size}px "Dancing Script", cursive`; }
  const x0 = 34; g.setLineDash([3, 6]); g.strokeStyle = col('--missed'); g.lineWidth = 1.2; g.strokeText(text, x0, 118); g.setLineDash([]);
  const r = rng(att.date % 100000), a = att.total ? att.valid / att.total : 0; let x = x0;
  [...text].forEach(ch => { const w = g.measureText(ch).width; const good = r() < a + .05; g.save(); g.translate((r() - .5) * (good ? 2 : 7), (r() - .5) * (good ? 2 : 8)); g.fillStyle = good ? col('--ok') : col('--bad'); g.globalAlpha = .85; g.fillText(ch, x, 118); g.restore(); x += w; });
  return RUNTIME.traces[att.id] = c.toDataURL('image/png');
}
function studentDrawer(id){
  const k = DB.users.find(u => u.id === id), s = statsFor(k.id), ms = moduleState(k.id), as = assignmentsFor(k);
  const recent = s.attempts.filter(a => a.source === 'assignment' || RUNTIME.traces[a.id]).slice(-4).reverse();
  openOverlay(`<aside class="drawer" role="dialog" aria-label="${esc(k.name)} progress">
    <div class="row"><span class="avatar" style="width:52px;height:52px;font-size:28px">${esc(initials(k))}</span><div><h2 style="font-size:24px">${esc(k.name)}</h2><p class="note">${esc(k.username)} · joined ${fmtShort(k.joined)}</p></div><button class="icon-btn spacer" type="button" data-act="close-overlay" aria-label="Close">${IC.x}</button></div>
    <div class="kpis"><div class="kpi"><span class="k">Accuracy</span><span class="n">${Math.round(s.avg * 100)}<small>%</small></span></div><div class="kpi"><span class="k">Words learned</span><span class="n">${s.learned.size}</span></div><div class="kpi"><span class="k">Time writing</span><span class="n" style="font-size:28px">${fmtDur(s.seconds)}</span></div></div>
    <section class="panel"><h2 style="font-size:16px">Curriculum</h2>${ms.map(m => `<div><div class="row" style="justify-content:space-between;font-size:14px"><b>${esc(m.module.title)}</b><span class="note">${m.unlocked ? `${m.passed}/${m.total} tests passed` : 'Locked'}</span></div><div class="meter" style="margin-top:4px"><i style="width:${m.passed / m.total * 100}%"></i></div></div>`).join('')}</section>
    <section class="panel"><h2 style="font-size:16px">Assignments</h2><div class="todo">${as.map(a => { const sub = submission(k.id, a.id); return `<div class="todo-item" style="grid-template-columns:minmax(0,1fr) auto"><span><span class="t" style="font-size:15px">${esc(a.title)}</span><span class="m" style="display:block">${a.kind === 'test' ? 'Test' : 'Practice'} · ${fmtShort(a.due)}</span></span><span class="r">${sub ? `<span class="pill ${acc(sub) >= .9 ? 'ok' : 'warn'}">${pct(acc(sub))} · ${sub.valid}/${sub.total}</span>` : Date.now() > a.due ? '<span class="pill bad">Missed</span>' : '<span class="pill">Not started</span>'}</span></div>`; }).join('') || '<p class="note">No assignments.</p>'}</div></section>
    <section class="panel"><h2 style="font-size:16px">Recent traces</h2><div class="traces">${recent.map(a => `<figure class="trace" style="margin:0"><img src="${traceFor(a)}" alt="Trace of ${esc(a.text)}"><figcaption><span>${a.mode === 'test' ? 'Test' : 'Practice'} · ${fmtShort(a.date)}</span><b style="color:${acc(a) >= .9 ? 'var(--ok)' : 'var(--accent-ink)'}">${pct(acc(a))}</b></figcaption></figure>`).join('') || '<p class="note">No traces yet.</p>'}</div><p class="note">Green letters stayed inside the margin on the beat. Red ones strayed or were late.</p></section>
    <div class="row"><a class="btn primary" href="#/assign?c=${k.classId}&student=${k.id}">${IC.plus} Assign to ${esc(k.name.split(' ')[0])}</a><button class="btn danger spacer" type="button" data-act="remove-student" data-id="${k.id}">Remove from class</button></div>
  </aside>`);
}
function assignView(q){
  const classes = myClasses().filter(c => !c.archived), cid = q.get('c') || state.teach.classId || (classes[0] || {}).id, a = q.get('id') ? DB.assignments.find(x => x.id === q.get('id')) : null;
  const kids = classStudents(a ? a.classId : cid), only = q.get('student');
  const d = a || { title: '', classId: cid, kind: 'practice', module: 'three', text: 'cat dog pig hen', due: (() => { const t = new Date(Date.now() + 7 * DAY); t.setHours(15, 30, 0, 0); return t.getTime(); })(), difficulty: 'standard', songId: 'sg_sunny', studentIds: only ? [only] : null };
  const songs = DB.songs.filter(s => s.kind === 'starter' || s.ownerId === state.user.id);
  return `<a class="back" href="#/teach">${IC.back} Back to class</a>
  <div class="page-head"><div><p class="eyebrow">${a ? 'Edit assignment' : 'New assignment'}</p><h1>${a ? esc(a.title) : 'Assign a module'}</h1><p class="note">Pick the module content, the music, a due date, and who gets it. Assignments lock automatically after the due date.</p></div></div>
  <form class="stack" data-form="assign" novalidate style="max-width:900px">
    <input type="hidden" name="id" value="${a ? a.id : ''}">
    <section class="panel lift"><div class="two">
      <div class="field"><label for="asTitle">Title</label><input class="input" id="asTitle" name="title" required value="${esc(d.title)}" placeholder="Animal words"></div>
      <div class="field"><label for="asClass">Class period</label><select class="input" id="asClass" name="classId" data-act="as-class">${classes.map(c => `<option value="${c.id}" ${c.id === (a ? a.classId : cid) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="asModule">Module</label><select class="input" id="asModule" name="module" data-act="as-module">${CURRICULUM.map(m => `<option value="${m.id}" ${m.id === d.module ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl" id="kindL">Type</span><div class="seg" role="group" aria-labelledby="kindL">${[['practice', 'Practice'], ['test', 'Test']].map(([v, l]) => `<button type="button" data-act="as-kind" data-v="${v}" aria-pressed="${d.kind === v}">${l}</button>`).join('')}</div><input type="hidden" name="kind" value="${d.kind}"><small>Practice: music waits when the pen lifts. Test: one try, the music keeps going.</small></div>
    </div></section>
    <section class="panel lift">
      <div class="field"><label for="asText">Test content</label><textarea class="input" id="asText" name="text" maxlength="300" required>${esc(d.text)}</textarea><small>Letters A to Z and . , ! ? ' · Or pick a lesson from the module:</small></div>
      <div class="row" id="asLessons">${lessonChips(d.module)}</div>
    </section>
    <section class="panel lift"><div class="two">
      <div class="field"><label for="asDue">Due date</label><input class="input" id="asDue" name="due" type="datetime-local" required value="${toLocalInput(d.due)}"></div>
      <div class="field"><span class="lbl" id="difL">Difficulty</span><div class="seg" role="group" aria-labelledby="difL">${Object.entries(DIFF).map(([k, v]) => `<button type="button" data-act="as-diff" data-v="${k}" aria-pressed="${(d.difficulty || 'standard') === k}">${v.label}</button>`).join('')}</div><input type="hidden" name="difficulty" value="${d.difficulty || 'standard'}"><small>Easy: 2 beats per stroke, wide margin. Challenge: 1 beat, tight margin.</small></div>
    </div></section>
    <section class="panel lift"><div class="panel-head"><h2>Music</h2><span class="note">The BPM is detected when you upload</span></div>
      <input type="hidden" name="songId" value="${d.songId}">
      <div class="library" style="max-height:260px" id="asSongs">${songs.map(s => songRow(s, s.id === d.songId, 'as-song')).join('')}</div>
      <div class="upload"><label class="btn" for="asUpload">${IC.upload} Upload an MP3</label><input id="asUpload" class="sr-only" type="file" accept=".mp3,audio/mpeg" data-upload="assign"><span class="note" id="asUpNote">MP3 only.</span></div>
    </section>
    <section class="panel lift"><div class="field"><span class="lbl">Assign to</span>
      <label class="check"><input type="radio" name="target" value="all" ${!d.studentIds ? 'checked' : ''}> The whole period</label>
      <label class="check"><input type="radio" name="target" value="some" ${d.studentIds ? 'checked' : ''}> Only these students</label>
      <div class="checks" id="asKids">${kids.map(k => `<label class="check"><input type="checkbox" name="kid" value="${k.id}" ${d.studentIds && d.studentIds.includes(k.id) ? 'checked' : ''}> ${esc(k.name)}</label>`).join('') || '<span class="note">No students in this period yet.</span>'}</div></div></section>
    <p class="form-error" id="asErr" role="alert"></p>
    <div class="row"><button class="btn primary lg" type="submit">${a ? 'Save changes' : 'Assign'}</button><button class="btn lg" type="button" data-act="as-preview">${IC.eye} Preview as a student</button><a class="btn lg ghost" href="#/teach">Cancel</a></div>
  </form>`;
}
function lessonChips(mid){ const m = CURRICULUM.find(m => m.id === mid); return m.lessons.map(l => `<button class="chip" type="button" data-act="as-lesson" data-text="${esc(lessonText(l))}">${esc(l.excerpt != null ? EXCERPTS[l.excerpt].title : l.title)}</button>`).join(''); }
function readAssignForm(){
  const f = $('form[data-form="assign"]'), fd = new FormData(f), err = $('#asErr'); err.textContent = '';
  const song = DB.songs.find(s => s.id === fd.get('songId'));
  const kids = fd.getAll('kid'), target = fd.get('target');
  const a = { id: fd.get('id') || undefined, title: (fd.get('title') || '').trim(), classId: fd.get('classId'), module: fd.get('module'), kind: fd.get('kind'), text: cleanText(fd.get('text')), due: new Date(fd.get('due')).getTime(), difficulty: fd.get('difficulty'), songId: song ? song.id : null, bpm: song ? song.bpm : 84, studentIds: target === 'some' ? kids : null };
  if (!a.title) { err.textContent = 'Give the assignment a title.'; $('#asTitle').focus(); return null; }
  if (!a.text) { err.textContent = 'Add the words to write.'; $('#asText').focus(); return null; }
  if (!a.due || isNaN(a.due)) { err.textContent = 'Pick a due date.'; return null; }
  if (target === 'some' && !kids.length) { err.textContent = 'Pick at least one student, or assign the whole period.'; return null; }
  return a;
}
function ranksView(q){
  const classes = myClasses(), cid = q.get('c') || state.teach.classId || classes[0].id, cls = classes.find(c => c.id === cid);
  return `<div class="page-head"><div><p class="eyebrow">Class rankings</p><h1>${esc(cls.name)}</h1><p class="note">Three leaderboards. The speed board ranks only students with 90%+ accuracy on their best-BPM song; ties go to whoever got there first.</p></div>
    <select class="input" style="width:auto" data-act="rank-class" aria-label="Class period">${classes.map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
  <div class="boards">${boardPanel(cid, null, 'time')}${boardPanel(cid, null, 'words')}${boardPanel(cid, null, 'bpm')}</div>`;
}

// ---------- uploads (MP3 only, BPM auto-detected) ----------
async function handleUpload(input){
  const file = input.files[0]; input.value = ''; if (!file) return;
  const note = input.dataset.upload === 'free' ? $('#fpUpNote') : $('#asUpNote');
  if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') { note.textContent = `“${file.name}” isn’t an MP3. Only MP3 files can be added.`; note.style.color = 'var(--bad)'; return; }
  note.style.color = ''; note.textContent = `Listening for the beat in ${file.name}…`;
  try {
    const r = await Music.detectBpm(file);
    const s = api.addSong({ id: uid('sg_'), title: file.name.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').slice(0, 40), artist: state.user.username, bpm: Math.round(r.bpm), style: 'Your upload', mood: 'bright', kind: 'upload', ownerId: state.user.id, hue: Math.floor(Math.random() * 360) });
    RUNTIME.songFiles[s.id] = file;
    if (input.dataset.upload === 'free') { state.play.songId = s.id; rerender(); toast(`Added “${esc(s.title)}” · ${s.bpm} BPM ${r.from === 'name' ? 'from the file name' : 'detected'}`); }
    else { $('#asSongs').insertAdjacentHTML('beforeend', songRow(s, false, 'as-song')); pickAsSong(s.id); $('#asUpNote').textContent = `Added · ${s.bpm} BPM detected`; }
  } catch (e) { note.textContent = 'That file couldn’t be read as audio.'; note.style.color = 'var(--bad)'; }
}
function pickAsSong(id){ $('input[name="songId"]').value = id; $$('#asSongs .song').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.id === id))); }

// =====================================================================
// EVENTS
// =====================================================================
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, id = t.dataset.id;
  if (act === 'close-overlay') { if (e.target === t || t.tagName === 'BUTTON') closeOverlay(); return; }
  switch (act) {
    case 'theme': { const n = currentTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('flowriter-theme', n); } catch (err) {} t.innerHTML = n === 'dark' ? IC.sun : IC.moon; dispatchEvent(new Event('fw-theme')); $$('[data-chart]').forEach(drawChart); break; }
    case 'logout': if (api.logout) api.logout(); setSession(null); state.launch = null; go(''); break;
    case 'portrait-ok': document.body.classList.add('portrait-ok'); break;
    case 'quick-login': { const f = $('form[data-form="login"]'); if (f) { f.id.value = t.dataset.u; f.password.value = t.dataset.p; submitForm('login', f); } else { const u = await api.login(t.dataset.u, t.dataset.p); setSession(u, true); go(u.role === 'teacher' ? 'teach' : 'home'); } break; }
    case 'role': { const r = t.dataset.role; $('input[name="role"]').value = r; $$('[data-act="role"]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); $('#suStudent').hidden = r !== 'student'; $('#suTeacher').hidden = r !== 'teacher'; break; }
    case 'guest-demo': launch({ engine: 'freeplay', role: 'guest', start: 'write', source: 'free', eyebrow: 'Guest demo · Free Play', title: 'Write “hello” to the beat', word: 'hello', bpm: 84, bps: 1, songId: 'sg_sunny', back: '', backLabel: 'Back to FloWriter' }); break;
    case 'back': go(state.launch ? state.launch.back : 'home'); break;
    case 'nav': go(t.dataset.to); break;
    case 'open-assignment': openAssignment(id); break;
    case 'open-lesson': openLesson(id); break;
    case 'preview': e.stopPropagation(); { const s = DB.songs.find(s => s.id === id); const r = await Music.preview(s, RUNTIME.songFiles[id]); $$('.disc').forEach(d => { const on = d.dataset.id === r; d.classList.toggle('on', on); d.innerHTML = on ? IC.pause : IC.play; }); } break;
    case 'pick-song': { state.play.songId = id; const s = DB.songs.find(s => s.id === id); state.play.text = pick(Math.random, FREE_TEXTS[s.mood || 'bright']); if (s.bpm > 110) state.play.bps = 2; rerender(); break; }
    case 'text-mode': state.play.textMode = t.dataset.mode; rerender(); break;
    case 'shuffle': { const s = DB.songs.find(s => s.id === state.play.songId) || DB.songs[0]; const pool = FREE_TEXTS[s.mood || 'bright'].concat(Object.values(FREE_TEXTS).flat()).filter(x => x !== state.play.text); state.play.text = pick(Math.random, pool); rerender(); break; }
    case 'bps': state.play.bps = +t.dataset.n; rerender(); break;
    case 'start-free': { const P = state.play, s = DB.songs.find(s => s.id === P.songId), text = cleanText(P.textMode === 'own' ? P.own : P.text); if (!text) return;
      launch({ engine: 'freeplay', role: 'student', start: 'write', source: 'free', eyebrow: 'Free Play', title: text.length > 40 ? text.slice(0, 38) + '…' : text, word: text, bpm: s.bpm, bps: P.bps, songId: s.id, back: 'play', backLabel: 'Back to Free Play' }); break; }
    case 'freewrite': launch({ engine: 'freeplay', role: 'teacher', source: 'free', eyebrow: 'Free Play', title: 'Free write', word: null, back: 'play', backLabel: 'Back to Free Play' }); break;
    case 'range': state.stats.range = t.dataset.k; rerender(); break;
    case 'scope': state.stats.scope = t.dataset.k; rerender(); break;
    case 'teach-tab': state.teach.tab = t.dataset.k; rerender(); break;
    case 'student': studentDrawer(id); break;
    case 'copy-code': { const c = $('#codeTxt').textContent; try { await navigator.clipboard.writeText(c); toast(`Copied ${c}`); } catch (err) { toast(`Class code: ${c}`); } break; }
    case 'regen-code': { const c = api.regenCode(state.teach.classId); rerender(); toast(`New class code: <span class="big">${c}</span> The old one stops working.`); break; }
    case 'archive-class': { const c = DB.classes.find(c => c.id === state.teach.classId); api.archiveClass(c.id, !c.archived); rerender(); toast(c.archived ? 'Period archived' : 'Period restored'); break; }
    case 'new-class': openOverlay(`<form class="modal" data-form="new-class" novalidate><h2>Add a class period</h2><div class="field"><label for="ncName">Name</label><input class="input" id="ncName" name="name" placeholder="Period 7 · 3rd grade" required></div><p class="note">We’ll make a 6-character code students use to join.</p><p class="form-error" role="alert"></p><div class="row"><button class="btn primary" type="submit">Create period</button><button class="btn" type="button" data-act="close-overlay">Cancel</button></div></form>`, true); break;
    case 'remove-student': { const k = DB.users.find(u => u.id === id); if (!confirm(`Remove ${k.name} from this period? Their history stays with their account.`)) return; api.removeStudent(id); closeOverlay(); rerender(); toast(`${esc(k.name)} removed`); break; }
    case 'extend': api.extendAssignment(id, 2); rerender(); toast('Due date moved 2 days later'); break;
    case 'delete-a': { const a = DB.assignments.find(a => a.id === id); if (!confirm(`Delete “${a.title}”? Students lose it from their to-do list.`)) return; api.deleteAssignment(id); rerender(); toast('Assignment deleted'); break; }
    case 'preview-a': openAssignment(id, true); break;
    case 'as-kind': case 'as-diff': { const name = act === 'as-kind' ? 'kind' : 'difficulty'; $(`input[name="${name}"]`).value = t.dataset.v; $$(`[data-act="${act}"]`).forEach(b => b.setAttribute('aria-pressed', String(b === t))); break; }
    case 'as-lesson': $('#asText').value = t.dataset.text; if (!$('#asTitle').value) $('#asTitle').value = t.textContent; break;
    case 'as-song': if (e.target.closest('.disc')) return; pickAsSong(id); break;
    case 'as-preview': { const a = readAssignForm(); if (!a) return; const d = DIFF[a.difficulty];
      launch({ engine: 'assignment', role: 'teacher', source: 'assignment', eyebrow: 'Preview · Assignment setup', title: a.title, lessonName: a.title, word: a.text, bpm: a.bpm, songId: a.songId, bps: d.bps, tol: d.tol, difficulty: a.difficulty, due: a.due, preview: true, back: 'teach', backLabel: 'Back to class' }); break; }
  }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act],tr[data-act]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.upload) handleUpload(t);
  else if (t.dataset.act === 'class-select') { state.teach.classId = t.value; go('teach?c=' + t.value); }
  else if (t.dataset.act === 'rank-class') { state.teach.classId = t.value; go('ranks?c=' + t.value); }
  else if (t.dataset.act === 'as-module') $('#asLessons').innerHTML = lessonChips(t.value);
  else if (t.dataset.act === 'as-class') { const kids = classStudents(t.value); $('#asKids').innerHTML = kids.map(k => `<label class="check"><input type="checkbox" name="kid" value="${k.id}"> ${esc(k.name)}</label>`).join('') || '<span class="note">No students in this period yet.</span>'; }
  else if (t.name === 'kid' && t.checked) { const r = $('input[name="target"][value="some"]'); r && (r.checked = true); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.type === 'password' && t.closest('form') && t.closest('form').querySelector('.rules') && (t.name === 'password')) paintRules(t);
  if (t.id === 'fpOwn') { const c = t.value.replace(/[^A-Za-z.,!?' \n]/g, ''); if (c !== t.value) t.value = c; state.play.own = t.value; const b = $('[data-act="start-free"]'); b && (b.disabled = !cleanText(t.value)); }
});
document.addEventListener('submit', e => {
  const f = e.target, name = f.dataset.form; if (!name) return; e.preventDefault();
  if (name === 'assign') { const a = readAssignForm(); if (!a) return; api.saveAssignment(a); state.teach.classId = a.classId; state.teach.tab = 'assignments'; toast(a.id ? 'Assignment updated' : `Assigned “${esc(a.title)}”`); go('teach?c=' + a.classId); return; }
  if (name === 'new-class') { const n = f.name.value.trim(); if (!n) { f.querySelector('.form-error').textContent = 'Name the period.'; return; } const c = api.addClass(state.user, n); closeOverlay(); state.teach.classId = c.id; go('teach?c=' + c.id); setTimeout(() => toast(`Created ${esc(c.name)} · code <span class="big">${c.code}</span>`, 5000), 50); return; }
  submitForm(name, f);
});

// Boot. With a backend configured, the Supabase session is the source of
// truth and the first render waits for it; otherwise this is the demo DB.
if (typeof Backend !== 'undefined' && Backend.enabled) {
  Backend.boot()
    .catch(e => {
      console.error('[flowriter] boot', e);
      // a bad URL/key, an offline network or a blocked CDN lands here: say so
      // plainly rather than showing an empty page
      setTimeout(() => toast('Could not reach the FloWriter server. Check config.js and your connection.', 8000), 400);
    })
    .then(() => render());
} else {
  restoreSession();
  render();
}
