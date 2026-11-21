// VØID_LOOM · ROSTRO — ventana de salida. Solo la obra, a la resolución del proyector.
// La consola manda en cada frame el estado del rostro (mandos, impulsos, luz, plano); aquí se dibuja igual.
// El sonido sale de la consola.
import { crearEscena } from './escena.js';

const cv = document.getElementById('c'), hint = document.getElementById('hint');
const esc = await crearEscena(cv, '#FF1A1A');
const ch = new BroadcastChannel('rostro-salida');
let last = null; ch.onmessage = (e) => { if (e.data && e.data.type === 'frame') last = e.data; };
setInterval(() => ch.postMessage({ type: 'vivo' }), 500); ch.postMessage({ type: 'vivo' });
addEventListener('dblclick', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}));
document.addEventListener('fullscreenchange', () => hint.classList.toggle('off', !!document.fullscreenElement));
setTimeout(() => hint.classList.add('off'), 9000);

// calidad automática, igual que en la consola: baja por pasos y solo en un corte de plano
const NIV = [{ k: 1, fps: 60, l: false }, { k: 0.8, fps: 60, l: false }, { k: 0.8, fps: 30, l: false }, { k: 0.8, fps: 30, l: true }, { k: 0.6, fps: 30, l: true }];
let n = 0, avg = 60, low = 0, lastTs = 0, lastDraw = 0, lastShot = '';
const size = () => { const d = Math.min(devicePixelRatio || 1, 2); esc.tamano(innerWidth * d * NIV[n].k, innerHeight * d * NIV[n].k); };
addEventListener('resize', size); size();
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = (ts - lastTs) / 1000; lastTs = ts;
  if (!last) return;
  if (ts - lastDraw < 1000 / NIV[n].fps - 2) return;   // 30 fps exactos si no llega a 60: sin tirones
  const dd = (ts - lastDraw) / 1000; lastDraw = ts;
  if (dd > 0 && dd < 0.5) avg += (1 / dd - avg) * 0.05;
  if (avg < NIV[n].fps * 0.82) low += dd; else low = Math.max(0, low - dd * 0.5);
  const shot = last.shot + Math.round((last.t - last.since) * 100);
  if (shot !== lastShot && low > 2.5 && n < NIV.length - 1) { n++; low = 0; esc.calidad(NIV[n].l); size(); }
  lastShot = shot;
  const f = last;
  esc.acento(f.acc);
  esc.pose(f.c, f.t, f.bumps); esc.camara(f.shot, f.since); esc.luz(f.rim, f.sweep, f.swx, f.bri); esc.render(f.t, f.fade);
}
requestAnimationFrame(frame);
