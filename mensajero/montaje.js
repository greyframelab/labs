// ======================================================================
// VØID_LOOM · MENSAJERO — montaje.js
// Una vuelta de 34 s, la misma partitura para imagen y sonido:
//   SEÑAL (0–6)      silueta de la antena; la máquina escribe a quién escucha
//   TENSIÓN (6–20,6) llegan los paquetes reales: bajo, cuenco y LA RED (todas las antenas del mundo, en directo)
//   negro y silencio total (20,6–22,3)
//   RUPTURA (22,3)   el nombre de la nave escrito en el cielo con sus fotones; cae al foco y revela la antena
//   ECO (28–34)      la máquina escribe cuándo salió esa señal
// Cada lectura nueva del feed (cada 5 s) llega como un golpe más: un paquete que revela la antena y suena.
// La capa de datos (capa.js) va siempre encima: reloj UTC, última lectura y la señal de la nave en vuelo.
// ======================================================================
(function(){
const VUELTA=34, T_RUPTURA=22.3;
// LOS PLANOS LOS DECIDE EL ENLACE (ya no hay lista fija):
//   cambio de escucha → la vuelta abre en GIRO (cámara fija en el mundo: se ve la antena girar hasta la posición real nueva)
//   velocidad de datos → cuántos cortes hay en la TENSIÓN (de 2 a 5)
//   distancia          → la óptica: nave lejana = teleobjetivo y planos lejanos; cercana = angular y pegado al cuenco
//   nave + vuelta      → la semilla del orden. Además, cada lectura real puede provocar un corte (main.js)
const PLANOS_FIJOS=[[20.6,'NEGRO',0],[22.3,'NOMBRE',1.25],[25.3,'HEROE',1.2],[28,'PERFIL',.85]];
function h32(s){ let h=2166136261; for(const ch of String(s)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; }
function rnd(s){ s=(s>>>0)||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
const LEJOS=['PERFIL','NOCHE','CIELO','CUENCO'], CERCA=['BAJO','CUENCO','HEROE','CIELO'];
function planos(d,o){ o=o||{}; const r=rnd(h32((d.dish||'')+(d.nave||'')+(o.vuelta||0)));
  const lgk=Math.log10(Math.max(1e4,d.rango||1e8)), lgb=Math.log10(Math.max(10,d.dataRate||1e4));
  const lejos=lgk>8.3, pool=lejos?LEJOS:CERCA;
  const L=[[0,o.cambio?'GIRO':(r()<.5?'PERFIL':'NOCHE'),.85]];
  const nc=Math.max(2,Math.min(5,Math.round(lgb*.7))); const t0=6, tRed=14.5+r()*2.5;    // LA RED, siempre, antes del negro
  let prev=L[0][1];
  for(let i=0;i<nc;i++){ const t=t0+(tRed-t0)*i/nc+(i?(r()-.5)*1.2:0); let pl; do{ pl=pool[Math.floor(r()*pool.length)]; }while(pl===prev); L.push([+t.toFixed(2),pl,.9]); prev=pl; }
  L.push([+tRed.toFixed(2),'RED',.9]);
  return {lista:[...L,...PLANOS_FIJOS],optica:Math.max(.62,Math.min(1.3,1.25-(lgk-5)*.12)),pool};
}
// un corte provocado por una lectura real (solo en la TENSIÓN, antes de LA RED)
function corte(plan,tv){ const L=plan.planos.lista; const i=L.findIndex(p=>p[1]==='RED'); if(tv<6.5||tv>L[i][0]-2) return false;
  const cur=L.filter(p=>p[0]<=tv).pop(); if(tv-cur[0]<2.2) return false;
  const pool=plan.planos.pool.filter(p=>p!==cur[1]); const pl=pool[Math.floor(((tv*1000)|0)%pool.length)];
  L.push([+tv.toFixed(2),pl,.9]); L.sort((a,b)=>a[0]-b[0]); return true; }
// LA CAPA DE DATOS: qué se ve encima de la escena en cada momento, y la frase de la máquina (MATRIZ)
const LUGAR={mdscc:'MADRID',gdscc:'GOLDSTONE',cdscc:'CANBERRA'};
function capa(t,d,vivo,plan){
  const D=window.MensajeroDatos;
  const ventana=(a,b)=>{ const u=(t-a)/(b-a); return u>=0&&u<=1?{k:Math.min(1,u/.3),a:u<.85?1:Math.max(0,1-(u-.85)/.15)}:null; };
  const modo=t>=16&&t<20.6?'red':(t>=20.6&&t<25.3)?'reloj':'marco';
  let frase=null, w=ventana(1,6);
  if(w) frase={...w,lineas:vivo?['AHORA MISMO · UNA ANTENA EN '+(LUGAR[d.estacion]||d.lugar.toUpperCase())+' ESCUCHA A '+d.nombre.toUpperCase(),D.distancia(d.rango)+' · '+D.velocidad(d.dataRate)]
                                 :['SIN CONEXIÓN · LA ÚLTIMA SEÑAL FUE DE '+d.nombre.toUpperCase(),D.distancia(d.rango)]};
  if(w&&plan&&plan.cambio) frase={...w,lineas:['CAMBIO DE ESCUCHA → '+d.dish+' · '+(LUGAR[d.estacion]||''),'AHORA ESCUCHA A '+d.nombre.toUpperCase()+(vivo?'':' (MEMORIA)'),D.distancia(d.rango)+' · '+D.velocidad(d.dataRate)]};
  // la leyenda: qué dato está tocando qué, mientras suena (7–13 s)
  const lw=ventana(7,13.5); const so=plan&&plan.sonido;
  const leyenda=lw&&so?{...lw,txt:['TONO ← DISTANCIA '+D.distancia(d.rango),'PULSO ← '+D.velocidad(d.dataRate)+' = '+so.bpm+' BPM','BRILLO ← '+(d.potencia||'—')+' DBM','TIMBRE ← '+(LUGAR[d.estacion]||'')+'  ·  VOZ ← '+d.nombre.toUpperCase()]}:null;
  w=ventana(28.4,33.6);
  if(w) frase={...w,lineas:['ESTA SEÑAL SALIÓ HACE '+D.hace(d.rtlt/2),'Y HA VIAJADO '+D.distancia(d.rango)+' HASTA AQUÍ']};
  return {modo,frase,leyenda};
}
// estado de la escena en el instante t (segundos dentro de la vuelta)
function estado(t,plan,opts){
  opts=opts||{}; const d=plan.datos;
  const PL=(plan.planos&&plan.planos.lista)||planos(d).lista; const cur=PL.filter(p=>p[0]<=t).pop(); let expo=1;
  if(t<1.5) expo=t/1.5; if(cur[1]==='NEGRO') expo=0; if(t>32) expo=Math.max(0,(VUELTA-t)/2);
  // la potencia real de la señal (dBm) sube o baja el brillo de la revelación
  const pw=Math.max(.6,Math.min(1.3,1+((d.potencia||-120)+120)/60));
  // LA RED: la escena se queda casi a oscuras detrás de la red entera
  let plano=cur[1]==='NEGRO'?'NOCHE':cur[1]; if(plano==='RED'){ plano='CIELO'; expo*=.22; }
  const vivo=opts.vivo??d.vivo;
  // GIRO: la antena va a la posición real nueva rápido (para que se vea en la sala), no a la velocidad de la real
  const giro=!!plan.cambio&&t<8;
  return {t,tl:t-cur[0],plano,az:d.az,el:d.el,giroRapido:giro,optica:(plan.planos&&plan.planos.optica)||1,sen:cur[2]*pw,expo,
    golpes:plan.golpes.filter(x=>x>t-4.2&&x<t+2.7).slice(0,8),nombre:d.nombre,tNombre:T_RUPTURA,
    capa:capa(t,d,vivo,plan),vivo};
}
window.MensajeroMontaje={VUELTA,T_RUPTURA,estado,planos,corte};
})();
