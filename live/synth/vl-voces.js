/* VØID_LOOM · voces · síntesis en tiempo real en el navegador.
   Instrumentos de VØID_LOOM hechos con Web Audio (osciladores, FM, filtros, envolventes, convolución), un dron vivo
   y un master. Cada pieza (piezas.js) traduce su partitura a una lista de golpes; aquí se tocan.
   La SEMILLA del pase varía lo que no rompe la pieza: micro-tiempos por voz, dinámica, timbres dentro de un margen,
   el batido del dron y la sala. Semilla 0 = versión canónica. La partitura (cuándo suena cada golpe) no cambia. */
(function (root) {
  'use strict';
  const hash = (a, b) => { let h = Math.imul((a | 0) * 374761393 + (b | 0) * 668265263, 1274126177); h = (h ^ (h >>> 13)) * 1103515245; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // variación con semilla: con semilla 0 devuelve siempre el valor canónico
  function Variacion(seed) {
    const r = rng((seed % 2147483647) || 1);
    const v = (def, amp) => (seed ? def + (r() * 2 - 1) * amp : def);
    v.pick = (def, list) => (seed ? list[Math.floor(r() * list.length)] : def);
    v.r = () => (seed ? r() : 0.5);
    v.seed = seed;
    return v;
  }

  function Motor(ctx, dest, opt) {
    opt = opt || {};
    const V = Variacion(opt.seed || 0);
    const room = V(opt.room != null ? opt.room : 0.3, 0.1);

    // ---------------- buses: batería (con saturación paralela para móvil), resto, sala, master
    const master = ctx.createGain(); master.gain.value = opt.gain || 0.8;
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -14; glue.ratio.value = 3; glue.attack.value = 0.004; glue.release.value = 0.14; glue.knee.value = 6;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3.2; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.001; lim.release.value = 0.06;
    const top = ctx.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = opt.top || 15500; top.Q.value = 0.5;
    const gate = ctx.createGain();                                           // silencio real (corte → ruptura)
    master.connect(glue).connect(top).connect(lim).connect(gate).connect(dest);
    function silencio(t1, t2) { if (t1 < 0.01) return; gate.gain.setValueAtTime(1, t1 - 0.004); gate.gain.linearRampToValueAtTime(0, t1); gate.gain.setValueAtTime(0, t2 - 0.002); gate.gain.linearRampToValueAtTime(1, t2); }
    const drums = ctx.createGain(); drums.connect(master);
    const crushIn = ctx.createBiquadFilter(); crushIn.type = 'highpass'; crushIn.frequency.value = 180;
    const sat = ctx.createWaveShaper(); sat.curve = curveTanh(2.6); sat.oversample = '2x';
    const satOut = ctx.createGain(); satOut.gain.value = 0.32;
    drums.connect(crushIn).connect(sat).connect(satOut).connect(master);    // el bombo se oye en altavoz de móvil
    const voices = ctx.createGain(); voices.connect(master);
    const verb = ctx.createConvolver(); verb.buffer = salaIR(ctx, opt.irDur || 2.6, opt.irDamp || 4200, 0.022, (opt.seed || 3) + 3);
    const verbIn = ctx.createGain(); verbIn.gain.value = room;
    const verbHP = ctx.createBiquadFilter(); verbHP.type = 'highpass'; verbHP.frequency.value = 280;
    verbIn.connect(verbHP).connect(verb).connect(master);
    const noiseBuf = (() => { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = hash(i, 77) * 2 - 1; return b; })();

    function curveTanh(k) { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
    function salaIR(ctx, dur, damp, pre, seed) {
      const sr = ctx.sampleRate, n = Math.floor(sr * dur), b = ctx.createBuffer(2, n, sr), p = Math.floor(pre * sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0; const k = Math.exp(-2 * Math.PI * damp / sr);
        for (let i = p; i < n; i++) { const t = (i - p) / (n - p); const w = hash(i, c * 31 + seed) * 2 - 1; lp = lp * k + w * (1 - k); d[i] = lp * Math.pow(1 - t, 2.2) * Math.exp(-t * 3); }
        let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i]; e = Math.sqrt(e) || 1; for (let i = 0; i < n; i++) d[i] /= e;
      }
      return b;
    }
    const out = (node, bus, pan, send) => {
      let n = node;
      if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n.connect(p); n = p; }
      n.connect(bus || voices);
      if (send) { const s = ctx.createGain(); s.gain.value = send; n.connect(s).connect(verbIn); }
    };
    const env = (g, t, a, peak, dec, hold) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); if (hold) g.gain.setValueAtTime(peak, t + a + hold); g.gain.setTargetAtTime(0, t + a + (hold || 0), dec / 4); };
    const stop = (nodes, t) => nodes.forEach((n) => { try { n.stop(t); } catch (e) {} });

    // ---------------- variación fija por pase (por voz): micro-tiempo y timbre
    const MT = {}; const mt = (voz) => (MT[voz] != null ? MT[voz] : (MT[voz] = V(0, 0.004)));   // desplazamiento propio de cada voz
    const jit = (voz, i) => (V.seed ? (hash(i, voz.length * 97 + (V.seed & 0xffff)) * 2 - 1) * 0.0018 : 0);
    const dyn = (i) => (V.seed ? 1 + (hash(i, 7 + (V.seed & 0xffff)) * 2 - 1) * 0.1 : 1);
    const T = {
      kickF0: V(1, 0.05), kickTail: V(1, 0.16), kickClick: V(1, 0.3),
      tickRatio: V.pick(2.76, [2.76, 3.17, 1.41, 3.73, 2.21]), tickF: V(1, 0.16), tickDec: V(1, 0.25),
      iceRatio: V.pick(2.414, [2.414, 3.31, 1.83, 2.9]), iceF: V(1, 0.12),
      bassCut: V(1, 0.25), bassQ: V(1, 0.3),
      pingF: V(1, 0.06), pingTaps: V.pick([0.071, 0.137, 0.226, 0.352], [[0.071, 0.137, 0.226, 0.352], [0.058, 0.149, 0.247, 0.39], [0.083, 0.121, 0.205, 0.331], [0.065, 0.171, 0.262, 0.418]]),
      droneBeat: V(0.11, 0.07), droneLfo: V(0.045, 0.025), droneOpen: V(1, 0.22), dronePh: V(0, 3),
      crackleDens: V(1, 0.3), hatPitch: V(1, 0.06),
    };
    let idx = 0;

    // ================= KIT por pase (SÍNTESIS): cada semilla elige una versión de cada instrumento y un transporte;
    // en la ruptura entra otro kit. Semilla 0 = el kit canónico (variante 0, sin transporte).
    const rk = rng(((opt.seed || 0) ^ 0x5bd1e995) >>> 0 || 1);
    const pk = (n) => (opt.seed ? Math.floor(rk() * n) : 0);
    const nuevoKit = () => ({ kick: pk(4), bass: pk(4), tick: pk(3), hat: pk(3), ice: pk(4) });
    const KITS = [nuevoKit(), nuevoKit()];
    const TR = opt.seed && !opt.modoNadir ? [0, 0, -2, 3, -5, 2, -3][Math.floor(rk() * 7)] : 0, TRF = Math.pow(2, TR / 12);
    let swapAt = Infinity;
    const kitAt = (t) => KITS[t >= swapAt ? 1 : 0];
    const conF = (o, def) => Object.assign({}, o, { f: (o.f || def) * TRF });
    const at = (voz, t) => Math.max(0, t + mt(voz) + jit(voz, ++idx));

    // ================= instrumentos
    // bombo diseñado: cuerpo con barrido de tono, click corto, cola; saturación suave
    function kick0(t, o) {
      t = at('kick', t); const vel = (o.vel ?? 1) * dyn(idx), f0 = (o.f0 || 46) * T.kickF0, f1 = o.f1 || 150, tail = (o.tail || 0.26) * T.kickTail;
      const osc = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper(); sh.curve = curveTanh(1.8);
      osc.frequency.setValueAtTime(f1, t); osc.frequency.exponentialRampToValueAtTime(f0, t + 0.045); osc.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + tail * 2);
      env(g, t, 0.0015, vel, tail);
      osc.connect(g).connect(sh); out(sh, drums);
      const c = ctx.createOscillator(), cg = ctx.createGain(); c.type = 'triangle'; c.frequency.value = o.clickF || 1600;
      env(cg, t, 0.0005, 0.22 * vel * (o.click ?? 1) * T.kickClick, 0.006); c.connect(cg); out(cg, drums);
      osc.start(t); c.start(t); stop([osc], t + tail * 5 + 0.1); stop([c], t + 0.05);
    }
    // bajo con armónicos 2–5 (se oye en móvil) y sub controlado
    function bass0(t, o) {
      t = at('bass', t); const vel = (o.vel ?? 1) * dyn(idx) * (opt.bassGain || 1), f = o.f || 98, d = o.dur || 0.12;
      const s = ctx.createOscillator(), q = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), sh = ctx.createWaveShaper();
      s.type = 'sawtooth'; s.frequency.value = f; q.type = 'sine'; q.frequency.value = f / 2;
      lp.type = 'lowpass'; lp.Q.value = 2.2 * T.bassQ; const c0 = (o.cut || 1100) * T.bassCut;
      lp.frequency.setValueAtTime(c0, t); lp.frequency.exponentialRampToValueAtTime(Math.max(120, c0 * 0.22), t + d * 1.6);
      sh.curve = curveTanh(1.6);
      const qg = ctx.createGain(); qg.gain.value = 0.55;
      env(g, t, 0.002, 0.42 * vel, d, d * 0.3);
      s.connect(lp); q.connect(qg).connect(lp); lp.connect(sh).connect(g); out(g, voices, o.pan || 0, o.send || 0);
      s.start(t); q.start(t); stop([s, q], t + d * 3 + 0.2);
    }
    // tick FM sin ruido, corto, recortado por arriba (los "destellos")
    function tick0(t, o) {
      t = at('tick', t); const vel = (o.vel ?? 1) * dyn(idx) * (opt.tickGain || 1), fc = (o.f || 3200) * T.tickF, dec = (o.dec || 0.022) * T.tickDec, ratio = o.ratio || T.tickRatio;
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      car.frequency.value = fc; mod.frequency.value = fc * ratio;
      mg.gain.setValueAtTime(fc * (o.index || 2.2), t); mg.gain.setTargetAtTime(0, t, dec / 3);
      lp.type = 'lowpass'; lp.frequency.value = opt.tickLP || 7200;
      env(g, t, 0.0006, 0.16 * vel, dec);
      mod.connect(mg).connect(car.frequency); car.connect(g).connect(lp); out(lp, voices, o.pan || 0, o.send ?? 0.12);
      car.start(t); mod.start(t); stop([car, mod], t + dec * 6 + 0.05);
    }
    // charles 909: seis cuadradas metálicas inarmónicas, paso banda 6,8–11,5 kHz, bajo en mezcla
    function hat0(t, o) {
      t = at('hat', t); const vel = (o.vel ?? 1) * dyn(idx) * (opt.hatGain || 1), dec = o.open ? 0.22 : 0.035;
      const g = ctx.createGain(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800; lp.type = 'lowpass'; lp.frequency.value = 11500;
      const os = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => { const x = ctx.createOscillator(); x.type = 'square'; x.frequency.value = f * 2.1 * T.hatPitch; x.connect(hp); x.start(t); return x; });
      env(g, t, 0.0007, 0.055 * vel, dec);
      hp.connect(lp).connect(g); out(g, voices, o.pan || 0, 0.05);
      stop(os, t + dec * 5 + 0.05);
    }
    // golpe de hielo / metal mecanizado: FM inarmónica corta + golpe grave, sin campana
    function ice0(t, o) {
      t = at('ice', t); const vel = (o.vel ?? 1) * dyn(idx) * (opt.iceGain || 1), fc = (o.f || 1650) * T.iceF, dec = o.dec || 0.11, ratio = o.ratio || T.iceRatio;
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      car.frequency.setValueAtTime(fc * 1.04, t); car.frequency.exponentialRampToValueAtTime(fc, t + 0.03);
      mod.frequency.value = fc * ratio; mg.gain.setValueAtTime(fc * 3.2, t); mg.gain.setTargetAtTime(fc * 0.2, t, dec / 5);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(6200, t); lp.frequency.setTargetAtTime(2200, t, dec / 2);
      env(g, t, 0.0008, 0.26 * vel, dec);
      mod.connect(mg).connect(car.frequency); car.connect(g).connect(lp); out(lp, voices, o.pan || 0, o.send ?? 0.32);
      car.start(t); mod.start(t); stop([car, mod], t + dec * 6 + 0.05);
      if (o.thump !== 0) kick(t, { vel: 0.35 * vel, f0: 70, f1: 120, tail: 0.07, click: 0 });
    }
    // crujido: racimo de clics de 1–2 ms que se acelera y sube (no es ruido de fondo)
    function crackle(t, o) {
      const len = o.len || 0.45, n = Math.round((o.n || 26) * T.crackleDens), vel = (o.vel ?? 1);
      for (let i = 0; i < n; i++) {
        const u = i / n, tt = Math.max(0, t + len * Math.pow(u, 0.62) + (hash(i, o.seed || 5) - 0.5) * 0.008);
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; const bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.frequency.value = (1800 + 3200 * u + 900 * hash(i, 3)) * (o.lo || 1); bp.Q.value = 6;
        env(g, tt, 0.0003, (0.12 + 0.18 * u) * vel * (0.5 + hash(i, 9)), 0.004);
        src.connect(bp).connect(g); out(g, voices, (hash(i, 11) - 0.5) * 0.9, 0.18);
        src.start(tt, hash(i, 13) * 1.5); src.stop(tt + 0.03);
      }
    }
    // impacto: caída de sub larga + golpe medio + barrido estéreo corto
    function impact(t, o) {
      const vel = o.vel ?? 1, dur = o.dur || 2.4;
      kick(t, { vel: 1.1 * vel, f0: o.f0 || 34, f1: 110, tail: dur * 0.42, click: 1.4 });
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; const bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(260, t + 0.6); bp.Q.value = 0.9;
      p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + 0.7);
      env(g, t, 0.002, 0.3 * vel, 0.5);
      src.connect(bp).connect(g).connect(p); p.connect(voices); const s = ctx.createGain(); s.gain.value = 0.5; p.connect(s).connect(verbIn);
      src.start(t); src.stop(t + 1.2);
    }
    // sonar: seno corto con reflexiones de la sala (taps oscurecidos), "far" = más lejos y oscuro
    function ping0(t, o) {
      t = at('ping', t); const vel = (o.vel ?? 1) * dyn(idx), f = (o.f || 1320) * T.pingF, far = o.far ? 1 : 0;
      const osc = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      osc.frequency.setValueAtTime(f * 1.02, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.02);
      lp.type = 'lowpass'; lp.frequency.value = (far ? 2600 : 6000) * (opt.pingBright || 1);
      env(g, t, 0.003, (far ? 0.07 : 0.15) * vel, o.dec || 0.18);
      osc.connect(g).connect(lp);
      out(lp, voices, o.pan || 0, far ? 0.6 : 0.35);
      // reflexiones
      const taps = o.taps || T.pingTaps;
      taps.forEach((d, i) => {
        const dl = ctx.createDelay(1.5), tg = ctx.createGain(), tl = ctx.createBiquadFilter(), pp = ctx.createStereoPanner();
        dl.delayTime.value = d * (far ? 1.35 : 1) * (o.size || 1); tg.gain.value = 0.55 * Math.pow(0.62, i); tl.type = 'lowpass'; tl.frequency.value = 3400 / (i + 1);
        pp.pan.value = i % 2 ? 0.55 : -0.55;
        lp.connect(dl).connect(tl).connect(tg).connect(pp).connect(voices);
      });
      osc.start(t); stop([osc], t + 1);
    }
    // placa al revés: crece hacia el golpe y se corta en seco (sin ruido: sierra filtrada que se abre)
    function swell(t, o) {
      const t1 = o.end || t + (o.len || 0.6), vel = o.vel ?? 1, f = o.f || 110;
      const a = ctx.createOscillator(), b = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      a.type = 'sawtooth'; b.type = 'sawtooth'; a.frequency.value = f; b.frequency.value = f * 1.5 + 0.4;
      lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(o.top || 2600, t1);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * vel, t1 - 0.004); g.gain.linearRampToValueAtTime(0, t1);
      a.connect(lp); b.connect(lp); lp.connect(g); out(g, voices, o.pan || 0, o.send ?? 0.25);
      a.start(t); b.start(t); stop([a, b], t1 + 0.02);
    }
    // ---------- NADIR (dark ambient, sin batería)
    // pad de metal blando tipo CS-80: dos sierras desafinadas por nota + sub, filtro que se abre despacio, vibrato que entra tarde
    function cs80(t, o) {
      const notes = o.notes, dur = o.dur || 4, att = o.att || 0.9, rel = o.rel || 2.5, vel = (o.vel ?? 1) * (opt.padGain || 1), cut = o.cut || 1400;
      const lp = ctx.createBiquadFilter(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
      lp.type = 'lowpass'; lp.Q.value = 1.6;
      lp.frequency.setValueAtTime(cut * 0.18, t); lp.frequency.setTargetAtTime(cut, t, att * 0.9); lp.frequency.setTargetAtTime(cut * 0.55, t + att * 2, dur * 0.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11 * vel / Math.sqrt(notes.length), t + att);
      g.gain.setValueAtTime(0.11 * vel / Math.sqrt(notes.length), t + Math.max(att, dur)); g.gain.setTargetAtTime(0, t + Math.max(att, dur), rel / 4);
      vib.frequency.value = 4.6 + V.r() * 0.8; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(3.2, t + att + 1.2);
      vib.connect(vg);
      const os = [];
      notes.forEach((f, i) => [-7, 7].forEach((ct) => {
        const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = ct + V(0, 2); vg.connect(x.detune);
        const pg = ctx.createStereoPanner(); pg.pan.value = Math.max(-0.9, Math.min(0.9, (i - (notes.length - 1) / 2) * 0.35 + ct / 30));
        x.connect(pg).connect(lp); os.push(x);
      }));
      const sb = ctx.createOscillator(); sb.frequency.value = notes[0] / 2; const sbg = ctx.createGain(); sbg.gain.value = 0.6; sb.connect(sbg).connect(lp); os.push(sb);
      lp.connect(g); out(g, voices, 0, o.send ?? 0.75);
      os.forEach((x) => x.start(t)); vib.start(t); const end = t + Math.max(att, dur) + rel * 1.5; stop(os, end); stop([vib], end);
    }
    // destello: seno con su octava, ataque suave, cola larga, todo a la sala (cristal lejano, sin campana)
    function glint(t, o) {
      const f = o.f, vel = (o.vel ?? 1) * (opt.glintGain || 1), dec = o.dec || 2.2;
      const a = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain(), bg = ctx.createGain();
      a.frequency.value = f; b.frequency.value = f * 2.001; bg.gain.value = 0.18;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * vel, t + (o.att || 0.012)); g.gain.setTargetAtTime(0, t + 0.02, dec / 4);
      a.connect(g); b.connect(bg).connect(g); out(g, voices, o.pan || 0, o.send ?? 1.1);
      a.start(t); b.start(t); stop([a, b], t + dec * 2.5);
    }
    // nube granular: granos de seno cortos sobre un conjunto de alturas, ligeramente desafinados, repartidos en estéreo
    // (el brillo helado de fondo; densidad y brillo por evento)
    function nube(t, o) {
      const dur = o.dur || 3, n = Math.max(1, Math.round((o.dens || 12) * dur)), fs = o.fs, vel = (o.vel ?? 1) * (opt.nubeGain || 1), seed = (o.seed || 1) + (V.seed & 0xffff);
      for (let i = 0; i < n; i++) {
        const u = hash(i, seed), tt = t + dur * Math.pow(hash(i, seed + 1), o.shape || 1), L = 0.06 + 0.26 * hash(i, seed + 2);
        const f = fs[Math.floor(u * fs.length)] * Math.pow(2, (hash(i, seed + 3) - 0.5) * 0.012) * (hash(i, seed + 4) < (o.up || 0.25) ? 2 : 1);
        const x = ctx.createOscillator(), g = ctx.createGain(); x.frequency.value = f;
        const a = 0.15 + 0.85 * (o.env ? o.env(tt - t, dur) : 1);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.022 * vel * a, tt + L * 0.45); g.gain.linearRampToValueAtTime(0, tt + L);
        x.connect(g); out(g, voices, (hash(i, seed + 5) - 0.5) * 1.8, o.send ?? 1.3);
        x.start(tt); x.stop(tt + L + 0.01);
      }
    }
    // resonancia: un parcial metálico lento que aparece y se va (sierra en paso banda estrecho, sin ataque)
    function reso(t, o) {
      const f = o.f, dur = o.dur || 4, vel = (o.vel ?? 1) * (opt.resoGain || 1);
      const x = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); x.type = 'sawtooth'; x.frequency.value = f / 4;
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(f * 0.97, t); bp.frequency.linearRampToValueAtTime((o.f2 || f) * 1.03, t + dur); bp.Q.value = 28;
      if (o.f2) { x.frequency.setValueAtTime(f / 4, t); x.frequency.linearRampToValueAtTime(o.f2 / 4, t + dur); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      x.connect(bp).connect(g); out(g, voices, o.pan || 0, o.send ?? 0.9);
      x.start(t); x.stop(t + dur + 0.05);
    }
    // metal arqueado: sierra por tres pasos banda estrechos a razones inarmónicas, ataque lento, trémolo de arco
    function arco(t, o) {
      const f = o.f, dur = o.dur || 3, vel = (o.vel ?? 1) * (opt.arcoGain || 1);
      const x = ctx.createOscillator(), g = ctx.createGain(), tr = ctx.createOscillator(), tg = ctx.createGain();
      x.type = 'sawtooth'; x.frequency.value = f; if (o.f2) x.frequency.linearRampToValueAtTime(o.f2, t + dur);
      tr.frequency.value = 3.1 + V.r(); tg.gain.value = 0.25; tr.connect(tg).connect(g.gain);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * vel, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
      [1, 2.76, 5.4].forEach((r, i) => { const bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * r; bp.Q.value = 40 + 20 * i; bg.gain.value = [1, 0.5, 0.22][i]; x.connect(bp).connect(bg).connect(g); });
      out(g, voices, o.pan || 0, o.send ?? 0.6);
      x.start(t); tr.start(t); stop([x, tr], t + dur + 0.05);
    }
    // cristal frotado: dos senos desafinados (batido lento), ataque blando, sin campana
    function vidrio(t, o) {
      const f = o.f, dur = o.dur || 2.5, vel = (o.vel ?? 1) * (opt.vidrioGain || 1), bt = o.beat || 0.9;
      const a = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain();
      a.frequency.value = f; b.frequency.value = f + bt;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + (o.att || 0.35)); g.gain.setTargetAtTime(0, t + dur * 0.5, dur / 5);
      a.connect(g); b.connect(g); out(g, voices, o.pan || 0, o.send ?? 0.45);
      a.start(t); b.start(t); stop([a, b], t + dur * 1.6);
    }
    // presión: dron FM cuyo índice y trémolo suben con la tensión; se libera de golpe en t1
    function presion(t, t1, o) {
      const f = o.f, vel = (o.vel ?? 1) * (opt.presionGain || 1);
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), tr = ctx.createOscillator(), tg = ctx.createGain(), am = ctx.createGain();
      c.frequency.value = f; m.frequency.value = f * 1.414;
      mg.gain.setValueAtTime(f * 0.2, t); mg.gain.exponentialRampToValueAtTime(f * 3.5, t1);
      tr.frequency.setValueAtTime(1.5, t); tr.frequency.exponentialRampToValueAtTime(11, t1); tg.gain.setValueAtTime(0.1, t); tg.gain.linearRampToValueAtTime(0.45, t1);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(2200, t1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * vel, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1);
      am.gain.value = 1; tr.connect(tg).connect(am.gain);
      m.connect(mg).connect(c.frequency); c.connect(lp).connect(am).connect(g); out(g, voices, 0, o.send ?? 0.4);
      [c, m, tr].forEach((x) => x.start(t)); stop([c, m, tr], t1 + 0.05);
    }
    // voz solista tipo CS-80: sierra con portamento y vibrato, filtro con expresión
    function lead(t, o) {
      const ns = o.notes, d = o.step || 0.9, vel = (o.vel ?? 1) * (opt.leadGain || 1);
      const x = ctx.createOscillator(), y = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), vb = ctx.createOscillator(), vg = ctx.createGain();
      x.type = 'sawtooth'; y.type = 'sawtooth'; y.detune.value = 9;
      ns.forEach((f, i) => { const tt = t + i * d; x.frequency.setTargetAtTime(f, tt, i ? 0.09 : 0.001); y.frequency.setTargetAtTime(f, tt, i ? 0.09 : 0.001); });
      vb.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(9, t + 1.2); vb.connect(vg); vg.connect(x.detune); vg.connect(y.detune);
      lp.type = 'lowpass'; lp.Q.value = 2.5; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + ns.length * d * 0.5); lp.frequency.linearRampToValueAtTime(600, t + ns.length * d);
      const end = t + ns.length * d;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.5); g.gain.setValueAtTime(0.09 * vel, end - 0.3); g.gain.linearRampToValueAtTime(0, end + 1.2);
      x.connect(lp); y.connect(lp); lp.connect(g); out(g, voices, o.pan || 0, o.send ?? 0.9);
      [x, y, vb].forEach((z) => z.start(t)); stop([x, y, vb], end + 1.3);
    }
    // acorde en la niebla (dub techno sin pulso): sierras en acorde por un paso bajo que se cierra rápido, todo a la sala
    function niebla(t, o) {
      const ns = o.notes, vel = (o.vel ?? 1) * (opt.nieblaGain || 1), dec = o.dec || 1.2;
      const lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(o.cut || 900, t); lp.frequency.setTargetAtTime(160, t, dec / 3);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11 * vel, t + 0.025); g.gain.setTargetAtTime(0, t + 0.03, dec / 3);
      const os = ns.map((f, i) => { const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = (i % 2 ? 6 : -6); x.connect(lp); return x; });
      lp.connect(g); out(g, voices, o.pan || 0, o.send ?? 1.4);
      os.forEach((x) => x.start(t)); stop(os, t + dec * 2.5);
    }
    // radio: tono con modulación de amplitud que se "sintoniza" (barrido de altura que se asienta) y pitidos lejanos
    function radio(t, o) {
      const f = o.f, dur = o.dur || 2, vel = (o.vel ?? 1) * (opt.radioGain || 1);
      const c = ctx.createOscillator(), am = ctx.createOscillator(), ag = ctx.createGain(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      c.type = 'triangle'; c.frequency.setValueAtTime(f * (o.from || 1.35), t); c.frequency.setTargetAtTime(f, t, dur * 0.15);
      am.frequency.value = o.am || 7; ag.gain.value = 0.5; am.connect(ag).connect(g.gain);
      bp.type = 'bandpass'; bp.frequency.value = Math.min(1800, f * 1.5); bp.Q.value = 1.2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.2); g.gain.setValueAtTime(0.5, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
      const og = ctx.createGain(); og.gain.value = 0.16 * vel;
      c.connect(bp).connect(g).connect(og); out(og, voices, o.pan || 0, o.send ?? 0.8);
      [c, am].forEach((x) => x.start(t)); stop([c, am], t + dur + 0.05);
    }
    // coro sintético: sierra por tres formantes de vocal (a, o, u), entrada muy lenta, sin vibrato agudo
    const VOC = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [300, 870, 2240], e: [530, 1840, 2480] };
    function coro(t, o) {
      const ns = o.notes, dur = o.dur || 4, vel = (o.vel ?? 1) * (opt.coroGain || 1), v = VOC[o.vocal || 'o'];
      const g = ctx.createGain(), mix = ctx.createGain(); mix.gain.value = 1;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vel / Math.sqrt(ns.length), t + (o.att || 1.8)); g.gain.setValueAtTime(0.5 * vel / Math.sqrt(ns.length), t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 2);
      const os = [];
      ns.forEach((f, i) => [-8, 0, 8].forEach((ct) => { const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = ct + V(0, 3); x.connect(mix); os.push(x); }));
      v.forEach((ff, i) => { const bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff * (o.formant || 1); bp.Q.value = 9; bg.gain.value = [1, 0.5, 0.12][i]; mix.connect(bp).connect(bg).connect(g); });
      out(g, voices, o.pan || 0, o.send ?? 1);
      os.forEach((x) => x.start(t)); stop(os, t + dur + 2.1);
    }
    // arpegio en la niebla: notas de seno+triángulo cortas, filtro que respira; patrón que muta
    function arpegio(t, o) {
      const ns = o.notes, st = o.step || 0.18, n = o.n || 16, vel = (o.vel ?? 1) * (opt.arpGain || 1);
      for (let i = 0; i < n; i++) {
        if (hash(i, (o.seed || 1) + (V.seed & 0xffff)) < (o.skip || 0.15)) continue;
        const tt = t + i * st, f = ns[(i * (o.salto || 1) + Math.floor(i / ns.length)) % ns.length];
        const x = ctx.createOscillator(), y = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        x.frequency.value = f; y.type = 'triangle'; y.frequency.value = f * 2.003;
        lp.type = 'lowpass'; lp.frequency.value = 700 + 900 * (0.5 + 0.5 * Math.sin(i * 0.4 + (o.fase || 0)));
        const yg = ctx.createGain(); yg.gain.value = 0.35;
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.07 * vel * (0.6 + 0.4 * Math.sin(i * 0.7) ** 2), tt + 0.01); g.gain.setTargetAtTime(0, tt + 0.02, st * 1.2);
        x.connect(lp); y.connect(yg).connect(lp); lp.connect(g); out(g, voices, Math.sin(i * 0.9) * 0.6, o.send ?? 1.1);
        x.start(tt); y.start(tt); stop([x, y], tt + st * 6);
      }
    }
    // ================= NADIR · graves propios y cinemática
    // bajo: el instrumento grave que sostiene cada pieza, distinto en cada una (tipo). f → f2 en tr (ruptura).
    function bajo(t, t1, o) {
      const f = o.f, f2 = o.f2 || f, tr = o.tr != null ? o.tr : t1, vel = (o.vel ?? 1) * (opt.bajoGain || 1), tipo = o.tipo;
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), sum = ctx.createGain(), os = [];
      const lvl = 0.42 * vel;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + (o.att || 2.5));
      if (o.cresc) g.gain.linearRampToValueAtTime(lvl * o.cresc, tr - 0.05);
      g.gain.setValueAtTime(lvl, t1 - (o.rel || 2)); g.gain.linearRampToValueAtTime(0, t1);
      lp.type = 'lowpass'; lp.Q.value = o.q || 0.8; lp.frequency.setValueAtTime(o.cut || 320, t);
      if (o.open) lp.frequency.linearRampToValueAtTime(o.open, tr - 0.05), lp.frequency.setTargetAtTime(o.cut || 320, tr, 1.5);
      const osc = (type, m, gain, det) => {
        const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(f * m, t);
        if (o.rise) x.frequency.linearRampToValueAtTime(f * m * o.rise, tr - 0.05);
        if (f2 !== f) x.frequency.setTargetAtTime(f2 * m, tr, o.glideT || 0.04);
        if (det) x.detune.value = det;
        const xg = ctx.createGain(); xg.gain.value = gain; x.connect(xg).connect(sum); os.push(x); return x;
      };
      const lfo = (rate, depth, param) => { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg).connect(param); os.push(l); return l; };
      switch (tipo) {
        case 'aurora': [1, 1.5, 2, 3, 4].forEach((h, i) => osc('sine', h, [1, 0.5, 0.45, 0.25, 0.15][i], i * 3)); osc('triangle', 2, 0.12); break;
        case 'orbita': [[1, 0], [2.005, 4], [3.01, 9]].forEach(([m, d], i) => { const x = osc('sine', m, [1, 0.4, 0.18][i], d); lfo(0.09 + 0.03 * i, 14, x.detune); }); osc('sine', 0.5, 0.5); break;
        case 'eclipse': { osc('sine', 1, 1); osc('sine', 1, 0.8, 7); osc('sine', 1.5, 0.35); osc('sine', 1.5, 0.3, 6); osc('sawtooth', 2, 0.12); lp.Q.value = 6; lfo(0.11, (o.cut || 320) * 0.6, lp.frequency); break; }
        case 'cuerda': { [1, 3, 5, 7, 9].forEach((h, i) => { const x = osc('sine', h, 1 / h); lfo(0.17 + i * 0.05, 4, x.detune); }); osc('sine', 0.5, 0.5); lfo(5.3, 0.06, g.gain); break; }
        case 'organo': [1, 2, 3, 4, 6, 8].forEach((h, i) => osc('sine', h, [1, 0.55, 0.3, 0.28, 0.12, 0.08][i])); break;
        case 'fm': { const c = osc('sine', 1, 1), m = ctx.createOscillator(), mg = ctx.createGain(); m.frequency.setValueAtTime(f * 0.5, t); if (f2 !== f) m.frequency.setTargetAtTime(f2 * 0.5, tr, 0.04);
          mg.gain.value = f * 0.8; lfo(0.07, f * 0.7, mg.gain); m.connect(mg).connect(c.frequency); os.push(m); osc('sine', 0.5, 0.6); break; }
        case 'hum': osc('square', 1, 0.35, -4); osc('square', 1, 0.35, 4); osc('sine', 0.5, 0.8); lfo(0.13, 120, lp.frequency); break;
        case 'tecto': for (let i = 0; i < 10; i++) { const x = osc('sine', 0.7 + 0.6 * hash(i, 41), 0.32); const am = ctx.createGain(); am.gain.value = 0; x.disconnect(); x.connect(am).connect(sum); lfo(0.05 + 0.25 * hash(i, 42), 0.5, am.gain); } osc('sine', 0.5, 0.7); break;
        case 'braam': [-14, -7, 0, 7, 14].forEach((d) => osc('sawtooth', 1, 0.22, d)); osc('sawtooth', 0.5, 0.3); osc('sine', 0.5, 0.6); break;
        case 'wow': [-10, 0, 10].forEach((d) => { const x = osc('sawtooth', 1, 0.25, d); lfo(0.27 + hash(d + 20, 5) * 0.2, 28, x.detune); }); osc('sine', 0.5, 0.6); break;
        case 'glide': { const a = osc('sine', 1, 1), b = osc('triangle', 2, 0.3); lfo(0.045, 90, a.detune); lfo(0.045, 90, b.detune); osc('sine', 0.5, 0.4); break; }
        case 'arco': { const x = osc('sawtooth', 1, 1); x.disconnect(); [1, 2.76, 5.4].forEach((r, i) => { const bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * r; bp.Q.value = 30; bg.gain.value = [2.2, 1, 0.4][i]; x.connect(bp).connect(bg).connect(sum); }); osc('sine', 0.5, 0.5); lfo(3.2, 0.2, g.gain); break; }
        case 'vidrio': [[1, 0], [2.01, 0.6], [3.03, 1.3]].forEach(([m, d], i) => { osc('sine', m, [1, 0.35, 0.15][i]); osc('sine', m, [0.8, 0.3, 0.1][i], 3 + d * 2); }); break;
        case 'subpulso': { const a = osc('sine', 1, 1.2), am = ctx.createGain(); am.gain.value = 0.6; a.disconnect(); a.connect(am).connect(sum); lfo(o.rate || 0.8, 0.4, am.gain); osc('triangle', 2, 0.15); break; }
        case 'cs80': [-7, 7].forEach((d) => { const x = osc('sawtooth', 1, 0.4, d); lfo(4.8, 6, x.detune); }); osc('sawtooth', 0.5, 0.3); osc('sine', 0.5, 0.5); break;
        case 'motor': {
          // parciales que rotan: cada uno sube y baja de nivel a su ritmo (máquina girando)
          const rot = ctx.createGain(); rot.gain.value = 1;
          [1, 2, 3, 4, 5, 6, 7].forEach((h, i) => { const x = ctx.createOscillator(); x.frequency.setValueAtTime(f * h, t); if (f2 !== f) x.frequency.setTargetAtTime(f2 * h, tr, 0.04);
            const xg = ctx.createGain(); xg.gain.value = 0.08 / (1 + i * 0.3); x.connect(xg).connect(rot); os.push(x); lfo(0.11 * (i + 1) / 2, 0.08 / (1 + i * 0.3), xg.gain); });
          rot.connect(sum); const s2 = ctx.createOscillator(); s2.frequency.value = f / 2; const s2g = ctx.createGain(); s2g.gain.value = 0.7; s2.connect(s2g).connect(sum); os.push(s2); } break;
        case 'revswell': default: { const a = osc('sawtooth', 1, 0.5), b = osc('sine', 0.5, 0.8); if (o.periodo) lfo(1 / o.periodo, 0.5, g.gain); break; }
      }
      const sh = ctx.createWaveShaper(); sh.curve = curveTanh(o.drive || 1.4);
      sum.connect(lp).connect(sh).connect(g); out(g, drums, 0, o.send ?? 0.25);
      os.forEach((x) => { try { x.start(t); } catch (e) {} }); stop(os, t1 + 0.05);
    }
    // subida de tensión hacia el corte (todas sin ruido): up = sierras que suben de tono; rev = acorde al revés;
    // pres = trémolo que se acelera; down = caída que tira hacia abajo
    function riser(t, t1, o) {
      const f = o.f, vel = (o.vel ?? 1) * (opt.riserGain || 1), tipo = o.tipo || 'up';
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), os = [];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vel, t1 - 0.01); g.gain.linearRampToValueAtTime(0, t1);
      lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(o.top || 2600, t1);
      const add = (type, m, det) => { const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(f * m, t); x.detune.value = det || 0; x.connect(lp); os.push(x); return x; };
      if (tipo === 'up') [1, 1.5, 2].forEach((m, i) => { const x = add('sawtooth', m, i * 5 - 5); x.frequency.exponentialRampToValueAtTime(f * m * 2, t1); });
      else if (tipo === 'down') [2, 3, 4].forEach((m) => { const x = add('sawtooth', m); x.frequency.exponentialRampToValueAtTime(f * m * 0.5, t1); });
      else if (tipo === 'pres') { [1, 1.01].forEach((m) => add('sawtooth', m * 2)); const tr = ctx.createOscillator(), tg = ctx.createGain(), am = ctx.createGain(); tr.frequency.setValueAtTime(2, t); tr.frequency.exponentialRampToValueAtTime(18, t1); tg.gain.value = 0.5; am.gain.value = 0.5; tr.connect(tg).connect(am.gain); lp.disconnect(); lp.connect(am).connect(g); os.push(tr); }
      else [1, 1.19, 1.5, 2].forEach((m, i) => add(i % 2 ? 'triangle' : 'sawtooth', m * 2, i * 4));
      if (tipo !== 'pres') lp.connect(g);
      out(g, voices, 0, o.send ?? 0.6);
      os.forEach((x) => x.start(t)); stop(os, t1 + 0.02);
    }
    // golpe de ruptura: braam (metal grave enorme), subdrop (caída de sub), slam (golpe metálico seco), coro (golpe de voces)
    function golpe(t, o) {
      const f = o.f, vel = (o.vel ?? 1) * (opt.golpeGain || 1), tipo = o.tipo;
      if (tipo === 'braam') {
        const lp = ctx.createBiquadFilter(), g = ctx.createGain(), sh = ctx.createWaveShaper(); sh.curve = curveTanh(2.4);
        lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(180, t); lp.frequency.linearRampToValueAtTime(1500, t + 0.35); lp.frequency.setTargetAtTime(220, t + 0.4, 1.2);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.06); g.gain.setTargetAtTime(0, t + 0.5, 1.4);
        const os = [-12, -5, 0, 5, 12].map((d) => { const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = d; x.connect(lp); return x; });
        const s5 = ctx.createOscillator(); s5.type = 'sawtooth'; s5.frequency.value = f * 1.5; const s5g = ctx.createGain(); s5g.gain.value = 0.5; s5.connect(s5g).connect(lp); os.push(s5);
        lp.connect(sh).connect(g); out(g, drums, 0, 0.5); os.forEach((x) => x.start(t)); stop(os, t + 6);
        bloom(t, { f: f / 2, vel: 1.3 * vel, dec: 5, att: 0.01 });
      } else if (tipo === 'subdrop') {
        const x = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper(); sh.curve = curveTanh(1.6);
        x.frequency.setValueAtTime(f * 3, t); x.frequency.exponentialRampToValueAtTime(f * 0.5, t + 2.2);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * vel, t + 0.01); g.gain.setTargetAtTime(0, t + 0.3, 1.1);
        x.connect(sh).connect(g); out(g, drums, 0, 0.2); x.start(t); stop([x], t + 6);
      } else if (tipo === 'slam') {
        kick(t, { vel: 1.2 * vel, f0: Math.max(32, f), f1: 140, tail: 0.6, click: 0.8 });
        const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        car.frequency.value = f * 4.1; mod.frequency.value = f * 4.1 * 1.41; mg.gain.setValueAtTime(f * 12, t); mg.gain.setTargetAtTime(f, t, 0.3);
        lp.type = 'lowpass'; lp.frequency.value = 1800; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * vel, t + 0.004); g.gain.setTargetAtTime(0, t, 0.8);
        mod.connect(mg).connect(car.frequency); car.connect(g).connect(lp); out(lp, voices, 0, 1.2); car.start(t); mod.start(t); stop([car, mod], t + 5);
        bloom(t, { f, vel: vel, dec: 5, att: 0.02 });
      } else {
        coro(t, { notes: [f * 2, f * 3, f * 4, f * 4.76], dur: 0.6, vocal: 'a', vel: 1.6 * vel, att: 0.04 });
        bloom(t, { f, vel: 1.1 * vel, dec: 5, att: 0.01 });
      }
    }
    // respiración de sub: el golpe del bombo convertido en una ola grave lenta
    function bloom(t, o) {
      const f = o.f || 41, vel = (o.vel ?? 1) * (opt.bloomGain || 1), dec = o.dec || 2.4;
      const a = ctx.createOscillator(), h = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      a.frequency.setValueAtTime(f * 1.06, t); a.frequency.setTargetAtTime(f, t, 0.3); h.type = 'sawtooth'; h.frequency.value = f * 2;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.setTargetAtTime(140, t, dec / 3);
      const hg = ctx.createGain(); hg.gain.value = 0.3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.42 * vel, t + (o.att || 0.12)); g.gain.setTargetAtTime(0, t + (o.att || 0.12), dec / 4);
      a.connect(lp); h.connect(hg).connect(lp); lp.connect(g); out(g, drums, 0, 0.2);
      a.start(t); h.start(t); stop([a, h], t + dec * 2.5);
    }
    // ratchet: repeticiones a 1/32 con subida de tono y crescendo
    function ratchet(t, o) {
      const n = o.n || 6, d = o.d || 0.03;
      for (let i = 0; i < n; i++) tick(t + i * d, { vel: (o.vel ?? 1) * (0.4 + 0.6 * i / n), f: (o.f || 2600) * (1 + 0.06 * i), dec: 0.012, pan: (i % 2 ? 0.3 : -0.3) });
    }

    // ---------- variantes del kit
    function kick(t, o) {
      const v = kitAt(t).kick;
      if (v === 1) return kick0(t, Object.assign({}, o, { f0: (o.f0 || 46) * 0.85, f1: 95, tail: (o.tail || 0.26) * 1.7, click: (o.click ?? 1) * 0.3 }));   // sub largo
      if (v === 2) return kick0(t, Object.assign({}, o, { f1: 270, tail: (o.tail || 0.26) * 0.5, click: (o.click ?? 1) * 1.8 }));                        // seco y corto
      if (v === 3) {                                                                                                                            // FM: golpe metálico grave
        const tt = at('kick', t), vel = (o.vel ?? 1) * dyn(idx), f0 = (o.f0 || 46) * T.kickF0, tail = (o.tail || 0.26) * 0.9;
        const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), sh = ctx.createWaveShaper(); sh.curve = curveTanh(2.2);
        c.frequency.setValueAtTime(f0 * 3, tt); c.frequency.exponentialRampToValueAtTime(f0, tt + 0.04); m.frequency.value = f0 * 1.5;
        mg.gain.setValueAtTime(f0 * 6, tt); mg.gain.setTargetAtTime(0, tt, 0.02); env(g, tt, 0.001, vel, tail);
        m.connect(mg).connect(c.frequency); c.connect(g).connect(sh); out(sh, drums); c.start(tt); m.start(tt); stop([c, m], tt + tail * 5 + 0.1); return;
      }
      return kick0(t, o);
    }
    function bass(t, o) {
      const v = kitAt(t).bass; o = conF(o, 98);
      if (v === 0) return bass0(t, o);
      const tt = at('bass', t), vel = (o.vel ?? 1) * dyn(idx) * (opt.bassGain || 1), f = o.f, d = o.dur || 0.12;
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), os = [];
      lp.type = 'lowpass'; env(g, tt, 0.002, 0.42 * vel, d, d * 0.3);
      if (v === 1) {                       // FM: carrier + modulador a la octava, índice que cae
        const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(); c.frequency.value = f; m.frequency.value = f * 2;
        mg.gain.setValueAtTime(f * 3, tt); mg.gain.setTargetAtTime(f * 0.3, tt, d / 2); m.connect(mg).connect(c.frequency); c.connect(lp); os.push(c, m); lp.frequency.value = 2400;
      } else if (v === 2) {                // cuadrada que se cierra rápido (pluck resonante)
        const x = ctx.createOscillator(); x.type = 'square'; x.frequency.value = f; x.connect(lp); os.push(x);
        lp.Q.value = 7; lp.frequency.setValueAtTime(2600, tt); lp.frequency.exponentialRampToValueAtTime(220, tt + d * 1.2);
      } else {                             // seno plegado: saturación fuerte + octava
        const x = ctx.createOscillator(), y = ctx.createOscillator(), yg = ctx.createGain(), sh = ctx.createWaveShaper(); sh.curve = curveTanh(4.5);
        x.frequency.value = f; y.frequency.value = f / 2; yg.gain.value = 0.6; x.connect(sh); y.connect(yg).connect(sh); sh.connect(lp); os.push(x, y); lp.frequency.value = 1800;
      }
      lp.connect(g); out(g, voices, o.pan || 0, o.send || 0); os.forEach((x) => x.start(tt)); stop(os, tt + d * 3 + 0.2);
    }
    function tick(t, o) {
      const v = kitAt(t).tick; o = conF(o, 3200);
      if (v === 0) return tick0(t, o);
      const tt = at('tick', t), vel = (o.vel ?? 1) * dyn(idx) * (opt.tickGain || 1), dec = (o.dec || 0.022) * T.tickDec;
      const x = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opt.tickLP || 7200;
      if (v === 1) { x.frequency.setValueAtTime(o.f * 1.6, tt); x.frequency.exponentialRampToValueAtTime(o.f * 0.7, tt + dec); }          // blip de seno que cae
      else { x.type = 'triangle'; x.frequency.setValueAtTime(o.f * 0.5, tt); x.frequency.exponentialRampToValueAtTime(o.f * 0.25, tt + dec * 1.5); }   // gota grave
      env(g, tt, 0.0005, 0.17 * vel, dec); x.connect(g).connect(lp); out(lp, voices, o.pan || 0, o.send ?? 0.12); x.start(tt); stop([x], tt + dec * 6 + 0.05);
    }
    function hat(t, o) {
      const v = kitAt(t).hat;
      if (v === 0) return hat0(t, o);
      if (v === 2) return tick0(t, { vel: (o.vel ?? 1) * 0.7, f: 5200 * TRF, dec: o.open ? 0.06 : 0.012, pan: o.pan || 0 });   // hat de tick muy corto
      const tt = at('hat', t), vel = (o.vel ?? 1) * dyn(idx) * (opt.hatGain || 1), dec = o.open ? 0.18 : 0.03;       // FM metálico
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
      c.frequency.value = 6100; m.frequency.value = 6100 * 1.414; mg.gain.value = 9000; hp.type = 'highpass'; hp.frequency.value = 5200;
      env(g, tt, 0.0006, 0.05 * vel, dec); m.connect(mg).connect(c.frequency); c.connect(hp).connect(g); out(g, voices, o.pan || 0, 0.05);
      c.start(tt); m.start(tt); stop([c, m], tt + dec * 5 + 0.05);
    }
    function ice(t, o) {
      const v = kitAt(t).ice; o = conF(o, 1650);
      if (v === 0) return ice0(t, o);
      if (v === 3) return ice0(t, Object.assign({}, o, { ratio: 3.5, dec: (o.dec || 0.11) * 1.8, f: o.f * 0.6 }));   // chapa grave
      const tt = at('ice', t), vel = (o.vel ?? 1) * dyn(idx) * (opt.iceGain || 1), dec = o.dec || 0.11;
      const g = ctx.createGain(), os = [];
      if (v === 1) {                       // tom/clave: seno afinado que cae, con un toque de FM
        const x = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(); const f = o.f * 0.25;
        x.frequency.setValueAtTime(f * 1.5, tt); x.frequency.exponentialRampToValueAtTime(f, tt + 0.05); m.frequency.value = f * 2.7; mg.gain.setValueAtTime(f * 1.5, tt); mg.gain.setTargetAtTime(0, tt, 0.02);
        m.connect(mg).connect(x.frequency); x.connect(g); os.push(x, m); env(g, tt, 0.001, 0.45 * vel, dec * 1.6);
      } else {                             // chasquido de cristal: dos senos inarmónicos muy cortos
        [1, 2.76, 5.4].forEach((r, i) => { const x = ctx.createOscillator(), xg = ctx.createGain(); x.frequency.value = o.f * 0.8 * r; xg.gain.value = [1, 0.5, 0.2][i]; x.connect(xg).connect(g); os.push(x); });
        env(g, tt, 0.0006, 0.2 * vel, dec * 0.7);
      }
      out(g, voices, o.pan || 0, o.send ?? 0.3); os.forEach((x) => x.start(tt)); stop(os, tt + dec * 8 + 0.05);
      if (o.thump !== 0) kick0(tt, { vel: 0.3 * vel, f0: 70, f1: 120, tail: 0.07, click: 0 });
    }
    function ping(t, o) { return ping0(t, conF(o, 1320)); }

    // ================= dron vivo: sub + parciales con batido + capa filtrada que respira
    function Dron(o) {
      const root = o.root * TRF, g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.value = (o.cut || 420) * T.droneOpen;
      const lfo = ctx.createOscillator(), lfog = ctx.createGain(); lfo.frequency.value = T.droneLfo; lfog.gain.value = (o.cut || 420) * 0.45;
      lfo.connect(lfog).connect(lp.frequency);
      const oscs = [];
      const sub = ctx.createOscillator(); sub.frequency.value = root; const subg = ctx.createGain(); subg.gain.value = o.sub ?? 0.5; sub.connect(subg).connect(g); oscs.push(sub);
      // parciales con batido: cada par desafinado lo justo para moverse
      (o.parts || [2, 3, 4]).forEach((h, i) => {
        [-1, 1].forEach((sgn) => {
          const x = ctx.createOscillator(); x.type = i === 0 ? 'sawtooth' : 'triangle'; x.frequency.value = root * h + sgn * T.droneBeat * (1 + i * 0.6);
          const xg = ctx.createGain(); xg.gain.value = (o.partGain || 0.16) / (1 + i * 0.7); x.connect(xg).connect(lp); oscs.push(x);
        });
      });
      lp.connect(g);
      const sh = ctx.createWaveShaper(); sh.curve = curveTanh(1.3);
      g.connect(sh); out(sh, voices, 0, o.send ?? 0.12);
      const t0 = ctx.currentTime; oscs.forEach((x) => x.start(t0)); lfo.start(t0);
      return {
        level(t, v, tau) { g.gain.setTargetAtTime(v, t, tau || 0.4); },
        cut(t) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0, t); },
        glide(t, f, tau) { oscs.forEach((x, i) => { const ratio = x.frequency.value / root; x.frequency.setTargetAtTime(f * TRF * ratio, t, tau || 0.6); }); },
        stop(t) { oscs.forEach((x) => { try { x.stop(t); } catch (e) {} }); try { lfo.stop(t); } catch (e) {} },
      };
    }

    return { ctx, master, silencio, kitEn: (t) => { swapAt = t; }, KITS, TR, voices, drums, verbIn, V, T, kick, bass, tick, hat, ice, crackle, impact, ping, ratchet, swell, cs80, glint, bloom, nube, reso, arco, vidrio, presion, lead, niebla, radio, coro, arpegio, bajo, riser, golpe, Dron };
  }

  root.VLVoces = { Motor, Variacion, rng, hash };
})(typeof window !== 'undefined' ? window : globalThis);
