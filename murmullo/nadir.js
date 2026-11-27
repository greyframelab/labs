// ======================================================================
// VØID_LOOM · MURMULLO — nadir.js
// Modo de audio NADIR: dark ambient inquietante con metales de cine. La referencia es
// Tineidae para el lecho y Blade Runner 2049 para los metales: CS-80 grave y desafinado,
// sub enorme y reverb de catedral. Sin batería; el pulso es un latido.
// Lee la misma partitura que la imagen:
//   ediciones humanas → susurros (ruido con formantes de vocal: el murmullo de la gente)
//   edición enorme    → metal arqueado grave        página nueva → swell de metal CS-80
//   bots              → máquina lejana (tic)        borrado      → portazo lejano (contratiempo)
//   reversión         → aire al revés y caída       RUPTURA      → BRAAM + caída de sub
// Agudos domados, sin delay; solo una sala larga y oscura.
// ======================================================================
class SonidoNadir{
  constructor(ctx,P,dest){
    this.ctx=ctx; this.P=P; dest=dest||ctx.destination; const c=ctx; const r=rng(P.seed*313+9); this.r=r;
    this.out=c.createGain(); this.out.gain.value=.36;
    this.duck=c.createGain(); this.duck.gain.value=1;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=22;
    const shelf=c.createBiquadFilter(); shelf.type='highshelf'; shelf.frequency.value=2200; shelf.gain.value=-6;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7000; lp.Q.value=.5;
    const comp=c.createDynamicsCompressor(); comp.threshold.value=-13; comp.ratio.value=2; comp.attack.value=.01; comp.release.value=.3; comp.knee.value=8;
    const lim=c.createDynamicsCompressor(); lim.threshold.value=-5.5; lim.ratio.value=20; lim.attack.value=.001; lim.release.value=.08; lim.knee.value=0;
    this.out.connect(this.duck).connect(hp).connect(shelf).connect(lp).connect(comp).connect(lim).connect(dest);
    // catedral oscura: cola larga, sin brillo
    this.verb=c.createConvolver(); this.verb.buffer=this.ir(5.5,1500); this.send=c.createGain(); this.send.gain.value=.55; this.send.connect(this.verb).connect(this.out);
    const nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate), nd=nb.getChannelData(0); let s=7717; for(let i=0;i<nd.length;i++){ s=(s*16807)%2147483647; nd[i]=s/2147483647*2-1; } this.noise=nb;
    this.tanh=new Float32Array(1024); for(let i=0;i<1024;i++){ const x=i/511.5-1; this.tanh[i]=Math.tanh(2.4*x); }
    const f0=hzM(P.root); this.f0=f0; this.fc=f0; this.ton=[];   // Re2 por defecto; ton: osciladores que siguen la tonalidad de la vuelta
    // cada vuelta es otra sala: tonalidad, intervalo del lecho, voz protagonista y latido cambian (orden propio de la semilla)
    this.voces=['teclas','campana','coro','vacio'].sort(()=>r()-.5); this.V={tr:0,voz:this.voces[0],lat:[0,3],int:16/15,braam:0}; this.Vm=1;
    const osc=(type,f,det)=>{ const o=c.createOscillator(); o.type=type; o.frequency.value=f; if(det) o.detune.value=det; o.start(0); return o; };
    const lfo=(rate,depth,param)=>{ const l=osc('sine',rate), g=c.createGain(); g.gain.value=depth; l.connect(g).connect(param); return l; };
    // ---- 1 · SUB que respira
    this.subG=c.createGain(); this.subG.gain.value=0; this.subG.connect(this.out);
    for(const [m,a] of [[.5,1],[1,.45]]){ const o=osc('sine',f0*m), g=c.createGain(); g.gain.value=a; o.connect(g).connect(this.subG); this.ton.push({o,m}); }
    const br=c.createGain(); br.gain.value=.75; lfo(.045,.25,br.gain); this.subG.disconnect(); this.subG.connect(br).connect(this.out);
    // ---- 2 · LECHO CS-80: raíz y segunda menor alta que baten (inquietud), filtro que respira, vibrato lento
    this.bedG=c.createGain(); this.bedG.gain.value=0; this.bedLP=c.createBiquadFilter(); this.bedLP.type='lowpass'; this.bedLP.frequency.value=240; this.bedLP.Q.value=1.2;
    lfo(.031,90,this.bedLP.frequency);
    for(const [m,a] of [[1,.5],[2,.25],[2*16/15,.14],[3,.06]]) for(const d of [-9,9]){ const o=osc('sawtooth',f0*m,d), g=c.createGain(); g.gain.value=a*.5; lfo(.13+r()*.1,5,o.detune); o.connect(g).connect(this.bedLP); this.ton.push({o,m,int:m===2*16/15}); }
    this.bedLP.connect(this.bedG); this.bedG.connect(this.out); this.bedG.connect(this.send);
    // ---- 3 · MURMULLO continuo: ruido por formantes de vocal; su nivel lo pone cuánta gente escribe
    this.murG=c.createGain(); this.murG.gain.value=0; this.murG.connect(this.out); this.murG.connect(this.send);
    const ns=c.createBufferSource(); ns.buffer=this.noise; ns.loop=true; ns.start(0);
    for(const [f,q,a] of [[420,7,1],[780,8,.7],[1250,9,.35]]){ const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f; bp.Q.value=q; lfo(.07+r()*.08,f*.12,bp.frequency); const g=c.createGain(); g.gain.value=a; lfo(.21+r()*.3,a*.6,g.gain); ns.connect(bp).connect(g).connect(this.murG); }
    // ---- 4 · CRISTAL: dos senos medios que casi coinciden (batido lento, inquietante), muy bajos
    this.criG=c.createGain(); this.criG.gain.value=0; this.criG.connect(this.send); this.criG.connect(this.out);
    for(const [m,d] of [[8,0],[8*45/32,0],[8,11]]){ const o=osc('sine',f0*m/2,d), g=c.createGain(); g.gain.value=.3; o.connect(g).connect(this.criG); this.ton.push({o,m:m/2}); }
    // ---- 5 · DESCENSO: un racimo grave que se hunde durante la TENSIÓN (se programa por vuelta)
    this.desG=c.createGain(); this.desG.gain.value=0; this.desLP=c.createBiquadFilter(); this.desLP.type='lowpass'; this.desLP.frequency.value=380; this.desLP.connect(this.desG); this.desG.connect(this.out); this.desG.connect(this.send);
    this.des=[[1,-6],[1,6],[1.5,0]].map(([m,d])=>{ const o=osc('sawtooth',f0*2*m,d); o.connect(this.desLP); return {o,m}; });
  }
  ir(dur,lp){ const c=this.ctx, n=Math.floor(c.sampleRate*dur), b=c.createBuffer(2,n,c.sampleRate); let s=31337;
    for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); let y=0; const a=Math.exp(-2*Math.PI*lp/c.sampleRate);
      for(let i=0;i<n;i++){ s=(s*16807)%2147483647; const x=s/2147483647*2-1; y=y*a+x*(1-a); const k=i/n; d[i]=y*Math.pow(1-k,2.2)*(i<c.sampleRate*.03?i/(c.sampleRate*.03):1)*1.6; } }
    return b; }
  _out(g,pan,send){ const c=this.ctx, p=c.createStereoPanner(); p.pan.value=pan||0; g.connect(p); p.connect(this.out); if(send){ const sg=c.createGain(); sg.gain.value=send; p.connect(sg).connect(this.send); } }
  // ---------------- voces
  susurro(t,v,lang,pan){ // una persona escribe: un soplo con vocal (formante por idioma)
    const c=this.ctx, r=this.r, V=[[300,870],[400,800],[500,1700],[700,1100],[350,640],[600,1000],[280,2250],[450,1450]][Math.floor(r()*8)], k=(.82+r()*.4)*this.Vm;
    const n=c.createBufferSource(); n.buffer=this.noise; const g=c.createGain(); const L=.07+r()*.2;
    const b1=c.createBiquadFilter(), b2=c.createBiquadFilter(); b1.type=b2.type='bandpass'; b1.frequency.setValueAtTime(V[0]*k,t); b2.frequency.setValueAtTime(V[1]*k,t); b2.frequency.linearRampToValueAtTime(V[1]*k*(.8+r()*.4),t+L); b1.Q.value=6; b2.Q.value=9;
    const m=c.createGain(); n.connect(b1).connect(m); n.connect(b2).connect(m); m.connect(g);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.085*v,t+L*.4); g.gain.linearRampToValueAtTime(0,t+L);
    this._out(g,pan,1.2); n.start(t,(t*1.37)%1.5); n.stop(t+L+.02);
  }
  latido(t,v){ // pulso de sub, más sentido que oído
    const c=this.ctx, o=c.createOscillator(), g=c.createGain(); o.frequency.setValueAtTime(62,t); o.frequency.exponentialRampToValueAtTime(34,t+.18);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.55*v,t+.012); g.gain.setTargetAtTime(0,t+.02,.16);
    o.connect(g); this._out(g,0,.15); o.start(t); o.stop(t+1);
  }
  tic(t,v){ // la máquina, lejos: un tic de madera hueca casi enterrado en la sala
    const c=this.ctx, o=c.createOscillator(), g=c.createGain(); o.type='triangle'; o.frequency.value=540+this.r()*60;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.05*v,t+.002); g.gain.setTargetAtTime(0,t+.003,.012);
    o.connect(g); this._out(g,(this.r()-.5)*1.4,1.6); o.start(t); o.stop(t+.1);
  }
  portazo(t,v){ // un borrado: golpe sordo lejano, como una puerta en otra sala
    const c=this.ctx, n=c.createBufferSource(), lp=c.createBiquadFilter(), g=c.createGain(); n.buffer=this.noise; lp.type='lowpass'; lp.frequency.value=380; lp.Q.value=2;
    n.connect(lp).connect(g); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.5*v,t+.004); g.gain.setTargetAtTime(0,t+.006,.07);
    this._out(g,(this.r()-.5)*.8,1.4); n.start(t,.7); n.stop(t+.5);
    const o=c.createOscillator(), og=c.createGain(); o.frequency.setValueAtTime(90,t); o.frequency.exponentialRampToValueAtTime(48,t+.15); o.connect(og); og.gain.setValueAtTime(.3*v,t); og.gain.setTargetAtTime(0,t+.01,.1); this._out(og,0,.6); o.start(t); o.stop(t+.6);
  }
  arco(t,f,v,pan){ // edición enorme: metal arqueado grave (parciales inarmónicos), ataque lento, cola larga
    const c=this.ctx, x=c.createOscillator(), g=c.createGain(), dur=3.2; x.type='sawtooth'; x.frequency.setValueAtTime(f,t); x.frequency.linearRampToValueAtTime(f*.985,t+dur);
    for(const [rr,a] of [[1,2.2],[2.76,1],[5.4,.35]]){ const bp=c.createBiquadFilter(), bg=c.createGain(); bp.type='bandpass'; bp.frequency.value=f*rr; bp.Q.value=32; bg.gain.value=a; x.connect(bp).connect(bg).connect(g); }
    const tr=c.createOscillator(), tg=c.createGain(); tr.frequency.value=3.1; tg.gain.value=.2*v; tr.connect(tg).connect(g.gain);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.45*v,t+.35); g.gain.setTargetAtTime(0,t+.6,dur/3);
    this._out(g,pan,1.1); x.start(t); tr.start(t); x.stop(t+dur*2.2); tr.stop(t+dur*2.2);
  }
  cs80(t,f,dur,v){ // página nueva: swell de metal CS-80 (dos sierras desafinadas + sub), filtro que se abre despacio, vibrato tardío
    const c=this.ctx, lp=c.createBiquadFilter(), g=c.createGain(), sh=c.createWaveShaper(); sh.curve=this.tanh; lp.type='lowpass'; lp.Q.value=1.8;
    const att=dur*.45; lp.frequency.setValueAtTime(140,t); lp.frequency.setTargetAtTime(900,t,att*.8); lp.frequency.setTargetAtTime(260,t+att*1.4,dur*.4);
    const vib=c.createOscillator(), vg=c.createGain(); vib.frequency.value=4.7; vg.gain.setValueAtTime(0,t); vg.gain.linearRampToValueAtTime(7,t+att+1);
    vib.connect(vg); const os=[vib];
    for(const d of [-8,8]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=d; vg.connect(o.detune); o.connect(lp); os.push(o); }
    const sb=c.createOscillator(); sb.frequency.value=f/2; const sbg=c.createGain(); sbg.gain.value=.6; sb.connect(sbg).connect(lp); os.push(sb);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.2*v,t+att); g.gain.setTargetAtTime(0,t+att+dur*.3,dur*.3);
    lp.connect(sh).connect(g); this._out(g,0,.9); os.forEach(o=>{ o.start(t); o.stop(t+dur*2.5); });
  }
  reves(t,f,STEP){ // reversión: el aire entra al revés y el tono se desploma
    const c=this.ctx, n=c.createBufferSource(), bp=c.createBiquadFilter(), g=c.createGain(); n.buffer=this.noise; bp.type='bandpass'; bp.Q.value=2;
    const L=STEP*6; bp.frequency.setValueAtTime(220,t-L); bp.frequency.exponentialRampToValueAtTime(1100,t);
    n.connect(bp).connect(g); g.gain.setValueAtTime(0,t-L); g.gain.exponentialRampToValueAtTime(.22,t-.01); g.gain.linearRampToValueAtTime(0,t+.005);
    this._out(g,0,.8); n.start(Math.max(0,t-L),.2); n.stop(t+.05);
    const o=c.createOscillator(), og=c.createGain(), lp=c.createBiquadFilter(); o.type='sawtooth'; lp.type='lowpass'; lp.frequency.value=500;
    o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*.35,t+1.4); o.connect(lp).connect(og);
    og.gain.setValueAtTime(.14,t); og.gain.setTargetAtTime(0,t+.3,.4); this._out(og,0,1); o.start(t); o.stop(t+2.5);
  }
  braam(t,v){ // RUPTURA: el metal enorme (5 sierras desafinadas + octava grave), filtro que se abre de golpe y se cierra; sub que cae
    const c=this.ctx, f=this.fc, lp=c.createBiquadFilter(), g=c.createGain(), sh=c.createWaveShaper(); sh.curve=this.tanh;
    lp.type='lowpass'; lp.Q.value=2.5; lp.frequency.setValueAtTime(160,t); lp.frequency.linearRampToValueAtTime([1300,900,1700,1100][this.V.braam||0]*v+300,t+[.3,.6,.18,.9][this.V.braam||0]); lp.frequency.setTargetAtTime(200,t+.4,[1.4,2.2,.9,1.8][this.V.braam||0]);
    const os=[]; for(const d of [-16,-8,0,8,16]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=d; o.connect(lp); os.push(o); }
    for(const [m,d] of [[[.5,0],[.5,6],[Math.SQRT2,-5]],[[.5,0],[1.5,4],[.75,-6]],[[.5,0],[16/15,3],[.25,0]],[[.5,0],[.5,9],[1.2,-4]]][this.V.braam||0]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f*m; o.detune.value=d; const og=c.createGain(); og.gain.value=m<1?.8:.25; o.connect(og).connect(lp); os.push(o); }
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.42*v,t+.06); g.gain.setTargetAtTime(0,t+.7,1.3);
    lp.connect(sh).connect(g); this._out(g,0,.9); os.forEach(o=>{ o.start(t); o.stop(t+7); });
    const s=c.createOscillator(), sg=c.createGain(); s.frequency.setValueAtTime(58,t); s.frequency.exponentialRampToValueAtTime(24,t+2.2); s.connect(sg);
    sg.gain.setValueAtTime(0,t); sg.gain.linearRampToValueAtTime(.8*v,t+.02); sg.gain.setTargetAtTime(0,t+.4,.9); this._out(sg,0,0); s.start(t); s.stop(t+5);
  }
  teclas(t,v,pan){ // la máquina escribe: una tecla mecánica blanda (clic filtrado + golpe sordo), sin agudos
    const c=this.ctx, n=c.createBufferSource(), bp=c.createBiquadFilter(), g=c.createGain(); n.buffer=this.noise; bp.type='bandpass'; bp.frequency.value=1500+this.r()*500; bp.Q.value=2.5;
    n.connect(bp).connect(g); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.16*v,t+.001); g.gain.setTargetAtTime(0,t+.002,.006);
    this._out(g,pan,.25); n.start(t,(t*3.1)%1.8); n.stop(t+.06);
    const o=c.createOscillator(), og=c.createGain(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(85,t+.04); o.connect(og);
    og.gain.setValueAtTime(.12*v,t); og.gain.setTargetAtTime(0,t+.004,.02); this._out(og,pan*.5,.2); o.start(t); o.stop(t+.15);
  }
  campana(t,f,v,pan){ // una campana de hierro, grave y lejana: el idioma de la vuelta suena con altura
    const c=this.ctx, g=c.createGain(); g.gain.value=1; const os=[];
    for(const [rr,a,d] of [[1,.5,3.2],[2.76,.22,1.6],[5.4,.07,.7],[.5,.25,4]]){ const o=c.createOscillator(), og=c.createGain(); o.frequency.value=f*rr; o.connect(og).connect(g);
      og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(a*.16*v,t+.004); og.gain.setTargetAtTime(0,t+.01,d/3); os.push(o); }
    this._out(g,pan,1.3); os.forEach(o=>{ o.start(t); o.stop(t+5); });
  }
  coro(t,f,dur,v){ // un coro sin palabras (sierras por formantes de vocal): sustituye al CS-80 en su vuelta
    const c=this.ctx, g=c.createGain(), m=c.createGain(); m.gain.value=1; const os=[];
    for(const [fm,d] of [[1,-7],[1,7],[1.5,-4],[2,5]]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f*fm; o.detune.value=d; o.connect(m); os.push(o); }
    for(const [ff,q,a] of [[480,6,1],[920,8,.6],[2400,10,.12]]){ const bp=c.createBiquadFilter(), bg=c.createGain(); bp.type='bandpass'; bp.frequency.setValueAtTime(ff,t); bp.frequency.linearRampToValueAtTime(ff*.82,t+dur); bp.Q.value=q; bg.gain.value=a; m.connect(bp).connect(bg).connect(g); }
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.32*v,t+dur*.5); g.gain.setTargetAtTime(0,t+dur*.6,dur*.35);
    this._out(g,0,1.4); os.forEach(o=>{ o.start(t); o.stop(t+dur*2.5); });
  }
  // ---------------- cada vuelta, otra sala
  vuelta(t,P){
    const k=P.vuelta||0, r=this.r;
    this.V={tr:[0,-2,3,-5,1,-3][k%6], voz:this.voces[k%this.voces.length], lat:[[0,3],[0,6,10],[0,8],[0,3,8,11]][(k+Math.floor(r()*2))%4], int:[16/15,45/32,8/5,6/5][(k*3)%4]};
    this.fc=this.f0*Math.pow(2,this.V.tr/12);
    for(const x of this.ton){ const m=x.int?2*this.V.int:x.m; x.o.frequency.cancelScheduledValues(t); x.o.frequency.setTargetAtTime(this.fc*m,t,2.5); }  // la sala se desliza a la nueva tonalidad
    this.send.gain.setTargetAtTime([.55,.7,.42,.6][k%4],t,1.5);
    this.idi=P.idioma||this.idi; this.V.braam=k%4; this.Vm=[1,.88,1.12,.94][k%4];   // otra garganta, otro metal
  }
  // ---------------- el lecho sigue a los actos
  acto(t,acto,rate,P){
    //            sub  lecho  murmullo cristal descenso
    const A=[[.22,.09,.05,.05,0],[.4,.2,.08,.08,.08],[.75,.36,.1,.05,0],[.18,.07,.025,.09,0]][acto];
    const tc=acto===2?.05:2.2, k=Math.min(1.4,.6+rate/40);
    this.subG.gain.setTargetAtTime(A[0],t,tc); this.bedG.gain.setTargetAtTime(A[1],t,tc); this.murG.gain.setTargetAtTime(A[2]*k,t,tc*1.5);
    this.criG.gain.setTargetAtTime(A[3]*.12,t,tc*2); this.desG.gain.setTargetAtTime(A[4],t,1.5);
    this.bedLP.frequency.setTargetAtTime(acto===2?520:acto===3?170:240,t,tc);
    const iv=[this.V.int,[16/15,6/5,45/32,8/5][(acto+(P.vuelta||0))%4],45/32,this.V.int][acto];
    for(const x of this.ton) if(x.int) x.o.frequency.setTargetAtTime(this.fc*2*iv,t,acto===2?.05:3);
    if(acto===1){ const T=P.dur*16*6; for(const d of this.des){ d.o.frequency.cancelScheduledValues(t); d.o.frequency.setValueAtTime(this.fc*2*d.m,t); d.o.frequency.exponentialRampToValueAtTime(this.fc*2*d.m*Math.pow(2,-4/12),t+T); } }
    if(this.V.voz==='vacio'){ this.criG.gain.setTargetAtTime(A[3]*.3,t,tc*2); this.murG.gain.setTargetAtTime(A[2]*k*1.6,t,tc*1.5); }   // vuelta desnuda: cristal y gente al frente
  }
  paso(P,rate){
    const t=P.t, A=P.acto;
    if(P.senal) this.vuelta(t,P);
    if(P.s16===0 && (P.bar===0||P.bar===4||P.bar===10||P.bar===13)) this.acto(t,A,rate,P);
    if(P.silencio && P.s16===14){ this.duck.gain.setTargetAtTime(0,t,.012); this.send.gain.setTargetAtTime(0,t,.01); }
    if(P.ruptura){ this.duck.gain.cancelScheduledValues(t); this.duck.gain.setValueAtTime(1,t); this.send.gain.cancelScheduledValues(t); this.send.gain.setValueAtTime(.55,t); this.braam(t,1); }
    if(P.senal && P.vuelta>0) this.braam(t,.45);                       // cada vuelta se abre con un metal lejano
    if(P.silencio) return;
    const enF=P.fuente && ((A===0&&P.bar<2)||(A===1&&P.bar===6&&(P.vuelta||0)%2===1));
    // FUENTE: la máquina lee el código; un teletipo suave al ritmo real de llegada
    if(enF && P.ev.length) this.teclas(t,Math.min(1,.25+P.ev.length*.12)*.55,(this.r()-.5)*.6);
    const V=this.V, idi=this.idi;
    if(V.voz==='teclas' && !enF){ let m=0; for(const e of P.ev){ if(e.bot||e.kind==='log'||e.lang!==idi) continue; if(m++>=2) break; this.teclas(t+m*P.dur*.25,.7,((hashStr(e.wiki)%200)/100-1)*.5); } }
    if(V.voz==='campana' && P.tick && P.tick.e && P.tick.e.lang===idi) this.campana(t,P.tick.f/4,P.tick.v,P.tick.pan);
    // el murmullo de la gente: hasta 3 susurros por paso (más en la RUPTURA)
    let n=0; const max=[1,2,3,1][A];
    for(const e of P.ev){ if(e.bot||e.kind==='log') continue; if(n++>=max) break;
      const v=Math.min(1,.25+Math.log10(Math.abs(e.delta)+10)/5)*(A===3?.5:1); this.susurro(t+this.r()*P.dur*.8,v,e.lang,((hashStr(e.wiki)%200)/100-1)*.8); }
    // latido: lub-dub al principio del compás (TENSIÓN y RUPTURA), y donde la partitura pone el bombo fuerte
    if((A===1||A===2) && V.lat.includes(P.s16)) this.latido(t,P.s16===0?1:.6);
    if(P.kick && A===2 && P.s16%4===0 && P.s16) this.latido(t,.7);
    if(P.hat && this.r()<.5) this.tic(t,P.hat);
    if(P.caja) this.portazo(t,P.caja);
    if(P.chapa) this.arco(t,P.chapa.f/2,P.chapa.v,P.chapa.pan);
    if(P.bajo){ const f=[this.fc,this.fc*16/15,this.fc*1.5,this.fc*Math.SQRT2][hashStr(P.bajo.e.lang)%4], d=Math.max(3,P.dur*24);
      if(V.voz==='coro') this.coro(t,f,d,A===2?1:.75); else this.cs80(t,f,d,A===2?1:.75); }
    if(P.glitch) this.reves(t,P.glitch.f/2,P.dur);
  }
}
if(typeof window!=='undefined') window.SonidoNadir=SonidoNadir;
