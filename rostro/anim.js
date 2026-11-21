// VØID_LOOM · ROSTRO — animador. La partitura manda: cada evento de sonido es un gesto de la cabeza.
//  bombo   → espasmo (mandíbula, empuje, cabeceo) con un muelle poco amortiguado: rebota, brutal
//  chapa   → algo empuja bajo la piel
//  crujido → tirón seco tipo stop-motion: salta a otra torsión y vuelve
//  glitch  → micro-saltos encadenados
//  bajo    → el cráneo se estira con la nota
//  barrido → una luz recorre la cara
//  impacto → RUPTURA: la emoción salta al extremo
import { CONTROLS, pose } from './rig.js';

const LIM = { jaw: [-0.15, 1.55], skull: [-0.6, 1.15], pitch: [-0.6, 0.6], thrust: [-0.9, 0.9], eyes: [-1, 1.1], mouthWide: [-0.3, 1.3], twist: [-0.8, 0.8], melt: [0, 1], cheeks: [-0.7, 0.7], tremor: [0, 1.2], shake: [0, 1.2] };
const lerpPose = (a, b, u) => { const o = {}; for (const k of CONTROLS) o[k] = a[k] + (b[k] - a[k]) * u; return o; };
const sm = u => u * u * (3 - 2 * u);
const BASE_RIM = { 'SEÑAL': 0.35, 'TENSIÓN': 0.75, 'RUPTURA': 1.1, 'ECO': 0.6 };

export function crearAnimador(P, seed = 1, intensidad = 1) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ev = P.events; let ei = 0;
  const tImp = (ev.find(e => e.k === 'impact') || { t: 1e9 }).t;
  const x = {}, v = {}, off = {}; for (const k of CONTROLS) { x[k] = 0; v[k] = 0; off[k] = 0; }
  const bumps = []; let rimPulse = 0, bassEnv = 0, t = 0, sweep = 0, swx = 0, swDir = 1, lastHit = { k: '', t: -9 };
  const K = 150, D = 2 * 0.36 * Math.sqrt(K);
  const poseCache = new Map(); const P_ = (e, m) => { const k = e + m; if (!poseCache.has(k)) poseCache.set(k, pose(e, m)); return poseCache.get(k); };

  function emoAt(time) {
    const E = P.emotions; let i = 0; while (i < E.length - 2 && E[i + 1][0] <= time) i++;
    const [t0, e0, m0] = E[i], [t1, e1, m1] = E[i + 1];
    const u = t1 > t0 ? sm(Math.min(1, Math.max(0, (time - t0) / (t1 - t0)))) : 1;
    return { e0, m0, e1, m1, u };
  }
  const act = time => { let a = P.acts[0][1]; for (const [ta, n] of P.acts) if (time >= ta) a = n; return a; };

  function disparar(e) {
    const vel = e.v * intensidad, sign = rnd() < 0.5 ? -1 : 1, rupt = act(e.t) === 'RUPTURA';
    lastHit = { k: e.k, t: e.t };
    if (e.k === 'kick') {
      const g = e.ratchet ? 0.35 : 1, R = rupt ? 1.3 : 1;
      v.jaw += 6 * vel * g * R; v.thrust += 2.6 * vel * g * R; v.pitch += sign * 1.1 * vel * g;
      v.skull += 1.4 * vel * g * (rupt ? 1 : 0.4); v.cheeks -= 1.5 * vel * g;
      rimPulse = Math.max(rimPulse, 0.45 * vel * g);
    } else if (e.k === 'metal') {
      const ang = (rnd() - 0.5) * 2.4, y = 0.1 + rnd() * 2.9;
      bumps.push({ x: Math.sin(ang) * 2.1, y, z: Math.cos(ang) * 2.0, r: 0.3 + rnd() * 0.32, a0: (0.22 + rnd() * 0.18) * vel * (rupt ? 1.5 : 1), t0: e.t });
    } else if (e.k === 'creak' || e.k === 'glitch') {
      const pool = ['twist', 'roll', 'yaw', 'asym', 'pitch'];
      const k = pool[Math.floor(rnd() * pool.length)];
      off[k] += sign * (k === 'asym' ? 0.8 : 0.22) * vel * (rupt ? 1.4 : 1) * (e.k === 'glitch' ? 0.6 : 1);
    } else if (e.k === 'bass') bassEnv = Math.max(bassEnv, vel);
    else if (e.k === 'sweep') { sweep = 1; swDir = e.dir || 1; swx = -swDir; }
    else if (e.k === 'impact') {
      v.jaw += 7; v.skull += 3; v.pitch -= 3; v.thrust -= 4; v.eyes += 4; v.mouthWide += 4; rimPulse = 1; sweep = 1; swx = -1; swDir = 1;
      for (let i = 0; i < 3; i++) { const ang = (rnd() - 0.5) * 2; bumps.push({ x: Math.sin(ang) * 2, y: 0.4 + rnd() * 2.4, z: Math.cos(ang) * 2, r: 0.5, a0: 0.45, t0: e.t }); }
    }
  }

  // ESPEJO: un objetivo externo (la cara del visitante) que se mezcla con el arco de la pieza
  let ext = null, extW = 0, extEmo = null;
  function externo(c, w, emo) { ext = c; extW = c ? Math.max(0, Math.min(1, w)) : 0; extEmo = emo || null; }
  let prevSum = 0, speed = 0;
  // avanza la simulación hasta 'time' (segundos de la pieza) en pasos fijos: determinista
  function avanzar(time, onEvent) {
    const dt = 1 / 240; let steps = 0;
    if (time - t > 2) t = time - 2; // tras un parón, no recalcula una eternidad
    while (t < time) {
      while (ei < ev.length && ev[ei].t <= t) { const e = ev[ei++]; disparar(e); if (onEvent) onEvent(e); }
      const m = emoAt(t); let tg = lerpPose(P_(m.e0, m.m0), P_(m.e1, m.m1), m.u);
      if (ext && extW > 0) tg = lerpPose(tg, ext, extW);
      tg.jaw += 0.04 * Math.sin(t * 1.4); tg.pitch += 0.015 * Math.sin(t * 0.9); // respira
      tg.skull += 0.35 * bassEnv;
      for (const k of CONTROLS) {
        const a = K * (tg[k] + off[k] - x[k]) - D * v[k];
        v[k] += a * dt; x[k] += v[k] * dt; off[k] *= Math.exp(-dt / 0.09);
      }
      bassEnv *= Math.exp(-dt / 0.35); rimPulse *= Math.exp(-dt / 0.14);
      sweep *= Math.exp(-dt / 0.5); swx += swDir * dt * 2.6;
      t += dt; steps++;
    }
    for (let i = bumps.length - 1; i >= 0; i--) if (time - bumps[i].t0 > 0.9) bumps.splice(i, 1);
    const live = bumps.map(b => { const age = time - b.t0; return { x: b.x, y: b.y, z: b.z, r: b.r, a: b.a0 * Math.exp(-age / 0.16) * Math.min(1, Math.max(0, age) / 0.02) }; });
    // límites suaves: extremo, pero la cara se sigue leyendo
    const c = {}; let sum = 0;
    for (const k of CONTROLS) { const [lo, hi] = LIM[k] || [-1.4, 1.4]; const mid = (hi + lo) / 2, h = (hi - lo) / 2; c[k] = mid + h * Math.tanh((x[k] - mid) / h); sum += Math.abs(c[k]); }
    // risa: la mandíbula tiembla a 7 Hz
    c.jaw += c.shake * 0.28 * Math.max(0, Math.sin(time * 2 * Math.PI * 7)); c.tremor = Math.max(0, c.tremor);
    const dtF = Math.max(1e-3, steps / 240); speed += (Math.min(6, Math.abs(sum - prevSum) / dtF) - speed) * 0.3; prevSum = sum;
    const m = emoAt(time), emo = {}; emo[m.e0] = (emo[m.e0] || 0) + m.m0 * (1 - m.u); emo[m.e1] = (emo[m.e1] || 0) + m.m1 * m.u;
    if (extEmo && extW > 0) { for (const k in emo) emo[k] *= 1 - extW; for (const [k, v] of Object.entries(extEmo)) emo[k] = (emo[k] || 0) + v * extW; }
    const a = act(time);
    const preImpacto = time < tImp ? Math.min(1, Math.max(0, (time - (tImp - P.BAR)) / P.BAR)) : 0;
    return { preImpacto, c, bumps: live, rim: BASE_RIM[a] + rimPulse * 0.9, sweep, swx: Math.max(-1, Math.min(1, swx)), act: a, emo, speed, lastHit };
  }

  function plano(time) {
    let cur = P.shots[0]; for (const sh of P.shots) if (time >= sh[0]) cur = sh;
    return { name: cur[1], since: time - cur[0], at: cur[0] };
  }
  return { avanzar, plano, externo };
}
