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
const PLANOS=[[0,'PERFIL',.85],[6,'BAJO',.9],[11,'CUENCO',.9],[16,'RED',.9],[20.6,'NEGRO',0],[22.3,'NOMBRE',1.25],[25.3,'HEROE',1.2],[28,'PERFIL',.85]];
// LA CAPA DE DATOS: qué se ve encima de la escena en cada momento, y la frase de la máquina (MATRIZ)
const LUGAR={mdscc:'MADRID',gdscc:'GOLDSTONE',cdscc:'CANBERRA'};
function capa(t,d,vivo){
  const D=window.MensajeroDatos;
  const ventana=(a,b)=>{ const u=(t-a)/(b-a); return u>=0&&u<=1?{k:Math.min(1,u/.3),a:u<.85?1:Math.max(0,1-(u-.85)/.15)}:null; };
  const modo=t>=16&&t<20.6?'red':(t>=20.6&&t<25.3)?'reloj':'marco';
  let frase=null, w=ventana(1,6);
  if(w) frase={...w,lineas:vivo?['AHORA MISMO · UNA ANTENA EN '+(LUGAR[d.estacion]||d.lugar.toUpperCase())+' ESCUCHA A '+d.nombre.toUpperCase(),D.distancia(d.rango)+' · '+D.velocidad(d.dataRate)]
                                 :['SIN CONEXIÓN · LA ÚLTIMA SEÑAL FUE DE '+d.nombre.toUpperCase(),D.distancia(d.rango)]};
  w=ventana(28.4,33.6);
  if(w) frase={...w,lineas:['ESTA SEÑAL SALIÓ HACE '+D.hace(d.rtlt/2),'Y HA VIAJADO '+D.distancia(d.rango)+' HASTA AQUÍ']};
  return {modo,frase};
}
// estado de la escena en el instante t (segundos dentro de la vuelta)
function estado(t,plan,opts){
  opts=opts||{}; const d=plan.datos;
  const cur=PLANOS.filter(p=>p[0]<=t).pop(); let expo=1;
  if(t<1.5) expo=t/1.5; if(cur[1]==='NEGRO') expo=0; if(t>32) expo=Math.max(0,(VUELTA-t)/2);
  // la potencia real de la señal (dBm) sube o baja el brillo de la revelación
  const pw=Math.max(.6,Math.min(1.3,1+((d.potencia||-120)+120)/60));
  // LA RED: la escena se queda casi a oscuras detrás de la red entera
  let plano=cur[1]==='NEGRO'?'NOCHE':cur[1]; if(plano==='RED'){ plano='CIELO'; expo*=.22; }
  const vivo=opts.vivo??d.vivo;
  return {t,tl:t-cur[0],plano,az:d.az,el:d.el,sen:cur[2]*pw,expo,
    golpes:plan.golpes.filter(x=>x>t-4.2&&x<t+2.7).slice(0,8),nombre:d.nombre,tNombre:T_RUPTURA,
    capa:capa(t,d,vivo),vivo};
}
window.MensajeroMontaje={VUELTA,T_RUPTURA,estado};
})();
