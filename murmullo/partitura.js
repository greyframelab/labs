// ======================================================================
// VØID_LOOM · MURMULLO — partitura.js
// Una sola partitura para imagen y sonido. Las ediciones reales caen en una rejilla
// de semicorcheas: el ritmo lo escribe el mundo, la forma (cuatro actos) la pone la pieza.
// Referencia de esta pieza: Autechre (rejillas que rotan, golpes secos, sin melodía).
// ======================================================================
const ACTOS=['SEÑAL','TENSIÓN','RUPTURA','ECO'];
function actoDe(bar){ return bar<4?0: bar<10?1: bar<13?2:3; }
const DENS=[.16,.36,.58,.09];                 // densidad objetivo de golpes por acto
const PLANTILLA=[1,.3,.5,.35,.8,.3,.55,.42,.9,.3,.5,.36,.76,.46,.62,.5];
const ESCALA=[0,1,3,5,7,8,10];                // frigio: oscuro, sin dulzura
function euclid(k,n,rot){ const o=[]; for(let i=0;i<n;i++) o.push(((i+rot)*k)%n<k?1:0); return o; }

class Partitura{
  constructor(seed){
    this.seed=seed; const r=rng(seed*131+7); this.r=r;
    this.root=[38,37,41,33][Math.floor(r()*4)];  // Re por defecto en la mayoría de semillas
    if(r()<.5) this.root=38;
    this.rot=Math.floor(r()*16); this.swing=r()*.16;
    this.bpm=120; this.t0=0; this.vuelta=0;
    this.thr=6; this.ultBajo=-9; this.ultChapa=-9;
    this.cola=[];        // eventos pendientes de colocar
    this.paso=0;         // índice global de semicorchea
    this.botFrac=.45; this._bots=[]; this.ritmo=28;
    this.ultRevert=null; this.grieta=null;
  }
  get STEP(){ return 60/this.bpm/4; }
  // tempo por vuelta: el ritmo del mundo marca el BPM (96–136), solo cambia al empezar vuelta
  fijaTempo(rate){ this.ritmo=rate; this.bpm=Math.round(96+Math.max(0,Math.min(1,(rate-12)/36))*40); }
  mete(evs){ for(const e of evs) this.cola.push(e); }
  langF(lang){ const h=hashStr(lang); const deg=ESCALA[h%ESCALA.length]; const oct=(h>>>5)%3; return 440*Math.pow(2,(this.root+24+12*oct+deg-69)/12); }
  // genera el siguiente paso de la rejilla con los eventos llegados hasta su instante
  siguiente(){
    const STEP=this.STEP, k=this.paso, s16=k%16, barG=Math.floor(k/16), bar=barG%16;
    if(s16===0 && bar===0 && k>0){ this.vuelta++; this.fijaTempo(this.ritmo); this.swing=this.r()*.16; this.rot=(this.rot+5)%16; }
    const t=this.t0+this._acum(k)+(s16%2?STEP*this.swing:0);   // shuffle de la vuelta
    const acto=actoDe(bar);
    // eventos de este paso
    const ev=[]; while(this.cola.length && this.cola[0].t<=t){ ev.push(this.cola.shift()); }
    const P={k,t,s16,bar,vuelta:this.vuelta,acto,ev,dur:STEP,bpm:this.bpm};
    const w=PLANTILLA[(s16+this.rot)%16];
    // fracción de bots (última vuelta de 2 compases)
    for(const e of ev) if(e.kind!=='log') this._bots.push(e.bot?1:0);
    while(this._bots.length>400) this._bots.shift();
    if(this._bots.length>40) this.botFrac=this._bots.reduce((a,b)=>a+b,0)/this._bots.length;
    // ---- golpe principal (DATOS): la edición humana con más peso, si supera el umbral
    let best=null, bs=0;
    for(const e of ev){ if(e.bot||e.kind==='log') continue; const s=Math.log2(Math.abs(e.delta)+2)*w*(e.kind==='new'?1.4:1); if(s>bs){bs=s;best=e;} }
    const dens=DENS[acto];
    const fired=best && bs>this.thr;
    this.thr*= fired? (1+(1-dens)*.07) : (1-dens*.07);
    this.thr=Math.max(.5,Math.min(40,this.thr));
    if(fired){ P.tick={v:Math.min(1,.35+bs/this.thr*.3), f:this.langF(best.lang), pan:((hashStr(best.wiki)%200)/100-1)*.7, del:best.kind==='del', e:best}; best._suena=true; }
    // ---- bombo: rejilla euclidiana que rota cada compás (TENSIÓN y RUPTURA) + ediciones grandes
    const big=ev.reduce((m,e)=>(!e.bot&&Math.abs(e.delta)>m.d)?{d:Math.abs(e.delta),e}:m,{d:0,e:null});
    if(acto===1||acto===2){ const eu=euclid(acto===2?7:5,16,(bar*3+this.rot)%16); if(eu[s16]) P.kick=acto===2?1:.82; }
    if(big.d>3500 && w>.7 && acto!==3){ P.kick=Math.max(P.kick||0, acto===0?.0:.9); if(k-this.ultChapa>3){ P.chapa={v:Math.min(1,.4+Math.log10(big.d)/8), f:this.langF(big.e.lang)/2, pan:((hashStr(big.e.wiki)%200)/100-1)*.6, e:big.e}; this.ultChapa=k; big.e._suena=true; } }
    // ---- máquina: los bots son hats a rejilla exacta; densidad = fracción real de bots
    if(acto===1||acto===2){ const nb=ev.filter(e=>e.bot).length; const hk=Math.round(this.botFrac*16*(acto===2?.8:.55)); if(euclid(hk,16,this.rot)[s16] && nb>0) P.hat=Math.min(1,.25+nb*.08); if(nb>=7 && acto===2) P.ratchet=1; }
    // ---- caja: los borrados reales hacen el contratiempo (solo si hay un borrado en ese paso)
    if((acto===1||acto===2) && (s16===4||s16===12||(acto===2&&s16===14)) && ev.some(e=>e.kind==='del'&&!e.bot)) P.caja=acto===2?1:.8;
    // ---- ratchet humano: dos ediciones del mismo idioma en el mismo paso = golpe doble
    if(P.tick && acto>=1){ const L=P.tick.e.lang; if(ev.filter(e=>!e.bot&&e.lang===L).length>=2) P.tick.doble=true; }
    // ---- páginas nuevas: una nota de bajo (monofónico, separado al menos un tiempo)
    const nueva=ev.find(e=>e.kind==='new'&&!e.bot);
    if(nueva && acto!==3 && k-this.ultBajo>=4){ P.bajo={f:this.langF(nueva.lang)/8, dur:STEP*(acto===2?3:2), e:nueva}; this.ultBajo=k; nueva._suena=true; }
    // ---- reversiones: una guerra de ediciones es un glitch (y la grieta de la RUPTURA)
    const rv=ev.find(e=>e.kind==='revert');
    if(rv){ this.ultRevert=rv; if(acto!==0) { P.glitch={f:this.langF(rv.lang), e:rv}; rv._suena=true; } }
    if(bar===9 && s16>=14){ P.silencio=true; delete P.tick; delete P.caja; delete P.kick; delete P.hat; delete P.ratchet; delete P.chapa; delete P.bajo; delete P.glitch; }
    if(bar===10 && s16===0){ P.ruptura=true; P.grietaDe=this.ultRevert; }
    if(bar===13 && s16===0) P.eco=true;
    if(bar===0 && s16===0) P.senal=true;
    this.paso++;
    return P;
  }
  // tiempo acumulado hasta el paso k (el tempo cambia entre vueltas)
  _acum(k){ if(!this._t){ this._t=[0]; this._bpmDe=[]; } while(this._t.length<=k){ const i=this._t.length-1; this._t.push(this._t[i]+60/this.bpm/4); } return this._t[k]; }
}
if(typeof window!=='undefined'){ window.Partitura=Partitura; window.ACTOS=ACTOS; window.actoDe=actoDe; }
