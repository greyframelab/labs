/* VØID_LOOM · SEMILLA — sonido sintetizado desde la partitura.
   Cada semilla suena como su referencia (Autechre, Orphx, Lanark Artefax, Squarepusher, Phoenicia, Boards of Canada).
   Limpio: senos, FM y resonadores, sin capas de ruido; percusión por debajo de ~1,5 kHz; dron vivo como columna.
   El mismo planificador sirve en tiempo real (AudioContext) y para renderizar offline (OfflineAudioContext). */
(function () {
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const H = (...a) => window.SEMILLA.h4(...a);

  function softSaw(ctx, n = 16, pw = 1.4) {
    const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) im[k] = 1 / Math.pow(k, pw);
    return ctx.createPeriodicWave(re, im);
  }
  function shaper(ctx, drive = 1.6) {
    const ws = ctx.createWaveShaper(), N = 2048, c = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / Math.tanh(drive); }
    ws.curve = c; ws.oversample = '2x'; return ws;
  }
  function makeIR(ctx, dur, damp, seed) {
    const sr = ctx.sampleRate, n = Math.floor(dur * sr), b = ctx.createBuffer(2, n, sr);
    const R = window.SEMILLA.mulberry(seed * 7919 + 17), pre = Math.floor(0.018 * sr);
    const a = Math.exp((-2 * Math.PI * damp) / sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let y = 0, e = 0;
      for (let i = 0; i < n; i++) {
        const x = i < pre ? 0 : (R() * 2 - 1) * Math.exp(-(i - pre) / (sr * dur / 6.5));
        y = (1 - a) * x + a * y; d[i] = y; e += y * y;
      }
      const g = 1 / Math.sqrt(e + 1e-9); for (let i = 0; i < n; i++) d[i] *= g * 4;
    }
    return b;
  }

  // ---------- máster (uno por contexto) ----------
  function Sound(ctx) {
    this.ctx = ctx;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 24; hp.Q.value = 0.6;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.ratio.value = 2.5; glue.knee.value = 6; glue.attack.value = 0.012; glue.release.value = 0.2;
    const make = ctx.createGain(); make.gain.value = 1.0; this.make = make;
    this.lv = { drone: 0.12, kick: 0.46, tick: 1.25, metal: 0.66, bass: 0.48, impact: 0.6 };
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3.6; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.001; lim.release.value = 0.08;
    // techo de seguridad: recorte suave por encima de -3 dBFS, nunca pasa de -1,2 dBFS
    const clip = ctx.createWaveShaper(), N = 4096, cv = new Float32Array(N), knee = 0.708, top = 0.87;
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x);
      cv[i] = Math.sign(x) * (a <= knee ? a : knee + (top - knee) * Math.tanh((a - knee) / (top - knee))); }
    clip.curve = cv; clip.oversample = '4x';
    this.in = ctx.createGain();
    this.out = ctx.createGain(); this.out.gain.value = 1;   // VOLUMEN DE SALA: se calibra en el montaje
    this.in.connect(hp); hp.connect(glue); glue.connect(make); make.connect(lim); lim.connect(clip); clip.connect(this.out);
    this.out.connect(ctx.destination);
    this.saw = softSaw(ctx); this.saw2 = softSaw(ctx, 9, 1); this.curve16 = shaper(ctx, 1.6).curve;
    this.voices = [];
  }
  Sound.prototype.volume = function (v, dur = 0.3) {
    const g = this.out.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + dur);
  };
  Sound.prototype.stream = function () {
    if (!this.rec) { this.rec = this.ctx.createMediaStreamDestination(); this.out.connect(this.rec); }
    return this.rec.stream;
  };
  Sound.prototype.piece = function (P, t0, gain = 1) { const v = new Voice(this, P, t0, gain); this.voices.push(v); return v; };
  Sound.prototype.tick = function () {
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => !v.dead);
    for (const v of this.voices) v.schedule(now + 0.32);
  };

  // ---------- una pieza sonando ----------
  function Voice(S, P, t0, gain) {
    const ctx = S.ctx; this.S = S; this.ctx = ctx; this.P = P; this.t0 = t0; this.cursor = Math.max(t0, ctx.currentTime); this.dead = false;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(S.in);
    this.out.gain.setValueAtTime(0, this.cursor); this.out.gain.linearRampToValueAtTime(gain, this.cursor + 0.05);
    this.drum = ctx.createGain(); this.drum.connect(this.out);
    // saturación paralela del bus de batería (para que el bombo se oiga en el móvil)
    const sh = ctx.createBiquadFilter(); sh.type = 'highpass'; sh.frequency.value = 180;
    const ws = shaper(ctx, 3); const sg = ctx.createGain(); sg.gain.value = 0.22;
    this.drum.connect(sh); sh.connect(ws); ws.connect(sg); sg.connect(this.out);
    // sala
    this.send = ctx.createGain(); this.send.gain.value = 1;
    const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = makeIR(ctx, P.ref.room, 4200, P.roomSeed);
    const vl = ctx.createBiquadFilter(); vl.type = 'lowpass'; vl.frequency.value = 5200;
    const vh = ctx.createBiquadFilter(); vh.type = 'highpass'; vh.frequency.value = 260;
    const vg = ctx.createGain(); vg.gain.value = P.ref.verb * 0.9;
    this.send.connect(vh); vh.connect(cv); cv.connect(vl); vl.connect(vg); vg.connect(this.out);
    this.drone();
    if (S.only && !S.only.includes('drone')) this.droneGain.disconnect();
    this.barNext = 0;
  }
  const V = Voice.prototype;
  V.at = function (t) { return this.t0 + t; };
  V.fadeOut = function (when, dur) {
    const g = this.out.gain; g.cancelScheduledValues(when); g.setValueAtTime(g.value, when); g.linearRampToValueAtTime(0, when + dur);
    this.stopAt = when + dur; setTimeout(() => this.kill(), (when + dur - this.ctx.currentTime) * 1000 + 300);
  };
  V.kill = function () { if (this.dead) return; this.dead = true; try { this.out.disconnect(); } catch (e) {} for (const o of this.oscs || []) try { o.stop(); } catch (e) {} };
  V.duck = function (when, to, dur) { const g = this.out.gain; g.cancelScheduledValues(when); g.setValueAtTime(g.value, when); g.linearRampToValueAtTime(to, when + dur); };

  // dron: columna de la pieza, sierra suave desafinada + quinta + sub, filtro que respira con la energía
  V.drone = function () {
    const ctx = this.ctx, P = this.P, now = this.cursor, oscs = (this.oscs = []);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2.2; f.frequency.value = 200;
    const fm = ctx.createBiquadFilter(); fm.type = 'bandpass'; fm.Q.value = 4; fm.frequency.value = 640;
    const g = ctx.createGain(); g.gain.value = 0.0001; this.droneGain = g; this.droneF = f;
    const fg = ctx.createGain(); fg.gain.value = 0.9;
    const fm2 = ctx.createBiquadFilter(); fm2.type = 'bandpass'; fm2.Q.value = 9; fm2.frequency.value = 1200;
    const fg2 = ctx.createGain(); fg2.gain.value = P.vowels ? 0.55 : 0;
    if (P.vowels) { fm.Q.value = 9; fg.gain.value = 1.4; }
    this.fm = fm; this.fm2 = fm2;
    f.connect(g); fm.connect(fg); fg.connect(g); fm2.connect(fg2); fg2.connect(g); g.connect(this.out); g.connect(this.send);
    const mk = (freq, det, type, gain, dest) => {
      const o = ctx.createOscillator(); if (type === 'saw') o.setPeriodicWave(this.S.saw); else o.type = type;
      o.frequency.value = freq; o.detune.value = det; const og = ctx.createGain(); og.gain.value = gain;
      o.connect(og); og.connect(dest); o.start(now); oscs.push(o); return o;
    };
    const r = P.root + 12, sh = P.droneShape;
    const a = mk(hz(r), -7, 'saw', 0.32, f), b = mk(hz(r), 6, 'saw', 0.32, f);
    mk(hz(r + 7), -3 + sh * 4, 'saw', 0.14, f);
    mk(hz(r + 12 + (sh > 0.5 ? 3 : 0)), 2, 'saw', P.vowels ? 0.16 : 0.07, fm);
    if (P.vowels) { mk(hz(r + 12), -4, 'saw', 0.16, fm2); mk(hz(r + 7), 5, 'saw', 0.12, fm); }
    const sub = ctx.createOscillator(); sub.frequency.value = hz(P.root); const sg = ctx.createGain(); sg.gain.value = 0.13;
    sub.connect(sg); sg.connect(g); sub.start(now); oscs.push(sub);
    // respiración ligada al bucle (2 ciclos por vuelta) y barrido del formante
    const lfo = ctx.createOscillator(); lfo.frequency.value = 2 / P.L; const lg = ctx.createGain(); lg.gain.value = 110;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start(now); oscs.push(lfo);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 1 / P.L; const lg2 = ctx.createGain(); lg2.gain.value = 260;
    if (!P.vowels) lg2.connect(fm.frequency); lfo2.connect(lg2); lfo2.start(now); oscs.push(lfo2);
    if (P.ref.wow) {
      const w = ctx.createOscillator(); w.frequency.value = 0.47; const wg = ctx.createGain(); wg.gain.value = 9;
      w.connect(wg); wg.connect(a.detune); wg.connect(b.detune); w.start(now); oscs.push(w);
    }
  };
  // automatización por compás (filtro y nivel del dron, subida antes de la ruptura)
  V.bar = function (T, bi) {
    const P = this.P, e = P.energy[bi], f = this.droneF.frequency, g = this.droneGain.gain;
    const cut = 170 + 1100 * Math.pow(e, 1.5);
    if (bi === 7) { f.setTargetAtTime(cut, T, 0.1); f.linearRampToValueAtTime(1500, T + P.bar * 0.98); }
    else if (bi === 8) { f.cancelScheduledValues(T); f.setValueAtTime(380, T); f.setTargetAtTime(cut, T + 0.05, P.bar * 0.3); }
    else f.setTargetAtTime(cut, T, P.bar * 0.35);
    g.setTargetAtTime(this.droneLevel(bi), T, P.bar * 0.3);
    if (P.vowels) { // el dron pronuncia la palabra: una vocal por medio compás
      const FMT = { a: [800, 1250], e: [480, 1900], i: [300, 2250], o: [500, 880], u: [330, 760] }, n = P.vowels.length;
      for (let h = 0; h < 2; h++) { const [f1, f2] = FMT[P.vowels[(bi * 2 + h) % n]] || FMT.a, tt = T + h * P.bar * 0.5;
        this.fm.frequency.setTargetAtTime(f1, tt, 0.09); this.fm2.frequency.setTargetAtTime(Math.min(f2, 1400), tt, 0.09); }
    }
    if (bi === 7) this.riser(T, P.bar);
  };
  V.droneLevel = function (bi) { return this.S.lv.drone * (0.45 + 0.75 * this.P.energy[bi]); };
  // subida continua hacia el impacto (no silencio en seco)
  V.riser = function (T, d) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.setPeriodicWave(this.S.saw2); o.frequency.value = hz(this.P.root + 24);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(180, T); f.frequency.exponentialRampToValueAtTime(1600, T + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.09, T + d * 0.97); g.gain.linearRampToValueAtTime(0, T + d);
    o.connect(f); f.connect(g); g.connect(this.out); g.connect(this.send); o.start(T); o.stop(T + d + 0.05);
  };

  V.kick = function (T, v, vDuck) {
    const ctx = this.ctx, r = this.P.refId;
    const tail = r === 'lanark' ? 0.42 : r === 'orphx' ? 0.26 : r === 'squarepusher' ? 0.16 : 0.22;
    const fEnd = r === 'lanark' ? 40 : 46, fStart = r === 'squarepusher' ? 170 : 150;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(fStart, T); o.frequency.setTargetAtTime(fEnd, T, 0.03);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.95, T + 0.0015); g.gain.setTargetAtTime(0, T + 0.004, tail * 0.55);
    o.connect(g); g.connect(this.drum); o.start(T); o.stop(T + tail * 5);
    const c = ctx.createOscillator(); c.frequency.value = 1150; const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, T); cg.gain.linearRampToValueAtTime(v * 0.1, T + 0.0008); cg.gain.setTargetAtTime(0, T + 0.001, 0.0035);
    c.connect(cg); cg.connect(this.drum); c.start(T); c.stop(T + 0.05);
    const k = ctx.createOscillator(); k.type = 'triangle'; k.frequency.setValueAtTime(320, T); k.frequency.setTargetAtTime(110, T, 0.02);
    const kg = ctx.createGain(); kg.gain.setValueAtTime(0, T); kg.gain.linearRampToValueAtTime(v * 0.22, T + 0.001); kg.gain.setTargetAtTime(0, T + 0.002, 0.03);
    k.connect(kg); kg.connect(this.drum); k.start(T); k.stop(T + 0.25);
    this.sideDuck(T, vDuck ?? v);
  };
  V.sideDuck = function (T, v) {
    const g = this.droneGain.gain; // el dron cede un poco al bombo
    const bi = ((Math.floor((T - this.t0) / this.P.bar) % 16) + 16) % 16, base = this.droneLevel(bi);
    g.setTargetAtTime(base * (1 - 0.35 * v), T, 0.004); g.setTargetAtTime(base, T + 0.03, 0.12);
  };
  const MODES = [1, 2.756, 5.404, 8.933], MAMP = [1, 0.7, 0.42, 0.2];
  V.metal = function (T, v, p, opt = {}) {
    const ctx = this.ctx, P = this.P;
    const f0 = (opt.f0 || P.metalBase * [1, 1.19, 1.5, 0.75][p | 0]);
    const d = (opt.decay || P.ref.metalDecay) * (0.7 + 0.6 * v);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1450; lp.Q.value = 0.7;
    const pan = ctx.createStereoPanner(); pan.pan.value = opt.pan ?? (H(P.seed, 40, Math.round(T * 100), p) - 0.5) * 1.2;
    const g = ctx.createGain(); g.gain.value = v * 0.34 * (opt.gain || 1);
    lp.connect(pan); pan.connect(g); g.connect(this.out); g.connect(this.send);
    if (opt.sweep) { pan.pan.setValueAtTime(-0.9, T); pan.pan.linearRampToValueAtTime(0.9, T + opt.sweep); }
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(); o.frequency.value = f0 * MODES[i] * (1 + (H(P.seed, 41, i, p) - 0.5) * 0.01);
      const og = ctx.createGain(), di = d / (1 + i * 0.9);
      og.gain.setValueAtTime(0, T); og.gain.linearRampToValueAtTime(MAMP[i], T + 0.002 + i * 0.0005); og.gain.setTargetAtTime(0, T + 0.003, di * 0.45);
      o.connect(og); og.connect(lp); o.start(T); o.stop(T + di * 3.5 + 0.05);
    }
  };
  V.tick = function (T, v, p) {
    const ctx = this.ctx, P = this.P;
    const fc = 560 + 760 * p, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
    car.frequency.value = fc; mod.frequency.value = fc * 1.41;
    mg.gain.setValueAtTime(fc * 1.8, T); mg.gain.setTargetAtTime(0, T, 0.006);
    mod.connect(mg); mg.connect(car.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1550;
    const pan = ctx.createStereoPanner(); pan.pan.value = (H(P.seed, 42, Math.round(T * 1000), 0) - 0.5) * 1.4;
    const g = ctx.createGain(), dk = P.refId === 'squarepusher' ? 0.012 : 0.02 + 0.012 * p;
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.2, T + 0.0012); g.gain.setTargetAtTime(0, T + 0.002, dk);
    car.connect(lp); lp.connect(pan); pan.connect(g); g.connect(this.drum);
    car.start(T); mod.start(T); car.stop(T + dk * 7 + 0.02); mod.stop(T + dk * 7 + 0.02);
  };
  V.bass = function (T, v, p, d) {
    const ctx = this.ctx, P = this.P;
    const o = ctx.createOscillator(); o.setPeriodicWave(this.S.saw2); o.frequency.value = hz(P.root + 12 + p);
    const s = ctx.createOscillator(); s.frequency.value = hz(P.root + p);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(1300, T); f.frequency.setTargetAtTime(560, T, 0.09);
    const ws = this.S.bassShaper || (this.S.bassShaper = null), g = ctx.createGain(), sg = ctx.createGain(); sg.gain.value = 0.6;
    const wsn = ctx.createWaveShaper(); wsn.curve = this.S.curve16; wsn.oversample = '2x';
    const dur = Math.max(0.12, d || 0.3);
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.42, T + 0.004);
    g.gain.setTargetAtTime(v * 0.25, T + 0.01, 0.06); g.gain.setTargetAtTime(0, T + dur, 0.05);
    o.connect(f); s.connect(sg); sg.connect(f); f.connect(wsn); wsn.connect(g); g.connect(this.out);
    o.start(T); s.start(T); o.stop(T + dur + 0.4); s.stop(T + dur + 0.4);
  };
  V.impact = function (T, v) {
    const ctx = this.ctx, P = this.P;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, T); o.frequency.exponentialRampToValueAtTime(34, T + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.85, T + 0.004); g.gain.setTargetAtTime(0, T + 0.02, 0.55);
    o.connect(g); g.connect(this.drum); o.start(T); o.stop(T + 3.5);
    this.kick(T, v);
    [0.5, 0.37, 0.62].forEach((k, i) => this.metal(T + i * 0.004, v * 0.8, 0, { f0: P.metalBase * k, decay: 2.4, gain: 1.3, sweep: 1.3, pan: 0 }));
  };

  // planifica todo lo que cae antes de `until` (tiempo de contexto)
  V.schedule = function (until) {
    if (this.dead) return;
    if (this.stopAt && this.cursor >= this.stopAt) return;
    const P = this.P, L = P.L;
    let a = this.cursor; const b = until;
    if (b <= a) return;
    const ta = a - this.t0, tb = b - this.t0;
    for (let k = Math.floor(ta / L); k <= Math.floor(tb / L); k++) {
      const lo = ta - k * L, hi = tb - k * L, base = this.t0 + k * L;
      for (const name of ['kick', 'tick', 'metal', 'bass', 'impact']) {
        const arr = P.ev[name];
        let i = lowerBound(arr, lo);
        for (; i < arr.length && arr[i].t < hi; i++) {
          const x = arr[i], T = base + x.t;
          if (T < this.ctx.currentTime - 0.005 && !(this.ctx instanceof OfflineAudioContext)) continue;
          if (this.S.only && !this.S.only.includes(name)) continue;
          const lv = this.S.lv;
          if (name === 'kick') this.kick(T, x.v * lv.kick, x.v);
          else if (name === 'tick') this.tick(T, x.v * lv.tick, x.p);
          else if (name === 'metal') this.metal(T, x.v * lv.metal, x.p);
          else if (name === 'bass') this.bass(T, x.v * lv.bass, x.p, x.d);
          else this.impact(T, x.v * lv.impact);
        }
      }
      for (let bi = 0; bi < P.bars; bi++) { const bt = bi * P.bar; if (bt >= lo && bt < hi) this.bar(base + bt, bi); }
    }
    this.cursor = b;
  };
  function lowerBound(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < t) lo = m + 1; else hi = m; } return lo; }

  // firma sonora de VØID_LOOM (5,5 s): hilos que caen, vacío, hilo de color, descifrado
  Sound.prototype.sting = function (T, root = 30) {
    const ctx = this.ctx, out = ctx.createGain(); out.gain.value = 0.9; out.connect(this.in);
    const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = makeIR(ctx, 3.2, 3800, 5); const vg = ctx.createGain(); vg.gain.value = 0.25;
    cv.connect(vg); vg.connect(out);
    for (let i = 0; i < 7; i++) {
      const t = T + i * 0.08, o = ctx.createOscillator(); o.frequency.setValueAtTime(hz(root + 48 - i * 2), t); o.frequency.exponentialRampToValueAtTime(hz(root + 24), t + 0.6);
      const p = ctx.createStereoPanner(); p.pan.value = (i - 3) / 3.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.05); g.gain.setTargetAtTime(0, t + 0.3, 0.15);
      o.connect(p); p.connect(g); g.connect(out); g.connect(cv); o.start(t); o.stop(t + 1.4);
    }
    const ti = T + 0.75, s = ctx.createOscillator(); s.frequency.setValueAtTime(110, ti); s.frequency.exponentialRampToValueAtTime(32, ti + 1.6);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0, ti); sg.gain.linearRampToValueAtTime(0.75, ti + 0.004); sg.gain.setTargetAtTime(0, ti + 0.02, 0.6);
    s.connect(sg); sg.connect(out); sg.connect(cv); s.start(ti); s.stop(ti + 4);
    const tw = T + 1.05;
    [root + 24, root + 31].forEach((m, i) => {
      const o = ctx.createOscillator(); o.frequency.value = hz(m); const g = ctx.createGain();
      g.gain.setValueAtTime(0, tw); g.gain.linearRampToValueAtTime(0.06 / (i + 1), tw + 0.4); g.gain.setValueAtTime(0.06 / (i + 1), T + 4.4); g.gain.linearRampToValueAtTime(0, T + 5.4);
      o.connect(g); g.connect(out); g.connect(cv); o.start(tw); o.stop(T + 5.5);
    });
    for (let i = 0; i < 22; i++) {
      const t = T + 1.5 + i * 0.05 + (i % 3) * 0.008, o = ctx.createOscillator(); o.frequency.value = 700 + ((i * 137) % 600);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.001); g.gain.setTargetAtTime(0, t + 0.002, 0.008);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
    }
    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, (T + 6.5 - ctx.currentTime) * 1000);
  };

  // render offline de una pieza (validación y exportación de audio)
  Sound.renderOffline = async function (P, seconds, sr = 48000, only) {
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
    const S = new Sound(ctx); S.only = only;
    const v = S.piece(P, 0, 1); v.schedule(seconds);
    const buf = await ctx.startRendering();
    return [buf.getChannelData(0), buf.getChannelData(1)];
  };

  window.SemillaSound = Sound;
})();
