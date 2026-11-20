/* VØID_LOOM · SEMILLA — sonido sintetizado desde la partitura.
   Cada semilla suena con uno de seis estilos propios (REJILLA, PULSO, ABISMO, QUIEBRE, VAIVÉN, CINTA).
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
    const make = ctx.createGain(); make.gain.value = 0.85; this.make = make;
    this.lv = { drone: 0.14, kick: 0.3, tick: 0.3, metal: 0.8, bass: 0.4, impact: 0.75, tex: 1, corte: 0.8 };
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3.6; lim.ratio.value = 20; lim.knee.value = 0; lim.attack.value = 0.001; lim.release.value = 0.08;
    // techo de seguridad: recorte suave por encima de -3 dBFS, nunca pasa de -1,2 dBFS
    const clip = ctx.createWaveShaper(), N = 4096, cv = new Float32Array(N), knee = 0.708, top = 0.87;
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x);
      cv[i] = Math.sign(x) * (a <= knee ? a : knee + (top - knee) * Math.tanh((a - knee) / (top - knee))); }
    clip.curve = cv; clip.oversample = '4x';
    this.in = ctx.createGain();
    this.out = ctx.createGain(); this.out.gain.value = 1;   // VOLUMEN DE SALA: se calibra en el montaje
    // agudos domados: nada pincha en una sala con altavoces grandes
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 2200; shelf.gain.value = -6;
    this.in.connect(hp); hp.connect(shelf); shelf.connect(glue); glue.connect(make); make.connect(lim); lim.connect(clip); clip.connect(this.out);
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
    if (S.only && !S.only.includes('tex')) this.texGain.disconnect();
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
    const fg2 = ctx.createGain(); fg2.gain.value = P.vowels ? 0.3 : 0;
    if (P.vowels) { fm.Q.value = 9; fg.gain.value = 0.75; }
    this.fm = fm; this.fm2 = fm2;
    f.connect(g); fm.connect(fg); fg.connect(g); fm2.connect(fg2); fg2.connect(g); g.connect(this.out); g.connect(this.send);
    const mk = (freq, det, type, gain, dest) => {
      const o = ctx.createOscillator(); if (type === 'saw') o.setPeriodicWave(this.S.saw); else o.type = type;
      o.frequency.value = freq; o.detune.value = det; const og = ctx.createGain(); og.gain.value = gain;
      o.connect(og); og.connect(dest); o.start(now); oscs.push(o); return o;
    };
    const r = P.root + 12, sh = P.droneShape, iv = P.ivl ?? 7, eng = P.drone || 'sierra';
    // MOTORES DE DRON: cada pieza tiene su propia voz de fondo, oscura y enigmática
    const lfoTo = (rate, depth, param) => { const l = ctx.createOscillator(); l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg); lg.connect(param); l.start(now); oscs.push(l); return l; };
    const fmPair = (fc, ratio, idx, gain, dest, det = 0) => {   // portadora + moduladora; el índice deriva despacio
      const c = mk(fc, det, 'sine', gain, dest), m = ctx.createOscillator(); m.frequency.value = fc * ratio;
      const mg = ctx.createGain(); mg.gain.value = fc * idx; m.connect(mg); mg.connect(c.frequency); m.start(now); oscs.push(m);
      lfoTo(0.031 + sh * 0.05, fc * idx * 0.7, mg.gain); return c;
    };
    let a, b, fifth;
    if (eng === 'fm') {            // FM grave e inarmónica: metal que respira
      const ratio = [1.414, 0.5, 2.76, 1.5][Math.floor(sh * 4)];
      a = fmPair(hz(r), ratio, 1.6, 0.34, f, -4); b = fmPair(hz(r), ratio * 1.003, 1.2, 0.26, f, 5);
      fifth = fmPair(hz(r + iv), ratio, 0.9, 0.14, f); mk(hz(r + 12), 3, 'sine', 0.05, fm);
      f.Q.value = 1.2;
    } else if (eng === 'pulso') {  // cuadradas desafinadas en un filtro resonante que barre
      a = mk(hz(r), -9, 'square', 0.2, f); b = mk(hz(r), 8, 'square', 0.2, f);
      fifth = mk(hz(r + iv), 3, 'square', 0.09, f); mk(hz(r - 12), 0, 'square', 0.08, f);
      f.Q.value = 7; lfoTo(1 / (P.bar * 2), 140, f.frequency);
    } else if (eng === 'organo') { // aditivo: parciales impares que se apagan, como un órgano en una nave vacía
      const n = 14, re = new Float32Array(n + 1), im = new Float32Array(n + 1), im2 = new Float32Array(n + 1);
      for (let k = 1; k <= n; k++) { im[k] = (k % 2 ? 1 : 0.15) / Math.pow(k, 1.3); im2[k] = (k % 3 === 0 ? 0.8 : 0.2) / k; }
      const w1 = ctx.createPeriodicWave(re, im), w2 = ctx.createPeriodicWave(re, im2);
      const o1 = mk(hz(r), -3, 'sine', 0.3, f), o2 = mk(hz(r), 4, 'sine', 0.24, f); o1.setPeriodicWave(w1); o2.setPeriodicWave(w2);
      a = o1; b = o2; fifth = mk(hz(r + iv), 0, 'sine', 0.12, f); fifth.setPeriodicWave(w1); mk(hz(r + 24), 0, 'sine', 0.03, fm);
    } else if (eng === 'coro') {   // racimo de triángulos por formantes: un coro sin boca
      a = mk(hz(r), -14, 'triangle', 0.18, fm); b = mk(hz(r), 15, 'triangle', 0.18, fm);
      mk(hz(r), -5, 'triangle', 0.16, f); mk(hz(r), 6, 'triangle', 0.16, f);
      fifth = mk(hz(r + iv), -8, 'triangle', 0.12, fm); mk(hz(r + iv), 9, 'triangle', 0.1, f);
      fm.Q.value = 7; fg.gain.value = 1.4;
    } else if (eng === 'sub') {    // seno grave saturado: un zumbido físico, casi sin altura
      const ws = ctx.createWaveShaper(); ws.curve = shaper(ctx, 3.2).curve; ws.oversample = '2x'; ws.connect(f);
      a = mk(hz(r - 12), -3, 'sine', 0.55, ws); b = mk(hz(r), 4, 'sine', 0.3, ws);
      fifth = mk(hz(r + iv - 12), 0, 'sine', 0.2, ws); lfoTo(0.07, 0.25, b.frequency);
      f.Q.value = 3.5;
    } else if (eng === 'anillo') { // modulación en anillo lenta: dos senos que se rozan y baten
      const ring = ctx.createGain(); ring.gain.value = 0; ring.connect(f);
      a = mk(hz(r + 12), 0, 'sine', 0.9, ring); const m = ctx.createOscillator(); m.frequency.value = hz(r + 12) * (1.07 + sh * 0.05);
      m.connect(ring.gain); m.start(now); oscs.push(m);
      b = mk(hz(r), 5, 'triangle', 0.22, f); fifth = mk(hz(r + iv), -4, 'triangle', 0.1, f);
    } else if (eng === 'fantasma') { // senos con vibrato y temblor lentos y un susurro de formante: algo que no está del todo
      a = mk(hz(r), -6, 'sine', 0.3, f); b = mk(hz(r + 12), 7, 'sine', 0.12, f);
      lfoTo(0.19, 6, a.detune); lfoTo(0.13, 9, b.detune);
      fifth = mk(hz(r + iv + 12), 0, 'triangle', 0.08, fm); lfoTo(0.09, 12, fifth.detune);
      const tg = ctx.createGain(); tg.gain.value = 0.7; f.disconnect(); f.connect(tg); tg.connect(g); lfoTo(0.23, 0.3, tg.gain);
      fm.Q.value = 12; fg.gain.value = 1.2;
    } else {                       // SIERRA: sierras suaves desafinadas con quinta y formante
      a = mk(hz(r), -7, 'saw', 0.32, f); b = mk(hz(r), 6, 'saw', 0.32, f);
      fifth = mk(hz(r + iv), -3 + sh * 4, 'saw', 0.14, f);
      mk(hz(r + 12 + (sh > 0.5 ? 3 : 0)), 2, 'saw', P.vowels ? 0.16 : 0.07, fm);
    }
    if (P.vowels) { mk(hz(r + 12), -4, 'saw', 0.12, fm2); mk(hz(r + 7), 5, 'saw', 0.08, fm); }
    const sub = ctx.createOscillator(); sub.frequency.value = hz(P.root); const sg = ctx.createGain(); sg.gain.value = 0.08 * (0.6 + 0.8 * (P.weight ?? 0.5));   // las palabras pesadas pesan en el sub
    sub.connect(sg); sg.connect(g); sub.start(now); oscs.push(sub);
    // respiración ligada al bucle (2 ciclos por vuelta) y barrido del formante
    const lfo = ctx.createOscillator(); lfo.frequency.value = 2 / P.L; const lg = ctx.createGain(); lg.gain.value = 110;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start(now); oscs.push(lfo);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 1 / P.L; const lg2 = ctx.createGain(); lg2.gain.value = 260;
    if (!P.vowels) lg2.connect(fm.frequency); lfo2.connect(lg2); lfo2.start(now); oscs.push(lfo2);
    this.fifth = fifth;
    this.textura();
    if (P.ref.wow) {
      const w = ctx.createOscillator(); w.frequency.value = 0.47; const wg = ctx.createGain(); wg.gain.value = 9;
      w.connect(wg); wg.connect(a.detune); wg.connect(b.detune); w.start(now); oscs.push(w);
    }
  };
  // automatización por compás (filtro y nivel del dron, subida antes de la ruptura)
  V.bar = function (T, bi) {
    const P = this.P, e = P.energy[bi], f = this.droneF.frequency, g = this.droneGain.gain;
    const cut = (170 + 1100 * Math.pow(e, 1.5)) * (0.7 + 0.6 * (P.bright ?? 0.5));   // luz ↔ oscuridad: el dron se abre o se cierra
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
    // la textura de materia crece con la energía
    if (this.texGain) this.texGain.gain.setTargetAtTime(this.S.lv.tex * 0.1 * (0.25 + 0.75 * e) * (P.vowels ? 0.8 : 1), T, P.bar * 0.25);
    const sh = window.SEMILLA.shotAt(P, bi);
    if (window.SEMILLA.CUTS.includes(bi)) this.corte(T, sh);
  };
  // TEXTURA: la materia suena como una máquina, no como una campana. Cuatro motores continuos (sin ruido),
  // con pulso a tempo: MOTOR (cuadradas que laten), ALIENTO (formantes que respiran), REJILLA (modulación en anillo
  // inarmónica, cortada a tempo) y GRAVE (gruñido bajo con el filtro abriéndose).
  V.textura = function () {
    const ctx = this.ctx, P = this.P, now = this.cursor, oscs = this.oscs, r = P.root + 12;   // la textura vive en los medios: el grave es del dron y del bombo
    const rates = [0.5, 1, 2, 0.75, 1.5]; this.texRate = (P.bpm / 60) * rates[Math.floor(P.vis.v[3] * rates.length)];
    const out = ctx.createGain(); out.gain.value = 0.0001; this.texGain = out;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
    out.connect(this.out); out.connect(this.send);
    const vca = ctx.createGain(); vca.gain.value = 0.5; vca.connect(lp);
    // pulso a tempo: una onda que late (cuadrada redondeada por un filtro) abre y cierra el motor
    const ex = ctx.createOscillator(); ex.type = P.tex === 'aliento' ? 'sine' : 'square'; ex.frequency.value = this.texRate;
    const exf = ctx.createBiquadFilter(); exf.type = 'lowpass'; exf.frequency.value = 30;
    const exg = ctx.createGain(); exg.gain.value = P.tex === 'grave' ? 0.25 : 0.45;
    ex.connect(exf); exf.connect(exg); exg.connect(vca.gain); ex.start(now); oscs.push(ex); this.ex = ex;
    this.tosc = [];
    const osc = (type, f, dest, g = 1, det = 0) => {
      const o = ctx.createOscillator(); if (type === 'saw') o.setPeriodicWave(this.S.saw); else o.type = type;
      o.frequency.value = f; o.detune.value = det; const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(dest); o.start(now); oscs.push(o); this.tosc.push({ o, base: f }); return o;
    };
    const k = P.tex || 'motor';
    if (k === 'motor') {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 5; f.connect(vca);
      osc('square', hz(r + 19), f, 0.5, -6); osc('square', hz(r + 19), f, 0.5, 7); osc('square', hz(r + 12), f, 0.35);
      const l = ctx.createOscillator(); l.frequency.value = 1 / P.bar; const lg = ctx.createGain(); lg.gain.value = 260; l.connect(lg); lg.connect(f.frequency); l.start(now); oscs.push(l);
    } else if (k === 'aliento') {
      const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 420; b1.Q.value = 3.5; b1.connect(vca);
      const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 900; b2.Q.value = 4; b2.connect(vca);
      osc('saw', hz(r + 12), b1, 0.8, -5); osc('saw', hz(r + 19), b2, 0.6, 5); osc('saw', hz(r + 24), b2, 0.4, -3);
      const l = ctx.createOscillator(); l.frequency.value = 0.5 / P.bar; const lg = ctx.createGain(); lg.gain.value = 260; l.connect(lg); lg.connect(b1.frequency);
      const lg2 = ctx.createGain(); lg2.gain.value = -420; l.connect(lg2); lg2.connect(b2.frequency); l.start(now); oscs.push(l);
      vca.gain.value = 0.75; exg.gain.value = 0.25;
    } else if (k === 'rejilla') {
      const ring = ctx.createGain(); ring.gain.value = 0; ring.connect(vca);
      osc('sine', hz(r + 19), ring, 1);
      const m = ctx.createOscillator(); m.frequency.value = hz(r + 19) * 1.37; const mg = ctx.createGain(); mg.gain.value = 1;
      m.connect(mg); mg.connect(ring.gain); m.start(now); oscs.push(m); this.tosc.push({ o: m, base: hz(r + 19) * 1.37 });
      osc('triangle', hz(r + 19), vca, 0.25);
    } else {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 7;
      const ws = shaper(ctx, 2.4); f.connect(ws); ws.connect(vca);
      osc('saw', hz(r + 7), f, 0.7, -8); osc('saw', hz(r + 7), f, 0.7, 9); osc('square', hz(r + 12), f, 0.4);
      const l = ctx.createOscillator(); l.frequency.value = this.texRate / 4; const lg = ctx.createGain(); lg.gain.value = 180; l.connect(lg); lg.connect(f.frequency); l.start(now); oscs.push(l);
      lp.frequency.value = 900;
    }
  };
  // CORTE de plano: golpe de chapa con cola, el dron cambia de intervalo y el espacio cambia con el tipo de plano
  V.corte = function (T, shot) {
    const P = this.P, lv = this.S.lv, big = shot.i === 3; // el corte del compás 8 es la RUPTURA (lo hace el impacto)
    const v = P.axes ? P.axes[0] : 0.5;   // los cambios de plano mueven la armonía según el sentido
    const INT = v > 0.6 ? [7, 5, 12, 7, 10, 5, 7, 12] : v < 0.38 ? [6, 1, 8, 3, 6, 11, 1, 6] : [7, 5, 10, 3, 8, 1, 6, 2];
    this.fifth.frequency.setTargetAtTime(hz(P.root + 12 + INT[shot.i % INT.length]), T, 0.4);
    const mul = 0.94 + 0.12 * shot.K;
    this.tosc.forEach((r) => r.o.frequency.setTargetAtTime(r.base * mul, T, 0.05));
    this.ex.frequency.setTargetAtTime(this.texRate * (shot.type === 1 ? 2 : shot.type === 0 ? 0.5 : 1), T, 0.02);
    // macro cercano y seco; general abierto
    this.send.gain.setTargetAtTime(shot.type === 1 ? 0.5 : shot.type === 0 ? 1.8 : 1.1, T, 0.08);
    if (shot.i > 0 && !big) this.metal(T, 0.85 * lv.corte, 0, { f0: P.metalBase * (0.45 + 0.2 * shot.K), decay: 0.9, gain: 1.1, pan: (shot.K - 0.5) * 1.4 });
    if (shot.i > 0 && !big) this.kick(T, 0.55 * lv.kick / 0.3 * 0.3, 0.4);
  };
  const DTRIM = { coro: 1.7, fantasma: 1.65, sub: 0.62, anillo: 0.6 };   // cada motor suena con el mismo peso
  V.droneLevel = function (bi) { const e = this.P.energy[bi]; return this.S.lv.drone * (DTRIM[this.P.drone] || 1) * (this.P.vowels ? 0.3 + 0.75 * e : 0.45 + 0.75 * e); };   // con voz, la SEÑAL más baja: el arco se oye
  // subida continua hacia el impacto (no silencio en seco)
  V.riser = function (T, d) {
    const ctx = this.ctx, o = ctx.createOscillator(), de = this.P.drone; if (de === 'fm' || de === 'pulso') o.type = 'square'; else if (de === 'coro' || de === 'fantasma' || de === 'organo') o.type = 'triangle'; else o.setPeriodicWave(this.S.saw2); o.frequency.value = hz(this.P.root + 24);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(180, T); f.frequency.exponentialRampToValueAtTime(1600, T + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.09, T + d * 0.97); g.gain.linearRampToValueAtTime(0, T + d);
    o.connect(f); f.connect(g); g.connect(this.out); g.connect(this.send); o.start(T); o.stop(T + d + 0.05);
  };

  V.kick = function (T, v, vDuck) {
    const ctx = this.ctx, r = this.P.refId;
    const tail = r === 'abismo' ? 0.42 : r === 'pulso' ? 0.26 : r === 'quiebre' ? 0.16 : 0.22;
    const fEnd = r === 'abismo' ? 40 : 46, fStart = r === 'quiebre' ? 170 : 150;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(fStart, T); o.frequency.setTargetAtTime(fEnd, T, 0.03);
    const g = ctx.createGain(), kv = v * 0.95 * Math.min(1, Math.sqrt(0.24 / tail));
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(kv, T + 0.0015); g.gain.setTargetAtTime(0, T + 0.004, tail * 0.55);
    o.connect(g); g.connect(this.drum); o.start(T); o.stop(T + tail * 5);
    const c = ctx.createOscillator(); c.frequency.value = 800; const cg = ctx.createGain();
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
  // METAL → MATERIA: cada pieza golpea con su kit. Ninguno suena a campana: el brillo se apaga en milisegundos.
  // CHAPA (FM golpeada que cae de altura), DATOS (ráfagas de micro-cortes), PISTÓN (golpe mecánico grave),
  // CADENA (granos de sierra que se aceleran). p (0–3) varía el gesto dentro del kit.
  V.metal = function (T, v, p, opt = {}) {
    const ctx = this.ctx, P = this.P, kit = opt.kit || P.kit || 'chapa';
    const f0 = (opt.f0 || P.metalBase * [1, 1.19, 1.5, 0.75][p | 0]);
    const d = (opt.decay || P.ref.metalDecay) * (0.7 + 0.6 * v);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950; lp.Q.value = 0.5;
    const pan = ctx.createStereoPanner(); pan.pan.value = opt.pan ?? (H(P.seed, 40, Math.round(T * 100), p) - 0.5) * 1.2;
    const g = ctx.createGain(); g.gain.value = v * (opt.gain || 1);
    lp.connect(pan); pan.connect(g); g.connect(this.out); g.connect(this.send);
    if (opt.sweep) { pan.pan.setValueAtTime(-0.9, T); pan.pan.linearRampToValueAtTime(0.9, T + opt.sweep); }
    const env = (node, a, peak, tau, at = T) => { node.gain.setValueAtTime(0, at); node.gain.linearRampToValueAtTime(peak, at + a); node.gain.setTargetAtTime(0, at + a + 0.001, tau); };
    const hh = (i) => H(P.seed, 43, Math.round(T * 1000), i);
    if (kit === 'chapa') {
      const dd = Math.min(0.45, d * 0.4), ratio = [1.41, 2.13, 0.71, 3.3][Math.floor(hh(0) * 4)];
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), og = ctx.createGain();
      c.frequency.setValueAtTime(f0 * 1.12, T); c.frequency.exponentialRampToValueAtTime(f0 * 0.9, T + 0.08);
      m.frequency.value = f0 * ratio; mg.gain.setValueAtTime(f0 * 2.2, T); mg.gain.setTargetAtTime(0, T, 0.018);
      m.connect(mg); mg.connect(c.frequency); env(og, 0.003, 0.42, dd * 0.45); c.connect(og); og.connect(lp);
      c.start(T); m.start(T); c.stop(T + dd * 4 + 0.05); m.stop(T + dd * 4 + 0.05);
      const b = ctx.createOscillator(), bg = ctx.createGain(); b.frequency.setValueAtTime(f0 * 0.5, T); b.frequency.exponentialRampToValueAtTime(f0 * 0.32, T + 0.1);
      env(bg, 0.002, 0.3, 0.05); b.connect(bg); bg.connect(lp); b.start(T); b.stop(T + 0.4);
    } else if (kit === 'datos') {
      const n = 3 + Math.floor(hh(1) * 4), gap = 0.016 + hh(2) * 0.016;
      for (let i = 0; i < n; i++) {
        const t = T + i * gap * (1 + (p & 1) * 0.35 * i / n), o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), og = ctx.createGain();
        const f = 180 + Math.floor(hh(3 + i) * 8) * 60; o.type = 'sine'; o.frequency.value = f; m.frequency.value = f * 0.5; mg.gain.value = f * 0.25;
        m.connect(mg); mg.connect(o.frequency); env(og, 0.002, 0.36 * (1 - 0.5 * i / n), 0.008 + 0.005 * p, t); o.connect(og); og.connect(lp);
        o.start(t); m.start(t); o.stop(t + 0.07); m.stop(t + 0.07);
      }
    } else if (kit === 'piston') {
      const o = ctx.createOscillator(), og = ctx.createGain(), ws = ctx.createWaveShaper(); ws.curve = this.S.curve16;
      o.frequency.setValueAtTime(f0 * 0.28, T); o.frequency.exponentialRampToValueAtTime(f0 * 0.62, T + 0.035); o.frequency.exponentialRampToValueAtTime(f0 * 0.22, T + 0.2);
      env(og, 0.002, 0.7, 0.06 + 0.04 * p); o.connect(ws); ws.connect(og); og.connect(lp); o.start(T); o.stop(T + 0.6);
      const k = ctx.createOscillator(), kg = ctx.createGain(); k.type = 'triangle'; k.frequency.value = f0 * 1.4;
      const kf = ctx.createBiquadFilter(); kf.type = 'bandpass'; kf.frequency.value = Math.min(800, f0 * 1.8); kf.Q.value = 3;
      env(kg, 0.0008, 0.2, 0.008, T + 0.045); k.connect(kf); kf.connect(kg); kg.connect(lp); k.start(T); k.stop(T + 0.2);
    } else {
      const n = 5 + Math.floor(hh(1) * 4), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.value = Math.min(700, f0 * 1.3); bp.connect(lp);
      let t = T, gap = 0.045 - 0.01 * p;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.setPeriodicWave(this.S.saw2); o.frequency.value = f0 * (0.5 + 0.08 * ((i * 3) % 5));
        env(og, 0.003, 0.55 * (0.5 + 0.5 * (i / n)), 0.014, t); o.connect(og); og.connect(bp); o.start(t); o.stop(t + 0.09);
        t += gap; gap *= 0.78;
      }
    }
  };
  V.tick = function (T, v, p) {
    const ctx = this.ctx, P = this.P;
    const fc = 360 + 380 * p, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
    car.frequency.value = fc; mod.frequency.value = fc * 1.41;
    mg.gain.setValueAtTime(fc * 0.8, T); mg.gain.setTargetAtTime(0, T, 0.005);
    mod.connect(mg); mg.connect(car.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950;
    const pan = ctx.createStereoPanner(); pan.pan.value = (H(P.seed, 42, Math.round(T * 1000), 0) - 0.5) * 1.4;
    const g = ctx.createGain(), dk = P.refId === 'quiebre' ? 0.012 : 0.02 + 0.012 * p;
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.2, T + 0.003); g.gain.setTargetAtTime(0, T + 0.002, dk);
    car.connect(lp); lp.connect(pan); pan.connect(g); g.connect(this.drum);
    car.start(T); mod.start(T); car.stop(T + dk * 7 + 0.02); mod.stop(T + dk * 7 + 0.02);
  };
  // BAJO: cinco motores; cada pieza usa uno (oscuros, con armónicos para que se oiga en altavoces pequeños)
  V.bass = function (T, v, p, d) {
    const ctx = this.ctx, P = this.P, eng = P.bassEng || 'sierra', fr = hz(P.root + 12 + p), dur = Math.max(0.12, d || 0.3);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.4;
    const wsn = ctx.createWaveShaper(); wsn.curve = this.S.curve16; wsn.oversample = '2x';
    const g = ctx.createGain(), srcs = [];
    const osc = (type, freq, gain, det = 0) => { const o = ctx.createOscillator(); if (type === 'saw') o.setPeriodicWave(this.S.saw2); else o.type = type;
      o.frequency.value = freq; o.detune.value = det; const og = ctx.createGain(); og.gain.value = gain; o.connect(og); og.connect(f); srcs.push(o); return o; };
    if (eng === 'fm') {
      const c = osc('sine', fr, 1), m = ctx.createOscillator(), mg = ctx.createGain(); m.frequency.value = fr * (p === 7 ? 1.5 : 1);
      mg.gain.setValueAtTime(fr * 3.2, T); mg.gain.setTargetAtTime(fr * 0.4, T, 0.07); m.connect(mg); mg.connect(c.frequency); srcs.push(m);
      osc('sine', fr / 2, 0.6); f.frequency.value = 900;
    } else if (eng === 'cuadrada') {
      osc('square', fr, 0.55); osc('sine', fr / 2, 0.5); f.Q.value = 5;
      f.frequency.setValueAtTime(1400, T); f.frequency.setTargetAtTime(240, T, 0.05);
    } else if (eng === 'reese') {
      osc('saw', fr, 0.5, -14); osc('saw', fr, 0.5, 13); osc('sine', fr / 2, 0.5); f.frequency.value = 520; f.Q.value = 0.9;
    } else if (eng === 'seno') {
      osc('sine', fr, 0.8); osc('sine', fr / 2, 0.36); f.frequency.value = 1100;
      wsn.curve = shaper(ctx, 4).curve;
    } else {
      osc('saw', fr, 1); osc('sine', fr / 2, 0.6);
      f.frequency.setValueAtTime(1300, T); f.frequency.setTargetAtTime(560, T, 0.09);
    }
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.42, T + 0.004);
    g.gain.setTargetAtTime(v * 0.25, T + 0.01, 0.06); g.gain.setTargetAtTime(0, T + dur, 0.05);
    f.connect(wsn); wsn.connect(g); g.connect(this.out);
    for (const o of srcs) { o.start(T); o.stop(T + dur + 0.4); }
  };
  V.impact = function (T, v) {
    const ctx = this.ctx, P = this.P;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, T); o.frequency.exponentialRampToValueAtTime(34, T + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v * 0.85, T + 0.004); g.gain.setTargetAtTime(0, T + 0.02, 0.55);
    o.connect(g); g.connect(this.drum); o.start(T); o.stop(T + 3.5);
    this.kick(T, v);
    // la ruptura: chapa grave abierta + pistón + cadena que barre la sala
    this.metal(T, v * 0.9, 0, { kit: 'chapa', f0: P.metalBase * 0.42, decay: 1.4, gain: 1.4, pan: 0 });
    this.metal(T + 0.003, v * 0.8, 1, { kit: 'piston', f0: P.metalBase * 0.8, gain: 1.2, pan: 0 });
    this.metal(T + 0.05, v * 0.6, 2, { kit: 'cadena', f0: P.metalBase * 0.6, gain: 1.1, sweep: 1.0 });
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
