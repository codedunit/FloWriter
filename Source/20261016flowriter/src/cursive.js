// =====================================================================
// Cursive geometry for the app (the same math the tracing engine uses):
// lesson-builder previews, the homepage hero, and trace thumbnails.
// =====================================================================
const Cursive = (() => {
  const SLANT = 0.3, SPACE = .9, LINE_H = 3.9;
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  function crSeg(p0, p1, p2, p3, n, out, skipFirst){
    const d = (a, b) => Math.max(1e-4, Math.sqrt(dist(a, b)));
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const L = (a, b, ta, tb, t) => [(tb - t) / (tb - ta) * a[0] + (t - ta) / (tb - ta) * b[0], (tb - t) / (tb - ta) * a[1] + (t - ta) / (tb - ta) * b[1]];
    for (let i = skipFirst ? 1 : 0; i <= n; i++){
      const t = t1 + (t2 - t1) * i / n;
      const A1 = L(p0, p1, t0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t), B1 = L(A1, A2, t0, t2, t), B2 = L(A2, A3, t1, t3, t);
      out.push(L(B1, B2, t1, t2, t));
    }
  }
  const wordWidth = w => [...w].reduce((a, ch) => a + (LETTERS[ch] ? LETTERS[ch].w : 0), 0);
  // Lay text out in lines no wider than maxW units (Infinity = one line).
  function build(text, maxW = Infinity){
    const strokes = [], lines = []; let cur = [], curW = 0;
    (text || '').split(' ').filter(Boolean).forEach(w => { const ww = wordWidth(w); if (cur.length && curW + SPACE + ww > maxW) { lines.push(cur); cur = []; curW = 0; } curW += (cur.length ? SPACE : 0) + ww; cur.push(w); });
    if (cur.length) lines.push(cur);
    let maxX = 0;
    lines.forEach((words, ln) => {
      const yoff = -ln * LINE_H; let x = 0;
      words.forEach(word => {
        let prevEy = .1, prevJoin = false; const lifts = [];
        [...word].forEach(ch => {
          const L = LETTERS[ch]; if (!L) return; const startLift = !prevJoin || !!L.cap || !!L.punct;
          L.s.forEach((s, si) => {
            const ctrl = s.p.map(p => [p[0], p[1]]);
            if (si === 0 && !startLift) { ctrl[0] = [0, prevEy]; if (prevEy > .5) { let e = 1; while (e < ctrl.length - 1 && ctrl[e][1] < .55) e++; ctrl.splice(1, e - 1); } }
            const lift = si === 0 ? startLift : !!s.lift, defer = !!s.lift && !L.cap && !L.punct;
            (defer ? lifts : strokes).push({ ch, name: s.n, line: ln, j: lift ? false : (si === 0 ? true : !!s.j), lift, ctrl: ctrl.map(p => [p[0] + x, p[1] + yoff]) });
          });
          x += L.w; prevEy = L.ey ?? .1; prevJoin = !L.nj && !L.punct;
        });
        strokes.push(...lifts); x += SPACE;
      });
      maxX = Math.max(maxX, x - SPACE);
    });
    const refl = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
    strokes.forEach((s, k) => {
      const P = s.ctrl, n = P.length;
      const before = s.j && k > 0 ? strokes[k - 1].ctrl[strokes[k - 1].ctrl.length - 2] : refl(P[0], P[1]);
      const nx = strokes[k + 1]; const after = nx && nx.j ? nx.ctrl[1] : refl(P[n - 1], P[n - 2]);
      const ext = [before, ...P, after], raw = [];
      for (let i = 1; i < ext.length - 2; i++) crSeg(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], 14, raw, i > 1);
      const base = -s.line * LINE_H;
      s.pts = raw.map(p => [p[0] + (p[1] - base) * SLANT, p[1]]);
    });
    return { strokes, lines: lines.length, width: maxX + 2.2 * SLANT };
  }
  // Draw ruled paper + model text into a canvas context. Returns the layout.
  function drawModel(g, text, { x = 0, y = 0, w = 600, xh = 32, ink = '#333', rule = '#9ab', rule2 = '#cdd', pad = 14, wrap = true, line = 2.4 } = {}){
    const maxW = wrap ? (w - 2 * pad) / xh - .8 : Infinity, L = build(text, maxW);
    const X = u => x + pad + u * xh, Y = (v) => y + pad + 2.5 * xh - v * xh;
    for (let l = 0; l < L.lines; l++){ const o = -l * LINE_H;
      [[2.2, rule2, []], [1, rule2, [5, 5]], [0, rule, []], [-1, rule2, []]].forEach(([v, c, d]) => { g.setLineDash(d); g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y(v + o)); g.lineTo(x + w, Y(v + o)); g.stroke(); }); }
    g.setLineDash([]); g.strokeStyle = ink; g.lineWidth = line; g.lineCap = 'round'; g.lineJoin = 'round';
    L.strokes.forEach(s => { g.beginPath(); s.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); });
    return { ...L, X, Y, height: pad * 2 + (2.5 + 1.3 + (L.lines - 1) * LINE_H) * xh };
  }
  const height = (lines, xh, pad = 14) => pad * 2 + (2.5 + 1.3 + (lines - 1) * LINE_H) * xh;
  // Rough beat count for a text at 1 beat per stroke (count-in + strokes + rests + lifts).
  function beats(text, bps = 1, rest = 1){
    const L = build(text); let b = 4; let words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    L.strokes.forEach((s, i) => { b += bps; if (s.lift && i) b += 1; });
    return { beats: b + Math.max(0, words - 1) * (rest - 1), strokes: L.strokes.length };
  }
  return { build, drawModel, height, beats, SLANT, LINE_H };
})();
