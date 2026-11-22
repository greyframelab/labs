// VØID_LOOM · ROSTRO — partitura. Una semilla = una pieza: tempo, estilo de sonido, acento,
// arco emocional, planos y cada golpe. Imagen y sonido leen los mismos eventos.
// En AUTOMÁTICO · CONTINUO, la pieza es un paso sin cortes a negro por todas las expresiones.
import { EMOCIONES, LUZ, CONTROLS, pose } from './rig.js';

export const ACENTOS = ['#FF1A1A', '#00E5FF', '#FFB000', '#39FF6A', '#8A2BFF', '#FF2BD6', '#E8E6FF'];
export const ESTILOS = {
  GOLPE:   { bpm: [92, 104], idea: 'dinámica extrema, golpes esculpidos, silencios con peso' },
  PULSO:   { bpm: [118, 126], idea: 'bombo a negras inamovible, grave físico, tensión por densidad' },
  QUIEBRE: { bpm: [100, 112], idea: 'breaks programados, cortes rápidos, el bombo se parte' },
};
const TENSION = ['MIEDO', 'SORPRESA', 'TRISTEZA', 'DESPRECIO', 'ASCO', 'SOSPECHA', 'VERGÜENZA', 'CONFUSIÓN', 'NÁUSEA', 'ARROGANCIA', 'SÚPLICA', 'CURIOSIDAD'];
const RUPTURA = ['FURIA', 'GRITO', 'PÁNICO', 'RISA', 'DOLOR', 'MIEDO', 'HORROR', 'ODIO', 'LOCURA', 'AGONÍA', 'ÉXTASIS', 'DESESPERACIÓN', 'BURLA', 'LLANTO', 'EUFORIA'];
const ECO = ['ANGUSTIA', 'TRISTEZA', 'REPOSO', 'AGOTAMIENTO', 'VÉRTIGO', 'SERENIDAD', 'ALIVIO', 'MARAVILLA'];
const PLANOS_T = ['medio', 'macro', 'ojo', 'perfil', 'lejos'];
const PLANOS_R = ['contra', 'boca', 'macro', 'ojo', 'medio', 'perfil'];

export function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let s = h >>> 0;
  const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.range = (a, b) => a + (b - a) * r();
  return r;
}
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const nuevoCodigo = () => Array.from({ length: 6 }, () => ALFA[Math.floor(Math.random() * ALFA.length)]).join('');

// plantillas de compás (16 pasos): se repiten y rotan; el azar solo toca velocidad y microtiming
const KICKS = {
  GOLPE:   [{ 0: 1, 7: .55, 8: .9, 11: .45, 14: .7 }, { 0: 1, 3: .7, 6: .85, 8: 1, 10: .6, 13: .9 }],
  PULSO:   [{ 0: 1, 4: .95, 8: 1, 12: .95 }, { 0: 1, 4: 1, 8: 1, 12: 1, 14: .4, 15: .5 }],
  QUIEBRE: [{ 0: 1, 3: .6, 10: .85, 11: .4 }, { 0: 1, 2: .5, 3: .8, 6: .9, 9: .6, 10: 1, 13: .7, 15: .5 }],
};

export function crearPieza(code, opts = {}) {
  if (opts.continuo) return crearContinuo(code, opts);
  const r = rng(code);
  const estilo = opts.estilo || r.pick(Object.keys(ESTILOS));
  const bpm = Math.round(r.range(...ESTILOS[estilo].bpm));
  const STEP = 60 / bpm / 4, BAR = STEP * 16;
  let acc = opts.acc || r.pick(ACENTOS); if (opts.evitar && acc === opts.evitar && !opts.acc) acc = ACENTOS[(ACENTOS.indexOf(acc) + 1 + Math.floor(r() * 5)) % ACENTOS.length];
  const root = 33 + Math.floor(r() * 7); // La1–Mi♭2: el bajo lleva armónicos para el móvil
  const eT = opts.emo || r.pick(TENSION);
  let eR1 = opts.emo || r.pick(RUPTURA.filter(e => e !== eT)), eR2 = opts.emo || r.pick(RUPTURA.filter(e => e !== eR1));
  const eE = opts.emo ? opts.emo : r.pick(ECO);
  const nT = 5 + Math.floor(r() * 3), nR = 4 + Math.floor(r() * 3), nE = 3;
  const bS = 0, bT = 2, bR = bT + nT, bE = bR + nR, NB = bE + nE, DUR = NB * BAR;
  const ev = [];
  const E = (t, k, v = 1, x = {}) => ev.push(Object.assign({ t: Math.max(0, t + (k === 'kick' || k === 'impact' ? 0 : (r() - 0.5) * 0.006)), k, v: +(v * (0.92 + r() * 0.16)).toFixed(3) }, x));
  const rot = (K, n) => Object.fromEntries(Object.entries(K).map(([s, v]) => [s === '0' ? 0 : (+s + n) % 16, v]));

  for (let b = 0; b < NB; b++) {
    const t0 = b * BAR, inT = b >= bT && b < bR, inR = b >= bR && b < bE, lastT = b === bR - 1;
    if (b < bT) { if (b === 1) E(t0 + 8 * STEP, 'creak', 0.4); continue; }
    if (inT || inR) {
      const K = inR ? KICKS[estilo][1] : rot(KICKS[estilo][0], ((b - bT) % 4 === 3) ? 3 : 0);
      for (const [s, v] of Object.entries(K)) E(t0 + s * STEP, 'kick', v * (inT ? 0.72 + 0.25 * (b - bT) / nT : 1));
      for (const s of [4, 12]) E(t0 + s * STEP, 'metal', inR ? 0.9 : 0.55);
      for (const s of (inR ? [2, 5, 9, 15] : [5, 13])) if (r() < (inR ? 0.85 : 0.6)) E(t0 + s * STEP, 'creak', inR ? 0.85 : 0.6);
      if (estilo === 'QUIEBRE' && r() < 0.5) for (let i = 0; i < 4; i++) E(t0 + 12 * STEP + i * STEP / 2, 'glitch', 0.6);
      if (inR) { for (const s of [0, 8]) E(t0 + s * STEP, 'sweep', 1, { dir: r() < 0.5 ? -1 : 1 }); }
      if (inR && (b - bR) % 2 === 1) for (let i = 0; i < 6; i++) E(t0 + 14 * STEP + i * STEP / 4, 'kick', 0.5 + 0.08 * i, { ratchet: 1 });
      // bajo: dos notas por compás; en la ruptura sube un semitono a la mitad (tensión)
      E(t0, 'bass', 0.9, { midi: root, dur: STEP * 6 });
      E(t0 + 8 * STEP, 'bass', 0.85, { midi: inR ? root + 1 : root, dur: STEP * 6 });
    }
    if (lastT) { // el pulso se acelera hacia el impacto (transición continua, sin silencio en seco)
      for (let i = 0; i < 8; i++) E(t0 + 15 * STEP + i * STEP / 8, 'kick', 0.35 + 0.08 * i, { ratchet: 1 });
    }
    if (b === bE) { E(t0, 'kick', 0.9); E(t0, 'metal', 0.5); }
  }
  E(bR * BAR, 'impact', 1);
  ev.sort((a, b) => a.t - b.t);

  const emotions = [[0, 'REPOSO', 0], [bT * BAR, eT, 0.15], [bR * BAR - 0.05, eT, 1], [bR * BAR, eR1, 1.15]];
  const half = bR + Math.ceil(nR / 2);
  emotions.push([half * BAR - 0.05, eR1, 1.1], [half * BAR, eR2, 1.1], [bE * BAR - 0.05, eR2, 1.05], [bE * BAR + 0.7, eE, 0.9], [DUR, eE, 1]);

  const shots = [[0, r.pick(['medio', 'lejos'])]]; let last = shots[0][1];
  const cut = (t, pool) => { let s = r.pick(pool); if (s === last) s = pool[(pool.indexOf(s) + 1) % pool.length]; shots.push([t, s]); last = s; };
  for (let b = bT; b < bR; b += 2) cut(b * BAR, PLANOS_T);
  shots.push([bR * BAR, r() < 0.5 ? 'contra' : 'boca']); last = shots[shots.length - 1][1];
  for (let b = bR + 1; b < bE; b++) cut(b * BAR, PLANOS_R);
  shots.push([bE * BAR, 'lejos']);

  return {
    code, estilo, bpm, acc, root, STEP, BAR, dur: DUR, events: ev, emotions, shots,
    acts: [[0, 'SEÑAL'], [bT * BAR, 'TENSIÓN'], [bR * BAR, 'RUPTURA'], [bE * BAR, 'ECO']],
    arco: [eT, eR1, eR2, eE],
  };
}

// acento en un instante (en el continuo cambia con cada expresión)
export function accAt(P, t) {
  if (!P.accs) return P.acc;
  let a = P.accs[0][1]; for (const [ta, h] of P.accs) { if (t >= ta) a = h; else break; } return a;
}

// ---------------------------------------------------------------- CONTINUO
// Un paso por TODAS las expresiones, sin parar: cada una dura dos compases (las calmas algo más) y cada
// cambio es un golpe plástico (la materia se estira, se retuerce y rebota) con corte de plano, giro de luz y
// cambio de acento. El orden busca el contraste máximo: de la expresión actual salta a la más lejana de unas
// pocas candidatas, alternando oscuridad y luz. Cada cierto tiempo, una RÁFAGA: cuatro o cinco caras a medio
// compás cada una. Al acabar, empieza otro paso con otro orden, sin hueco.
const EXTREMAS = new Set(['FURIA', 'GRITO', 'PÁNICO', 'HORROR', 'ODIO', 'LOCURA', 'AGONÍA', 'DESESPERACIÓN', 'DOLOR', 'MIEDO', 'LLANTO', 'RISA', 'EUFORIA', 'ÉXTASIS', 'BURLA', 'ASCO', 'NÁUSEA']);
const CALMAS = new Set(['SERENIDAD', 'TERNURA', 'AMOR', 'ALIVIO', 'ESPERANZA', 'GRATITUD', 'SATISFACCIÓN', 'INSPIRACIÓN', 'AGOTAMIENTO', 'TRISTEZA', 'VERGÜENZA', 'ORGULLO', 'ANGUSTIA']);
const familia = (e) => EXTREMAS.has(e) ? 'X' : CALMAS.has(e) ? 'C' : 'T';
const ACC_FAM = { X: ['#FF1A1A', '#8A2BFF', '#FF2BD6'], T: ['#00E5FF', '#39FF6A', '#8A2BFF'], C: ['#E8E6FF', '#00E5FF'], LX: ['#FFB000', '#FF2BD6'], LC: ['#FFB000', '#E8E6FF'] };
const PLANOS_FAM = { X: ['boca', 'macro', 'contra', 'ojo'], T: ['medio', 'perfil', 'macro', 'ojo'], C: ['medio', 'lejos', 'perfil'], R: ['macro', 'boca', 'ojo', 'contra', 'perfil'] };
const POSES = {};
function distancia(a, b) {
  const A = POSES[a] || (POSES[a] = pose(a)), B = POSES[b] || (POSES[b] = pose(b)); let s = 0;
  for (const k of CONTROLS) { const d = (A[k] || 0) - (B[k] || 0); s += d * d; } return Math.sqrt(s);
}

export function crearContinuo(code, opts = {}) {
  const r = rng(code + '·continuo');
  const estilo = opts.estilo || r.pick(Object.keys(ESTILOS));
  const bpm = Math.round(r.range(...ESTILOS[estilo].bpm));
  const STEP = 60 / bpm / 4, BAR = STEP * 16, HALF = BAR / 2;
  const root = 33 + Math.floor(r() * 7);
  // orden de contraste máximo
  const todas = Object.keys(EMOCIONES).filter(e => e !== 'REPOSO');
  const rest = todas.slice(); let cur = opts.desde && rest.includes(opts.desde) ? r.pick(rest.filter(e => e !== opts.desde)) : r.pick(rest);
  const orden = [cur]; rest.splice(rest.indexOf(cur), 1);
  while (rest.length) {
    const cand = []; const pool = rest.slice(); for (let i = 0; i < Math.min(6, pool.length); i++) cand.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    let best = cand[0], bv = -1;
    for (const c of cand) { const v = distancia(cur, c) + (LUZ.includes(c) !== LUZ.includes(cur) ? 0.8 : 0) + (familia(c) !== familia(cur) ? 0.4 : 0) + r() * 0.3; if (v > bv) { bv = v; best = c; } }
    orden.push(best); rest.splice(rest.indexOf(best), 1); cur = best;
  }
  // duraciones (en medios compases) y ráfagas
  const segs = []; let t = 0, sinRafaga = 0, rafaga = 0;
  orden.forEach((emo, i) => {
    let u;
    if (rafaga > 0) { u = 1; rafaga--; }
    else {
      sinRafaga++;
      if (i > 3 && sinRafaga >= 9 + Math.floor(r() * 3) && orden.length - i > 6) { rafaga = 3 + Math.floor(r() * 2); sinRafaga = 0; u = 1; }
      else u = familia(emo) === 'C' ? 5 : familia(emo) === 'X' ? 4 : (r() < 0.3 ? 3 : 4);
    }
    segs.push({ emo, t0: t, t1: t + u * HALF, fam: familia(emo), luz: LUZ.includes(emo), rafaga: u === 1 }); t += u * HALF;
  });
  const DUR = t, NB = Math.ceil(DUR / BAR);
  const segAt = (tt) => { for (let i = segs.length - 1; i >= 0; i--) if (tt >= segs[i].t0 - 1e-6) return segs[i]; return segs[0]; };

  // emociones: cada una se intensifica durante su tramo y salta de golpe a la siguiente
  const emotions = [];
  for (const s of segs) {
    const m = s.fam === 'X' ? 1.25 : s.fam === 'C' ? 1.0 : 1.12;
    emotions.push([s.t0, s.emo, m * 0.92], [Math.max(s.t0 + 0.05, s.t1 - 0.14), s.emo, m * 1.08]);
  }
  emotions.push([DUR + 5, segs[segs.length - 1].emo, 1]);
  // actos, acentos y planos por tramo
  const acts = [], accs = [], shots = []; let lastAcc = opts.evitar || '', lastShot = '';
  segs.forEach((s, i) => {
    const act = s.fam === 'X' ? 'RUPTURA' : s.fam === 'C' ? 'ECO' : 'TENSIÓN';
    if (!acts.length || acts[acts.length - 1][1] !== act) acts.push([s.t0, act]);
    const pal = s.luz ? (s.fam === 'C' ? ACC_FAM.LC : ACC_FAM.LX) : ACC_FAM[s.fam];
    let ac = r.pick(pal); if (ac === lastAcc) ac = pal[(pal.indexOf(ac) + 1) % pal.length]; if (opts.acc) ac = opts.acc;
    accs.push([s.t0, ac]); lastAcc = ac;
    const pp = s.rafaga ? PLANOS_FAM.R : PLANOS_FAM[s.fam];
    let sh = r.pick(pp); if (sh === lastShot) sh = pp[(pp.indexOf(sh) + 1) % pp.length];
    shots.push([s.t0, sh]); lastShot = sh;
  });

  // golpes sobre una rejilla global de compases: la energía la marca la familia de la expresión que suena
  const ev = [], hit = new Set();
  const E = (tt, k, v = 1, x = {}) => ev.push(Object.assign({ t: Math.max(0, tt + (k === 'kick' || k === 'impact' || k === 'morph' ? 0 : (r() - 0.5) * 0.006)), k, v: +(v * (0.92 + r() * 0.16)).toFixed(3) }, x));
  segs.forEach((s, i) => {
    const v = s.rafaga ? 0.65 : s.fam === 'X' ? 1 : s.fam === 'T' ? 0.8 : 0.55;
    if (s.t0 >= 0.55) E(s.t0 - 0.55, 'swell', v, { dur: 0.55 });
    if (s.fam === 'X' && !s.rafaga && i % 4 === 0) E(s.t0, 'impact', 1); else E(s.t0, 'morph', v);
    E(s.t0, 'kick', Math.min(1, v + 0.2)); hit.add(Math.round(s.t0 / STEP));
    E(s.t0, 'sweep', 1, { dir: i % 2 ? 1 : -1 });
  });
  E(DUR - 0.55, 'swell', 0.9, { dur: 0.55 }); // hacia el primer golpe del paso siguiente
  for (let b = 0; b < NB; b++) {
    const t0 = b * BAR;
    for (let st = 0; st < 16; st++) {
      const tt = t0 + st * STEP; if (tt >= DUR - 1e-6) break;
      const s = segAt(tt), fam = s.fam, gi = Math.round(tt / STEP);
      const K = fam === 'X' ? KICKS[estilo][1] : fam === 'T' ? KICKS[estilo][0] : { 0: 0.6, 8: 0.45 };
      if (K[st] != null && !hit.has(gi)) E(tt, 'kick', K[st] * (fam === 'T' ? 0.85 : 1));
      if (fam !== 'C' && (st === 4 || st === 12)) E(tt, 'metal', fam === 'X' ? 0.9 : 0.55);
      const cr = fam === 'X' ? [2, 5, 9, 15] : fam === 'T' ? [5, 13] : [13];
      if (cr.includes(st) && r() < (fam === 'X' ? 0.85 : fam === 'T' ? 0.6 : 0.3)) E(tt, 'creak', fam === 'X' ? 0.85 : 0.6);
      if (st === 0 || st === 8) E(tt, 'bass', fam === 'C' ? 0.7 : 0.9, { midi: root + (st === 8 ? (s.luz ? 7 : fam === 'X' ? 1 : 0) : 0), dur: STEP * 6 });
    }
    if (estilo === 'QUIEBRE' && segAt(t0).fam === 'X' && r() < 0.5) for (let i = 0; i < 4; i++) E(t0 + 12 * STEP + i * STEP / 2, 'glitch', 0.6);
    if (segAt(t0).fam === 'X' && b % 2 === 1) for (let i = 0; i < 6; i++) E(t0 + 14 * STEP + i * STEP / 4, 'kick', 0.5 + 0.08 * i, { ratchet: 1 });
  }
  ev.sort((a, b) => a.t - b.t);

  return {
    code, estilo, bpm, root, STEP, BAR, dur: DUR, events: ev.filter(e => e.t < DUR), emotions, shots, acts, accs, acc: accs[0][1],
    continuo: true, primera: !!opts.primera, segs, orden,
    arco: ['PASO CONTINUO', `${orden.length} EXPRESIONES`, estilo, 'continuo'],
  };
}
