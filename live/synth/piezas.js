/* VØID_LOOM · piezas · traduce la partitura de cada pieza a los instrumentos de vl-voces.js.
   play(M, S, t0): M = motor (VLVoces.Motor), S = partitura de la pieza (la misma que mueve la imagen), t0 = inicio en el reloj del contexto.
   Los tiempos salen de la partitura tal cual: imagen y sonido siguen sincronizados con cualquier semilla. */
(function (root) {
  'use strict';
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const H = (a, b) => root.VLVoces.hash(a, b);

  // dron con silencio entre corte y ruptura, y caída tras la firma
  function dronArco(M, d, T, t0, lv, dur, post) {
    d.level(t0 + 0.01, lv, 1.2);
    d.level(t0 + T.tense, lv * 1.25, 1.5);            // la tensión abre el dron
    d.cut(t0 + T.cut); M.silencio(t0 + T.cut, t0 + T.rupt);
    if (post) { d.glide(t0 + T.rupt - 0.01, post, 0.01); }
    d.level(t0 + T.rupt + 0.02, lv * 1.1, 0.25);
    d.level(t0 + dur - 2.2, 0, 0.7);
    d.stop(t0 + dur + 0.5);
  }

  // ---------- mapeo común para partituras de eventos (K bombo, B bajo, H ticks, h charles, S golpe, G fantasmas,
  //            E/P engranes metálicos, M cuerda, V placas al revés, R ruptura, X stutters). c = timbre de la pieza.
  function evPieza(c) {
    return Object.assign({ room: 0.28 }, c, {
      play(M, S, t0) {
        if (c.prep) S = c.prep(S);
        const T = S.T, cut = T.cut != null ? T.cut : T.horizon != null ? T.horizon : T.freeze, rupt = T.rupt != null ? T.rupt : T.align != null ? T.align : T.cut;
        const TT = { tense: T.tense != null ? T.tense : Math.max(1, cut - 3.5), cut, rupt };
        const r0 = c.root, r1 = c.rootPost || r0, post = (t) => t >= rupt;
        const d = M.Dron({ root: r0, parts: c.parts || [2, 3, 4], cut: c.dronCut || 420, partGain: c.partGain || 0.15, sub: c.sub ?? 0.45 });
        dronArco(M, d, TT, t0, c.dron || 0.45, this.dur, r1 !== r0 ? r1 : null);
        const silent = (t) => cut < rupt && t >= cut - 0.005 && t < rupt;
        const pan = (e, i, k) => e.px != null ? Math.max(-0.9, Math.min(0.9, e.px * 0.6)) : e.side != null ? (e.side > 0 ? 0.5 : -0.5) : (H(e.seed || i, k) - 0.5) * 1.1;
        const kf = (t) => c.kick || Math.max(42, Math.min(56, (post(t) ? r1 : r0) * (r0 < 40 ? 1.5 : 1)));
        const bf = (t) => (post(t) ? r1 : r0) * (c.bassOct || 2);
        const st = T.st || (T.q ? T.q / 4 : 0.12);
        (S.EV || []).forEach((e, i) => {
          if (silent(e.t) && e.v !== 'V') return;
          const t = t0 + e.t, s = e.s ?? 1;
          switch (e.v) {
            case 'K':
              M.kick(t, { vel: Math.min(1.15, 0.55 + 0.45 * s) * (e.big ? 1.12 : 1), f0: kf(e.t), f1: e.sweep ? 210 : 150, tail: e.big ? 0.42 : c.kickTail || 0.26 });
              if (e.rat) M.ratchet(t + 0.06, { n: 5, d: st / 4, vel: 0.6, f: c.tick || 2600 });
              break;
            case 'B': M.bass(t, { vel: Math.min(1.1, 0.5 + 0.5 * s), f: bf(e.t) * Math.pow(2, (e.note || 0) / 12), dur: e.swell ? 0.32 : 0.1 + 0.06 * s, cut: (c.bassCut || 1000) * (0.7 + 0.5 * s) }); break;
            case 'H': {
              const f = (c.tick || 2600) * (1 + 0.9 * H(e.seed || i, 1)) * (e.poly ? 0.8 : 1);
              M.tick(t, { vel: 0.5 + 0.6 * s, f, pan: pan(e, i, 2) });
              if (e.tri) for (let j = 1; j < 3; j++) M.tick(t + j * st * 2 / 3, { vel: (0.4 + 0.4 * s) * (1 - j * 0.2), f: f * (1 + 0.05 * j), pan: j % 2 ? 0.4 : -0.4 });
              break;
            }
            case 'h':
              if (c.hats === 'tick') M.tick(t, { vel: 0.4 + 0.5 * s, f: (c.tick || 3200) * (1 + 0.5 * H(e.seed || i, 6)), dec: e.open ? 0.05 : 0.016, pan: pan(e, i, 6) });
              else M.hat(t, { vel: 0.5 + 0.6 * s, open: e.open, pan: pan(e, i, 6) });
              if (e.rat) for (let j = 1; j < 3; j++) M.hat(t + j * st / 4, { vel: 0.4 + 0.15 * j, pan: pan(e, i, 6) });
              break;
            case 'S':
              M.ice(t, { vel: Math.min(1.1, (0.55 + 0.4 * s) * (e.big ? 1.15 : 1)), f: (c.snare || 1240) * (1 + 0.15 * H(e.seed || i, 3)), pan: pan(e, i, 3), dec: e.thr ? 0.3 : 0.12, send: e.thr ? 0.5 : 0.28 });
              if (e.roll) M.ratchet(t + st / 2, { n: 4, d: st / 3, vel: 0.5, f: c.snare ? c.snare * 2 : 2400 });
              break;
            case 'G': M.tick(t, { vel: 0.25 + 0.3 * s, f: (c.tick || 2600) * 0.55, dec: 0.012, pan: pan(e, i, 7) }); break;
            case 'E': M.ice(t, { vel: Math.min(1, 0.4 + 0.45 * s) * (e.lock ? 1.2 : 1), f: (c.metal || 1900) * (1 + 0.3 * H(e.seed || i, 8)), dec: e.thr ? 0.35 : 0.07, pan: pan(e, i, 8), send: e.thr ? 0.5 : 0.22, thump: 0 }); break;
            case 'P': M.ping(t, { vel: Math.min(1, 0.5 + 0.4 * s), f: (c.metal || 1900) * 0.7, dec: 0.12, pan: pan(e, i, 9) }); break;
            case 'M': M.ratchet(t, { n: Math.max(3, Math.min(10, e.n || 4)), d: e.wind ? st / 4 : st / 3, vel: 0.45 + 0.35 * s, f: (c.metal || 1900) * 1.3 }); break;
            case 'V': M.swell(t, { end: t0 + (e.end || e.t + (e.len || 0.6)), vel: 0.8 * s, f: bf(e.t), top: 2400 }); break;
            case 'R': M.impact(t, { vel: 1, f0: Math.max(30, Math.min(38, r1 * (r1 > 40 ? 0.75 : 1))) }); break;
          }
        });
        (S.X || []).forEach((x) => {
          if (silent(x.t)) return;
          const n = Math.max(2, Math.min(16, Math.round(x.len / x.div)));
          for (let j = 0; j < n; j++) M.tick(t0 + x.t + j * x.div, { vel: 0.3 + 0.5 * j / n, f: (c.tick || 2600) * 1.15 * (1 + 0.04 * j), dec: 0.01, pan: j % 2 ? 0.35 : -0.35 });
        });
        if (T.sting != null) M.ping(t0 + T.sting, { vel: 0.75, f: r1 * 16, dec: 0.8, far: 1, size: 1.4 });
      },
    });
  }

  // ---------- partitura compuesta para piezas cuya imagen va por secciones (sin lista de golpes): rítmica fija,
  //            colocada sobre los momentos visuales (T). No depende de la semilla: imagen y sonido siguen a tiempo.
  function compone(c) {
    const r = root.VLVoces.rng(c.seed || 77), T = c.T, EV = [], X = [];
    const eu = (k, n, rot) => Array.from({ length: n }, (_, i) => (((i + rot) * k) % n) < k);
    const push = (v, t, s, x) => EV.push(Object.assign({ v, t, s }, x || {}));
    const cut = T.cut, rupt = T.rupt, ten = (t) => Math.max(0, Math.min(1, (t - T.tense) / (cut - T.tense)));
    let t = c.start || 0.3, k = 0;
    while (t < cut - 0.04) {
      const tn = ten(t), st = 60 / (c.bpm * (1 + (c.acc || 0.22) * Math.pow(tn, 1.3))) / 4;
      const stp = k % 16, bar = Math.floor(k / 16), sw = (k % 2 ? c.swing || 0.012 : 0) * (1 - tn);
      const dens = t < (c.groove || 0) ? 0.35 : 1;
      if (eu(tn > 0.4 ? 5 : 3, 16, (bar * 3) % 16)[stp] && (dens === 1 || stp === 0)) push('K', t, stp === 0 ? 1 : 0.7 + 0.2 * r());
      if (dens === 1 && (stp === 4 || stp === 12 || (tn > 0.5 && stp === 14 && r() < 0.5))) push('S', t + sw * 0.6, stp === 12 ? 1 : 0.8, { seed: k });
      if (eu(7, 16, bar % 5)[stp] && r() < 0.45 + 0.45 * tn) push('H', t + sw, 0.35 + 0.4 * r(), { seed: k * 7 });
      if (dens === 1 && (stp === 0 || stp === 10 || (stp === 7 && r() < 0.4))) push('B', t, 0.7 + 0.3 * r(), { note: stp === 7 ? c.n2 || 3 : 0 });
      if (dens === 1 && eu(5, 16, 2)[stp] && r() < 0.4) push('G', t + sw + 0.004, 0.4, { seed: k * 3 });
      if (stp === 15 && bar % 2 === 1) X.push({ t: t - st * 3, len: st * 4, div: st / (tn > 0.5 ? 2 : 1) });
      t += st + sw * 0; k++;
    }
    push('R', rupt, 1);
    const end = (T.post || T.sting) - 0.35;            // tras la ruptura: medio tiempo pesado
    { const g = 60 / (c.bpm * 0.75) / 4; let i = 0;
      for (let tt = rupt + (c.postGap || 1.2); tt < end; tt += g, i++) {
        const stp = i % 16, bar = Math.floor(i / 16), KE = eu(5, 16, [0, 3, 6, 1][bar % 4]);
        if (stp === 0 || KE[stp]) push('K', tt, stp === 0 ? 1 : 0.65 + 0.25 * r(), { big: stp === 0 ? 1 : 0 });
        if (stp === 4 || stp === 12) push('S', tt + 0.01, 1, { seed: i, thr: stp === 12 && bar % 2 ? 1 : 0 });
        if (eu(7, 16, bar)[stp] && !KE[stp]) push('h', tt + 0.005, 0.3 + 0.3 * r(), { seed: i });
        if (stp === 0 || stp === 6 || stp === 11) push('B', tt, 0.85, { note: stp === 11 ? c.n2 || 3 : 0 });
        if (stp === 15 && r() < 0.6) X.push({ t: tt, len: g, div: g / 3 });
      }
    }
    (c.extra ? c.extra(push, r) : null);
    EV.sort((a, b) => a.t - b.t);
    return { T: { cut, rupt, tense: T.tense, sting: T.sting }, EV, X };
  }

  const PIEZAS = {
    // ESCARCHA · 122 bpm · hielo que cruje y se rompe
    escarcha: {
      g: 'ESC', dur: 25.5, room: 0.26, opt: { gain: 0.32, top: 9000, tickLP: 3800, tickGain: 0.55 },
      play(M, S, t0) {
        const T = S.T, G0 = S.G0 || 220;
        const d = M.Dron({ root: 49.0, parts: [2, 3, 5], cut: 380, partGain: 0.17, sub: 0.32 });
        dronArco(M, d, T, t0, 0.5, this.dur, 39.2);
        const inCut = (t) => t >= T.cut - 0.005 && t < T.rupt;
        S.EV.forEach((e, i) => {
          const t = t0 + e.t, s = e.s ?? 1;
          if (inCut(e.t)) return;
          switch (e.v) {
            case 'K':
              M.kick(t, { vel: Math.min(1.15, 0.6 + 0.45 * s) * (e.big ? 1.15 : 1), f0: e.t > T.rupt ? 42 : 49, tail: e.big ? 0.42 : 0.26 });
              if (e.rat) M.ratchet(t + 0.06, { n: 5, d: 0.03, vel: 0.6, f: 2400 });
              break;
            case 'H': {
              const f = 2600 + 2800 * H(e.seed || i, 1);
              M.tick(t, { vel: 0.55 + 0.6 * s, f, pan: (H(e.seed || i, 2) - 0.5) * 1.2 });
              if (e.tri) for (let j = 1; j < 3; j++) M.tick(t + j * T.q / 6, { vel: (0.4 + 0.4 * s) * (1 - j * 0.2), f: f * (1 + 0.05 * j), pan: j % 2 ? 0.4 : -0.4 });
              break;
            }
            case 'B': M.bass(t, { vel: Math.min(1.1, 0.5 + 0.5 * s), f: e.t > T.rupt ? 78.4 : 98, dur: 0.1 + 0.06 * s, cut: 900 + 700 * s }); break;
            case 'S': M.ice(t, { vel: e.star ? 1.1 : 0.85 * s, f: G0 * (6.5 + 2 * H(e.seed || i, 3)), pan: (e.x || 0) * 0.9, dec: e.star ? 0.4 : 0.13, send: e.star ? 0.5 : 0.3 }); break;
            case 'C': M.crackle(t, { len: e.len || 0.45, vel: s, seed: e.seed || i }); break;
            case 'R': M.impact(t, { vel: 1, f0: 36 }); break;
          }
        });
        (S.X || []).forEach((x) => {
          if (inCut(x.t)) return;
          const n = Math.max(2, Math.round(x.len / x.div));
          for (let j = 0; j < n; j++) M.tick(t0 + x.t + j * x.div, { vel: 0.35 + 0.55 * j / n, f: 3000 * (1 + 0.04 * j), dec: 0.01, pan: j % 2 ? 0.35 : -0.35 });
        });
        M.ice(t0 + T.sting, { vel: 0.7, f: G0 * 5, dec: 0.9, send: 0.6, thump: 0 });
      },
    },

    // CAMPO · campo magnético, pulsos dispersos y luego groove
    campo: {
      g: 'CMP', dur: 24.5, room: 0.3, opt: { gain: 0.39 },
      play(M, S, t0) {
        const T = S.T;
        const d = M.Dron({ root: 41.2, parts: [2, 3, 4], cut: 440, partGain: 0.15, sub: 0.55 });
        const d2 = M.Dron({ root: 30.87, parts: [2], cut: 260, partGain: 0.08, sub: 0.35 });
        dronArco(M, d, T, t0, 0.48, this.dur);
        dronArco(M, d2, T, t0, 0.3, this.dur);
        const inCut = (t) => t >= T.cut - 0.005 && t < T.rupt;
        S.PULSES.forEach((p, i) => {
          if (inCut(p.t) || p.t < 0) return;
          const t = t0 + p.t, s = p.s ?? 1, pan = Math.max(-0.9, Math.min(0.9, (p.x || 0) * 0.5));
          switch (p.k) {
            case 0: M.kick(t, { vel: Math.min(1, 0.35 + 0.35 * s), f0: 55, f1: 130, tail: 0.09, click: 0.5 }); M.tick(t, { vel: 0.4 * s, f: 1900 + 1200 * (p.rad || 0.5), pan }); break;
            case 1: M.ice(t, { vel: Math.min(1, 0.55 * s), f: 1400 + 900 * (p.rad || 0.5), pan, dec: 0.16 }); break;
            case 2: M.tick(t, { vel: 0.5 + 0.3 * s, f: 4200, dec: 0.012, pan }); break;
            case 3: M.ice(t, { vel: Math.min(1, 0.6 * s), f: 820, pan, dec: 0.3, send: 0.45 }); break;
            case 4: M.bass(t, { vel: Math.min(1, 0.7 * s + 0.3), f: 82.4, dur: 0.14, cut: 1000 }); break;
            case 5: M.ping(t, { vel: Math.min(1, 0.7 * s), f: 1318, pan, dec: 0.14 }); break;
          }
        });
        S.GROOVE.forEach((g, i) => {
          if (inCut(g.t)) return;
          const t = t0 + g.t, s = g.s ?? 1;
          if (g.v === 'k') M.kick(t, { vel: 0.95 * s, f0: 41.2, tail: 0.3 });
          else if (g.v === 'h') M.hat(t, { vel: 0.5 + 0.6 * s, pan: i % 2 ? 0.25 : -0.25 });
          else if (g.v === 's') M.ice(t, { vel: 0.8 * s, f: 1240, dec: 0.12 });
          else if (g.v === 'r') M.ratchet(t, { n: 8, d: 0.03, vel: 0.7 * s, f: 2800 });
        });
        M.impact(t0 + T.rupt, { vel: 0.95, f0: 33 });
        M.ping(t0 + T.sting, { vel: 0.8, f: 659, dec: 0.6, far: 1 });
      },
    },

    // ECO · sonar en una sala enorme, anillos que golpean
    eco: {
      g: 'ECO', dur: 24.5, room: 0.38, opt: { gain: 0.58, tickGain: 1.7, pingBright: 1.6, tickLP: 9000 },
      play(M, S, t0) {
        const T = S.T;
        const d = M.Dron({ root: 27.5, parts: [2, 3, 4, 6], cut: 520, partGain: 0.17, sub: 0.45 });
        dronArco(M, d, T, t0, 0.55, this.dur);
        const inCut = (t) => t >= T.cut - 0.005 && t < T.rupt;
        S.PULSES.forEach((p, i) => {
          if (inCut(p.t) || p.t < 0) return;
          const t = t0 + p.t, s = p.s ?? 1;
          if (p.k === 0) M.ping(t, { vel: Math.min(1.2, 0.5 + 0.5 * s), f: hz(p.v + 48), far: p.far, pan: (H(i, 4) - 0.5) * 0.8, dec: 0.2, size: 1.2 });
          else if (p.k === 1) {
            M.tick(t, { vel: 0.5 + 0.5 * s, f: hz(p.v + 66), dec: 0.014, pan: (H(i, 5) - 0.5) * 1.1 });
            M.kick(t, { vel: 0.45 * Math.min(1, s), f0: 55, f1: 140, tail: 0.08, click: 0.3 });
          } else if (p.k === 2) {
            M.impact(t, { vel: Math.min(1, 0.45 + 0.4 * s), f0: hz(p.v - 24), dur: 1.2 + s });
            M.ice(t, { vel: Math.min(1, 0.4 + 0.3 * s), f: hz(p.v + 24), dec: 0.5 + 0.3 * s, send: 0.55, thump: 0 });
          }
        });
        M.ping(t0 + T.sting, { vel: 0.9, f: hz(57 + 24), dec: 0.8, far: 1, size: 1.5 });
      },
    },
  };

  Object.assign(PIEZAS, {
    horizonte: evPieza({ g: 'HZN', dur: 26.1, root: 49.0, rootPost: 36.7, opt: { gain: 0.34, top: 9000, tickLP: 3600, tickGain: 0.4, hatGain: 0.6 }, tick: 2400, snare: 1100 }),
    descarga:  evPieza({ g: 'DSC', dur: 24.4, root: 55.0, rootPost: 49.0, opt: { gain: 0.27, top: 9000, tickLP: 4200, tickGain: 0.45, hatGain: 0.6 }, tick: 3000, snare: 1400 }),
    engranaje: evPieza({ g: 'ENG', dur: 28.6, root: 43.65, opt: { gain: 0.36, tickLP: 7000 }, metal: 2100, snare: 1300, hats: 'hat', room: 0.32 }),
    tokamak:   evPieza({ g: 'TKM', dur: 30.2, root: 51.9, opt: { gain: 0.33, tickLP: 4800, tickGain: 0.6, hatGain: 0.3, top: 9000 }, metal: 1700, snare: 1200, room: 0.3 }),
    ciudad:    evPieza({ g: 'CDD', dur: 26.9, root: 49.0, rootPost: 43.65, opt: { gain: 0.36, tickLP: 8000, iceGain: 2.2, tickGain: 1.6, bassGain: 1.3 }, bassCut: 2200, metal: 2300, snare: 1500, room: 0.34 }),
    espejos:   evPieza({ g: 'EDD', dur: 29.3, root: 55.0, opt: { gain: 0.36, tickLP: 8000, iceGain: 2.4, tickGain: 1.9, bassGain: 1.4 }, bassCut: 2400, sub: 0.3, tick: 3400, snare: 1600, hats: 'tick', room: 0.3 }),
    pliegue:   evPieza({ g: 'PLG', dur: 28.3, root: 36.7, parts: [2, 3, 4], opt: { gain: 0.44, tickLP: 8000, iceGain: 2.4, tickGain: 1.9, bassGain: 1.4 }, bassCut: 2400, sub: 0.2, dron: 0.32, kick: 50, tick: 3000, snare: 1500, hats: 'tick', bassOct: 2, room: 0.3 }),
  });

  // Teseracto: golpes del hipercubo (k0 fuertes, k1 fantasmas, k2 ruptura) y giros (STEPS); tras la ruptura, groove compuesto
  const tsr = (S) => {
    const post = compone({ T: Object.assign({}, S.T, { tense: S.T.tense }), bpm: 104, seed: 2931, start: S.T.cut });
    const EV = S.HITS.map((h) => ({ v: h.k === 0 ? 'K' : h.k === 1 ? 'G' : 'R', t: h.t, s: h.s }))
      .concat(S.STEPS.filter((x) => x.t < S.T.cut).map((x, i) => ({ v: 'E', t: x.t, s: Math.min(1, Math.abs(x.amt) * 1.6), seed: i * 13 + x.p })))
      .concat(post.EV.filter((e) => e.t > S.T.rupt));
    return { T: S.T, EV, X: post.X.filter((x) => x.t > S.T.rupt) };
  };
  // Grieta: grietas (k0 golpe, k1 fantasma), la grieta principal que sube a saltos, reloj y groove de 84 bpm
  const grt = (S) => {
    const EV = [];
    S.CRACKS.forEach((c, i) => EV.push(c.k === 0 ? { v: 'S', t: c.t, s: c.s, px: c.x * 2, seed: i } : { v: 'G', t: c.t, s: c.s * 2, px: c.x * 2 }));
    S.MAIN.forEach((m, i) => EV.push({ v: 'E', t: m.t, s: 0.5 + (m.y1 - m.y0), seed: i * 5 }, { v: 'B', t: m.t, s: 0.6, note: Math.round((m.y1 + 1.8) * 2) % 7 === 3 ? 3 : 0 }));
    (S.CLOCK || []).concat(S.GROOVE || []).forEach((g) => EV.push({ v: g.v === 'k' ? 'K' : g.v === 's' ? 'S' : 'G', t: g.t, s: g.s }));
    EV.push({ v: 'R', t: S.T.rupt, s: 1 });
    return { T: S.T, EV, X: [] };
  };
  Object.assign(PIEZAS, {
    cimatica:  evPieza({ g: 'CIM', dur: 24.5, root: 38.89, kick: 46, opt: { gain: 0.45, tickLP: 7500, tickGain: 1.3, iceGain: 1.3 }, tick: 2200, snare: 900, metal: 1300, room: 0.34 }),
    teseracto: evPieza({ g: 'TSR', dur: 24.5, root: 36.7, kick: 48, prep: tsr, opt: { gain: 0.38, tickLP: 8000, tickGain: 1.5, iceGain: 1.4 }, tick: 2600, snare: 1150, metal: 1700 }),
    grieta:    evPieza({ g: 'GRT', dur: 24.5, root: 27.5, kick: 44, prep: grt, parts: [2, 3, 4, 6], opt: { gain: 0.45, tickLP: 7500, tickGain: 1.3, iceGain: 1.2 }, tick: 2300, snare: 1000, metal: 1500, room: 0.32 }),
    // Masa: el núcleo late (pulso de la veta, ~2,4 s), la grieta se abre en crack0, se congela en freeze, revienta en rupt
    masa: evPieza({ build: () => compone({ T: { tense: 8.8, cut: 12.4, rupt: 13.0, post: 18.2, sting: 19.0 }, bpm: 86, seed: 2711, groove: 6.2, n2: 5,
      extra: (push) => { for (let k = 0; ; k++) { const t = (1.2 + Math.PI / 2 + 2 * Math.PI * k) / 2.6; if (t > 6.2) break; push('V', t - 0.5, 0.7, { end: t }); push('K', t, 1, { big: 1 }); } } }),
      dur: 24.5, root: 32.7, rootPost: 24.5, kick: 44, opt: { gain: 0.5, tickLP: 8000, tickGain: 1.6, iceGain: 1.6 }, tick: 2200, snare: 1000, metal: 1400, room: 0.34 }),
    // Estratos: las 26 láminas se escanean una a una (1,6 → 7 s), se separan, se congelan y chascan en snap
    estratos: evPieza({ build: () => compone({ T: { tense: 9.2, cut: 11.6, rupt: 12.2, post: 16.6, sting: 19.0 }, bpm: 112, seed: 2727, groove: 7.0, n2: 3,
      extra: (push) => { for (let i = 0; i < 26; i++) push('E', 1.6 + (25 - i) * ((7.0 - 1.6 - 0.6) / 26) + 0.3, 0.45 + 0.02 * i, { seed: i * 17, px: (i % 2 ? 0.6 : -0.6) * (i / 26) }); } }),
      dur: 24.5, root: 41.2, rootPost: 41.2, opt: { gain: 0.44, tickLP: 8000, tickGain: 1.2, iceGain: 1.5 }, tick: 3000, snare: 1300, metal: 2400, room: 0.3 }),
  });

  // render sin conexión → AudioBuffer (el live lo usa como el audio grabado: loops, reverse, velocidad…)
  async function renderBuffer(nombre, S, seed, sr, dur) {
    const P = PIEZAS[nombre]; sr = sr || 48000;
    const ctx = new OfflineAudioContext(2, Math.ceil((dur || P.dur) * sr), sr);
    const M = root.VLVoces.Motor(ctx, ctx.destination, Object.assign({ seed, room: P.room }, P.opt));
    Object.assign({}, P, { dur: dur || P.dur }).play(M, S, 0);
    return ctx.startRendering();
  }
  async function render(nombre, S, seed, sr, dur) { const b = await renderBuffer(nombre, S, seed, sr, dur); return [b.getChannelData(0), b.getChannelData(1)]; }
  // pieza del live (id de carpeta, p. ej. lab-33-escarcha) → mapeo
  // partitura: la de la pieza (global g) o la compuesta aquí (build)
  function find(id) { const k = Object.keys(PIEZAS).find((n) => new RegExp('-' + n + '/?$').test(String(id))); return k ? Object.assign({ k }, PIEZAS[k]) : null; }

  root.VLPiezas = { PIEZAS, render, renderBuffer, find };
})(typeof window !== 'undefined' ? window : globalThis);
