/* VØID_LOOM — Lab 33 · Escarcha · PARTITURA ÚNICA.
   La pieza se compone aquí primero; el audio la interpreta voz a voz y la imagen la hace visible voz a voz.
   Voces: K bombo (la escarcha avanza un paso) · S golpe de hielo (nace un cristal nuevo) · H ticks (destellos en las puntas)
          B bajo rodante en semicorcheas (la luz lejana respira) · C crujido del hielo (el cristal se tensa) · X stutter (audio e imagen)
          R ruptura (se enciende la luz tras el cristal) · G(t) frente de crecimiento de la escarcha.
   Secciones: A groove 122 bpm (0–7,87) · B tensión con ratchets y stutters (7,87–11,8) · silencio (11,8–12,4)
              C clímax a medio tiempo (12,4–19,4): la estrella central · firma (19,4–24,9). */
(function (root) {
  const BPM = 122, q = 60 / BPM, BAR = 4 * q, st = q / 4;
  const T = { bpm: BPM, q, tense: 4 * BAR, cut: 6 * BAR, rupt: 6 * BAR + 0.6, sting: 6 * BAR + 0.6 + 7.0 };
  let a = 3333 >>> 0;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const euclid = (k, n, rot) => Array.from({ length: n }, (_, i) => ((((i + rot) % n + n) % n) * k) % n < k);
  const ev = [], X = [];
  const push = (v, t, s, extra) => ev.push(Object.assign({ v, t, s }, extra || {}));
  // micro-timing IDM: cada voz tiene su propio desplazamiento, y las semicorcheas pares llegan un pelo tarde
  const sw = (i) => (i % 2 ? 0.012 : 0) + (i % 4 === 3 ? 0.006 : 0);

  // ---- A + B: 6 compases. Bombo euclidiano que rota cada compás, bajo rodante, golpes de hielo a contratiempo.
  const KROT = [0, 3, 0, 5, 2, 7];
  for (let bar = 0; bar < 6; bar++) {
    const t0 = bar * BAR, ten = Math.max(0, Math.min(1, (t0 - T.tense) / (T.cut - T.tense) + (bar >= 4 ? 0.25 : 0)));
    const K = euclid(5, 16, KROT[bar]); K[0] = true;
    const Bp = euclid(11, 16, (bar * 5) % 16);
    const H1 = euclid(7, 16, bar * 3), H2 = euclid(5, 12, bar);
    for (let i = 0; i < 16; i++) {
      const tt = t0 + i * st + sw(i);
      if (K[i]) push('K', tt, i === 0 ? 1 : i === 8 ? 0.85 : 0.6 + 0.2 * r());
      if (Bp[i] && !K[i]) push('B', tt, 0.55 + 0.4 * r() + (i % 4 === 2 ? 0.15 : 0));
      if (H1[i] && r() < 0.75 + 0.25 * ten) push('H', tt + 0.004, 0.4 + 0.45 * r(), { seed: Math.floor(r() * 9973) });
    }
    for (let i = 0; i < 12; i++) if (H2[i] && r() < 0.5 + 0.5 * ten) push('H', t0 + i * BAR / 12 + 0.009, 0.3 + 0.35 * r(), { seed: Math.floor(r() * 9973), tri: 1 });
    // golpe de hielo: el 3 del compás (medio tiempo) y, a veces, un eco en la última semicorchea
    push('S', t0 + 8 * st + 0.01, 1, { x: r() * 2 - 1, y: r() * 2 - 1, seed: Math.floor(r() * 9973) });
    if (bar % 2 === 1 || ten > 0) push('S', t0 + 14 * st + 0.015, 0.55 + 0.2 * ten, { x: r() * 2 - 1, y: r() * 2 - 1, seed: Math.floor(r() * 9973) });
    // crujido: el hielo se tensa al final de cada 2 compases (y en cada compás en la tensión)
    if (bar % 2 === 1 || bar >= 4) push('C', t0 + 12 * st, 0.6 + 0.4 * ten, { len: 0.42 + 0.3 * r(), seed: Math.floor(r() * 9973) });
    // ratchets (redobles) en la tensión: el bombo se multiplica en fusas/tresillos
    if (bar >= 4) {
      const at = t0 + (bar === 5 ? 12 : 6) * st, n = bar === 5 ? 8 : 6, d = bar === 5 ? st / 2 : st * 2 / 3;
      for (let k = 0; k < n; k++) push('K', at + k * d, 0.35 + 0.4 * (k / n), { rat: 1 });
    }
    // stutters: la última corchea del compás repite su primera semicorchea (y en la tensión, trozos más cortos)
    if (bar >= 1) X.push({ t: t0 + 14 * st, len: 2 * st, div: bar >= 4 ? st / 3 : st / 2 });
    if (bar >= 4) X.push({ t: t0 + 6 * st, len: 2 * st, div: st / 4 });
  }
  // ---- silencio total (T.cut → T.rupt) y ruptura
  push('R', T.rupt, 1);
  // ---- C: clímax a medio tiempo (61 bpm). Golpes enormes; cada uno hace crecer un anillo de la estrella.
  { const hq = 2 * q; let k = 0;
    for (let tt = T.rupt + hq; tt < T.sting - 0.5; tt += hq, k++) {
      push('K', tt, 1, { big: 1 }); push('B', tt, 1, { swell: 1 });
      push('S', tt + hq / 2 + 0.02, 0.9, { x: 0, y: 0, seed: Math.floor(r() * 9973), star: 1 });
      if (k % 2 === 1) push('K', tt + hq * 0.75, 0.5);
      if (k % 3 === 2) push('C', tt + hq * 0.5, 0.7, { len: 0.5, seed: Math.floor(r() * 9973) });
      const tick = euclid(k % 2 ? 7 : 5, 12, k);
      for (let z = 0; z < 12; z++) if (tick[z]) push('H', tt + z * hq / 12 + 0.006, 0.3 + 0.4 * r(), { seed: Math.floor(r() * 9973) });
      for (let z = 0; z < 8; z++) if (z % 3 !== 0) push('B', tt + z * hq / 8 + 0.01, 0.35 + 0.3 * r());
      if (k === 3) X.push({ t: tt + hq * 0.75, len: hq * 0.25, div: hq / 16 });
    }
  }
  ev.sort((p, q2) => p.t - q2.t);
  X.sort((p, q2) => p.t - q2.t);

  // ---- tiempo deformado por los stutters (la imagen repite exactamente lo mismo que el audio)
  function warp(t) {
    for (const x of X) if (t >= x.t && t < x.t + x.len) return x.t + ((t - x.t) % x.div);
    return t;
  }

  // ---- frente de crecimiento G(t): cada bombo hace avanzar la escarcha un paso; entre golpes, un avance lento
  const G0 = 220, CREEP = 26;
  const steps = ev.filter((e) => e.v === 'K' || e.v === 'R').map((e) => ({ t: e.t, d: e.v === 'R' ? 70 : e.big ? 95 : e.rat ? 9 : 34 * e.s }));
  function G(t) {
    let g = G0 + CREEP * Math.min(t, T.cut) + (t > T.rupt ? 18 * (t - T.rupt) : 0);
    for (const s of steps) {
      if (s.t > t) break;
      const k = (t - s.t) / 0.11; g += s.d * (k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
    }
    return g;
  }
  root.ESC = { T, EV: ev, X, warp, G, G0 };
})(typeof window !== 'undefined' ? window : globalThis);
