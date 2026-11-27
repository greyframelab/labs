// ======================================================================
// VØID_LOOM · MENSAJERO — montaje.js
// Una vuelta de 34 s, la misma partitura para imagen y sonido:
//   SEÑAL (0–6)      silueta de la antena; la máquina escribe a quién escucha
//   TENSIÓN (6–20,6) llegan los paquetes reales: cielo, cuenco, noche
//   negro y silencio total (20,6–22,3)
//   RUPTURA (22,3)   el nombre de la nave escrito en el cielo con sus fotones; cae al foco y revela la antena
//   ECO (28–34)      la máquina escribe cuándo salió esa señal
// ======================================================================
(function(){
const VUELTA=34, T_RUPTURA=22.3;
const PLANOS=[[0,'PERFIL',.85],[6,'BAJO',.9],[11,'CUENCO',.9],[16,'CIELO',.9],[20.6,'NEGRO',0],[22.3,'NOMBRE',1.25],[25.3,'HEROE',1.2],[28,'PERFIL',.85]];
// el TESTIGO: solo se escribe con datos en vivo (o forzado en el render de validación)
function testigo(t,d,forzar){
  if(!(d.vivo||forzar)) return null;
  const D=window.MensajeroDatos;
  const ventana=(a,b)=>{ const u=(t-a)/(b-a); return u>=0&&u<=1?{k:Math.min(1,u/.3),a:u<.82?1:Math.max(0,1-(u-.82)/.18)}:null; };
  let w=ventana(1,5.6);
  if(w) return {...w,lineas:[{t:'ESCUCHANDO A '+d.nombre,acc:false},{t:D.distancia(d.rango)+' · '+D.velocidad(d.dataRate),acc:true}]};
  w=ventana(28.6,33.2);
  if(w) return {...w,lineas:[{t:'ESTA SEÑAL SALIÓ HACE '+D.hace(d.rtlt/2),acc:true},{t:d.dish+' · '+d.lugar.toUpperCase()+(d.vivo?' · EN DIRECTO':''),acc:false}]};
  return null;
}
// estado de la escena en el instante t (segundos dentro de la vuelta)
function estado(t,plan,opts){
  opts=opts||{}; const d=plan.datos;
  const cur=PLANOS.filter(p=>p[0]<=t).pop(); let expo=1;
  if(t<1.5) expo=t/1.5; if(cur[1]==='NEGRO') expo=0; if(t>32) expo=Math.max(0,(VUELTA-t)/2);
  // la potencia real de la señal (dBm) sube o baja el brillo de la revelación
  const pw=Math.max(.6,Math.min(1.3,1+((d.potencia||-120)+120)/60));
  return {t,tl:t-cur[0],plano:cur[1]==='NEGRO'?'NOCHE':cur[1],az:d.az,el:d.el,sen:cur[2]*pw,expo,
    golpes:plan.golpes.filter(x=>x>t-4.2&&x<t+2.7).slice(0,8),nombre:d.nombre,tNombre:T_RUPTURA,
    testigo:testigo(t,d,opts.forzarTestigo)};
}
window.MensajeroMontaje={VUELTA,T_RUPTURA,estado};
})();
