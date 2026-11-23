// ======================================================================
// VØID_LOOM · CÓRTEX — dsp.js (AudioWorklet)
// Síntesis física muestra a muestra, con eventos colocados con precisión de muestra:
// · CUERDA: Karplus-Strong con retardo fraccional, posición de púa y filtro de bucle con brillo
// · CHAPA: síntesis modal (8 modos inarmónicos de placa, caídas cortas): metal golpeado, nunca campana
// ======================================================================
const DSP_SRC=`
class Cuerda{ constructor(sr,e){ this.sr=sr; const f=e.f; this.L=sr/f; this.N=Math.ceil(this.L)+4; this.buf=new Float32Array(this.N); this.w=0;
    this.fr=this.L-Math.floor(this.L); this.g=Math.pow(.001,1/(f*(e.dec||1.6))); this.a=.2+.75*(e.bright??.5); this.lp=0; this.amp=e.v; this.pan=e.pan||0; this.life=Math.floor(sr*((e.dec||1.6)+.3));
    let s=e.seed||1; const pick=Math.max(2,Math.floor(this.L*(e.pick||.23)));
    const ex=new Float32Array(this.N); for(let i=0;i<Math.floor(this.L);i++){ s=(s*16807)%2147483647; ex[i]=s/2147483647*2-1; }
    let y=0; const ab=.25+.7*(e.bright??.5); for(let i=0;i<Math.floor(this.L);i++){ y=ab*ex[i]+(1-ab)*y; this.buf[i]=y-(i>=pick?ex[i-pick]*.5:0); } this.w=Math.floor(this.L); }
  next(){ const N=this.N, r=(this.w-Math.floor(this.L)+N)%N, r2=(r-1+N)%N; const x=this.buf[r]*(1-this.fr)+this.buf[r2]*this.fr;
    this.lp=this.a*x+(1-this.a)*this.lp; const y=this.lp*this.g; this.buf[this.w]=y; this.w=(this.w+1)%N; this.life--; return x*this.amp; } }
class Chapa{ constructor(sr,e){ const R=e.ratios||[1,1.59,2.14,2.3,2.65,2.92,3.16,3.5]; this.m=[]; this.pan=e.pan||0; this.life=Math.floor(sr*1.4);
    for(let i=0;i<R.length;i++){ const f=e.f*R[i]; if(f>sr*.45) continue; const dec=(e.dec||.5)*Math.pow(.72,i)*(1+.3*Math.sin(i*7.3)); const r=Math.exp(-1/(dec*sr)), w=2*Math.PI*f/sr;
      this.m.push({a1:2*r*Math.cos(w),a2:-r*r,y1:0,y2:0,g:(1-r*r)*8*(1/(1+i*.6))*(i===0?.6:1)*(1-(e.bright??.5)*.3+(i>3?(e.bright??.5)*.5:0))}); }
    this.amp=e.v*.22; this.ex=Math.floor(sr*.0015); this.s=e.seed||7; }
  next(){ let x=0; if(this.ex>0){ this.s=(this.s*16807)%2147483647; x=(this.s/2147483647*2-1); this.ex--; }
    let o=0; for(const m of this.m){ const y=m.a1*m.y1+m.a2*m.y2+x*m.g; m.y2=m.y1; m.y1=y; o+=y; } this.life--; return o*this.amp; } }
class Voces extends AudioWorkletProcessor{
  constructor(){ super(); this.q=[]; this.v=[]; this.port.onmessage=(ev)=>{ for(const e of [].concat(ev.data)) this.q.push(e); this.q.sort((a,b)=>a.t-b.t); }; }
  process(inp,out){ const o=out[0], L=o[0], R=o[1]||o[0], n=L.length, t0=currentTime, dt=1/sampleRate;
    for(let i=0;i<n;i++){
      while(this.q.length && this.q[0].t<=t0+i*dt){ const e=this.q.shift(); if(this.v.length<48) this.v.push(e.k==='cuerda'?new Cuerda(sampleRate,e):new Chapa(sampleRate,e)); }
      let l=0,r=0; for(const v of this.v){ const x=v.next(); const p=(v.pan+1)*.785398; l+=x*Math.cos(p); r+=x*Math.sin(p); }
      L[i]=l; R[i]=r; }
    if(this.v.length) this.v=this.v.filter(v=>v.life>0);
    return true; } }
registerProcessor('cortex-voces',Voces);
`;
async function cargarDSP(ctx){ const url=URL.createObjectURL(new Blob([DSP_SRC],{type:'application/javascript'})); await ctx.audioWorklet.addModule(url); return new AudioWorkletNode(ctx,'cortex-voces',{numberOfInputs:0,outputChannelCount:[2]}); }
