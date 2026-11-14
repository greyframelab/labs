/* VØID_LOOM — Lab 36 · Engranaje · PARTITURA ÚNICA.
   Una máquina colosal que calcula un único instante. IDM a 96 bpm con polimetría 5 · 7 · 11 contra el compás de 16.
   Cada anillo del astrolabio es una voz y avanza un diente con cada golpe suyo:
   K bombo → el anillo exterior (pesado) · E escape (ciclo de 5) → anillo medio · P placa (ciclo de 7) → anillo interior
   M trinquete (ciclo de 11) → el anillo del núcleo, en micro-pasos · B dron → respiración del núcleo y cambio de forma
   G fantasma → el anillo tiembla sin avanzar · V placa al revés → la luz crece hacia el golpe
   S caja → destello rasante en los cantos · h hats → el polvo parpadea
   X stutter → los anillos repiten su paso · R alineación: los cuatro ciclos coinciden, las ranuras se alinean y la luz sale.
   Actos: GIRO 0–5 (loop) · ENGRANE 5–15 · SILENCIO 15–15,63 · ALINEACIÓN 15,63–23,13 (loop de 2 compases) · FIRMA. */
(function (root) {
  const BPM = 96, q = 60 / BPM, st = q / 4, BAR = 4 * q;
  const T = { bpm: BPM, q, st, bar: BAR, engrane: 2 * BAR, cut: 6 * BAR, align: 6 * BAR + 4 * st };
  T.sting = T.align + 3 * BAR;
  const H = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const euclid = (k, n, rot) => Array.from({ length: n }, (_, i) => ((((i + rot) % n + n) % n) * k) % n < k);
  const ev = [], X = [];
  const push = (v, t, s, x) => ev.push(Object.assign({ v, t, s }, x || {}));
  const sw = (i) => (i % 2 ? 0.014 : 0) + (i % 4 === 3 ? 0.006 : 0);   // swing irregular, arrastrado

  // ---- GIRO (2 compases que repiten perfecto): los ciclos se cuentan dentro del loop de 32 semicorcheas
  const KG = [[0, 6, 10], [0, 3, 8, 11, 14]];
  for (let g = 0; g < 32; g++) {
    const bar = g >> 4, i = g & 15, t = bar * BAR + i * st + sw(i);
    if (KG[bar].includes(i)) push('K', t, i === 0 ? 1 : 0.62 + 0.25 * H(bar, i), { ring: 3, seed: g });
    if (g % 5 === 0) push('E', t + 0.006, 0.55 + 0.35 * H(5, g), { ring: 2, seed: 100 + g });
    if (g % 7 === 0) push('P', t + 0.011, 0.7 + 0.25 * H(7, g), { ring: 1, seed: 200 + g });
    if (g % 11 === 0) push('M', t + 0.017, 0.6, { ring: 0, seed: 300 + g, n: 3 });
    if (i === 0) push('B', t + 0.002, 0.55, { note: 0 });
    if (!KG[bar].includes(i) && g % 5 && g % 7 && g % 11 && H(31, g) > 0.62) push('G', t + 0.009, 0.18 + 0.2 * H(32, g), { ring: 1 + (g % 2), seed: 400 + g });
  }
  X.push({ t: BAR + 14 * st, len: 2 * st, div: st / 2 });

  // ---- ENGRANE (4 compases): los ciclos cuentan hacia atrás desde la alineación (paso 68), así coinciden todos a la vez
  const gA = 68;
  for (let g = 0; g < 64; g++) {
    const bar = g >> 4, i = g & 15, t = T.engrane + bar * BAR + i * st + sw(i), ten = g / 64;
    const K = euclid(5, 16, [0, 3, 6, 2][bar]); K[0] = true;
    if (K[i]) push('K', t, i === 0 ? 1 : 0.58 + 0.3 * H(10 + bar, i), { ring: 3, seed: 1000 + g });
    const e5 = (gA - g) % 5 === 0, p7 = (gA - g) % 7 === 0, m11 = (gA - g) % 11 === 0;
    if (e5) push('E', t + 0.006, 0.6 + 0.3 * ten, { ring: 2, seed: 1100 + g, co: p7 || m11 ? 1 : 0 });
    if (p7) push('P', t + 0.011, 0.75 + 0.2 * ten, { ring: 1, seed: 1200 + g, co: e5 || m11 ? 1 : 0 });
    if (m11) push('M', t + 0.017, 0.7, { ring: 0, seed: 1300 + g, n: 4, co: e5 || p7 ? 1 : 0 });
    if (i === 0) push('B', t + 0.002, 0.6 + 0.4 * ten, { shape: 1, note: [0, 1, 0, 6][bar] });
    if (!K[i] && !e5 && !p7 && !m11 && H(41, g) > 0.55 - 0.25 * ten) push('G', t + 0.009, 0.16 + 0.3 * ten * H(42, g), { ring: 1 + (g % 3 === 0 ? 1 : 0) + (g % 2), seed: 1500 + g });
    if (bar % 2 === 1 && i === 14) X.push({ t, len: 2 * st, div: bar === 3 ? st / 3 : st / 2 });
  }
  // cuerda: en el último compás el núcleo se da cuerda, cada vez más rápido
  for (let k = 0; k < 10; k++) { const u = k / 10; push('M', T.engrane + 3 * BAR + (8 + 7.2 * (1 - (1 - u) * (1 - u))) * st, 0.25 + 0.5 * u, { ring: 0, seed: 1400 + k, n: 1, wind: 1 }); }

  // inspiraciones: placas al revés que crecen hacia el golpe (la última se corta en seco contra el silencio)
  for (const [tE, len] of [[T.engrane + BAR, q], [T.engrane + 3 * BAR, q], [T.cut, 2 * q]]) push('V', tE - len, 0.8, { len, end: tE });

  // ---- SILENCIO (todo se detiene a un paso) · ALINEACIÓN (3 compases; 2 y 3 iguales: el haz barre 8 × 45° = una vuelta)
  push('R', T.align, 1);
  for (let b = 0; b < 3; b++) {
    const t0 = T.align + b * BAR;
    const KS = b === 0 ? [8, 12] : [0, 6, 10, 13];
    for (const i of KS) push('K', t0 + i * st + sw(i), i === 0 ? 1 : 0.8, { big: 1, sweep: b > 0 ? 1 : 0, seed: 2000 + i });
    for (let i = 0; i < 16; i++) {
      const g = (b === 0 ? 0 : (b - 1) * 16) + i;
      if (b > 0 && g % 5 === 2) push('E', t0 + i * st + 0.006, 0.45, { seed: 2100 + g, lock: 1 });
      if (b > 0 && g % 7 === 3) push('P', t0 + i * st + 0.011, 0.55, { seed: 2200 + g, lock: 1 });
    }
    push('B', t0 + 0.002, 1, { swell: 1, note: 0 });
  }

  // ---- hats (h) y caja (S) IDM: caja desplazada con redobles, hats en semicorcheas con acentos euclidianos y ratchets en fusas
  const SN = { g: [[4, 12], [4, 11, 12]], e: [[4, 12], [4, 10, 12], [4, 12, 15], [3, 4, 12, 14]], a: [4, 12] };
  const hatBar = (t0, key, dens, b, acc) => {
    const A = euclid(acc, 16, b);
    for (let i = 0; i < 16; i++) {
      const hh = H(key, i);
      if (hh < dens) push('h', t0 + i * st + sw(i) + 0.003, (A[i] ? 0.75 : 0.35) * (0.7 + 0.3 * H(key + 1, i)), { seed: key * 16 + i, open: A[i] && i % 8 === 6 ? 1 : 0 });
      if (H(key + 2, i) > 0.9) for (let k = 1; k < 3; k++) push('h', t0 + i * st + sw(i) + 0.003 + k * st / 2, 0.25, { seed: key * 16 + i + 500 + k });
    }
  };
  for (let b = 0; b < 2; b++) { const t0 = b * BAR; for (const i of SN.g[b]) push('S', t0 + i * st + sw(i) + 0.004, i === 11 ? 0.45 : 0.9, { seed: 3000 + b * 16 + i }); hatBar(t0, 40 + b, 0.55, b, 5); }
  for (let b = 0; b < 4; b++) { const t0 = T.engrane + b * BAR; for (const i of SN.e[b]) push('S', t0 + i * st + sw(i) + 0.004, [11, 10, 15, 3, 14].includes(i) ? 0.5 : 0.95, { seed: 3100 + b * 16 + i }); hatBar(t0, 60 + b, 0.6 + 0.1 * b, b, 5 + b); }
  // redoble final contra el silencio: fusas de tresillo que crecen
  for (let k = 0; k < 6; k++) push('S', T.engrane + 3 * BAR + 14 * st + k * st / 3, 0.3 + 0.1 * k, { seed: 3300 + k, roll: 1 });
  for (let b = 1; b < 3; b++) { const t0 = T.align + b * BAR; for (const i of SN.a) push('S', t0 + i * st + sw(i) + 0.004, 1, { seed: 3400 + i }); hatBar(t0, 80, 0.6, 0, 5); }

  // ---- ECO compartido (sonido e imagen): retardo a tempo, ping-pong; cada repetición es un eco del gesto visual
  //      GIRO y ENGRANE: corchea con puntillo · ALINEACIÓN: negra (más espacio). Los "lanzamientos" (thr) disparan ecos largos.
  const DL = [[0, 3 * st, 0.38], [T.engrane, 3 * st, 0.45], [T.cut, 3 * st, 0], [T.align, 4 * st, 0.5]];
  const SEND = { S: 0.35, E: 0.3, h: 0.22, M: 0.25, G: 0.15, P: 0.12, R: 0.45 };
  for (const x of ev) {
    if (x.v === 'S' && !x.roll && x.t >= T.engrane && x.t < T.cut && Math.round((x.t - T.engrane) / st) % 16 >= 11) x.thr = 1;
    if (x.v === 'S' && x.roll) x.thr = 1;
    if (x.v === 'E' && x.co) x.thr = 1;
  }
  const dlAt = (t) => { let d = DL[0]; for (const x of DL) if (t >= x[0]) d = x; return d; };
  function echoes(x) {   // lista de repeticiones [t, ganancia] de un evento (se cortan en el silencio)
    const [, D, fb0] = dlAt(x.t), snd = (SEND[x.v] || 0) * (x.thr ? 2.2 : 1), fb = x.thr ? Math.min(0.68, fb0 + 0.2) : fb0, out = [];
    let g = snd;
    for (let k = 1; k < 9 && g > 0.01; k++) { g *= k === 1 ? 1 : fb; const te = x.t + k * D; if (te >= T.cut && te < T.align) break; if (x.t < T.cut && te >= T.cut) break; out.push([te, g, k]); }
    return out;
  }
  ev.sort((a, b) => a.t - b.t); X.sort((a, b) => a.t - b.t);
  function warp(t) { for (const x of X) if (t >= x.t && t < x.t + x.len) return x.t + ((t - x.t) % x.div); return t; }
  const LOOPS = [[0, 2 * BAR], [T.align + BAR, T.align + 3 * BAR]];
  root.ENG = { T, EV: ev, X, warp, LOOPS, DL, SEND, echoes };
})(typeof window !== 'undefined' ? window : globalThis);
