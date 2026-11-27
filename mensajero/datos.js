// ======================================================================
// VØID_LOOM · MENSAJERO — datos.js
// El dato real: NASA Deep Space Network Now (eyes.nasa.gov/dsn), actualizado cada pocos segundos.
// Elige a quién escucha la pieza: la antena de 70 m de Madrid (DSS63, Robledo de Chavela) si está
// recibiendo; si no, otra de Madrid; si no, las de 70 m de Goldstone (DSS14) y Canberra (DSS43); si no, cualquiera.
// MEMORIA: si el feed no responde, la pieza sigue con la última lectura y el TESTIGO no se escribe.
// ======================================================================
(function(){
// nombres de las naves (respaldo de eyes.nasa.gov/dsn/config.xml, que se lee en directo al arrancar)
const NOMBRES={ace:'ACE',bepi:'BepiColombo',caps:'CAPSTONE',chdr:'Chandra',dsco:'DSCOVR',emm:'Hope',escb:'ESCAPADE Blue',escg:'ESCAPADE Gold',eurc:'Europa Clipper',gaia:'Gaia',hyb2:'Hayabusa2',imap:'IMAP',jno:'Juno',jwst:'James Webb',kplo:'Danuri',lro:'LRO',lucy:'Lucy',m01o:'Mars Odyssey',m20:'Perseverance',mex:'Mars Express',mms1:'MMS 1',mro:'MRO',msl:'Curiosity',mvn:'MAVEN',nhpc:'New Horizons',orx:'OSIRIS-APEX',psyc:'Psyche',rst:'Roman',soho:'SOHO',spp:'Parker Solar Probe',sta:'STEREO A',tess:'TESS',tgo:'Trace Gas Orbiter',thb:'THEMIS B',thc:'THEMIS C',vgr1:'Voyager 1',vgr2:'Voyager 2',wind:'WIND',xmm:'XMM-Newton',em2:'Artemis II'};
const ESTACION={mdscc:'Robledo de Chavela',gdscc:'Goldstone',cdscc:'Canberra'};
// lectura real completa del 27 nov 2026 (DSS63 recibiendo a New Horizons): solo para MEMORIA y para el render de validación
const MEMORIA_RED=[
 {estacion:'gdscc',dish:'DSS14',az:0,el:90,activo:false},{estacion:'gdscc',dish:'DSS26',az:258,el:38,activo:false},{estacion:'gdscc',dish:'DSS25',az:180,el:90,activo:false},
 {estacion:'gdscc',dish:'DSS23',az:158,el:32,activo:true,nave:'LUCY',nombre:'Lucy',rango:925000000,rtlt:6170,dataRate:20000,potencia:-140},
 {estacion:'gdscc',dish:'DSS24',az:132,el:18,activo:true,nave:'WIND',nombre:'WIND',rango:1640000,rtlt:10.9,dataRate:73510,potencia:-130},
 {estacion:'mdscc',dish:'DSS55',az:0,el:90,activo:false},
 {estacion:'mdscc',dish:'DSS63',az:210,el:24,activo:true,nave:'NHPC',nombre:'New Horizons',rango:1e10,rtlt:66700,dataRate:501.4,potencia:-150},
 {estacion:'mdscc',dish:'DSS54',az:72,el:17,activo:true,nave:'RST',nombre:'Roman',rango:1220000,rtlt:8.11,dataRate:780000,potencia:-98},
 {estacion:'mdscc',dish:'DSS65',az:162,el:18,activo:true,nave:'MMS4',nombre:'MMS 4',rango:140000,rtlt:.93,dataRate:2500000,potencia:-110},
 {estacion:'cdscc',dish:'DSS34',az:47,el:27,activo:true,nave:'M01O',nombre:'Mars Odyssey',rango:180000000,rtlt:1200,dataRate:14220,potencia:-130},
 {estacion:'cdscc',dish:'DSS36',az:47,el:32,activo:true,nave:'PSYC',nombre:'Psyche',rango:230000000,rtlt:1530,dataRate:1,potencia:-150},
 {estacion:'cdscc',dish:'DSS43',az:200,el:56,activo:false}];
const MEMORIA={estacion:'mdscc',lugar:'Robledo de Chavela',dish:'DSS63',az:210,el:24,nave:'NHPC',nombre:'New Horizons',rango:1e10,rtlt:66700,dataRate:501.4,banda:'X',potencia:-150,ts:1795799087000,vivo:false};
const base=()=>location.protocol==='mensajero:'?'mensajero://dsn/':'https://eyes.nasa.gov/dsn/';
async function nombres(){ try{ const x=new DOMParser().parseFromString(await (await fetch(base()+'config.xml',{cache:'no-store'})).text(),'text/xml');
  for(const s of x.querySelectorAll('spacecraft')){ const n=s.getAttribute('name'), f=s.getAttribute('friendlyName'); if(n&&f&&!NOMBRES[n.toLowerCase()]) NOMBRES[n.toLowerCase()]=f; } }catch(e){} }
function elige(xml){
  const x=new DOMParser().parseFromString(xml,'text/xml'); const cands=[], red=[]; let est='';
  for(const n of x.documentElement.children){
    if(n.tagName==='station'){ est=n.getAttribute('name'); continue; }
    if(n.tagName!=='dish') continue;
    const down=[...n.querySelectorAll('downSignal')].find(d=>d.getAttribute('active')==='true'&&d.getAttribute('spacecraft'));
    const tg=n.querySelector('target'); const dish=n.getAttribute('name');
    const it={estacion:est,dish,az:+n.getAttribute('azimuthAngle')||0,el:+n.getAttribute('elevationAngle')||0,activo:false};
    if(down&&tg&&+tg.getAttribute('downlegRange')>0){ const nv=down.getAttribute('spacecraft'); Object.assign(it,{activo:true,nave:nv,nombre:NOMBRES[nv.toLowerCase()]||nv,rango:+tg.getAttribute('downlegRange'),rtlt:+tg.getAttribute('rtlt'),dataRate:+down.getAttribute('dataRate'),potencia:+down.getAttribute('power')}); }
    red.push(it);
    if(!down||!tg||+tg.getAttribute('downlegRange')<=0) continue;
    const prio=dish==='DSS63'?0:est==='mdscc'?1:(dish==='DSS14'||dish==='DSS43')?2:3;
    const nave=down.getAttribute('spacecraft');
    cands.push({prio,estacion:est,lugar:ESTACION[est]||est,dish,az:+n.getAttribute('azimuthAngle'),el:+n.getAttribute('elevationAngle'),nave,nombre:NOMBRES[nave.toLowerCase()]||nave,
      rango:+tg.getAttribute('downlegRange'),rtlt:+tg.getAttribute('rtlt'),dataRate:+down.getAttribute('dataRate'),banda:down.getAttribute('band'),potencia:+down.getAttribute('power'),vivo:true});
  }
  const ts=+(x.querySelector('timestamp')||{}).textContent||Date.now();
  cands.sort((a,b)=>a.prio-b.prio||b.dataRate-a.dataRate); return cands[0]?{foco:{...cands[0],ts},red}:null;
}
// formato para el TESTIGO
const miles=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
function distancia(km){ if(km<1e6) return miles(km)+' KM'; if(km<1e9) return (km/1e6).toFixed(1).replace('.',',')+' MILLONES DE KM'; return miles(km/1e6)+' MILLONES DE KM'; }
function hace(s){ if(s<60) return s.toFixed(1).replace('.',',').replace(',0','')+' SEGUNDOS'; if(s<3600) return Math.floor(s/60)+' MIN '+Math.round(s%60)+' S'; return Math.floor(s/3600)+' H '+Math.round((s%3600)/60)+' MIN'; }
function velocidad(b){ if(b>=1e6) return (b/1e6).toFixed(1).replace('.',',')+' MBIT/S'; if(b>=1e3) return Math.round(b/1e3)+' KBIT/S'; return Math.round(b)+' BIT/S'; }
class Datos{
  constructor(){ this.d=null; this.r=null; this.estado='MEMORIA'; this.ultimo=0; this.errores=0; this.lecturas=0; this.onLectura=null; }
  async arranca(){ await nombres(); await this.lee(); setInterval(()=>this.lee(),5000); }
  async lee(){ try{ const r=await fetch(base()+'data/dsn.xml?r='+Date.now(),{cache:'no-store'}); if(!r.ok) throw 0; const e=elige(await r.text()); if(e){ this.d=e.foco; this.r=e.red; this.estado='EN VIVO'; this.ultimo=Date.now(); this.errores=0; this.lecturas++; this.onLectura&&this.onLectura(this.d,this.r); } }
    catch(e){ this.errores++; if(Date.now()-this.ultimo>30000) this.estado='MEMORIA'; } }
  red(){ return this.estado==='EN VIVO'&&this.r?this.r:MEMORIA_RED; }
  actual(){ return this.estado==='EN VIVO'&&this.d?this.d:{...(this.d||MEMORIA),vivo:false}; }
}
window.MensajeroDatos={Datos,MEMORIA,MEMORIA_RED,ESTACION,distancia,hace,velocidad,miles};
})();
