// ======================================================================
// VØID_LOOM · CÓRTEX — ddj.js
// Pioneer DDJ-200 como instrumento (mismos mensajes que el mapeo de VØID_LOOM LIVE).
// Si se toca en AUTOPLAY o PÚBLICO, entra al momento por encima.
// ======================================================================
let midiOut=null; const isDDJ=(port)=>!!port&&/DDJ-?200/i.test(port.name||'');
async function iniciarDDJ(){
  if(!navigator.requestMIDIAccess) return false;
  try{ const acc=await navigator.requestMIDIAccess(); let ok=false;
    const bind=()=>{ acc.inputs.forEach(i=>{ i.onmidimessage=(e)=>ddjMsg(e.data[0],e.data[1],e.data[2]); if(isDDJ(i)) ok=true; }); acc.outputs.forEach(o=>{ if(isDDJ(o)) midiOut=o; }); };
    bind(); acc.onstatechange=bind; return ok; }catch(e){ return false; }
}
function led(st,n,on){ if(!midiOut) return; try{ midiOut.send([st,n,on?0x7f:0]); if(on) setTimeout(()=>{ try{ midiOut.send([st,n,0]); }catch(e){} },140); }catch(e){} }
const DDJ={bpm:120};
function ddjMsg(st,n,v){
  if(!window.AHORA) return;
  const t=AHORA()+.01, type=st&0xf0, ch=st&0x0f, on=type===0x90&&v>0, off=type===0x80||(type===0x90&&v===0);
  aInstrumento(t,'ddj');
  const I=INST, S=I.S;
  if(type===0xb0){
    if(ch===6){ if(n===0x1f){ const dentro=v/127>.6; if(dentro!==!!I.forzarDentro){ I.forzarDentro=dentro?1:0; I.lastCut=-9; corte(t,dentro?'in':'orbit',{dur:dentro?30:8,z:H1(t)*50,prio:1}); } } return; }
    if(ch===0){
      if(n===0x13) I.actividad=.2+v/127;                       // fader A → actividad
      else if(n===0x07) S.bright=.2+.75*v/127;                 // HI → brillo de los metales
      else if(n===0x0b) I.dens=v/127;                          // MID → densidad del groove
      else if(n===0x0f) I.subAmt=v/127;                        // LOW → peso del sub
      else if(n===0x00) DDJ.bpm=Math.round(150-60*v/127);      // tempo → BPM 90–150
      else if(n===0x21||n===0x22||n===0x29) I.eegPos=clamp(I.eegPos+(v-64)*(n===0x29?40:4),0,NOCHE.n-1);   // jog A: recorre la noche
      return;
    }
    if(ch===1){
      if(n===0x13) I.dronAmt=1.5*v/127;                         // fader B → drones
      else if(n===0x21||n===0x22) I.camAz+=(v-64)*.01;          // jog B: gira la cámara
      return;
    }
    return;
  }
  if(ch>=7&&ch<=10){                                            // pads
    const deck=ch<=8?'A':'B', shifted=ch===8||ch===10; if(n>7) return;
    if(deck==='A'&&!shifted){ if(!on) return; led(st,n,1);
      if(n<6) I.evento({t,kind:'golpe',reg:n,vel:.85,pan:(n%2?.4:-.4),src:'ddj'});
      else if(n===6) responder(t); else ruptura(t); return; }
    if(deck==='A'&&shifted){ if(n>=6) return; const id='p'+n;           // notas sostenidas por región
      if(on){ led(st,n,1); I.evento({t,kind:'notaOn',id,reg:n,m:grado(S,REG_GRADO[n]+2,REG_OCT[n]),vel:.8,pan:(n%2?.4:-.4),src:'ddj'}); }
      else if(off) I.evento({t,kind:'notaOff',id,src:'ddj'}); return; }
    if(!on) return; led(st,n,1);
    if(deck==='B'&&!shifted){
      if(n===0){ if(I.tempo&&I.tempo.ddj){ I.tempo=null; } else { I.tempo={beat:60/DDJ.bpm,t0:t,last:t+1e6,ddj:true}; I.nextBar=t+.05; I.E=Math.max(I.E,.4); } }
      else if(n===1) shot(t,'black',{dur:.5,live:true});
      else if(n===2){ insertar(TL.glitch,{t,len:.1}); emitir('glitch'); }
      else if(n===3) TL.impacts.push({t});
      else if(n===4){ I.lastCut=-9; corte(t,'in',{dur:4,z:H1(t)*50,prio:1}); }
      else if(n===5) TL.tract.push({t,t1:t+5});
      else if(n===6){ nuevaSesion(t); insertar(TL.waves,{t,c:[0,.15,0],amp:1.2}); I.E=Math.max(I.E,.2); }
      else { I.E=0; I.lastEv=t-60; I.tempo=null; }
      return; }
    const tys=['macro','region','top','low','orbit','crane','pull','sueno']; I.lastCut=-9;
    corte(t,tys[n],{reg:Math.floor(H1(t)*6),sx:H1(t*3)<.5?-1:1,dur:tys[n]==='sueno'?60:4,prio:1}); return;
  }
  if(!on) return;
  if(ch===0){ if(n===0x0b){ if(I.acto==='REPOSO') I.evento({t,kind:'golpe',reg:1,vel:.7,src:'ddj'}); else { I.E=0; I.lastEv=t-60; I.tempo=null; } }   // PLAY: despierta / duerme
    else if(n===0x0c) ruptura(t);                                                                                                // CUE: ruptura
    else if(n===0x58){ I.tempo={beat:60/DDJ.bpm,t0:t,last:t+1e6,ddj:true}; I.nextBar=t+.05; I.E=Math.max(I.E,.4); } }           // SYNC: groove al tempo del controlador
}
