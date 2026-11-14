/* VØID_LOOM — Lab 35 · Descarga · PARTITURA ÚNICA.
   La electricidad buscando su camino. Pieza IDM a 132 bpm (tipo Orphx) con polimetría 5 contra 4.
   Voces → gestos: K bombo (la nube se ilumina por dentro / el líder da un salto / re-descarga)
   S arco (chasquido grave: una chispa sube desde el suelo / un rayo se arrastra por la base de la nube)
   H ticks (cada tick es un paso del líder escalonado) · B carga (el dron se carga; la base de la nube respira)
   X stutter (el líder repite sus pasos) · R retorno (el canal se enciende de suelo a nube) · trueno: llega después del destello.
   Actos: NUBE 0–3,64 (loop) · LÍDER 3,64–10,91 · SILENCIO 10,91–11,61 · RETORNO 11,61–18,88 (loop de 2 compases) · FIRMA. */
(function (root) {
  const BPM = 132, q = 60 / BPM, st = q / 4, BAR = 4 * q;
  const T = { bpm: BPM, q, st, bar: BAR, leader: 2 * BAR, cut: 6 * BAR, rupt: 6 * BAR + 0.7, sting: 6 * BAR + 0.7 + 4 * BAR };
  const H = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const euclid = (k, n, rot) => Array.from({ length: n }, (_, i) => ((((i + rot) % n + n) % n) * k) % n < k);
  const ev = [], X = [], STEPS = [];
  const push = (v, t, s, x) => ev.push(Object.assign({ v, t, s }, x || {}));
  const sw = (i) => (i % 2 ? 0.011 : 0) + (i % 4 === 3 ? 0.006 : 0);

  for (let bar = 0; bar < 6; bar++) {
    const t0 = bar * BAR, o = bar % 2, lead = bar >= 2, ten = lead ? (bar - 2) / 4 : 0;
    const K = euclid(5, 16, lead ? [0, 3, 6, 2][bar - 2] : o * 3); K[0] = true;
    const Sx = o ? [4, 11, 12] : [4, 12];
    const H1 = euclid(lead ? 11 + (bar >= 4 ? 2 : 0) : 7, 16, lead ? bar : o);
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * st + sw(i);
      if (K[i]) push('K', t, i === 0 ? 1 : i === 8 ? 0.82 : 0.58 + 0.22 * H(lead ? bar : o, i), { seed: (lead ? bar * 50 : o * 50) + i });
      if (Sx.includes(i)) push('S', t + 0.008, i === 4 || i === 12 ? 0.95 : 0.6, { seed: (lead ? bar * 50 : o * 50) + i + 20, x: H(lead ? bar : o, i + 7) * 2 - 1 });
      if (H1[i] && !K[i]) push('H', t + 0.004, 0.35 + 0.4 * H(lead ? bar : o, i + 30), { seed: (lead ? bar * 50 : o * 50) + i + 40 });
    }
    // polimetría: un ciclo de 5 semicorcheas contra el compás de 4 (patrón de 2 compases en NUBE → loop perfecto)
    for (let j = 0; j < 16; j++) { const g = bar * 16 + j; if (g % 5 === 0 && (!lead || g % 10 === 0 || bar >= 4)) push('H', t0 + j * st + 0.017, 0.5, { seed: 300 + (lead ? g : g % 32), poly: 1 }); }
    push('B', t0 + 0.002, lead ? 0.7 + 0.3 * ten : 0.6, {});
    if (o === 1) X.push({ t: t0 + 14 * st, len: 2 * st, div: lead ? st / 3 : st / 2 });
    if (bar >= 4) { const at = t0 + (bar === 5 ? 12 : 9) * st, n = bar === 5 ? 8 : 5, d = bar === 5 ? st / 2 : st * 2 / 3; for (let k = 0; k < n; k++) push('K', at + k * d, 0.3 + 0.45 * k / n, { rat: 1, seed: bar * 50 + 45 + k }); }
  }
  ev.sort((a, b) => a.t - b.t);
  // reloj del líder: cada tick es un paso; cada bombo, un salto de 3 pasos
  for (const e of ev) {
    if (e.t < T.leader || e.t >= T.cut) continue;
    if (e.v === 'H') STEPS.push(e.t);
    if (e.v === 'K') for (let k = 0; k < (e.rat ? 1 : 3); k++) STEPS.push(e.t + k * 0.022);
  }
  STEPS.sort((a, b) => a - b);
  // ---- SILENCIO (el líder se congela a un palmo del suelo) · RETORNO y re-descargas (4 compases, todos iguales salvo el primero)
  push('R', T.rupt, 1);
  for (let k = 0; k < 4; k++) {
    const t0 = T.rupt + k * BAR;
    if (k > 0) push('K', t0, 1, { big: 1, seed: 600 });
    push('K', t0 + 6 * st, 0.75, { big: 1, seed: 601 });
    push('K', t0 + 10 * st, 0.55, { seed: 602 });
    push('S', t0 + 12 * st + 0.01, 1, { big: 1, seed: 610, x: 0 });
    push('B', t0 + 0.002, 1, { swell: 1 });
    const hh = euclid(7, 16, 1);
    for (let i = 0; i < 16; i++) if (hh[i]) push('H', t0 + i * st + 0.005, 0.3 + 0.3 * H(9, i), { seed: 700 + i });
    for (let j = 0; j < 16; j++) if (j % 5 === 2) push('H', t0 + j * st + 0.017, 0.4, { seed: 760 + j, poly: 1 });
  }
  ev.sort((a, b) => a.t - b.t); X.sort((a, b) => a.t - b.t);
  function warp(t) { for (const x of X) if (t >= x.t && t < x.t + x.len) return x.t + ((t - x.t) % x.div); return t; }
  const LOOPS = [[0, 2 * BAR], [T.rupt + BAR, T.rupt + 3 * BAR]];
  root.DSC = { T, EV: ev, X, warp, STEPS, LOOPS };
})(typeof window !== 'undefined' ? window : globalThis);
