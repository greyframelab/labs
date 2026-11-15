/* VØID_LOOM — Lab 39 · Espejos · PARTITURA ÚNICA (música: «PÉNDULO», void-loom-music, referencia Autechre).
   Un muro curvo de lamas de acero pulido y una sola luz roja rasante. 96 bpm, La menor sin melodía; plantillas rítmicas que mutan.
   Cada voz voltea el muro a su manera:
   K bombo → una ola sale de un punto del muro y lo cruza · S golpe grave → una columna entera de lamas gira de golpe
   h ticks → un grupo pequeño de lamas destella · G glitch (ciclo de 5) → una fila entera se voltea · B bajo → la marea cambia de rumbo
   X stutter → el muro repite su instante · Z → las lamas se detienen y se apagan · R → todas se alinean y devuelven la luz a cámara.
   Actos: OLA 0–5 (loop) · MAREA 5–12,5 · QUIETUD 12,5–15 · REFLEJO 15–23,75 (loop 17,5–22,5) · FIRMA. */
(function (root) {
  const BPM = 96, q = 60 / BPM, st = q / 4, BAR = 4 * q;
  const T = { bpm: BPM, q, st, bar: BAR, mut: 2 * BAR, cut: 5 * BAR, rupt: 6 * BAR };
  T.sting = T.rupt + 3.5 * BAR;
  const H = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const euclid = (k, n, rot) => Array.from({ length: n }, (_, i) => ((((i + rot) % n + n) % n) * k) % n < k);
  const ev = [], X = [];
  const push = (v, t, s, x) => ev.push(Object.assign({ v, t, s }, x || {}));
  // microtiming por voz (no global): el bombo clavado, el golpe grave arrastra, los ticks empujan
  const swK = () => 0, swS = (i) => (i % 2 ? 0.012 : 0.004), swH = (i) => (i % 2 ? 0.018 : 0) - (i % 4 === 3 ? 0.006 : 0);

  // plantillas por compás: [bombo, golpe grave, ticks (k de 16, rotación), bajo (paso: semitono)]
  const BARS = [
    /* 0 BANDADA */ { K: [0, 7, 10], S: [8], hk: [5, 0], B: { 0: 0, 7: 0, 10: 3 } },
    /* 1        */ { K: [0, 7, 10, 13], S: [8, 15], hk: [5, 3], B: { 0: 0, 7: 0, 10: 3, 13: -2 } },
    /* 2 MUTAC. */ { K: [0, 3, 7, 10], S: [4, 12], hk: [7, 1], B: { 0: 0, 3: 0, 7: 5, 10: 3 } },
    /* 3        */ { K: [0, 3, 6, 10, 12], S: [4, 9, 12], hk: [9, 4], B: { 0: 0, 3: 1, 6: 0, 10: 5, 12: 3 } },
    /* 4        */ { K: [0, 2, 5, 8, 10, 11, 13, 14], S: [4, 7, 12, 15], hk: [11, 2], B: { 0: 0, 2: 1, 5: 0, 8: 6, 10: 5, 11: 3, 13: 1, 14: 0 } },
    /* 5 SUSP.  */ null,
    /* 6 ESTALL */ { K: [0, 6, 10], S: [4, 12], hk: [7, 2], B: { 0: 0, 6: 0, 10: 3 } },
    /* 7 (loop) */ { K: [0, 6, 10, 13], S: [4, 12, 14], hk: [7, 2], B: { 0: 0, 6: 0, 10: 3, 13: -2 } },
    /* 8 (loop) */ { K: [0, 6, 10, 13], S: [4, 12, 14], hk: [7, 2], B: { 0: 0, 6: 0, 10: 3, 13: -2 } },
  ];
  BARS.forEach((P, b) => {
    if (!P) return;
    const t0 = b * BAR, mut = b >= 2 && b <= 4 ? (b - 1) / 3 : 0;
    const A = euclid(P.hk[0], 16, P.hk[1]);
    for (let i = 0; i < 16; i++) {
      const g = b * 16 + i, t = t0 + i * st;
      if (P.K.includes(i)) push('K', t + swK(i), i === 0 ? 1 : 0.62 + 0.3 * H(1, g), { seed: g, px: H(11, g), py: H(12, g) });
      if (P.S.includes(i)) push('S', t + swS(i), i === 4 || i === 8 || i === 12 ? 0.95 : 0.5, { seed: g, side: H(2, g) > 0.5 ? 1 : -1, px: H(13, g) });
      if (A[i]) push('h', t + swH(i) + 0.003, (i % 4 === 0 ? 0.75 : 0.45) * (0.85 + 0.15 * H(3, g)), { seed: g, cl: Math.floor(H(4, g) * 64) });
      // glitch en ciclo de 5 contra 16: el desfase hace que nunca caiga igual dos compases seguidos
      if ((g % 5 === 3) && b !== 7 && b !== 8 ? H(5, g) < 0.55 + 0.4 * mut : (b >= 7 && i % 5 === 3)) push('G', t + 0.009, 0.5 + 0.4 * H(6, g), { seed: g, cl: Math.floor(H(7, g) * 8), py: H(14, g) });
      if (i in P.B) push('B', t + 0.002, 0.8, { note: P.B[i], seed: g });
    }
    // ratchets de ticks a 1/32 y 1/64 en finales de frase, con crescendo
    if (b === 1 || b === 3 || b === 4 || b === 7 || b === 8) {
      const n = b === 4 ? 6 : 3, d = b === 4 ? st / 4 : st / 2;
      for (let k = 0; k < n; k++) push('h', t0 + 15 * st + k * d + 0.003, 0.3 + 0.08 * k, { seed: 900 + b * 10 + k, cl: (b * 7 + k) % 64, rat: 1 });
    }
  });
  // stutters compartidos (audio e imagen repiten el mismo trozo)
  X.push({ t: BAR + 14 * st, len: 2 * st, div: st / 2 });
  X.push({ t: 3 * BAR + 12 * st, len: 4 * st, div: st });
  X.push({ t: 4 * BAR + 8 * st, len: 2 * st, div: st / 3 });
  X.push({ t: 4 * BAR + 12 * st, len: 3 * st, div: st / 4 });
  push('Z', T.cut, 1);
  push('R', T.rupt, 1);
  ev.sort((a, b) => a.t - b.t);

  // warp: dentro de un stutter, el tiempo vuelve una y otra vez al principio del trozo
  function warp(t) { for (const x of X) if (t >= x.t && t < x.t + x.len) return x.t + ((t - x.t) % x.div); return t; }
  const LOOPS = [[T.rupt + BAR, T.rupt + 3 * BAR]];   // REFLEJO: dos compases idénticos, cámara y muro periódicos en 5 s
  root.EDD = { T, EV: ev, X, warp, LOOPS, BARS };
})(typeof window !== 'undefined' ? window : globalThis);
