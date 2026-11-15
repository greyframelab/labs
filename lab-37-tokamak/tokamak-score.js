/* VØID_LOOM — Lab 37 · Tokamak · PARTITURA ÚNICA (música: «CONFINAMIENTO», void-loom-music).
   Un sol encerrado en una jaula magnética. IDM a 90 bpm en Do# menor con polimetría 5 · 7 contra el compás de 16.
   Cada voz deforma el plasma a su manera:
   K bombo → pinzamiento: el anillo se estrecha y se enciende · S caja → torcedura (kink) helicoidal que recorre el anillo
   h hats → micro-filamentos en la superficie · E ELM (ciclo de 5) → el borde escupe un filamento que golpea las baldosas
   M bobinas (ciclo de 7) → las bobinas de campo laten · B bajo → respiración del radio y diente de sierra del núcleo
   G fantasma → temblor del borde · V crecida al revés → la luz crece hacia el golpe · X stutter → el plasma repite su instante
   R disrupción: el confinamiento se pierde; el plasma toca la pared y un haz de electrones desbocados la quema en magenta.
   Actos: ENCENDIDO 0–5,33 (loop) · CONFINAMIENTO 5,33–16 · SILENCIO 16–16,67 · DISRUPCIÓN 16,67–24,67 (loop de 2 compases) · FIRMA. */
(function (root) {
  const BPM = 90, q = 60 / BPM, st = q / 4, BAR = 4 * q;
  const T = { bpm: BPM, q, st, bar: BAR, engrane: 2 * BAR, cut: 6 * BAR, align: 6 * BAR + 4 * st };
  T.confin = T.engrane; T.disr = T.align; T.sting = T.align + 3 * BAR;
  const H = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const euclid = (k, n, rot) => Array.from({ length: n }, (_, i) => ((((i + rot) % n + n) % n) * k) % n < k);
  const ev = [], X = [];
  const push = (v, t, s, x) => ev.push(Object.assign({ v, t, s }, x || {}));
  const sw = (i) => (i % 2 ? 0.016 : 0) + (i % 4 === 3 ? -0.005 : 0);   // swing irregular

  // ---- ENCENDIDO (2 compases que repiten perfecto)
  const KG = [[0, 7, 10], [0, 3, 6, 10, 14]];
  for (let g = 0; g < 32; g++) {
    const bar = g >> 4, i = g & 15, t = bar * BAR + i * st + sw(i);
    if (KG[bar].includes(i)) push('K', t, i === 0 ? 1 : 0.6 + 0.25 * H(bar, i), { seed: g });
    if (g % 5 === 2) push('E', t + 0.006, 0.5 + 0.3 * H(5, g), { seed: 100 + g, ang: H(6, g) });
    if (g % 7 === 4) push('M', t + 0.011, 0.6, { seed: 200 + g });
    if (i === 0) push('B', t + 0.002, 0.55, { note: 0 });
    if (!KG[bar].includes(i) && g % 5 !== 2 && H(31, g) > 0.62) push('G', t + 0.009, 0.18 + 0.2 * H(32, g), { seed: 400 + g, ang: H(33, g) });
  }
  X.push({ t: BAR + 14 * st, len: 2 * st, div: st / 2 });

  // ---- CONFINAMIENTO (4 compases): las inestabilidades crecen; los ciclos cuentan hacia atrás desde la disrupción
  const gA = 68;
  for (let g = 0; g < 64; g++) {
    const bar = g >> 4, i = g & 15, t = T.engrane + bar * BAR + i * st + sw(i), ten = g / 64;
    const K = euclid([5, 5, 6, 7][bar], 16, [0, 2, 5, 1][bar]); K[0] = true;
    if (K[i]) push('K', t, i === 0 ? 1 : 0.58 + 0.3 * H(10 + bar, i), { seed: 1000 + g });
    const e5 = (gA - g) % 5 === 0, m7 = (gA - g) % 7 === 0;
    if (e5) push('E', t + 0.006, 0.6 + 0.35 * ten, { seed: 1100 + g, ang: H(11, g), co: m7 ? 1 : 0 });
    if (m7) push('M', t + 0.011, 0.7 + 0.25 * ten, { seed: 1200 + g, co: e5 ? 1 : 0 });
    if (i === 0) push('B', t + 0.002, 0.6 + 0.4 * ten, { shape: 1, note: [0, 2, 0, 6][bar] });
    if (!K[i] && !e5 && !m7 && H(41, g) > 0.55 - 0.25 * ten) push('G', t + 0.009, 0.16 + 0.3 * ten * H(42, g), { seed: 1500 + g, ang: H(43, g) });
    if (bar % 2 === 1 && i === 14) X.push({ t, len: 2 * st, div: bar === 3 ? st / 3 : st / 2 });
  }
  for (const [tE, len] of [[T.engrane + BAR, q], [T.engrane + 3 * BAR, q], [T.cut, 2 * q]]) push('V', tE - len, 0.8, { len, end: tE });

  // ---- SILENCIO · DISRUPCIÓN (3 compases; 2 y 3 iguales para el loop)
  push('R', T.align, 1);
  for (let b = 0; b < 3; b++) {
    const t0 = T.align + b * BAR;
    const KS = b === 0 ? [8, 12] : [0, 6, 10, 13];
    for (const i of KS) push('K', t0 + i * st + sw(i), i === 0 ? 1 : 0.8, { big: 1, post: 1, seed: 2000 + i });
    for (let i = 0; i < 16; i++) {
      const g = (b === 0 ? 0 : (b - 1) * 16) + i;
      if (b > 0 && g % 5 === 2) push('E', t0 + i * st + 0.006, 0.45, { seed: 2100 + g, lock: 1, ang: H(21, g) });
      if (b > 0 && g % 7 === 3) push('M', t0 + i * st + 0.011, 0.55, { seed: 2200 + g, lock: 1 });
    }
    push('B', t0 + 0.002, 1, { swell: 1, note: 0 });
  }

  // ---- hats (h) y caja (S)
  const SN = { g: [[4, 12], [4, 12, 13]], e: [[4, 12], [4, 9, 12], [4, 12, 15], [2, 4, 12, 14]], a: [4, 12] };
  const hatBar = (t0, key, dens, b, acc) => {
    const A = euclid(acc, 16, b);
    for (let i = 0; i < 16; i++) {
      if (H(key, i) < dens) push('h', t0 + i * st + sw(i) + 0.003, (A[i] ? 0.75 : 0.35) * (0.7 + 0.3 * H(key + 1, i)), { seed: key * 16 + i, open: A[i] && i % 8 === 6 ? 1 : 0, ang: H(key + 3, i) });
      if (H(key + 2, i) > 0.9) for (let k = 1; k < 3; k++) push('h', t0 + i * st + sw(i) + 0.003 + k * st / 2, 0.25, { seed: key * 16 + i + 500 + k, ang: H(key + 4, i + k) });
    }
  };
  for (let b = 0; b < 2; b++) { const t0 = b * BAR; for (const i of SN.g[b]) push('S', t0 + i * st + sw(i) + 0.004, i === 13 ? 0.45 : 0.9, { seed: 3000 + b * 16 + i }); hatBar(t0, 40 + b, 0.55, b, 5); }
  for (let b = 0; b < 4; b++) { const t0 = T.engrane + b * BAR; for (const i of SN.e[b]) push('S', t0 + i * st + sw(i) + 0.004, [9, 15, 2, 14].includes(i) ? 0.5 : 0.95, { seed: 3100 + b * 16 + i }); hatBar(t0, 60 + b, 0.6 + 0.1 * b, b, 5 + b); }
  for (let k = 0; k < 6; k++) push('S', T.engrane + 3 * BAR + 14 * st + k * st / 3, 0.3 + 0.1 * k, { seed: 3300 + k, roll: 1 });
  for (let b = 1; b < 3; b++) { const t0 = T.align + b * BAR; for (const i of SN.a) push('S', t0 + i * st + sw(i) + 0.004, 1, { seed: 3400 + i }); hatBar(t0, 80, 0.6, 0, 5); }

  // ---- ECO compartido: ping-pong a tempo; cada repetición también es un eco visual
  const DL = [[0, 3 * st, 0.38], [T.engrane, 3 * st, 0.45], [T.cut, 3 * st, 0], [T.align, 4 * st, 0.5]];
  const SEND = { S: 0.35, E: 0.3, h: 0.22, M: 0.2, G: 0.15, R: 0.45 };
  for (const x of ev) {
    if (x.v === 'S' && !x.roll && x.t >= T.engrane && x.t < T.cut && Math.round((x.t - T.engrane) / st) % 16 >= 12) x.thr = 1;
    if (x.v === 'S' && x.roll) x.thr = 1;
    if (x.v === 'E' && x.co) x.thr = 1;
  }
  const dlAt = (t) => { let d = DL[0]; for (const x of DL) if (t >= x[0]) d = x; return d; };
  function echoes(x) {
    const [, D, fb0] = dlAt(x.t), snd = (SEND[x.v] || 0) * (x.thr ? 2.2 : 1), fb = x.thr ? Math.min(0.68, fb0 + 0.2) : fb0, out = [];
    let g = snd;
    for (let k = 1; k < 9 && g > 0.01; k++) { g *= k === 1 ? 1 : fb; const te = x.t + k * D; if (te >= T.cut && te < T.align) break; if (x.t < T.cut && te >= T.cut) break; out.push([te, g, k]); }
    return out;
  }
  ev.sort((a, b) => a.t - b.t); X.sort((a, b) => a.t - b.t);
  function warp(t) { for (const x of X) if (t >= x.t && t < x.t + x.len) return x.t + ((t - x.t) % x.div); return t; }
  const LOOPS = [[0, 2 * BAR], [T.align + BAR, T.align + 3 * BAR]];
  root.TKM = { T, EV: ev, X, warp, LOOPS, DL, SEND, echoes };
})(typeof window !== 'undefined' ? window : globalThis);
