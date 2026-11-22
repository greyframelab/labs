// ======================================================================
// VØID_LOOM · CÓRTEX — oido.js
// El micrófono de la sala. Todo se analiza aquí, en el ordenador: no se graba, no se envía, no se guarda.
// Detecta golpes (y su brillo), voz sostenida (y su tono) y de qué lado llega el sonido (si el micro es estéreo).
// Guarda en memoria solo los últimos segundos de voz, para que el lóbulo temporal la cante en granos.
// ======================================================================
const OIDO={on:false, nivel:0, lento:0, suelo:+(localStorage.getItem?.('cortex.suelo')||0)||.08, lado:0, voz:false, f0:0, brillo:0,
  ultimoGolpe:-9, vozDesde:-1, vozHasta:-1, notaId:null, calibrando:0};
let anL=null, anR=null, bufT=null, bufF=null, ring=null, ringPos=0, ringSR=48000;
async function activarOido(ctx){
  const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:2}});
  const src=ctx.createMediaStreamSource(st); const sp=ctx.createChannelSplitter(2);
  anL=ctx.createAnalyser(); anL.fftSize=2048; anL.smoothingTimeConstant=0; anR=ctx.createAnalyser(); anR.fftSize=1024; anR.smoothingTimeConstant=0;
  src.connect(sp); sp.connect(anL,0); sp.connect(anR,1);
  bufT=new Float32Array(anL.fftSize); bufF=new Float32Array(anL.frequencyBinCount);
  // anillo de 4 s en memoria (nunca a disco) para la voz en granos
  ringSR=ctx.sampleRate; ring=new Float32Array(ringSR*4);
  const proc=ctx.createScriptProcessor(2048,1,1); src.connect(proc); const mute=ctx.createGain(); mute.gain.value=0; proc.connect(mute).connect(ctx.destination);
  proc.onaudioprocess=(e)=>{ const d=e.inputBuffer.getChannelData(0); for(let i=0;i<d.length;i++){ ring[ringPos]=d[i]; ringPos=(ringPos+1)%ring.length; } };
  OIDO.on=true;
}
// tono por autocorrelación normalizada (80–900 Hz); devuelve [f0, claridad]
function tono(x0,sr0){
  const x=new Float32Array(x0.length>>1); for(let i=0;i<x.length;i++) x[i]=(x0[2*i]+x0[2*i+1])*.5; const sr=sr0/2;   // diezmado ×2: la mitad de trabajo
  const n=x.length, minL=Math.floor(sr/900), maxL=Math.floor(sr/80); let best=0,bl=0; let e0=0; for(let i=0;i<n;i++) e0+=x[i]*x[i]; if(e0<1e-6) return [0,0];
  for(let L=minL;L<=maxL;L++){ let s=0,e1=0; for(let i=0;i<n-L;i++){ s+=x[i]*x[i+L]; e1+=x[i+L]*x[i+L]; } const r=s/Math.sqrt(e0*e1+1e-9); if(r>best){best=r;bl=L;} }
  return bl?[sr/bl,best]:[0,0];
}
// copia los últimos `dur` s del anillo (la frase que acaba de decir) a un AudioBuffer en memoria
function vozReciente(ctx,dur){ if(!ring) return null; const n=Math.floor(dur*ringSR), b=ctx.createBuffer(1,n,ringSR), d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=ring[(ringPos-n+i+ring.length)%ring.length]; let pk=0; for(const v of d) pk=Math.max(pk,Math.abs(v)); if(pk<1e-3) return null; for(let i=0;i<n;i++) d[i]/=pk; return b; }
// lectura de cada fotograma → eventos para el instrumento
function escuchar(tp,ctx,inst){
  if(!OIDO.on) return;
  anL.getFloatTimeDomainData(bufT); let s=0; for(const v of bufT) s+=v*v; const rms=Math.sqrt(s/bufT.length);
  const lvl=clamp((20*Math.log10(rms+1e-7)+60)/45,0,1);
  if(OIDO.calibrando>0){ OIDO.calibrando--; OIDO._cal=(OIDO._cal||0)*.97+lvl*.03; if(OIDO.calibrando===0){ OIDO.suelo=clamp(OIDO._cal+.06,.03,.6); try{localStorage.setItem('cortex.suelo',OIDO.suelo);}catch(e){} } return; }
  OIDO.lento=OIDO.lento*.985+lvl*.015; OIDO.nivel=lvl;
  // lado: comparación de energía izquierda/derecha
  if(anR){ const r=new Float32Array(anR.fftSize); anR.getFloatTimeDomainData(r); let sr=0; for(const v of r) sr+=v*v; const rR=Math.sqrt(sr/r.length); OIDO.lado=OIDO.lado*.9+.1*clamp((rR-rms)/(rR+rms+1e-6)*2,-1,1); }
  const sobre=lvl-Math.max(OIDO.suelo,OIDO.lento);
  // brillo (centroide espectral) para el timbre del golpe
  anL.getFloatFrequencyData(bufF); let num=0,den=0; for(let i=2;i<bufF.length;i++){ const m=Math.pow(10,bufF[i]/20); num+=m*i; den+=m; } OIDO.brillo=clamp((num/(den+1e-9))/(bufF.length*.18),0,1);
  // GOLPE: subida brusca sobre el nivel lento
  if(sobre>.16 && lvl>OIDO.suelo+.1 && tp-OIDO.ultimoGolpe>.12 && !OIDO._alto){ OIDO.ultimoGolpe=tp; OIDO._alto=true;
    inst.evento({t:tp+.02,kind:'golpe',vel:clamp(sobre*2.2,.25,1),bright:OIDO.brillo,pan:OIDO.lado,src:'mic'}); }
  if(sobre<.06) OIDO._alto=false;
  // VOZ SOSTENIDA: tono estable con nivel
  const [f0,cl]=lvl>OIDO.suelo+.05?tono(bufT,ctx.sampleRate):[0,0];   // tono solo si hay sonido
  const voiced=cl>.86 && f0>0;
  if(voiced){ if(OIDO.vozDesde<0) OIDO.vozDesde=tp; OIDO.vozHasta=tp; OIDO.f0=OIDO.f0?OIDO.f0*.8+f0*.2:f0; }
  if(voiced && !OIDO.notaId && tp-OIDO.vozDesde>.25){ OIDO.notaId='v'+Math.round(tp*1000); inst.evento({t:tp+.02,kind:'notaOn',id:OIDO.notaId,f:OIDO.f0,vel:clamp(lvl*1.3,.3,1),pan:OIDO.lado,src:'mic'}); }
  if(OIDO.notaId && tp-OIDO.vozHasta>.18){ inst.evento({t:tp+.02,kind:'notaOff',id:OIDO.notaId,dur:OIDO.vozHasta-OIDO.vozDesde,src:'mic'});
    if(window.MOTOR && OIDO.vozHasta-OIDO.vozDesde>.4){ const b=vozReciente(ctx,Math.min(2.5,OIDO.vozHasta-OIDO.vozDesde+.2)); if(b){ MOTOR.voz=b; MOTOR.vozHz=OIDO.f0; } }
    OIDO.notaId=null; OIDO.vozDesde=-1; OIDO.f0=0; }
  if(!voiced && OIDO.vozDesde>=0 && tp-OIDO.vozHasta>.3 && !OIDO.notaId) OIDO.vozDesde=-1;
  inst.oreja=lvl>OIDO.suelo?clamp((lvl-OIDO.suelo)*2.5,0,1):0;
}
