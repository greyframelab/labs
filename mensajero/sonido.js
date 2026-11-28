// ======================================================================
// VØID_LOOM · MENSAJERO — sonido.js  (NADIR: dark ambient tipo Tineidae + metales de Blade Runner 2049)
// Mismo motor en vivo (AudioContext) y en render (OfflineAudioContext). Sin tics ni batería: el pulso es un latido.
//   la portadora           → un coro sin palabras (sierras por formantes) que respira con la potencia de la señal
//   cada paquete al foco   → metal arqueado grave + latido de sub (el ritmo lo pone la velocidad de datos)
//   fondo                  → sub que respira, lecho CS-80 desafinado (raíz y segunda menor que baten), cristal que bate
//   TENSIÓN                → un racimo grave que se hunde        RUPTURA → BRAAM + caída de sub, tras silencio total
// Limpio: sin ruido blanco, agudos domados, sin delay; solo una catedral larga y oscura.
// ======================================================================
(function(){
const hz=m=>440*Math.pow(2,(m-69)/12);
function rng(s){ s=(s>>>0)||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
function Motor(ctx,dest,o){
  o=o||{}; const c=ctx, r=rng(o.seed||7), E={c};
  const out=c.createGain(); out.gain.value=.55; E.out=out;
  E.duck=c.createGain(); E.duck.gain.value=1;
  const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=22;
  const shf=c.createBiquadFilter(); shf.type='highshelf'; shf.frequency.value=2000; shf.gain.value=-7;
  const comp=c.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=2; comp.attack.value=.01; comp.release.value=.3; comp.knee.value=8;
  const clip=c.createWaveShaper(); const cu=new Float32Array(2048); for(let i=0;i<2048;i++){ const x=i/1023.5-1; cu[i]=.84*Math.tanh(x/.84); } clip.curve=cu; clip.oversample='4x';
  out.connect(E.duck).connect(hp).connect(shf).connect(comp).connect(clip).connect(dest||c.destination);
  // catedral oscura
  const n=Math.floor(c.sampleRate*6), ir=c.createBuffer(2,n,c.sampleRate); let s=31337;
  for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); let y=0; const a=Math.exp(-2*Math.PI*1300/c.sampleRate); for(let i=0;i<n;i++){ s=(s*16807)%2147483647; y=y*a+(s/2147483647*2-1)*(1-a); const k=i/n; d[i]=y*Math.pow(1-k,2.1)*(i<c.sampleRate*.04?i/(c.sampleRate*.04):1)*1.7; } }
  const verb=c.createConvolver(); verb.buffer=ir; E.send=c.createGain(); E.send.gain.value=.6; E.send.connect(verb).connect(out);
  const voz=(g,pan,sd)=>{ const p=c.createStereoPanner(); p.pan.value=pan||0; g.connect(p); p.connect(out); if(sd){ const x=c.createGain(); x.gain.value=sd; p.connect(x).connect(E.send); } };
  const tanh=new Float32Array(1024); for(let i=0;i<1024;i++){ const x=i/511.5-1; tanh[i]=Math.tanh(2.4*x); }
  E.cont=[]; const osc=(type,f,det,fija)=>{ const x=c.createOscillator(); x.type=type; x.frequency.value=f; if(det) x.detune.value=det; x.start(0); if(!fija) E.cont.push({x,m:f/f0}); return x; };
  const lfo=(rate,depth,param)=>{ const l=osc('sine',rate,0,true), g=c.createGain(); g.gain.value=depth; l.connect(g).connect(param); return l; };
  let f0=hz(o.raiz||38); E.f0=f0;
  // TIMBRE por estación: proporciones de los parciales del metal (barra, cuerda tensa, placa)
  const TIMBRE={mdscc:[[1,2],[2.76,.9],[5.4,.3]],gdscc:[[1,2],[2.01,.8],[3.02,.45],[4.03,.2]],cdscc:[[1,2],[1.59,.9],[2.14,.6],[2.65,.35]]};
  E.timbre=TIMBRE.mdscc;
  // sub que respira
  E.sub=c.createGain(); E.sub.gain.value=0; const br=c.createGain(); br.gain.value=.75; lfo(.04,.25,br.gain); E.sub.connect(br); voz(br,0,0);
  for(const [m,a] of [[.5,1],[1,.4]]){ const g=c.createGain(); g.gain.value=a; osc('sine',f0*m).connect(g).connect(E.sub); }
  // lecho CS-80: raíz, octava y segunda menor alta que baten; filtro que respira
  E.lecho=c.createGain(); E.lecho.gain.value=0; E.lechoLP=c.createBiquadFilter(); E.lechoLP.type='lowpass'; E.lechoLP.frequency.value=230; E.lechoLP.Q.value=1.1; lfo(.027,80,E.lechoLP.frequency);
  for(const [m,a] of [[1,.5],[2,.25],[2*16/15,.13],[3,.05]]) for(const d of [-9,9]){ const x=osc('sawtooth',f0*m,d), g=c.createGain(); g.gain.value=a*.5; lfo(.11+r()*.1,5,x.detune); x.connect(g).connect(E.lechoLP); }
  E.lechoLP.connect(E.lecho); voz(E.lecho,0,.8);
  // la portadora: coro sin palabras (sierras por formantes de vocal oscura)
  E.coro=c.createGain(); E.coro.gain.value=0; voz(E.coro,0,1.2);
  { const src=c.createGain(); for(const [m,d] of [[2,-6],[2,6],[3,-4],[4*16/15,3]]){ const x=osc('sawtooth',f0*m,d); lfo(.19+r()*.1,7,x.detune); const g=c.createGain(); g.gain.value=.25; x.connect(g).connect(src); }
    for(const [f,q,a] of [[420,9,1],[760,11,.6],[1150,12,.25]]){ const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f; bp.Q.value=q; lfo(.05+r()*.05,f*.06,bp.frequency); const g=c.createGain(); g.gain.value=a; src.connect(bp).connect(g).connect(E.coro); } }
  // cristal: dos senos medios que casi coinciden
  E.cristal=c.createGain(); E.cristal.gain.value=0; voz(E.cristal,0,1);
  for(const [m,d] of [[4,0],[4*45/32,0],[4,9]]){ const g=c.createGain(); g.gain.value=.3; osc('sine',f0*m,d).connect(g).connect(E.cristal); }
  // descenso: racimo grave que se hunde (se programa en la TENSIÓN)
  E.desc=c.createGain(); E.desc.gain.value=0; const dlp=c.createBiquadFilter(); dlp.type='lowpass'; dlp.frequency.value=360; dlp.connect(E.desc); voz(E.desc,0,.9);
  E.descOs=[[1,-6],[1,6],[1.5,0]].map(([m,d])=>{ const x=osc('sawtooth',f0*2*m,d,true); x.connect(dlp); return {x,m}; });
  E.r=r; E.quinta=1.5;
  // AFINA: el enlace nuevo fija la nota (distancia), el timbre (estación), la voz (nave). El lecho se desliza a la nota nueva.
  E.afina=(t,o2)=>{ const nf=hz(o2.raiz); for(const k of E.cont){ k.x.frequency.cancelScheduledValues(t); k.x.frequency.setTargetAtTime(nf*k.m,t,1.2); }
    out.gain.setTargetAtTime(.55*Math.pow(10,-Math.max(0,o2.raiz-34)*.13/20),t,1);   // las notas altas suenan más: se compensan
    f0=nf; E.f0=nf; E.timbre=TIMBRE[o2.estacion]||TIMBRE.mdscc; E.r=rng(o2.seed); E.quinta=o2.quinta||1.5; };
  // ---- golpes
  E.arco=(t,v)=>{ // paquete al foco: metal arqueado grave, ataque lento, cola larga
    const f0=E.f0, f=f0*(E.r()<.5?1:E.quinta), x=c.createOscillator(), g=c.createGain(), dur=3.4; x.type='sawtooth'; x.frequency.setValueAtTime(f,t); x.frequency.linearRampToValueAtTime(f*.985,t+dur);
    for(const [rr,a] of E.timbre){ const bp=c.createBiquadFilter(), bg=c.createGain(); bp.type='bandpass'; bp.frequency.value=f*rr; bp.Q.value=30; bg.gain.value=a; x.connect(bp).connect(bg).connect(g); }
    g.gain.setValueAtTime(0,t-.25); g.gain.linearRampToValueAtTime(.5*v,t+.05); g.gain.setTargetAtTime(0,t+.4,dur/3);
    voz(g,(E.r()-.5)*.6,1.1); x.start(Math.max(0,t-.25)); x.stop(t+dur*2.2); };
  E.latido=(t,v)=>{ const x=c.createOscillator(), g=c.createGain(); x.frequency.setValueAtTime(64,t); x.frequency.exponentialRampToValueAtTime(33,t+.2);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.75*v,t+.012); g.gain.setTargetAtTime(0,t+.02,.17); x.connect(g); voz(g,0,.15); x.start(t); x.stop(t+1); };
  E.cs80=(t,f,dur,v)=>{ const lp=c.createBiquadFilter(), g=c.createGain(), sh=c.createWaveShaper(); sh.curve=tanh; lp.type='lowpass'; lp.Q.value=1.8;
    const att=dur*.45; lp.frequency.setValueAtTime(140,t); lp.frequency.setTargetAtTime(950,t,att*.8); lp.frequency.setTargetAtTime(260,t+att*1.4,dur*.4);
    const vib=c.createOscillator(), vg=c.createGain(); vib.frequency.value=4.6; vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(7,t+att+1); vib.connect(vg); const os=[vib];
    for(const d of [-8,8]){ const x=c.createOscillator(); x.type='sawtooth'; x.frequency.value=f; x.detune.value=d; vg.connect(x.detune); x.connect(lp); os.push(x); }
    const sb=c.createOscillator(); sb.frequency.value=f/2; const sg=c.createGain(); sg.gain.value=.6; sb.connect(sg).connect(lp); os.push(sb);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.24*v,t+att); g.gain.setTargetAtTime(0,t+att+dur*.3,dur*.3);
    lp.connect(sh).connect(g); voz(g,0,1); os.forEach(x=>{ x.start(t); x.stop(t+dur*2.5); }); };
  E.braam=(t,v)=>{ const f0=E.f0; const lp=c.createBiquadFilter(), g=c.createGain(), sh=c.createWaveShaper(); sh.curve=tanh;
    lp.type='lowpass'; lp.Q.value=2.5; lp.frequency.setValueAtTime(160,t); lp.frequency.linearRampToValueAtTime(1300*v+300,t+.3); lp.frequency.setTargetAtTime(200,t+.4,1.5);
    const os=[]; for(const d of [-16,-8,0,8,16]){ const x=c.createOscillator(); x.type='sawtooth'; x.frequency.value=f0; x.detune.value=d; x.connect(lp); os.push(x); }
    for(const [m,d] of [[.5,0],[.5,6],[Math.SQRT2,-5]]){ const x=c.createOscillator(); x.type='sawtooth'; x.frequency.value=f0*m; x.detune.value=d; const xg=c.createGain(); xg.gain.value=m<1?.8:.25; x.connect(xg).connect(lp); os.push(x); }
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.5*v,t+.06); g.gain.setTargetAtTime(0,t+.8,1.4);
    lp.connect(sh).connect(g); voz(g,0,.9); os.forEach(x=>{ x.start(t); x.stop(t+8); });
    const sb=c.createOscillator(), sg=c.createGain(); sb.frequency.setValueAtTime(58,t); sb.frequency.exponentialRampToValueAtTime(23,t+2.6); sb.connect(sg);
    sg.gain.setValueAtTime(0,t); sg.gain.linearRampToValueAtTime(.9*v,t+.02); sg.gain.setTargetAtTime(0,t+.4,1); voz(sg,0,0); sb.start(t); sb.stop(t+6); };
  // ---- el lecho sigue a los actos
  E.acto=(t,a,o2)=>{ o2=o2||{};
    //            sub  lecho  coro  cristal descenso
    const A={SEÑAL:[.25,.1,.05,.05,0],TENSIÓN:[.42,.2,.11,.07,.09],RUPTURA:[.8,.36,.2,.04,0],ECO:[.2,.08,.08,.08,0]}[a];
    const tc=a==='RUPTURA'?.05:2.2, pw=o2.potencia??1;
    E.sub.gain.setTargetAtTime(A[0],t,tc); E.lecho.gain.setTargetAtTime(A[1],t,tc); E.coro.gain.setTargetAtTime(A[2]*pw,t,tc*1.4);
    E.cristal.gain.setTargetAtTime(A[3]*.12,t,tc*2); E.desc.gain.setTargetAtTime(A[4],t,1.5);
    E.lechoLP.frequency.setTargetAtTime(a==='RUPTURA'?560:a==='ECO'?170:230,t,tc);
    if(a==='TENSIÓN' && o2.dur){ const f0=E.f0; for(const d of E.descOs){ d.x.frequency.cancelScheduledValues(t); d.x.frequency.setValueAtTime(f0*2*d.m,t); d.x.frequency.exponentialRampToValueAtTime(f0*2*d.m*Math.pow(2,-4/12),t+o2.dur); } } };
  E.silencio=(t)=>{ E.duck.gain.setTargetAtTime(0,t,.012); E.send.gain.setTargetAtTime(0,t,.01); };
  E.vuelve=(t,tau)=>{ E.duck.gain.cancelScheduledValues(t); E.duck.gain.setTargetAtTime(1,t,tau||.001); E.send.gain.cancelScheduledValues(t); E.send.gain.setValueAtTime(.6,t); };
  E.fin=(t,d)=>{ E.duck.gain.setTargetAtTime(0,t,d/3); };
  return E;
}
// ---- partitura: una vuelta (34 s) a partir de la señal real
//   velocidad de datos → cada cuánto llega un paquete (en compases de 70 BPM)
//   potencia (dBm)      → cuánto canta el coro        nave → semilla
function Partitura(o){
  const bpm=o.bpm||70, beat=60/bpm, bar=beat*4, dur=o.dur||34;
  const actos=[[0,'SEÑAL'],[6,'TENSIÓN'],[20.6,'SILENCIO'],[22.3,'RUPTURA'],[28,'ECO']];
  const acto=t=>actos.filter(a=>a[0]<=t).pop()[1];
  const lg=Math.log10(Math.max(10,o.dataRate||1e4));        // 1 (10 b/s) … 7 (10 Mb/s)
  const porCompas=Math.max(1,Math.min(2,Math.round((lg-2.5)/1.6)));  // paquetes por compás (1–2: el ambient necesita aire)
  const golpes=[], latidos=[];
  for(let k=0;k*beat<dur;k++){ const t=k*beat, A=acto(t), b=k%4;
    if(A==='SILENCIO') continue;
    if((A==='TENSIÓN'||A==='RUPTURA') && (b===0)) { latidos.push({t,v:1}); latidos.push({t:t+beat*.38,v:.55}); }
    // cada cuántos tiempos llega un paquete: más datos, más golpes (y el doble en la RUPTURA)
    const iv=A==='SEÑAL'||A==='ECO'?8:A==='RUPTURA'?Math.max(1,Math.round(2/porCompas)):Math.max(1,Math.round(4/porCompas));
    if(k%iv===(iv>=4?2:0) && t>1.5 && t<dur-3 && !(A==='TENSIÓN' && t>19.9)) golpes.push(+t.toFixed(3));
  }
  golpes.push(22.3);
  return {bpm,actos,golpes:[...new Set(golpes)].sort((a,b)=>a-b),latidos,dur};
}
// EL DATO TOCA LA PIEZA: de un enlace real (antena → nave) salen todas las decisiones del sonido
//   distancia      → la nota (más lejos, más grave: de MIDI 46 a 31)
//   velocidad      → el pulso (de 54 BPM a 10 b/s hasta 84 BPM a 10 Mb/s) y los paquetes por compás
//   potencia (dBm) → cuánto canta el coro           estación → el timbre del metal
//   nave           → la semilla y el intervalo: cada nave tiene su voz y se reconoce cuando vuelve
function h32(s){ let h=2166136261; for(const ch of String(s)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; }
function opciones(d,dur){ const lgk=Math.log10(Math.max(1e4,d.rango||1e8)), lgb=Math.log10(Math.max(10,d.dataRate||1e4)), sd=h32(d.nave||'x');
  return {dataRate:d.dataRate,potencia:Math.max(.6,Math.min(1.3,1+((d.potencia||-120)+120)/60)),raiz:Math.round(Math.max(31,Math.min(46,46-(lgk-5)*2.9))),
    bpm:Math.round(54+(Math.min(7,lgb)-1)*5),seed:sd||7,estacion:d.estacion,quinta:[1.5,Math.SQRT2,4/3,1.5,16/15*2][sd%5],dur:dur||34}; }
// programa una vuelta a partir del instante t0 (en vivo, una vuelta tras otra; en render, t0=0)
function programa(E,P,o,t0){
  t0=t0||0; const A=(x)=>t0+x; if(o.raiz) E.afina(A(0),o);
  E.vuelve(A(0),t0>0?.5:.001); E.acto(A(0),'SEÑAL',o); E.acto(A(6),'TENSIÓN',{...o,dur:14.6}); E.silencio(A(20.6)); E.vuelve(A(22.3)); E.acto(A(22.3),'RUPTURA',o); E.braam(A(22.3),1); E.acto(A(28),'ECO',o);
  // más paquetes, cada uno más suave: la sonoridad no depende de la velocidad de datos (≈ −14 LUFS)
  const kg=Math.min(1,Math.pow(9/Math.max(1,P.golpes.length),.75));
  for(const g of P.golpes) if(g!==22.3) E.arco(A(g),(g>22.3&&g<28?1:.75)*kg);
  for(const l of P.latidos) E.latido(A(l.t),l.v);
  E.cs80(A(1.2),E.f0,6,.55); E.cs80(A(28.4),E.f0*16/15,5,.7);
  E.fin(A(P.dur-2.6),2.4);
}
window.MensajeroSonido={Motor,Partitura,programa,opciones};
})();
