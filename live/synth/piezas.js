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

  const PIEZAS = {
    // ESCARCHA · 122 bpm · hielo que cruje y se rompe
    escarcha: {
      dur: 25.5, room: 0.26, opt: { gain: 0.38, top: 9000, tickLP: 3800, tickGain: 0.55 },
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
      dur: 24.5, room: 0.3, opt: { gain: 0.46 },
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
      dur: 24.5, room: 0.38, opt: { gain: 0.64, tickGain: 1.7, pingBright: 1.6, tickLP: 9000 },
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

  // render sin conexión (validación) → Float32 L/R
  async function render(nombre, S, seed, sr) {
    const P = PIEZAS[nombre]; sr = sr || 48000;
    const ctx = new OfflineAudioContext(2, Math.ceil(P.dur * sr), sr);
    const M = root.VLVoces.Motor(ctx, ctx.destination, Object.assign({ seed, room: P.room }, P.opt));
    P.play(M, S, 0.05);
    const b = await ctx.startRendering();
    return [b.getChannelData(0), b.getChannelData(1)];
  }

  root.VLPiezas = { PIEZAS, render };
})(typeof window !== 'undefined' ? window : globalThis);
