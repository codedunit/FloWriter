// =====================================================================
// FloWriter app core: helpers, routing, layout, shared components, and the
// bridge to the tracing engine.
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = v => v == null ? '–' : Math.round(v * 100) + '%';
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtShort = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTime = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtMin = s => { s = Math.round(s || 0); if (s < 60) return s ? '<1 min' : '0 mins'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} hr${h > 1 ? 's' : ''} ${m} mins` : `${m} min${m === 1 ? '' : 's'}`; };
const fmtAgo = d => { if (!d) return 'Never'; const s = (Date.now() - d) / 1000; if (s < 90) return 'Just now'; if (s < 3600) return Math.round(s / 60) + ' mins ago'; if (s < 86400) return Math.round(s / 3600) + ' hrs ago'; const n = Math.round(s / 86400); return n === 1 ? 'Yesterday' : n + ' days ago'; };
const initials = u => (u.name || u.username || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const cleanText = raw => (raw || '').replace(/\s+/g, ' ').replace(/[^A-Za-z.,!?' ]/g, '').replace(/ {2,}/g, ' ').trim().slice(0, 300);
const firstName = u => (u.name || u.username).split(' ')[0];
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const relDue = due => { if (!due) return 'No due date'; const d = due - Date.now(); if (d < 0) return `Was due ${fmtShort(due)}`; const n = Math.ceil(d / DAY); return n <= 1 ? 'Due today' : n === 2 ? 'Due tomorrow' : `Due in ${n} days`; };
const toLocalInput = ms => { if (!ms) return ''; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const themeImg = id => (typeof THEME_IMG !== 'undefined' && THEME_IMG[id]) || '';

// ---------- icons ----------
const I = p => `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = {
  dash: I('<path d="M10 17a7 7 0 1 1 7-7"/><path d="M10 10l3.5-3"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/>'),
  live: I('<circle cx="10" cy="10" r="2"/><path d="M6.2 13.8a5.4 5.4 0 0 1 0-7.6M13.8 6.2a5.4 5.4 0 0 1 0 7.6M3.6 16.4a9 9 0 0 1 0-12.8M16.4 3.6a9 9 0 0 1 0 12.8"/>'),
  users: I('<circle cx="7.5" cy="7" r="3"/><path d="M2 17c.5-3 2.7-4.5 5.5-4.5S12.5 14 13 17M13 4.2a3 3 0 0 1 0 5.6M15 12.8c1.6.6 2.6 2 3 4.2"/>'),
  book: I('<path d="M3 4.5c2.5-1 5-1 7 .5v11.5c-2-1.5-4.5-1.5-7-.5zM17 4.5c-2.5-1-5-1-7 .5v11.5c2-1.5 4.5-1.5 7-.5z"/>'),
  music: I('<path d="M7.5 15V5l9-2v10"/><circle cx="5.5" cy="15" r="2"/><circle cx="14.5" cy="13" r="2"/>'),
  home: I('<path d="M3 9.5 10 3.5l7 6V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z"/>'),
  chart: I('<path d="M3 17h14M5.5 14V9M10 14V5M14.5 14v-3"/>'),
  pen: I('<path d="M13.5 3.5l3 3L7 16H4v-3zM11.5 5.5l3 3"/>'),
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="11.5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
  check: I('<path d="M4.5 10.5 8 14l7.5-8"/>'),
  lock: I('<rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>'),
  arrow: I('<path d="M4 10h12M11 5l5 5-5 5"/>'),
  back: I('<path d="M16 10H4M9 5l-5 5 5 5"/>'),
  left: I('<path d="M12 4 6 10l6 6"/>'), right: I('<path d="M8 4l6 6-6 6"/>'),
  plus: I('<path d="M10 4v12M4 10h12"/>'),
  copy: I('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>'),
  link: I('<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>'),
  refresh: I('<path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3v4h-4"/>'),
  trash: I('<path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6"/>'),
  edit: I('<path d="M13.5 3.5l3 3L7 16H4v-3z"/>'),
  eye: I('<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>'),
  x: I('<path d="M5 5l10 10M15 5 5 15"/>'),
  search: I('<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/>'),
  gear: I('<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>'),
  out: I('<path d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8M13 14l4-4-4-4M17 10H8"/>'),
  upload: I('<path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 16.5h13"/>'),
  download: I('<path d="M10 3.5V13M6 9l4 4 4-4M3.5 16.5h13"/>'),
  bolt: I('<path d="M11 2.5 4.5 11h5L9 17.5 15.5 9h-5z"/>'),
  clock: I('<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>'),
  trend: I('<path d="M3 14l4.5-4.5 3 3L17 6M12.5 6H17v4.5"/>'),
  star: I('<path d="M10 2.8l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 8l5-.6z"/>'),
  flag: I('<path d="M4 17V3.5M4 4h10l-2 3.5 2 3.5H4"/>'),
  sparkle: I('<path d="M10 3v4M10 13v4M3 10h4M13 10h4M5.5 5.5l2 2M12.5 12.5l2 2M5.5 14.5l2-2M12.5 7.5l2-2"/>'),
  door: I('<path d="M4 17V3h9v14M13 17h3M10 10h.01"/>'),
  shield: I('<path d="M10 2.5 4 5v5c0 3.7 2.6 6.4 6 7.5 3.4-1.1 6-3.8 6-7.5V5z"/><path d="M7.5 10l2 2 3.5-4"/>'),
  sun: I('<circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M4.2 15.8l1.6-1.6M14.2 5.8l1.6-1.6"/>'),
  moon: I('<path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z"/>'),
};

// ---------- cursive as SVG (wordmark) ----------
function cursiveSVG(text, { xh = 12, stroke = 2.2, cls = '' } = {}){
  const L = Cursive.build(text), pad = stroke + 2;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  L.strokes.forEach(s => s.pts.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }));
  const X = u => ((u - minX) * xh + pad).toFixed(1), Y = v => ((maxY - v) * xh + pad).toFixed(1);
  const d = L.strokes.map(s => 'M' + s.pts.map(p => X(p[0]) + ' ' + Y(p[1])).join('L')).join('');
  const w = (maxX - minX) * xh + pad * 2, h = (maxY - minY) * xh + pad * 2;
  return `<svg class="${cls}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="${esc(text)}"><path d="${d}" stroke-width="${stroke}"/></svg>`;
}
const wordmark = () => cursiveSVG('FloWriter', { xh: 11, stroke: 2.4, cls: 'wordmark' });

// ---------- state + session ----------
const state = { user: null, teach: { range: 7, chartClass: 'all' }, lessonDraft: null, launch: null };
function store(){ try { return localStorage; } catch (e) { return null; } }
function restoreSession(){ try { const id = store()?.getItem('flowriter-session'); const u = id && userById(id); if (u) state.user = u; } catch (e) {} }
function setSession(u){ state.user = u; try { if (u) store()?.setItem('flowriter-session', u.id); else store()?.removeItem('flowriter-session'); } catch (e) {} }
const home = u => !u ? '' : u.role === 'teacher' ? 'dashboard' : 'home';

// ---------- routing ----------
// Routes are plain hash tokens with an optional ?query, e.g. #/class?id=c_p2&tab=students
function parseHash(){ const h = location.hash.replace(/^#\/?/, ''); const [path, q] = h.split('?'); return { path: path || '', q: new URLSearchParams(q || '') }; }
function go(path){ if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
const ROUTES = {};
let cleanup = [], keepScroll = false;
function route(path, opts, view, after){ ROUTES[path] = { ...opts, view, after }; }
function render(){
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  if (typeof Music !== 'undefined') Music.stopPreview();
  const { path, q } = parseHash(); const r = ROUTES[path] || ROUTES[''];
  const u = state.user;
  if (r.auth && !u) { go('login'); return; }
  if (r.auth && r.auth !== 'any' && u.role !== r.auth) { go(home(u)); return; }
  if (r.guest && u) { go(home(u)); return; }
  const body = r.view(q);
  if (body == null) return;
  $('#app').innerHTML = r.bare ? body : appFrame(r.nav, body);
  document.title = (r.title ? (typeof r.title === 'function' ? r.title(q) : r.title) + ' · ' : '') + 'FloWriter';
  r.after && r.after(q);
  mountCharts();
  // wide tables scroll sideways on small screens: make them reachable by keyboard
  $$('.table-wrap').forEach(w => { w.setAttribute('role', 'region'); w.setAttribute('aria-label', 'Table'); w.tabIndex = 0; });
  if (!keepScroll) window.scrollTo(0, 0); keepScroll = false;
}
const rerender = () => { keepScroll = true; render(); };
addEventListener('hashchange', render);

// ---------- app frame ----------
function appFrame(nav, body){
  const u = state.user, T = u.role === 'teacher';
  const items = T ? [['dashboard', 'Dashboard', IC.dash], ['classes', 'Classes', IC.users], ['lessons', 'Lessons', IC.book], ['songs', 'Song library', IC.music], ...(u.admin ? [['admin', 'Pilot admin', IC.shield]] : []), ['account', 'My account', IC.gear]]
                  : [['home', 'My lessons', IC.home], ['progress', 'My progress', IC.chart]];
  const role = T ? 'Teacher' : (classById(u.classId) || {}).name || 'Student';
  return `<div class="app">
    <aside class="rail"><a class="brand" href="#/${home(u)}" aria-label="FloWriter home" style="color:var(--rail-ink)">${wordmark()}</a>
      <nav aria-label="Main">${items.map(([id, l, ic]) => `<a class="nav" href="#/${id}" ${nav === id ? 'aria-current="page"' : ''}>${ic}${l}</a>`).join('')}</nav>
      <div class="foot">${T ? `<b>Pilot</b> · ${esc(u.school || 'Your school')}` : 'Write to the beat!'}</div></aside>
    <div style="min-width:0">
      ${api.demo ? `<div class="demo-band">Demo build: sample class data, saved only in this browser. <button type="button" data-act="reset-demo">Reset demo data</button></div>` : ''}
      <header class="top">
        ${T ? `<div class="search"><label class="sr-only" for="q">Search students and lessons</label>${IC.search}<input class="input" id="q" type="search" placeholder="Search students or lessons" autocomplete="off"><div class="results" id="qres" hidden></div></div>` : `<div class="note" style="font-weight:800">${esc(fmtDate(Date.now()))}</div>`}
        <span class="spacer"></span>
        <button class="icon-btn" type="button" data-act="theme" aria-label="Switch light or dark mode">${currentTheme() === 'dark' ? IC.sun : IC.moon}</button>
        <span class="pill" id="saveState" hidden role="status"></span>
        ${T ? `<button class="btn sm" type="button" data-act="feedback">${IC.flag} Feedback</button>` : ''}
        <div class="who"><span class="avatar" aria-hidden="true">${esc(initials(u))}</span><div><div class="nm">${esc(u.name)}</div><div class="rl">${esc(T ? 'Teacher' : '@' + u.username)}</div></div></div>
        ${T ? `<button class="icon-btn" type="button" data-act="logout" aria-label="Log out" title="Log out">${IC.out}</button>` : `<button class="btn sm" type="button" data-act="logout">${IC.out} Switch student</button>`}
      </header>
      <main class="main" id="main">${body}</main>
    </div></div>`;
}
function currentTheme(){ const t = document.documentElement.dataset.theme; if (t) return t; return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
try { const t = store()?.getItem('flowriter-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}

// ---------- overlays ----------
function toast(html, ms = 3600){ $$('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function openModal(html, wide){ $('#overlay').innerHTML = `<div class="scrim" data-act="close-modal"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`; const f = $('#overlay').querySelector('input,select,textarea,button.primary,button'); f && f.focus({ preventScroll: true }); }
function closeModal(){ $('#overlay').innerHTML = ''; }
// In-page confirmation (browser confirm() dialogs are blocked in some embeds)
let pendingConfirm = null;
function confirmBox(title, body, okLabel, onOk, danger = true){
  pendingConfirm = onOk;
  openModal(`<h2>${esc(title)}</h2><p class="muted">${body}</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-act="confirm-ok">${esc(okLabel)}</button></div>`);
}
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
async function copyText(text, label){ try { await navigator.clipboard.writeText(text); toast(`Copied ${label}`); } catch (e) { openModal(`<h2>Copy ${esc(label)}</h2><input class="input mono" id="copyField" value="${esc(text)}" readonly><div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-act="close-modal">Done</button></div>`); const f = $('#copyField'); f.focus(); f.select(); } }
const joinLink = code => location.href.split('#')[0] + '#/join?code=' + encodeURIComponent(code);

// ---------- components ----------
function delta(now, prev, { invert = false, unit = '%' } = {}){
  if (prev == null || now == null || (!prev && !now)) return '<span class="delta flat">–</span>';
  if (!prev) return '<span class="delta up">new</span>';
  const ch = (now - prev) / Math.abs(prev), up = ch > .005, down = ch < -.005, good = invert ? down : up;
  return `<span class="delta ${up || down ? (good ? 'up' : 'down') : 'flat'}">${up ? '↑' : down ? '↓' : ''} ${Math.abs(Math.round(ch * 100))}${unit}</span>`;
}
function kpi(label, value, prevLabel, prevValue, dlt, cmp){
  return `<div class="kpi"><div class="in"><span class="k">${label}</span><span class="v">${value}</span>
    ${prevLabel != null ? `<span class="p"><span>${prevLabel}: <b>${prevValue}</b></span>${dlt || ''}</span>` : ''}</div>${cmp || ''}</div>`;
}
function stepsMini(p){
  const c = i => p.step > i ? 'on' : p.step === i ? 'now' : '';
  return `<span class="steps-mini" aria-label="${['Not started', 'Demo watched', 'Practicing', 'Test done'][p.step]}"><i class="${c(0)}" title="Demo">D</i><i class="${c(1)}" title="Practice">P</i><i class="${c(2)}" title="Test">T</i></span>`;
}
function scorePill(s){ if (s == null) return '<span class="pill">–</span>'; return `<span class="pill ${s >= .85 ? 'ok' : s >= .7 ? 'blue' : 'bad'}">${pct(s)}</span>`; }
function songDisc(s, id = s.id){ return `<button type="button" class="disc" style="background:conic-gradient(from 30deg,hsl(${s.hue ?? 210} 70% 52%),hsl(${(s.hue ?? 210) + 40} 72% 44%),hsl(${s.hue ?? 210} 70% 52%))" data-act="preview-song" data-id="${id}" aria-label="Preview ${esc(s.title)}">${Music.playing() === id ? IC.pause : IC.play}</button>`; }
function levelPill(bpm){ const l = songLevel(bpm); return `<span class="pill ${l === 'easy' ? 'ok' : l === 'medium' ? 'blue' : 'warn'}">${LEVEL[l]}</span>`; }

// Line chart: this period vs the previous one (dashed), drawn to scale.
const CHARTS = [];
function lineChart(spec){ const id = 'ch' + CHARTS.length; CHARTS.push(spec); return `<div class="chart-wrap" data-chart="${CHARTS.length - 1}" id="${id}"></div>`; }
function mountCharts(){
  $$('[data-chart]').forEach(el => {
    const spec = CHARTS[+el.dataset.chart]; if (!spec) return;
    const draw = () => {
      const W = Math.max(280, el.clientWidth), H = spec.h || 220, L = 40, R = 12, T = 14, B = 28, iw = W - L - R, ih = H - T - B;
      const n = spec.labels.length, all = [...spec.now, ...(spec.prev || [])], max = niceMax(Math.max(1, ...all));
      const x = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1)), y = v => T + ih - v / max * ih;
      const ticks = [0, .25, .5, .75, 1].map(f => f * max);
      const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
      el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.label)}">
        <g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${spec.fmt ? spec.fmt(t) : Math.round(t)}</text>`).join('')}</g>
        ${spec.labels.map((l, i) => { if (i % 2) return ''; const half = iw / (2 * Math.max(1, n - 1)), a = Math.max(L, x(i) - half), b = Math.min(W - R, x(i) + half); return `<rect class="band" x="${a}" y="${T}" width="${b - a}" height="${ih}"/>`; }).join('')}
        ${spec.labels.map((l, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`).join('')}
        <path class="area" d="${path(spec.now)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z"/>
        ${spec.prev ? `<path class="prev" d="${path(spec.prev)}"/>${spec.prev.map((v, i) => `<circle class="ptp" cx="${x(i)}" cy="${y(v)}" r="3"/>`).join('')}` : ''}
        <path class="now" d="${path(spec.now)}"/>${spec.now.map((v, i) => `<circle class="pt" cx="${x(i)}" cy="${y(v)}" r="${i === n - 1 ? 5 : 4}"/>`).join('')}
        <line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="var(--blue)" stroke-width="1.5" style="display:none"/></svg><div class="tip" hidden></div>`;
      const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cross = el.querySelector('.cross');
      svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width; const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (iw / Math.max(1, n - 1)))));
        cross.style.display = ''; cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); tip.hidden = false; tip.style.left = (x(i) * r.width / W) + 'px'; tip.style.top = (T * r.height / H + 6) + 'px';
        tip.innerHTML = `${spec.prev ? `<span><small>${esc(spec.prevName)}</small>${spec.fmt ? spec.fmt(spec.prev[i]) : spec.prev[i]}</span>` : ''}<span><small>${esc(spec.nowName)} · ${esc(spec.labels[i])}</small>${spec.fmt ? spec.fmt(spec.now[i]) : spec.now[i]}</span>`; });
      svg.addEventListener('pointerleave', () => { cross.style.display = 'none'; tip.hidden = true; });
    };
    draw(); const ro = new ResizeObserver(() => { if (Math.abs((el._w || 0) - el.clientWidth) > 6) { el._w = el.clientWidth; draw(); } }); ro.observe(el); cleanup.push(() => ro.disconnect());
  });
  CHARTS.length = 0;
}
function niceMax(v){ const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p * 4; return 40 * p; }

// Month activity calendar from attempt seconds. Goal: 10 minutes a day.
function activityCalendar(attempts, monthOffset = 0){
  const now = new Date(), m = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1), first = new Date(m); first.setDate(1 - m.getDay());
  const byDay = new Map(); attempts.forEach(a => { const k = dayStart(a.date); byDay.set(k, (byDay.get(k) || 0) + (a.seconds || 0)); });
  let cells = '';
  for (let i = 0; i < 42; i++){ const d = new Date(first); d.setDate(first.getDate() + i); const k = d.getTime(), s = byDay.get(k) || 0;
    if (i >= 35 && d.getMonth() !== m.getMonth()) break;
    cells += `<span class="d ${d.getMonth() !== m.getMonth() ? 'other' : ''} ${s >= 600 ? 'hi' : s > 0 ? 'lo' : ''} ${k === dayStart(Date.now()) ? 'today' : ''}" title="${fmtShort(k)}: ${fmtMin(s)}">${d.getDate()}</span>`; }
  // streak: consecutive weeks (ending this week) with at least one active day
  let weeks = 0; for (let w = 0; w < 52; w++){ const end = dayStart(Date.now()) - (new Date().getDay() - 6) * DAY - w * 7 * DAY; let any = false; for (let d = 0; d < 7; d++) if (byDay.get(end - d * DAY)) any = true; if (any) weeks++; else break; }
  return { html: `<div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span class="dow">${d}</span>`).join('')}${cells}</div>`,
    title: m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), weeks, byDay };
}
function recentDays(byDay, n = 5){
  const days = [...byDay.entries()].filter(([, s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, n);
  const max = Math.max(600, ...days.map(d => d[1]));
  return days.length ? `<div class="recent">${days.map(([k, s]) => `<div class="r"><span>${new Date(k).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="bar"><i style="width:${s / max * 100}%"></i></span><span class="num" style="text-align:right">${Math.round(s / 60)}m</span></div>`).join('')}</div>` : '<p class="note">No writing time yet.</p>';
}

// Letter grid: each letter drawn in cursive with its average score.
function letterGrid(report, limit = 12){
  if (!report.length) return '<p class="note">Letter scores appear after the first test.</p>';
  return `<div class="letters">${report.slice(0, limit).map(r => `<div class="lt ${r.avg < .7 ? 'lo' : r.avg < .85 ? 'mid' : 'hi'}" title="${esc(r.ch)}: ${pct(r.avg)} average across ${r.n} test${r.n > 1 ? 's' : ''}${r.rev ? `, ${r.rev} wrong-direction stroke${r.rev > 1 ? 's' : ''}` : ''}"><canvas width="104" height="104" data-glyph="${esc(r.ch)}"></canvas><span class="s">${pct(r.avg)}</span>${r.rev ? `<div class="note" style="font-size:11px">↺ ${r.rev}</div>` : ''}</div>`).join('')}</div>`;
}
function paintGlyphs(root = document){
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222';
  $$('canvas[data-glyph]', root).forEach(c => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const L = Cursive.build(c.dataset.glyph); let minX = 1e9, maxX = -1e9; L.strokes.forEach(s => s.pts.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }));
    const xh = 26, ox = (c.width - (maxX - minX) * xh) / 2 - minX * xh, oy = 70;
    g.strokeStyle = ink; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    L.strokes.forEach(s => { g.beginPath(); s.pts.forEach((p, i) => i ? g.lineTo(ox + p[0] * xh, oy - p[1] * xh) : g.moveTo(ox + p[0] * xh, oy - p[1] * xh)); g.stroke(); }); });
}
// Model text on ruled paper into a canvas element (lesson previews).
function paintPreview(canvas, text, { xh = 26, maxLines = 3 } = {}){
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const w = canvas.clientWidth || 520, dpr = window.devicePixelRatio || 1;
  const L = Cursive.build(cleanText(text) || 'hello', (w - 28) / xh - .8), lines = Math.min(maxLines, L.lines);
  const h = Cursive.height(lines, xh);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.height = h + 'px';
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = v('--surface'); g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
  Cursive.drawModel(g, cleanText(text) || 'hello', { w, xh, ink: v('--ink'), rule: v('--rule'), rule2: v('--rule-soft'), line: 2.2 });
  g.restore();
  return L;
}

// ---------- the tracing engine, embedded ----------
// cfg: { word, title, bpm, bps, rest, tol, skin, role, progress } ; song: a song row (or null)
function mountEngine(el, cfg, song, mult, on){
  const ch = 'c' + Math.random().toString(36).slice(2);
  el.innerHTML = `<div class="loading" id="engineLoading"><span id="loadingMsg">Sharpening pencils<span class="dots"></span></span></div><iframe title="Writing page" allow="autoplay"></iframe>`;
  const fr = el.querySelector('iframe');
  const full = { ...cfg, ch, theme: currentTheme(), bpm: song ? song.bpm * mult : (cfg.bpm || 84), debug: !!window.__FW_DEBUG, handed: state.user && state.user.handed || 'right' };
  const inject = `<script>window.__FW=${JSON.stringify(full).replace(/</g, '\\u003c')}<\/script>`;
  fr.srcdoc = ENGINE.replace('</head>', inject + '</head>');
  const send = m => fr.contentWindow && fr.contentWindow.postMessage({ fwShell: 1, ...m }, '*');
  const doneLoading = () => { const l = el.querySelector('#engineLoading'); l && l.remove(); };
  const onMsg = async e => {
    const m = e.data; if (!m || !m.fw || m.ch !== ch) return;
    if (m.type === 'active' || m.type === 'run') bumpActivity();
    if (m.type === 'h') fr.style.height = Math.max(520, m.h) + 'px';
    else if (m.type === 'ready') {
      if (!song) { doneLoading(); return; }
      $('#loadingMsg', el) && ($('#loadingMsg', el).innerHTML = `Tuning up “${esc(song.title)}”<span class="dots"></span>`);
      try { const file = await api.songFile(song); if (!file) throw new Error('missing'); send({ track: file, name: song.title, bpm: song.bpm * mult, baseBpm: song.bpm, offset: song.offset ?? null }); }
      catch (err) { doneLoading(); toast('Couldn’t load the song, so the built-in beat is playing.'); }
    }
    else if (m.type === 'trackReady' || m.type === 'trackFail') { doneLoading(); if (m.type === 'trackFail') toast('Couldn’t play the song, so the built-in beat is playing.'); }
    else on && on(m);
  };
  addEventListener('message', onMsg); cleanup.push(() => removeEventListener('message', onMsg));
  const onTheme = () => send({ theme: currentTheme() }); addEventListener('fw-theme', onTheme); cleanup.push(() => removeEventListener('fw-theme', onTheme));
  return { send };
}

// ---------- global events ----------
const ACT = {}; // act name -> handler(target, event)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  if (act === 'close-modal') { if (e.target === t || t.tagName === 'BUTTON') closeModal(); return; }
  if (ACT[act]) { ACT[act](t, e); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act],[role="button"][data-act]')) { e.preventDefault(); e.target.click(); } });
Object.assign(ACT, {
  'confirm-ok': () => { const f = pendingConfirm; pendingConfirm = null; closeModal(); f && f(); },
  theme: () => { const n = currentTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { store()?.setItem('flowriter-theme', n); } catch (err) {} dispatchEvent(new Event('fw-theme')); rerender(); },
  logout: () => { const wasStudent = state.user && state.user.role === 'student'; try { api.logout(); } catch (e) {} setSession(null); go(wasStudent ? 'login' : ''); },
  feedback: () => openModal(`<form data-form="feedback" class="stack" novalidate><h2>Send feedback to the FloWriter team</h2>
    <div class="field"><span class="lbl" id="fbL">How is FloWriter working for your class?</span><div class="seg" role="group" aria-labelledby="fbL">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="fb-rate" data-n="${n}" aria-pressed="false">${n}</button>`).join('')}</div><small>1 = not working, 5 = working really well</small><input type="hidden" name="rating" value=""></div>
    <div class="field"><label for="fbBody">What should we fix, add or keep?</label><textarea class="input" id="fbBody" name="body" maxlength="2000" required></textarea></div>
    <p class="form-error" role="alert"></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Send</button></div></form>`),
  'fb-rate': t => { $$('[data-act="fb-rate"]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); $('input[name="rating"]').value = t.dataset.n; },
  'reset-demo': () => confirmBox('Reset the demo data?', 'This puts the sample class back the way it started and signs you out. Anything you made in this browser is removed.', 'Reset', () => { api.resetDemo(); setSession(null); go(''); toast('Demo data reset'); }),
  'preview-song': async (t, e) => { e.stopPropagation(); const s = songById(t.dataset.id); if (!s) return; let file = null; if (s.kind !== 'starter') { try { file = await api.songFile(s); } catch (err) {} } const r = await Music.preview(s, file); $$('[data-act="preview-song"]').forEach(d => d.innerHTML = d.dataset.id === r ? IC.pause : IC.play); },
  nav: t => go(t.dataset.to),
});

// ---------- shared classroom devices: students are signed out after 10 minutes idle ----------
const IDLE_MS = 10 * 60 * 1000;
let lastActive = Date.now();
function bumpActivity(){ lastActive = Date.now(); }
['pointerdown', 'keydown', 'pointermove'].forEach(ev => addEventListener(ev, bumpActivity, { passive: true }));
setInterval(() => {
  const u = state.user; if (!u || u.role !== 'student') return;
  if (Date.now() - lastActive > IDLE_MS) { try { api.logout(); } catch (e) {} setSession(null); state.flash = 'You were signed out after 10 minutes without writing, so the next student can sign in.'; closeModal(); go('login'); }
}, 30000);

// ---------- save status (runs waiting to reach the server) ----------
addEventListener('fw-save', e => { const el = $('#saveState'); if (!el) return; const n = e.detail.pending;
  el.hidden = false; el.className = 'pill ' + (n ? 'warn' : 'ok'); el.textContent = n ? `Saving ${n} run${n > 1 ? 's' : ''}…` : 'All work saved';
  clearTimeout(el._t); if (!n) el._t = setTimeout(() => { el.hidden = true; }, 3000); });

// ---------- live data: re-draw teacher pages when new student work arrives ----------
let liveT = null;
addEventListener('fw-data', () => { clearTimeout(liveT); liveT = setTimeout(() => {
  const p = parseHash().path; if (!['dashboard', 'class', 'student', 'admin'].includes(p)) return;
  if ($('#overlay').innerHTML || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
  rerender(); }, 1500); });

// ---------- CSV export ----------
function toCSV(rows){ return rows.map(r => r.map(v => { const x = v == null ? '' : String(v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(',')).join('\n'); }
function exportCSV(name, rows){
  const csv = toCSV(rows);
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch (e) {}
  openModal(`<h2>${esc(name)}</h2><p class="muted">${rows.length - 1} rows. The download should have started. If it didn’t, copy the text below into a spreadsheet.</p><textarea class="input mono" id="csvText" readonly style="min-height:160px;font-size:12px">${esc(csv)}</textarea><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="copy-csv">${IC.copy} Copy</button><button class="btn primary" type="button" data-act="close-modal">Done</button></div>`, true);
}
ACT['copy-csv'] = () => copyText($('#csvText').value, 'CSV');
function resultRows(students){
  const rows = [['School', 'Student', 'Username', 'Class', 'Lesson', 'Type', 'Demo watched', 'Practice runs', 'Best practice %', 'Test %', 'Strokes on the line', 'Strokes total', 'Backwards strokes', 'Test date', 'Minutes']];
  students.forEach(k => { const c = classById(k.classId); lessonsForStudent(k).forEach(l => { const p = progress(k.id, l.id);
    rows.push([c ? c.school || '' : '', k.name, k.username, c ? c.name : '', l.title, isCheck(l) ? 'Handwriting check' : 'Lesson', p.demo, p.practice, p.practice ? Math.round(p.bestPractice * 100) : '', p.test ? Math.round(p.test.score * 100) : '', p.test ? p.test.valid : '', p.test ? p.test.total : '', p.test ? p.test.reversed || 0 : '', p.test ? new Date(p.test.date).toISOString().slice(0, 10) : '', Math.round(p.seconds / 60)]); }); });
  return rows;
}
