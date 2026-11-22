// ======================================================================
// VØID_LOOM · CÓRTEX — main.js · arranque, modos y bucle
// AUTOPLAY · PÚBLICO (micro) · INTÉRPRETE (DDJ-200 + micro)
// Teclas: F pantalla completa · K calibrar la sala (4 s de silencio) · A / P / I cambiar de modo
// ======================================================================
window.AHORA=null;
// pasar a instrumento (si se toca la DDJ en AUTOPLAY, entra al momento)
function aInstrumento(t,modo){
  if(ST.mode!=='auto'){ if(modo==='ddj') ST.mode='ddj'; return; }
  ST.mode=modo; for(const L of [...TL.list,'waves','impacts','tract']) TL[L]=TL[L].filter(e=>e.t<=t);
  TL.shots=TL.shots.filter(s=>s.t0<=t); TL.bars.length=0;
  INST.lastStep=t; INST.acto='VIVO'; INST.lastEv=t; INST.eegPos=ST.eegPos||INST.eegPos; INST.nextLatido=t+1; INST.nextEsp=t+5; INST.lastCut=-9;
}
async function iniciar(){
  setupGL();
  await cargarNoche();
  INST.S=suenoFijo(1); INST.eegPos=NOCHE.ventanas[Math.floor(NOCHE.ventanas.length*.37)];
  await new Promise(r=>setTimeout(r,30));
  buildScene();
  if(OFF){
    const sim='sim' in P; if(sim){ ST.mode='pub'; shot(0,'sueno',{dur:60}); }
    window.CORTEX={ready:true,
      prepara:(dur)=>{ if(sim) simular(dur); else asegurar(dur+4); return {hits:TL.hits.length,shots:TL.shots.length,actos:TL.shots.map(s=>s.type).slice(0,80).join(',')}; },
      frame:(t)=>{ if(!sim) asegurar(t+4); render(t); return cv.toDataURL('image/jpeg',.94);},
      audio:async(dur)=>{ if(!sim) asegurar(dur+4); const ctx=new OfflineAudioContext(2,Math.ceil(48000*dur),48000); const M=new Motor(ctx,INST.S);
        if(sim){ M.voz=vozSintetica(ctx,196); M.vozHz=196; visitantesAudio(ctx,M); }
        for(const L of TL.list) for(const e of TL[L]) e.done=false;
        M.agendaTodo=true; M.agenda(0,dur,0); const buf=await ctx.startRendering(); return wav(buf); }};
    document.title='LISTO'; return; }
  document.getElementById('carga').style.display='none';
  if('museo' in P){ arrancar(P.modo==='pub'?'pub':P.modo==='ddj'?'ddj':'auto'); return; }
  document.getElementById('inicio').style.display='flex';
}
// voz de prueba para la simulación (formantes de una "o" sostenida)
function vozSintetica(ctx,f){ const n=Math.floor(ctx.sampleRate*1.4), b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++){ const t=i/ctx.sampleRate; let s=0; for(let k=1;k<18;k++){ const fk=f*k*(1+.004*Math.sin(t*5.5)); const w=Math.exp(-Math.pow((fk-570)/120,2))+.6*Math.exp(-Math.pow((fk-840)/160,2))+.05; s+=Math.sin(2*Math.PI*fk*t)*w/k; } d[i]=s*.4*Math.min(1,t*8,(1.4-t)*6); }
  return b; }
// en el render de prueba se oye también al "visitante" (palmadas y voz), bajito, para entender causa y efecto
function visitantesAudio(ctx,M){ const g=ctx.createGain(); g.gain.value=.22; g.connect(ctx.destination);
  for(const e of TL.visitante){
    if(e.kind==='golpe'){ const s=ctx.createBufferSource(); s.buffer=M.noise; const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=e.bright<.3?300:1600; bp.Q.value=1.2; const eg=ctx.createGain();
      eg.gain.setValueAtTime(e.vel,e.t); eg.gain.exponentialRampToValueAtTime(.001,e.t+.09); s.connect(bp).connect(eg).connect(g); s.start(e.t,H1(e.t)*.5); s.stop(e.t+.12); }
    if(e.kind==='notaOn'){ const fin=TL.visitante.find(x=>x.kind==='notaOff'&&x.id===e.id); const t1=fin?fin.t:e.t+1; const s=ctx.createBufferSource(); s.buffer=vozSintetica(ctx,e.f); s.loop=true;
      const eg=ctx.createGain(); eg.gain.setValueAtTime(0,e.t); eg.gain.linearRampToValueAtTime(.6,e.t+.06); eg.gain.setValueAtTime(.6,t1); eg.gain.linearRampToValueAtTime(0,t1+.08); s.connect(eg).connect(g); s.start(e.t); s.stop(t1+.1); } } }
function wav(buf){ const n=buf.length, ch=2, b=new DataView(new ArrayBuffer(44+n*ch*2)); const w=(o,s)=>{for(let i=0;i<s.length;i++)b.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');b.setUint32(4,36+n*ch*2,true);w(8,'WAVE');w(12,'fmt ');b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,ch,true);b.setUint32(24,48000,true);b.setUint32(28,48000*ch*2,true);b.setUint16(32,ch*2,true);b.setUint16(34,16,true);w(36,'data');b.setUint32(40,n*ch*2,true);
  const L=buf.getChannelData(0),R=buf.getChannelData(1); let o=44; for(let i=0;i<n;i++){ for(const x of [L[i],R[i]]){ b.setInt16(o,Math.max(-1,Math.min(1,x))*32767,true); o+=2; } }
  let s=''; const u8=new Uint8Array(b.buffer); for(let i=0;i<u8.length;i+=32768) s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768)); return btoa(s); }

async function arrancar(modo){
  document.getElementById('inicio').style.display='none'; document.body.style.cursor='none';
  const ctx=new AudioContext({latencyHint:'interactive'}); await ctx.resume();
  ST.mode=modo;
  for(const L of [...TL.list,'waves','holds','shots','impacts','bars','tract']) TL[L].length=0;
  if(modo!=='auto'){ try{ await activarOido(ctx); }catch(e){ if(modo==='pub') ST.mode='auto'; } }
  iniciarDDJ();
  const M=new Motor(ctx,INST.S); window.MOTOR=M; const t0=ctx.currentTime+.15; M.off=t0; let agendado=0; M.horizonte=0;
  window.AHORA=()=>ctx.currentTime-t0;
  if(ST.mode!=='auto'){ shot(0,'sueno',{dur:60,live:true}); INST.lastEv=-99; INST.acto='REPOSO'; }
  Q.base=[W,H];
  const loop=(ts)=>{
    requestAnimationFrame(loop);
    const tp=ctx.currentTime-t0;
    if(ST.mode==='auto') asegurar(tp+3);
    else { escuchar(tp,ctx,INST); INST.tick(Math.max(0,tp)); }
    const hasta=tp+.25; if(hasta>agendado){ M.agenda(agendado,hasta,t0); agendado=hasta; M.horizonte=agendado; }
    if(ts) pacer(ts);
    const S=shotAt(Math.max(0,tp)); if(S!==Q.shot){ Q.shot=S; aplicarCalidad(); }
    if(NIV[Q.cur].half){ Q.flip=!Q.flip; if(Q.flip) return; }
    render(Math.max(0,tp));
  }; requestAnimationFrame(loop);
}
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='f') document.documentElement.requestFullscreen?.();
  if(k==='k'){ OIDO.calibrando=240; OIDO._cal=OIDO.nivel; }                 // calibrar: 4 s de sala en silencio
  if(window.AHORA && (k==='p'||k==='i')) aInstrumento(AHORA(),k==='p'?'pub':'ddj');
});
