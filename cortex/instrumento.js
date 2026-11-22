// ======================================================================
// VØID_LOOM · CÓRTEX — instrumento.js
// La lógica de la obra. Todo lo que suena y se ve sale de aquí como eventos con su instante.
// · AUTOPLAY: la noche de EEG toca sola, por pases de 32 s (SEÑAL · TENSIÓN · RUPTURA · ECO)
// · PÚBLICO / INTÉRPRETE: el cerebro duerme hasta que alguien lo toca (micro o DDJ-200);
//   cada gesto suena y se ve al instante, el cerebro contesta, aprende el tempo y llega a la ruptura.
// ======================================================================
const TL={list:['kicks','blips','bass','rats','glitch','hits','latidos','notasOn','notasOff'],
  kicks:[],blips:[],bass:[],rats:[],glitch:[],hits:[],latidos:[],notasOn:[],notasOff:[],
  waves:[],holds:[],shots:[],impacts:[],bars:[],visitante:[],tract:[]};
const euclid=(k,n,r)=>Array.from({length:n},(_,i)=>(((i+r)*k)%n)<k);
function insertar(arr,e,key='t'){ let i=arr.length; while(i>0 && arr[i-1][key]>e[key]) i--; arr.splice(i,0,e); return e; }
function barAt(t){ for(let i=TL.bars.length-1;i>=0;i--) if(TL.bars[i].t0<=t+1e-6) return TL.bars[i]; return TL.bars[0]; }
function lastBefore(arr,t,key='t'){ let r=null; for(const e of arr){ if(e[key]<=t) r=e; else break; } return r; }
// puntos de corteza más cercanos a cada región (para los macros)
let REG_SURF=null;
function prepararRegiones(){ REG_SURF=REG.map(R=>[-1,1].map(sx=>{ const c=[R[0]*sx,R[1],R[2]];
  return G.surf.map((p,i)=>[i,Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])]).sort((a,b)=>a[1]-b[1]).slice(0,40).map(x=>x[0]); })); }
const lado=(pan,t)=>pan>.15?1:pan<-.15?-1:(H1(t*7.7)<.5?-1:1);

// ---------------- estado ----------------
const ST={mode:'auto', paseK:0, eegPos:0};
const INST={S:null, E:0, acto:'REPOSO', lastEv:-99, lastCut:-99, frase:[], fraseFin:-1, onsets:[], tempo:null, nextBar:0, gb:0,
  rupHasta:-1, ecoHasta:-1, hist:[], dens:.5, subAmt:.5, nextLatido:0, nextEsp:4, eegPos:0, oreja:0, dronAmt:1, actividad:1, cnt:0, respHasta:-1, sesion:1, lastStep:0,
  forzarDentro:0, camAz:0};
let ROOT=null;   // la raíz no cambia mientras suena (los drones están afinados a ella)
function suenoFijo(k){ const S=sueno(k); if(ROOT==null) ROOT=S.root; S.root=ROOT; return S; }
function nuevaSesion(t){ INST.sesion++; INST.S=suenoFijo(INST.sesion*7+Math.floor(t)); if(window.MOTOR) MOTOR.S=INST.S; }

// ---------------- GROOVE: un compás de ritmo IDM (plantillas que rotan, no azar) ----------------
function grooveBar(t0,beat,acto,gb,be,ga,th,de,S){
  const st=beat/4, r=(i)=>H1(gb*31.7+i*7.31), sw=S?S.swing:.06;
  const TPL={SENAL:[0,3],TENSION:[0,3,8,11],RUPTURA:[0,3,6,8,11,13],ECO:[0,3],PULSO:[0,3,8,11]};
  let steps=TPL[acto]||TPL.PULSO;
  if(acto==='RUPTURA') steps=[...new Set(steps.map(s=>s?(s+[0,0,2,0,5][gb%5])%16:0))].sort((a,b)=>a-b);
  const tq=(s)=>t0+s*st+(s%2?sw*st:0);
  for(const s of steps){ const lub=s%8===3; let v=(.55+.35*Math.min(de,1))*(lub?.72:1); if(acto==='SENAL') v*=.7; if(acto==='ECO') v*=.6;
    insertar(TL.kicks,{t:tq(s),v,rup:acto==='RUPTURA'}); }
  if(acto==='TENSION'||acto==='RUPTURA'||acto==='PULSO') for(const s of [5,14]) if(r(s)<.3+.6*th) insertar(TL.kicks,{t:tq(s),v:.28,ghost:true,rup:acto==='RUPTURA'});
  const kd=clamp(Math.round(2+9*be),2,13), pat=euclid(kd,16,(gb*3)%16);
  for(let s=0;s<16;s++) if(pat[s]) insertar(TL.blips,{t:tq(s),f:900+1500*Math.min(ga,1.2)+(s%4)*110,v:(.25+.5*Math.min(be,1.2))*(s%2?.6:1)*.8,idx:2+3*Math.min(ga,1.3),pan:[-.6,.35,-.2,.6][s%4],d:.03+.03*(s%3===0)});
  if(acto!=='SENAL'){ const pb=euclid(acto==='RUPTURA'?7:5,16,gb%4), root=S?S.root:38;
    for(let s=1;s<16;s++) if(pb[s]) insertar(TL.bass,{t:tq(s),m:(acto==='RUPTURA'&&s>=10)?root+1:root,d:acto==='RUPTURA'?.22:.32,v:.5+.4*Math.min(th,1.2)*(acto==='ECO'?.6:1)}); }
  if(acto==='RUPTURA' && (ga>.85||r(77)<.4)) insertar(TL.glitch,{t:t0+14*st,len:2*st});
}

// ================= AUTOPLAY: la noche toca sola =================
function paseArc(k){ const h=H1(k*3.7+1), rb=6+Math.floor(h*3), rl=4+Math.floor(H1(k*5.1)*2);
  return Array.from({length:PASE},(_,b)=>b<rb-2?'SENAL':b<rb?'TENSION':b<rb+rl?'RUPTURA':'ECO'); }
function nuevaVentana(k){ const v=NOCHE.ventanas; return v[Math.floor(H1(k*9.13+.7)*v.length)]; }
function genBar(gb){
  const t0=gb*BAR, b=gb%PASE, k=Math.floor(gb/PASE);
  if(b===0){ ST.paseK=k; ST.eegPos=nuevaVentana(k); INST.S=suenoFijo(k*3+1); if(window.MOTOR&&!OFF) MOTOR.S=INST.S; }
  const acto=paseArc(k)[b];
  const pos0=ST.eegPos+b*BAR*NOCHE.hz; const E=(nm,tt)=>eegM(nm,pos0+tt*NOCHE.hz);
  const be=E('beta',1), ga=E('gamma',1), th=E('theta',1), de=E('delta',1);
  const prevA=TL.bars.length?TL.bars[TL.bars.length-1].acto:'SENAL';
  const bar={gb,t0,acto,k,b,pos0,be,ga,th,de,first:acto==='RUPTURA'&&prevA!=='RUPTURA'}; TL.bars.push(bar);
  const r=(i)=>H1(gb*31.7+i*7.31);
  if(b>0) grooveBar(t0,BEAT,acto,gb,be,ga,th,de,INST.S);
  const sg0=E('sigma',0), sg1=E('sigma',1);
  if(sg1>.55 && sg0<=.6 && r(99)<.8) insertar(TL.rats,{t:t0+Math.floor(r(98)*8)*BEAT/2,n:acto==='RUPTURA'?6:4});
  if(bar.first){ TL.impacts.push({t:t0}); TL.tract.push({t:t0,t1:t0+BAR*3}); }
  // las voces del instrumento también tocan en AUTOPLAY: la región del canal más activo
  const nh={SENAL:b>1?1:0,TENSION:2,RUPTURA:3,ECO:b===PASE-3?1:0}[acto];
  for(let q=0;q<nh;q++){ const tt=t0+[0,1,1.5][q]+(q?0:BEAT*Math.floor(r(50)*3)); let mc=0,mv=-1;
    for(let c=0;c<NCH;c++){ const v=eeg('beta',c,pos0+(tt-t0)*NOCHE.hz)+H1(tt*13+c)*.3; if(v>mv){mv=v;mc=c;} }
    const reg=(mc+(r(60+q)<.25?5:0))%6, sx=H1(tt*7.7)<.5?-1:1, m=grado(INST.S,Math.floor(r(70+q)*7),reg===3?0:1);
    insertar(TL.hits,{t:tt,reg,m,v:acto==='SENAL'?.35:.6,pan:sx*.5}); ola(tt,reg,sx,1); }
  if(acto==='TENSION') ola(t0+BAR/2,Math.floor(r(9)*5),1,1);
  if(acto==='RUPTURA') for(let q=0;q<4;q++) ola(t0+q*BEAT,Math.floor(r(20+q)*5),r(30+q)<.5?-1:1,1);
  for(const R of TL.rats) if(R.t>=t0&&R.t<t0+BAR) ola(R.t,Math.floor(H1(R.t)*5),1,1);
  planosAuto(bar);
}
function ola(t,reg,sx,amp,c){ const R=REG[reg]; insertar(TL.waves,{t,c:c||[R[0]*sx,R[1],R[2]],amp}); }
function shot(t0,type,o={}){ const S={t0,type,s:H1(t0*3.3+1),dur:o.dur||1,...o};
  if(type==='macro'&&G.surf){ if(S.reg==null&&S.si==null) S.si=Math.floor(H1(t0*5.9+2)*G.surf.length);
    if(!o.sinOla&&!o.live){ const P0=surfPt(S); insertar(TL.waves,{t:t0-.2,c:[P0[0],P0[1],P0[2]],amp:1}); } }
  return insertar(TL.shots,S,'t0'); }
function planosAuto(bar){
  const {t0,acto,gb,b}=bar, r=(i)=>H1(gb*17.3+i); const prev=TL.shots.length?TL.shots[TL.shots.length-1]:null;
  if(acto==='SENAL'){
    if(prev && prev.acto==='SENAL' && prev.type!=='black' && (t0-prev.t0)<BAR*2-.01){ prev.dur=t0+BAR-prev.t0; return; }
    const pool=['orbit','crane','slide','pull','top','lateral'].filter(x=>!prev||x!==prev.type);
    shot(t0,pool[Math.floor(r(1)*pool.length)],{acto,dur:BAR});
  } else if(acto==='TENSION'){
    const nxt=paseArc(Math.floor((gb+1)/PASE))[(gb+1)%PASE], last=nxt==='RUPTURA', tys=['macro','low','lateral','top','macro','region'];
    const reg=Math.floor(r(9)*5);
    shot(t0,tys[Math.floor(r(2)*6)],{acto,reg,sx:1});
    if(last){ shot(t0+1,tys[Math.floor(r(3)*6)],{acto,dur:.5,reg,sx:-1}); shot(t0+1.5,'black',{acto,dur:.5}); }
    else shot(t0+1,tys[Math.floor(r(4)*6)],{acto,reg,sx:-1});
  } else if(acto==='RUPTURA'){
    if(bar.first){ shot(t0,'burst',{acto}); shot(t0+1,'dive',{acto,dur:.5}); shot(t0+1.5,'in',{acto,z:r(5)*50,dur:.5}); }
    else for(let q=0;q<4;q++){ const out=(q===2 && r(10+q)<.45); shot(t0+q*BEAT,out?'tract':'in',{acto,z:r(20+q)*60,roll:(r(30+q)-.5)*.9,side:r(40+q),dur:BEAT}); }
  } else {
    if(prev && prev.type==='recompose'){ prev.dur=t0+BAR-prev.t0; return; }
    shot(t0,'recompose',{acto,dur:BAR});
  }
}

// ================= PÚBLICO / INTÉRPRETE: el instrumento =================
const REG_GRADO=[4,2,0,-3,1,5];          // grado de la escala de cada región
const REG_OCT=[1,1,1,0,1,2];
// regiones por brillo del sonido: sordo → occipital (sub) · medio → central (cuerda) / cerebelo · brillante → frontal (metal)
function regPorBrillo(b,n){ if(b<.22) return 3; if(b<.42) return n%2?1:4; if(b<.62) return n%3===0?5:1; return n%2?0:5; }
INST.evento=function(ev){
  const I=INST, S=I.S, t=ev.t; I.cnt++;
  if(ev.kind==='notaOff'){ insertar(TL.notasOff,{t,id:ev.id}); const H=TL.holds.find(h=>h.id===ev.id&&h.t1==null); if(H) H.t1=t; emitir('notasOff'); return; }
  I.lastEv=t;
  if(I.acto==='REPOSO'){ I.despertar=t; nuevaSesion(t); I.acto='VIVO';             // se despierta: onda por todo el cerebro
    insertar(TL.waves,{t,c:[0,.15,0],amp:1.2}); I.lastCut=-9; }
  let reg=ev.reg, m=ev.m, v=ev.vel??.7, pan=ev.pan??0;
  if(ev.kind==='notaOn'){
    if(reg==null) reg=ev.f<150?4:ev.f<300?2:0;
    m=m??cuantiza(S,ev.f||220); const sx=lado(pan,t);
    insertar(TL.notasOn,{t,id:ev.id,m,v,reg,pan}); TL.holds.push({id:ev.id,t,t1:null,reg,sx}); emitir('notasOn');
    I.E=clamp(I.E+.08*v,0,1); I.voz=true;
    corte(t,'trace',{reg,sx,dur:6,prio:1});
    return;
  }
  // golpe / pad / respuesta
  if(reg==null) reg=regPorBrillo(ev.bright??.5,I.cnt);
  if(m==null) m=grado(S,REG_GRADO[reg]+((I.cnt*2)%5)-2,REG_OCT[reg]);
  const sx=lado(pan,t);
  insertar(TL.hits,{t,reg,m,v:v*I.actividad,pan:sx*.45+pan*.3}); emitir('hits');
  ola(t,reg,sx,v);
  if(ev.src!=='resp'){
    I.E=clamp(I.E+.11*v,0,1);
    I.frase.push({t,reg,v,m}); I.fraseFin=t; if(I.frase.length>12) I.frase.shift();
    I.onsets.push(t); if(I.onsets.length>8) I.onsets.shift();
    detectarTempo(t);
    if(v>.92 && I.E>.5 && I.acto!=='RUPTURA') ruptura(t);
  }
  // CÁMARA: cada gesto corta a la región que suena
  const fuerte=v>.85 && I.E>.45;
  const tipo=fuerte&&I.acto!=='RUPTURA'?'in':(ev.src==='resp'?(I.cnt%2?'region':'macro'):(I.cnt%3===2?'region':'macro'));
  corte(t,I.acto==='RUPTURA'?(I.cnt%3?'in':'tract'):tipo,{reg,sx,dur:1.4,z:H1(t)*50,roll:(H1(t*3)-.5)*.6,side:H1(t*5)});
};
function corte(t,type,o){ const I=INST; const gap=o.prio?.15:.38; if(t-I.lastCut<gap) return; I.lastCut=t; shot(t,type,{...o,live:true}); }
function emitir(L){ if(OFF||!window.MOTOR) return; const off=MOTOR.off, arr=TL[L]; for(let i=arr.length-1;i>=0&&i>=arr.length-12;i--){ const e=arr[i]; if(!e.done && e.t<MOTOR.horizonte) MOTOR.tocar(L,e,off); } }
function detectarTempo(t){ const O=INST.onsets; if(O.length<4) return; const d=[]; for(let i=O.length-4;i<O.length-1;i++) d.push(O[i+1]-O[i]);
  const m=d.reduce((a,b)=>a+b)/d.length, sd=Math.sqrt(d.reduce((a,b)=>a+(b-m)**2,0)/d.length);
  if(m>.28&&m<1.1&&sd/m<.14){ let beat=m; while(beat>.64) beat/=2; while(beat<.4) beat*=2;
    if(!INST.tempo){ INST.tempo={beat,t0:t}; INST.nextBar=t+beat; INST.E=clamp(INST.E+.1,0,1); }
    else { INST.tempo.beat=INST.tempo.beat*.7+beat*.3; } INST.tempo.last=t; } }
function ruptura(t){ const I=INST, beat=I.tempo?I.tempo.beat:.5; I.rupHasta=t+beat*12; I.ecoHasta=I.rupHasta+5;
  TL.impacts.push({t}); TL.tract.push({t:t+beat*2,t1:I.rupHasta}); insertar(TL.glitch,{t,len:.1}); emitir('glitch');
  I.lastCut=-9; shot(t,'burst',{dur:beat*2,live:true}); shot(t+beat*2,'dive',{dur:beat,live:true}); I.lastCut=t+beat*3;
  if(!I.tempo){ I.tempo={beat:.5,t0:t,last:t}; I.nextBar=t+beat*3; } }
// respuesta: el cerebro devuelve la frase transformada
function responder(t){ const I=INST, F=I.frase.slice(); I.frase=[]; if(F.length<2) return;
  const modo=I.cnt%4, base=F[0].t, dur=F[F.length-1].t-base, stretch=modo===2?1.5:1;
  let evs=F.map(e=>({dt:(e.t-base)*stretch,reg:(e.reg+1+modo)%6,v:clamp(e.v*.85,.3,.9),m:e.m+[0,3,-5,7][modo]}));
  if(modo===1) evs=evs.map(e=>({...e,dt:dur*stretch-e.dt})).reverse();
  if(I.tempo){ const q=I.tempo.beat/2; evs=evs.map(e=>({...e,dt:Math.round(e.dt/q)*q})); }
  const t0=t+.18; for(const e of evs){ const m=I.S? cuantiza(I.S,hz(e.m)) : e.m; INST.evento({t:t0+e.dt,kind:'golpe',reg:e.reg,m,vel:e.v,pan:-(e.reg%2?.4:-.4),src:'resp'}); }
  I.respHasta=t0+evs[evs.length-1].dt+.3; }
// cada fotograma (o cada paso de la simulación)
INST.tick=function(t){
  const I=INST, dt=Math.max(0,t-I.lastStep); I.lastStep=t;
  I.E*=Math.exp(-dt/(I.acto==='PULSO'?22:14));
  if(I.tempo && t-(I.tempo.last||0)>9 && I.acto!=='RUPTURA') I.tempo=null;
  if(I.tempo&&I.tempo.ddj) I.E=Math.max(I.E,.3);
  const prev=I.acto;
  if(t<I.rupHasta) I.acto='RUPTURA'; else if(t<I.ecoHasta) I.acto='ECO';
  else if(I.E<.05 && t-I.lastEv>18) I.acto='REPOSO';
  else if(I.tempo && I.E>.22) I.acto='PULSO'; else I.acto='VIVO';
  if(prev==='RUPTURA'&&I.acto==='ECO'){ I.E=.25; I.tempo=null; shot(t,'recompose',{dur:5,live:true}); I.lastCut=t; }
  if(I.acto==='REPOSO' && prev!=='REPOSO'){ shot(t,'sueno',{dur:60,live:true}); }
  // reposo vivo: latido muy bajo y algún disparo espontáneo
  if(I.acto==='REPOSO'||I.acto==='VIVO'){
    if(t>=I.nextLatido){ const tt=Math.max(t,I.nextLatido); insertar(TL.latidos,{t:tt+.02,v:I.acto==='REPOSO'?.28:.18}); emitir('latidos'); I.nextLatido=tt+(I.acto==='REPOSO'?1.9:1.6); }
    if(I.acto==='REPOSO' && t>=I.nextEsp){ const reg=Math.floor(H1(t)*6), sx=H1(t*3)<.5?-1:1;
      insertar(TL.hits,{t:t+.02,reg,m:grado(I.S,REG_GRADO[reg],REG_OCT[reg]),v:.18,pan:sx*.5}); emitir('hits'); ola(t+.02,reg,sx,.5);
      I.nextEsp=t+6+4*H1(t*1.7); }
  }
  // pregunta y respuesta: silencio tras una frase → contesta
  if(I.frase.length>=2 && t-I.fraseFin>1.15 && t>I.respHasta && I.acto!=='RUPTURA') responder(t);
  // pulso aprendido: compases de groove alineados con el visitante
  if((I.acto==='PULSO'||I.acto==='RUPTURA'||I.acto==='ECO') && I.tempo){
    const beat=I.tempo.beat; if(I.nextBar<t-beat) I.nextBar=t+.05;
    while(I.nextBar<t+.3){ const b0=I.nextBar, pos=I.eegPos;
      const be=clamp(.25+I.E*.9+eegM('beta',pos)*.2+(I.dens-.5)*.6,0,1.3), ga=I.acto==='RUPTURA'?1:eegM('gamma',pos), th=eegM('theta',pos)+I.E*.3, de=eegM('delta',pos)+.4;
      grooveBar(b0,beat,I.acto==='PULSO'?(I.E>.6?'TENSION':'PULSO'):I.acto,I.gb++,be,ga,th,de,I.S);
      if(I.acto==='RUPTURA') for(let q=0;q<4;q++){ const tt=b0+q*beat; if(q%2===0) ola(tt,Math.floor(H1(tt)*6),H1(tt*2)<.5?-1:1,.8); shot(tt,(q%2?'in':'tract'),{dur:beat,z:H1(tt)*50,roll:(H1(tt*3)-.5)*.9,side:H1(tt*5),live:true}); }
      else if(I.acto==='PULSO' && I.E>.5 && (I.gb%2===0)) ola(b0,Math.floor(H1(b0)*5),1,.8);
      I.nextBar+=beat*4; }
    for(const L of ['kicks','blips','bass','glitch']) emitir(L);
  }
  I.eegPos+=dt*NOCHE.hz*.25;     // la noche avanza despacio por debajo
};
function espectroInst(t){ const I=instAt(t), pos=I.eegPos;
  const de=eegM('delta',pos), th=eegM('theta',pos), al=eegM('alpha',pos), be=eegM('beta',pos);
  const voz=TL.holds.some(h=>h.t<=t&&(h.t1==null||h.t1>t))?1:0;
  const dark=I.acto==='REPOSO'?.3:0;
  return {de:de*(.6+.8*(INST.subAmt??.5)),th,al:al+I.E*.3,be:be+I.E*.5,ten:I.acto==='RUPTURA'?.8:0,raw:(eeg('gamma',0,pos)-.4)*.6,dark,voz,dronAmt:INST.dronAmt*(I.acto==='REPOSO'?.7:1),acto:I.acto}; }
// estado del instrumento en el instante t (en vivo, el actual; en el render, la historia simulada)
function instAt(t){ if(!OFF||!INST.hist.length) return INST; const Hh=INST.hist; let i=Math.min(Hh.length-1,Math.max(0,Math.round(t*60))); return Hh[i]; }
function espectro(t){
  if(ST.mode!=='auto') return espectroInst(t);
  const B=barAt(t); const tt=t-B.t0, pos=B.pos0+tt*NOCHE.hz;
  const de=eegM('delta',pos), th=eegM('theta',pos), al=eegM('alpha',pos), be=eegM('beta',pos);
  const ten=B.acto==='RUPTURA'?clamp((be-.4)*1.4,0,1):0;
  let dark=0; if(B.b===0) dark=1-sstep(0,1.6,tt); if(B.b===PASE-1) dark=sstep(.4,2,tt);
  return {de,th,al,be,ten,raw:(eeg('gamma',0,pos)-.4)*.6,dark,voz:0,dronAmt:INST.dronAmt,acto:B.acto};
}
function asegurar(t){ if(ST.mode!=='auto') return; while(TL.bars.length===0 || TL.bars[TL.bars.length-1].t0 < t) genBar(TL.bars.length); }

// ================= SIMULACIÓN: visitantes de prueba para el render offline =================
// palmadas, un golpe sordo, una voz que se sostiene, silencio (el cerebro contesta), palmas a tempo, un grito, silencio
function guionVisitantes(){
  const E=[]; const g=(t,b,v)=>E.push({t,kind:'golpe',bright:b,vel:v,pan:(H1(t)-.5)*.8,src:'sim'});
  g(6.0,.8,.75); g(6.55,.75,.7); g(7.05,.15,.8); g(7.4,.5,.65);
  E.push({t:10.0,kind:'notaOn',id:'s1',f:196,vel:.75,pan:-.4,src:'sim'}); E.push({t:11.9,kind:'notaOff',id:'s1',src:'sim'});
  E.push({t:12.5,kind:'notaOn',id:'s2',f:330,vel:.7,pan:.4,src:'sim'}); E.push({t:13.4,kind:'notaOff',id:'s2',src:'sim'});
  for(let i=0;i<10;i++) g(15+i*.5,i%4===0?.2:.7,i%4===0?.85:.65);
  g(20.3,.6,.7); g(20.8,.3,.75); E.push({t:21.2,kind:'notaOn',id:'s3',f:247,vel:.8,pan:0,src:'sim'}); E.push({t:22.0,kind:'notaOff',id:'s3',src:'sim'});
  g(22.6,.9,1.0);                                   // grito → ruptura
  g(24.1,.5,.8); g(25.0,.2,.9);
  return E.sort((a,b)=>a.t-b.t);
}
function simular(dur){
  const EV=guionVisitantes(); let i=0;
  for(let f=0;f<=Math.ceil(dur*60);f++){ const t=f/60; while(i<EV.length && EV[i].t<=t){ const e=EV[i++]; INST.evento(e); TL.visitante.push(e); } INST.tick(t);
    // lo que "oye" el lóbulo temporal en la simulación
    let o=0; for(const e of TL.visitante){ if(e.kind==='golpe'&&t>=e.t) o=Math.max(o,e.vel*Math.exp(-(t-e.t)*7)); }
    if(TL.holds.some(h=>h.t<=t&&(h.t1==null||h.t1>t))) o=Math.max(o,.7);
    INST.hist.push({t,acto:INST.acto,E:INST.E,eegPos:INST.eegPos,tempo:INST.tempo?{...INST.tempo}:null,oreja:o}); }
}
