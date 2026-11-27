// ======================================================================
// VØID_LOOM · MURMULLO — testigo.js
// TESTIGO: la única concesión de texto en la proyección. En el ECO de cada vuelta, la máquina
// escribe (celda a celda, con la MATRIZ 5×7 de VØID_LOOM) cuánta gente acaba de escribir la losa.
// Solo aparece si el flujo es real (EN VIVO): en MEMORIA no se escribe nada. La obra no miente.
// ======================================================================
const MATRIZ={'A':0x3a31fc631,'B':0x7a31f463e,'C':0x3e108420f,'D':0x7a318c63e,'E':0x7e10f421f,'F':0x7e10f4210,'G':0x3e109c62f,'H':0x4631fc631,'I':0x7c842109f,'J':0x1c210862e,'K':0x4654c5251,'L':0x42108421f,'M':0x4775ac631,'N':0x47359c631,'Ñ':0x36d1cd671,'O':0x3a318c62e,'P':0x7a31f4210,'Q':0x3a318d64d,'R':0x7a31f5251,'S':0x3e107043e,'T':0x7c8421084,'U':0x46318c62e,'V':0x46318c544,'W':0x4631ad6aa,'X':0x462a22a31,'Y':0x462a21084,'Z':0x7c222221f,'0':0x3a75ae62e,'1':0x11842108e,'2':0x3a213221f,'3':0x78217043e,'4':0x4a52f8842,'5':0x7e1e0862e,'6':0x3a10f462e,'7':0x7c2222108,'8':0x3a317462e,'9':0x3a317842e,'·':0x20000,'/':0x44222110,'.':0x4,',':0x88,' ':0};   // la MATRIZ de SEMILLA + signos
const glifoM=(ch)=>MATRIZ[ch]??MATRIZ[String(ch).normalize('NFD').replace(/[̀-ͯ]/g,'')]??0;
const miles=(n)=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');

// líneas a partir de las estadísticas de la vuelta
function lineasTestigo(T){ return [
  {t:'WIKIPEDIA · EN DIRECTO', acc:false},
  {t:miles(T.n)+' EDICIONES EN '+T.idiomas+' IDIOMAS · ÚLTIMOS '+Math.round(T.seg)+' SEGUNDOS', acc:true},
]; }

// dibuja el testigo: k = progreso de escritura (0..1), a = opacidad. Abajo a la izquierda, discreto.
function dibujaTestigo(x,W,H,lineas,k,a,acento){
  if(a<=0.002) return;
  const cell=Math.max(1.5,H/300), adv=cell*7, lh=cell*11;
  const total=lineas.reduce((s,l)=>s+l.t.length,0); let idx=0;
  const x0=W*.045, y0=H*.9-(lineas.length-1)*lh;
  const ac='rgba('+acento.map(v=>Math.round(Math.min(1,v)*255)).join(',')+',';
  lineas.forEach((L,li)=>{
    const t=L.t.toUpperCase();
    for(let i=0;i<t.length;i++,idx++){
      const g=glifoM(t[i]); if(!g) continue;
      for(let r=0;r<7;r++) for(let c=0;c<5;c++){
        if(!(Math.floor(g/2**(34-(r*5+c)))%2)) continue;
        // cada celda aparece en su turno, con un poco de azar: la máquina escribe
        const h=((i*131+r*17+c*7+li*977)%97)/97, ord=(idx+h*.8)/total;
        const vis=Math.max(0,Math.min(1,(k*1.15-ord)*14)); if(vis<=0) continue;
        const num=L.acc && /[0-9.]/.test(t[i]) && i<t.indexOf(' EDICIONES');
        x.fillStyle=num?ac+(.9*a*vis)+')':'rgba(232,234,240,'+((L.acc?.62:.42)*a*vis)+')';
        const s=cell*.78; x.fillRect(x0+i*adv+c*cell+(cell-s)/2, y0+li*lh+r*cell+(cell-s)/2, s, s);
      }
    }
  });
}
if(typeof window!=='undefined'){ window.lineasTestigo=lineasTestigo; window.dibujaTestigo=dibujaTestigo; }
