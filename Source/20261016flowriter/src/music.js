// =====================================================================
// Music: starter songs are synthesized in the browser (so the demo ships
// no audio files), rendered to WAV, and handed to the tracing engine as
// if the user had uploaded them. Uploaded MP3s get their BPM detected
// with the same onset + autocorrelation method the engine uses.
// =====================================================================
const Music = (() => {
  const SR = 22050;
  const PROG = { calm: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bright: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], bold: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]] };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  let noise = null;
  function noiseBuf(ctx){ if (noise && noise.sampleRate === ctx.sampleRate) return noise; const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noise = b; }

  function schedule(ctx, song, seconds, t0 = 0.5){
    const out = ctx.createGain(); out.gain.value = .55; out.connect(ctx.destination);
    const spb = 60 / song.bpm, beats = Math.floor((seconds - t0) / spb), prog = PROG[song.mood] || PROG.bright, nb = noiseBuf(ctx);
    const style = song.style || '';
    const kick = t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); g.gain.setValueAtTime(.95, t); g.gain.exponentialRampToValueAtTime(.001, t + .28); o.connect(g).connect(out); o.start(t); o.stop(t + .3); };
    const hit = (t, f, dur, vol, type = 'bandpass') => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; fl.type = type; fl.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * .5); s.stop(t + dur + .02); };
    const tone = (t, f, dur, vol, type = 'triangle', cut = 2400) => { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t + dur + .03); };
    for (let b = 0; b < beats; b++){
      const t = t0 + b * spb, bar = Math.floor(b / 4), pos = b % 4, ch = prog[bar % prog.length];
      // drums
      if (style === 'March') { kick(t); if (pos % 2) hit(t, 1800, .12, .5); hit(t + spb * .5, 1800, .06, .22); }
      else if (style === 'Ballad') { if (pos === 0) kick(t); if (pos === 2) hit(t, 1500, .2, .28); }
      else { if (pos === 0 || pos === 2 || (style === 'Funk' && pos === 3 && bar % 2)) kick(t); if (pos === 1 || pos === 3) hit(t, 1700, .16, .55); }
      hit(t, 8000, .04, style === 'Rock' ? .22 : .14, 'highpass');
      if (style !== 'Ballad') hit(t + spb / 2, 8000, .03, .09, 'highpass');
      // bass
      const root = ch[0] - 24;
      tone(t, hz(root + (style === 'Funk' && pos === 3 ? 12 : 0)), spb * .9, .32, style === 'Rock' ? 'sawtooth' : 'triangle', 600);
      // chords on bar start
      if (pos === 0) ch.forEach(n => tone(t, hz(n), spb * 3.6, .06, 'sine', 3000));
      // melody: simple arpeggio that walks the chord
      const mel = ch[(b + (bar % 2)) % 3] + 12;
      if (style !== 'March' || pos % 2 === 0) tone(t + (style === 'Lo-fi' ? spb * .5 : 0), hz(mel), spb * .6, .07, style === 'Rock' ? 'square' : 'triangle', 2600);
    }
  }

  async function renderSong(song, seconds){
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * seconds), SR);
    schedule(ctx, song, seconds);
    return ctx.startRendering();
  }
  function toWav(buf){
    const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++){ const s = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([ab], { type: 'audio/wav' });
  }
  // A File the engine plays like an uploaded song. The engine loops it, so a
  // short render is enough: 16 bars, about 30 to 60 seconds.
  const cache = {};
  async function starterFile(song){
    if (cache[song.id]) return cache[song.id];
    const seconds = .5 + 64 * 60 / song.bpm + .3;
    const buf = await renderSong(song, seconds);
    return cache[song.id] = new File([toWav(buf)], `${song.title} ${song.bpm}bpm.wav`, { type: 'audio/wav' });
  }

  // ---------- preview playback ----------
  let live = null, liveId = null;
  function stopPreview(){ if (live){ try { live.close(); } catch (e) {} live = null; } const id = liveId; liveId = null; return id; }
  async function preview(song, file){
    const was = stopPreview(); if (was === song.id) return null;
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); live = ctx; liveId = song.id;
    if (file){ const b = await ctx.decodeAudioData(await file.arrayBuffer()); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0, Math.min(20, b.duration * .2)); setTimeout(() => { if (live === ctx) stopPreview(); }, 12000); }
    else { schedule(ctx, song, 10, ctx.currentTime + .1); setTimeout(() => { if (live === ctx) stopPreview(); }, 10500); }
    return song.id;
  }

  // ---------- BPM detection (ported from the engine) ----------
  function fft(re, im, cosT, sinT, rev){ const n = re.length; for (let i = 0; i < n; i++){ const j = rev[i]; if (j > i){ let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } } for (let size = 2; size <= n; size <<= 1){ const half = size >> 1, step = n / size; for (let i = 0; i < n; i += size) for (let j = 0; j < half; j++){ const k = j * step, a = i + j, b = a + half, wr = cosT[k], wi = sinT[k]; const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b]; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } } }
  function envelope(buf, maxSec){
    const sr0 = buf.sampleRate, ds = Math.max(1, Math.round(sr0 / 22050)), sr = sr0 / ds, n = Math.floor(Math.min(buf.duration, maxSec) * sr), nc = buf.numberOfChannels, ch = [];
    for (let c = 0; c < nc; c++) ch.push(buf.getChannelData(c));
    const x = new Float32Array(n); for (let i = 0; i < n; i++){ let s = 0; const o = i * ds; for (let c = 0; c < nc; c++) for (let d = 0; d < ds; d++) s += ch[c][o + d] || 0; x[i] = s / (nc * ds); }
    const win = 512, hop = 128, fps = sr / hop, frames = Math.max(0, Math.floor((n - win) / hop));
    const cosT = new Float32Array(win / 2), sinT = new Float32Array(win / 2), rev = new Uint16Array(win), hann = new Float32Array(win);
    for (let k = 0; k < win / 2; k++){ cosT[k] = Math.cos(2 * Math.PI * k / win); sinT[k] = -Math.sin(2 * Math.PI * k / win); }
    const bits = Math.log2(win); for (let i = 0; i < win; i++){ let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    for (let i = 0; i < win; i++) hann[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (win - 1));
    const NB = 20, bins = win / 2, edges = []; for (let b = 0; b <= NB; b++) edges.push(Math.max(1, Math.min(bins, Math.round(40 * Math.pow(10000 / 40, b / NB) * win / sr))));
    const re = new Float32Array(win), im = new Float32Array(win), prev = new Float32Array(NB), env = new Float32Array(frames);
    for (let f = 0; f < frames; f++){ const o = f * hop; for (let i = 0; i < win; i++){ re[i] = x[o + i] * hann[i]; im[i] = 0; } fft(re, im, cosT, sinT, rev); let flux = 0; for (let b = 0; b < NB; b++){ const a = edges[b], z = Math.max(a + 1, edges[b + 1]); let e = 0; for (let k = a; k < z; k++) e += re[k] * re[k] + im[k] * im[k]; const m = Math.log1p(1000 * Math.sqrt(e / (z - a))); const d = m - prev[b]; if (d > 0) flux += d; prev[b] = m; } env[f] = flux; }
    const w = Math.round(fps * .25), out = new Float32Array(frames), pre = new Float64Array(frames + 1); for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + env[i];
    for (let i = 0; i < frames; i++){ const a = Math.max(0, i - w), b = Math.min(frames, i + w + 1); const v = env[i] - (pre[b] - pre[a]) / (b - a); out[i] = v > 0 ? v : 0; }
    return { env: out, fps };
  }
  function comb(env, period){ let best = -1; const N = env.length, P = Math.ceil(period); for (let ph = 0; ph < P; ph++){ let s = 0, c = 0; for (let t = ph; t < N - 1; t += period){ const i = Math.floor(t), f = t - i; s += env[i] * (1 - f) + env[i + 1] * f; c++; } s /= Math.max(1, c); if (s > best) best = s; } return best; }
  async function detectBpm(file){
    const m = file.name.match(/(\d{2,3}(?:\.\d+)?)\s*bpm/i); if (m && +m[1] >= 20 && +m[1] <= 400) { let duration = null; try { const c = new OfflineAudioContext(1, 1, 22050); duration = (await c.decodeAudioData(await file.arrayBuffer())).duration; } catch (e) {} return { bpm: +m[1], from: 'name', duration }; }
    const ctx = new OfflineAudioContext(1, 1, 22050);
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const { env, fps } = envelope(buf, 60), N = env.length; if (N < fps * 4) return { bpm: 100, from: 'default', duration: buf.duration };
    const minL = Math.floor(fps * 60 / 210), maxL = Math.ceil(fps * 60 / 50), ac = new Float32Array(2 * maxL + 2);
    for (let l = minL; l <= 2 * maxL + 1 && l < N; l++){ let s = 0; for (let i = 0; i + l < N; i++) s += env[i] * env[i + l]; ac[l] = s / (N - l); }
    const prior = b => Math.exp(-.5 * Math.pow(Math.log2(b / 115) / .9, 2));
    let bestL = minL, best = -1; for (let l = minL; l <= maxL; l++){ const sc = (ac[l] + .5 * (ac[2 * l] || 0)) * prior(60 * fps / l); if (sc > best){ best = sc; bestL = l; } }
    let bpm0 = 60 * fps / bestL, pickv = -1, pickb = bpm0;
    [1, 2, .5, 1.5, 2 / 3].forEach(f => { const c = bpm0 * f; if (c < 50 || c > 210) return; for (let b = c - 1.5; b <= c + 1.5; b += .25){ const v = comb(env, 60 * fps / b) * prior(b); if (v > pickv){ pickv = v; pickb = b; } } });
    let bpm = Math.round(pickb * 10) / 10; if (Math.abs(bpm - Math.round(bpm)) < .3) bpm = Math.round(bpm);
    return { bpm, from: 'audio', duration: buf.duration };
  }
  return { starterFile, preview, stopPreview, detectBpm, playing: () => liveId };
})();
