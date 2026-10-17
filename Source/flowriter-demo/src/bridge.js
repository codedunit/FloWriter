// Injected at the end of an engine page when it runs inside the FloWriter shell.
// It only drives the engine through its own controls, so the engine code is untouched.
(() => {
  const P = window.__FW || {}, $ = id => document.getElementById(id);
  const post = m => parent.postMessage(Object.assign({ fw: 1, ch: P.ch }, m), '*');
  const fire = (el, type, init) => el && el.dispatchEvent(new (type === 'keydown' ? KeyboardEvent : Event)(type, Object.assign({ bubbles: true }, init || {})));

  if (P.theme) document.documentElement.dataset.theme = P.theme;
  if (P.lesson && $('lessonName')) { $('lessonName').value = P.lesson; fire($('lessonName'), 'input'); }
  if (P.word) { const cw = $('customWord'); cw.value = P.word; fire(cw, 'input'); fire(cw, 'keydown', { key: 'Enter' }); }
  if (P.bps) { const b = document.querySelector(`[data-bps="${P.bps}"]`); b && b.click(); }
  if (P.tol) { $('tol').value = P.tol; fire($('tol'), 'input'); }
  if (P.bpm) { const r = $('bpm'); r.value = Math.max(60, Math.min(140, P.bpm)); fire(r, 'input'); }
  if (P.role === 'student' && $('lockBtn')) $('lockBtn').click();
  else if (P.start === 'write') { const g = document.querySelector('#view-setup [data-go="write"]'); g && g.click(); }

  // shell messages: theme and backing track
  addEventListener('message', e => {
    const m = e.data || {}; if (!m.fwShell) return;
    if (m.theme) document.documentElement.dataset.theme = m.theme;
    if (m.track) {
      const input = $('trackFile'); if (!input) return;
      try { const dt = new DataTransfer(); dt.items.add(m.track); input.files = dt.files; fire(input, 'change'); } catch (err) { post({ type: 'trackFail' }); return; }
      // the engine switches to the track on its own, but keep the student on the writing page
      if (P.role === 'student' || P.start === 'write') setTimeout(() => { const v = $('view-write'); if (v && v.hidden) { const g = document.querySelector('[data-go="write"]'); g && g.click(); } }, 60);
      const wait = setInterval(() => { const n = $('metroBpm'); if (n && /BPM/.test(n.textContent)) { clearInterval(wait); post({ type: 'trackReady', bpm: parseFloat(n.textContent) }); } }, 200);
      setTimeout(() => clearInterval(wait), 15000);
    }
  });

  // height: let the shell size the frame so the page scrolls as one notebook
  const sendH = () => post({ type: 'h', h: Math.ceil(document.documentElement.scrollHeight) });
  new ResizeObserver(sendH).observe(document.body); sendH();

  // view changes
  ['setup', 'write', 'results'].forEach(v => { const el = $('view-' + v); el && new MutationObserver(() => { if (!el.hidden) post({ type: 'view', v }); sendH(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] }); });

  // finished attempts: the engine writes "Practice · …" or "Test · …" into #runInfo
  let last = '';
  const run = $('runInfo');
  new MutationObserver(() => {
    const t = run.textContent, m = /^(Practice|Test|On your own) ·/.exec(t);
    if (!m) { last = ''; return; }
    if (t === last) return; last = t;
    setTimeout(() => {
      const valid = +$('scoreBig').textContent || 0, total = +(($('scoreOf').textContent.match(/of (\d+)/) || [])[1] || 0);
      const mode = m[1] === 'On your own' ? 'check' : m[1].toLowerCase();
      // "On your own" runs with no music at all, so it carries no tempo
      const bpm = mode === 'check' ? null : (parseFloat((t.match(/([\d.]+) BPM/) || [])[1]) || P.bpm);
      // which level of help practice ran with, so a fading schedule can be read back later
      const gate = mode === 'practice' ? (/thinned out/.test(t) ? 'duck' : /no help/.test(t) ? 'off' : 'hold') : null;
      let img = null;
      try { const c = $('pad'), s = document.createElement('canvas'), w = 640; s.width = w; s.height = Math.round(c.height * w / c.width); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); img = s.toDataURL('image/jpeg', .82); } catch (e) {}
      const word = ($('customWord').value || '').trim() || null;
      post({ type: 'result', mode, gate, valid, total, bpm, img, word });
    }, 350);
  }).observe(run, { childList: true, characterData: true, subtree: true });

  // activity without idling: pen movement on the page counts
  let lastPing = 0;
  $('pad').addEventListener('pointermove', () => { const n = Date.now(); if (n - lastPing > 5000) { lastPing = n; post({ type: 'active' }); } });
  post({ type: 'ready' });
})();
