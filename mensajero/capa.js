// ======================================================================
// VØID_LOOM · MENSAJERO — capa.js · LA RED (la capa de datos, en directo)
// Lo que llega de la NASA Deep Space Network, sin adornos: blanco sobre negro, preciso.
//   · arriba: reloj UTC al milisegundo, antigüedad de la última lectura y una frase de la máquina (MATRIZ)
//   · centro: el EJE DE DISTANCIAS, de la Tierra a la nave más lejana (escala logarítmica). Cada nave
//     escuchada es una marca; entre ella y la Tierra, las señales que están EN VUELO AHORA MISMO, emitidas
//     cada cierto tiempo y avanzando a la velocidad de la luz (las de New Horizons tardan horas; las de
//     una nave cercana, menos de un segundo)
//   · abajo: las tres estaciones (Goldstone, Madrid, Canberra) y sus antenas: altura = elevación real,
//     línea hasta su nave en el eje; y una banda de bits que corre al ritmo de la velocidad de datos
// ======================================================================
(function(){
const C=299792.458;                       // km/s
const BL='233,238,247';
const ESTS=[['gdscc','GOLDSTONE'],['mdscc','MADRID'],['cdscc','CANBERRA']];
const REF=[[384400,'LUNA'],[1.496e8,'SOL'],[2.25e8,'MARTE'],[7.78e8,'JÚPITER'],[5.9e9,'PLUTÓN']];
const LOG0=4.5, LOG1=10.6;                // de ~30.000 km a ~40.000 millones de km
const miles=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
function dist(km){ if(km<1e6) return miles(km)+' km'; if(km<1e9) return miles(km/1e6)+' M km'; return (km/1e9).toFixed(2).replace('.',',')+' mil M km'; }
function luz(s){ if(s<1) return s.toFixed(3).replace('.',',')+' s'; if(s<60) return s.toFixed(2).replace('.',',')+' s'; if(s<3600) return Math.floor(s/60)+' min '+String(Math.floor(s%60)).padStart(2,'0')+' s'; return Math.floor(s/3600)+' h '+String(Math.floor(s%3600/60)).padStart(2,'0')+' min'; }
function bps(b){ if(b>=1e6) return (b/1e6).toFixed(2).replace('.',',')+' Mb/s'; if(b>=1e3) return (b/1e3).toFixed(1).replace('.',',')+' kb/s'; return b.toFixed(1).replace('.',',')+' b/s'; }
function utc(ms){ const d=new Date(ms); const p=(n,l=2)=>String(n).padStart(l,'0'); return d.getUTCFullYear()+'-'+p(d.getUTCMonth()+1)+'-'+p(d.getUTCDate())+'  '+p(d.getUTCHours())+':'+p(d.getUTCMinutes())+':'+p(d.getUTCSeconds())+'.'+p(d.getUTCMilliseconds(),3)+' UTC'; }
function h32(s){ let h=2166136261; for(const c of s){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; }

// texto MATRIZ grande (la voz de la máquina), escrito celda a celda
function matriz(x,str,x0,y0,cell,k,alpha){
  const t=str.toUpperCase(); const adv=cell*6.2; let n=0; const total=t.length;
  for(let i=0;i<t.length;i++){ const g=(typeof glifoM!=='undefined')?glifoM(t[i]):0; if(!g) continue;
    for(let r=0;r<7;r++) for(let c=0;c<5;c++){ if(!(Math.floor(g/2**(34-(r*5+c)))%2)) continue;
      const hh=((i*131+r*17+c*7)%97)/97, ord=(i+hh*.8)/total, vis=Math.max(0,Math.min(1,(k*1.15-ord)*14)); if(vis<=0) continue;
      x.fillStyle='rgba('+BL+','+(alpha*vis)+')'; const s=cell*.8; x.fillRect(x0+i*adv+c*cell+(cell-s)/2,y0+r*cell+(cell-s)/2,s,s); }
    // tilde: dos celdas en diagonal sobre la letra (la MATRIZ 5×7 no tiene sitio para ella)
    if('ÁÉÍÓÚ'.includes(t[i])){ const hh=((i*131)%97)/97, vis=Math.max(0,Math.min(1,(k*1.15-(i+hh*.8)/total)*14)); if(vis>0){ x.fillStyle='rgba('+BL+','+(alpha*vis)+')'; const s=cell*.8;
      x.fillRect(x0+i*adv+3*cell+(cell-s)/2,y0-2.6*cell,s,s); x.fillRect(x0+i*adv+2*cell+(cell-s)/2,y0-1.6*cell,s,s); } } }
  return t.length*adv; }

// la capa. red: lista de antenas; o: {modo:'red'|'marco'|'reloj', ahora(ms), lectura(ms), foco(dish), frase:{lineas,k,a}, vivo}
//   red   = LA RED entera (sobre la escena casi apagada)
//   marco = cabecera + frase + la señal de la nave escuchada en vuelo, abajo (sobre la escena)
//   reloj = solo la cabecera (en el negro, el reloj sigue corriendo)
function dibujaCapa(x,W,H,red,o){
  const s=H/1080, F=(px,w)=>(w||300)+' '+Math.round(px*s)+"px 'JetBrains Mono', ui-monospace, monospace";
  const a=o.alpha??1; const ahora=o.ahora; const modo=o.modo||'red';
  x.save(); x.globalAlpha=a; x.textBaseline='alphabetic';
  const m=70*s, xL=m, xR=W-m;
  // ---- cabecera
  x.font=F(15); x.fillStyle='rgba('+BL+',.55)'; x.textAlign='left';
  x.fillText('NASA DEEP SPACE NETWORK'+(o.vivo?'  ·  EN DIRECTO':'  ·  MEMORIA (SIN CONEXIÓN)'),xL,m);
  x.textAlign='right'; x.font=F(26); x.fillStyle='rgba('+BL+',.92)'; x.fillText(utc(ahora),xR,m+4*s);
  const edad=(ahora-o.lectura)/1000; x.font=F(14); x.fillStyle='rgba('+BL+',.45)';
  x.fillText('ÚLTIMA LECTURA HACE '+edad.toFixed(1).replace('.',',')+' S  ·  SE LEE CADA 5 S',xR,m+30*s);
  // pulso de lectura nueva: una línea fina barre la capa de arriba abajo (nunca un destello de pantalla completa)
  if(edad<.9){ const yb=m+40*s+(H-2*m)*edad/.9; x.fillStyle='rgba('+BL+','+(.35*(1-edad/.9))+')'; x.fillRect(0,yb,W,1.2*s); }
  if(modo==='reloj'){ x.restore(); return; }
  // ---- la frase de la máquina
  if(o.frase){ let y=170*s; for(const L of o.frase.lineas){ const cel=Math.min(5.2*s,(xR-xL)/(L.length*6.2)); matriz(x,L,xL,y,cel,o.frase.k,(L===o.frase.lineas[0]?.95:.6)*o.frase.a); y+=56*s; } }
  if(modo==='marco'){ marco(x,W,H,o,s,F,xL,xR); x.restore(); return; }
  // ---- EJE DE DISTANCIAS
  const yA=H*.56, X=km=>xL+(xR-xL)*Math.max(0,Math.min(1,(Math.log10(Math.max(km,1))-LOG0)/(LOG1-LOG0)));
  x.fillStyle='rgba('+BL+',.55)'; x.fillRect(xL,yA,xR-xL,1*s);
  x.font=F(10); x.textAlign='center';
  for(let e=5;e<=10;e++){ const xx=X(10**e); x.fillStyle='rgba('+BL+',.4)'; x.fillRect(xx,yA-4*s,1*s,8*s); x.fillText(e<6?'100.000 km':e<9?miles(10**e/1e6)+' M km':miles(10**e/1e9)+'.000 M km',xx,yA+22*s); }
  for(const [km,n] of REF){ const xx=X(km); x.fillStyle='rgba('+BL+',.22)'; for(let yy=yA-60*s;yy<yA;yy+=6*s) x.fillRect(xx,yy,1*s,2*s); x.fillText(n,xx,yA-66*s); }
  x.textAlign='left'; x.fillStyle='rgba('+BL+',.85)'; x.font=F(12,400); x.fillText('TIERRA',xL,yA-12*s);
  // naves escuchadas y SUS SEÑALES EN VUELO (posición real: d = c·(tiempo que les falta))
  const activas=red.filter(d=>d.activo&&d.rango>0);
  const porNave={}; for(const d of activas){ (porNave[d.nave]=porNave[d.nave]||[]).push(d); }
  let fila=0;
  for(const nave in porNave){ const d=porNave[nave][0]; const xx=X(d.rango); const foco=o.foco&&o.foco.nave===nave;
    const T=d.rango/C;                                   // segundos que tarda su luz en llegar
    // señales emitidas a intervalos regulares (más frecuentes cuantos más datos); cada una avanza a c
    const iv=Math.max(T/40,.04); const fase=(ahora/1000)%iv;
    for(let k=0;k*iv<T;k++){ const falta=T-(k*iv+fase); if(falta<0) continue; const km=falta*C; const px=X(km);
      x.fillStyle='rgba('+BL+','+(foco?.9:.45)+')'; const r=(foco?2.2:1.5)*s; x.fillRect(px-r,yA-r,r*2,r*2); }
    const hy=yA-(110+fila*26)*s; fila=(fila+1)%5;
    x.fillStyle='rgba('+BL+','+(foco?.95:.5)+')'; x.fillRect(xx,hy,1*s,yA-hy);
    x.font=F(foco?14:11,foco?600:400); x.textAlign=xx>W*.75?'right':'left'; const tx=xx+(xx>W*.75?-8:8)*s;
    x.fillText(d.nombre.toUpperCase(),tx,hy+10*s);
    x.font=F(10); x.fillStyle='rgba('+BL+','+(foco?.75:.4)+')';
    x.fillText(dist(d.rango)+'  ·  LUZ '+luz(T),tx,hy+24*s);
  }
  // ---- LAS ESTACIONES Y SUS ANTENAS
  const yB=H-150*s, colW=(xR-xL)/3;
  ESTS.forEach(([id,nom],i)=>{ const x0=xL+i*colW;
    x.textAlign='left'; x.font=F(11,400); x.fillStyle='rgba('+BL+',.7)'; x.fillText(nom,x0,yB+28*s);
    const ds=red.filter(d=>d.estacion===id);
    ds.forEach((d,j)=>{ const xx=x0+20*s+j*(colW-40*s)/Math.max(1,ds.length);
      const h=(d.el>0?d.el:0)/90*90*s; const foco=o.foco&&o.foco.dish===d.dish;
      x.fillStyle='rgba('+BL+','+(d.activo?(foco?1:.7):.18)+')'; x.fillRect(xx,yB-h,(foco?3:1.5)*s,h);
      // azimut: un trazo corto inclinado en lo alto
      const az=(d.az||0)*Math.PI/180; x.fillRect(xx+Math.sin(az)*8*s,yB-h-Math.cos(az)*8*s,2*s,2*s);
      x.font=F(9); x.fillStyle='rgba('+BL+','+(d.activo?.6:.25)+')'; x.fillText(d.dish,xx-4*s,yB+12*s);
      if(d.activo){ x.fillText((d.nave||'').toUpperCase(),xx-4*s,yB-h-14*s); x.fillText(bps(d.dataRate),xx-4*s,yB+44*s);
        // hilo hasta su nave en el eje
        const tx2=X(d.rango); if(!foco) return; x.strokeStyle='rgba('+BL+',.35)'; x.lineWidth=1*s; x.setLineDash([2*s,5*s]); x.beginPath(); x.moveTo(xx,yB-h-20*s); x.lineTo(tx2,yA+30*s); x.stroke(); x.setLineDash([]); }
    }); });
  // ---- banda de bits: corre al ritmo real de cada señal (más datos, más densa)
  const yC=H-52*s; let xx=xL; const tt=ahora/1000;
  for(const d of activas){ const ancho=(xR-xL)/Math.max(1,activas.length); const dens=Math.min(1,Math.log10(d.dataRate+10)/7); const hh=h32(d.nave);
    for(let i=0;i<ancho/(3*s);i++){ const b=((hh>>>((i+Math.floor(tt*Math.log10(d.dataRate+10)*6))%31))&1); if(b && ((i*7919+hh)%100)/100<dens){ x.fillStyle='rgba('+BL+','+(o.foco&&o.foco.nave===d.nave?.7:.3)+')'; x.fillRect(xx+i*3*s,yC,1.5*s,14*s); } }
    xx+=ancho; }
  x.restore();
}
// MARCO: abajo, el eje de distancias solo con la nave escuchada y sus señales en vuelo, y su ficha
function marco(x,W,H,o,s,F,xL,xR){
  const d=o.foco; if(!d||!d.rango) return;
  const yA=H-118*s, X=km=>xL+(xR-xL)*Math.max(0,Math.min(1,(Math.log10(Math.max(km,1))-LOG0)/(LOG1-LOG0)));
  const g=x.createLinearGradient(0,yA-150*s,0,H); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(.5,'rgba(0,0,0,.55)'); g.addColorStop(1,'rgba(0,0,0,.8)');
  x.fillStyle=g; x.fillRect(0,yA-150*s,W,H-yA+150*s);
  x.fillStyle='rgba('+BL+',.4)'; x.fillRect(xL,yA,xR-xL,1*s);
  x.font=F(10); x.textAlign='center';
  x.font=F(12); for(const [km,n] of REF){ const xx=X(km); x.fillStyle='rgba('+BL+',.3)'; x.fillRect(xx,yA-5*s,1*s,10*s); x.fillText(n,xx,yA+22*s); }
  x.textAlign='left'; x.fillStyle='rgba('+BL+',.75)'; x.font=F(13); x.fillText('TIERRA',xL,yA-12*s);
  const T=d.rango/C, xx=X(d.rango); const iv=Math.max(T/40,.04), fase=(o.ahora/1000)%iv;
  for(let k=0;k*iv<T;k++){ const falta=T-(k*iv+fase); if(falta<0) continue; const px=X(falta*C); x.fillStyle='rgba('+BL+',.9)'; const r=2*s; x.fillRect(px-r,yA-r,r*2,r*2); }
  x.fillStyle='rgba('+BL+',.95)'; x.fillRect(xx,yA-46*s,1*s,46*s);
  const der=xx>W*.7; x.textAlign=der?'right':'left'; const tx=xx+(der?-10:10)*s;
  x.font=F(19,600); x.fillText(d.nombre.toUpperCase(),tx,yA-36*s);
  x.font=F(14); x.fillStyle='rgba('+BL+',.75)'; x.fillText(dist(d.rango)+'  ·  SU LUZ TARDA '+luz(T),tx,yA-16*s);
  x.textAlign='left'; x.font=F(13); x.fillStyle='rgba('+BL+',.6)';
  const lugar={mdscc:'MADRID',gdscc:'GOLDSTONE',cdscc:'CANBERRA'}[d.estacion]||'';
  x.fillText(d.dish+'  ·  '+lugar+'  ·  AZ '+(+d.az).toFixed(1).replace('.',',')+'°  ·  EL '+(+d.el).toFixed(1).replace('.',',')+'°  ·  '+bps(d.dataRate)+(d.potencia?'  ·  '+d.potencia+' dBm':''),xL,H-48*s);
}
window.MensajeroCapa={dibujaCapa,dist,luz,bps,utc};
})();
