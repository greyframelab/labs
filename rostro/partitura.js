// VØID_LOOM · ROSTRO — partitura. Una semilla = una pieza: tempo, estilo de sonido, acento,
// arco emocional, planos y cada golpe. Imagen y sonido leen los mismos eventos.

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
