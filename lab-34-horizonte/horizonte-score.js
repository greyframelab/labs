/* VØID_LOOM — Lab 34 · Horizonte · PARTITURA ÚNICA.
   El tiempo se para en el borde: la pieza se compone en tiempo musical (pulsos) y se interpreta en tiempo real
   a través de la dilatación gravitatoria. Lejos del agujero el tempo es 126 bpm; al caer, cada pulso tarda más
   y suena más grave (corrimiento al rojo). En el horizonte, el tiempo se para: silencio. Después, el chorro.
   Voces: K bombo (el disco se enciende) · S golpe de metal (se enciende el anillo de fotones) · H ticks (puntos calientes)
          B bajo a contratiempo (onda gravitatoria: el espacio ondula) · X stutter (audio e imagen)
          R ruptura (el chorro relativista) · rate(t) ritmo del tiempo · tau(t) tiempo propio del disco.
   Actos: LEJOS 0–7,62 (loop perfecto) · CAÍDA 7,62–13,22 · HORIZONTE (silencio) 13,22–13,92 · CHORRO 13,92–20,58 · FIRMA. */
(function (root) {
  const BPM = 126, q = 60 / BPM, st = q / 4;
  const TA = 16 * q, TH = TA + 5.6, TR = TH + 0.7, QC = 2 * q, TS = TR + 7 * QC;
  const T = { bpm: BPM, q, fall: TA, horizon: TH, rupt: TR, sting: TS, qc: QC };
  const H = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const euclid = (k, n, rot) => Array.from({ length: n }, (_, i) => ((((i + rot) % n + n) % n) * k) % n < k);

  // ---- el ritmo del tiempo: 1 lejos, cae hacia 0 en el horizonte, 0 en el silencio; en el chorro, el disco gira al doble
  function rate(t) {
    if (t < TA) return 1;
    if (t < TH) { const u = (t - TA) / (TH - TA); return Math.max(0.07, 1 - 0.93 * Math.pow(u, 1.25)); }
    if (t < TR) return 0;
    return 2;
  }
  // tiempo musical (en pulsos) que ha pasado hasta t, integrando la dilatación (solo hasta el horizonte)
  const DT = 1 / 2000, MB = [];
  { let m = 0; for (let t = 0; t <= TH + 1e-9; t += DT) { MB.push(m); m += rate(t) * DT / q; } }
  const beatAt = (t) => { const i = Math.min(MB.length - 1, Math.max(0, t / DT)); const i0 = Math.floor(i), f = i - i0; return MB[i0] + f * ((MB[i0 + 1] ?? MB[i0]) - MB[i0]); };
  function timeAt(b) { let lo = 0, hi = TH; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (beatAt(m) < b) lo = m; else hi = m; } return (lo + hi) / 2; }
  const BH = beatAt(TH);

  // ---- tiempo propio del disco (determina el giro): continuo y periódico dentro de los loops
  function tau(t) {
    if (t < TA) return t;
    if (t < TH) return TA + beatAt(t) * q - 16 * q;
    if (t < TR) return TA + BH * q - 16 * q;
    return TA + BH * q - 16 * q + 2 * (t - TR);
  }

  const ev = [], X = [];
  const push = (v, b, s, extra) => { const t = timeAt(b); ev.push(Object.assign({ v, t, s, r: rate(t) }, extra || {})); };
  // ---- LEJOS + CAÍDA: compases en tiempo musical; los pares e impares se repiten (el acto LEJOS hace loop perfecto)
  const KR = [0, 3], HR = [0, 5];
  for (let bar = 0; bar * 4 < BH; bar++) {
    const o = bar % 2, b0 = bar * 4;
    const K = euclid(5, 16, KR[o]); K[0] = true;
    const H1 = euclid(9, 16, HR[o]), H2 = euclid(5, 12, o * 2);
    const Sx = o ? [4, 10, 12] : [4, 13];
    for (let i = 0; i < 16; i++) {
      const b = b0 + i / 4 + (i % 2 ? 0.035 : 0) + (i % 4 === 3 ? 0.02 : 0);   // swing irregular
      if (b >= BH) break;
      if (K[i]) push('K', b, i === 0 ? 1 : 0.62 + 0.25 * H(o, i));
      if (Sx.includes(i)) push('S', b + 0.012, i === 4 ? 1 : 0.6 + 0.2 * H(o, i + 40), { seed: o * 100 + i });
      if (H1[i] && !K[i]) push('H', b + 0.008, 0.35 + 0.45 * H(o, i + 80), { seed: o * 100 + i });
      if (i % 4 === 2 || (o && i === 15)) push('B', b + 0.004, i === 15 ? 0.55 : 0.85 + 0.15 * H(o, i + 120));
    }
    for (let i = 0; i < 12; i++) if (H2[i] && b0 + i / 3 < BH) push('H', b0 + i / 3 + 0.02, 0.28 + 0.3 * H(o, i + 160), { seed: o * 100 + 50 + i, tri: 1 });
    // stutter al final de cada compás impar: la última corchea repite su primera semicorchea
    if (o === 1 && b0 + 4 < BH) { const a = timeAt(b0 + 3.5), z = timeAt(b0 + 4); X.push({ t: a, len: z - a, div: (z - a) / (bar >= 4 ? 4 : 2) }); }
  }
  // ---- HORIZONTE: silencio total. RUPTURA y CHORRO a medio tiempo (63 bpm); patrón de 2 pulsos que se repite (loop perfecto)
  ev.push({ v: 'R', t: TR, s: 1, r: 2 });
  for (let k = 1; k < 7; k++) {
    const t0 = TR + k * QC, o = k % 2;
    ev.push({ v: 'K', t: t0, s: 1, big: 1, r: 2 });
    ev.push({ v: 'B', t: t0, s: 1, swell: 1, r: 2 });
    ev.push({ v: 'S', t: t0 + QC * (o ? 0.5 : 0.625), s: 0.9, seed: 300 + o, big: 1, r: 2 });
    if (o) ev.push({ v: 'K', t: t0 + QC * 0.75, s: 0.55, r: 2 });
    const tk = euclid(o ? 7 : 5, 12, o);
    for (let z = 0; z < 12; z++) if (tk[z]) ev.push({ v: 'H', t: t0 + z * QC / 12 + 0.006, s: 0.3 + 0.35 * H(o, z + 200), seed: 400 + o * 20 + z, r: 2 });
    for (let z = 1; z < 4; z++) ev.push({ v: 'B', t: t0 + z * QC / 4 + 0.005, s: 0.4 + 0.15 * H(o, z), r: 2 });
    if (k === 6) X.push({ t: t0 + QC * 0.75, len: QC * 0.25, div: QC / 16 });
  }
  ev.sort((a, b) => a.t - b.t); X.sort((a, b) => a.t - b.t);

  function warp(t) { for (const x of X) if (t >= x.t && t < x.t + x.len) return x.t + ((t - x.t) % x.div); return t; }
  // loops perfectos para el directo: el acto LEJOS entero y 4 pulsos del CHORRO
  const LOOPS = [[0, TA], [TR + QC, TR + 5 * QC]];
  root.HZN = { T, EV: ev, X, warp, rate, tau, beatAt, timeAt, LOOPS };
})(typeof window !== 'undefined' ? window : globalThis);
