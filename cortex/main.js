// ======================================================================
// VØID_LOOM · CÓRTEX — instrumento cerebro en tiempo real · main.js
// Una partitura (EEG real de una noche de sueño) decide sonido, imagen y cámara.
// Modos: AUTOPLAY (infinito, cada pase lee otro tramo de la noche) y PÚBLICO (el micro de la sala entra al cerebro).
// ======================================================================
const P=Object.fromEntries(new URLSearchParams(location.search.slice(1)+'&'+location.hash.slice(1)));
const OFF=P.render==='1';
const NEON=(P.neon||'0,0.9,1').split(',').map(Number);
let seed=7*9301+49297;
const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const rn=()=>{let u=0,v=0;while(!u)u=rnd();v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);};
function norm(v){const l=Math.hypot(...v)||1;return v.map(a=>a/l);}
const H1=(n)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// ---------------- PARTITURA: la noche ----------------
const BPM=120, BEAT=.5, BAR=2, PASE=16;          // 16 compases de 2 s = 32 s por pase
let NOCHE=null, NB=null;
async function cargarNoche(){
  NOCHE=await (await fetch('noche.json')).json();
  NB=new Uint8Array(await (await fetch('noche.bin')).arrayBuffer());
}
const BANDA={delta:0,theta:1,alpha:2,sigma:3,beta:4,gamma:5}, NCH=5;
// lectura continua de la noche (2 Hz) con interpolación
function eeg(name,ch,pos){ // pos en muestras
  const i=Math.floor(pos), f=pos-i, n=NOCHE.n, bi=BANDA[name];
  const g=(j)=>NB[((clamp(j,0,n-1))*6+bi)*NCH+ch]/255*1.5;
  return g(i)*(1-f)+g(i+1)*f;
}
const eegM=(name,pos)=>{let s=0;for(let c=0;c<NCH;c++)s+=eeg(name,c,pos);return s/NCH;};
// regiones de la corteza para cada canal (Fp2-F4, F4-C4, C4-P4, P4-O2, C4-A1)
const REG=[[.24,.28,.72],[.3,.5,.25],[.3,.48,-.28],[.22,.22,-.74],[.47,-.22,.18]];

// ---------------- SECUENCIADOR: genera compás a compás (audio + imagen leen lo mismo) ----------------
const TL={bars:[],kicks:[],blips:[],bass:[],rats:[],glitch:[],waves:[],shots:[],impacts:[]};
const ST={mode:OFF?'auto':'auto', arousal:0, mic:0, micPeak:0, eegPos:0, paseK:0, forced:null, rupLeft:0, ecoLeft:0};
const euclid=(k,n,r)=>Array.from({length:n},(_,i)=>(((i+r)*k)%n)<k);
function paseArc(k){ // arco de cada pase en AUTOPLAY: la ruptura cae en un compás distinto cada vez
  const h=H1(k*3.7+1), rb=6+Math.floor(h*3), rl=4+Math.floor(H1(k*5.1)*2);
  return Array.from({length:PASE},(_,b)=>b<rb-2?'SENAL':b<rb?'TENSION':b<rb+rl?'RUPTURA':'ECO');
}
function nuevaVentana(k){ const v=NOCHE.ventanas; return v[Math.floor(H1(k*9.13+.7)*v.length)]; }
function actoPublico(prev){ // máquina de estados del modo PÚBLICO
  const a=ST.arousal;
  if(ST.rupLeft>0){ST.rupLeft--; if(ST.rupLeft===0) ST.ecoLeft=2; return 'RUPTURA';}
  if(ST.ecoLeft>0){ST.ecoLeft--; return 'ECO';}
  if(a>.72 && (prev==='TENSION')){ST.rupLeft=3;return 'RUPTURA';}
  if(a>.35) return 'TENSION';
  return 'SENAL';
}
function genBar(gb){ // gb = índice global de compás
  const t0=gb*BAR, b=gb%PASE, k=Math.floor(gb/PASE);
  let acto;
  if(ST.mode==='auto'){
    if(b===0){ ST.paseK=k; ST.eegPos=nuevaVentana(k); }
    acto=paseArc(k)[b];
  } else {
    const prev=TL.bars.length?TL.bars[TL.bars.length-1].acto:'SENAL';
    acto=actoPublico(prev);
  }
  const pos0=ST.eegPos+(ST.mode==='auto'? b*BAR*NOCHE.hz : 0); if(ST.mode!=='auto') ST.eegPos+=BAR*NOCHE.hz;
  const E=(nm,tt)=>eegM(nm,pos0+tt*NOCHE.hz);
  const be=clamp(E('beta',1)+(ST.mode==='pub'?ST.arousal*.8:0),0,1.5), ga=E('gamma',1), th=E('theta',1), de=E('delta',1);
  const prevA=TL.bars.length?TL.bars[TL.bars.length-1].acto:'SENAL';
  const bar={gb,t0,acto,k,b,pos0,be,ga,th,de,first:acto==='RUPTURA'&&prevA!=='RUPTURA', lastT:false};
  TL.bars.push(bar);
  const r=(i)=>H1(gb*31.7+i*7.31);
  // ---- BOMBO: plantillas que mutan rotando (no al azar)
  const TPL={SENAL:[0,3],TENSION:[0,3,8,11],RUPTURA:[0,3,6,8,11,13],ECO:[0,3]};
  let steps=TPL[acto];
  if(acto==='RUPTURA') steps=[...new Set(steps.map(s=>s?(s+[0,0,2,0,5][(gb)%5])%16:0))].sort((a,b)=>a-b);
  const silencioIni = (ST.mode==='auto' && b===0);
  if(!(silencioIni)){
    for(const s of steps){
      const tt=t0+s*BEAT/4*1, lub=s%8===3;
      let v=(.55+.35*Math.min(de,1))*(lub?.72:1);
      if(acto==='SENAL') v*=.55+.08*b; if(acto==='ECO') v*=Math.max(.3,1-.15*(b-12));
      TL.kicks.push({t:tt,v,rup:acto==='RUPTURA'});
    }
    if(acto==='TENSION'||acto==='RUPTURA') for(const s of [5,14]) if(r(s)<.3+.6*th) TL.kicks.push({t:t0+s*BEAT/4,v:.28,ghost:true,rup:acto==='RUPTURA'});
  }
  // ---- DATOS: micro-golpes; densidad = beta, timbre = gamma
  if(!(acto==='SENAL'&&b<2&&ST.mode==='auto')){
    const kd=clamp(Math.round(2+9*be),2,13), pat=euclid(kd,16,(gb*3)%16);
    for(let s=0;s<16;s++) if(pat[s]){
      const tt=t0+s*BEAT/4;
      TL.blips.push({t:tt,f:900+1500*Math.min(ga,1.2)+(s%4)*110,v:(.25+.5*Math.min(be,1.2))*(s%2?.6:1),idx:2+3*Math.min(ga,1.3),pan:[-.6,.35,-.2,.6][s%4],d:.03+.03*(s%3===0)});
    }
  }
  // ---- husos de sueño (sigma) → ratchets
  const sg0=E('sigma',0), sg1=E('sigma',1);
  if(sg1>.55 && sg0<=.6 && r(99)<.8){ const tq=t0+Math.floor(r(98)*8)*BEAT/2; const n=acto==='RUPTURA'?6:4;
    TL.rats.push({t:tq,n}); }
  // ---- bajo
  if(acto!=='SENAL'){ const pat=euclid(acto==='RUPTURA'?7:5,16,gb%4);
    for(let s=1;s<16;s++) if(pat[s]) TL.bass.push({t:t0+s*BEAT/4,note:(acto==='RUPTURA'&&s>=10)?39:38,d:acto==='RUPTURA'?.22:.32,v:.5+.4*Math.min(th,1.2)*(acto==='ECO'?.6:1)}); }
  // ---- glitch (gamma) en la ruptura
  if(acto==='RUPTURA' && (ga>.85 || bar.first)) TL.glitch.push({t:t0+14*BEAT/4,len:2*BEAT/4});
  if(bar.first) TL.impacts.push({t:t0});
  // ---- ondas en la corteza: cada golpe acentuado y cada huso enciende la región del canal más activo
  const waveAt=(tt,amp)=>{ let mc=0,mv=-1; for(let c=0;c<NCH;c++){const v=eeg('beta',c,pos0+(tt-t0)*NOCHE.hz)+H1(tt*13+c)*.3; if(v>mv){mv=v;mc=c;}}
    const R=REG[mc], sx=H1(tt*7.7)<.5?-1:1; TL.waves.push({t:tt,c:[R[0]*sx,R[1],R[2]],amp}); };
  if(acto==='SENAL'){ if(r(5)<.55) waveAt(t0+Math.floor(r(6)*4)*BEAT,1); }
  else if(acto==='TENSION'){ waveAt(t0,1); waveAt(t0+BAR/2,1); if(r(7)<.6) waveAt(t0+1.5,1); }
  else if(acto==='RUPTURA'){ for(let q=0;q<4;q++) waveAt(t0+q*BEAT,1); }
  else if(acto==='ECO'){ if(b===PASE-3||r(8)<.25) waveAt(t0+BEAT,1); }
  for(const R of TL.rats) if(R.t>=t0&&R.t<t0+BAR) waveAt(R.t,1);
  // ---- CÁMARA: el montaje sigue al acto
  planos(bar);
  TL.waves.sort((a,b)=>a.t-b.t);
  if(TL.bars.length>400){ for(const key of Object.keys(TL)){ const lim=TL.bars[TL.bars.length-300].t0; TL[key]=TL[key].filter(e=>(e.t??e.t0??e.t1)>=lim-10); } }
}
function shot(t0,t1,type,o={}){ const S={t0,t1,type,s:H1(t0*3.3+1),...o};
  if(type==='macro'&&G.surf){ S.si=Math.floor(H1(t0*5.9+2)*G.surf.length); const P0=G.surf[S.si]; TL.waves.push({t:t0-.25,c:[P0[0],P0[1],P0[2]],amp:1}); }
  TL.shots.push(S); }
function planos(bar){
  const {t0,acto,gb,b}=bar, r=(i)=>H1(gb*17.3+i);
  const prev=TL.shots.length?TL.shots[TL.shots.length-1]:null;
  if(acto==='SENAL'){
    if(prev && prev.type!=='black' && prev.acto==='SENAL' && prev.t1>=t0 && (t0-prev.t0)<BAR*2-.01){ prev.t1=t0+BAR; return; }
    const pool=['orbit','crane','slide','pull','top','lateral'].filter(x=>!prev||x!==prev.type);
    const ty=pool[Math.floor(r(1)*pool.length)];
    shot(t0,t0+BAR,ty,{acto,fadeIn:(ST.mode==='auto'&&b===0)});
  } else if(acto==='TENSION'){
    const nxt=(ST.mode==='auto')?paseArc(Math.floor((gb+1)/PASE))[(gb+1)%PASE]:null;
    const last=nxt==='RUPTURA';
    const tys=['macro','low','lateral','top','macro'];
    shot(t0,t0+1,tys[Math.floor(r(2)*5)],{acto});
    if(last){ shot(t0+1,t0+1.5,tys[Math.floor(r(3)*5)],{acto}); shot(t0+1.5,t0+2,'black',{acto}); }
    else shot(t0+1,t0+2,tys[Math.floor(r(4)*5)],{acto});
  } else if(acto==='RUPTURA'){
    if(bar.first){ shot(t0,t0+1,'burst',{acto}); shot(t0+1,t0+1.5,'dive',{acto}); shot(t0+1.5,t0+2,'in',{acto,z:r(5)*50}); }
    else for(let q=0;q<4;q++){
      const out=(q===2 && r(10+q)<.45);
      shot(t0+q*BEAT,t0+(q+1)*BEAT,out?'burstmacro':'in',{acto,z:r(20+q)*60,roll:(r(30+q)-.5)*.9,side:r(40+q)});
    }
  } else { // ECO
    if(prev && prev.type==='recompose' && prev.t1>=t0-.01){ prev.t1=t0+BAR; return; }
    shot(t0,t0+BAR,'recompose',{acto,startT:t0});
  }
}

// ---------------- AUDIO: el instrumento (WebAudio), mismo sonido en vivo y en render ----------------
function hz(m){return 440*Math.pow(2,(m-69)/12);}
class Motor{
  constructor(ctx){
    this.ctx=ctx; const c=ctx;
    this.out=c.createGain(); this.out.gain.value=.68;
    const shelf=c.createBiquadFilter(); shelf.type='highshelf'; shelf.frequency.value=2200; shelf.gain.value=-6;
    const comp=c.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=3; comp.attack.value=.004; comp.release.value=.12; comp.knee.value=6;
    const lim=c.createDynamicsCompressor(); lim.threshold.value=-2; lim.ratio.value=20; lim.attack.value=.001; lim.release.value=.05;
    this.out.connect(shelf).connect(comp).connect(lim).connect(c.destination);
    this.drum=c.createGain(); this.drum.connect(this.out);
    // saturación paralela del bombo para el móvil
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=180;
    const ws=c.createWaveShaper(); const cu=new Float32Array(1024); for(let i=0;i<1024;i++){const x=i/511.5-1;cu[i]=Math.tanh(3*x);} ws.curve=cu;
    const sg=c.createGain(); sg.gain.value=.3; this.kickBus=c.createGain(); this.kickBus.connect(this.drum); this.kickBus.connect(hp); hp.connect(ws).connect(sg).connect(this.drum);
    // DRONES: bus con sidechain
    this.dr=c.createGain(); this.dr.gain.value=1; this.dr.connect(this.out);
    const f0=hz(38);
    const mk=(type,f,g)=>{const o=c.createOscillator();o.type=type;o.frequency.value=f;const gg=c.createGain();gg.gain.value=g;o.connect(gg);o.start(0);return [o,gg];};
    // sub que respira con delta
    [this.sub,this.subG]=mk('sine',f0,.0); this.subG.connect(this.dr);
    // dron FM (L/R): el índice de modulación sigue alfa/theta
    this.fm=[]; for(const [mult,pan] of [[2,-.5],[3,.5]]){
      const [car,cg]=mk('sine',f0*mult,0); const [mod,mg]=mk('sine',f0*mult*1.0007,0); mg.connect(car.frequency);
      const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; const pn=c.createStereoPanner(); pn.pan.value=pan;
      cg.connect(lp).connect(pn).connect(this.dr); this.fm.push({car,cg,mod,mg,mult,lp});
    }
    // dron aditivo con formante móvil
    this.add=[]; for(let k=1;k<=10;k++){ const [o,g]=mk('sine',f0*k*(1+.0009*(k%3-1)),0); const pn=c.createStereoPanner(); pn.pan.value=(k%2?-.3:.3); g.connect(pn).connect(this.dr); this.add.push({o,g,k}); }
    // tensión: segunda menor en la ruptura
    [this.ten,this.tenG]=mk('sine',hz(51),0); const rm=c.createGain(); rm.gain.value=0; this.tenG.connect(rm); const [ro]=mk('sine',f0*.5,1); ro.disconnect(); ro.connect(rm.gain); rm.connect(this.dr);
    [this.ten2,this.ten2G]=mk('sine',hz(39)*2,0); this.ten2G.connect(this.dr);
    this.f0=f0; this.done={kick:0,blip:0,bass:0,rat:0,gl:0}; this.autoT=0;
  }
  kick(t,v,rup,ghost){ const c=this.ctx,o=c.createOscillator(),g=c.createGain(); o.type='sine';
    const fs=ghost?140:(rup?170:120), tail=ghost?.07:(rup?.16:.26);
    o.frequency.setValueAtTime(fs,t); o.frequency.exponentialRampToValueAtTime(ghost?60:46,t+.12);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.95,t+.002); g.gain.setTargetAtTime(0,t+.01,tail/2.5);
    o.connect(g).connect(this.kickBus); o.start(t); o.stop(t+tail*4);
    const cl=c.createOscillator(),cg=c.createGain(); cl.frequency.value=1700; cg.gain.setValueAtTime(v*(rup?.18:.07),t); cg.gain.exponentialRampToValueAtTime(.0001,t+.012); cl.connect(cg).connect(this.kickBus); cl.start(t); cl.stop(t+.02);
    // sidechain del dron
    this.dr.gain.cancelScheduledValues(t); this.dr.gain.setValueAtTime(1-.45*Math.min(v,1),t); this.dr.gain.setTargetAtTime(1,t+.01,.12);
  }
  blip(t,f,idx,v,pan,d){ const c=this.ctx,car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),g=c.createGain(),pn=c.createStereoPanner();
    car.frequency.value=f; mod.frequency.value=f*1.414; mg.gain.setValueAtTime(idx*f,t); mg.gain.exponentialRampToValueAtTime(1,t+d*.6);
    mod.connect(mg).connect(car.frequency); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.32,t+.0005); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    pn.pan.value=pan; car.connect(g).connect(pn).connect(this.drum); car.start(t); mod.start(t); car.stop(t+d+.02); mod.stop(t+d+.02); }
  bass(t,note,d,v){ const c=this.ctx,f=hz(note),o=c.createOscillator(),o2=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth'; o.frequency.value=f; o2.type='sine'; o2.frequency.value=f; lp.type='lowpass'; lp.Q.value=4;
    lp.frequency.setValueAtTime(260+900*v,t); lp.frequency.exponentialRampToValueAtTime(160,t+d);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.42,t+.002); g.gain.setTargetAtTime(0,t+.02,d/3);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(this.out); o.start(t); o2.start(t); o.stop(t+d*3); o2.stop(t+d*3); }
  drones(t,dt,s){ // s: estado espectral suavizado
    const f=(p,v)=>p.setTargetAtTime(v,t,dt*1.2);
    f(this.subG.gain,(.22+.4*Math.min(s.de,1.2))*.5*(1-s.dark));
    for(const F of this.fm){ f(F.cg.gain,(.18+.3*Math.min(s.al+.3*s.th,1.2))*(1-s.dark)*.55); f(F.mg.gain,F.car.frequency.value*(.4+1.6*s.al+s.raw)); f(F.lp.frequency,500+1300*Math.min(s.al,1)); }
    const form=300+900*Math.min(s.th,1.2);
    for(const A of this.add){ const fk=this.f0*A.k, w=Math.exp(-Math.pow((fk-form)/260,2))+.04; f(A.g.gain,w/Math.sqrt(A.k)*.09*(1-s.dark)); }
    f(this.tenG.gain,s.ten*.45); f(this.ten2G.gain,s.ten*.08);
  }
  // agenda todo lo que cae en [a,b) del tiempo de pieza; off = desfase pieza→reloj de audio
  agenda(a,b,off){
    for(const K of TL.kicks) if(K.t>=a&&K.t<b) this.kick(K.t+off,K.v,K.rup,K.ghost);
    for(const B of TL.blips) if(B.t>=a&&B.t<b) this.blip(B.t+off,B.f,B.idx,B.v,B.pan,B.d);
    for(const B of TL.bass) if(B.t>=a&&B.t<b) this.bass(B.t+off,B.note,B.d,B.v);
    for(const R of TL.rats) if(R.t>=a&&R.t<b) for(let i=0;i<R.n;i++) this.blip(R.t+off+i*BEAT/8,700*Math.pow(2,i/6),2.5,.35+.08*i,.5-i*.18,.025);
    for(const G of TL.glitch) if(G.t>=a&&G.t<b) for(let i=0;i<8;i++) this.blip(G.t+off+i*BEAT/16,1400+i*90,4,.5-.04*i,(i%2?.5:-.5),.02);
    for(let t=Math.ceil(a/.05)*.05;t<b;t+=.05) this.drones(t+off,.05,espectro(t));
  }
}
function barAt(t){ for(let i=TL.bars.length-1;i>=0;i--) if(TL.bars[i].t0<=t+1e-6) return TL.bars[i]; return TL.bars[0]; }
function espectro(t){ const B=barAt(t); const tt=t-B.t0, pos=B.pos0+tt*NOCHE.hz;
  const de=eegM('delta',pos), th=eegM('theta',pos), al=eegM('alpha',pos), be=eegM('beta',pos);
  const ten=B.acto==='RUPTURA'?clamp((be-.4)*1.4,0,1):0;
  const raw=(eeg('gamma',0,pos)-.4)*.6;
  let dark=0; if(ST.mode==='auto'){ if(B.b===0) dark=1-sstep(0,1.6,tt); if(B.b===PASE-1) dark=sstep(.4,2,tt); }
  return {de,th,al,be,ten,raw,dark,acto:B.acto};
}

// ---------------- IMAGEN ----------------
let gl,W,H,cv;
function setupGL(){
  cv=document.getElementById('c');
  const q=+(P.q||1);
  W=OFF?+(P.w||1280):Math.round(innerWidth*Math.min(devicePixelRatio,1.5)*(q>=2?1:.85)); H=OFF?+(P.h||720):Math.round(innerHeight*Math.min(devicePixelRatio,1.5)*(q>=2?1:.85));
  cv.width=W; cv.height=H;
  gl=cv.getContext('webgl2',{preserveDrawingBuffer:OFF,antialias:false}); gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_float_blend');
}
function prog(v,f){const mk=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;};
 const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,v));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function vao(pr,arrs){const v=gl.createVertexArray();gl.bindVertexArray(v);for(const [nm,data,sz] of arrs){const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,data instanceof Float32Array?data:new Float32Array(data),gl.STATIC_DRAW);const l=gl.getAttribLocation(pr,nm);if(l<0)continue;gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,sz,gl.FLOAT,false,0,0);}return v;}
// interior: misma materia fría, el neón solo cuando dispara; los disparos salen con el bombo
const R_VS2=`#version 300 es
precision highp float;
in vec4 a; in vec2 b;
uniform mat4 VP; uniform float T, focus, ap, RY, spread, lk, ki, kick, rs;
out float vI; out float vA; out float vN; out float vH;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  vec4 cp=VP*vec4(a.xyz,1.); gl_Position=cp; float dep=cp.w; float id=b.x, kind=b.y;
  float per=3.5+5.*hh(id*1.7); float lt=mod(T+hh(id)*per,per);
  float act=step(hh(id*3.1+floor((T+hh(id)*per)/per)),spread*.3);
  if(hh(id*3.1+ki*7.13)<spread){ lt=lk; act=1.; }                 // disparo sincronizado con el último bombo
  float wave=exp(-pow((a.w-lt*1.4)*8.,2.))*act*4.;
  float soma=(kind==0.)?exp(-lt*2.4)*act*.7:0.;
  float trail=act*smoothstep(lt*1.4,lt*1.4-.5,a.w)*step(a.w,lt*1.4)*exp(-lt*.8)*.9;
  float fire=wave+soma+trail;
  float base=(kind==0.?.05:.05)*(1.+kick*1.5);
  float I=base+fire;
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY;
  gl_PointSize=min(max(1.6,coc+1.),90.);
  float energy=(1.6*1.6)/(gl_PointSize*gl_PointSize)*(kind==0.?1.:(.25+.75*smoothstep(1.,7.,coc)));
  float fog=exp(-max(dep-.5,0.)*.26-max(dep-2.2,0.)*.55)*smoothstep(.06,.35,dep);
  vI=I*energy*fog*rs; vA=gl_PointSize; vN=clamp(fire/(base+fire),0.,1.); vH=kind==0.?0.:smoothstep(2.,4.,fire);
}`;
const R_FS2=`#version 300 es
precision highp float;
in float vI; in float vA; in float vN; in float vH; uniform vec3 neon; out vec4 o;
void main(){ vec2 q=gl_PointCoord*2.-1.; float r=length(q);
  float disk = vA>4. ? smoothstep(1.,.86,r)*(.85+.15*r) : exp(-r*r*3.);
  o=vec4(mix(mix(vec3(.82,.86,.95),neon,vN),vec3(1.,.98,.95),vH*.8)*vI*disk,1.); }`;
const R_LVS2=`#version 300 es
precision highp float;
in vec4 a; in vec2 b;
uniform mat4 VP; uniform float T, focus, ap, RY, spread, lk, ki;
out float vI; out float vN;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  vec4 cp=VP*vec4(a.xyz,1.); gl_Position=cp; float dep=cp.w; float id=b.x;
  float per=3.5+5.*hh(id*1.7); float lt=mod(T+hh(id)*per,per);
  float act=step(hh(id*3.1+floor((T+hh(id)*per)/per)),spread*.3);
  if(hh(id*3.1+ki*7.13)<spread){ lt=lk; act=1.; }
  float wave=exp(-pow((a.w-lt*1.4)*7.,2.))*act*3.;
  float trail=act*smoothstep(lt*1.4,lt*1.4-.5,a.w)*step(a.w,lt*1.4)*exp(-lt*.8)*.9;
  float fire=wave+trail;
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY;
  float fog=exp(-max(dep-.5,0.)*.26-max(dep-2.2,0.)*.55)*smoothstep(.06,.35,dep);
  vI=(.06+fire)*fog*exp(-coc*.3)*1.1; vN=clamp(fire*3.,0.,1.);
}`;
const R_LFS2=`#version 300 es
precision highp float; in float vI; in float vN; uniform vec3 neon; out vec4 o; void main(){ o=vec4(mix(vec3(.82,.86,.95),neon,vN)*vI,1.); }`;
const PVS=`#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

let G={};
function buildScene(){
  const q=+(P.q||1);
  const bp={np:String(P.np||(q>=2?2600000:1500000)),dust:String(q>=2?200000:120000),nb:String(q>=2?420:300)};
  const B=genBrain(bp);
  seed=11*9301+49297; const Rr=genRed({n:String(P.nn||(q>=2?900:600))});
  G.path=Rr.path;
  // crestas de la corteza (con su normal): el macro siempre encuadra materia real
  G.surf=[]; { const n=B.pos.length/4; for(let i=0;i<n && G.surf.length<4000;i+=97){ if(B.att[i*2+1]===3 && B.pos[i*4+3]>.7 && B.pos[i*4+1]>-.3 && (B.nrm[i*3]*.5+B.nrm[i*3+1]*.8+B.nrm[i*3+2]*.35)/1.0>.55) G.surf.push([B.pos[i*4],B.pos[i*4+1],B.pos[i*4+2],B.nrm[i*3],B.nrm[i*3+1],B.nrm[i*3+2]]); } }
  G.A=prog(B_VS,B_FS); G.L=prog(B_LVS,B_LFS); G.Ri=prog(R_VS2,R_FS2); G.RL=prog(R_LVS2,R_LFS2); G.PP=prog(PVS,B_PFS);
  G.vaA=vao(G.A,[['a',B.pos,4],['b',B.att,2],['nr',B.nrm,3]]); G.nA=B.pos.length/4;
  G.vaL=vao(G.L,[['a',B.lpos,4],['b',B.latt,2],['nr',B.lnrm,3]]); G.nL=B.lpos.length/4;
  G.vaRi=vao(G.Ri,[['a',Rr.pos,4],['b',Rr.att,2]]); G.nRi=Rr.pos.length/4;
  G.vaRL=vao(G.RL,[['a',Rr.lpos,4],['b',Rr.latt,2]]); G.nRL=Rr.lpos.length/4;
  G.vaQ=vao(G.PP,[['p',[-1,-1,3,-1,-1,3],2]]);
  G.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,W,H,0,gl.RGBA,gl.HALF_FLOAT,null);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  G.fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,G.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,G.tex,0);
  G.rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,G.rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,W,H);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,G.rb);
  G.U={}; for(const k of ['A','L','Ri','RL','PP']){ const pr=G[k]; G.U[k]=n=>{const key=k+n; return (G.U[key]??=gl.getUniformLocation(pr,n));}; }
}
// matrices
function sub(a,b){return a.map((x,i)=>x-b[i]);} function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];} function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function mul(a,b){const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o;}
function camMat(eye,tgt,roll,fovDeg){
  const f=norm(sub(tgt,eye)); const r=norm(cross(f,[Math.sin(roll),Math.cos(roll),0])); const u=cross(r,f);
  const fov=fovDeg*Math.PI/180, asp=W/H, near=.02, far=60, ft=1/Math.tan(fov/2);
  const view=[r[0],u[0],-f[0],0, r[1],u[1],-f[1],0, r[2],u[2],-f[2],0, -dot(r,eye),-dot(u,eye),dot(f,eye),1];
  const proj=[ft/asp,0,0,0, 0,ft,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0];
  return new Float32Array(mul(proj,view));
}
const sph=(r,az,el)=>[r*Math.cos(el)*Math.sin(az), r*Math.sin(el), r*Math.cos(el)*Math.cos(az)];
// cada tipo de plano es una función pura del progreso u∈[0,1]
function camara(S,u,t){
  const s=S.s, side=(s<.5?-1:1);
  switch(S.type){
    case 'orbit':  { const dir=s<.5?1:-1, az=s*6.28+dir*ease(u)*1.3, e=sph(3.3-.6*ease(u),az,-.05+.35*H1(s*91)+.15*u); return {eye:e,tgt:[0,-.05,0],fov:36,focus:3.05-.25*u,ap:.006,scene:'out'}; }
    case 'lateral':{ const z=lerp(1.1,-.7,u)*side; return {eye:[2.55*side*-1,.18+.1*s,z],tgt:[0,-.08,z*.25],fov:38,focus:2.6,ap:.007,scene:'out'}; }
    case 'top':    { const az=s*6.28+u*.5; return {eye:[Math.sin(az)*.9,2.7-.3*u,Math.cos(az)*.9],tgt:[0,0,0],fov:34,focus:2.6,ap:.007,scene:'out',roll:az*.2}; }
    case 'low':    { const az=(s<.5?1.9:4.4)+u*.25; const e=sph(2.5,az,-.12); return {eye:[e[0],-.32,e[2]],tgt:[0,-.25,-.25],fov:36,focus:2.45,ap:.008,scene:'out'}; }
    case 'macro':  { const P0=G.surf[(S.si||0)%G.surf.length], n=[P0[3],P0[4],P0[5]];
      const tan=norm(cross(n,[0,1,0])), bit=cross(tan,n), k=lerp(-.14,.14,ease(u));
      const tg=[P0[0]+tan[0]*k,P0[1]+tan[1]*k,P0[2]+tan[2]*k];
      const d=.62-.08*u; const e=[tg[0]+n[0]*d+bit[0]*.22+tan[0]*.12,tg[1]+n[1]*d+bit[1]*.22+tan[1]*.12,tg[2]+n[2]*d+bit[2]*.22+tan[2]*.12];
      return {eye:e,tgt:tg,fov:30,focus:Math.hypot(...sub(e,tg)),ap:.013,scene:'out'}; }
    case 'crane':  { const az=s*6.28; const k=ease(u); const e=sph(2.9,az+k*.5,lerp(-.35,.55,k)); return {eye:e,tgt:[0,lerp(-.25,.05,k),0],fov:36,focus:2.9,ap:.006,scene:'out'}; }
    case 'slide':  { const az=s*6.28; const k=ease(u); const c=sph(2.35,az,.12), t2=norm(cross(c,[0,1,0])); const e=[c[0]+t2[0]*lerp(-1.1,1.1,k),c[1],c[2]+t2[2]*lerp(-1.1,1.1,k)]; return {eye:e,tgt:[t2[0]*lerp(-.3,.3,k),-.05,t2[2]*lerp(-.3,.3,k)],fov:40,focus:Math.hypot(...e)-.1,ap:.008,scene:'out'}; }
    case 'pull':   { const az=s*6.28; const k=ease(u); return {eye:sph(lerp(1.6,3.4,k),az,.22),tgt:[0,-.02,0],fov:lerp(30,38,k),focus:lerp(1.5,3.3,k),ap:.008,scene:'out',roll:lerp(.15,0,k)*(s<.5?1:-1)}; }
    case 'burst':  { const az=s*6.28; return {eye:sph(3.3+u*.3,az,.15),tgt:[0,-.05,0],fov:38,focus:3.4,ap:.006,scene:'out'}; }
    case 'burstmacro': { const az=s*6.28; return {eye:sph(1.9,az,.35),tgt:[0,.1,0],fov:36,focus:1.7,ap:.01,scene:'out',roll:(s-.5)*.4}; }
    case 'dive':   { const az=s*6.28; const k=ease(u); return {eye:sph(lerp(3.1,.35,k),az,.15),tgt:[0,0,0],fov:lerp(38,70,k),focus:lerp(3,.5,k),ap:.006,scene:'out'}; }
    case 'in':     { const z=(S.z||0)*.5+u*.55+(t-S.t0)*.0; const e=G.path(z+2); const tg=G.path(z+3.4);
      const off=(S.side||0)>.5?[.12,.05,0]:[-.1,-.06,0]; return {eye:[e[0]+off[0],e[1]+off[1],e[2]],tgt:tg,fov:64,focus:1.0+.2*Math.sin(u*3),ap:.018,scene:'in',roll:S.roll||0}; }
    case 'recompose': { const T0=S.startT, k=clamp((t-T0)/((S.t1-T0)||1),0,1); const az=s*6.28+k*.6; return {eye:sph(lerp(2.6,3.9,ease(k)),az,.2),tgt:[0,-.05,0],fov:36,focus:lerp(2.6,3.9,ease(k)),ap:.006,scene:'out'}; }
    default: return {eye:[0,0,3],tgt:[0,0,0],fov:36,focus:3,ap:.006,scene:'black'};
  }
}
function shotAt(t){ for(let i=TL.shots.length-1;i>=0;i--){const S=TL.shots[i]; if(S.t0<=t+1e-6&&t<S.t1+1e-6) return S;} return TL.shots[TL.shots.length-1]; }
function lastBefore(arr,t,key='t'){ let r=null; for(const e of arr){ if(e[key]<=t) r=e; else break; } return r; }

// estado visual en el instante t: todo sale de la partitura (función pura de t)
function estado(t){
  const B=barAt(t), S=shotAt(t), u=clamp((t-S.t0)/(S.t1-S.t0),0,1);
  const C=camara(S,u,t);
  const kicks=TL.kicks; let lk=null,ki=0; for(let i=0;i<kicks.length;i++){ if(kicks[i].t<=t){lk=kicks[i];ki=i;} else break; }
  const kenv=lk?Math.exp(-(t-lk.t)*9)*lk.v:0;
  // sacudida y golpe de zoom con el bombo
  const shake=kenv*(B.acto==='RUPTURA'?.02:B.acto==='TENSION'?.01:.004);
  const sh=[(H1(ki*3.1)-.5)*shake,(H1(ki*5.7)-.5)*shake,(H1(ki*7.9)-.5)*shake];
  C.eye=C.eye.map((v,i)=>v+sh[i]); C.fov-=kenv*(B.acto==='RUPTURA'?2.5:1);
  // ondas
  const W4=[]; for(let i=TL.waves.length-1;i>=0&&W4.length<16;i--){ const w=TL.waves[i]; if(w.t>t) continue; const R=(t-w.t)*.95; if(R>1.8) break; W4.push(...w.c,R); }
  while(W4.length<16) W4.push(0,0,0,-1);
  // estallido: sube en el impacto, respira con el bombo y se recompone en el eco
  let burst=0; const imp=lastBefore(TL.impacts,t);
  if(B.acto==='RUPTURA' && imp){ burst=.2*sstep(0,.25,t-imp.t)+.05*kenv; }
  if(B.acto==='ECO'){ let e0=B.t0; for(let i=TL.bars.indexOf(B);i>=0&&TL.bars[i].acto==='ECO';i--) e0=TL.bars[i].t0; burst=.22*(1-ease(clamp((t-e0)/2.6,0,1))); }
  // glitch, onda de choque, dark pulse
  let gli=0; for(const g of TL.glitch) if(t>=g.t&&t<g.t+.45) gli=Math.max(gli,Math.exp(-(t-g.t)*5));
  if(S.type==='in'||S.type==='burstmacro') gli=Math.max(gli,.35*Math.exp(-(t-S.t0)*18));
  if(imp && t-imp.t<.5) gli=Math.max(gli,1-(t-imp.t)*2);
  let shock=[.5,.5,0,0]; if(imp && t-imp.t<.8) shock=[.5,.5,(t-imp.t)*1.1,1-(t-imp.t)/.8];
  for(const g of TL.glitch) if(t>=g.t&&t<g.t+.6) shock=[.5+(H1(g.t)-.5)*.3,.5,(t-g.t)*1.3,.7*(1-(t-g.t)/.6)];
  const sp=espectro(t);
  let dp=S.type==='black'?1:0; let dark=sp.dark;
  return {B,S,u,C,kenv,ki,lk,W4,burst,gli,shock,dp,dark,sp,spread:clamp(.15+.55*sp.be,0,.85)};
}

let RS=1,RSi=1;
// ---------------- CALIDAD AUTOMÁTICA: nunca a saltos en un PC modesto ----------------
// Si no llega a 60 fps, por este orden: resolución al 80 %, 30 fps exactos, 65 % de las partículas,
// resolución al 60 %, 45 % de las partículas. Si va sobrado, recupera poco a poco. Los cambios esperan a un corte de plano.
const NIV=[{sc:1,half:false,pts:1},{sc:.8,half:false,pts:1},{sc:.8,half:true,pts:1},{sc:.8,half:true,pts:.65},{sc:.6,half:true,pts:.65},{sc:.6,half:true,pts:.45}];
const Q={lvl:0,cur:0,n:0,t0:0,slow:0,fast:0,flip:false,shot:null,base:[0,0]};
function pacer(ts){
  Q.n++; if(!Q.t0){Q.t0=ts;return;} const span=(ts-Q.t0)/1000; if(span<2) return;
  const fps=Q.n/span; Q.t0=ts; Q.n=0; const target=NIV[Q.cur].half?30:60;
  if(fps<target*.9){Q.slow++;Q.fast=0;} else if(fps>target*.97){Q.fast++;Q.slow=0;} else Q.slow=Q.fast=0;
  if(Q.slow>=2){Q.slow=0;Q.lvl=Math.min(Q.lvl+1,NIV.length-1);}
  if(Q.fast>=4&&Q.lvl>0){Q.fast=0;Q.lvl--;}
}
function aplicarCalidad(){
  if(Q.lvl===Q.cur) return; Q.cur=Q.lvl; const N=NIV[Q.cur];
  W=Math.round(Q.base[0]*N.sc); H=Math.round(Q.base[1]*N.sc); cv.width=W; cv.height=H;
  gl.bindTexture(gl.TEXTURE_2D,G.tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,W,H,0,gl.RGBA,gl.HALF_FLOAT,null);
  gl.bindRenderbuffer(gl.RENDERBUFFER,G.rb); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,W,H);
}
function render(t){
  const PF=NIV[Q.cur].pts;
  RS=clamp(W*H/(1600*900),.12,2.5)/PF; RSi=clamp(Math.pow(W*H/(1280*720),.7),.2,2.5)/PF;
  const E=estado(t), C=E.C, U=G.U;
  gl.bindFramebuffer(gl.FRAMEBUFFER,G.fb); gl.viewport(0,0,W,H); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const VP=camMat(C.eye,C.tgt,C.roll||0,C.fov);
  if(C.scene==='out'){
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    gl.useProgram(G.A); gl.bindVertexArray(G.vaA); const u=U.A;
    gl.uniformMatrix4fv(u('VP'),false,VP); gl.uniform3fv(u('cam'),C.eye); gl.uniform1f(u('T'),t); gl.uniform1f(u('focus'),C.focus);
    gl.uniform1f(u('RY'),H); gl.uniform1f(u('burst'),E.burst); gl.uniform1f(u('kick'),E.kenv); gl.uniform1f(u('dark'),E.dark); gl.uniform1f(u('fireAmt'),1);
    gl.uniform4fv(u('wv[0]'),new Float32Array(E.W4)); gl.uniform3fv(u('neon'),NEON); gl.uniform1f(u('rs'),RS);
    gl.disable(gl.BLEND); gl.colorMask(false,false,false,false); gl.uniform1f(u('inset'),C.focus<1.2?.06:.03); gl.uniform1f(u('ap'),0); gl.drawArrays(gl.POINTS,0,Math.floor(G.nA*PF));
    gl.colorMask(true,true,true,true); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
    gl.uniform1f(u('inset'),0); gl.uniform1f(u('ap'),C.ap); gl.drawArrays(gl.POINTS,0,Math.floor(G.nA*PF));
    gl.useProgram(G.L); gl.bindVertexArray(G.vaL); const l=U.L;
    gl.uniformMatrix4fv(l('VP'),false,VP); gl.uniform1f(l('burst'),E.burst); gl.uniform1f(l('fireAmt'),1); gl.uniform1f(l('dark'),E.dark);
    gl.uniform4fv(l('wv[0]'),new Float32Array(E.W4)); gl.uniform3fv(l('neon'),NEON); gl.drawArrays(gl.LINES,0,G.nL);
  } else if(C.scene==='in'){
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE);
    const lkT=E.lk?t-E.lk.t:9;
    for(const [pk,va,n,mode] of [['Ri',G.vaRi,G.nRi,gl.POINTS],['RL',G.vaRL,G.nRL,gl.LINES]]){
      gl.useProgram(G[pk]); gl.bindVertexArray(va); const u=U[pk];
      gl.uniformMatrix4fv(u('VP'),false,VP); gl.uniform1f(u('T'),t); gl.uniform1f(u('focus'),C.focus); gl.uniform1f(u('ap'),C.ap); gl.uniform1f(u('RY'),H);
      gl.uniform1f(u('spread'),E.spread); gl.uniform1f(u('lk'),lkT); gl.uniform1f(u('ki'),E.ki); gl.uniform1f(u('kick'),E.kenv); gl.uniform3fv(u('neon'),NEON); if(pk==='Ri') gl.uniform1f(u('rs'),RSi);
      gl.drawArrays(mode,0,mode===gl.POINTS?Math.floor(n*PF):n);
    }
  }
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H);
  gl.useProgram(G.PP); gl.bindVertexArray(G.vaQ); const p=U.PP;
  gl.uniform2f(p('R'),W,H); gl.uniform1f(p('glitch'),E.gli); gl.uniform1f(p('T'),t); gl.uniform1i(p('S'),0); gl.uniform3fv(p('neon'),NEON);
  gl.uniform1f(p('streak'),C.scene==='in'?.3:1); gl.uniform1f(p('sort'),E.gli*.7); gl.uniform1f(p('dpulse'),Math.max(E.dp,E.dark*.6)); gl.uniform4fv(p('shock'),E.shock);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,G.tex); gl.drawArrays(gl.TRIANGLES,0,3);
  return E;
}
function asegurar(t){ while(TL.bars.length===0 || TL.bars[TL.bars.length-1].t0 < t) genBar(TL.bars.length); }

// ---------------- MODO PÚBLICO: el micro de la sala ----------------
let micAn=null, micBuf=null, micAvg=0, micLast=0;
async function activarMicro(ctx){
  const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false}});
  const src=ctx.createMediaStreamSource(st); micAn=ctx.createAnalyser(); micAn.fftSize=1024; src.connect(micAn); micBuf=new Float32Array(micAn.fftSize);
}
function leerMicro(tp){
  if(!micAn) return; micAn.getFloatTimeDomainData(micBuf); let s=0; for(const v of micBuf) s+=v*v; const rms=Math.sqrt(s/micBuf.length);
  const lvl=clamp((20*Math.log10(rms+1e-6)+50)/35,0,1); micAvg=micAvg*.97+lvl*.03;
  ST.arousal=clamp(ST.arousal*.995+Math.max(0,lvl-micAvg-.05)*.08+(lvl>.35?.004:0),0,1);
  // golpe de voz → onda inmediata + ráfaga + glitch breve
  if(lvl-micAvg>.22 && tp-micLast>.35){ micLast=tp; const c=Math.floor(H1(tp)*NCH); const R=REG[c], sx=H1(tp*3)<.5?-1:1;
    TL.waves.push({t:tp+.03,c:[R[0]*sx,R[1],R[2]],amp:1}); TL.rats.push({t:tp+.03,n:4}); if(lvl>.6) TL.glitch.push({t:tp+.03,len:.12});
    TL.waves.sort((a,b)=>a.t-b.t); TL.rats.sort((a,b)=>a.t-b.t); TL.glitch.sort((a,b)=>a.t-b.t);
    if(window.MOTOR){ const off=MOTOR.off; MOTOR.agendaVoz(tp+.03,off); } }
}
Motor.prototype.agendaVoz=function(t,off){ for(let i=0;i<4;i++) this.blip(t+off+i*BEAT/8,700*Math.pow(2,i/6),2.5,.4+.08*i,.5-i*.25,.025); };

// ---------------- ARRANQUE ----------------
async function iniciar(){
  setupGL();
  await cargarNoche();
  await new Promise(r=>setTimeout(r,30));
  buildScene();
  asegurar(PASE*BAR*1+2);
  if(OFF){ window.CORTEX={ready:true,
      frame:(t)=>{asegurar(t+4); render(t); return cv.toDataURL('image/jpeg',.94);},
      audio:async(dur)=>{ asegurar(dur+4); const ctx=new OfflineAudioContext(2,Math.ceil(48000*dur),48000); const M=new Motor(ctx); M.agenda(0,dur,0); const buf=await ctx.startRendering(); return wav(buf); }};
    document.title='LISTO'; return; }
  document.getElementById('carga').style.display='none';
  // instalación (app de escritorio): arranca sola en el modo elegido, sin clic
  if('museo' in P){ arrancar(P.modo==='pub'?'pub':'auto'); return; }
  document.getElementById('inicio').style.display='flex';
}
function wav(buf){ const n=buf.length, ch=2, b=new DataView(new ArrayBuffer(44+n*ch*2)); const w=(o,s)=>{for(let i=0;i<s.length;i++)b.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');b.setUint32(4,36+n*ch*2,true);w(8,'WAVE');w(12,'fmt ');b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,ch,true);b.setUint32(24,48000,true);b.setUint32(28,48000*ch*2,true);b.setUint16(32,ch*2,true);b.setUint16(34,16,true);w(36,'data');b.setUint32(40,n*ch*2,true);
  const L=buf.getChannelData(0),R=buf.getChannelData(1); let o=44; for(let i=0;i<n;i++){ for(const x of [L[i],R[i]]){ b.setInt16(o,Math.max(-1,Math.min(1,x))*32767,true); o+=2; } }
  let s=''; const u8=new Uint8Array(b.buffer); for(let i=0;i<u8.length;i+=32768) s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768)); return btoa(s); }

async function arrancar(modo){
  document.getElementById('inicio').style.display='none'; document.body.style.cursor='none';
  const ctx=new AudioContext({latencyHint:'playback'}); await ctx.resume();
  ST.mode=modo; if(modo==='pub'){ try{ await activarMicro(ctx); }catch(e){ ST.mode='auto'; } }
  TL.bars.length=0; for(const k of Object.keys(TL)) TL[k].length=0;
  const M=new Motor(ctx); window.MOTOR=M; const t0=ctx.currentTime+.15; M.off=t0; let agendado=0;
  Q.base=[W,H];
  const loop=(ts)=>{
    requestAnimationFrame(loop);
    const tp=ctx.currentTime-t0;
    if(ST.mode==='pub') leerMicro(tp);
    asegurar(tp+3);
    const hasta=tp+.25; if(hasta>agendado){ M.agenda(agendado,hasta,t0); agendado=hasta; }
    if(ts) pacer(ts);
    const S=shotAt(Math.max(0,tp)); if(S!==Q.shot){ Q.shot=S; aplicarCalidad(); }   // la calidad cambia en un corte
    if(NIV[Q.cur].half){ Q.flip=!Q.flip; if(Q.flip) return; }
    render(Math.max(0,tp));
  }; requestAnimationFrame(loop);
}
addEventListener('keydown',e=>{ if(e.key==='f'||e.key==='F'){ document.documentElement.requestFullscreen?.(); } });
