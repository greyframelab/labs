// ======================================================================
// VØID_LOOM · MURMULLO — sonido.js
// Mismo motor en vivo (AudioContext) y en render (OfflineAudioContext).
// Kit: DATOS (micro-golpes FM, uno por idioma), PISTÓN (los bots), bombo, CHAPA (ediciones
// enormes), bajo reese (páginas nuevas), glitch (reversiones) y un dron grave que sigue al mundo.
// Seco: sin delay ni eco. Una sala corta y oscura solo para chapa y bajo.
// ======================================================================
function hzM(m){ return 440*Math.pow(2,(m-69)/12); }
class Sonido{
  constructor(ctx,P,dest){
    this.ctx=ctx; this.P=P; dest=dest||ctx.destination; const c=ctx;
    this.out=c.createGain(); this.out.gain.value=.4;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=26;
    const shelf=c.createBiquadFilter(); shelf.type='highshelf'; shelf.frequency.value=2200; shelf.gain.value=-6;
    const comp=c.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3; comp.attack.value=.003; comp.release.value=.12; comp.knee.value=6;
    const lim=c.createDynamicsCompressor(); lim.threshold.value=-4.5; lim.ratio.value=20; lim.attack.value=.001; lim.release.value=.06; lim.knee.value=0;
    this.out.connect(hp).connect(shelf).connect(comp).connect(lim).connect(dest);
    // sala corta y oscura
    this.verb=c.createConvolver(); this.verb.buffer=this.ir(1.1,2400); this.send=c.createGain(); this.send.gain.value=.16; this.send.connect(this.verb).connect(this.out);
    const nb=c.createBuffer(1,c.sampleRate,c.sampleRate), nd=nb.getChannelData(0); let s=9871; for(let i=0;i<nd.length;i++){ s=(s*16807)%2147483647; nd[i]=s/2147483647*2-1; } this.noise=nb;
    // bus de percusión con saturación paralela suave
    this.perc=c.createGain(); this.perc.connect(this.out);
    const ws=c.createWaveShaper(); const cu=new Float32Array(1024); for(let i=0;i<1024;i++){ const x=i/511.5-1; cu[i]=Math.tanh(2.6*x); } ws.curve=cu;
    const sg=c.createGain(); sg.gain.value=.22; this.kb=c.createGain(); this.kb.connect(this.perc); this.kb.connect(ws).connect(sg).connect(this.perc);
    // ---- DRON: FM grave + sub + una segunda voz (quinta / tritono en la ruptura)
    const f0=hzM(P.root); this.f0=f0;
    this.dr=c.createGain(); this.dr.gain.value=0; this.drLP=c.createBiquadFilter(); this.drLP.type='lowpass'; this.drLP.frequency.value=420; this.drLP.Q.value=.6;
    this.dr.connect(this.drLP).connect(this.out);
    const osc=(type,f)=>{ const o=c.createOscillator(); o.type=type; o.frequency.value=f; o.start(0); return o; };
    this.sub=osc('sine',f0/2); this.subG=c.createGain(); this.subG.gain.value=0; this.sub.connect(this.subG).connect(this.out);
    this.car=osc('sine',f0); this.mod=osc('sine',f0*2.0013); this.modG=c.createGain(); this.modG.gain.value=f0*.8; this.mod.connect(this.modG).connect(this.car.frequency);
    const cg=c.createGain(); cg.gain.value=.5; this.car.connect(cg).connect(this.dr);
    this.s1=osc('sawtooth',f0*1.4983); this.s1G=c.createGain(); this.s1G.gain.value=0; const s1lp=c.createBiquadFilter(); s1lp.type='lowpass'; s1lp.frequency.value=300; this.s1.connect(s1lp).connect(this.s1G).connect(this.dr);
    this.s2=osc('sawtooth',f0*1.4142); this.s2G=c.createGain(); this.s2G.gain.value=0; const s2lp=c.createBiquadFilter(); s2lp.type='lowpass'; s2lp.frequency.value=280; this.s2.connect(s2lp).connect(this.s2G).connect(this.dr);
    this.s3=osc('sawtooth',f0*1.0595); this.s3G=c.createGain(); this.s3G.gain.value=0; this.s3.connect(this.s3G).connect(s2lp);
  }
  ir(dur,lp){ const c=this.ctx, n=Math.floor(c.sampleRate*dur), b=c.createBuffer(2,n,c.sampleRate); let s=4242;
    for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); let y=0; const a=Math.exp(-2*Math.PI*lp/c.sampleRate);
      for(let i=0;i<n;i++){ s=(s*16807)%2147483647; const x=s/2147483647*2-1; y=y*a+x*(1-a); d[i]=y*Math.pow(1-i/n,3)*(i<c.sampleRate*.008?i/(c.sampleRate*.008):1); } }
    return b; }
  env(g,t,a,peak,d){ g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.setTargetAtTime(0,t+a,d/4); }
  // ---------------- voces
  tick(t,v,f,pan,del){ // DATOS: un idioma = una altura. Seco y corto.
    const c=this.ctx, car=c.createOscillator(), mod=c.createOscillator(), mg=c.createGain(), g=c.createGain(), p=c.createStereoPanner();
    car.frequency.value=f; mod.frequency.value=f*(del?1.5:2.31); mg.gain.setValueAtTime(f*(del?1.2:3.2),t); mg.gain.exponentialRampToValueAtTime(f*.05,t+.012);
    mod.connect(mg).connect(car.frequency); car.connect(g); p.pan.value=pan; g.connect(p).connect(this.perc);
    const d=del?.09:.045; this.env(g,t,.0015,.32*v,d); car.start(t); mod.start(t); car.stop(t+d*2.5); mod.stop(t+d*2.5);
  }
  hat(t,v){ // PISTÓN: la máquina. Ruido filtrado, muy corto, medio-agudo domado.
    const c=this.ctx, n=c.createBufferSource(), bp=c.createBiquadFilter(), g=c.createGain(); n.buffer=this.noise;
    bp.type='bandpass'; bp.frequency.value=3100; bp.Q.value=2.2; n.connect(bp).connect(g).connect(this.perc);
    this.env(g,t,.0008,.11*v,.018); n.start(t,(t*7.13)%0.9); n.stop(t+.06);
    const o=c.createOscillator(), og=c.createGain(); o.frequency.value=210; o.connect(og).connect(this.perc); this.env(og,t,.0005,.05*v,.008); o.start(t); o.stop(t+.03);
  }
  kick(t,v){ // cuerpo (barrido grave) + armónico corto + clic: seco, con pegada
    const c=this.ctx, o=c.createOscillator(), g=c.createGain();
    o.frequency.setValueAtTime(155,t); o.frequency.exponentialRampToValueAtTime(46,t+.06); o.frequency.exponentialRampToValueAtTime(40,t+.4);
    o.connect(g).connect(this.kb); this.env(g,t,.0015,.95*v,.3); o.start(t); o.stop(t+.7);
    const o2=c.createOscillator(), g2=c.createGain(); o2.type='triangle'; o2.frequency.setValueAtTime(310,t); o2.frequency.exponentialRampToValueAtTime(92,t+.03);
    o2.connect(g2).connect(this.kb); this.env(g2,t,.001,.28*v,.04); o2.start(t); o2.stop(t+.12);
    const n=c.createBufferSource(), lp=c.createBiquadFilter(), ng=c.createGain(); n.buffer=this.noise; lp.type='lowpass'; lp.frequency.value=2600;
    n.connect(lp).connect(ng).connect(this.kb); this.env(ng,t,.0005,.22*v,.006); n.start(t,.3); n.stop(t+.03);
  }
  caja(t,v){ // contratiempo: ruido con cuerpo FM, corto y seco (el borrado suena)
    const c=this.ctx, n=c.createBufferSource(), bp=c.createBiquadFilter(), g=c.createGain(); n.buffer=this.noise;
    bp.type='bandpass'; bp.frequency.value=1500; bp.Q.value=.9; n.connect(bp).connect(g).connect(this.perc);
    this.env(g,t,.001,.32*v,.09); n.start(t,(t*3.1)%0.8); n.stop(t+.25);
    const car=c.createOscillator(), mod=c.createOscillator(), mg=c.createGain(), cg=c.createGain();
    car.frequency.setValueAtTime(240,t); car.frequency.exponentialRampToValueAtTime(170,t+.05); mod.frequency.value=377; mg.gain.setValueAtTime(500,t); mg.gain.exponentialRampToValueAtTime(10,t+.04);
    mod.connect(mg).connect(car.frequency); car.connect(cg).connect(this.perc); this.env(cg,t,.001,.26*v,.06); car.start(t); mod.start(t); car.stop(t+.2); mod.stop(t+.2);
  }
  chapa(t,v,f,pan){ // metal golpeado (FM inarmónica), el brillo muere en milisegundos
    const c=this.ctx, p=c.createStereoPanner(); p.pan.value=pan; const g=c.createGain(); g.connect(p); p.connect(this.perc); p.connect(this.send);
    for(const [r,a,d] of [[1,1,.28],[2.76,.45,.12],[5.4,.18,.05]]){
      const car=c.createOscillator(), mod=c.createOscillator(), mg=c.createGain(), pg=c.createGain();
      car.frequency.value=f*r; mod.frequency.value=f*r*1.414; mg.gain.setValueAtTime(f*r*4,t); mg.gain.exponentialRampToValueAtTime(f*r*.1,t+.06);
      mod.connect(mg).connect(car.frequency); car.connect(pg).connect(g); this.env(pg,t,.001,a*.36*v,d); car.start(t); mod.start(t); car.stop(t+d*3); mod.stop(t+d*3);
    }
    g.gain.value=1;
  }
  bajo(t,dur,f){ // reese: dos sierras que baten, filtro que se cierra
    const c=this.ctx, lp=c.createBiquadFilter(), g=c.createGain(); lp.type='lowpass'; lp.Q.value=4;
    lp.frequency.setValueAtTime(900,t); lp.frequency.exponentialRampToValueAtTime(160,t+dur);
    for(const dt of [-.006,.006]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f*(1+dt); o.connect(lp); o.start(t); o.stop(t+dur+.2); }
    const s=c.createOscillator(); s.frequency.value=f; s.connect(g); s.start(t); s.stop(t+dur+.2);
    lp.connect(g); g.connect(this.out); g.connect(this.send);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.2,t+.008); g.gain.setValueAtTime(.2,t+dur*.7); g.gain.linearRampToValueAtTime(0,t+dur+.1);
  }
  glitch(t,f,STEP){ // guerra de ediciones: el golpe se repite, cada vez más rápido y más grave
    let tt=t; for(let i=0;i<7;i++){ this.tick(tt,.7-i*.06,f*Math.pow(.92,i),(i%2?.5:-.5),false); tt+=STEP/2*Math.pow(.78,i); }
  }
  inhala(t,v){ // un borrado grande: el aire entra (ruido que crece y se corta)
    const c=this.ctx, n=c.createBufferSource(), bp=c.createBiquadFilter(), g=c.createGain(); n.buffer=this.noise;
    bp.type='bandpass'; bp.Q.value=3; bp.frequency.setValueAtTime(380,t); bp.frequency.exponentialRampToValueAtTime(1500,t+.16);
    n.connect(bp).connect(g).connect(this.perc); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.12*v,t+.15); g.gain.linearRampToValueAtTime(0,t+.162); n.start(t,.5); n.stop(t+.2);
  }
  // ---------------- el dron sigue a los actos
  acto(t,acto,rate){
    const A=[[.05,.10,0,0,.3],[.07,.14,.05,0,.55],[.09,.16,0,.06,1.2],[.06,.12,.03,0,.25]][acto];
    const tc=acto===2?.08:1.2;
    this.dr.gain.setTargetAtTime(A[0]*2.4,t,tc); this.subG.gain.setTargetAtTime(A[1],t,tc);
    this.s1G.gain.setTargetAtTime(A[2],t,tc*2); this.s2G.gain.setTargetAtTime(A[3],t,tc); this.s3G.gain.setTargetAtTime(A[3]*.7,t,tc);
    this.modG.gain.setTargetAtTime(this.f0*A[4]*(1+Math.min(1,rate/40)*.5),t,tc);
    this.drLP.frequency.setTargetAtTime(acto===2?900:acto===3?260:420+Math.min(300,rate*6),t,tc);
  }
  // un paso de la partitura → sonidos
  paso(P,rate){
    const t=P.t;
    if(P.s16===0 && (P.bar===0||P.bar===4||P.bar===10||P.bar===13)) this.acto(t,P.acto,rate);
    if(P.silencio && P.s16===14){ for(const g of [this.dr.gain,this.subG.gain,this.s1G.gain,this.s2G.gain,this.s3G.gain]) g.setTargetAtTime(0,t,.015); }
    if(P.kick) this.kick(t,P.kick);
    if(P.tick){ if(P.tick.del && Math.abs(P.tick.e.delta)>700 && P.acto!==0) this.inhala(t-.15,P.tick.v); else { this.tick(t,P.tick.v,P.tick.f,P.tick.pan,P.tick.del); if(P.tick.doble) this.tick(t+P.dur/2,P.tick.v*.6,P.tick.f*1.5,-P.tick.pan,false); } }
    if(P.caja) this.caja(t,P.caja);
    if(P.hat){ this.hat(t,P.hat); if(P.ratchet) this.hat(t+P.dur/2,P.hat*.7); }
    if(P.chapa) this.chapa(t,P.chapa.v,P.chapa.f,P.chapa.pan);
    if(P.bajo) this.bajo(t,P.bajo.dur,P.bajo.f);
    if(P.glitch) this.glitch(t,P.glitch.f,P.dur);
    if(P.ruptura){ this.kick(t,1); this.chapa(t,1,this.f0*2,0); }
  }
}
if(typeof window!=='undefined') window.Sonido=Sonido;
