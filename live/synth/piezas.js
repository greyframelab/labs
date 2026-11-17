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
      g: 'ESC', dur: 25.5, root: 49.0, rootPost: 39.2, room: 0.26, opt: { gain: 0.32, top: 9000, tickLP: 3800, tickGain: 0.55 },
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
      g: 'CMP', dur: 24.5, root: 41.2, room: 0.3, opt: { gain: 0.39 },
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
      g: 'ECO', dur: 24.5, root: 27.5, room: 0.38, opt: { gain: 0.58, tickGain: 1.7, pingBright: 1.6, tickLP: 9000 },
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
    // Anillo: UMBRA (fantasmas de bombo → bombo suave, de caja → tick; toms y clics de resonador fuera; 909 en los charles)
    anillo:    evPieza({ g: 'ANI', dur: 29.25, root: 34.65, parts: [2, 3, 4], prep: (S) => ({ T: S.T, X: S.X, EV: S.EV.filter((e) => e.v !== 'P' && e.v !== 'c').map((e) => e.v === 'k' ? Object.assign({}, e, { v: 'K', s: e.s * 0.6 }) : e.v === 's' ? Object.assign({}, e, { v: 'G' }) : e) }), opt: { gain: 0.4, tickLP: 8000, tickGain: 1.2, bassGain: 1.4 }, bassCut: 2200, sub: 0.3, dron: 0.4, kick: 46, snare: 1400, hats: 'hat', bassOct: 2, room: 0.3 }),
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

  // ================= NADIR · dark ambient (Blade Runner a la manera de Tineidae): sin batería.
  // La misma partitura: bombos → olas de sub, golpes → destellos, bajo → cambios de acorde, ruptura → apertura del acorde.
  function eventos(P, S) {
    if (P.prep) S = P.prep(S);
    if (S.EV) return { T: S.T, EV: S.EV };
    const EV = [];
    if (P.g === 'ECO') S.PULSES.forEach((p) => EV.push(p.k === 0 ? { v: 'E', t: p.t, s: p.s ?? 1, f: hz(p.v + 48), far: p.far } : p.k === 1 ? { v: 'H', t: p.t, s: p.s ?? 1 } : { v: 'K', t: p.t, s: 1, big: 1 }, ...(p.k === 2 ? [{ v: 'B', t: p.t, s: 1 }] : [])));
    if (P.g === 'CMP') {
      S.PULSES.forEach((p) => EV.push({ v: [ 'K', 'S', 'H', 'S', 'B', 'E' ][p.k] || 'H', t: p.t, s: p.s ?? 1 }));
      S.GROOVE.forEach((g) => EV.push({ v: g.v === 'k' ? 'K' : g.v === 's' ? 'S' : 'H', t: g.t, s: g.s ?? 1 }));
    }
    EV.sort((a, b) => a.t - b.t);
    return { T: S.T, EV };
  }
  function nadir(P, S, M, t0, dur) {
    const { T, EV } = eventos(P, S);
    const cut = T.cut != null ? T.cut : T.horizon != null ? T.horizon : T.freeze, rupt = T.rupt != null ? T.rupt : T.align != null ? T.align : cut;
    const r0 = P.root, r1 = P.rootPost || r0, V = M.V;
    const oct = (f, lo, hi) => { while (f < lo) f *= 2; while (f > hi) f /= 2; return f; };
    const st = (t) => (t >= rupt ? r1 : r0);
    // dron: raíz + quinta, se abre con la tensión, silencio antes de la ruptura
    const TT = { tense: T.tense != null ? T.tense : Math.max(1, cut - 3.5), cut, rupt };
    const N = P.nd || {}, off = (k) => (k === 'dron' && N.bajo) || (N.capas ? !N.capas.includes(k) : (N.off || []).includes(k));
    if (off('dron')) { if (cut < rupt) M.silencio(t0 + cut, t0 + rupt); }
    else {
      const d = M.Dron({ root: r0, parts: [2, 3, 4, 5], cut: 340, partGain: 0.2, sub: 0.32 });
      const d5 = M.Dron({ root: r0 * 1.5, parts: [2, 3], cut: 420, partGain: 0.12, sub: 0.2 });
      const d8 = M.Dron({ root: r0 * 2, parts: [2, 3], cut: 380, partGain: 0.1, sub: 0.15 });   // tercera capa: octava que respira
      dronArco(M, d, TT, t0, 0.5, dur, r1 !== r0 ? r1 : null); dronArco(M, d5, TT, t0, 0.38, dur, r1 !== r0 ? r1 * 1.5 : null); dronArco(M, d8, TT, t0, 0.3, dur, r1 !== r0 ? r1 * 2 : null);
    }
    // armonía: conjunto de alturas por tramo (i · VI · iv · VII o variantes con la semilla), sin acordes protagonistas
    const PROG = N.prog || V.pick([0, 8, 5, 10], [[0, 8, 5, 10], [0, 5, 8, 3], [0, 8, 3, 10], [0, 10, 8, 5]]);
    const SET = { 0: [0, 7, 10, 15], 3: [0, 7, 11, 14], 5: [0, 7, 10, 15], 8: [0, 7, 11, 14], 10: [0, 7, 9, 14] };
    const alturas = (t, k, lo, hi) => { const deg = PROG[k % PROG.length], b = st(t) * Math.pow(2, deg / 12); return (N.set || SET[deg] || SET[0]).map((iv) => oct(b * Math.pow(2, iv / 12), lo, hi)); };
    const ch = [0.0]; let last = 0;
    EV.forEach((e) => { if (e.v === 'B' && e.t - last > 3.6 && e.t < cut - 1 && e.t > 2) { ch.push(e.t); last = e.t; } });
    if (ch.length < 3) for (let x = 4.8; x < cut - 1.5; x += 4.8) if (!ch.some((c) => Math.abs(c - x) < 2)) ch.push(x);
    ch.sort((a, b) => a - b);
    const tramo = (t) => { let k = 0; ch.forEach((c, i) => { if (t >= c) k = i; }); return k; };
    ch.forEach((c, i) => {
      const end = i + 1 < ch.length ? ch[i + 1] : cut, ten = Math.max(0, Math.min(1, (c - TT.tense) / (cut - TT.tense)));
      // fondo: pad oscuro, casi sin presencia (raíz + quinta, filtro cerrado)
      const pb = oct(alturas(c, i, 60, 120)[0], 60, 120);
      if (!off('pad')) M.cs80(t0 + c, { notes: [pb, pb * 1.5, pb * 2], dur: end - c + 0.4, att: 2.5, rel: 2.5, vel: 0.7 * (N.pad ?? 1), cut: 420 + 260 * ten, send: 0.8 });
      // nube helada que se densifica con la tensión
      if (!off('nube')) M.nube(t0 + c, { dur: end - c, fs: alturas(c, i, N.lo || 220, N.hi || 700), dens: (7 + 18 * ten) * (N.nube ?? 1), vel: 0.6 + 0.4 * ten, seed: i * 31 + 7, up: 0.2 + 0.2 * ten });
      // resonancia metálica lenta en medio del tramo
      if (!off('reso')) M.reso(t0 + c + (end - c) * 0.25, { f: alturas(c, i, 140, 360)[1], dur: Math.min(5, (end - c) * 0.9), vel: 0.6 * (N.reso ?? 1), pan: i % 2 ? 0.5 : -0.5 });
    });
    // ruptura: retumbo lejano enorme y la nube se abre en todo el campo
    const pr = (T.sting || dur - 5) - rupt;
    if (!N.golpe) M.bloom(t0 + rupt, { f: oct(r1, 28, 55), vel: 1.4, dec: 7, att: 0.04 });
    // instrumento grave propio, subida hacia el corte y golpe de ruptura (cinemática)
    if (N.bajo) M.bajo(t0 + 0.05, t0 + dur - 0.2, Object.assign({ f: oct(r0 * (N.bajo.oct || 1), N.bajo.lo || 30, N.bajo.hi || 62), f2: oct(r1 * (N.bajo.oct || 1), N.bajo.lo || 30, N.bajo.hi || 62), tr: t0 + rupt }, N.bajo));
    if (N.riser && cut < rupt) M.riser(t0 + Math.max(1, Math.min(TT.tense, cut - 2.5)), t0 + cut, { tipo: N.riser, f: oct(r0 * 4, 90, 180), vel: N.riserVel || 1 });
    if (N.golpe) M.golpe(t0 + rupt, { tipo: N.golpe, f: oct(r1, 30, 58), vel: N.golpeVel || 1 });
    if (!off('nube')) M.nube(t0 + rupt, { dur: pr, fs: alturas(rupt, 0, 200, 800), dens: 22, vel: 1.0, seed: 913, up: 0.35, shape: 1.6, env: (x, d) => Math.exp(-x / (d * 0.55)) });
    if (!off('pad')) M.cs80(t0 + rupt + 0.2, { notes: [oct(r1 * 2, 60, 120), oct(r1 * 3, 90, 180), oct(r1 * 4, 120, 240)], dur: pr, att: 1.6, rel: 4, vel: 0.8, cut: 560, send: 0.9 });
    if (!off('reso')) M.reso(t0 + rupt + 0.6, { f: alturas(rupt, 0, 140, 360)[2], dur: 6, vel: 0.8, pan: -0.4 });
    if (!off('reso')) M.reso(t0 + rupt + 2.4, { f: alturas(rupt, 2, 140, 360)[1], dur: 6, vel: 0.6, pan: 0.5 });
    const silent = (t) => cut < rupt && t >= cut - 0.005 && t < rupt;
    let lk = -9, lg = -9;
    EV.forEach((e, i) => {
      if (e.t < 0 || silent(e.t) || Math.abs(e.t - rupt) < 0.2) return;
      const t = t0 + e.t, s = e.s ?? 1, k = e.t < rupt ? tramo(e.t) : 0;
      if (e.v === 'K' && !off('bloom') && !(N.bajo && !(N.capas || []).includes('bloom')) && (s >= 0.7 || e.big) && e.t - lk > 1.4) { lk = e.t; M.bloom(t, { f: oct(st(e.t), 28, 55), vel: (e.big ? 0.9 : 0.6) * Math.min(1, s), dec: 3 }); }
      else if ((e.v === 'S' || e.v === 'E' || e.v === 'P') && !off('chispa') && e.t - lg > 0.4) { lg = e.t; M.nube(t, { dur: 0.6, fs: e.f ? [oct(e.f, 260, 900)] : alturas(e.t, k, 260, 900), dens: 10, vel: 0.9 * Math.min(1, s), seed: i, shape: 2.2, env: (x, d) => 1 - x / d }); }
      else if (e.v === 'V') M.swell(t, { end: t0 + (e.end || e.t + 0.6), vel: 0.35, f: oct(st(e.t) * 2, 70, 140), top: 1100 });
    });
    if (N.sig) N.sig(M, { T, EV, t0, dur, cut, rupt, r0, r1, st, oct, alturas, tramo, ch, silent, H, V });
    if (T.sting != null && !off('nube')) M.nube(t0 + T.sting, { dur: 1.6, fs: alturas(T.sting, 0, 260, 900), dens: 12, vel: 0.9, seed: 77, shape: 1.8, env: (x, d) => 1 - x / d });
  }
  const ok = (x, e) => !(e.t < 0 || x.silent(e.t));
  const ND = {
    masa: { bajo: { tipo: 'arco', oct: 2, lo: 50, hi: 100, cut: 900, vel: 1.1 }, riser: 'rev', golpe: 'slam', gain: 0.67, set: [0, 1, 7, 10], prog: [0, 1, 0, 10], off: ['nube', 'pad', 'chispa'], room: 0.35, sala: { irDur: 3.2, irDamp: 1400, top: 3000 }, sig(M, x) {
      // metal arqueado muy grave en una cámara cerrada: un arco por latido del núcleo, otro largo que se dobla en la ruptura
      for (let k = 0; ; k++) { const t = (1.2 + Math.PI / 2 + 2 * Math.PI * k) / 2.6; if (t > x.cut) break; M.arco(x.t0 + Math.max(0, t - 1.1), { f: x.oct(x.r0 * 2, 55, 110) * (k % 2 ? 1.5 : 1), dur: 2.4, vel: 0.8 + 0.1 * k, pan: k % 2 ? 0.3 : -0.3 }); }
      x.EV.forEach((e, i) => { if ((e.v === 'S' || e.v === 'E') && ok(x, e) && x.H(i, 2) < 0.3) M.arco(x.t0 + e.t, { f: x.oct(x.st(e.t) * 3, 90, 180), dur: 1.4, vel: 0.5, pan: (x.H(i, 3) - 0.5) }); });
      M.arco(x.t0 + x.rupt, { f: x.oct(x.r1 * 2, 50, 100), f2: x.oct(x.r1 * 2, 50, 100) * 0.75, dur: 6.5, vel: 1.3 }); } },
estratos: { bajo: { tipo: 'organo', cut: 900, vel: 0.9 }, riser: 'up', golpe: 'braam', gain: 0.82, set: [0, 7, 10, 14, 17], off: ['nube', 'pad', 'reso', 'chispa', 'bloom'], room: 0.8, sala: { irDur: 9, irDamp: 2600, top: 4200 }, sig(M, x) {
      // acordes en la niebla: cada lámina escaneada es un acorde menor filtrado que se disuelve en una sala enorme
      x.EV.forEach((e, i) => { if ((e.v === 'E' || e.v === 'S' || (e.v === 'K' && (e.s ?? 1) > 0.8)) && ok(x, e)) {
        const fs = x.alturas(e.t, x.tramo(e.t), 130, 520); M.niebla(x.t0 + e.t, { notes: fs, vel: 0.6 + 0.3 * Math.min(1, e.s ?? 1), cut: 600 + 700 * x.H(i, 3), dec: 1.6, pan: (x.H(i, 4) - 0.5) * 0.8 }); } });
      M.niebla(x.t0 + x.rupt, { notes: x.alturas(x.rupt, 0, 90, 400), vel: 1.3, cut: 1400, dec: 5 }); } },
    eco: { gain: 0.67, set: [0, 7, 10, 19], capas: [], bajo: { tipo: 'glide', vel: 1.1, cut: 500 }, riser: 'rev', golpe: 'subdrop', room: 0.85, sala: { irDur: 11, irDamp: 1800, top: 3200 }, sig(M, x) {
      // fondo marino: cantos que se deslizan como de ballena y un sonar muy lejano que rebota en la sala
      let l = -9; x.EV.forEach((e, i) => { if (e.v === 'E' && ok(x, e) && e.t - l > 2.2) { l = e.t; const f = x.oct(e.f || x.r0 * 8, 180, 420);
        M.reso(x.t0 + e.t, { f, f2: f * (x.H(i, 2) < 0.5 ? 0.75 : 1.33), dur: 2.6 + x.H(i, 3), vel: 1.4, pan: (x.H(i, 4) - 0.5) * 1.4, send: 1.2 }); } });
      let lp = -9; x.EV.forEach((e, i) => { if (e.v === 'E' && ok(x, e) && e.t - lp > 3) { lp = e.t; M.ping(x.t0 + e.t + 0.4, { f: x.oct(x.r0 * 16, 500, 900), far: 1, vel: 0.35, dec: 0.4, size: 2.6 }); } });
      M.reso(x.t0 + x.rupt + 0.8, { f: x.oct(x.r1 * 8, 180, 360), f2: x.oct(x.r1 * 4, 90, 180), dur: 7, vel: 1.6, send: 1.2 }); } },
teseracto: { bajo: { tipo: 'fm', cut: 600, vel: 0.9 }, riser: 'up', golpe: 'braam', gain: 1.03, set: [0, 3, 7, 10, 14], prog: [0, 8, 3, 10], off: ['nube', 'reso', 'chispa'], pad: 0.6, room: 0.7, sala: { irDur: 7, irDamp: 2800, top: 4500, arpGain: 2.2 }, sig(M, x) {
      // arpegiador en la niebla: un ciclo por tramo, el patrón muta con cada giro del hipercubo; en la ruptura se invierte
      x.ch.concat([x.cut]).reduce((a, c, i) => { const st = 0.16 + 0.04 * (i % 2); M.arpegio(x.t0 + a, { notes: x.alturas(a, i, 200, 800), step: st, n: Math.floor((c - a) / st), salto: [1, 2, 3, 2][i % 4], seed: i * 11, fase: i, vel: 0.9 }); return c; });
      const post = (x.T.sting || x.dur - 5) - x.rupt - 0.5;
      M.arpegio(x.t0 + x.rupt + 0.5, { notes: x.alturas(x.rupt, 0, 200, 800).reverse(), step: 0.3, n: Math.floor(post / 0.3), salto: 3, seed: 99, vel: 0.8, skip: 0.3 }); } },
campo: { bajo: { tipo: 'hum', cut: 420, vel: 0.8 }, riser: 'pres', golpe: 'slam', gain: 1.11, set: [0, 5, 7, 12], off: ['nube', 'pad', 'reso', 'chispa'], room: 0.5, sala: { irDur: 4, irDamp: 2400, top: 3800, radioGain: 2.2 }, sig(M, x) {
      // transmisiones: cada pulso del campo es una emisora que se sintoniza; tras la ruptura, una señal larga que se pierde
      let l = -9; x.EV.forEach((e, i) => { if (e.v !== 'H' && ok(x, e) && e.t - l > 0.7) { l = e.t;
        const fs = x.alturas(e.t, x.tramo(e.t), 180, 700); M.radio(x.t0 + e.t, { f: fs[Math.floor(x.H(i, 1) * fs.length)], dur: 0.6 + 1.4 * x.H(i, 2), am: 4 + 14 * x.H(i, 3), from: 0.7 + 0.7 * x.H(i, 4), vel: 0.8, pan: (x.H(i, 5) - 0.5) * 1.6 }); } });
      M.radio(x.t0 + x.rupt + 0.4, { f: x.oct(x.r1 * 8, 250, 500), dur: 7, am: 2.5, from: 2, vel: 1.1 }); } },
    grieta: { gain: 0.74, set: [0, 1, 5, 7], capas: ['bloom'], bajo: { tipo: 'tecto', vel: 1.2, cut: 260 }, riser: 'down', golpe: 'slam', room: 0.4, sala: { irDur: 3.5, irDamp: 1200, top: 2600 }, sig(M, x) {
      // tectónica: fricción de piedra (crujido grave) en cada grieta, sin armonía; retumbos de placa
      let l = -9; x.EV.forEach((e, i) => { if ((e.v === 'S' || e.v === 'G' || e.v === 'E') && ok(x, e) && e.t - l > 0.45) { l = e.t; M.crackle(x.t0 + e.t, { len: 0.3 + 0.5 * x.H(i, 1), n: 10 + Math.round(14 * x.H(i, 2)), vel: 0.6, seed: i, lo: 0.1 + 0.08 * x.H(i, 3) }); } });
      M.crackle(x.t0 + x.rupt + 0.1, { len: 2.4, n: 60, vel: 0.9, seed: 3, lo: 0.09 }); } },
cimatica: { riser: 'up', golpe: 'coro', gain: 1.01, set: [0, 7, 12, 15, 19], off: ['nube', 'pad', 'reso', 'chispa', 'dron'], room: 0.7, sala: { irDur: 8, irDamp: 3000, top: 5000 }, sig(M, x) {
      // coro sintético que cambia de vocal con cada figura de la placa; bajo de órgano muy grave debajo
      const voc = ['u', 'o', 'a', 'o', 'e'];
      x.ch.concat([x.cut]).reduce((a, c, i) => { M.coro(x.t0 + a, { notes: x.alturas(a, i, 110, 330), dur: c - a + 0.2, vocal: voc[i % 5], vel: 0.9, att: i ? 1.2 : 2.5 }); return c; });
      M.Dron && M.coro(x.t0 + 0.2, { notes: [x.oct(x.r0, 30, 60), x.oct(x.r0 * 2, 60, 120)], dur: x.cut - 0.3, vocal: 'u', vel: 0.7, formant: 0.5, att: 3 });
      M.coro(x.t0 + x.rupt + 0.2, { notes: x.alturas(x.rupt, 0, 90, 360).concat([x.oct(x.r1, 30, 60)]), dur: Math.max(3, (x.T.sting || x.dur - 5) - x.rupt), vocal: 'a', vel: 1.2, att: 0.8 }); } },
    escarcha: { bajo: { tipo: 'vidrio', oct: 4, lo: 120, hi: 240, cut: 2000, vel: 0.7 }, riser: 'rev', golpe: 'subdrop', gain: 0.57, set: [0, 7, 14, 21], off: ['pad', 'nube', 'reso', 'bloom', 'chispa'], room: 0.25, sala: { irDur: 2.2, irDamp: 5200, top: 7000 }, sig(M, x) {
      // cristal frotado en una sala pequeña y seca: cada golpe de hielo es un vaso que canta, en quintas apiladas
      let l = -9; x.EV.forEach((e, i) => { if ((e.v === 'S' || e.v === 'H' || e.v === 'C') && ok(x, e) && e.t - l > 0.55) { l = e.t;
        const fs = x.alturas(e.t, x.tramo(e.t), 420, 1250); M.vidrio(x.t0 + e.t, { f: fs[Math.floor(x.H(i, 5) * fs.length)], dur: 2 + 1.5 * x.H(i, 6), vel: 0.6 + 0.4 * Math.min(1, e.s ?? 1), beat: 0.4 + 1.6 * x.H(i, 7), pan: (x.H(i, 8) - 0.5) * 1.6 }); } });
      x.alturas(x.rupt, 0, 420, 1250).forEach((f, j) => M.vidrio(x.t0 + x.rupt + j * 0.18, { f, dur: 6, vel: 0.9, beat: 0.3 + j * 0.4, pan: (j - 1.5) * 0.5, att: 0.08 })); } },
    horizonte: { gain: 0.67, set: [0, 7, 14, 16, 21], prog: [0, 5, 10, 0], capas: ['pad'], pad: 1.1, bajo: { tipo: 'aurora', cut: 380, open: 1300, cresc: 1.5, rise: 1.0595, vel: 0.9 }, riser: 'up', golpe: 'braam', room: 0.75, sala: { irDur: 9, irDamp: 3200, top: 5200 }, sig(M, x) {
      // amanecer en otro planeta: un acorde que sube muy despacio hacia la luz; tras la ruptura se abre en mayor
      M.swell(x.t0 + 0.5, { end: x.t0 + x.cut - 0.1, vel: 0.6, f: x.oct(x.r0 * 2, 70, 140), top: 1600 });
      x.ch.forEach((c, i) => M.coro(x.t0 + c + 0.5, { notes: x.alturas(c, i, 150, 420).slice(0, 3), dur: 3, vocal: 'o', vel: 0.45 + 0.15 * i, att: 2 }));
      [0, 4, 7, 11, 14].forEach((iv, j) => M.vidrio(x.t0 + x.rupt + 0.9 + j * 0.55, { f: x.oct(x.r1 * Math.pow(2, iv / 12) * 8, 300, 900), dur: 5, vel: 0.8, beat: 0.5 + j * 0.3, att: 0.6, pan: (j - 2) * 0.3 })); } },
    descarga: { gain: 1.23, set: [0, 3, 7, 8], capas: ['bloom'], bajo: { tipo: 'braam', cut: 260, open: 700, vel: 0.75, drive: 2 }, riser: 'pres', golpe: 'braam', room: 0.6, sala: { irDur: 6, irDamp: 1600, top: 3000 }, sig(M, x) {
      // tormenta lejana: truenos (retumbo + crujido grave) y metales graves que amenazan
      let l = -9; x.EV.forEach((e, i) => { if ((e.v === 'S' || e.v === 'R') && ok(x, e) && e.t - l > 1.6) { l = e.t; M.crackle(x.t0 + e.t, { len: 0.5, n: 16, vel: 0.55, seed: i, lo: 0.16 }); M.bloom(x.t0 + e.t + 0.12, { f: x.oct(x.r0, 28, 50), vel: 0.6, dec: 4, att: 0.25 }); } });
      x.ch.forEach((c, i) => M.arco(x.t0 + c + 0.8, { f: x.oct(x.st(c) * 3, 70, 150), dur: 3, vel: 0.7, pan: i % 2 ? 0.4 : -0.4 })); } },
    engranaje: { gain: 1.19, set: [0, 7, 10, 17], capas: [], bajo: { tipo: 'motor', vel: 1.1, cut: 900 }, riser: 'up', golpe: 'slam', room: 0.45, sala: { irDur: 4.5, irDamp: 2000, top: 3600 }, sig(M, x) {
      // máquina dormida: golpes metálicos graves en ciclo lento que siguen a los engranes, sobre el motor
      let l = -9; x.EV.forEach((e, i) => { if ((e.v === 'E' || e.v === 'M') && ok(x, e) && e.t - l > 0.9) { l = e.t; M.ice(x.t0 + e.t, { f: x.oct(x.st(e.t) * 6, 180, 420), vel: 0.6, dec: 0.5, send: 0.9, thump: 1, pan: (x.H(i, 2) - 0.5) }); } });
      for (let t = 1.0, j = 0; t < x.dur - 4; t += 2.2, j++) if (!x.silent(t)) M.arco(x.t0 + t, { f: x.oct(x.st(t) * [3, 4, 3, 5][j % 4], 90, 200), dur: 2, vel: 0.55, pan: j % 2 ? 0.5 : -0.5 }); } },
    tokamak: { bajo: { tipo: 'subpulso', rate: 1.1, vel: 1 }, golpe: 'subdrop', gain: 0.73, set: [0, 6, 12, 18], off: ['nube', 'pad', 'chispa', 'reso'], room: 0.45, sala: { irDur: 5, irDamp: 2400, top: 5000 }, sig(M, x) {
      // plasma contenido: presión FM con trémolo cada vez más rápido hasta el corte; en la ruptura se libera en un retumbo y un arco
      M.presion(x.t0 + 0.4, x.t0 + x.cut, { f: x.oct(x.r0 * 2, 80, 140), vel: 1 });
      M.presion(x.t0 + 2.5, x.t0 + x.cut, { f: x.oct(x.r0 * 3, 120, 220), vel: 0.6 });
      M.bloom(x.t0 + x.rupt, { f: x.oct(x.r1, 26, 45), vel: 1.3, dec: 8, att: 0.02 });
      M.arco(x.t0 + x.rupt + 0.3, { f: x.oct(x.r1 * 2, 55, 110), dur: 7, vel: 1 });
      M.arco(x.t0 + x.rupt + 2.0, { f: x.oct(x.r1 * 3, 80, 160), dur: 6, vel: 0.7, pan: 0.5 }); } },
    ciudad: { bajo: { tipo: 'cs80', cut: 520, open: 1200, vel: 0.9 }, riser: 'rev', golpe: 'braam', gain: 1.04, set: [0, 3, 7, 10, 14], off: ['nube', 'chispa'], pad: 1.8, room: 0.75, sala: { irDur: 10, irDamp: 3600, top: 6500 }, sig(M, x) {
      // metrópolis de noche: acordes CS-80 y una voz solista con portamento que deja frases sueltas, sala infinita
      x.ch.forEach((c, i) => { const f = x.alturas(c, i, 90, 180); M.cs80(x.t0 + c + 0.3, { notes: [f[1], f[2], f[4] || f[3]], dur: 3.2, att: 1.8, rel: 3.5, vel: 0.6, cut: 1200 }); });
      const esc = [0, 3, 5, 7, 10, 12].map((iv) => x.oct(x.r0 * 8, 300, 600) * Math.pow(2, iv / 12));
      const frases = [[3, 2, 0, 1], [4, 3, 1, 0, 2], [5, 4, 3, 1]];
      x.ch.slice(1).forEach((c, i) => M.lead(x.t0 + c + 0.6, { notes: frases[i % 3].map((j) => esc[j]), step: 0.75, vel: 0.9, pan: i % 2 ? 0.25 : -0.25 }));
      M.lead(x.t0 + x.rupt + 1.2, { notes: [esc[5], esc[4], esc[3], esc[1], esc[0]].map((f) => f / 2), step: 1.1, vel: 1 }); } },
    espejos: { gain: 0.99, set: [0, 5, 10, 15], capas: [], bajo: { tipo: 'revswell', periodo: 2.1, cut: 380, vel: 1 }, riser: 'rev', golpe: 'coro', room: 0.7, sala: { irDur: 8, irDamp: 2800, top: 4200 }, sig(M, x) {
      // todo al revés: cada sonido crece hacia su golpe y se corta; la frase de cuatro notas se refleja y se apaga en el estéreo
      let l = -9; x.EV.forEach((e, i) => { if ((e.v === 'S' || e.v === 'E' || e.v === 'K') && ok(x, e) && e.t - l > 0.8 && e.t > 0.8) { l = e.t; M.swell(x.t0 + e.t - 0.7, { end: x.t0 + e.t, vel: 0.5, f: x.oct(x.st(e.t) * 4, 110, 220) * [1, 1.335, 1.5, 1.78][i % 4], top: 1500, pan: (i % 2 ? 0.6 : -0.6) }); } });
      const fr = [0, 10, 5, 15].map((iv) => x.oct(x.r0 * Math.pow(2, iv / 12) * 8, 330, 900));
      for (let r = 0; r < 5; r++) { const t = 1.2 + r * 2.1; if (t > x.cut - 1) break; fr.forEach((f, j) => M.vidrio(x.t0 + t + j * 0.32, { f, vel: 0.9 * Math.pow(0.72, r), dur: 1.6, beat: 0.6, pan: (r % 2 ? 1 : -1) * (0.2 + 0.15 * r) })); } } },
    pliegue: { gain: 1.36, set: [0, 2, 7, 9], capas: ['pad'], pad: 0.8, bajo: { tipo: 'wow', cut: 420, vel: 0.9 }, riser: 'down', golpe: 'subdrop', room: 0.65, sala: { irDur: 7, irDamp: 2400, top: 3800 }, sig(M, x) {
      // cinta deformada: alturas que se curvan (glissandos lentos) sobre un pad con wow
      x.ch.forEach((c, i) => M.reso(x.t0 + c + 0.5, { f: x.oct(x.st(c) * 6, 160, 400), f2: x.oct(x.st(c) * 6, 160, 400) * (i % 2 ? 0.84 : 1.19), dur: 4, vel: 1.3, pan: i % 2 ? 0.5 : -0.5 }));
      M.reso(x.t0 + x.rupt + 0.3, { f: x.oct(x.r1 * 8, 200, 400), f2: x.oct(x.r1 * 4, 100, 200), dur: 6, vel: 1.4 }); } },
  };
  ND.anillo = { gain: 0.93, set: [0, 7, 10, 14], capas: [], bajo: { tipo: 'orbita', cut: 700, vel: 1 }, riser: 'up', golpe: 'braam', room: 0.8, sala: { irDur: 10, irDamp: 2400, top: 4200 }, sig(M, x) {
      // órbita: las rocas de hielo pasan de lado a lado (tonos que caen al pasar, como un doppler); al salir el sol, el acorde se abre
      let l = -9; x.EV.forEach((e, i) => { if ((e.v === 'S' || e.v === 'K' || e.v === 'B') && ok(x, e) && e.t - l > 0.9) { l = e.t; const f = x.oct(x.st(e.t) * [6, 8, 9, 12][i % 4], 170, 480);
        M.reso(x.t0 + e.t, { f, f2: f * 0.86, dur: 1.4 + 0.8 * x.H(i, 2), vel: 1.1, pan: (i % 2 ? 0.75 : -0.75), send: 1 }); } });
      const dia = x.T.dia || x.rupt + 7;
      [0, 7, 14, 16, 21].forEach((iv, j) => M.vidrio(x.t0 + dia + j * 0.35, { f: x.oct(x.r1 * Math.pow(2, iv / 12) * 8, 260, 900), dur: 4, vel: 0.9, beat: 0.4 + 0.3 * j, att: 0.5, pan: (j - 2) * 0.35 }));
      M.coro(x.t0 + dia, { notes: x.alturas(dia, 0, 110, 330), dur: 2.5, vocal: 'a', vel: 0.8, att: 0.8 }); } };
  Object.keys(ND).forEach((k) => { if (PIEZAS[k]) PIEZAS[k].nd = ND[k]; });

  const NADIR = { room: 0.65, opt: { gain: 0.44, top: 5200, irDur: 8, irDamp: 2200, nubeGain: 3.2, resoGain: 2.0, bloomGain: 0.6, padGain: 1.3 } };

  // render sin conexión → AudioBuffer (el live lo usa como el audio grabado: loops, reverse, velocidad…)
  async function renderBuffer(nombre, S, seed, sr, dur, modo) {
    const P = PIEZAS[nombre]; sr = sr || 48000; dur = dur || P.dur;
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
    if (modo === 'nadir') {
      const M = root.VLVoces.Motor(ctx, ctx.destination, Object.assign({ seed, room: NADIR.room }, NADIR.opt, { gain: NADIR.opt.gain * ((P.nd && P.nd.gain) || 1) }, (P.nd && P.nd.sala) || {}, { room: (P.nd && P.nd.room) != null ? P.nd.room : NADIR.room }));
      nadir(P, S, M, 0, dur);
      return ctx.startRendering();
    }
    const M = root.VLVoces.Motor(ctx, ctx.destination, Object.assign({ seed, room: P.room }, P.opt));
    Object.assign({}, P, { dur }).play(M, S, 0);
    return ctx.startRendering();
  }
  async function render(nombre, S, seed, sr, dur, modo) { const b = await renderBuffer(nombre, S, seed, sr, dur, modo); return [b.getChannelData(0), b.getChannelData(1)]; }
  // pieza del live (id de carpeta, p. ej. lab-33-escarcha) → mapeo
  // partitura: la de la pieza (global g) o la compuesta aquí (build)
  function find(id) { const k = Object.keys(PIEZAS).find((n) => new RegExp('-' + n + '/?$').test(String(id))); return k ? Object.assign({ k }, PIEZAS[k]) : null; }

  root.VLPiezas = { PIEZAS, render, renderBuffer, find };
})(typeof window !== 'undefined' ? window : globalThis);
