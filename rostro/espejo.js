// VØID_LOOM · ROSTRO — ESPEJO. La cabeza copia la cara del visitante y la lleva al extremo:
// si abre la boca, grita; si frunce el ceño, entra en furia; si sonríe, se ríe con toda la cara.
// Visión local con Human (la misma de OJO, modelos en ../ojo/models): solo cara y malla de 468 puntos.
// La imagen de la cámara no se proyecta ni se guarda; solo salen números (apertura, cejas, giro…).
import { CONTROLS, pose } from './rig.js';

const P = { lipU: 13, lipD: 14, mouthL: 61, mouthR: 291, eyeLt: 159, eyeLb: 145, eyeRt: 386, eyeRb: 374,
  browL: 105, browR: 334, browInL: 107, browInR: 336, nose: 1, noseBase: 2, lipTop: 0, chin: 152, top: 10, faceL: 234, faceR: 454 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function crearEspejo() {
  let human = null, video = null, stream = null, running = false, status = 'apagado', lastFace = 0, detMs = 0;
  const base = {}; let baseN = 0;           // cara neutra del visitante (se aprende sola)
  const sm = {};                             // rasgos suavizados
  const out = { presencia: 0, c: null, emo: {}, rasgos: {}, emocion: 'NINGUNA' };

  async function arrancar(deviceId, onStatus) {
    const say = (s) => { status = s; onStatus && onStatus(s); };
    if (!human) {
      say('cargando visión');
      const { Human } = await import(new URL('../ojo/vendor/human/human.esm.js', import.meta.url).href);
      human = new Human({
        modelBasePath: new URL('../ojo/models/', import.meta.url).href,
        backend: 'webgl', debug: false, warmup: 'none', cacheSensitivity: 0.6, filter: { enabled: false },
        face: { enabled: true, detector: { rotation: true, maxDetected: 1, minConfidence: 0.45, return: false }, mesh: { enabled: true }, iris: { enabled: false },
          emotion: { enabled: false }, description: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false }, attention: { enabled: false } },
        body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
      });
      await human.load();
    }
    say('abriendo cámara');
    stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, deviceId ? { deviceId: { exact: deviceId } } : {}), audio: false });
    video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream; await video.play();
    running = true; say('mirando'); bucle();
    return video;
  }
  function parar() { running = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; status = 'apagado'; out.presencia = 0; }
  async function bucle() {
    while (running) {
      const t0 = performance.now();
      if (video && video.readyState >= 2) { try { await human.detect(video); detMs = detMs * 0.9 + (performance.now() - t0) * 0.1; } catch (e) { /* sigue */ } }
      await new Promise(r => setTimeout(r, Math.max(4, 40 - (performance.now() - t0))));   // ~25 lecturas por segundo como mucho
    }
  }

  // rasgos de la cara normalizados por su tamaño (independientes de la distancia a la cámara)
  function rasgos(f) {
    const m = f.mesh; if (!m || m.length < 468) return null;
    const d = (a, b) => Math.hypot(m[a][0] - m[b][0], m[a][1] - m[b][1]);
    const H = d(P.top, P.chin) || 1, Wd = d(P.faceL, P.faceR) || 1;
    const midY = (m[P.lipU][1] + m[P.lipD][1]) / 2, cornY = (m[P.mouthL][1] + m[P.mouthR][1]) / 2;
    const rot = (f.rotation && f.rotation.angle) || {};
    return {
      boca: d(P.lipU, P.lipD) / H,
      ancho: d(P.mouthL, P.mouthR) / Wd,
      sonrisa: (midY - cornY) / H,                                   // comisuras por encima del centro = sonrisa
      cejas: ((m[P.eyeLt][1] - m[P.browL][1]) + (m[P.eyeRt][1] - m[P.browR][1])) / 2 / H,
      cenyo: d(P.browInL, P.browInR) / Wd,
      ojos: (d(P.eyeLt, P.eyeLb) + d(P.eyeRt, P.eyeRb)) / 2 / H,
      nariz: d(P.noseBase, P.lipTop) / H,                             // se acorta al arrugar la nariz (asco, rabia)
      yaw: rot.yaw || 0, pitch: rot.pitch || 0, roll: rot.roll || 0,
    };
  }

  // lee la última detección y devuelve el objetivo para el rostro (amplificado) y su peso
  function leer(dt, amp = 1) {
    const res = human && running ? human.next(human.result) : null;
    const f = res && res.face && res.face.find(x => (x.score || x.faceScore || 0) > 0.4);
    const now = performance.now();
    const R = f && rasgos(f);
    if (R) {
      lastFace = now;
      for (const k in R) sm[k] = sm[k] == null ? R[k] : sm[k] + (R[k] - sm[k]) * 0.45;
      // cara neutra: media lenta, que casi no aprende mientras hay expresión fuerte
      const tau = baseN < 40 ? 0.08 : 0.004; baseN++;
      for (const k in R) base[k] = base[k] == null ? R[k] : base[k] + (sm[k] - base[k]) * tau;
    }
    const pres = now - lastFace < 600 ? 1 : 0;
    out.presencia += (pres - out.presencia) * Math.min(1, dt * (pres ? 3 : 0.6));
    if (!sm.boca) { out.c = null; return out; }
    const dv = (k, s) => (sm[k] - base[k]) / s;
    const abre = clamp(dv('boca', 0.06), -0.2, 2.2), ancho = clamp(dv('ancho', 0.05), -1, 2), son = clamp(dv('sonrisa', 0.025), -2, 2);
    const ceja = clamp(dv('cejas', 0.025), -2, 2), cen = clamp(-dv('cenyo', 0.03), -1, 2), ojo = clamp(dv('ojos', 0.018), -2, 2), nar = clamp(-dv('nariz', 0.012), -1, 2);
    out.rasgos = { abre, ancho, son, ceja, cen, ojo, nar };
    // emociones que se leen en la cara (heurística sobre la malla, sin modelo de emociones)
    const e = {
      GRITO: clamp(abre - 1.1, 0, 1) * 1.2,
      SORPRESA: clamp(Math.min(ceja, abre + 0.3) - 0.2, 0, 1),
      MIEDO: clamp(Math.min(ceja, ojo + 0.5) - 0.3, 0, 1) * clamp(ancho + 0.6, 0, 1),
      FURIA: clamp(Math.max(cen, -ceja) - 0.35, 0, 1) * clamp(abre + nar + 0.4, 0, 1.3),
      RISA: clamp(son - 0.4, 0, 1) * clamp(ancho, 0.3, 1.2),
      TRISTEZA: clamp(-son - 0.4, 0, 1),
      ASCO: clamp(nar - 0.5, 0, 1),
    };
    let top = 'NINGUNA', tv = 0.25; for (const [k, v] of Object.entries(e)) if (v > tv) { tv = v; top = k; }
    out.emocion = top; out.emo = e;
    // espejo directo, amplificado: lo que hace el visitante, la cabeza lo hace el doble de grande
    const A = 1.8 * amp;
    const c = Object.fromEntries(CONTROLS.map(k => [k, 0])), pos = (x) => Math.max(0, x);
    const both = (k, val) => { c[k + '_L'] = val; c[k + '_R'] = val; };
    c.jawOpen = clamp(pos(abre) * 0.42 * A, 0, 1.3);
    both('mouthStretch', clamp(pos(ancho) * 0.45 * A * (son > 0.3 ? 0.3 : 1), 0, 1.3));
    both('mouthSmile', clamp(pos(son) * 0.5 * A, 0, 1.4)); both('cheekSquint', clamp(pos(son) * 0.4 * A, 0, 1.2)); both('cheekRaiser', clamp(pos(son) * 0.35 * A, 0, 1.2));
    both('mouthFrown', clamp(pos(-son) * 0.55 * A, 0, 1.3));
    both('browInnerUp', clamp(pos(ceja) * 0.55 * A + pos(-son) * 0.2 * A, 0, 1.3)); both('browOuterUp', clamp(pos(ceja) * 0.5 * A, 0, 1.3));
    both('browDown', clamp(pos(Math.max(cen, -ceja)) * 0.5 * A, 0, 1.3));
    both('eyeWide', clamp(pos(ojo) * 0.5 * A, 0, 1.3)); both('eyeSquint', clamp(pos(-ojo) * 0.45 * A + pos(son) * 0.25 * A, 0, 1.3));
    if (ojo < -1.4) both('eyeBlink', clamp((-ojo - 1.4) * 1.5, 0, 1));
    both('noseSneer', clamp(pos(nar) * 0.55 * A, 0, 1.4)); both('mouthUpperUp', clamp(pos(nar) * 0.4 * A, 0, 1.3));
    // el giro, como en un espejo (yaw y roll invertidos)
    c.yaw = clamp(-sm.yaw * 1.4, -0.7, 0.7); c.pitch = clamp(sm.pitch * 1.3, -0.5, 0.5); c.roll = clamp(-sm.roll * 1.4, -0.5, 0.5);
    // y encima, la emoción que se reconoce, empujada a su extremo
    if (top !== 'NINGUNA') { const p = pose(top, 1.1); const w = clamp(tv, 0, 1) * 0.6; for (const k of CONTROLS) c[k] = c[k] * (1 - w * 0.5) + p[k] * w; }
    out.c = c;
    return out;
  }

  return { arrancar, parar, leer, get estado() { return status; }, get ms() { return detMs; }, get video() { return video; },
    async camaras() { try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch { return []; } } };
}
