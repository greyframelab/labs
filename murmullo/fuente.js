// ======================================================================
// VØID_LOOM · MURMULLO — fuente.js
// FUENTE: la vista de código. Antes de la piedra, el dato crudo: el flujo recentchange tal como
// llega, línea a línea, escrito con la misma MATRIZ 5×7 que luego se talla. Cada edición humana
// termina en lo que va a la piedra (→ JA+213): lo que se lee aquí es lo que se talla después.
// Solo EN VIVO (como el TESTIGO): en MEMORIA no se enseña código, porque no sería real.
// Nunca títulos ni usuarios: hora, wiki, tipo, bytes y si es bot.
// ======================================================================

// lo que se talla en la piedra por cada edición humana: idioma + signo + bytes (máx. 9 signos)
function textoTalla(e){
  if(!e || e.bot || e.kind==='log') return null;
  const L=String(e.lang||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)||'XX';
  const s=e.kind==='revert'?'×':e.kind==='del'||e.delta<0?'-':'+';
  const n=Math.abs(e.delta||0), num=n>=10000?Math.round(n/1000)+'K':String(n);
  return (L+s+num).slice(0,9);
}

const pad=(s,n)=>(s+' '.repeat(n)).slice(0,n);
const padI=(s,n)=>(' '.repeat(n)+s).slice(-n);
function lineaFuente(e){
  const d=new Date(e.hora||Date.now()), p2=n=>String(n).padStart(2,'0');
  const h=p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())+'.'+String(d.getMilliseconds()).padStart(3,'0');
  const tipo={edit:'EDIT',del:'EDIT',new:'NEW',revert:'REVERT',log:'LOG'}[e.kind]||'EDIT';
  const by=e.kind==='log'?'':(e.delta>0?'+':e.delta<0?'-':'')+miles(Math.abs(e.delta))+' B';
  const tk=textoTalla(e);
  return h+'  '+pad(String(e.wiki).toUpperCase(),15)+' '+pad(tipo,7)+padI(by,10)+'   '+(e.bot?'BOT':tk?'→ '+tk:'');
}

class Fuente{
  constructor(){ this.lineas=[]; this.n=0; this.S=0; }
  // cada paso aplicado: sus eventos entran como líneas (en su instante, a la vez que suenan)
  mete(evs,t,idioma){
    for(const e of evs){ this.n++;
      this.lineas.push({n:this.n,txt:lineaFuente(e),t0:t,bot:e.bot,acc:!e.bot&&e.kind!=='log'&&(e.lang+'wiki')===idioma,cv:null}); }
    if(this.lineas.length>90) this.lineas.splice(0,this.lineas.length-90);
  }
  // dibuja la fuente: a = opacidad (0..1). Celdas cuadradas, como el TESTIGO.
  dibuja(x,W,H,t,dt,a,acento){
    if(a<=.002 || !this.lineas.length) return;
    this.S+=(this.n-this.S)*(1-Math.exp(-dt/.07)); if(this.n-this.S>30) this.S=this.n-30;
    const cell=Math.max(1.4,H/250), adv=cell*6, lh=cell*10.5, x0=W*.07, yb=H*.84, ytop=H*.17;
    const ac='rgba('+acento.map(v=>Math.round(Math.min(1,v)*255)).join(',')+',';
    // cabecera: de dónde viene (honesto y seco)
    x.globalAlpha=a; celdas(x,'STREAM.WIKIMEDIA.ORG/V2/STREAM/RECENTCHANGE',x0,H*.09,cell,adv,'rgba(232,234,240,.32)',1);
    for(let i=this.lineas.length-1;i>=0;i--){ const L=this.lineas[i];
      const y=yb-(this.S-L.n)*lh; if(y<ytop-lh) break; if(y>yb+lh) continue;
      const fa=Math.min(1,Math.max(0,(y-ytop)/(lh*4)))*Math.min(1,Math.max(0,(yb+lh-y)/lh));
      const col=L.acc?ac+'.95)':L.bot?'rgba(232,234,240,.2)':'rgba(232,234,240,.55)';
      const k=Math.min(1,(t-L.t0)*3.2);       // la máquina escribe la línea (≈ 0,3 s)
      x.globalAlpha=a*fa;
      if(k>=1){ if(!L.cv) L.cv=cache(L.txt,cell,adv,col); x.drawImage(L.cv,x0,y); }
      else if(k>0) celdas(x,L.txt,x0,y,cell,adv,col,k);
      if(L.acc) celdas(x,'›',x0-adv*2,y,cell,adv,col,1);
    }
    x.globalAlpha=1;
  }
}
// una línea de texto en celdas de la MATRIZ; k = parte escrita (0..1)
function celdas(x,txt,x0,y0,cell,adv,col,k){
  const n=Math.ceil(txt.length*k), s=cell*.78, o=(cell-s)/2; x.fillStyle=col;
  for(let i=0;i<n;i++){ const g=glifoM(txt[i]); if(!g) continue;
    for(let r=0;r<7;r++) for(let c=0;c<5;c++) if(Math.floor(g/2**(34-(r*5+c)))%2) x.fillRect(x0+i*adv+c*cell+o,y0+r*cell+o,s,s); }
}
function cache(txt,cell,adv,col){ const cv=document.createElement('canvas'); cv.width=Math.ceil(txt.length*adv); cv.height=Math.ceil(cell*7);
  celdas(cv.getContext('2d'),txt,0,0,cell,adv,col,1); return cv; }
if(typeof window!=='undefined'){ window.Fuente=Fuente; window.textoTalla=textoTalla; }
