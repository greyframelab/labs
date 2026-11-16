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
    const at = (voz, t) => Math.max(0, t + mt(voz) + jit(voz, ++idx));

    // ================= instrumentos
    // bombo diseñado: cuerpo con barrido de tono, click corto, cola; saturación suave
    function kick(t, o) {
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
    function bass(t, o) {
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
    function tick(t, o) {
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
    function hat(t, o) {
      t = at('hat', t); const vel = (o.vel ?? 1) * dyn(idx) * (opt.hatGain || 1), dec = o.open ? 0.22 : 0.035;
      const g = ctx.createGain(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800; lp.type = 'lowpass'; lp.frequency.value = 11500;
      const os = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => { const x = ctx.createOscillator(); x.type = 'square'; x.frequency.value = f * 2.1 * T.hatPitch; x.connect(hp); x.start(t); return x; });
      env(g, t, 0.0007, 0.055 * vel, dec);
      hp.connect(lp).connect(g); out(g, voices, o.pan || 0, 0.05);
      stop(os, t + dec * 5 + 0.05);
    }
    // golpe de hielo / metal mecanizado: FM inarmónica corta + golpe grave, sin campana
    function ice(t, o) {
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
        bp.type = 'bandpass'; bp.frequency.value = 1800 + 3200 * u + 900 * hash(i, 3); bp.Q.value = 6;
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
    function ping(t, o) {
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
    // ratchet: repeticiones a 1/32 con subida de tono y crescendo
    function ratchet(t, o) {
      const n = o.n || 6, d = o.d || 0.03;
      for (let i = 0; i < n; i++) tick(t + i * d, { vel: (o.vel ?? 1) * (0.4 + 0.6 * i / n), f: (o.f || 2600) * (1 + 0.06 * i), dec: 0.012, pan: (i % 2 ? 0.3 : -0.3) });
    }

    // ================= dron vivo: sub + parciales con batido + capa filtrada que respira
    function Dron(o) {
      const root = o.root, g = ctx.createGain(); g.gain.value = 0;
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
        glide(t, f, tau) { oscs.forEach((x, i) => { const ratio = x.frequency.value / root; x.frequency.setTargetAtTime(f * ratio, t, tau || 0.6); }); },
        stop(t) { oscs.forEach((x) => { try { x.stop(t); } catch (e) {} }); try { lfo.stop(t); } catch (e) {} },
      };
    }

    return { ctx, master, silencio, voices, drums, verbIn, V, T, kick, bass, tick, hat, ice, crackle, impact, ping, ratchet, swell, Dron };
  }

  root.VLVoces = { Motor, Variacion, rng, hash };
})(typeof window !== 'undefined' ? window : globalThis);
