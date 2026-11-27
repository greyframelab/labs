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
// lectura real del 27 nov 2026 (DSS63 recibiendo a THEMIS C): solo para MEMORIA y para el render de validación
const MEMORIA={estacion:'mdscc',lugar:'Robledo de Chavela',dish:'DSS63',az:105,el:51,nave:'THC',nombre:'THEMIS C',rango:361000,rtlt:2.41,dataRate:1049000,banda:'S',potencia:-110,ts:1795465745000,vivo:false};
const base=()=>location.protocol==='mensajero:'?'mensajero://dsn/':'https://eyes.nasa.gov/dsn/';
async function nombres(){ try{ const x=new DOMParser().parseFromString(await (await fetch(base()+'config.xml',{cache:'no-store'})).text(),'text/xml');
  for(const s of x.querySelectorAll('spacecraft')){ const n=s.getAttribute('name'), f=s.getAttribute('friendlyName'); if(n&&f&&!NOMBRES[n.toLowerCase()]) NOMBRES[n.toLowerCase()]=f; } }catch(e){} }
function elige(xml){
  const x=new DOMParser().parseFromString(xml,'text/xml'); const cands=[]; let est='';
  for(const n of x.documentElement.children){
    if(n.tagName==='station'){ est=n.getAttribute('name'); continue; }
    if(n.tagName!=='dish') continue;
    const down=[...n.querySelectorAll('downSignal')].find(d=>d.getAttribute('active')==='true'&&d.getAttribute('spacecraft'));
    const tg=n.querySelector('target'); if(!down||!tg||+tg.getAttribute('downlegRange')<=0) continue;
    const dish=n.getAttribute('name');
    const prio=dish==='DSS63'?0:est==='mdscc'?1:(dish==='DSS14'||dish==='DSS43')?2:3;
    const nave=down.getAttribute('spacecraft');
    cands.push({prio,estacion:est,lugar:ESTACION[est]||est,dish,az:+n.getAttribute('azimuthAngle'),el:+n.getAttribute('elevationAngle'),nave,nombre:NOMBRES[nave.toLowerCase()]||nave,
      rango:+tg.getAttribute('downlegRange'),rtlt:+tg.getAttribute('rtlt'),dataRate:+down.getAttribute('dataRate'),banda:down.getAttribute('band'),potencia:+down.getAttribute('power'),vivo:true});
  }
  const ts=+(x.querySelector('timestamp')||{}).textContent||Date.now();
  cands.sort((a,b)=>a.prio-b.prio||b.dataRate-a.dataRate); return cands[0]?{...cands[0],ts}:null;
}
// formato para el TESTIGO
const miles=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
function distancia(km){ if(km<1e6) return miles(km)+' KM'; if(km<1e9) return (km/1e6).toFixed(1).replace('.',',')+' MILLONES DE KM'; return miles(km/1e6)+' MILLONES DE KM'; }
function hace(s){ if(s<60) return s.toFixed(1).replace('.',',').replace(',0','')+' SEGUNDOS'; if(s<3600) return Math.floor(s/60)+' MIN '+Math.round(s%60)+' S'; return Math.floor(s/3600)+' H '+Math.round((s%3600)/60)+' MIN'; }
function velocidad(b){ if(b>=1e6) return (b/1e6).toFixed(1).replace('.',',')+' MBIT/S'; if(b>=1e3) return Math.round(b/1e3)+' KBIT/S'; return Math.round(b)+' BIT/S'; }
class Datos{
  constructor(){ this.d=null; this.estado='MEMORIA'; this.ultimo=0; this.errores=0; }
  async arranca(){ await nombres(); await this.lee(); setInterval(()=>this.lee(),5000); }
  async lee(){ try{ const r=await fetch(base()+'data/dsn.xml?r='+Date.now(),{cache:'no-store'}); if(!r.ok) throw 0; const d=elige(await r.text()); if(d){ this.d=d; this.estado='EN VIVO'; this.ultimo=Date.now(); this.errores=0; } }
    catch(e){ this.errores++; if(Date.now()-this.ultimo>30000) this.estado='MEMORIA'; } }
  actual(){ return this.estado==='EN VIVO'&&this.d?this.d:{...(this.d||MEMORIA),vivo:false}; }
}
window.MensajeroDatos={Datos,MEMORIA,distancia,hace,velocidad,miles};
})();
