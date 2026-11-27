// ======================================================================
// VØID_LOOM · MURMULLO — flujo.js
// La partitura: las ediciones de Wikipedia de todo el mundo, en tiempo real.
// EN VIVO: Wikimedia EventStreams (recentchange). MEMORIA: si se cae, un flujo
// con la misma estadística (y la última hora vista, si la hay) para que la sala no se pare.
// Evento normalizado: {t, wiki, lang, bot, delta, kind:'edit'|'new'|'del'|'revert'|'log'}
// ======================================================================
const STREAM_URL='https://stream.wikimedia.org/v2/stream/recentchange';

function rng(seed){ let s=(seed>>>0)||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
function hashStr(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

// idioma a partir del nombre de la wiki: eswiki → es, wikidatawiki → wd, commonswiki → co
function langOf(wiki){
  if(wiki==='wikidatawiki') return 'wd';
  if(wiki==='commonswiki') return 'co';
  const m=/^([a-z\-]+?)(wiki|wiktionary|wikisource|wikinews|wikiquote|wikibooks|wikivoyage|wikiversity)$/.exec(wiki||'');
  return m?m[1]:'xx';
}
const REVERT=/(revert|undid|undo|rv\b|deshech|revertid|annul|rückgängig|annullat|откат|取り消|撤销|還原)/i;

function normaliza(d,tLocal){
  if(!d||d.type==='categorize') return null;
  if(d.namespace!==undefined && d.namespace!==0 && d.namespace!==6 && d.namespace!==120 && d.namespace!==14) {
    // otros espacios (discusiones, usuarios): solo como 'log' suave
    return {t:tLocal, wiki:d.wiki, lang:langOf(d.wiki), bot:!!d.bot, delta:0, kind:'log'};
  }
  let kind='edit', delta=0;
  if(d.type==='new'){ kind='new'; delta=(d.length&&d.length.new)||800; }
  else if(d.type==='log'){ kind='log'; }
  else if(d.type==='edit'){
    delta=((d.length&&d.length.new)||0)-((d.length&&d.length.old)||0);
    if(d.comment && REVERT.test(d.comment)) kind='revert';
    else if(delta<0) kind='del';
  } else return null;
  return {t:tLocal, wiki:d.wiki, lang:langOf(d.wiki), bot:!!d.bot, delta, kind};
}

// ---------------------------------------------------------------- MEMORIA
// Distribución aproximada del flujo global (orden de magnitud, no exacta).
const WIKIS=[['wikidatawiki',.38],['commonswiki',.16],['enwiki',.14],['dewiki',.035],['frwiki',.03],['eswiki',.03],['ruwiki',.022],['jawiki',.02],['itwiki',.018],['zhwiki',.016],['ptwiki',.012],['plwiki',.01],['nlwiki',.008],['arwiki',.008],['cawiki',.006],['ukwiki',.008],['fawiki',.006],['enwiktionary',.02],['viwiki',.006],['kowiki',.005],['svwiki',.005],['hewiki',.004],['trwiki',.004],['idwiki',.004],['euwiki',.002],['glwiki',.002]];
const BOTP={wikidatawiki:.72,commonswiki:.5,enwiktionary:.35};
function simula(seed,t0,t1,base){
  const r=rng(seed*7919+3), ev=[]; base=base||28;
  let t=t0, burst=null;
  const pick=()=>{ let x=r()*WIKIS.reduce((a,w)=>a+w[1],0); for(const w of WIKIS){ x-=w[1]; if(x<=0) return w[0]; } return 'enwiki'; };
  const logn=(mu,sg)=>Math.exp(mu+sg*Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(6.2832*r()));
  while(t<t1){
    // ritmo que respira (olas lentas + picos) — el mundo no escribe a tempo
    const rate=base*(1+.35*Math.sin(t*.11+seed)+.25*Math.sin(t*.037+seed*2)+(r()<.002?2.5:0));
    t+=-Math.log(r()+1e-9)/Math.max(4,rate);
    // ráfagas de bots: un mismo bot escribiendo a intervalos casi exactos
    if(!burst && r()<.0025) burst={w:r()<.6?'wikidatawiki':pick(), until:t+2+r()*5, dt:.0625*(1+Math.floor(r()*3)), next:t};
    if(burst){ while(burst.next<t && burst.next<burst.until){ ev.push({t:burst.next, wiki:burst.w, lang:langOf(burst.w), bot:true, delta:Math.round(40+r()*30), kind:'edit'}); burst.next+=burst.dt*(1+(r()-.5)*.03); } if(burst.next>=burst.until) burst=null; }
    const w=pick(), bot=r()<(BOTP[w]||.1), u=r();
    let kind='edit', delta;
    if(u<.035){ kind='new'; delta=Math.round(logn(7.2,1)); }
    else if(u<.11){ kind='log'; delta=0; }
    else if(!bot && u<.125 && (w==='enwiki'||w==='eswiki'||w==='dewiki'||w==='frwiki'||w==='ruwiki')){ kind='revert'; delta=-Math.round(logn(6,1.5)); }
    else { const mag=bot?Math.round(logn(4.6,.8)):Math.round(logn(4.2,1.7)); const pos=r()<(bot?.85:.66); delta=pos?mag:-mag; if(!pos) kind='del'; }
    ev.push({t, wiki:w, lang:langOf(w), bot, delta, kind});
  }
  ev.sort((a,b)=>a.t-b.t); return ev;
}

// ---------------------------------------------------------------- EN VIVO
class Flujo{
  constructor(reloj,seed){
    this.reloj=reloj; this.seed=seed||1; this.cola=[]; this.estado='MEMORIA'; this.recibidos=0; this.ultimo=0;
    this.memoria=[]; this.simT=0; this.ritmo=0; this._cuenta=[]; this.es=null;
  }
  conecta(){
    try{
      const es=new EventSource(STREAM_URL); this.es=es;
      es.onopen=()=>{ this.estado='EN VIVO'; };
      es.onmessage=(m)=>{ let d; try{ d=JSON.parse(m.data); }catch(e){ return; }
        const e=normaliza(d,this.reloj()); if(!e) return; this.empuja(e); this.ultimo=performance.now(); this.recibidos++;
        if(this.memoria.length<200000) this.memoria.push({...e, t:e.t}); else this.memoria.shift(); };
      es.onerror=()=>{ this.estado='MEMORIA'; /* EventSource reintenta solo */ };
    }catch(e){ this.estado='MEMORIA'; }
  }
  empuja(e){ this.cola.push(e); this._cuenta.push(e.t); }
  // si no llega nada en 4 s, MEMORIA rellena con la misma estadística
  tick(){
    const now=this.reloj();
    if(this.estado!=='EN VIVO' || performance.now()-this.ultimo>4000){
      if(this.estado==='EN VIVO') this.estado='MEMORIA';
      if(this.simT<now-1) this.simT=now-1;
      const ev=simula(this.seed+Math.floor(this.simT), this.simT, now+.5); this.simT=now+.5;
      for(const e of ev) this.empuja(e);
    }
    while(this._cuenta.length && this._cuenta[0]<now-10) this._cuenta.shift();
    this.ritmo=this._cuenta.length/10;
  }
  // saca los eventos que ya han llegado (el motor los coloca en la rejilla con latencia)
  saca(){ const c=this.cola; this.cola=[]; return c; }
}
if(typeof window!=='undefined'){ window.Flujo=Flujo; window.simula=simula; window.hashStr=hashStr; window.rng=rng; }
