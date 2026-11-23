// ======================================================================
// VØID_LOOM · CÓRTEX — sonido.js
// El instrumento (WebAudio). Mismo motor en vivo y en el render offline.
// Seis voces, una por región; drones que cambian con cada sueño; groove IDM cuando hay pulso.
// ======================================================================
const BEAT=.5, BAR=2, PASE=16;
class Motor{
  constructor(ctx,S){
    this.ctx=ctx; const c=ctx; this.S=S;
    this.out=c.createGain(); this.out.gain.value=.62;
    const shelf=c.createBiquadFilter(); shelf.type='highshelf'; shelf.frequency.value=2200; shelf.gain.value=-6;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=24;
    const comp=c.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=3; comp.attack.value=.004; comp.release.value=.14; comp.knee.value=6;
    const lim=c.createDynamicsCompressor(); lim.threshold.value=-2; lim.ratio.value=20; lim.attack.value=.001; lim.release.value=.05;
    this.out.connect(hp).connect(shelf).connect(comp).connect(lim).connect(c.destination);
    // sala: reverb oscura y corta; cuánta, la decide la referencia del sueño
    this.verb=c.createConvolver(); this.verb.buffer=this.ir(1.6,3200); this.send=c.createGain(); this.send.gain.value=S.sala;
    this.send.connect(this.verb).connect(this.out);
    this.drum=c.createGain(); this.drum.connect(this.out);
    this.inst=c.createGain(); this.inst.connect(this.out); this.inst.connect(this.send);
    // ruido para transitorios
    const nb=c.createBuffer(1,c.sampleRate*1,c.sampleRate), nd=nb.getChannelData(0); let s=12345; for(let i=0;i<nd.length;i++){ s=(s*16807)%2147483647; nd[i]=s/2147483647*2-1; } this.noise=nb;
    // saturación paralela del bombo para el móvil
    const khp=c.createBiquadFilter(); khp.type='highpass'; khp.frequency.value=180;
    const ws=c.createWaveShaper(); const cu=new Float32Array(1024); for(let i=0;i<1024;i++){const x=i/511.5-1;cu[i]=Math.tanh(3*x);} ws.curve=cu;
    const sg=c.createGain(); sg.gain.value=.3; this.kickBus=c.createGain(); this.kickBus.connect(this.drum); this.kickBus.connect(khp); khp.connect(ws).connect(sg).connect(this.drum);
    // ---- DRONES (bus con sidechain). El sueño elige qué motor manda.
    this.dr=c.createGain(); this.dr.gain.value=1; this.dr.connect(this.out); this.dr.connect(this.send);
    this.drMaster=c.createGain(); this.drMaster.gain.value=1; this.drMaster.connect(this.dr);
    const f0=hz(S.root); this.f0=f0;
    const mk=(type,f,g)=>{const o=c.createOscillator();o.type=type;o.frequency.value=f;const gg=c.createGain();gg.gain.value=g;o.connect(gg);o.start(0);return [o,gg];};
    [this.sub,this.subG]=mk('sine',f0,0); this.subG.connect(this.drMaster);
    this.fm=[]; for(const [mult,pan] of [[2,-.5],[3,.5]]){
      const [car,cg]=mk('sine',f0*mult,0); const [mod,mg]=mk('sine',f0*mult*1.0007,0); mg.connect(car.frequency);
      const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; const pn=c.createStereoPanner(); pn.pan.value=pan;
      cg.connect(lp).connect(pn).connect(this.drMaster); this.fm.push({car,cg,mod,mg,mult,lp});
    }
    this.add=[]; for(let k=1;k<=10;k++){ const [o,g]=mk('sine',f0*k*(1+.0009*(k%3-1)),0); const pn=c.createStereoPanner(); pn.pan.value=(k%2?-.3:.3); g.connect(pn).connect(this.drMaster); this.add.push({o,g,k}); }
    // coro: sierras desafinadas bajo un paso bajo que respira
    this.coroLP=c.createBiquadFilter(); this.coroLP.type='lowpass'; this.coroLP.frequency.value=500; this.coroLP.Q.value=.7; this.coroG=c.createGain(); this.coroG.gain.value=0;
    this.coroLP.connect(this.coroG).connect(this.drMaster);
    for(const [m,dt] of [[1,-7],[1,6],[1.5,-4],[2,3]]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f0*m; o.detune.value=dt; const g=c.createGain(); g.gain.value=.08; o.connect(g).connect(this.coroLP); o.start(0); }
    // anillo: modulación en anillo, metálico y oscuro
    this.anG=c.createGain(); this.anG.gain.value=0; const anM=c.createGain(); anM.gain.value=0; const [a1]=mk('sine',f0*2.01,1); a1.disconnect(); a1.connect(anM); const [a2]=mk('sine',f0*.503,1); a2.disconnect(); a2.connect(anM.gain); anM.connect(this.anG).connect(this.drMaster);
    // tensión: segunda menor en la ruptura
    [this.ten,this.tenG]=mk('sine',hz(S.root+13),0); this.tenG.connect(this.drMaster);
    this.notas={};      // notas sostenidas abiertas (voz o pads)
    this.dsp=null;      // voces físicas (AudioWorklet): se cargan en init()
    this.voz=null;      // buffer con la voz del visitante (solo en memoria)
  }
  async init(){ try{ this.dsp=await cargarDSP(this.ctx); const g=this.ctx.createGain(); g.gain.value=1; this.dsp.connect(g); g.connect(this.inst); }catch(e){ console.warn('DSP no disponible',e); this.dsp=null; } return this; }
  fis(e){ if(this.dsp){ this.dsp.port.postMessage(e); return true; } return false; }
  ir(dur,damp){ const c=this.ctx, n=Math.floor(dur*c.sampleRate), b=c.createBuffer(2,n,c.sampleRate);
    for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); let s=777+ch*31, lp=0; const a=Math.exp(-2*Math.PI*damp/c.sampleRate);
      for(let i=0;i<n;i++){ s=(s*16807)%2147483647; const w=s/2147483647*2-1; lp=a*lp+(1-a)*w; d[i]=lp*Math.exp(-i/n*6.5)*(i<c.sampleRate*.012?0:1); } }
    return b; }
  env(g,t,a,peak,dec){ g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.setTargetAtTime(0,t+a,dec/4); }
  pan(p){ const n=this.ctx.createStereoPanner(); n.pan.value=clamp(p,-1,1); return n; }
  // ---------------- VOCES DE REGIÓN ----------------
  // 0 FRONTAL · metal FM golpeado (ratio inarmónico del sueño)
  metal(t,m,v,pn){ const S=this.S;
    if(this.fis({k:'chapa',t,f:hz(m),v:v*1.1,pan:pn,dec:.25+.7*S.decay,bright:S.bright,seed:Math.floor(t*9973)%2147483646+1,
      ratios:[1,1.59*S.fmRatio/2.2,2.14,2.3*S.fmRatio/2,2.65,2.92,3.16*S.fmRatio/2.4,3.5]})){ v*=.35; }
    const c=this.ctx,f=hz(m),car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),g=c.createGain();
    car.frequency.value=f; mod.frequency.value=f*this.S.fmRatio; mg.gain.setValueAtTime(f*(2+4*v*this.S.bright),t); mg.gain.setTargetAtTime(f*.2,t,.05+.1*this.S.decay);
    mod.connect(mg).connect(car.frequency); this.env(g,t,.002,v*.34,this.S.decay); const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1800+2200*this.S.bright;
    car.connect(g).connect(lp).connect(this.pan(pn)).connect(this.inst); const e=t+this.S.decay*3; car.start(t); mod.start(t); car.stop(e); mod.stop(e);
    const s=c.createOscillator(),sg=c.createGain(); s.frequency.value=f/2; this.env(sg,t,.003,v*.22,.18); s.connect(sg).connect(this.inst); s.start(t); s.stop(t+.8); }
  // 1 CENTRAL · cuerda física pulsada: parciales inarmónicos con caídas distintas + transitorio de ruido filtrado
  cuerda(t,m,v,pn){
    if(this.fis({k:'cuerda',t,f:hz(m),v:v*.9,pan:pn,dec:.8+1.6*this.S.decay,bright:this.S.bright,pick:.13+.2*H1(t),seed:Math.floor(t*7919)%2147483646+1})){
      if(m<50) this.fis({k:'cuerda',t:t+.004,f:hz(m+12),v:v*.35,pan:-pn,dec:.6+this.S.decay,bright:this.S.bright*.8,pick:.31,seed:Math.floor(t*104729)%2147483646+1});
      return; }
    const c=this.ctx,f=hz(m),out=c.createGain(); out.gain.value=1; out.connect(this.pan(pn)).connect(this.inst);
    [[1,1,.9],[2.01,.5,.55],[3.03,.33,.35],[4.1,.22,.2],[5.2,.14,.12]].forEach(([r,a,d])=>{ const o=c.createOscillator(),g=c.createGain(); o.frequency.value=f*r; this.env(g,t,.001,v*a*.3,d*(.6+this.S.decay)); o.connect(g).connect(out); o.start(t); o.stop(t+d*4+.5); });
    const n=c.createBufferSource(); n.buffer=this.noise; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f*3; bp.Q.value=6; const ng=c.createGain(); this.env(ng,t,.0005,v*.25,.03);
    n.connect(bp).connect(ng).connect(out); n.start(t,H1(t)*.5); n.stop(t+.1); }
  // 2 PARIETAL · formantes de voz (sierra por dos filtros de vocal)
  vocal(t,m,v,pn,dur=.5,vowel){ const c=this.ctx,f=hz(m), F={a:[730,1090],e:[530,1840],o:[570,840],u:[300,870]}[vowel||this.S.vocal];
    const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.setValueAtTime(-30,t); o.detune.linearRampToValueAtTime(0,t+.12);
    const g=c.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.3,t+.04); g.gain.setTargetAtTime(0,t+dur,.12);
    const mix=c.createGain(); for(const [fr,q,a] of [[F[0],9,1],[F[1],12,.55]]){ const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=fr; bp.Q.value=q; const ga=c.createGain(); ga.gain.value=a; o.connect(bp).connect(ga).connect(mix); }
    mix.connect(g).connect(this.pan(pn)).connect(this.inst); o.start(t); o.stop(t+dur+1); }
  // 3 OCCIPITAL · pulso de sub con caída de tono y clic suave
  pulso(t,m,v,pn){ const c=this.ctx,f=hz(m),o=c.createOscillator(),g=c.createGain(); o.frequency.setValueAtTime(f*2,t); o.frequency.exponentialRampToValueAtTime(f,t+.09);
    this.env(g,t,.002,v*.6,.45); o.connect(g).connect(this.drum); o.start(t); o.stop(t+1.5);
    const h=c.createOscillator(),hg=c.createGain(); h.type='triangle'; h.frequency.value=f*4; this.env(hg,t,.001,v*.12,.05); h.connect(hg).connect(this.pan(pn)).connect(this.drum); h.start(t); h.stop(t+.2); }
  // 4 TEMPORAL · la voz del visitante hecha granos (si no hay voz, formantes)
  granos(t,m,v,pn){ if(!this.voz){ return this.vocal(t,m,v,pn,.35,'o'); }
    const c=this.ctx, B=this.voz, base=this.vozHz||220, rate=clamp(hz(m)/base,.25,3), n=10+Math.floor(v*14);
    for(let i=0;i<n;i++){ const s=c.createBufferSource(); s.buffer=B; s.playbackRate.value=rate*(1+(H1(t*9+i)-.5)*.02);
      const g=c.createGain(), d=.05+.09*H1(t+i*3.1), ti=t+i*.028+H1(t*3+i)*.01; g.gain.setValueAtTime(0,ti); g.gain.linearRampToValueAtTime(v*.32*(1-i/n*.6),ti+d*.4); g.gain.linearRampToValueAtTime(0,ti+d);
      s.connect(g).connect(this.pan(pn+(H1(i)-.5)*.6)).connect(this.inst); const off=H1(t*7+i*13)*Math.max(.01,B.duration-d-.01); s.start(ti,off,d+.01); } }
  // 5 CEREBELO · ráfaga de micro-clics a 1/32 (precisión de máquina)
  clics(t,m,v,pn){ const pat=[1,0,1,1,0,1,0,1]; for(let i=0;i<8;i++) if(pat[(i+Math.floor(t*7))%8]) this.blip(t+i*BEAT/8,900+i*120+hz(m),2.5,v*(.55-.04*i),pn+(i%2?.3:-.3),.022); }
  golpe(t,reg,m,v,pn){ [this.metal,this.cuerda,this.vocal,this.pulso,this.granos,this.clics][reg].call(this,t,m,v,pn); }
  // ---------------- NOTAS SOSTENIDAS (voz que se sostiene, pads mantenidos) ----------------
  notaOn(id,t,m,v,reg,pn){ const c=this.ctx,f=hz(m); if(this.notas[id]) this.notaOff(id,t);
    const car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),g=c.createGain(),lp=c.createBiquadFilter();
    car.type=reg===2?'sawtooth':'sine'; car.frequency.value=f; mod.frequency.value=f*(reg===0?this.S.fmRatio:2); mg.gain.value=f*(.6+1.4*v);
    mod.connect(mg).connect(car.frequency); lp.type='lowpass'; lp.frequency.setValueAtTime(300,t); lp.frequency.linearRampToValueAtTime(900+1400*v,t+.6); lp.Q.value=2;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.2,t+.18);
    const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=4.5+H1(t)*2; lg.gain.value=f*.004; lfo.connect(lg).connect(car.frequency);
    const c2=c.createOscillator(); c2.type='sawtooth'; c2.frequency.value=f*1.004; const g2=c.createGain(); g2.gain.value=.35; c2.connect(g2).connect(lp);
    const sb=c.createOscillator(); sb.frequency.value=f/2; const sg=c.createGain(); sg.gain.value=.5; sb.connect(sg).connect(g);
    const fl=c.createOscillator(), flg=c.createGain(); fl.frequency.value=.23+H1(t*3)*.2; flg.gain.value=500*v; fl.connect(flg).connect(lp.frequency);
    car.connect(lp).connect(g).connect(this.pan(pn)).connect(this.inst); for(const o of [car,mod,lfo,c2,sb,fl]) o.start(t);
    this.notas[id]={car,mod,lfo,g,c2,sb,fl,f}; }
  notaMod(id,t,m){ const N=this.notas[id]; if(!N) return; const f=hz(m); for(const [o,k] of [[N.car,1],[N.mod,N.mod.frequency.value/N.f],[N.c2,1.004],[N.sb,.5]]) o.frequency.setTargetAtTime(f*k,t,.06); N.f=f; }
  notaOff(id,t){ const N=this.notas[id]; if(!N) return; delete this.notas[id]; N.g.gain.cancelScheduledValues(t); N.g.gain.setValueAtTime(N.g.gain.value||.1,t); N.g.gain.setTargetAtTime(0,t,.35); for(const o of [N.car,N.mod,N.lfo,N.c2,N.sb,N.fl]) o&&o.stop(t+2.5); }
  // ---------------- RITMO ----------------
  kick(t,v,rup,ghost){ const c=this.ctx;
    const fs=ghost?140:(rup?175:128), fe=ghost?62:44, tail=ghost?.07:(rup?.17:.27);
    // cuerpo: seno con caída de tono en dos tiempos (golpe y cola)
    const o=c.createOscillator(),g=c.createGain(); o.frequency.setValueAtTime(fs,t); o.frequency.exponentialRampToValueAtTime(fe*1.25,t+.035); o.frequency.exponentialRampToValueAtTime(fe,t+.16);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.9,t+.0015); g.gain.setTargetAtTime(0,t+.012,tail/2.6);
    o.connect(g).connect(this.kickBus); o.start(t); o.stop(t+tail*4);
    // segundo armónico corto: el bombo se oye en el móvil
    const h=c.createOscillator(),hg=c.createGain(); h.frequency.setValueAtTime(fs*2,t); h.frequency.exponentialRampToValueAtTime(fe*2,t+.05); this.env(hg,t,.001,v*.18,.07); h.connect(hg).connect(this.kickBus); h.start(t); h.stop(t+.3);
    // clic: ruido en banda, 3 ms
    const n=c.createBufferSource(); n.buffer=this.noise; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=rup?3200:2400; bp.Q.value=1.4;
    const ng=c.createGain(); ng.gain.setValueAtTime(v*(ghost?.05:rup?.32:.16),t); ng.gain.exponentialRampToValueAtTime(.0001,t+.006); n.connect(bp).connect(ng).connect(this.kickBus); n.start(t,H1(t*3)*.5); n.stop(t+.02);
    this.dr.gain.cancelScheduledValues(t); this.dr.gain.setValueAtTime(1-.45*Math.min(v,1),t); this.dr.gain.setTargetAtTime(1,t+.01,.12); }
  // latido en reposo: dos golpes de sub muy bajos (lub-dub)
  latido(t,v){ for(const [dt,a] of [[0,1],[.22,.7]]){ const c=this.ctx,o=c.createOscillator(),g=c.createGain(); o.frequency.setValueAtTime(this.f0*1.5,t+dt); o.frequency.exponentialRampToValueAtTime(this.f0*.75,t+dt+.12); this.env(g,t+dt,.006,v*a*.5,.3); o.connect(g).connect(this.drum); o.start(t+dt); o.stop(t+dt+1.2); } }
  hat(t,v,abierto,pan){ const c=this.ctx, mix=c.createGain(); mix.gain.value=.16;
    for(const f of [263,400,421,474,587,845]){ const o=c.createOscillator(); o.type='square'; o.frequency.value=f*1.6; o.connect(mix); o.start(t); o.stop(t+(abierto?.35:.08)); }
    const hp=c.createBiquadFilter(); hp.type='bandpass'; hp.frequency.value=8800; hp.Q.value=.9; const hp2=c.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=6800;
    const g=c.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.5,t+.0006); g.gain.setTargetAtTime(0,t+.001,abierto?.06:.012);
    mix.connect(hp).connect(hp2).connect(g).connect(this.pan(pan)).connect(this.drum); }
  blip(t,f,idx,v,pan,d){ const c=this.ctx,car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),g=c.createGain(),pn=c.createStereoPanner();
    car.frequency.value=f; mod.frequency.value=f*1.414; mg.gain.setValueAtTime(idx*f,t); mg.gain.exponentialRampToValueAtTime(1,t+d*.6);
    mod.connect(mg).connect(car.frequency); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.32,t+.0005); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    pn.pan.value=clamp(pan,-1,1); car.connect(g).connect(pn).connect(this.drum); car.start(t); mod.start(t); car.stop(t+d+.02); mod.stop(t+d+.02); }
  bass(t,m,d,v){ const c=this.ctx,f=hz(m),o=c.createOscillator(),o2=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth'; o.frequency.value=f; o2.type='sine'; o2.frequency.value=f; lp.type='lowpass'; lp.Q.value=4;
    lp.frequency.setValueAtTime(260+900*v,t); lp.frequency.exponentialRampToValueAtTime(160,t+d);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.42,t+.002); g.gain.setTargetAtTime(0,t+.02,d/3);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(this.out); o.start(t); o2.start(t); o.stop(t+d*3); o2.stop(t+d*3); }
  // ---------------- DRONES: estado espectral cada 50 ms ----------------
  drones(t,dt,s){
    const f=(p,v)=>p.setTargetAtTime(v,t,dt*1.2), S=this.S, live=(1-s.dark)*s.dronAmt, w={fm:1,coro:0,anillo:0,aditivo:.6};
    w[S.dron]=1.2; if(S.dron!=='fm') w.fm=.45;
    f(this.subG.gain,(.18+.38*Math.min(s.de,1.2))*.5*live);
    for(const F of this.fm){ f(F.cg.gain,(.16+.3*Math.min(s.al+.3*s.th,1.2))*live*.5*w.fm); f(F.mg.gain,F.car.frequency.value*(.4+1.6*s.al+s.raw+s.voz*.8)); f(F.lp.frequency,500+1300*Math.min(s.al+s.voz*.5,1)); }
    const form=300+900*Math.min(s.th+s.voz*.4,1.2);
    for(const A of this.add){ const fk=this.f0*A.k, ww=Math.exp(-Math.pow((fk-form)/260,2))+.04; f(A.g.gain,ww/Math.sqrt(A.k)*.08*live*w.aditivo); }
    f(this.coroG.gain,.5*live*w.coro*(.5+.5*Math.min(s.th+s.voz,1))); f(this.coroLP.frequency,300+900*Math.min(s.al+s.voz*.6,1.2));
    f(this.anG.gain,.12*live*w.anillo*(.4+s.be));
    f(this.tenG.gain,s.ten*.3);
    f(this.send.gain,S.sala*(1+s.voz*.6));
  }
  // agenda lo que cae en [a,b) del tiempo de pieza (render offline y AUTOPLAY)
  agenda(a,b,off){
    for(const L of TL.list) for(const e of TL[L]) if(!e.done && e.t>=a && e.t<b){ this.tocar(L,e,off); }
    for(let t=Math.ceil(a/.05)*.05;t<b;t+=.05) this.drones(t+off,.05,espectro(t));
  }
  tocar(L,e,off){ const t=e.t+off; e.done=OFF?e.done:true;
    if(L==='kicks') this.kick(t,e.v,e.rup,e.ghost);
    else if(L==='blips') this.blip(t,e.f,e.idx,e.v,e.pan,e.d);
    else if(L==='bass') this.bass(t,e.m,e.d,e.v);
    else if(L==='rats') for(let i=0;i<e.n;i++) this.blip(t+i*BEAT/8,700*Math.pow(2,i/6),2.5,.35+.08*i,.5-i*.18,.025);
    else if(L==='glitch') for(let i=0;i<8;i++) this.blip(t+i*BEAT/16,1400+i*90,4,.5-.04*i,(i%2?.5:-.5),.02);
    else if(L==='hits') this.golpe(t,e.reg,e.m,e.v,e.pan);
    else if(L==='latidos') this.latido(t,e.v);
    else if(L==='notasOn') this.notaOn(e.id,t,e.m,e.v,e.reg,e.pan);
    else if(L==='notasOff') this.notaOff(e.id,t);
    else if(L==='notasMod') this.notaMod(e.id,t,e.m);
    else if(L==='hats') this.hat(t,e.v,e.ab,e.pan);
  }
}
