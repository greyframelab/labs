// VØID_LOOM · ROSTRO — consola. Lleva el reloj (el del audio), la partitura, el sonido y la vista previa,
// y manda cada frame a la ventana de SALIDA, que dibuja la misma cabeza a la resolución del proyector.
import { crearEscena } from './escena.js';
import { crearAnimador } from './anim.js';
import { crearPieza, nuevoCodigo, ACENTOS, ESTILOS } from './partitura.js';
import { EMOCIONES, pose } from './rig.js';
import { crearSonido } from './sonido.js';
import { crearEspejo } from './espejo.js';

const $ = (id) => document.getElementById(id);
const S = {
  modo: 'auto', estilo: null, acc: null, emo: null, ambient: true, vol: 0.7, bri: 1, seguro: true, apagado: false, solo: false,
  amp: 1, verCam: false,
  P: null, an: null, t0: 0, si: 0, hist: [], hi: -1, salida: false, salidaVista: 0,
};
let esc, snd, ctx; const esp = crearEspejo(); let espOn = false;

// ---------------------------------------------------------------- arranque
$('go').onclick = async () => {
  $('go').classList.add('off'); $('bootbar').classList.add('on');
  const log = (m, p) => { $('bootlog').textContent = m; if (p != null) $('bootfill').style.transform = `scaleX(${p})`; };
  try {
    log('PREPARANDO EL SONIDO', 0.15);
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback', sampleRate: 48000 });
    await ctx.resume(); snd = crearSonido(ctx); snd.volumen(S.vol);
    log('MODELANDO EL ROSTRO', 0.4);
    esc = await crearEscena($('c'), '#FF1A1A');
    log('CALENTANDO LA LUZ', 0.85);
    tamano(); esc.pose(pose('REPOSO'), 0); esc.render(0, 0);
    log('', 1);
    $('boot').classList.add('off');
    const q = new URLSearchParams(location.search);
    if (q.get('modo') === 'manual') setModo('manual'); else if (q.get('modo') === 'espejo') setModo('espejo');
    nueva(q.get('pieza') || null);
    if (q.has('museo')) proyectar();
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e); $('bootlog').classList.add('err'); log('NO SE PUDO ARRANCAR: ' + (e && e.message || e)); $('go').classList.remove('off');
  }
};

// ---------------------------------------------------------------- piezas
function nueva(code, fromHist = false) {
  code = (code || nuevoCodigo()).toUpperCase();
  const prevAcc = S.P && S.P.acc;
  const opts = { evitar: prevAcc };
  if (S.modo === 'manual') { if (S.estilo) opts.estilo = S.estilo; if (S.acc) opts.acc = S.acc; if (S.emo) opts.emo = S.emo; }
  S.P = crearPieza(code, opts);
  S.an = crearAnimador(S.P, code.charCodeAt(0) * 31 + code.charCodeAt(1), S.seguro ? 0.9 : 1);
  S.t0 = ctx.currentTime + 0.25; S.si = 0;
  snd.pieza(S.P, S.t0);
  const imp = S.P.events.find(e => e.k === 'impact'); if (imp) snd.oleaje(S.t0 + imp.t - S.P.BAR, S.t0 + imp.t);
  esc.acento(S.P.acc);
  if (!fromHist) { S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(code); S.hi = S.hist.length - 1; }
  registrar(S.P);
  pintarPieza();
}
function pintarPieza() {
  const P = S.P;
  $('chCode').textContent = P.code; $('chSt').textContent = P.estilo; $('chBpm').textContent = P.bpm;
  $('inCode').value = P.code; $('pieceRef').textContent = P.estilo;
  $('bigName').textContent = P.arco.slice(0, 3).join(' · ');
  $('bigIdea').textContent = `${ESTILOS[P.estilo].idea} · ${Math.round(P.dur)} s · eco: ${P.arco[3].toLowerCase()}`;
  document.documentElement.style.setProperty('--acc', P.acc);
  [...$('swAcc').children].forEach(b => b.classList.toggle('on', b.dataset.c === P.acc));
  // línea de tiempo con los actos
  const tl = $('tl'); tl.innerHTML = '<i id="tlBar"></i>';
  for (const [t, n] of P.acts) { const x = (t / P.dur) * 100; tl.insertAdjacentHTML('beforeend', `<em style="left:${x}%"></em><span style="left:${x}%">${n}</span>`); }
}
const REG = [];
function registrar(P) {
  const h = new Date(); REG.unshift({ code: P.code, estilo: P.estilo, arco: P.arco.join('/'), hora: h.toLocaleTimeString('es-ES', { hour12: false }) });
  if (REG.length > 200) REG.pop();
  $('nLog').textContent = REG.length;
  $('listLog').innerHTML = REG.slice(0, 40).map(r => `<div><i>${r.hora}</i><button class="go" data-c="${r.code}">${r.code} · ${r.estilo}</button><i>${r.arco}</i></div>`).join('');
}
$('listLog').onclick = (e) => { const b = e.target.closest('button[data-c]'); if (b) nueva(b.dataset.c); };
$('bCsv').onclick = () => {
  const csv = 'hora,pieza,estilo,arco\n' + REG.map(r => [r.hora, r.code, r.estilo, r.arco].join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'rostro-registro.csv'; a.click();
};

// ---------------------------------------------------------------- bucle
let last = 0, fpsAvg = 60, lowFor = 0, nivel = 0, lastShot = '', lastPreview = 0;
const NIVELES = [{ esc: 1, fps: 60, ligera: false }, { esc: 0.8, fps: 60, ligera: false }, { esc: 0.8, fps: 30, ligera: false }, { esc: 0.8, fps: 30, ligera: true }, { esc: 0.6, fps: 30, ligera: true }];
const salCh = new BroadcastChannel('rostro-salida');
salCh.onmessage = (e) => { if (e.data && e.data.type === 'vivo') { S.salidaVista = performance.now(); if (!S.salida) { S.salida = true; $('bProj').classList.add('on'); tamano(); } } };
let fadeOut = 1;

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = (ts - last) / 1000; last = ts;
  if (S.salida && performance.now() - S.salidaVista > 2500) { S.salida = false; $('bProj').classList.remove('on'); tamano(); }
  const P = S.P, now = ctx.currentTime - S.t0;
  // sonido: programa los golpes que caen en los próximos 250 ms (el reloj es el del audio: sin deriva)
  while (S.si < P.events.length && P.events[S.si].t < now + 0.25) {
    const e = P.events[S.si++]; if (e.t >= now - 0.05) snd.golpe(e, S.t0 + e.t, P);
  }
  const tt = Math.max(0, now);
  const st = S.an.avanzar(Math.min(tt, P.dur));
  if (S.seguro) { st.sweep *= 0.6; st.rim = Math.min(st.rim, 1.4); }
  // negro → negro: cada pieza entra y sale de la oscuridad
  const fadeP = Math.max(0, Math.min(1, tt / 1.2, (P.dur + 1.5 - tt) / 2.2));
  fadeOut += ((S.apagado ? 0 : 1) - fadeOut) * Math.min(1, dt * 1.2);
  const fade = fadeP * fadeOut;
  snd.vivo(st, ctx.currentTime, Math.max(0, Math.min(1, (P.dur + 3 - tt) / 3)));
  if (tt > P.dur + 2.6) { if (S.modo === 'auto') nueva(); else nueva(P.code, true); return; }

  // ESPEJO: la cara del visitante manda sobre el arco de la pieza mientras está delante
  let pres = 0;
  if (espOn) {
    const r = esp.leer(Math.min(0.1, dt), S.amp); pres = r.presencia;
    S.an.externo(r.c, pres * 0.92, r.emo);
    if (hudTick(ts, 'e')) { $('eCara').textContent = pres > 0.5 ? 'DELANTE' : 'NADIE'; $('eEmo').textContent = pres > 0.5 ? r.emocion : '—'; $('eMs').textContent = Math.round(esp.ms) + ' ms';
      $('eLvl').style.width = (pres * 100) + '%'; }
  }
  let pl = S.an.plano(tt);
  // con alguien delante, planos frontales: un espejo se mira de frente
  if (pres > 0.5 && !FRONTAL.has(pl.name)) pl = { name: 'medio', since: pl.since, at: pl.at };
  const msg = { type: 'frame', c: st.c, bumps: st.bumps, rim: st.rim, sweep: st.sweep, swx: st.swx, shot: pl.name, since: pl.since, fade, t: tt, acc: P.acc, bri: S.bri, at: performance.timeOrigin + performance.now() };
  salCh.postMessage(msg);

  // calidad automática: si no llega, baja por pasos; la resolución solo cambia en un corte de plano
  if (dt > 0 && dt < 0.5) fpsAvg += (1 / dt - fpsAvg) * 0.05;
  const N = NIVELES[nivel];
  if (fpsAvg < N.fps * 0.82) lowFor += dt; else lowFor = Math.max(0, lowFor - dt * 0.5);
  const corte = pl.name + pl.at !== lastShot; lastShot = pl.name + pl.at;
  if (lowFor > 2.5 && nivel < NIVELES.length - 1 && corte) { nivel++; lowFor = 0; esc.calidad(NIVELES[nivel].ligera); tamano(); }
  $('chFps').textContent = Math.round(fpsAvg) + (nivel ? ` · Q${nivel}` : '');
  const hud = hudTick(ts);
  if (hud) {
    $('chAct').textContent = st.act;
    const top = Object.entries(st.emo).sort((a, b) => b[1] - a[1])[0];
    $('chEmo').textContent = top && top[1] > 0.05 ? top[0] : 'REPOSO';
    $('tagTxt').textContent = `${pl.name.toUpperCase()} · ${st.act}`;
    const bar = $('tlBar'); if (bar) bar.style.width = (Math.min(1, tt / P.dur) * 100) + '%';
  }
  // vista previa: a 15 fps si la salida está abierta (el proyector manda)
  const prevFps = S.salida ? 15 : NIVELES[nivel].fps;
  if (ts - lastPreview < 1000 / prevFps - 2) return;
  lastPreview = ts;
  esc.pose(st.c, tt, st.bumps); esc.camara(pl.name, pl.since); esc.luz(st.rim, st.sweep, st.swx, S.bri); esc.render(tt, fade);
}

const FRONTAL = new Set(['medio', 'macro', 'boca', 'ojo', 'lejos']);
const hudT = {}; function hudTick(ts, k = 'a') { if (ts - (hudT[k] || 0) > 200) { hudT[k] = ts; return true; } return false; }

function tamano() {
  const v = $('c'), r = v.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), k = NIVELES[nivel].esc;
  const pv = S.salida ? 0.6 : 1;
  esc.tamano(r.width * dpr * k * pv, r.height * dpr * k * pv);
}
addEventListener('resize', () => esc && tamano());

// ---------------------------------------------------------------- controles
function setModo(m) {
  S.modo = m; [...$('segMode').children].forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('chMode').textContent = { auto: 'AUTOMÁTICO', manual: 'MANUAL', espejo: 'ESPEJO' }[m];
  $('boxManual').classList.toggle('hide', m !== 'manual');
  $('boxEsp').classList.toggle('hide', m !== 'espejo');
  $('modeNote').textContent = {
    auto: 'Las piezas nacen solas y se suceden de negro a negro, sin repetir acento seguido. Cada una tiene su arco: tensión, ruptura y eco.',
    manual: 'Elige emoción, estilo y acento. La pieza se repite hasta pulsar NUEVA.',
    espejo: 'La cabeza copia la cara de quien tiene delante y la lleva al extremo. El ritmo y los golpes siguen; sin nadie delante, vuelve al AUTOMÁTICO.' }[m];
  if (m === 'espejo' && !espOn) encenderEspejo(); else if (m !== 'espejo' && espOn) apagarEspejo();
}
async function encenderEspejo(deviceId) {
  try {
    const v = await esp.arrancar(deviceId, s => { $('eCam').textContent = s.toUpperCase(); });
    espOn = true; $('ledEsp').className = 'led on';
    const pv = $('camPrev'); pv.srcObject = v.srcObject; pv.play().catch(() => {});
    const cams = await esp.camaras(); const sel = $('selCam');
    sel.innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${(c.label || 'CÁMARA ' + (i + 1)).toUpperCase()}</option>`).join(''); $('rowCam').classList.toggle('hide', cams.length < 2);
  } catch (e) { console.error(e); $('eCam').textContent = 'SIN CÁMARA: ' + (e && e.name || e); $('ledEsp').className = 'led err'; }
}
function apagarEspejo() { esp.parar(); espOn = false; S.an && S.an.externo(null, 0); $('ledEsp').className = 'led'; $('eCam').textContent = 'APAGADA'; }
$('selCam').onchange = () => { esp.parar(); encenderEspejo($('selCam').value); };
$('bCam').onclick = () => { S.verCam = !S.verCam; $('bCam').classList.toggle('on', S.verCam); $('camPrev').classList.toggle('hide', !S.verCam); };
$('segMode').onclick = (e) => { const b = e.target.closest('button'); if (b) { setModo(b.dataset.m); } };
$('bNew').onclick = () => nueva();
$('inCode').onkeydown = (e) => { if (e.key === 'Enter') nueva($('inCode').value.trim()); e.stopPropagation(); };
$('bPrev').onclick = () => { if (S.hi > 0) { S.hi--; nueva(S.hist[S.hi], true); } };
$('bNext').onclick = () => { if (S.hi < S.hist.length - 1) { S.hi++; nueva(S.hist[S.hi], true); } else nueva(); };
$('swAcc').innerHTML = ACENTOS.map(c => `<button data-c="${c}" style="--c:${c}" title="${c}"><i></i></button>`).join('');
$('swAcc').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.acc = b.dataset.c; if (S.modo !== 'manual') setModo('manual'); nueva(S.P.code, true); };
$('emoList').innerHTML = ['AL AZAR', ...Object.keys(EMOCIONES).filter(e => e !== 'REPOSO')].map(e => `<button data-e="${e}">${e}</button>`).join('');
$('emoList').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.emo = b.dataset.e === 'AL AZAR' ? null : b.dataset.e; [...$('emoList').children].forEach(x => x.classList.toggle('on', x === b)); nueva(); };
$('segSt').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.estilo = b.dataset.s === 'AZAR' ? null : b.dataset.s; [...$('segSt').children].forEach(x => x.classList.toggle('on', x === b)); nueva(); };
$('segAud').onclick = (e) => { const b = e.target.closest('button'); if (b) setAmbient(b.dataset.a === '1'); };
function setAmbient(on) { S.ambient = on; snd && snd.ambiente(on); [...$('segAud').children].forEach(x => x.classList.toggle('on', (x.dataset.a === '1') === on)); $('chAud').textContent = on ? 'BASE + AMBIENT' : 'BASE'; }
const rng = (id, out, fn) => { const r = $(id); const set = () => { r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); $(out).textContent = r.value; fn(+r.value); }; r.oninput = set; set(); };
rng('rVol', 'oVol', v => { S.vol = v / 100; snd && snd.volumen(S.vol); });
rng('rBri', 'oBri', v => { S.bri = v / 100; });
rng('rAmp', 'oAmp', v => { S.amp = v / 100; });
$('bSafe').onclick = () => { S.seguro = !S.seguro; $('bSafe').classList.toggle('on', S.seguro); };
$('bBlack').onclick = () => apagar();
function apagar() { S.apagado = !S.apagado; $('bBlack').classList.toggle('on', S.apagado); snd && snd.silencio(S.apagado); }
$('bProj').onclick = () => proyectar();
function proyectar() { window.open('salida.html', 'rostro-salida', 'popup,width=1280,height=720'); }
$('bShot').onclick = captura;
function captura() { const a = document.createElement('a'); a.href = esc.renderer.domElement.toDataURL('image/png'); a.download = `rostro-${S.P.code}.png`; a.click(); }
$('bHelp').onclick = () => $('help').classList.toggle('on');
$('help').onclick = () => $('help').classList.remove('on');
function solo() { S.solo = !S.solo; document.body.classList.toggle('solo', S.solo); setTimeout(tamano, 50); }

addEventListener('keydown', (e) => {
  if (!esc || e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (k === '1') setModo('auto'); else if (k === '2') setModo('manual'); else if (k === '3') setModo('espejo');
  else if (k === ' ') { e.preventDefault(); nueva(); }
  else if (k === 'ArrowLeft') $('bPrev').click(); else if (k === 'ArrowRight') $('bNext').click();
  else if (k === 'p' || k === 'P') proyectar(); else if (k === 'h' || k === 'H') solo();
  else if (k === 'b' || k === 'B') apagar(); else if (k === 'a' || k === 'A') setAmbient(!S.ambient);
  else if (k === 'c' || k === 'C') captura(); else if (k === '?') $('help').classList.toggle('on');
  else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); const r = $('rVol'); r.value = Math.max(0, Math.min(100, +r.value + (k === 'ArrowUp' ? 5 : -5))); r.oninput(); }
});
setModo('auto'); setAmbient(true);
