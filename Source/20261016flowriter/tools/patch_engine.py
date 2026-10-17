"""One-time patch of src/engine.html for the pilot. Each replacement must match exactly once."""
import pathlib, re, sys
P = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'engine.html'
s = P.read_text()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'expected {count} match(es), found {n}:\n{old[:160]}')
    s = s.replace(old, new)

def rep_between(start, end, new):
    """Replace from `start` (inclusive) up to `end` (exclusive)."""
    global s
    a = s.index(start); b = s.index(end, a)
    assert s.count(start) == 1, start
    s = s[:a] + new + s[b:]

# ---------------------------------------------------------------- BPM: no caps (bug 6)
rep('<input id="bpm" type="range" min="60" max="140" step="1" value="84">',
    '<input id="bpm" type="range" min="20" max="320" step="1" value="84">')
rep('<input id="trackBpm" class="num" type="number" min="40" max="220" step="0.1" value="100">',
    '<input id="trackBpm" class="num" type="number" min="1" step="0.1" value="100">')
rep("const scaleBpm=f=>{ if(!S.track) return; const v=Math.round(S.track.bpm*f*100)/100; if(v<40||v>220) return;",
    "const scaleBpm=f=>{ if(!S.track) return; const v=Math.round(S.track.bpm*f*100)/100; if(!(v>0)||!isFinite(v)) return; // no cap: ½× and 2× can be pressed as often as you like")
rep("const v=+e.target.value; if(!(v>=40&&v<=220)) return;", "const v=+e.target.value; if(!(v>0)||!isFinite(v)) return;")
rep("named=m&&+m[1]>=40&&+m[1]<=220?+m[1]:null", "named=m&&+m[1]>=20&&+m[1]<=400?+m[1]:null")

# ---------------------------------------------------------------- constants
rep("const RULES = {inside:.8, cover:.7, onTime:.6};",
    "const RULES = {pass:.7, onTime:.6, dir:.5}; // a stroke counts at 70%; drawn more backwards than forwards = wrong direction\n"
    "const TRAVEL = 1; // beats to lift the pen and get to a dot, a cross, or the letter after a capital that doesn't join\n"
    "// Fixed writing size: the x-height in CSS pixels never depends on how much text there is.\n"
    "const XH = w => w>=760?48:w>=520?38:30;")

# ---------------------------------------------------------------- host config (the FloWriter app)
rep("  lesson:'', locked:false, testDone:false, testSnap:null};",
    "  lesson:'', locked:false, testDone:false, testSnap:null, testMode:false};\n"
    "// When the FloWriter app embeds this page it passes a config. The page then runs as one lesson:\n"
    "// watch the demo, practice with the music, then one graded test with no music.\n"
    "const HOST = window.__FW || null;\n"
    "const PILOT = !!HOST;\n"
    "function emit(m){ if(HOST&&window.parent!==window) window.parent.postMessage(Object.assign({fw:1,ch:HOST.ch},m),'*'); }")

# ---------------------------------------------------------------- buildWord: travel beats + stroke length
rep("            wi, ws:!firstWord&&ci===0&&si===0, // first stroke of a new word: a rest (the space) comes before it",
    "            wi, ws:!firstWord&&ci===0&&si===0, // first stroke of a new word: a rest (the space) comes before it\n"
    "            travel:lift&&!(ci===0&&si===0), // a pen lift inside a word (dot, cross, after a capital that doesn't join)")
rep("    s.pts=resample(raw.map(p=>[p[0]+(p[1]-base)*SLANT,p[1]]),.015);",
    "    s.pts=resample(raw.map(p=>[p[0]+(p[1]-base)*SLANT,p[1]]),.015);\n"
    "    s.len=s.pts.reduce((a,p,i)=>i?a+dist(s.pts[i-1],p):0,0);")

# ---------------------------------------------------------------- fixed size layout (bug 4)
rep_between("function wrapFor(w){", "const X=u=>offX+u*scale",
"""function wrapFor(w){ const padX=Math.max(22,w*.05); return Math.max(4,(w-2*padX)/XH(w)-TOP*SLANT-.3); }
function layout(){
  // The letters are always XH(width) pixels tall at the x-height. More text means more lines and pages,
  // never smaller letters. The only exception is one word too long for a line on a narrow screen.
  W=stageWidth(); dpr=window.devicePixelRatio||1;
  let minX=1e9,maxX=-1e9;
  S.strokes.forEach(s=>s.pts.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);}));
  if(!isFinite(minX)){ minX=0; maxX=1; }
  const n=S.rows||1, Y1=2.6, Y0=-(n-1)*LINE_H-1.3, padX=Math.max(22,W*.05), bw=maxX-minX;
  scale=XH(W);
  if(bw*scale>W-2*padX) scale=(W-2*padX)/bw;
  H=Math.round((Y1-Y0)*scale+40);
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); cv.style.height=H+'px';
  offX=padX-minX*scale;
  offY=20+Y1*scale;
}
""")

# ---------------------------------------------------------------- timing with travel beats (bug 1)
rep_between("function timing(){", "function windowOf(k)",
"""function timing(){
  let b=COUNT_IN; S.restBeats=new Set(); S.goBeats=new Set(); S.travelBeats=new Set(); S.startAt=new Map();
  S.strokes.forEach((s,i)=>{
    s.gap=0;
    if(s.ws){ for(let r=0;r<S.rest;r++) S.restBeats.add(b+r); b+=S.rest; S.goBeats.add(b); s.gap=S.rest; }
    else if(s.travel){ for(let r=0;r<TRAVEL;r++) S.travelBeats.add(b+r); b+=TRAVEL; s.gap=TRAVEL; } // one beat to lift and reach the dot or cross
    s.b0=b; S.startAt.set(b,i); b+=S.bps;
  });
  S.total=b;
}
""")
rep("const remaining=Math.max(0,s.b0-S.beat), frac=Math.min(1,remaining/Math.max(1,S.rest));",
    "const gap=s.gap||S.rest, remaining=Math.max(0,s.b0-S.beat), frac=Math.min(1,remaining/Math.max(1,gap));")
rep("drawTag(px,py,remaining>S.rest*.5&&S.rest>0?(newPage?'New page · lift your pen':'Lift your pen'):'Ready…',false);",
    "drawTag(px,py,remaining>gap*.5&&gap>0?(s.travel?liftWhat(s):newPage?'New page · lift your pen':'Lift your pen'):'Ready…',false);")
rep("function drawTag(px,py,text,solid){",
    "const liftWhat=s=>s.name==='dot'?`Lift · dot the ${s.ch}`:/cross/.test(s.name)?`Lift · cross the ${s.ch}`:'Lift your pen';\nfunction drawTag(px,py,text,solid){")
rep("    if(S.restBeats.has(b)){ tone(mtof(79),t,.14,'triangle',.08); tone(mtof(72),t+spb*.5,.14,'triangle',.06); }",
    "    if(S.restBeats.has(b)||S.travelBeats.has(b)){ tone(mtof(79),t,.14,'triangle',.08); tone(mtof(72),t+spb*.5,.14,'triangle',.06); }")
rep("  if(S.restBeats.has(b)){ // rest: soft falling \"lift\" cue instead of the stroke pluck",
    "  if(S.restBeats.has(b)||S.travelBeats.has(b)){ // rest or pen lift: soft falling \"lift\" cue instead of the stroke pluck")
# lane cells for travel beats
rep("r.dataset.rest=s.b0-S.rest;", "r.dataset.rest=s.b0-S.rest; r.dataset.len=S.rest;")
rep("""      b.appendChild(r);
    }
    place(S.bps);""",
"""      b.appendChild(r);
    } else if(s.travel){
      place(s.gap);
      const r=document.createElement('div'); r.className='cell rest lift'; r.dataset.rest=s.b0-s.gap; r.dataset.len=s.gap;
      r.innerHTML=`<span class="ch">lift</span><span class="ix">${s.name==='dot'?'dot':/cross/.test(s.name)?'cross':'move'}</span>`; r.setAttribute('aria-label','Lift the pen');
      b.appendChild(r);
    }
    place(S.bps);""")
rep("const r0=+c.dataset.rest, on=S.playing&&S.beat>=r0&&S.beat<r0+S.rest;",
    "const r0=+c.dataset.rest, on=S.playing&&S.beat>=r0&&S.beat<r0+(+c.dataset.len||S.rest);")
rep("""    else if(S.next>=0){ const n=Math.max(1,Math.ceil(S.strokes[S.next].b0-S.beat)), np=S.next>0&&S.strokes[S.next-1].page!==S.strokes[S.next].page;
      L.innerHTML=`Rest""",
"""    else if(S.next>=0&&S.strokes[S.next].travel){ const nx=S.strokes[S.next];
      L.innerHTML=`<b>Lift your pen</b> · ${nx.name==='dot'?`dot the <b>${esc(nx.ch)}</b>`:/cross/.test(nx.name)?`cross the <b>${esc(nx.ch)}</b>`:`on to <b>${esc(nx.ch)}</b>`} on the next beat`; }
    else if(S.next>=0){ const n=Math.max(1,Math.ceil(S.strokes[S.next].b0-S.beat)), np=S.next>0&&S.strokes[S.next-1].page!==S.strokes[S.next].page;
      L.innerHTML=`Rest""")

# ---------------------------------------------------------------- grading: distance at every point + direction (bugs 3, 7)
rep_between("function evaluate(k){", "function rescoreAll()",
"""// Every stroke scores 0 to 1 from how far the pen was from the model line at every point:
//   path = for each point along the model stroke, how close the nearest ink came (skipped parts score 0)
//   ink  = for each point the child drew, how close it is to the line
// Closeness: full credit within 35% of the margin, half credit at the margin's edge, nothing at twice the margin.
// A stroke drawn backwards scores 0 however close to the line it is.
function closeness(d){
  const t=S.tol, a=t*.35, b=t, c=t*2;
  if(d<=a) return 1; if(d<=b) return 1-.5*(d-a)/(b-a); if(d<=c) return .5*(1-(d-b)/(c-b)); return 0;
}
function direction(s,pts){
  // share of the pen's travel along the stroke that went forward. Closed shapes (a, o, the oval in d)
  // start and end at the same spot, so a big jump in the nearest point re-anchors instead of counting.
  const n=s.pts.length; if(s.len<.35||pts.length<4) return null;
  let fw=0,bw=0,prev=null,seg=null;
  for(const p of pts){
    if(p.d>S.tol*2) continue;
    const i=nearestOn(s,p.x,p.y).i;
    if(prev!=null&&p.seg===seg){ const di=i-prev; if(Math.abs(di)<=n*.25){ if(di>0) fw+=di; else bw-=di; } }
    prev=i; seg=p.seg;
  }
  const tot=fw+bw; return tot<n*.15?null:fw/tot;
}
function evaluate(k){
  // Test runs have no beat, so timing is not part of any score. Practice also reports "on the beat" for information.
  const untimed=S.attemptUntimed;
  const s=S.strokes[k], pts=S.points.filter(p=>p.k===k&&(untimed||p.t!=null));
  if(pts.length<(s.len<.25?1:3)){ s.res={status:'missed',score:0,path:0,ink:0,dir:null,onTime:untimed?null:0,n:pts.length,untimed}; return; }
  const ink=pts.reduce((a,p)=>a+closeness(p.d),0)/pts.length;
  let path=0;
  for(const m of s.pts){ let best=1e9; for(const p of pts){ const dx=p.x-m[0],dy=p.y-m[1],d=dx*dx+dy*dy; if(d<best) best=d; } path+=closeness(Math.sqrt(best)); }
  path/=s.pts.length;
  const dir=direction(s,pts), reversed=dir!=null&&dir<RULES.dir;
  let onTime=null;
  if(!untimed){ const [a,b]=windowOf(k); onTime=pts.filter(p=>p.t>=a-.1*S.bps&&p.t<b+.1*S.bps).length/pts.length; }
  const score=reversed?0:.6*path+.4*ink;
  s.res={status:reversed?'reversed':score>=RULES.pass?'valid':'off',score,path,ink,dir,onTime,n:pts.length,untimed};
}
const attemptScore=()=>{ const N=S.strokes.length; return N?S.strokes.reduce((a,s)=>a+(s.res?s.res.score:0),0)/N:0; };
""")
rep("if(s.res){ col=s.res.status==='valid'?C.ok:s.res.status==='off'?C.bad:C.missed; dash=[]; w=mw; a=.55; }",
    "if(s.res){ col=s.res.status==='valid'?C.ok:s.res.status==='missed'?C.missed:C.bad; dash=[]; w=mw; a=.55; }")
rep("const col=s.res?(s.res.status==='valid'?C.ok:s.res.status==='off'?C.bad:C.missed):C.ink;",
    "const col=s.res?(s.res.status==='valid'?C.ok:s.res.status==='missed'?C.missed:C.bad):C.ink;")
rep(".cell.missed{border-style:dashed;border-color:var(--missed)}",
    ".cell.missed{border-style:dashed;border-color:var(--missed)}\n.cell.reversed{background:color-mix(in srgb,var(--bad) 13%,var(--surface));border-color:var(--bad);border-style:dotted}")
rep(".status.valid{color:var(--ok)} .status.off{color:var(--bad)}",
    ".status.valid{color:var(--ok)} .status.off,.status.reversed{color:var(--bad)}")

rep_between("function renderResults(){", "$('letters').addEventListener",
"""function renderResults(){
  const timed=!S.attemptUntimed;
  const N=S.strokes.length, scored=S.strokes.filter(s=>s.res), cnt=st=>scored.filter(s=>s.res.status===st).length;
  const valid=cnt('valid'), off=cnt('off'), rev=cnt('reversed'), missed=cnt('missed'), pending=N-scored.length;
  $('scoreBig').textContent=Math.round(attemptScore()*100)+'%';
  $('scoreOf').textContent=`${valid} of ${N} strokes on the line`+(S.sample?' (sample)':'');
  const m=$('meter'); m.innerHTML='';
  [[valid,C.ok],[off,C.bad],[rev,C.accent],[missed,C.missed]].forEach(([n,c])=>{ if(n){const i=document.createElement('i'); i.style.width=(n/N*100)+'%'; i.style.background=c; m.appendChild(i);} });
  $('legend').innerHTML=[[valid,'ok','on the line'],[off,'bad','off the line'],[rev,'accent','wrong direction'],[missed,'missed','missed']]
    .filter(([n],i)=>n||i<2).map(([n,c,l])=>`<span><i style="background:var(--${c})"></i>${n} ${l}</span>`).join('')+(pending&&!S.playing?`<span>${pending} not traced</span>`:'');

  const r=S.lastRun; let run;
  if(S.sample) run='Sample attempt. Watch the demo, then practice to see your own results.';
  else if(r&&r.mode==='check') run=`${MODE_NAME.check} · no music · scored on how closely you followed the line, in the right direction · margin ${Math.round(S.tol*100)}%`;
  else if(r) run=`${MODE_NAME[r.mode]} · ${r.mode==='practice'?(r.gate==='duck'?'music thinned out when your pen left the path':r.gate==='off'?'music kept going, no help':'music followed your pen'):r.mode==='test'?'you followed the music':'model pen'} · ${fmtBpm(r.bpm)} BPM · ${S.bps} beat${S.bps>1?'s':''} per stroke · margin ${Math.round(S.tol*100)}%`+(r.mode==='practice'&&r.gate==='hold'?` · music paused ${r.pauses}×`:'');
  else run=S.points.length?'Free trace (not timed).':'No attempt yet.';
  $('runInfo').textContent=run;

  const tr=scored.filter(s=>s.res.status!=='missed');
  const avg=f=>tr.length?tr.reduce((a,s)=>a+(s.res[f]||0),0)/tr.length:null;
  const am=(v,rule,name,sub)=>`<div class="metric"><span class="n ${v==null?'':v>=rule?'pass':'fail'}">${v==null?'–':pct(v)}</span><span class="k">${name}</span><span class="t">${sub}</span></div>`;
  $('avgs').innerHTML=am(avg('path'),RULES.pass,'path followed','closeness at every point of the model')+am(avg('ink'),RULES.pass,'ink on the line','closeness at every point you drew')+(timed?am(avg('onTime'),RULES.onTime,'on the beat','for information, not scored'):'');

  const offS=scored.filter(s=>s.res.status==='off');
  const iss=[['Wandered off the line',offS.filter(s=>s.res.ink<RULES.pass).length],
             ['Skipped part of a stroke',offS.filter(s=>s.res.path<RULES.pass).length],
             ['Went the wrong direction',rev],
             ['Missed completely',missed]];
  const mx=Math.max(1,...iss.map(i=>i[1]));
  $('issues').innerHTML=iss.map(([l,n])=>`<div class="issue"><span>${l}</span><span class="trk"><i style="width:${n/mx*100}%"></i></span><b>${n}</b></div>`).join('');

  const by=new Map();
  S.strokes.forEach((s,k)=>{ let e=by.get(s.li); if(!e){ e={li:s.li,ch:s.ch,word:s.word,n:0,sum:0,bad:0,k:-1}; by.set(s.li,e); }
    e.n++; e.sum+=s.res?s.res.score:0; if(s.res&&s.res.status!=='valid'){ e.bad++; if(e.k<0) e.k=k; } });
  const selLi=S.strokes[S.selected]?S.strokes[S.selected].li:-1;
  const list=[...by.values()].filter(e=>e.bad).sort((a,b)=>a.sum/a.n-b.sum/b.n||a.li-b.li).slice(0,14);
  $('letters').innerHTML=list.length
    ?list.map(e=>`<button type="button" class="lt${e.li===selLi?' sel':''}" data-k="${e.k}" title="In “${esc(e.word)}”"><span class="ch">${esc(e.ch)}</span><span class="ix">${pct(e.sum/e.n)}</span></button>`).join('')
    :`<p class="note">${scored.length?'Every letter counted. Nice work.':'Nothing scored yet.'}</p>`;

  const box=$('insp'); const k=S.playing?S.active:S.selected;
  if(k==null||k<0||k>=N){ box.innerHTML=`<p class="note">${S.playing?'Get ready. The first stroke starts on the downbeat after the count-in.':'Tap a stroke in the beat map to see how it was scored.'}</p>`; return; }
  const s=S.strokes[k], rs=s.res, st=rs?rs.status:'pending';
  const label={valid:'On the line',off:'Off the line',reversed:'Wrong direction',missed:'Missed',pending:S.playing?'In progress':'Not traced'}[st];
  const [a,b]=windowOf(k), sTimed=rs?!rs.untimed:timed;
  const metric=(v,rule,name,sub)=>`<div class="metric"><span class="n ${rs&&rs.status!=='missed'&&v!=null?(v>=rule?'pass':'fail'):''}">${rs&&v!=null?pct(v):'–'}</span><span class="k">${name}</span><span class="t">${sub}</span></div>`;
  let why='';
  if(rs&&rs.status==='reversed') why='<p class="note">Drawn backwards. Start at the big dot and follow the arrow.</p>';
  else if(rs&&rs.status==='off'){
    const fails=[]; if(rs.ink<RULES.pass) fails.push('the pen wandered away from the line'); if(rs.path<RULES.pass) fails.push('part of the stroke was skipped');
    why=`<p class="note">Below ${pct(RULES.pass)}: ${fails.join(', ')||'the pen stayed a little too far from the line'}.</p>`;
  } else if(rs&&rs.status==='missed') why=`<p class="note">${sTimed?'No ink landed in this stroke’s beat window.':'No ink landed on this stroke.'}</p>`;
  else if(rs) why='<p class="note">Counted. The pen stayed close to the line the whole way, in the right direction.</p>';
  box.innerHTML=`<div class="insp-title"><span class="glyph">${s.ch}</span><div><h2>Stroke ${s.si+1} of ${s.of}: ${s.name}</h2><span class="note">${sTimed?`Beats ${a-COUNT_IN+1}${S.bps>1?'–'+(b-COUNT_IN):''} · `:''}${rs?rs.n+' ink points':'no ink yet'}</span></div><span class="status ${st}">${label}</span></div>
    <div class="metrics">${metric(rs?rs.score:0,RULES.pass,'stroke score','needs '+pct(RULES.pass))}${metric(rs?rs.path:0,RULES.pass,'path followed','every point of the model')}${metric(rs?rs.ink:0,RULES.pass,'ink on the line','every point you drew')}${sTimed?metric(rs?rs.onTime:0,RULES.onTime,'on the beat','not scored'):''}</div>${why}`;
}
""")

# ---------------------------------------------------------------- looping music (bug 5)
rep_between("function playTrack(T,pos,fade){", "function stopTrack(fade){",
"""// The song loops on whole bars from beat 1, so a long text never runs out of music and the beat grid stays on the beat.
function loopRegion(){
  const T=S.track, songSp=60/(T.baseBpm||T.bpm), avail=T.duration-T.offset-.05;
  let len=Math.floor(avail/(4*songSp))*4*songSp; if(len<songSp*4) len=Math.max(songSp,Math.floor(avail/songSp)*songSp);
  return {start:T.offset, end:T.offset+len, len};
}
function wrapPos(pos){ if(!S.track) return pos; const L=loopRegion(); return pos<L.end?pos:L.start+((pos-L.start)%L.len); }
const trackPos=beat=>wrapPos(S.track.offset+beat*spb);
function playTrack(T,pos,fade){
  // each play gets its own gain so a pause can fade it out without touching the next one
  const src=actx.createBufferSource(), g=actx.createGain(); src.buffer=S.track.buf; src.connect(g).connect(trackGain);
  const L=loopRegion(); src.loop=true; src.loopStart=L.start; src.loopEnd=L.end;
  g.gain.setValueAtTime(fade?0:1,T); if(fade) g.gain.linearRampToValueAtTime(1,T+fade);
  src.start(T,Math.max(0,wrapPos(pos))); trackNode={src,g};
}
""")
rep("if(S.track){ drawWave(S.track.offset+S.beat*spb);", "if(S.track){ drawWave(trackPos(S.beat));", 0) if False else None
rep("drawWave(S.track.offset+S.beat*spb);", "drawWave(trackPos(S.beat));")
rep_between("function updateTrackInfo(){", "function detectFirstBeat(buf){",
"""function updateTrackInfo(){
  const el=$('trackInfo'); if(!el) return;
  if(S.src!=='track'||!S.track){ el.textContent=''; el.classList.remove('warn'); return; }
  const sp=60/S.track.bpm, needed=(S.total+.5)*sp, L=loopRegion();
  const what=S.word.includes(' ')?'This text':'This word';
  el.classList.remove('warn');
  el.textContent=needed>L.len?`${what} needs ${fmtTime(needed)} of music. The track loops every ${fmtTime(L.len)}, so it keeps playing to the end.`
    :`${what} uses ${fmtTime(needed)} of the track (${S.total} beats including the count-in).`;
}
""")

# ---------------------------------------------------------------- the test is the no-music run, one try (pilot)
rep("const MODE_NAME={practice:'Practice',test:'Test',demo:'Demo',check:'On your own'};",
    "const MODE_NAME={practice:'Practice',test:'Test with music',demo:'Demo',check:(window.__FW?'Test':'On your own')};")
rep("  } else if(S.checking) L.innerHTML=S.points.length\n      ?'<b>On your own</b> · no music · tap <b>Score my writing</b> when the whole word is written'\n      :'<b>On your own</b> · no music, no beat · write the word at your own pace';",
    "  } else if(S.checking) L.innerHTML=S.points.length\n      ?`<b>${MODE_NAME.check}</b> · no music · tap <b>${S.testMode?'Submit test':'Score my writing'}</b> when you have written everything`\n      :`<b>${MODE_NAME.check}</b> · no music, no beat · write it at your own pace`;")
rep("if(r&&r.mode==='check') L.innerHTML=`On your own · <b>",
    "if(r&&r.mode==='check') L.innerHTML=`${MODE_NAME.check} · <b>")
rep("const cd=$('checkDone'); if(cd){ cd.hidden=!S.checking; cd.disabled=!S.checking||!S.points.length; }",
    "const cd=$('checkDone'); if(cd){ cd.hidden=!S.checking; cd.disabled=!S.checking||!S.points.length; cd.textContent=S.testMode?'Submit test':'Score my writing'; }")

rep_between("function startCheck(){", "function tick(){",
"""function startCheck(asTest){
  // no music, no beat, no pacing dot: the child writes everything, then asks to be scored
  stop(); if(typeof stopCheck==='function') stopCheck();
  clearAttempt(); S.lastRun=null;
  S.checking=true; S.attemptUntimed=true; S.mode='check'; S.testMode=!!asTest; S.beat=-1; S.active=-1; S.pauses=0;
  setControlsLocked(true); syncUI(); render();
}
function finishCheck(){
  S.strokes.forEach((s,k)=>evaluate(k));
  S.checking=false; S.finished=true; S.mode=null; S.penDown=false; S.active=-1;
  S.lastRun={mode:'check',bpm:null,pauses:0,gate:null};
  const wasTest=S.testMode; S.testMode=false;
  setControlsLocked(false);
  const firstBad=S.strokes.findIndex(s=>s.res.status!=='valid');
  S.selected=firstBad>=0?firstBad:S.strokes.length-1;
  setPage(S.strokes[S.selected]?S.strokes[S.selected].page:0);
  syncUI(); render();
  if(wasTest){ emitRun('test'); saveTest(); showView('results'); }
}
""")
rep("  if(mode==='test'){ saveTest(); showView('results'); } // the one test attempt goes straight to results; practice stays on the lesson",
    "  emitRun(mode);\n  if(mode==='test'){ saveTest(); showView('results'); } // the one test attempt goes straight to results; practice stays on the lesson")
rep("$('checkBtn').addEventListener('click',()=>startCheck());", "$('checkBtn').addEventListener('click',()=>startCheck(false));")
rep("  clearTimeout(testConfirm); testConfirm=null; start('test');",
    "  clearTimeout(testConfirm); testConfirm=null; if(PILOT) startCheck(true); else start('test');")
rep("$('clearBtn').addEventListener('click',()=>{ if(S.checking){ clearAttempt(); syncUI(); render(); return; }",
    "$('clearBtn').addEventListener('click',()=>{ if(S.checking&&S.testMode) return; if(S.checking){ clearAttempt(); syncUI(); render(); return; }")
rep("  $('clearBtn').textContent=on?(S.mode==='test'?'End test':S.mode==='check'?'Start over':'Stop'):'Clear';",
    "  $('clearBtn').textContent=on?(S.mode==='test'?'End test':S.mode==='check'?'Start over':'Stop'):'Clear';\n  $('clearBtn').hidden=on&&S.testMode; // the test can't be started over")

rep_between("function updateModes(){", "function syncUI(){",
"""function updateModes(){
  const map={demo:$('demoBtn'),practice:$('pracBtn'),test:$('testBtn'),check:$('checkBtn')};
  Object.entries(map).forEach(([m,b])=>{ b.disabled=S.playing||S.checking; b.classList.toggle('running',(S.playing&&S.mode===m)||(m==='check'&&S.checking&&!S.testMode)||(m==='test'&&S.checking&&S.testMode)); b.classList.remove('primary'); });
  const gated=PILOT&&HOST.role!=='preview';
  const testInfo=S.testSnap?{valid:S.testSnap.res.filter(r=>r&&r.status==='valid').length,total:S.testSnap.res.length,score:S.testSnap.score}:(HOST&&HOST.progress&&HOST.progress.test)||null;
  // step 1 -> 2 -> 3: practice opens after one demo, the test after one practice run
  const pracLocked=gated&&!S.demoWatched, testLocked=gated&&S.practiceRuns<1;
  if(pracLocked) map.practice.disabled=true;
  if(testLocked&&!S.testDone) map.test.disabled=true;
  if(!S.demoWatched) map.demo.classList.add('primary');
  else if(!S.practiceRuns&&!S.playing) map.practice.classList.add('primary');
  else if(!S.testDone&&!S.playing&&!S.checking) map.test.classList.add('primary');
  $('demoBadge').hidden=S.demoWatched;
  $('pracMd').textContent=pracLocked?'Unlocks after you watch the demo.':'The music follows your pen. It waits for you when you lift.';
  $('writeHint').textContent=S.testDone
    ?'Test submitted. You can keep watching the demo and practicing as much as you like.'
    :PILOT?(S.practiceRuns?'Practice as much as you like. When you are ready, take the test: no music, one try.'
      :S.demoWatched?'Now practice with the music. It waits for you when you lift your pen.':'Start by watching the demo. Watch it as many times as you like.')
    :S.demoWatched
    ?'Watch the demo again any time and practice as often as you like. When you are ready, take the test. You only get one try.'
    :'Watch the demo first, as many times as you like. Then practice with training wheels. The test is one try only.';
  const tb=map.test;
  tb.classList.toggle('done',S.testDone); tb.classList.toggle('confirm',!!testConfirm&&!S.testDone);
  const testDesc=PILOT?'No music. Write it at your own pace. One try, and it is graded.':'You follow the music. It keeps going no matter what. One try only.';
  if(S.testDone){ tb.disabled=true;
    $('testTitle').textContent='Test submitted';
    $('testMd').textContent=testInfo?(testInfo.score!=null?`Score ${Math.round(testInfo.score*100)}%`:`${testInfo.valid} of ${testInfo.total} strokes`)+(S.testSnap?'. See your test results.':'.'):'Done.'; }
  else if(testConfirm){ $('testTitle').textContent='Start the test?'; $('testMd').textContent='You only get one try. Tap again to start.'; }
  else if(testLocked){ $('testTitle').textContent='Test'; $('testMd').textContent='Unlocks after you practice once.'; }
  else { $('testTitle').textContent='Test'; $('testMd').textContent=testDesc; }
  $('resultsStep').disabled=S.playing||!S.testSnap; $('seeResults').disabled=S.playing||!S.testSnap; $('seeResults').hidden=PILOT&&!S.testSnap;
  $('testAdmin').hidden=!S.testDone||PILOT;
  if(S.testDone&&testInfo) $('testAdminNote').textContent=`Taken once: ${testInfo.valid} of ${testInfo.total} strokes valid. Reset it to let the test be taken again. Changing the words also resets it.`;
}
""")
rep("""<span class="md">The music follows your pen. It stops when you lift and waits for you.</span>""",
    """<span class="md" id="pracMd">The music follows your pen. It stops when you lift and waits for you.</span>""")
rep("""function saveTest(){
  S.testSnap={run:S.lastRun, res:S.strokes.map(s=>s.res), points:S.points.map(p=>({...p}))};""",
    """function saveTest(){
  S.testSnap={run:S.lastRun, res:S.strokes.map(s=>s.res), points:S.points.map(p=>({...p})), score:attemptScore(), untimed:S.attemptUntimed};""")
rep("""  S.lastRun=snap.run; S.sample=false; S.finished=true;""",
    """  S.lastRun=snap.run; S.sample=false; S.finished=true; S.attemptUntimed=!!snap.untimed;""")
rep("""  S.strokes.forEach((s,i)=>s.res=snap.res[i]||{status:'missed',inside:0,cover:0,onTime:0,n:0});""",
    """  S.strokes.forEach((s,i)=>s.res=snap.res[i]||{status:'missed',score:0,path:0,ink:0,onTime:0,n:0});""")

# practice runs counted before the run is reported so the gate opens right away
rep("  if(mode==='practice') S.practiceRuns++;\n", "  if(mode==='practice') S.practiceRuns++;\n  if(mode==='demo') S.demoWatched=true;\n")

# no fake sample attempt inside a lesson: the child sees the clean model
rep("  layout(); buildLane(); makeSample(); syncUI(); render();\n}\nconst shortText",
    "  layout(); buildLane(); if(PILOT){ clearAttempt(); S.lastRun=null; } else makeSample(); syncUI(); render();\n}\nconst shortText")

# ---------------------------------------------------------------- host glue, replaces the old bridge
rep("setWord('hello');\napplySource();",
r"""// ---------- Host glue (the FloWriter app) ----------
function snapshot(){
  // every page of the attempt, stacked, as one small JPEG for the teacher
  try{
    const keep=S.page, w=720, pages=[];
    for(let p=0;p<S.pages;p++){ S.page=p; render(); const c=document.createElement('canvas'); c.width=w; c.height=Math.round(cv.height*w/cv.width); c.getContext('2d').drawImage(cv,0,0,c.width,c.height); pages.push(c); }
    S.page=keep; render();
    const out=document.createElement('canvas'); out.width=w; out.height=pages.reduce((a,c)=>a+c.height,0);
    const g=out.getContext('2d'); let y=0; pages.forEach(c=>{ g.drawImage(c,0,y); y+=c.height; });
    return out.toDataURL('image/jpeg',.72);
  }catch(e){ return null; }
}
function emitRun(mode){
  if(!PILOT) return;
  const by=new Map();
  S.strokes.forEach(s=>{ let e=by.get(s.ch); if(!e) by.set(s.ch,e={ch:s.ch,sum:0,n:0,rev:0}); e.sum+=s.res?s.res.score:0; e.n++; if(s.res&&s.res.status==='reversed') e.rev++; });
  const letters=[...by.values()].map(e=>({ch:e.ch,score:Math.round(e.sum/e.n*1000)/1000,n:e.n,rev:e.rev}));
  const valid=S.strokes.filter(s=>s.res&&s.res.status==='valid').length, reversed=S.strokes.filter(s=>s.res&&s.res.status==='reversed').length;
  emit({type:'run',mode:mode==='check'?'test':mode,score:mode==='demo'?null:Math.round(attemptScore()*1000)/1000,valid,total:S.strokes.length,reversed,
    gate:mode==='practice'?S.gate:null,bpm:mode==='test'||mode==='check'?null:S.bpm,pauses:S.pauses,letters,img:mode==='demo'?null:snapshot()});
}
async function hostTrack(m){
  ensureAudio();
  if(!actx){ emit({type:'trackFail'}); return; }
  try{
    const ab=await m.track.arrayBuffer();
    const buf=await new Promise((res,rej)=>{ const p=actx.decodeAudioData(ab,res,rej); if(p&&p.then) p.then(res,rej); });
    S.track={buf,name:m.name||m.track.name||'Song',bpm:+m.bpm||100,baseBpm:+m.baseBpm||+m.bpm||100,offset:0,duration:buf.duration};
    waveCache={}; S.src='track';
    if(m.offset!=null) setOffset(+m.offset,true); else setOffset(detectFirstBeat(buf),true);
    if(!m.bpm) await runDetect(false);
    applySource(); timing(); buildLane(); syncUI(); render();
    emit({type:'trackReady',bpm:S.track.bpm});
  }catch(e){ S.track=null; S.src='synth'; applySource(); emit({type:'trackFail'}); }
}
function applyHost(){
  const c=HOST; document.body.classList.add('pilot', 'role-'+(c.role||'student'));
  if(c.theme) document.documentElement.dataset.theme=c.theme;
  if(c.title){ S.lesson=c.title; paintLesson(); }
  if(c.tol){ S.tol=c.tol/100; $('tol').value=c.tol; $('tolVal').textContent=c.tol+'% of x-height'; }
  if(c.bps){ S.bps=+c.bps; document.querySelectorAll('.seg button[data-bps]').forEach(x=>x.setAttribute('aria-pressed',String(+x.dataset.bps===S.bps))); }
  if(c.rest!=null){ S.rest=+c.rest; document.querySelectorAll('.seg button[data-rest]').forEach(x=>x.setAttribute('aria-pressed',String(+x.dataset.rest===S.rest))); }
  if(c.bpm){ const v=Math.max(1,+c.bpm); const r=$('bpm'); r.value=v; S.bpm=v; $('bpmVal').textContent=fmtBpm(v)+' BPM'; }
  const pr=c.progress||{};
  if(pr.demo) S.demoWatched=true;
  if(pr.practice) S.practiceRuns=+pr.practice;
  if(pr.test&&c.role!=='preview'){ S.testDone=true; S.testSnap=null; }
  S.locked=true; paintLock();
  applySkin(c.skin||'');
  setWord(c.word||'hello'); applySource(); showView('write');
  addEventListener('message',e=>{
    const m=e.data||{}; if(!m.fwShell) return;
    if(m.theme) document.documentElement.dataset.theme=m.theme;
    if(m.track) hostTrack(m);
  });
  const sendH=()=>emit({type:'h',h:Math.ceil(document.documentElement.scrollHeight)});
  new ResizeObserver(sendH).observe(document.body); sendH();
  ['setup','write','results'].forEach(v=>{ const el=$('view-'+v); el&&new MutationObserver(()=>{ if(!el.hidden) emit({type:'view',v}); sendH(); }).observe(el,{attributes:true,attributeFilter:['hidden']}); });
  let lastPing=0;
  cv.addEventListener('pointermove',()=>{ const n=Date.now(); if(n-lastPing>5000){ lastPing=n; emit({type:'active'}); } });
  emit({type:'ready'});
}
if(PILOT) applyHost();
else { setWord('hello'); applySource(); }""")

# pilot chrome: no setup, no lock, no theme switching inside a lesson; the app owns those
rep("/* FW-THEMES:END */",
"""/* FW-THEMES:END */
body.pilot .topbar,body.pilot #view-setup,body.pilot #checkBtn,body.pilot .skin-pick,body.pilot .how,body.pilot #testAdmin{display:none!important}
body.pilot .modes{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:720px){body.pilot .modes{grid-template-columns:1fr}}
body.pilot #view-write>.view-head .eyebrow,body.pilot #lessonTitle{display:none}
body.pilot .wrap{padding-block:8px 24px;padding-inline:0}
.mode:disabled:not(.running){opacity:.55;cursor:not-allowed}
.cell.rest.lift .ch{color:var(--accent-ink)}""", 1)

P.write_text(s)
print('patched', len(s))
