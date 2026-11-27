// ======================================================================
// VØID_LOOM · MURMULLO — main.js
// Montaje: actos → planos, luz y pulido. En vivo y en render, el mismo código.
// ======================================================================
const Q=new URLSearchParams(location.search);
const RENDER=Q.has('render');
const ACENTOS={ambar:[1,.62,.05],rojo:[1,.1,.1],cian:[0,.9,1],violeta:[.54,.17,1],blanco:[.9,.92,1]};
const LAT=1.4;                 // latencia: lo que llega se coloca en la rejilla 1,4 s después
const M={};

function v3(x,y,z){ return [x,y,z]; }
function sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; } function add(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }
function mul(a,s){ return [a[0]*s,a[1]*s,a[2]*s]; } function nrm(a){ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function mira(p,t,up,fov,foco,apert){ const f=nrm(sub(t,p)); const r=nrm(cross(f,up||[0,1,0])); const u=cross(r,f); return {p,f,r,u,fov,foco:foco||Math.hypot(...sub(t,p)),apert:apert||1}; }
function uv2w(u,v){ return [(u-.5)*SLAB[0],0,(v-.5)*SLAB[1]]; }
const ease=x=>x*x*(3-2*x);

// ------------------------------------------------------------ planos
// cada plano: tipo + semilla + punto de interés. Deriva lenta dentro del plano.
function plano(S,tl){
  const r=rng(S.seed*977+13), a=r()*6.283; let T=S.T;
  const dir=[Math.cos(a),0,Math.sin(a)]; let perp=[-dir[2],0,dir[0]];
  let cam, bar0, barD, rakeL;
  if(S.tipo==='ABISMO'){ // escala: cámara muy baja y abierta que se eleva despacio; el territorio se pierde en negro
    const Tg=S.T||[0,0,0]; const h=.45+r()*.25+tl*.07;
    const p=add(sub(Tg,mul(dir,4.2+tl*.04)),[0,h,0]);
    cam=mira(p,add(Tg,add(mul(dir,2.5),[0,-.15,0])),null,.62,Math.hypot(...sub(Tg,p)),.9);
  } else if(S.tipo==='RASANTE'){
    // mirando hacia el centro de la losa: siempre un largo renglón por delante
    const Tc=[Math.max(-5.5,Math.min(5.5,T[0])),0,Math.max(-3,Math.min(3,T[2]))]; T=Tc;
    const toC=nrm([-T[0]+(r()-.5)*4,0,-T[2]+(r()-.5)*3]); dir[0]=toC[0]; dir[2]=toC[2]; perp=[-dir[2],0,dir[0]];
    const p=add(sub(T,mul(dir,3.4-tl*.05)),[0,.24+r()*.12,0]);
    cam=mira(p,add(T,add(mul(dir,1.2),[0,.1,0])),null,.36,3.2,2.4);
  } else if(S.tipo==='ESCRITURA'){ // la cámara acompaña al renglón de un idioma mientras se escribe
    const Tl=S.Tl||T, sd=r()<.5?1:-1;
    const p=add(Tl,[.42,.12+r()*.05,.26*sd]);
    cam=mira(p,add(Tl,[-.08,0,0]),null,.3,null,4.6);
  } else if(S.tipo==='MACRO'){
    const p=add(sub(T,mul(dir,.62-tl*.012)),add(mul(perp,(tl*.01)),[0,.17+r()*.05,0]));
    cam=mira(p,T,null,.3,null,4.2);
  } else { // CENITAL: la página entera del mundo
    const h=4.6-tl*.05, c=add(mul(T,.5),[Math.cos(a)*.9,h,Math.sin(a)*.9]);
    cam=mira(c,mul(T,.5),[Math.cos(a*.3),0,Math.sin(a*.3)],.4,h,.4);
  }
  // la barra de luz se coloca donde su reflejo cruza el punto de interés: un brillo que barre lo escrito
  const fv=nrm([cam.f[0],0,cam.f[2]]); const pv=[-fv[2],0,fv[0]];
  const Tf=S.tipo==='ABISMO'?(S.T||[0,0,0]):S.tipo==='CENITAL'?mul(T,.5):S.tipo==='ESCRITURA'?(S.Tl||T):T;
  const Hb={ABISMO:1.1,RASANTE:.9,MACRO:.55,ESCRITURA:.5,CENITAL:9.5}[S.tipo];
  const hd=Math.hypot(cam.p[0]-Tf[0],cam.p[2]-Tf[2]), off=S.tipo==='CENITAL'?0:Hb*hd/Math.max(.05,cam.p[1]);
  const sweep=Math.sin(tl*.35+S.seed)*(S.tipo==='CENITAL'?1.6:off*.25);
  bar0=add(Tf,add(mul(fv,off+sweep),[0,Hb,0]));
  barD=S.tipo==='CENITAL'?[Math.cos(a),0,Math.sin(a)]:pv;
  rakeL=add(mul(perp,.96),[0,.09+r()*.06,0]);
    // la luz solo existe donde pasa algo: un charco alrededor del punto de interés
  const pool=[Tf[0],Tf[2],{ABISMO:5.5,RASANTE:4.5,MACRO:2.5,ESCRITURA:2.2,CENITAL:4.2}[S.tipo]];
  return {cam,bar0,barD,barL:S.tipo==='CENITAL'?5:S.tipo==='ABISMO'?7:4,barW:(S.tipo==='MACRO'||S.tipo==='ESCRITURA')?.05:.08,rakeL,pool};
}

// ------------------------------------------------------------ montaje
class Montaje{
  constructor(seed){ this.seed=seed; this.r=rng(seed*29+5); this.S=null; this.ultTipo=''; this.n=0; this.fade=0; this.ruptura=0; this.pulso=0; this.pol=[0,0,0]; this.eco=null; this.negro=false; }
  corta(tipo,T,t){ if(Q.get('plano')) tipo=Q.get('plano'); this.n++; this.S={tipo,T:T||[0,0,0],seed:this.seed*100+this.n,t0:t}; this.ultTipo=tipo; }
  cursor(){ const c=M.E.fila(M.idioma); return uv2w(c.x,(c.row+.5)/ROWS); }
  // decide los cortes en los pasos de la partitura
  paso(P,E){
    const b=P.bar, s=P.s16, ultimo=E.ultimo, grande=E.ultGrande;
    const pt=(o)=>uv2w(o.u,o.v);
    if(P.senal || !this.S){ const u=this.r(); if(u<.6) this.corta('ESCRITURA',this.cursor(),P.t); else this.corta(u<.8?'RASANTE':'MACRO',pt(ultimo),P.t); this.eco=null; }
    if(P.acto===1 && s===0 && (b===4||b===6||b===7||b===8)){ const tipos=['MACRO','RASANTE','CENITAL','ABISMO'].filter(x=>x!==this.ultTipo); this.corta(tipos[Math.floor(this.r()*tipos.length)],pt(b%2?grande:ultimo),P.t); }
    if(P.acto===1 && b===9 && (s===0||s===8)) { if(s===0) this.corta('ESCRITURA',this.cursor(),P.t); else this.corta('RASANTE',pt(grande),P.t); }
    this.negro = (b===9 && s>=14);                // antes del golpe, negro
    if(P.ruptura){ this.corta('ABISMO',pt(E.grietaP||ultimo),P.t); this.ruptura=1; }
    if(P.acto===2 && s===0 && b===11) this.corta('MACRO',pt(E.grietaP||ultimo),P.t);
    if(P.acto===2 && s===8 && b===12) this.corta('CENITAL',pt(E.grietaP||ultimo),P.t);
    if(P.eco){ this.corta('CENITAL',pt(E.grietaP||ultimo),P.t); this.eco={t0:P.t,dur:P.dur*16*3}; }
    if(P.acto===3 && b===15 && s===0) this.corta('ABISMO',pt(E.grietaP||ultimo),P.t);
    if(P.kick) this.pulso=Math.max(this.pulso,P.kick);
    if(P.tick) this.pulso=Math.max(this.pulso,P.tick.v*.35);
    this.fin=(b===15 && s>=8);                    // cada vuelta vuelve al negro
  }
  estado(t,dt,P){
    if(this.S && this.S.tipo==='ESCRITURA'){ const tg=this.cursor(); if(!this.S.Tl) this.S.Tl=tg;
      const d=Math.hypot(tg[0]-this.S.Tl[0],tg[2]-this.S.Tl[2]);
      if(d>1.2) this.S.Tl=tg; else { const k=1-Math.exp(-dt/.9); this.S.Tl=add(this.S.Tl,mul(sub(tg,this.S.Tl),k)); } }
    this.pulso*=Math.exp(-dt/.16); this.ruptura*=Math.exp(-dt/2.6);
    const objetivo=this.negro?0: this.fin?0: 1;
    this.fade+=(objetivo-this.fade)*(1-Math.exp(-dt/(this.negro?.03:this.fin?.7:.5)));
    if(this.eco){ const k=(t-this.eco.t0)/this.eco.dur; this.pol=k>=0&&k<=1?[-.1+k*1.2,.09,.9]:[0,0,0]; } else this.pol=[0,0,0];
    const acto=P?P.acto:0;
    const L=plano(this.S,t-this.S.t0);
    return {t,cam:L.cam,bar0:L.bar0,barD:L.barD,barL:L.barL,barW:L.barW,rakeL:L.rakeL,pool:L.pool,
      pulso:this.pulso, ruptura:this.ruptura, fade:this.fade,
      tira:[.45,.8,1.25,.6][acto]+this.ruptura*.6, rake:[.25,.45,.7,.35][acto]+this.pulso*.5,
      expo:[1.0,1.1,1.25,1.0][acto]*(+(Q.get('expo')||1)), dof:1, acento:M.acento};
  }
}

// ------------------------------------------------------------ historia previa: la losa ya lleva horas escrita
function historia(E,I,seed){
  const ev=simula(seed+999,0,60*14,30);
  const capas=7, por=Math.ceil(ev.length/capas);
  for(let c=0;c<capas;c++){
    const list=[]; for(const e of ev.slice(c*por,(c+1)*por)) for(const s of E.sello(e,false)){ s.emis=0; s.brillo=0; list.push(s); }
    I.sella(list); I._flushStamps();
    I.pule(.25,[.5,2,.9]); I.pule(.25,[.5,2,.9]);  // pulido parcial: lo viejo queda debajo
  }
}

// ------------------------------------------------------------ arranque
async function iniciar(){
  const seed=+(Q.get('seed')||Math.floor(Math.random()*1e6)); M.seed=seed; M.idioma=(Q.get('idioma')||'es')+'wiki';
  const pick=Q.get('acento')||['ambar','ambar','rojo','cian','violeta','blanco'][seed%6]; M.acento=ACENTOS[pick]||ACENTOS.ambar;
  const cv=document.getElementById('c');
  const W=+(Q.get('w')||innerWidth), H=+(Q.get('h')||innerHeight);
  M.I=new Imagen(cv,{render:RENDER,w:W,h:H,q:+(Q.get('q')||1)});
  M.E=new Escritura(seed); M.Mo=new Montaje(seed); M.P=new Partitura(seed);
  historia(M.E,M.I,seed);
  if(RENDER){ prepRender(); document.title='LISTO'; return; }
  document.getElementById('carga').style.display='none'; document.getElementById('inicio').style.display='flex';
}

function aplica(P){ // un paso de la partitura → escritura en la losa
  const list=[]; for(const e of P.ev) for(const s of M.E.sello(e,!!e._suena)) list.push(s);
  if(P.ruptura){ const g=M.E.grieta(P.grietaDe); list.push(...g); M.E.grietaP={u:g[0].u,v:g[0].v}; }
  M.I.sella(list); M.Mo.paso(P,M.E); M.ultP=P;
}

// ---------------- en vivo
function arrancar(){
  document.getElementById('inicio').style.display='none';
  const ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'playback'}); M.ctx=ctx;
  M.S=new Sonido(ctx,M.P);
  M.F=new Flujo(()=>ctx.currentTime,M.seed); M.F.conecta();
  M.P.t0=ctx.currentTime+LAT; M.P.fijaTempo(28);
  M.vis=[]; let last=performance.now();
  setInterval(()=>{ M.F.tick(); M.P.ritmo=M.F.ritmo||M.P.ritmo; M.P.mete(M.F.saca().map(e=>(e.t+=LAT,e)));
    while(true){ const k=M.P.paso; const tn=M.P.t0+M.P._acum(k); if(tn>ctx.currentTime+.18) break; const P=M.P.siguiente(); M.S.paso(P,M.P.ritmo); M.vis.push(P); } },25);
  // calidad automática: si no llega a ~55 fps, baja la resolución interna (80 %, 70 %, 60 %); si va sobrado, recupera. Solo en un corte de plano.
  let ema=1/60, cortes=0, paso30=false, impar=false;
  const loop=()=>{ const now=performance.now(), dt=(now-last)/1000; last=now; const t=ctx.currentTime;
    ema=ema*.97+dt*.03;
    if(M.Mo.n!==cortes){ cortes=M.Mo.n; const q=M.I.q;
      if(ema>1/52){ if(q>.61) M.I.calidad(Math.round((q-.1)*10)/10); else paso30=true; }
      else if(ema<1/58 && q<1){ M.I.calidad(Math.min(1,Math.round((q+.1)*10)/10)); paso30=false; } }
    if(paso30){ impar=!impar; if(impar){ requestAnimationFrame(loop); return; } }
    while(M.vis.length && M.vis[0].t<=t) aplica(M.vis.shift());
    M.I.avanza(dt,M.Mo.pol); const C=M.Mo.estado(t,dt,M.ultP); M.I.dibuja(C); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  addEventListener('keydown',e=>{ if(e.key==='f'||e.key==='F') document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen(); });
  addEventListener('resize',()=>M.I.resize(innerWidth,innerHeight));
  window.MURMULLO_ESTADO=()=>({estado:M.F.estado, ritmo:M.F.ritmo.toFixed(1), recibidos:M.F.recibidos, bpm:M.P.bpm, acto:ACTOS[actoDe(M.ultP?M.ultP.bar:0)]});
}

// ---------------- render offline (validación): mismo motor, flujo de MEMORIA con semilla
function prepRender(){
  window.MURMULLO={
    prepara(dur){
      const ev=simula(M.seed,0,dur+2,+(Q.get('ritmo')||30)); M.P.t0=0; M.P.fijaTempo(+(Q.get('ritmo')||30));
      M.P.mete(ev.map(e=>({...e})));
      M.pasos=[]; while(true){ const k=M.P.paso; if(M.P._acum(k)>dur) break; M.pasos.push(M.P.siguiente()); }
      M.ip=0; M.tv=0; return {pasos:M.pasos.length, bpm:M.P.bpm, eventos:ev.length};
    },
    frame(t){
      const sub=Math.max(1,Math.ceil((t-M.tv)/(1/30)));
      for(let i=0;i<sub;i++){ const tt=M.tv+(t-M.tv)*(i+1)/sub, dt=(t-M.tv)/sub;
        while(M.ip<M.pasos.length && M.pasos[M.ip].t<=tt) aplica(M.pasos[M.ip++]);
        M.I.avanza(dt,M.Mo.pol); M.C=M.Mo.estado(tt,dt,M.ultP); }
      M.tv=t; M.C.render=true; M.I.dibuja(M.C); return M.I.cv.toDataURL('image/jpeg',.93);
    },
    async audio(dur){
      const sr=48000, ctx=new OfflineAudioContext(2,Math.ceil(sr*dur),sr); const P2=new Partitura(M.seed); const S=new Sonido(ctx,P2);
      for(const P of M.pasos) if(P.t<dur-.05) S.paso(P,M.P.ritmo);
      const buf=await ctx.startRendering(); return wavB64(buf);
    },
    info(){ return {acto:M.ultP&&ACTOS[M.ultP.acto], bar:M.ultP&&M.ultP.bar, plano:M.Mo.S&&M.Mo.S.tipo}; }
  };
}
function wavB64(buf){ const n=buf.length, ch=buf.numberOfChannels, out=new DataView(new ArrayBuffer(44+n*ch*2)); const w=(o,s)=>{ for(let i=0;i<s.length;i++) out.setUint8(o+i,s.charCodeAt(i)); };
  w(0,'RIFF'); out.setUint32(4,36+n*ch*2,true); w(8,'WAVE'); w(12,'fmt '); out.setUint32(16,16,true); out.setUint16(20,1,true); out.setUint16(22,ch,true); out.setUint32(24,buf.sampleRate,true); out.setUint32(28,buf.sampleRate*ch*2,true); out.setUint16(32,ch*2,true); out.setUint16(34,16,true); w(36,'data'); out.setUint32(40,n*ch*2,true);
  const d=[...Array(ch)].map((_,i)=>buf.getChannelData(i)); let o=44; for(let i=0;i<n;i++) for(let c=0;c<ch;c++){ const v=Math.max(-1,Math.min(1,d[c][i])); out.setInt16(o,v*32767,true); o+=2; }
  let s=''; const u8=new Uint8Array(out.buffer); for(let i=0;i<u8.length;i+=32768) s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768)); return btoa(s); }
