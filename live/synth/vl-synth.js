/* VØID_LOOM · síntesis en vivo en el navegador (prueba).
   Lee la partitura de la pieza (los mismos eventos que mueven la imagen) y genera cada sonido en el momento
   con Web Audio: osciladores, ruido, filtros y envolventes. No hay ningún archivo de audio.
   Programación con antelación (lookahead) para que un fotograma lento no mueva un golpe. */
(function (root) {
  const hash = (a, b) => { let h = Math.imul((a | 0) * 374761393 + (b | 0) * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ------------------------------------------------------------------ eventos audibles (con los stutters de la partitura)
  function audibleEvents(S) {
    const out = [];
    for (const e of S.EV) {
      const x = S.X.find((x) => e.t >= x.t && e.t < x.t + x.len);
      if (!x) { out.push(e); continue; }
      if (e.t >= x.t + x.div) continue;                          // lo que cae dentro del stutter se sustituye por la repetición
      for (let t = e.t; t < x.t + x.len; t += x.div) out.push(Object.assign({}, e, { t, rep: t > e.t }));
    }
    const T = S.T;
    out.push({ v: 'DRONE', t: 0, on: 1 }, { v: 'DRONE', t: T.cut, on: 0 }, { v: 'DRONE', t: T.rupt, on: 1 }, { v: 'FIRMA', t: T.sting });
    return out.sort((a, b) => a.t - b.t);
  }

  function VLSynth(ctx, dest, S, opts) {
    const P = Object.assign({ tension: 0.5, density: 1, room: 0.35, stress: 1 }, opts || {});
    const T = S.T, EV = audibleEvents(S), DUR = opts && opts.duration || T.sting + 5.5;
    const stats = { voices: 0, scheduled: 0, late: 0, worstMargin: Infinity, tickJitter: 0 };

    // ---------------- buses
    const master = ctx.createGain(); master.gain.value = 0.75;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.001; lim.release.value = 0.08;
    master.connect(comp).connect(lim).connect(dest);
    const dry = ctx.createGain(); dry.connect(master);
    const verb = ctx.createConvolver(); const verbIn = ctx.createGain(); verbIn.gain.value = P.room; verbIn.connect(verb).connect(master);
    const ghost = ctx.createGain(); ghost.gain.value = 0; ghost.connect(dest);  // copias de estrés: cuestan CPU, no se oyen
    {
      const sr = ctx.sampleRate, n = Math.floor(sr * 3.2), b = ctx.createBuffer(2, n, sr);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp += ((hash(i, c + 9) * 2 - 1) - lp) * (0.1 + 0.5 * (1 - t)); d[i] = lp * Math.pow(1 - t, 2.4); } }
      verb.buffer = b;
    }
    const noise = (() => { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = hash(i, 77) * 2 - 1; return b; })();
    const tanh = (k) => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; };
    const SAT = tanh(2.2), SAT_BIG = tanh(4);

    // ---------------- dron (carga): dos sierras con batido + sub, filtro que respira
    const dr = {};
    function startDrone(t0) {
      const f = 41.2;                                                 // Mi grave
      dr.g = ctx.createGain(); dr.g.gain.value = 0;
      dr.duck = ctx.createGain(); dr.duck.gain.value = 1;
      dr.lp = ctx.createBiquadFilter(); dr.lp.type = 'lowpass'; dr.lp.frequency.value = 160; dr.lp.Q.value = 2.5;
      dr.oscs = [f, f * (1.004 + 0.008 * P.tension), f * 1.5 * 1.002].map((fr, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; const g = ctx.createGain(); g.gain.value = i === 2 ? 0.18 : 0.32; o.connect(g).connect(dr.lp); o.start(t0); return o; });
      dr.sub = ctx.createOscillator(); dr.sub.frequency.value = f / 2; const sg = ctx.createGain(); sg.gain.value = 0.45; dr.sub.connect(sg).connect(dr.g); dr.sub.start(t0);
      dr.lp.connect(dr.g); dr.g.connect(dr.duck).connect(dry); dr.duck.connect(verbIn);
      stats.voices += 4;
    }
    function stopDrone(t) { if (!dr.g) return; dr.g.gain.cancelScheduledValues(t); dr.g.gain.setTargetAtTime(0, t, 0.05); [...dr.oscs, dr.sub].forEach((o) => o.stop(t + 0.4)); stats.voices -= 4; dr.g = null; }
    function setTension(v) { P.tension = v; if (dr.oscs) dr.oscs[1].frequency.setTargetAtTime(41.2 * (1.004 + 0.008 * v), ctx.currentTime, 0.2); }

    // ---------------- utilidades de voz
    function track(node, end) { stats.voices++; node.onended = () => stats.voices--; }
    function env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + a + d); }
    function noiseSrc(t, len, seed) { const s = ctx.createBufferSource(); s.buffer = noise; s.start(t, hash(seed, 3) * 1.6, len + 0.05); track(s); return s; }
    function pan(x, out) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x)); p.connect(out); return p; }

    // ---------------- instrumentos
    function kick(t, e, out) {
      const big = !!e.big, rat = !!e.rat, vel = e.s;
      const tail = big ? 0.55 : rat ? 0.09 : 0.24, f0 = big ? 170 : rat ? 120 : 154, f1 = big ? 38 : 44;
      const o = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper(); sh.curve = big ? SAT_BIG : SAT;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + (big ? 0.09 : 0.055));
      env(g, t, 0.002, vel * (rat ? 0.5 : 0.95), tail);
      o.connect(g).connect(sh).connect(out); if (big) sh.connect(verbIn);
      o.start(t); o.stop(t + tail + 0.05); track(o);
      // click
      const n = noiseSrc(t, 0.01, e.seed || 1), hp = ctx.createBiquadFilter(), cg = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 2200;
      env(cg, t, 0.0005, vel * 0.22, 0.008); n.connect(hp).connect(cg).connect(out);
      // el dron se aparta un instante (sidechain)
      if (dr.duck && out !== ghost) { dr.duck.gain.cancelScheduledValues(t); dr.duck.gain.setValueAtTime(0.35, t); dr.duck.gain.setTargetAtTime(1, t + 0.02, big ? 0.12 : 0.07); }
    }
    function arc(t, e, out) {
      const big = !!e.big, vel = e.s, seed = e.seed || 2, p = pan(e.x || 0, out);
      // golpe grave
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
      env(g, t, 0.002, vel * 0.5, big ? 0.3 : 0.12); o.connect(g).connect(p); o.start(t); o.stop(t + 0.45); track(o);
      // chasquido: ruido en banda
      const n = noiseSrc(t, big ? 0.35 : 0.14, seed), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 900 + hash(seed, 5) * 900; bp.Q.value = 3.5;
      env(ng, t, 0.001, vel * 0.55, big ? 0.3 : 0.11); n.connect(bp).connect(ng).connect(p); if (big) ng.connect(verbIn);
      // crepitar: chispas cortas
      const k = big ? 9 : 5;
      for (let i = 0; i < k; i++) {
        const tt = t + hash(seed, 20 + i) * (big ? 0.16 : 0.06), c = noiseSrc(tt, 0.004, seed * 7 + i), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
        hp.type = 'highpass'; hp.frequency.value = 1800; env(cg, tt, 0.0003, vel * 0.18 * (1 - i / k), 0.004); c.connect(hp).connect(cg).connect(p);
      }
    }
    function tick(t, e, out) {
      if (!e.poly && P.density < 1 && hash(e.seed || 0, 91) > P.density) return;
      const seed = e.seed || 3, poly = !!e.poly;
      const fc = poly ? 900 + hash(seed, 1) * 500 : 2600 + hash(seed, 1) * 2800;
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      c.frequency.value = fc; m.frequency.value = fc * 1.41; mg.gain.value = fc * (poly ? 0.6 : 1.4);
      m.connect(mg).connect(c.frequency);
      env(g, t, 0.0006, e.s * (poly ? 0.2 : 0.13), poly ? 0.035 : 0.016);
      c.connect(g).connect(pan(hash(seed, 2) * 1.2 - 0.6, out));
      c.start(t); m.start(t); c.stop(t + 0.06); m.stop(t + 0.06); track(c); track(m);
    }
    function charge(t, e) {
      if (!dr.lp) return;
      const bar = T.bar, f = dr.lp.frequency, top = (e.swell ? 1500 : 520) * (0.7 + 0.6 * P.tension);
      f.cancelScheduledValues(t); f.setValueAtTime(150, t);
      if (e.swell) f.exponentialRampToValueAtTime(top, t + bar * 0.95);
      else { f.exponentialRampToValueAtTime(top, t + bar * 0.35); f.exponentialRampToValueAtTime(160, t + bar * 0.95); }
    }
    function ret(t, e, out) {
      // el retorno: caída de sub + barrido de ruido; el trueno llega después del destello
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.4);
      env(g, t, 0.004, 0.95, 1.6); o.connect(g).connect(out); o.connect(g).connect(verbIn); o.start(t); o.stop(t + 1.8); track(o);
      const n = noiseSrc(t, 1.6, 501), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(9000, t); lp.frequency.exponentialRampToValueAtTime(180, t + 1.5); env(ng, t, 0.002, 0.6, 1.5);
      n.connect(lp).connect(ng).connect(out); ng.connect(verbIn);
      const th = noiseSrc(t + 0.35, 2.6, 502), tl = ctx.createBiquadFilter(), tg = ctx.createGain(); tl.type = 'lowpass'; tl.frequency.value = 140; tl.Q.value = 0.7;
      tg.gain.setValueAtTime(0, t + 0.35); tg.gain.linearRampToValueAtTime(0.9, t + 0.7); tg.gain.exponentialRampToValueAtTime(0.001, t + 2.9);
      th.connect(tl).connect(tg).connect(out);
    }
    function firma(t, out) {
      [55, 82.4, 164.8].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; env(g, t, 0.01, [0.4, 0.18, 0.06][i], 4.5); o.connect(g).connect(out); g.connect(verbIn); o.start(t); o.stop(t + 4.8); track(o); });
      if (dr.g) dr.g.gain.setTargetAtTime(0, t, 1.2);
    }
    function play(e, t, out) {
      switch (e.v) {
        case 'K': return kick(t, e, out);
        case 'S': return arc(t, e, out);
        case 'H': return tick(t, e, out);
        case 'R': return ret(t, e, out);
        case 'B': if (out !== ghost) charge(t, e); return;
        case 'DRONE': if (out !== ghost && dr.g) { dr.g.gain.cancelScheduledValues(t); dr.g.gain.setTargetAtTime(e.on ? 0.22 : 0, t, e.on ? 0.02 : 0.015); } return;
        case 'FIRMA': if (out !== ghost) firma(t, out); return;
      }
    }

    // ---------------- transporte y programación con antelación
    const LOOK = 0.14, TICK = 25;
    let tr = null, timer = null, lastTick = 0;
    const posAt = (ct) => { if (!tr) return 0; let p = tr.pos + (ct - tr.ctx0); if (tr.loop) { const [a, b] = tr.loop; if (p >= b) p = a + ((p - a) % (b - a)); } return p; };
    function droneTarget(p) { return (p < T.cut || (p >= T.rupt && p < T.sting)) ? 0.22 : 0; }
    function scheduleRange(p0, p1, ct0) {                            // piece-time [p0, p1) que suena a partir de ct0
      for (const e of EV) {
        if (e.t < p0) continue; if (e.t >= p1) break;
        const t = ct0 + (e.t - p0);
        const margin = t - ctx.currentTime; stats.worstMargin = Math.min(stats.worstMargin, margin * 1000);
        if (margin < 0) { stats.late++; continue; }
        play(e, t, dry); stats.scheduled++;
        for (let k = 1; k < P.stress; k++) play(e, t, ghost);
      }
    }
    function tickFn() {
      const now = performance.now(); if (lastTick) stats.tickJitter = Math.max(stats.tickJitter * 0.97, now - lastTick - TICK); lastTick = now;
      if (!tr) return;
      const end = ctx.currentTime + LOOK;
      while (tr.sched < end) {
        const ct0 = tr.sched, p0 = posAt(ct0);
        let ct1 = end, p1 = p0 + (ct1 - ct0);
        if (tr.loop && p1 > tr.loop[1]) { ct1 = ct0 + (tr.loop[1] - p0); p1 = tr.loop[1]; }
        if (!tr.loop && p1 >= DUR) { ct1 = ct0 + (DUR - p0); p1 = DUR; }
        scheduleRange(p0, p1, ct0);
        tr.sched = ct1;
        if (tr.loop && p1 >= tr.loop[1] - 1e-6) { if (dr.g) { dr.g.gain.setTargetAtTime(droneTarget(tr.loop[0]), ct1, 0.02); } }
        if (!tr.loop && p1 >= DUR) { stop(); return; }
        if (ct1 <= ct0) break;
      }
    }
    function start(pos, loop) {
      stop(true);
      const t0 = ctx.currentTime + 0.06;
      tr = { pos, ctx0: t0, sched: t0, loop: loop || null };
      startDrone(t0); dr.g.gain.setValueAtTime(droneTarget(pos), t0);
      // estado del filtro según el compás en el que se entra
      if (!timer) timer = setInterval(tickFn, TICK);
      tickFn();
      return t0;
    }
    function stop(keep) { if (dr.g) stopDrone(ctx.currentTime); tr = null; if (!keep && timer) { clearInterval(timer); timer = null; } }
    function setLoop(loop) { if (!tr) return; const ct = ctx.currentTime + LOOK; const p = posAt(tr.sched); start(loop && (p < loop[0] || p >= loop[1]) ? loop[0] : p, loop); }
    return {
      start, stop, setLoop, posAt, stats, P, EV, DUR,
      get playing() { return !!tr; }, get loop() { return tr && tr.loop; }, get ctx0() { return tr && tr.ctx0; },
      setTension, setDensity: (v) => (P.density = v), setRoom: (v) => verbIn.gain.setTargetAtTime((P.room = v), ctx.currentTime, 0.05),
      setStress: (n) => (P.stress = n), resetStats: () => Object.assign(stats, { late: 0, worstMargin: Infinity, tickJitter: 0 }),
    };
  }
  root.VLSynth = VLSynth;
})(window);
