// ======================================================================
// VØID_LOOM · MENSAJERO — main.js
// CONSOLA (index.html): lee el feed real de la DSN, suena, enseña la vista previa y el estado; cada vuelta (34 s)
// fija los datos del momento y los manda a la SALIDA (salida.html, el proyector) por BroadcastChannel.
// ======================================================================
import {crear} from './escena.js';
const Q=new URLSearchParams(location.search);
const SALIDA=Q.has('salida')||/salida\.html/.test(location.pathname);
const M={};
const ahora=()=>performance.timeOrigin+performance.now();

// ---------------- motor de imagen + capa del TESTIGO
async function montaEscena(w,h,calidad){
  try{ await Promise.all([300,400,600].map(p=>document.fonts.load(p+" 20px 'JetBrains Mono'"))); }catch(e){}
  const c=document.getElementById('c'), t=document.getElementById('t');
  M.E=await crear({canvas:c,w,h,calidad,az:105,el:51}); M.tc=t.getContext('2d'); t.width=w; t.height=h;
}
// la capa de datos se dibuja encima con el reloj de verdad (Date.now) y la última lectura real del feed
function frame(tVuelta,plan,dt){
  const st=MensajeroMontaje.estado(tVuelta,plan,{vivo:M.vivo}); M.E.dibuja(st,dt);
  const t=M.tc.canvas; M.tc.clearRect(0,0,t.width,t.height);
  if(M.verTestigo!==false){ const fade=st.t>MensajeroMontaje.VUELTA-1.2?Math.max(.35,(MensajeroMontaje.VUELTA-st.t)/1.2):1;
    MensajeroCapa.dibujaCapa(M.tc,t.width,t.height,M.red||MensajeroDatos.MEMORIA_RED,{modo:st.capa.modo,ahora:Date.now(),lectura:M.lectura||Date.now(),vivo:M.vivo,foco:plan.datos,frase:st.capa.frase,leyenda:st.capa.leyenda,eventos:M.eventos,alpha:fade}); }
  return st;
}
const libre=(tv)=>tv>1.5&&!(tv>19.6&&tv<22.8)&&tv<MensajeroMontaje.VUELTA-3;   // una lectura no rompe el silencio de la ruptura

// ---------------- CONSOLA
async function consola(){
  const $=id=>document.getElementById(id);
  const marco=$('c'); await montaEscena(marco.clientWidth||960,marco.clientHeight||540,.45);
  $('carga').style.display='none'; $('consola').classList.add('on');
  M.D=new MensajeroDatos.Datos(); M.vivo=false; M.red=null; M.lectura=0;
  // CADA LECTURA REAL (cada 5 s): actualiza la capa, reorienta la antena y llega como un paquete más (golpe de luz y sonido)
  M.eventos=[]; M.R=new MensajeroDatos.Rotacion(); M.rotar=true;
  const evento=(txt,extra)=>{ M.eventos.push({ts:Date.now(),txt,...extra}); if(M.eventos.length>8) M.eventos.shift(); };
  M.evento=evento;
  // CADA LECTURA REAL (cada 5 s): actualiza la capa y el enlace escuchado, apunta los eventos reales de la red,
  // llega como un paquete (golpe de luz y sonido) y, en la TENSIÓN, puede cortar de plano
  M.D.onLectura=(d,r,ev)=>{ M.red=r; M.lectura=Date.now(); M.vivo=true; let golpe=null, corte=false;
    for(const e of ev||[]) evento(e.txt,{tipo:e.t,dish:e.dish});
    if(M.plan&&M.ctx){ const pd=M.plan.datos, nd=r.find(x=>x.dish===pd.dish);
      if(nd&&nd.activo&&nd.nave===pd.nave) Object.assign(pd,{az:nd.az,el:nd.el,rango:nd.rango,rtlt:nd.rtlt,dataRate:nd.dataRate,potencia:nd.potencia,vivo:true});
      const tv=M.ctx.currentTime-M.tVuelta0+1.2; if(libre(tv)){ golpe=+tv.toFixed(3); M.plan.golpes=[...M.plan.golpes,golpe].sort((a,b)=>a-b); M.S.arco(M.tVuelta0+golpe,(ev&&ev.length)?1:.7); }
      corte=MensajeroMontaje.corte(M.plan,tv-1.2+(ev&&ev.length?0:.8)); }
    M.ch.postMessage({type:'lectura',red:r,lectura:M.lectura,vivo:true,golpe,datos:M.plan&&M.plan.datos,planos:M.plan&&M.plan.planos,eventos:M.eventos}); };
  setInterval(()=>{ if(M.D.estado!=='EN VIVO') M.vivo=false; },1000);
  M.D.arranca();
  M.ch=new BroadcastChannel('mensajero-salida'); M.verTestigo=true; M.salidaViva=0;
  M.ch.onmessage=e=>{ const d=e.data||{}; if(d.type==='vivo'){ M.salidaViva=performance.now(); M.salidaFps=d.fps; } if(d.type==='hola' && M.plan) M.ch.postMessage({type:'vuelta',plan:M.plan,wall0:M.wall0,testigo:M.verTestigo,red:M.red,lectura:M.lectura,vivo:M.vivo,eventos:M.eventos}); };
  $('salida').onclick=()=>window.open('salida.html?salida','mensajero-salida','popup,width=1280,height=720');
  $('rotar').checked=true; $('rotar').onchange=e=>{ M.rotar=e.target.checked; };
  $('testigo').checked=true; $('testigo').onchange=e=>{ M.verTestigo=e.target.checked; };
  $('vol').oninput=e=>{ if(M.master) M.master.gain.value=+e.target.value; };
  $('arrancar').onclick=()=>{ $('arrancar').disabled=true; $('arrancar').textContent='EN MARCHA'; arrancar(); };
  if(Q.has('instalacion')) setTimeout(()=>{ $('arrancar').click(); $('salida').click(); },2500);
  addEventListener('keydown',e=>{ if(e.key==='f'||e.key==='F') $('vista').requestFullscreen&&$('vista').requestFullscreen(); });
  new ResizeObserver(()=>{ const w=marco.clientWidth, h=marco.clientHeight; if(w&&h){ M.E.resize(Math.round(w*.75),Math.round(h*.75)); $('t').width=Math.round(w*.75); $('t').height=Math.round(h*.75); } }).observe(marco);
  setInterval(estadoUI,500); estadoUI();
}
// cada vuelta, otro enlace real (ROTACIÓN DE ESCUCHA); de él salen los planos y el sonido
function nuevaVuelta(t0){
  M.nv=(M.nv||0)+1; const vivo=M.D.estado==='EN VIVO';
  const sel=M.R.siguiente(M.D.enlaces(),M.rotar)||{d:M.D.actual(),cambio:false}; const d={...sel.d,vivo};
  const o=MensajeroSonido.opciones(d,MensajeroMontaje.VUELTA);
  const P=MensajeroSonido.Partitura(o); MensajeroSonido.programa(M.S,P,o,t0);
  M.plan={golpes:P.golpes,datos:d,cambio:sel.cambio,planos:MensajeroMontaje.planos(d,{vuelta:M.nv,cambio:sel.cambio}),sonido:{bpm:o.bpm,raiz:o.raiz}};
  M.tVuelta0=t0; M.wall0=ahora()+(t0-M.ctx.currentTime)*1000;
  if(sel.cambio) setTimeout(()=>M.evento('LA PIEZA PASA A ESCUCHAR '+d.dish+' '+(MensajeroDatos.LUG[d.estacion]||'')+' → '+d.nombre.toUpperCase(),{pieza:true}),Math.max(0,(t0-M.ctx.currentTime)*1000));
  M.ch.postMessage({type:'vuelta',plan:M.plan,wall0:M.wall0,testigo:M.verTestigo,red:M.red,lectura:M.lectura,vivo:M.vivo,eventos:M.eventos});
}
function arrancar(){
  const ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'playback'}); M.ctx=ctx;
  M.master=ctx.createGain(); M.master.gain.value=+document.getElementById('vol').value; M.master.connect(ctx.destination);
  M.S=MensajeroSonido.Motor(ctx,M.master,{raiz:38,seed:7});
  let t0=ctx.currentTime+.6; nuevaVuelta(t0);
  // la siguiente vuelta se programa 1 s antes de que acabe la actual, con los datos de ese momento
  setInterval(()=>{ if(ctx.currentTime>M.tVuelta0+MensajeroMontaje.VUELTA-1) nuevaVuelta(M.tVuelta0+MensajeroMontaje.VUELTA); },200);
  let last=performance.now(), acc=0;
  const loop=()=>{ requestAnimationFrame(loop); const now=performance.now(); acc+=(now-last)/1000; last=now;
    const conSalida=now-M.salidaViva<2000; if(conSalida && acc<1/15) return; const dt=acc; acc=0;   // con la salida abierta, la vista previa va a 15 fps
    const tv=ctx.currentTime-M.tVuelta0; M.st=frame(Math.max(0,tv),M.plan,dt); };
  requestAnimationFrame(loop);
}
function estadoUI(){
  const $=id=>document.getElementById(id), D=MensajeroDatos; if(!M.D) return; const d=(M.plan&&M.plan.datos)||M.D.actual(), vivo=M.D.estado==='EN VIVO';
  $('e-flujo').textContent=M.D.estado; $('e-flujo').className=vivo?'vivo':'mem';
  $('e-ant').textContent=d.dish+' · '+d.lugar; $('e-nave').textContent=d.nombre+' ('+d.nave+')';
  $('e-dist').textContent=D.distancia(d.rango).toLowerCase(); $('e-luz').textContent=D.hace(d.rtlt/2).toLowerCase();
  $('e-datos').textContent=D.velocidad(d.dataRate).toLowerCase()+' · banda '+(d.banda||'—')+' · '+d.potencia+' dBm';
  if(M.plan&&M.plan.sonido) $('e-sonido').textContent='nota '+M.plan.sonido.raiz+' · '+M.plan.sonido.bpm+' bpm'; $('e-enl').textContent=M.D.enlaces().length+' activos';
  $('e-apunta').textContent='az '+d.az+'° · el '+d.el+'°';
  if(M.st){ $('e-acto').textContent=M.st.plano; }
  const sv=performance.now()-M.salidaViva<2000; $('e-salida').textContent=sv?'CONECTADA · '+(M.salidaFps||'—')+' fps':'SIN ABRIR'; $('e-salida').className=sv?'vivo':'';
}

// ---------------- SALIDA: solo la obra, en el proyector
async function salida(){
  const dpr=Math.min(devicePixelRatio||1,2); await montaEscena(innerWidth*dpr,innerHeight*dpr,1);
  const ch=new BroadcastChannel('mensajero-salida'); let plan=null, wall0=0, ema=1/60, q=1, last=performance.now();
  ch.onmessage=e=>{ const d=e.data||{};
    if(d.type==='vuelta'){ plan=d.plan; wall0=d.wall0; M.verTestigo=d.testigo; M.red=d.red; M.lectura=d.lectura; M.vivo=d.vivo; M.eventos=d.eventos||[]; document.getElementById('carga').style.display='none'; }
    if(d.type==='lectura'){ M.red=d.red; M.lectura=d.lectura; M.vivo=d.vivo; M.eventos=d.eventos||M.eventos; if(plan){ if(d.datos) plan.datos=d.datos; if(d.planos) plan.planos=d.planos; if(d.golpe!=null) plan.golpes=[...plan.golpes,d.golpe].sort((a,b)=>a-b); } } };
  setInterval(()=>{ if(Date.now()-(M.lectura||0)>30000) M.vivo=false; },1000);
  ch.postMessage({type:'hola'}); setInterval(()=>ch.postMessage({type:'vivo',fps:Math.round(1/ema)}),500);
  const size=()=>{ const w=Math.round(innerWidth*dpr*q), h=Math.round(innerHeight*dpr*q); M.E.resize(w,h); const t=document.getElementById('t'); t.width=w; t.height=h; };
  addEventListener('resize',size);
  addEventListener('dblclick',()=>(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>{}));
  let cortes='';
  const loop=()=>{ requestAnimationFrame(loop); if(!plan) return; const now=performance.now(), dt=(now-last)/1000; last=now; ema=ema*.97+dt*.03;
    const tv=(ahora()-wall0)/1000; if(tv<0) return;
    const st=frame(tv,plan,dt);
    // calidad automática: solo en un corte de plano
    if(st.plano!==cortes){ cortes=st.plano; if(ema>1/45&&q>.6){ q=Math.round((q-.1)*10)/10; size(); } else if(ema<1/58&&q<1){ q=Math.min(1,Math.round((q+.1)*10)/10); size(); } } };
  requestAnimationFrame(loop);
}
(SALIDA?salida():consola()).catch(e=>{ document.title='ERR '+e.message; console.error('[MENSAJERO_GPU_FALLO]',e&&e.message); });
