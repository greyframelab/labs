// ======================================================================
// VØID_LOOM · CÓRTEX — partitura.js
// Utilidades, la noche de EEG y los "sueños": cada sesión tiene su escala, su kit y su referencia.
// ======================================================================
const P=Object.fromEntries(new URLSearchParams(location.search.slice(1)+'&'+location.hash.slice(1)));
const OFF=P.render==='1';
const NEON=(P.neon||'0,0.9,1').split(',').map(Number);
let seed=7*9301+49297;
const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const rn=()=>{let u=0,v=0;while(!u)u=rnd();v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);};
function norm(v){const l=Math.hypot(...v)||1;return v.map(a=>a/l);}
const H1=(n)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function sub(a,b){return a.map((x,i)=>x-b[i]);} function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];} function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function hz(m){return 440*Math.pow(2,(m-69)/12);}

// ---------------- la noche ----------------
let NOCHE=null, NB=null;
async function cargarNoche(){
  NOCHE=await (await fetch('noche.json')).json();
  NB=new Uint8Array(await (await fetch('noche.bin')).arrayBuffer());
}
const BANDA={delta:0,theta:1,alpha:2,sigma:3,beta:4,gamma:5}, NCH=5;
function eeg(name,ch,pos){
  const i=Math.floor(pos), f=pos-i, n=NOCHE.n, bi=BANDA[name];
  const g=(j)=>NB[((clamp(j,0,n-1))*6+bi)*NCH+ch]/255*1.5;
  return g(i)*(1-f)+g(i+1)*f;
}
const eegM=(name,pos)=>{let s=0;for(let c=0;c<NCH;c++)s+=eeg(name,c,pos);return s/NCH;};

// ---------------- regiones: cada una es una voz del instrumento ----------------
// 0 frontal · 1 central · 2 parietal · 3 occipital · 4 temporal · 5 cerebelo
const REG=[[.24,.28,.72],[.3,.5,.25],[.3,.48,-.28],[.22,.22,-.74],[.47,-.22,.18],[.18,-.4,-.62]];
const REG_NOMBRE=['FRONTAL','CENTRAL','PARIETAL','OCCIPITAL','TEMPORAL','CEREBELO'];

// ---------------- SUEÑOS: cada sesión suena distinta ----------------
// Escalas oscuras en Re (semitonos sobre la raíz), kits y referencia de la skill VØID_LOOM.
const ESCALAS=[
  {n:'FRIGIO',   s:[0,1,3,5,7,8,10]},
  {n:'LOCRIO',   s:[0,1,3,5,6,8,10]},
  {n:'EOLIO',    s:[0,2,3,5,7,8,10]},
  {n:'PENTA OSC',s:[0,1,5,7,8]},
  {n:'HIRAJOSHI',s:[0,2,3,7,8]},
];
const REFERENCIAS=['AUTECHRE','LANARK ARTEFAX','AMON TOBIN','ORPHX','PHOENICIA','SQUAREPUSHER'];
function sueno(k){
  const r=(i)=>H1(k*13.37+i*7.1+.31);
  const esc=ESCALAS[Math.floor(r(1)*ESCALAS.length)];
  const ref=REFERENCIAS[Math.floor(r(2)*REFERENCIAS.length)];
  return {
    k, esc, ref,
    root:[36,38,38,41,33][Math.floor(r(3)*5)],                  // Do, Re, Re, Fa, La graves
    fmRatio:[1.41,2.76,3.53,1.73,2.02][Math.floor(r(4)*5)],      // metales inarmónicos distintos
    decay:.35+.6*r(5),                                           // golpes secos o largos
    bright:.3+.6*r(6),
    sala:ref==='AUTECHRE'?.05:ref==='AMON TOBIN'?.32:ref==='LANARK ARTEFAX'?.22:.12,   // reverb por referencia
    dron:['fm','coro','anillo','aditivo'][Math.floor(r(7)*4)],
    vocal:['a','o','u','e'][Math.floor(r(8)*4)],
    swing:ref==='PHOENICIA'?.14:ref==='SQUAREPUSHER'?.02:.06,
    bpmBase:[112,120,128,96,140][Math.floor(r(9)*5)],
  };
}
// nota de la escala del sueño: grado (puede ser negativo) → MIDI
function grado(S,g,oct=0){ const n=S.esc.s.length; const o=Math.floor(g/n), i=((g%n)+n)%n; return S.root+12*(o+oct)+S.esc.s[i]; }
// cuantiza una frecuencia a la escala del sueño
function cuantiza(S,f){ const m=69+12*Math.log2(f/440); let best=null,bd=1e9;
  for(let o=-2;o<6;o++) for(const s of S.esc.s){ const c=S.root+12*o+s, d=Math.abs(c-m); if(d<bd){bd=d;best=c;} } return best; }
