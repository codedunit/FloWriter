// =====================================================================
// Public pages: homepage, log in, teacher sign-up, student join, try a lesson
// =====================================================================
function siteHeader(){
  return `<header class="site-head"><nav class="site-nav" aria-label="Site">
    <a href="#/" aria-label="FloWriter home" style="color:var(--blue-ink)">${wordmark()}</a>
    <div class="links"><a href="#/" data-act="jump" data-to="video">Video</a><a href="#/" data-act="jump" data-to="how">How it works</a><a href="#/" data-act="jump" data-to="curriculum">Curriculum</a><a href="#/" data-act="jump" data-to="about">About</a><a href="#/" data-act="jump" data-to="team">Team</a></div>
    <span class="spacer"></span>
    <button class="icon-btn" type="button" data-act="theme" aria-label="Switch light or dark mode">${currentTheme() === 'dark' ? IC.sun : IC.moon}</button>
    ${state.user ? `<a class="btn primary" href="#/${home(state.user)}">Open FloWriter</a>` : `<a class="btn ghost" href="#/login">Log in</a><a class="btn primary" href="#/join">Join a class</a>`}
  </nav></header>`;
}
function siteFooter(){
  return `<footer class="site-foot"><div class="wrap"><span style="color:var(--blue-ink)">${cursiveSVG('FloWriter', { xh: 8, stroke: 2, cls: 'wordmark' })}</span>
    <span>Cursive written to the beat.</span><a href="#/privacy">Student privacy</a>${SITE.contact ? `<span>Contact: <span class="mono">${esc(SITE.contact)}</span></span>` : ''}<span class="spacer"></span><span>Pilot edition · ${new Date().getFullYear()}</span></div></footer>`;
}
ACT.jump = (t, e) => { e.preventDefault(); if (parseHash().path !== '') { go(''); setTimeout(() => { const el = document.getElementById(t.dataset.to); el && el.scrollIntoView({ behavior: 'smooth' }); }, 60); return; } const el = document.getElementById(t.dataset.to); el && el.scrollIntoView({ behavior: 'smooth' }); };

function videoBlock(){
  const v = (SITE.video || '').trim();
  if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) return `<div class="video"><video src="${esc(v)}" controls preload="metadata" ${SITE.videoPoster ? `poster="${esc(SITE.videoPoster)}"` : ''}></video></div>`;
  const yt = v.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="FloWriter pilot video" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p class="note">If the video doesn’t load here, <a href="https://www.youtube.com/watch?v=${yt[1]}" target="_blank" rel="noopener">watch it on YouTube</a>.</p>`;
  return `<div class="video"><div class="inner"><span class="play">${IC.play}</span><h3 style="font-size:22px">The pilot walkthrough video is on its way</h3><p class="muted" style="max-width:46ch">It will show a full lesson from both sides: a teacher building it, and a student watching the demo, practicing to the music, and taking the test.</p><a class="btn" href="#/try">Try a lesson now</a></div></div>`;
}

route('', { bare: true }, () => {
  const fam = [['Undercurve', 'itwurspj', 'Start low and swing up and to the right.'], ['Undercurve loops', 'elhkfb', 'Swing up, loop back, and slant down.'], ['Downcurve', 'adgocq', 'Start at the midline and curve back to the left.'], ['Overcurve', 'nmxyzv', 'Start with a hump that curves up and over.']];
  const team = SITE.team || [];
  return `${siteHeader()}
  <section class="ink-intro" id="inkIntro" aria-label="FloWriter: cursive written to the beat"><div class="ink-stage">
    <canvas id="inkCanvas" aria-hidden="true"></canvas>
    <div class="ink-copy"><div class="ink-hint" id="inkHint"><p class="eyebrow">Cursive handwriting × rhythm</p><b>Scroll to write</b><span class="ink-cue" aria-hidden="true"></span></div>
      <p class="ink-tag" id="inkTag" style="opacity:0">Cursive, written to the <em>beat</em>.</p></div>
  </div></section>
  <section class="hero"><div class="wrap">
    <div>
      <p class="eyebrow">Cursive handwriting × rhythm</p>
      <h1>Every stroke of cursive lands on a <em>beat</em>.</h1>
      <p class="lead">FloWriter is a classroom cursive program that plays like a rhythm game. Students trace each letter stroke by stroke, in time with the music, and teachers see exactly which letters each child is still learning.</p>
      <div class="ctas"><a class="btn primary lg" href="#/signup">Start a class</a><a class="btn lg" href="#/join">Join with a class code</a></div>
      <p class="sub">Or <a href="#/try">try a lesson</a> without an account.</p>
    </div>
    <div class="paper" id="heroPaper"><canvas id="heroCanvas" aria-label="The word music written in cursive, one stroke per beat"></canvas>
      <div class="hud"><span id="heroHud">Count-in</span><span class="row" style="gap:12px"><span class="metro-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></span><button class="btn sm" type="button" data-act="hero-sound" id="heroSound">${IC.music} Hear the beat</button></span></div></div>
  </div></section>

  <section class="band alt" id="video"><div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Watch</p><h2 class="big">See a FloWriter lesson in two minutes</h2></div></div>
    ${videoBlock()}
  </div></section>

  <section class="band" id="how"><div class="wrap">
    <div><p class="eyebrow">How a lesson works</p><h2 class="big">Watch it, play it, then show what you learned</h2></div>
    <div class="steps3">
      <div class="step-card"><span class="n">1</span><h3>Watch the demo</h3><p>A pen writes the lesson to the music, one stroke per beat, with the direction of every stroke shown. Students can watch as many times as they like.</p></div>
      <div class="step-card"><span class="n">2</span><h3>Practice with the music</h3><p>The music follows the student. If the pen lifts or wanders, the song waits for them. The help fades over repeated practice so the writing does not lean on it.</p></div>
      <div class="step-card"><span class="n">3</span><h3>Take the test, once</h3><p>No music and no pacing. The student writes the lesson on their own, and every point of every stroke is graded for closeness to the line and direction.</p></div>
    </div>
  </div></section>

  <section class="band alt" id="curriculum"><div class="wrap">
    <div class="stat-row" style="align-items:start">
      <div><p class="eyebrow">A standard curriculum</p><h2 class="big">Built on Zaner-Bloser letterforms</h2></div>
      <p class="lead">Every letter is modeled on Zaner-Bloser cursive, the handwriting model used across many U.S. schools, and broken into the same named strokes teachers already use: undercurve, downcurve, overcurve, slant, loop and checkstroke. Thirteen lessons take students from their first undercurve to full sentences, and teachers can shape any lesson around their own class.</p>
    </div>
    <div class="families">${fam.map(([t, letters, d]) => `<div class="family"><canvas data-fam="${letters}" height="70"></canvas><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
  </div></section>

  <section class="band" id="why"><div class="wrap"><div class="stat-row">
    <div><div class="stat-big">${esc(SITE.stat.value)}</div><p style="font-size:19px;font-weight:800;margin-top:6px;max-width:26ch">${esc(SITE.stat.label)}</p><p class="note" style="margin-top:8px">Source: <a href="${esc(SITE.stat.url)}" target="_blank" rel="noopener">${esc(SITE.stat.source)}</a></p></div>
    <div class="benefits">
      <div><h3>Fine motor control</h3><p>Tracing to a steady beat is direct practice in hand-eye coordination.</p></div>
      <div><h3>Memory and literacy</h3><p>Writing by hand connects movement with the brain’s reading and language networks.</p></div>
      <div><h3>Rhythm and tempo</h3><p>Students feel a pulse and a tempo in every lesson, without a separate music class.</p></div>
      <div><h3>Practice that sticks</h3><p>Points for accuracy, songs they choose to replay, and short daily sessions keep children coming back.</p></div>
    </div>
  </div></div></section>

  <section class="band blue"><div class="wrap">
    <div><p class="eyebrow">For teachers</p><h2 class="big">Your class, your words, your music</h2></div>
    <div class="features">
      <div class="feature">${IC.pen}<h3>Write any lesson</h3><p>Type the words, start from the Zaner-Bloser sequence, or generate practice words from the letters your class knows.</p></div>
      <div class="feature">${IC.music}<h3>Pick the song and tempo</h3><p>Choose from a shared library of MP3s sorted by difficulty, or upload your own. The beat is detected for you.</p></div>
      <div class="feature">${IC.chart}<h3>See every letter</h3><p>Progress for each student and each lesson, practice time, test scores, and the letters your class finds hardest.</p></div>
    </div>
  </div></section>

  <section class="band alt" id="about"><div class="wrap">
    <div><p class="eyebrow">About</p><h2 class="big">Why FloWriter exists</h2></div>
    <div class="about-cols">${(SITE.about || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
  </div></section>

  ${team.length ? `<section class="band" id="team"><div class="wrap">
    <div><p class="eyebrow">Team</p><h2 class="big">The people building FloWriter</h2></div>
    <div class="team-grid">${SITE.groupPhoto ? `<figure class="group-photo"><img src="${esc(SITE.groupPhoto)}" alt="${esc(SITE.groupPhotoAlt || '')}" loading="lazy">${SITE.groupPhotoCaption ? `<figcaption>${esc(SITE.groupPhotoCaption)}</figcaption>` : ''}</figure>` : ''}
    <div class="team">${team.map(m => `<div class="member"><div class="ph">${m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy">` : esc(initials(m))}</div><div><h3>${esc(m.name)}</h3><div class="role">${esc(m.school || m.role || '')}</div>${m.major ? `<div class="major">${esc(m.major)}</div>` : ''}</div><p>${esc(m.bio)}</p>${m.linkedin ? `<a class="li" href="${esc(m.linkedin)}" target="_blank" rel="noopener">${IC.link} LinkedIn</a>` : ''}</div>`).join('')}</div></div>
  </div></section>` : '<span id="team"></span>'}

  <section class="band alt" id="privacy"><div class="wrap" style="gap:16px">
    <div class="row" style="gap:12px;color:var(--ok)">${IC.shield.replace('<svg', '<svg style="width:30px;height:30px"')}<h2 style="font-size:22px;color:var(--ink)">Student privacy in the pilot</h2></div>
    <p class="lead" style="font-size:16px">Students join with a class code and a username. FloWriter does not ask students for an email address or a birth date. It stores a display name (first name and last initial), the class they joined, and their writing attempts, and only their teacher can see their work. Teachers confirm their school authorizes classroom use before creating a class.</p>
  </div></section>
  ${siteFooter()}`;
}, () => { inkIntro(); heroAnimation(); paintFamilies(); });

// The scroll intro: ink blots splash onto the page as you scroll, then fly into the strokes of "FloWriter".
// Everything is a function of scroll progress p (0 at the top of the section, 1 when it ends), so scrolling back rewinds it.
function inkIntro(){
  const sec = $('#inkIntro'), c = $('#inkCanvas'); if (!sec || !c) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flat = []; Cursive.build('FloWriter').strokes.forEach((s, si) => s.pts.forEach(p => flat.push([p[0], p[1], si])));
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9; flat.forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
  const r = rng(7), N = 130, A = .42, FLY = .3, DUR = .14; // splash until A; blot i flies from A + FLY*i/N for DUR
  const blots = Array.from({ length: N }, (_, i) => ({ sx: .05 + r() * .9, sy: .14 + r() * .74, R: .5 + r() * 1.1, at: -.03 + r() * (A - .08),
    target: Math.round((i + .5) / N * (flat.length - 1)), tone: r() < .14 ? 'red' : r() < .2 ? 'teal' : 'ink',
    shape: Array.from({ length: 10 }, () => .8 + r() * .4), drops: Array.from({ length: 2 + Math.floor(r() * 4) }, () => ({ a: r() * 6.283, d: 1.3 + r() * 1.4, s: .1 + r() * .22 })) }));
  const k01 = v => Math.max(0, Math.min(1, v)), ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const back = t => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2; // overshoot: the splat
  const blob = (g, x, y, rad, shape) => { // a lumpy circle: a smooth curve through the midpoints of uneven vertices
    const P = shape.map((m, j) => { const a = j / shape.length * 6.283; return [x + Math.cos(a) * rad * m, y + Math.sin(a) * rad * m]; }), M = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    g.beginPath(); g.moveTo(...M(P[P.length - 1], P[0])); P.forEach((p, j) => g.quadraticCurveTo(p[0], p[1], ...M(p, P[(j + 1) % P.length]))); g.fill(); };
  let raf = 0;
  const draw = () => {
    raf = 0;
    const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1; if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim(), col = { ink: v('--ink'), red: v('--red'), teal: v('--blue') };
    const p = reduce ? 1 : k01(-sec.getBoundingClientRect().top / Math.max(1, sec.offsetHeight - h));
    const xh = Math.min(w * .84 / (maxX - minX), h * .19), ox = (w - (maxX - minX) * xh) / 2 - minX * xh, mid = (minY + maxY) / 2;
    const X = u => ox + u * xh, Y = y => h * .5 + (mid - y) * xh, sw = Math.max(3, xh * .12), bs = Math.min(w, h) * .03;
    // handwriting guide lines fade in as the blots start to gather
    g.globalAlpha = k01((p - A + .08) / .12) * .9; g.strokeStyle = v('--rule'); g.lineWidth = 1.2;
    [[0, []], [1, [7, 7]]].forEach(([y, d]) => { g.setLineDash(d); g.beginPath(); g.moveTo(w * .04, Y(y)); g.lineTo(w * .96, Y(y)); g.stroke(); }); g.setLineDash([]); g.globalAlpha = 1;
    // the line, written up to the last blot that has landed
    const upto = k01((p - A - DUR) / FLY) * (flat.length - 1);
    g.strokeStyle = col.ink; g.lineWidth = sw; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i <= upto && i < flat.length; i++) { const [x, y, si] = flat[i]; i && flat[i - 1][2] === si ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
    g.stroke();
    blots.forEach((b, i) => {
      const a = k01((p - b.at) / .05); if (a <= 0) return;
      const f = k01((p - A - FLY * i / N) / DUR); if (f >= 1) return; // landed: it is part of the line now
      const T = flat[b.target], e = ease(f), x = b.sx * w + (X(T[0]) - b.sx * w) * e, y = b.sy * h + (Y(T[1]) - b.sy * h) * e;
      const rad = b.R * bs * back(a) * (1 - e) + sw / 2 * e;
      g.fillStyle = col[b.tone]; blob(g, x, y, rad, b.shape);
      b.drops.forEach(d => { g.beginPath(); g.arc(x + Math.cos(d.a) * rad * d.d * (.6 + .4 * a), y + Math.sin(d.a) * rad * d.d * (.6 + .4 * a), rad * d.s * (1 - e), 0, 6.283); g.fill(); });
    });
    // a red underline swoosh once the word is written
    const u = k01((p - A - FLY - DUR) / .1);
    if (u > 0) { g.strokeStyle = col.red; g.lineWidth = Math.max(3, sw * .8); g.beginPath(); const y0 = Y(minY) + xh * .35, x0 = X(minX), x1 = x0 + (X(maxX) - x0) * u;
      g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + xh * .25 * u, x1, y0 - xh * .1 * u); g.stroke(); }
    const hint = $('#inkHint'), tag = $('#inkTag');
    if (hint) hint.style.opacity = 1 - k01(p / .08);
    if (tag) { const o = k01((u - .3) / .7); tag.style.opacity = o; tag.style.transform = `translateY(${(1 - o) * 14}px)`; }
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req);
  cleanup.push(() => { removeEventListener('scroll', req); removeEventListener('resize', req); cancelAnimationFrame(raf); });
  draw();
}

function paintFamilies(){
  const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue('--ink').trim();
  $$('canvas[data-fam]').forEach(c => { const w = c.clientWidth, dpr = window.devicePixelRatio || 1, letters = c.dataset.fam.split('');
    const xh = Math.min(18, w / (letters.length * 1.55 + 1)), h = Math.round(xh * 4.1); c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.strokeStyle = ink; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    const base = xh * 2.6; g.save(); g.strokeStyle = cs.getPropertyValue('--rule').trim(); g.lineWidth = 1; g.beginPath(); g.moveTo(0, base); g.lineTo(w, base); g.stroke(); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, base - xh); g.lineTo(w, base - xh); g.stroke(); g.restore();
    letters.forEach((ch, i) => { const L = Cursive.build(ch), x0 = 4 + i * (w - 8) / letters.length; L.strokes.forEach(s => { g.beginPath(); s.pts.forEach((p, j) => j ? g.lineTo(x0 + p[0] * xh, base - p[1] * xh) : g.moveTo(x0 + p[0] * xh, base - p[1] * xh)); g.stroke(); }); }); });
}

// The hero: "music" written one stroke per beat at 84 BPM, with a 4-beat count-in.
let heroAudio = null;
function heroAnimation(){
  const c = $('#heroCanvas'); if (!c) return;
  const BPM = 84, spb = 60 / BPM, text = 'music', L = Cursive.build(text), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // beat plan: count-in 4, then each stroke 1 beat, with 1 extra beat to lift for a dot
  const plan = []; let b = 4; L.strokes.forEach((s, i) => { if (i && s.lift) b += 1; plan.push({ s, b0: b }); b += 1; }); const total = b + 3;
  let minX = 1e9, maxX = -1e9; L.strokes.forEach(s => s.pts.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }));
  let t0 = performance.now(), raf = 0;
  const draw = () => {
    const w = c.clientWidth, h = Math.round(w * .46), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px'; }
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xh = Math.min(h / 3.2, (w - 70) / (maxX - minX)), ox = (w - (maxX - minX) * xh) / 2 - minX * xh, base = h * .66;
    const X = u => ox + u * xh, Y = y => base - y * xh;
    g.fillStyle = v('--surface'); g.fillRect(0, 0, w, h);
    [[2.2, v('--rule'), []], [1, v('--rule'), [7, 7]], [0, v('--rule'), []], [-1, v('--rule-soft'), []]].forEach(([y, col, d]) => { g.setLineDash(d); g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); g.stroke(); });
    g.setLineDash([]); g.strokeStyle = v('--margin'); g.beginPath(); g.moveTo(26, 0); g.lineTo(26, h); g.stroke();
    const beat = reduce ? total : ((performance.now() - t0) / 1000) / spb;
    const path = (pts, upto = 1) => { const n = Math.max(1, Math.round(upto * (pts.length - 1))); g.beginPath(); for (let i = 0; i <= n; i++){ const p = pts[i]; i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); } };
    g.lineCap = 'round'; g.lineJoin = 'round';
    plan.forEach(({ s }) => { g.strokeStyle = v('--line-2'); g.lineWidth = 3; g.setLineDash([3, 8]); path(s.pts); g.stroke(); });
    g.setLineDash([]);
    let hud = beat < 4 ? `Count-in <b>${4 - Math.floor(Math.max(0, beat))}</b> · ${BPM} BPM` : 'Finished · 1 stroke per beat';
    plan.forEach(({ s, b0 }, i) => {
      const f = Math.max(0, Math.min(1, beat - b0)); if (f <= 0) { if (beat > b0 - 1 && beat < b0 && i && s.lift) hud = `Lift your pen · dot the <b>${s.ch}</b>`; return; }
      g.strokeStyle = f < 1 ? v('--blue') : v('--ink'); g.lineWidth = f < 1 ? 5 : 3.6; path(s.pts, f); g.stroke();
      if (f < 1) { const p = s.pts[Math.round(f * (s.pts.length - 1))]; g.fillStyle = v('--blue'); g.globalAlpha = .22; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 14, 0, 7); g.fill(); g.globalAlpha = 1; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 6.5, 0, 7); g.fill();
        hud = `Beat <b>${Math.floor(beat) - 3}</b> · <b>${esc(s.ch)}</b> · ${esc(s.name)}`; }
    });
    const hudEl = $('#heroHud'); if (hudEl) hudEl.innerHTML = hud;
    const fb = beat - Math.floor(beat), on = !reduce && beat >= 0 && fb < .18, k = Math.floor(beat) % 4;
    $$('.metro-dots i').forEach((d, i) => { d.classList.toggle('on', on && i === k); d.classList.toggle('acc', on && i === 0); });
    if (beat >= total && !reduce) { t0 = performance.now(); heroTick(true); }
    if (!reduce) raf = requestAnimationFrame(draw);
  };
  draw();
  cleanup.push(() => { cancelAnimationFrame(raf); stopHeroSound(); });
  ACT['hero-sound'] = () => { if (heroAudio) { stopHeroSound(); return; } t0 = performance.now() + 120; startHeroSound(spb, total); };
}
function startHeroSound(spb, total){
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); heroAudio = { ctx, beat: 0, next: ctx.currentTime + .12, spb, total };
    const click = (t, acc) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = acc ? 1568 : 1046; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(acc ? .5 : .3, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .08); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .1);
      const k = ctx.createOscillator(), kg = ctx.createGain(); k.frequency.setValueAtTime(140, t); k.frequency.exponentialRampToValueAtTime(45, t + .12); kg.gain.setValueAtTime(acc ? .6 : .35, t); kg.gain.exponentialRampToValueAtTime(.001, t + .25); k.connect(kg).connect(ctx.destination); k.start(t); k.stop(t + .3); };
    heroAudio.timer = setInterval(() => { const A = heroAudio; if (!A) return; while (A.next < ctx.currentTime + .15) { click(A.next, A.beat % 4 === 0); A.beat = (A.beat + 1) % A.total; A.next += A.spb; } }, 30);
    const b = $('#heroSound'); if (b) b.innerHTML = `${IC.pause} Stop the beat`;
  } catch (e) { toast('This browser can’t play sound here.'); }
}
function heroTick(){ if (heroAudio) { heroAudio.beat = 0; } }
function stopHeroSound(){ if (!heroAudio) return; clearInterval(heroAudio.timer); try { heroAudio.ctx.close(); } catch (e) {} heroAudio = null; const b = $('#heroSound'); if (b) b.innerHTML = `${IC.music} Hear the beat`; }

// ---------------------------------------------------------------- log in
route('login', { bare: true, guest: true, title: 'Log in' }, () => `${siteHeader()}<div class="auth"><form class="auth-card" data-form="login" novalidate>
  <h1>Log in</h1>${state.flash ? `<p class="banner blue" style="padding:10px 14px">${esc(state.flash)}</p>` : ''}<p class="muted">Students: type your username, or scan your login card with the tablet’s camera. Teachers: use your email.</p>
  <div class="field"><label for="liId">Username or email</label><input class="input" id="liId" name="id" autocomplete="username" autocapitalize="off" required></div>
  <div class="field"><label for="liPw">Password</label><input class="input" id="liPw" name="password" type="password" autocomplete="current-password" required></div>
  <p class="form-error" role="alert"></p>
  <button class="btn primary lg" type="submit">Log in</button>
  <p class="note">Teachers: <a href="#/forgot">forgot your password?</a> Students: your teacher can give you a new one.<br>New student? <a href="#/join">Join your class with a code</a>. New teacher? <a href="#/signup">Start a class</a>.</p>
  ${api.demo ? `<div class="demo-accounts"><span class="note" style="font-weight:800">Demo accounts · one click to log in</span>
    ${[['mr_murry', 'teacher2026', 'Mr. Murry', 'teacher · pilot admin'], ['ms_rivera', 'teacher2026', 'Ms. Rivera', 'teacher · Lakeside'],
       ['evan_writes', 'flowriter1', 'Evan S.', '3rd grade · Mr. Murry'], ['omar_a', 'student123', 'Omar A.', '2nd grade · Mr. Murry'], ['arlo_r', 'student123', 'Arlo R.', '2nd grade · Ms. Rivera']]
      .map(([u, p, n, r]) => `<button type="button" data-act="quick-login" data-u="${u}" data-p="${p}"><span>${n} <span class="muted">· ${r}</span></span><span class="mono note">${u}</span></button>`).join('')}</div>` : ''}
</form></div>`);
// ---------------------------------------------------------------- teacher password reset
route('forgot', { bare: true, title: 'Reset your password' }, () => `${siteHeader()}<div class="auth"><form class="auth-card" data-form="forgot" novalidate>
  <h1>Reset your password</h1><p class="muted">Type the email you signed up with. We’ll send a link to choose a new password.</p>
  <div class="field"><label for="fgEmail">Email</label><input class="input" id="fgEmail" name="email" type="email" autocomplete="email" required></div>
  <p class="form-error" role="alert"></p><button class="btn primary lg" type="submit">Send the reset link</button>
  <p class="note">Students don’t have email. If a student forgets their password, their teacher sets a new one from the class page.</p></form></div>`);
route('reset', { bare: true, title: 'Choose a new password' }, () => {
  if (!state.recovery) return `${siteHeader()}<div class="auth"><div class="auth-card"><h1>This link has expired</h1><p class="muted">Reset links work once and expire after an hour. Ask for a new one.</p><a class="btn primary" href="#/forgot">Send a new link</a></div></div>`;
  return `${siteHeader()}<div class="auth"><form class="auth-card" data-form="reset" novalidate><h1>Choose a new password</h1>
    <div class="field"><label for="rsPw">New password</label><input class="input" id="rsPw" name="password" type="password" autocomplete="new-password" required><small>At least 8 characters, no spaces.</small></div>
    <p class="form-error" role="alert"></p><button class="btn primary lg" type="submit">Save and log in</button></form></div>`;
});

// ---------------------------------------------------------------- login card (QR) sign-in
route('card', { bare: true, title: 'Signing in' }, q => {
  const u = q.get('u'), k = q.get('k');
  setTimeout(async () => {
    try { if (state.user) { try { api.logout(); } catch (e) {} setSession(null); }
      const user = await api.login(u || '', k ? decodeCard(k) : ''); setSession(user); history.replaceState(null, '', location.href.split('#')[0] + '#/' + home(user)); render(); }
    catch (e) { state.flash = 'That login card didn’t work. Ask your teacher for a new card.'; go('login'); }
  }, 50);
  return `${siteHeader()}<div class="auth"><div class="auth-card" style="text-align:center"><h1>Signing you in…</h1><p class="muted">Hi ${esc((u || '').split('_')[0])}!</p></div></div>`;
});
// The password on a card is lightly scrambled so it doesn't sit in plain sight in the link.
const encodeCard = pw => btoa(unescape(encodeURIComponent(pw))).replace(/=+$/, '').split('').reverse().join('');
const decodeCard = k => decodeURIComponent(escape(atob(k.split('').reverse().join('') + '==='.slice((k.length + 3) % 4))));

// ---------------------------------------------------------------- privacy notice
route('privacy', { bare: true, title: 'Student privacy' }, () => `${siteHeader()}<section class="band"><div class="wrap" style="max-width:760px;gap:20px">
  <div><p class="eyebrow">Pilot privacy notice</p><h1 style="font-size:34px">How FloWriter handles student information</h1><p class="note" style="margin-top:6px">Last updated ${esc(SITE.privacyUpdated)}</p></div>
  <div class="stack prose">
    <h2>Who this covers</h2><p>FloWriter is in a classroom pilot. This notice covers students and teachers using it through a participating school. The school decides to use FloWriter and, under the Children’s Online Privacy Protection Act (COPPA), gives consent for students’ classroom use. Student records are handled under the Family Educational Rights and Privacy Act (FERPA) as the school directs.</p>
    <h2>What we collect</h2><ul><li><b>Students:</b> a display name (first name and last initial), a username, a password, the class they joined, and their writing in FloWriter: each run’s score, time spent, which letters were hard, and a small picture of the writing.</li><li><b>Teachers:</b> name, school, email, password, and the lessons and classes they create.</li><li>We do not collect student email addresses, birth dates, addresses, phone numbers, photos, or location.</li></ul>
    <h2>How it is used</h2><p>Only to run FloWriter: to show each student their lessons and to show their teacher their progress. We use pilot results, with names removed, to learn whether FloWriter helps students write cursive. We do not sell data, show ads, or build profiles of students for any other purpose.</p>
    <h2>Who can see it</h2><p>A student sees only their own work. Their teacher sees the work of students in their classes. The FloWriter pilot team can see pilot data to support schools and measure results. Data is stored with our database provider, Supabase, which processes it only for us.</p>
    <h2>How long we keep it</h2><p>${esc(SITE.retention)}</p>
    <h2>Seeing, correcting or deleting data</h2><p>Parents and guardians can ask the school or the FloWriter team to see or delete their child’s data. Teachers can delete a student’s account and all of their work at any time from the class page.</p>
    <h2>Contact</h2><p>${SITE.contact ? `Email <span class="mono">${esc(SITE.contact)}</span> or ask your child’s teacher.` : 'Ask your child’s teacher, who can reach the FloWriter team.'}</p>
  </div></div></section>${siteFooter()}`);

ACT['quick-login'] = async t => { const f = $('form[data-form="login"]'); f.id.value = t.dataset.u; f.password.value = t.dataset.p; submitForm('login', f); };

// ---------------------------------------------------------------- teacher sign-up
route('signup', { bare: true, guest: true, title: 'Start a class' }, () => `${siteHeader()}<div class="auth"><form class="auth-card" data-form="signup" novalidate>
  <h1>Start a class</h1><p class="muted">Create a teacher account. Your first class and its join code are made for you.</p>
  <div class="field"><label for="suName">Your name, as students say it</label><input class="input" id="suName" name="name" placeholder="Ms. Rivera" required></div>
  <div class="field"><label for="suSchool">School</label><input class="input" id="suSchool" name="school" placeholder="Bayou Elementary"></div>
  <div class="field"><label for="suEmail">School email</label><input class="input" id="suEmail" name="email" type="email" autocomplete="email" required></div>
  <div class="field"><label for="suPw">Password</label><input class="input" id="suPw" name="password" type="password" autocomplete="new-password" required><small>At least 8 characters, no spaces.</small></div>
  <label class="check"><input type="checkbox" name="attest" id="suAttest"><span>My school authorizes classroom use of FloWriter, and parental consent and student-record rules (COPPA and FERPA) are handled as my school requires.</span></label>
  <p class="form-error" role="alert"></p>
  <button class="btn primary lg" type="submit">Create my class</button>
  <p class="note">Already have an account? <a href="#/login">Log in</a></p>
</form></div>`);

// ---------------------------------------------------------------- student join
state.join = { code: '', cls: null, done: null };
route('join', { bare: true, title: 'Join a class' }, q => {
  const J = state.join; const qc = (q.get('code') || '').toUpperCase();
  if (qc && qc !== J.code) { J.code = qc; J.cls = null; J.done = null; setTimeout(() => lookupJoin(qc), 0); }
  if (state.user && !J.done) return `${siteHeader()}<div class="auth"><div class="auth-card"><h1>You’re logged in</h1><p class="muted">You’re logged in as <b>${esc(state.user.name)}</b>. Log out first to make a new student account.</p><div class="row"><a class="btn primary" href="#/${home(state.user)}">Go to FloWriter</a><button class="btn" type="button" data-act="logout">Log out</button></div></div></div>`;
  if (J.done) return `${siteHeader()}<div class="auth"><div class="auth-card"><p class="eyebrow">You’re in!</p><h1>Welcome to ${esc(J.done.cls)}</h1><p class="muted">Write these down or show them to your teacher. You need them to log in next time.</p>
    <dl class="creds"><dt>Username</dt><dd>${esc(J.done.username)}</dd><dt>Password</dt><dd>${esc(J.done.password)}</dd></dl>
    <button class="btn primary lg" type="button" data-act="nav" data-to="home">Go to my lessons</button></div></div>`;
  if (!J.cls) return `${siteHeader()}<div class="auth"><form class="auth-card" data-form="join-code" novalidate><h1>Join your class</h1><p class="muted">Type the 6-letter code from your teacher.</p>
    <div class="field"><label for="jcCode">Class code</label><input class="input mono" id="jcCode" name="code" value="${esc(J.code)}" maxlength="6" autocomplete="off" autocapitalize="characters" style="font-size:24px;letter-spacing:.2em;text-transform:uppercase" required></div>
    <p class="form-error" role="alert" id="jcErr"></p><button class="btn primary lg" type="submit">Find my class</button>
    ${api.demo ? '<p class="note">Demo class code: <span class="mono">MURRY2</span></p>' : ''}</form></div>`;
  return `${siteHeader()}<div class="auth"><form class="auth-card" data-form="join" novalidate>
    <p class="eyebrow">Class code ${esc(J.code)}</p><h1>Join ${esc(J.cls.name)}</h1><p class="muted">with ${esc(J.cls.teacher)}</p>
    <div class="two"><div class="field"><label for="jnFirst">First name</label><input class="input" id="jnFirst" name="first" autocomplete="off" required></div>
      <div class="field"><label for="jnLast">Last name, first letter</label><input class="input" id="jnLast" name="last" maxlength="1" autocomplete="off" style="text-transform:uppercase"></div></div>
    <div class="field"><label for="jnUser">Pick a username</label><input class="input mono" id="jnUser" name="username" autocomplete="off" autocapitalize="off" required><small>Letters and numbers, no spaces. Don’t use your full name.</small></div>
    <div class="field"><label for="jnPw">Make a password</label><div class="row" style="flex-wrap:nowrap"><input class="input mono" id="jnPw" name="password" autocomplete="off" required><button class="btn" type="button" data-act="make-pw">Make one for me</button></div><small>At least 6 characters.</small></div>
    <p class="form-error" role="alert"></p>
    <button class="btn primary lg" type="submit">Join the class</button>
    <button class="btn ghost" type="button" data-act="join-other">Use a different code</button></form></div>`;
}, () => { const f = $('#jnFirst'); if (f) f.addEventListener('input', suggestUsername); $('#jnLast')?.addEventListener('input', suggestUsername); });
async function lookupJoin(code){ const c = await api.lookupClass(code); if (c) { state.join.cls = c; render(); } else { const e = $('#jcErr'); if (e) e.textContent = 'That code doesn’t match an open class. Check it with your teacher.'; } }
let userTouched = false;
function suggestUsername(){ const u = $('#jnUser'); if (!u || userTouched) return; const f = ($('#jnFirst').value || '').toLowerCase().replace(/[^a-z]/g, ''), l = ($('#jnLast').value || '').toLowerCase().replace(/[^a-z]/g, ''); u.value = f ? f + (l ? '_' + l : '') + (10 + Math.floor(Math.random() * 90)) : ''; }
document.addEventListener('input', e => { if (e.target.id === 'jnUser') userTouched = true; });
ACT['make-pw'] = () => { $('#jnPw').value = kidPassword(); };
ACT['join-other'] = () => { state.join = { code: '', cls: null, done: null }; go('join'); };

// ---------------------------------------------------------------- try a lesson (no account)
route('try', { bare: true, title: 'Try a lesson' }, () => `${siteHeader()}<div class="main" style="margin:0 auto;max-width:1180px;width:100%">${lessonPage({ id: 'try', title: 'Try it: hello', text: 'hello', songId: 'sg_sunny', mult: 1, bps: 1, rest: 1, difficulty: 'easy', theme: 'classroom' }, { guest: true })}</div>`, () => lessonAfter({ guest: true }));

// ---------------------------------------------------------------- forms
async function submitForm(name, f){
  const err = f.querySelector('.form-error'); err.textContent = ''; const btn = f.querySelector('button[type="submit"]'); btn && (btn.disabled = true);
  const v = n => (f[n] && f[n].value || '').trim();
  try {
    if (name === 'login') { const u = await api.login(v('id'), f.password.value); state.flash = null; setSession(u); go(home(u)); }
    else if (name === 'forgot') { const r = await api.requestReset(v('email'));
      if (api.demo) { if (!r.demoUser) throw new Error('No teacher account uses that email.'); state.recovery = r.demoUser; go('reset'); return; }
      f.innerHTML = `<h1>Check your email</h1><p class="muted">If ${esc(v('email'))} has a FloWriter account, a reset link is on its way. It works once and expires in an hour.</p><a class="btn" href="#/login">Back to log in</a>`; return; }
    else if (name === 'reset') { const pw = f.password.value; if (!RULES.teacherPassword(pw)) throw new Error('Passwords need at least 8 characters and no spaces.');
      const u = await api.updatePassword(pw, typeof state.recovery === 'string' ? state.recovery : null); state.recovery = false; setSession(u); go(home(u)); setTimeout(() => toast('Password changed'), 100); }
    else if (name === 'signup') { const u = await api.signupTeacher({ name: v('name'), school: v('school'), email: v('email'), password: f.password.value, attest: f.attest.checked }); setSession(u); go('dashboard'); setTimeout(() => toast('Your class is ready. Share its code with students.'), 100); }
    else if (name === 'join-code') { const code = v('code').toUpperCase(); state.join.code = code; const c = await api.lookupClass(code); if (!c) throw new Error('That code doesn’t match an open class. Check it with your teacher.'); state.join.cls = c; userTouched = false; render(); }
    else if (name === 'join') { const nm = v('first').replace(/^./, c => c.toUpperCase()) + (v('last') ? ' ' + v('last').toUpperCase() + '.' : ''); const pw = v('password');
      const u = await api.joinClass({ code: state.join.code, name: nm, username: v('username'), password: pw }); setSession(u); state.join.done = { cls: state.join.cls.name, username: u.username, password: pw }; render(); }
  } catch (e) { err.textContent = e.message || 'Something went wrong. Try again.'; }
  btn && (btn.disabled = false);
}
