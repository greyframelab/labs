// VØID_LOOM · ROSTRO — ventana de salida. Solo la obra, a la resolución del proyector.
// No espera frames de la consola: calcula la misma pieza por su cuenta (misma semilla, mismo azar)
// con el reloj que le pasa la consola, así que va fluida aunque los mensajes lleguen a destiempo.
// El sonido sale de la consola.
import { crearEscena } from './escena.js';
import { crearPieza } from './partitura.js';
import { crearAnimador } from './anim.js';

const cv = document.getElementById('c'), hint = document.getElementById('hint');
let esc; try { esc = await crearEscena(cv, '#FF1A1A'); } catch (e) { console.error('[ROSTRO_GPU_FALLO]', e); throw e; }
const ch = new BroadcastChannel('rostro-salida');
let P = null, an = null, code = '', start = 0, sala = { fadeOut: 1, bri: 1, seguro: true, ext: null, forzarMedio: false }, haveClock = false;
ch.onmessage = (e) => {
  const d = e.data; if (!d) return;
  if (d.type === 'pieza') { P = crearPieza(d.code, d.opts); an = crearAnimador(P, d.seed, d.intensidad); code = d.code; esc.acento(P.acc); }
  else if (d.type === 'golpe') { if (an) an.golpe(d.emo); }
  else if (d.type === 'reloj') {
    // el reloj se suaviza: pequeñas diferencias de entrega no se notan
    if (!haveClock || Math.abs(d.start - start) > 250) start = d.start; else start += (d.start - start) * 0.05;
    haveClock = true; sala = d; if (d.fx) esc.fx(d.fx);
  }
};
const vivo = () => ch.postMessage({ type: 'vivo', code }); setInterval(vivo, 500); vivo();
addEventListener('dblclick', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}));
document.addEventListener('fullscreenchange', () => hint.classList.toggle('off', !!document.fullscreenElement));
setTimeout(() => hint.classList.add('off'), 9000);

// calidad automática: baja por pasos y solo en un corte de plano
const NIV = [{ k: 1, fps: 60, l: false }, { k: 0.85, fps: 60, l: false }, { k: 0.85, fps: 30, l: false }, { k: 0.8, fps: 30, l: true }, { k: 0.65, fps: 30, l: true }];
let n = 0, avg = 60, low = 0, lastDraw = 0, lastCut = -1;
// resolución acotada: como mucho ~1080p de píxeles reales (un proyector 4K no hunde la gráfica)
const size = () => { let d = Math.min(devicePixelRatio || 1, 2); const px = innerWidth * innerHeight * d * d; if (px > 2.2e6) d *= Math.sqrt(2.2e6 / px);
  esc.tamano(innerWidth * d * NIV[n].k, innerHeight * d * NIV[n].k); };
addEventListener('resize', size); size();
const FRONTAL = new Set(['medio', 'macro', 'boca', 'ojo', 'lejos']);
function frame(ts) {
  requestAnimationFrame(frame);
  if (!an || !haveClock) return;
  if (ts - lastDraw < 1000 / NIV[n].fps - 2) return;   // 30 fps exactos si no llega a 60: sin tirones
  const dd = (ts - lastDraw) / 1000; lastDraw = ts;
  if (dd > 0 && dd < 0.5) avg += (1 / dd - avg) * 0.05;
  if (avg < NIV[n].fps * 0.82) low += dd; else low = Math.max(0, low - dd * 0.5);
  const tRaw = Math.max(0, (performance.timeOrigin + performance.now() - start) / 1000), tt = Math.min(P.dur, tRaw);
  an.externo(sala.ext ? sala.ext.c : null, sala.ext ? sala.ext.w : 0, sala.ext ? sala.ext.emo : null);
  const st = an.avanzar(tt);
  if (sala.seguro) { st.sweep *= 0.6; st.rim = Math.min(st.rim, 1.4); }
  let pl = an.plano(tt); if (sala.forzarMedio && !FRONTAL.has(pl.name)) pl = { name: 'medio', since: pl.since, at: pl.at };
  if (pl.at !== lastCut) { if (low > 2.5 && n < NIV.length - 1) { n++; low = 0; esc.calidad(NIV[n].l); size(); } lastCut = pl.at; }
  const fadeP = Math.max(0, Math.min(1, tRaw / 1.2, (P.dur + 1.5 - tRaw) / 2.2));
  esc.pose(st.c, tt, st.bumps); esc.camara(pl.name, pl.since); esc.luz(st.rim, st.sweep, st.swx, sala.bri); esc.render(tt, fadeP * sala.fadeOut, st.glitch, st.speed);
}
requestAnimationFrame(frame);
