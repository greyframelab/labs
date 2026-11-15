/* VØID_LOOM · OJO — sonido (v3). Referencia principal: Lanark Artefax.
   Dinámica extrema y cinemática: un groove a medio tiempo (84 BPM) contenido, sobre el que caen golpes esculpidos;
   silencios con peso, transitorios en alta definición, swells casi orquestales hechos de materia digital.
   · Dron en Re de tres capas: sub con batido (Re1 + La1), parciales con formante que barre y wow lento, quintas al fondo.
   · Bombo diseñado (cuerpo, click, cola) + bajo con armónicos 2–9 (se oye en el móvil) + hats 909 bajos en mezcla.
   · Cada modo tiene su groove; la energía elige variantes escritas (no azar); el azar solo toca velocidad y microtiming.
   · Cada persona añade una voz de metal físico (Karplus) en polimetría 5 · 7 · 11 contra 16.
   · Sacádico → tick FM cuantizado a 1/32, panoramizado donde mira.
   · CONTACTO → subida continua (filtro que se cierra + flanger) → impacto → groove a medio tiempo mientras dura; al soltar, el flanger disuelve.
   Sin ruido: senos, FM, ondas periódicas y cuerdas físicas. Todo bajo ~1,5 kHz salvo los hats.
   OJO.sound.render(seg, guion) renderiza offline la misma máquina para medirla. */
(function (root) {
  'use strict';
  const OJO = root.OJO || (root.OJO = {});
  const BPM = 84, SD = 60 / BPM / 4, BAR = SD * 16;
  const D1 = 36.71, A1 = 55, D2 = 73.42, EB2 = 77.78, F2 = 87.31, A2 = 110, D3 = 146.83, A3 = 220;

  const euclid = (k, n, rot = 0) => { const r = []; for (let i = 0; i < n; i++) r.push(((i + rot) * k) % n < k ? 1 : 0); return r; };
  const at = (arr) => { const r = new Array(16).fill(0); arr.forEach((i) => (r[i] = 1)); return r; };

  // grooves (medio tiempo): k = bombo, h = golpe esculpido (el contratiempo, sin caja), g = fantasmas,
  // b = bajo [paso, nota, duración en pasos], p = placa de metal grave
  const GROOVES = {
    pulso:     { k: at([0, 10]), h: at([8]), g: at([6, 15]), b: [[0, D2, 6], [10, F2, 4]], p: [] },
    quebrado:  { k: at([0, 7, 10]), h: at([4, 12]), g: at([3, 15]), b: [[0, D2, 3], [7, EB2, 2], [10, D2, 4]], p: [] },
    arrastrado:{ k: at([0]), h: at([8]), g: at([11, 14]), b: [[0, D2, 8]], p: [12] },
    siete:     { k: at([0, 3, 6, 11]), h: at([8]), g: at([14]), b: [[0, D2, 2], [6, F2, 2], [11, EB2, 3]], p: [] },
    contacto:  { k: at([0]), h: at([8]), g: at([11]), b: [[0, D2, 15]], p: [4, 12] },
    buscando:  { k: at([0]), h: [], g: [], b: [], p: [] },
  };
  const MODE_GROOVE = { profundidad: 'arrastrado', bordes: 'quebrado', flujo: 'siete', codigo: 'quebrado', atencion: 'arrastrado',
    neuronas: 'pulso', memoria: 'arrastrado', malla: 'pulso', objetos: 'quebrado', entrada: 'pulso' };
  const MODE_HAT = { profundidad: [3, 1], bordes: [5, 2], flujo: [7, 1], codigo: [9, 3], atencion: [3, 2], neuronas: [5, 0], memoria: [2, 1], malla: [4, 2], objetos: [7, 3], entrada: [6, 0] };

  // ---------------------------------------------------------------- motor (sirve para tiempo real y para render offline)
  function Machine(ac) {
    const now = () => ac.currentTime;
    const G = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
    const F = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const shaper = (k) => { const w = ac.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } w.curve = c; return w; };
    const wave = (n, fn) => { const re = new Float32Array(n + 1), im = new Float32Array(n + 1); for (let k = 1; k <= n; k++) im[k] = fn(k); return ac.createPeriodicWave(re, im); };

    // ---- master: HP 24 Hz → pegamento → limitador
    const out = G(0.6);
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -1.2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    const glue = ac.createDynamicsCompressor(); glue.threshold.value = -16; glue.knee.value = 10; glue.ratio.value = 1.6; glue.attack.value = 0.012; glue.release.value = 0.18;
    const hp = F('highpass', 24, 0.6);
    const silG = G(1);
    hp.connect(silG).connect(glue).connect(lim).connect(out).connect(ac.destination);

    // ---- sala oscura y corta (Autechre: poca)
    const verb = ac.createConvolver();
    { const L = Math.floor(ac.sampleRate * 1.6), pre = Math.floor(ac.sampleRate * 0.012), b = ac.createBuffer(2, L, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; let s = 1234 + ch * 77;
        for (let i = pre; i < L; i++) { s = (s * 16807) % 2147483647; const r = s / 2147483647 * 2 - 1; lp += (r - lp) * 0.2; d[i] = lp * Math.exp(-(i - pre) / (ac.sampleRate * 0.22)); } }
      verb.buffer = b; }
    const verbHP = F('highpass', 320); const verbOut = G(0.35);
    verbHP.connect(verb).connect(verbOut).connect(hp);
    const send = (node, amt) => { const g = G(amt); node.connect(g).connect(verbHP); return g; };

    // ---- flanger (gesto: subida al CONTACTO y disolución), con el grave fuera
    const flIn = F('highpass', 220), flDel = ac.createDelay(0.03), flFb = G(0.45), flWet = G(0);
    flDel.delayTime.value = 0.004;
    const flLfo = ac.createOscillator(), flDepth = G(0.0032); flLfo.frequency.value = 0.11; flLfo.connect(flDepth).connect(flDel.delayTime); flLfo.start();
    flIn.connect(flDel); flDel.connect(flFb).connect(flDel); flDel.connect(flWet).connect(hp);

    // ---- batería: filtro de bus (se cierra en la subida) + saturación paralela filtrada (para altavoz de móvil)
    const drums = G(0.58), drumsLP = F('lowpass', 16000, 0.5), drumsOut = G(1), gate = G(1);
    drums.connect(gate).connect(drumsLP).connect(drumsOut).connect(hp);
    const satHP = F('highpass', 180), sat = shaper(3.2), satG = G(0.55);
    drumsLP.connect(satHP).connect(sat).connect(satG).connect(hp);
    drumsLP.connect(flIn);
    const bassBus = G(1); bassBus.connect(drumsLP);
    const tex = G(1.6); tex.connect(hp); send(tex, 0.05);

    // ---- dron (tres capas) con ducking del bombo
    const duck = G(1), droneLP = F('lowpass', 900, 0.4), droneG = G(0);
    droneG.connect(droneLP).connect(duck).connect(hp); send(duck, 0.06);
    const sub1 = ac.createOscillator(), sub2 = ac.createOscillator(), subG = G(0.34);
    sub1.frequency.value = D1; sub2.frequency.value = A1; sub2.detune.value = 3;
    sub1.connect(subG); sub2.connect(G(0.6)).connect(subG); subG.connect(droneG);
    const sawW = wave(28, (k) => 1 / k);
    const p1 = ac.createOscillator(), p2 = ac.createOscillator(); p1.setPeriodicWave(sawW); p2.setPeriodicWave(sawW);
    p1.frequency.value = D2; p2.frequency.value = D2; p2.detune.value = 7;
    const form = F('bandpass', 420, 3.2), formB = F('bandpass', 420, 3.2), formG = G(0.55);
    const panL = ac.createStereoPanner(), panR = ac.createStereoPanner(); panL.pan.value = -0.55; panR.pan.value = 0.55;
    p1.connect(form).connect(panL).connect(formG); p2.connect(formB).connect(panR).connect(formG); formG.connect(droneG);
    const fLfo = ac.createOscillator(), fDepth = G(260), fLfo2 = ac.createOscillator(), fDepth2 = G(240);
    fLfo.frequency.value = 0.031; fLfo2.frequency.value = 0.043;
    fLfo.connect(fDepth).connect(form.frequency); fLfo2.connect(fDepth2).connect(formB.frequency); fLfo.start(); fLfo2.start();
    const wow = ac.createOscillator(), wowD = G(6); wow.frequency.value = 0.27; wow.connect(wowD); wowD.connect(p1.detune); wowD.connect(p2.detune); wow.start();
    const atm = G(0.0001);
    [D3, A3, D3 * 2].forEach((f, i) => { const o = ac.createOscillator(), pn = ac.createStereoPanner(); pn.pan.value = [-0.7, 0.7, 0][i]; o.frequency.value = f; o.detune.value = (i - 1) * 4; o.connect(G(i === 2 ? 0.3 : 1)).connect(pn).connect(atm); o.start(); });
    atm.connect(F('lowpass', 1200)).connect(hp); send(atm, 0.4);
    [sub1, sub2, p1, p2].forEach((o) => o.start());

    // ---- metal físico precalculado (Karplus-Strong)
    function karplus(freq, dur, decay, bright, seed) {
      const sr = ac.sampleRate, L = Math.max(4, Math.round(sr / freq)), n = Math.floor(dur * sr), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0);
      let s = seed; const buf = new Float32Array(L);
      for (let i = 0; i < L; i++) { s = (s * 16807) % 2147483647; buf[i] = s / 2147483647 * 2 - 1; }
      let lp = 0; for (let i = 0; i < L; i++) { lp += (buf[i] - lp) * (0.15 + bright * 0.7); buf[i] = lp; }
      let mx = 0;
      for (let i = 0; i < n; i++) { const j = i % L, nj = (j + 1) % L; const v = buf[j]; d[i] = v; buf[j] = decay * 0.5 * (v + buf[nj]); mx = Math.max(mx, Math.abs(v)); }
      for (let i = 0; i < n; i++) d[i] /= mx || 1;
      const fi = Math.floor(0.003 * sr); for (let i = 0; i < fi; i++) d[i] *= i / fi;
      const f = Math.floor(0.03 * sr); for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f;
      return b;
    }
    const METAL = [98, 116.5, 131, 147, 174.6, 196].map((f, i) => karplus(f * (1 + (i % 2) * 0.013), 2.2, 0.9965, 0.28, 99 + i * 31));
    const PLATE = karplus(65.4, 3.2, 0.998, 0.18, 7);

    // ---- voces
    function env(g, t, a, peak, tau) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, tau); }
    function kick(t, vel = 1, tail = 0.24) {
      t = Math.max(t, now());
      const o = ac.createOscillator(), sh = shaper(1.8), g = G(0);
      o.frequency.setValueAtTime(156, t); o.frequency.setTargetAtTime(44, t, 0.03);
      env(g, t, 0.0008, vel, tail);
      o.connect(sh).connect(g).connect(drums); o.start(t); o.stop(t + tail * 6);
      const c = ac.createOscillator(), cg = G(0); c.frequency.value = 1700; env(cg, t, 0.0004, vel * 0.22, 0.0025);
      c.connect(cg).connect(drums); c.start(t); c.stop(t + 0.03);
      duck.gain.setValueAtTime(1 - 0.45 * vel, t); duck.gain.setTargetAtTime(1, t + 0.004, 0.12);
    }
    const bassW = wave(9, (k) => 1 / k);
    function bass(t, f, dur, vel = 1) {
      t = Math.max(t, now());
      const o = ac.createOscillator(), lp = F('lowpass', 140, 3), sh = shaper(1.6), g = G(0);
      o.setPeriodicWave(bassW); o.frequency.value = f;
      lp.frequency.setValueAtTime(140, t); lp.frequency.linearRampToValueAtTime(900 + vel * 500, t + 0.006); lp.frequency.setTargetAtTime(220, t + 0.006, 0.09);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.004);
      g.gain.setTargetAtTime(0.25 * vel, t + 0.004, 0.08); g.gain.setTargetAtTime(0, t + dur, 0.03);
      o.connect(lp).connect(sh).connect(g).connect(bassBus); o.start(t); o.stop(t + dur + 0.25);
    }
    const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
    function hat(t, vel = 1, open = false, pitch = 1, pan = 0) {
      t = Math.max(t, now());
      const sum = G(0.16), hpf = F('highpass', 6800, 0.7), lpf = F('lowpass', 10500, 0.7), g = G(0), pn = ac.createStereoPanner();
      pn.pan.value = pan;
      HAT_F.forEach((f) => { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f * 1.95 * pitch; o.connect(sum); o.start(t); o.stop(t + (open ? 0.4 : 0.08)); });
      env(g, t, 0.0006, 0.08 * vel, open ? 0.07 : 0.013);
      sum.connect(hpf).connect(lpf).connect(g).connect(pn).connect(drums);
    }
    function tick(t, f, vel, pan) {
      t = Math.max(t, now());
      const c = ac.createOscillator(), m = ac.createOscillator(), mg = G(f * 2.4), g = G(0), lp = F('lowpass', 1400), p = ac.createStereoPanner();
      c.frequency.value = f; m.frequency.value = f * 2.76; mg.gain.setValueAtTime(f * 2.4, t); mg.gain.setTargetAtTime(f * 0.1, t, 0.012);
      m.connect(mg).connect(c.frequency); p.pan.value = Math.max(-1, Math.min(1, pan));
      env(g, t, 0.001, vel, 0.016);
      c.connect(g).connect(lp).connect(p).connect(tex); c.start(t); m.start(t); c.stop(t + 0.15); m.stop(t + 0.15);
    }
    function metal(t, i, vel, pan, rate = 1) {
      t = Math.max(t, now());
      const s = ac.createBufferSource(), g = G(vel), p = ac.createStereoPanner(), lp = F('lowpass', 1500);
      s.buffer = METAL[i % METAL.length]; s.playbackRate.value = rate; p.pan.value = pan;
      g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, t + 0.08, 0.2);
      s.connect(lp).connect(g).connect(p).connect(tex); s.start(t); s.stop(t + 1.2);
    }
    function plate(t, vel, rate = 1) {
      t = Math.max(t, now());
      const s = ac.createBufferSource(), g = G(vel), lp = F('lowpass', 1400);
      s.buffer = PLATE; s.playbackRate.value = rate; s.connect(lp).connect(g); g.connect(drums); g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, t + 0.15, 0.25); s.start(t); s.stop(t + 1.4);
    }

    // golpe esculpido: transitorio FM (alta definición, sin ruido) + caída de sub + placa con cola oscura y ancha
    const hits = G(1); hits.connect(hp); send(hits, 0.14);
    function golpe(t, vel = 1, big = false) {
      t = Math.max(t, now());
      const c = ac.createOscillator(), m = ac.createOscillator(), mg = G(0), g = G(0), lp = F('lowpass', big ? 2600 : 2100, 0.7);
      c.frequency.value = big ? 180 : 240; m.frequency.value = (big ? 180 : 240) * 1.41;
      mg.gain.setValueAtTime(900, t); mg.gain.setTargetAtTime(20, t, 0.006);
      m.connect(mg).connect(c.frequency);
      env(g, t, 0.0005, 0.75 * vel, big ? 0.05 : 0.022);
      c.connect(g).connect(lp).connect(hits); c.start(t); m.start(t); c.stop(t + 0.5); m.stop(t + 0.5);
      const s1 = ac.createOscillator(), sg = G(0); s1.frequency.setValueAtTime(big ? 92 : 120, t); s1.frequency.setTargetAtTime(big ? 34 : 48, t, big ? 0.09 : 0.05);
      env(sg, t, 0.001, 0.95 * vel, big ? 0.45 : 0.16); s1.connect(sg).connect(hits); s1.start(t); s1.stop(t + (big ? 3 : 1));
      // dos placas a los lados: el golpe se abre en estéreo
      [-0.7, 0.7].forEach((pn, i) => { const sbs = ac.createBufferSource(), pg = G(vel * (big ? 0.42 : 0.2)), pp = ac.createStereoPanner(), plp = F('lowpass', 1100);
        sbs.buffer = PLATE; sbs.playbackRate.value = (big ? 0.55 : 0.8) * (1 + i * 0.021); pp.pan.value = pn; pg.gain.setValueAtTime(vel * (big ? 0.42 : 0.2), t); pg.gain.setTargetAtTime(0, t + (big ? 0.35 : 0.1), big ? 0.4 : 0.18); sbs.connect(plp).connect(pg).connect(pp).connect(hits); sbs.start(t); sbs.stop(t + (big ? 2.2 : 1)); });
      duck.gain.setValueAtTime(1 - 0.55 * vel, t); duck.gain.setTargetAtTime(1, t + 0.004, big ? 0.4 : 0.15);
    }
    // swell casi orquestal: clúster grave en Re menor de sierras detunadas que se abre y crece
    const swW = wave(18, (k) => 1 / k);
    function swell(t, dur, peak = 0.07) {
      t = Math.max(t, now());
      const bus = G(0), lp = F('lowpass', 180, 0.9);
      [D2, F2, A2, D3, A2 * 1.003, F2 * 2].forEach((f, i) => { const o = ac.createOscillator(), pn = ac.createStereoPanner();
        o.setPeriodicWave(swW); o.frequency.value = f; o.detune.value = (i % 3 - 1) * 9; pn.pan.value = (i / 5 - 0.5) * 1.4;
        o.connect(pn).connect(bus); o.start(t); o.stop(t + dur + 0.6); });
      bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(peak * 0.15, t + dur * 0.3); bus.gain.exponentialRampToValueAtTime(peak, t + dur);
      bus.gain.setTargetAtTime(0, t + dur, 0.06);
      lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1400, t + dur);
      bus.connect(lp).connect(hp); send(lp, 0.08);
    }
    // puerta a 1/64 escrita (micro-edición): corta la batería en un patrón fijo
    function gate64(t, len, pattern) {
      const st = SD / 4;
      for (let i = 0; i * st < len; i++) { const on = pattern[i % pattern.length]; gate.gain.setTargetAtTime(on ? 1 : 0, t + i * st, 0.0012); }
      gate.gain.setTargetAtTime(1, t + len, 0.0012);
    }

    // ---- estado y secuenciador
    const st = { energy: 0, subs: 0, contact: 0, mode: 'profundidad' };
    let step = 0, nextT = 0, grooveName = 'arrastrado', contactPhase = 0, impactAt = -1, seed = 1, building1 = null, startT = 0;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const hum = (sd = 0.003) => (rnd() + rnd() + rnd() - 1.5) * sd;
    const tier = () => (st.energy < 0.25 ? 0 : st.energy < 0.6 ? 1 : 2);

    function scheduleStep(t) {
      const s16 = step % 16, bar = Math.floor(step / 16);
      if (s16 === 0) {
        // los cambios de groove caen en el compás
        if (impactAt > 0 && t >= impactAt - 0.001) grooveName = 'contacto';
        else if (contactPhase === 0) grooveName = st.subs ? MODE_GROOVE[st.mode] || 'pulso' : 'buscando';
      }
      const gr = GROOVES[grooveName];
      const tr = tier(), inContact = grooveName === 'contacto';
      // bombo
      if (gr.k[s16]) kick(t + hum(0.0015), (s16 === 0 ? 1 : 0.86) * (0.92 + rnd() * 0.08), inContact ? 0.34 : 0.24);
      if (gr.g[s16] && tr >= 1) kick(t + hum(0.002), 0.32 + rnd() * 0.1, 0.12);
      // golpe esculpido en el contratiempo; el de final de frase, más grande
      if (gr.h && gr.h[s16]) golpe(t + hum(0.001), (0.75 + rnd() * 0.15) * (inContact ? 1.1 : 1), inContact || (bar % 4 === 3 && s16 === 8));
      // micro-edición escrita: último tiempo de cada 4.º compás con puerta a 1/64
      if (s16 === 12 && bar % 4 === 3 && tr >= 1 && !inContact) gate64(t, SD * 4, tr === 2 ? [1, 0, 1, 1, 0, 0, 1, 0] : [1, 1, 0, 1, 0, 1, 1, 0]);
      // swell que prepara cada frase de 8 compases
      if (s16 === 0 && bar % 8 === 6 && st.subs && !inContact) swell(t, BAR * 2 - SD, 0.05 + st.energy * 0.04);
      // bajo
      if (st.subs || inContact) gr.b.forEach(([p, f, d]) => { if (p === s16) bass(t, f, d * SD, 0.85 + rnd() * 0.15); });
      // placa grave en contratiempo
      if (gr.p.includes(s16) && (tr >= 1 || inContact)) plate(t + hum(), inContact ? 0.32 : 0.16, inContact ? 0.75 : 1);
      // hats: rejilla euclidiana que rota cada 4 compases; densidad por energía (variantes escritas)
      if (!inContact) {
        const [hk, rot] = MODE_HAT[st.mode] || [7, 0];
        const k = Math.max(2, Math.min(13, hk + (tr - 1) * 2 + (st.subs ? 0 : -3)));
        const H = euclid(k, 16, rot + (bar >> 2) % 4);
        const sw = s16 % 2 ? SD * 0.12 : 0;
        if (H[s16]) hat(t + sw + hum(0.002), (s16 % 4 === 2 ? 1 : 0.6) * (0.7 + rnd() * 0.3), s16 % 8 === 6 && tr >= 1, 1, s16 % 2 ? 0.35 : -0.2);
        // ratchet escrito: final de cada 4.º compás (1/32 con pitch que sube y crescendo)
        if (s16 === 15 && bar % 4 === 3 && tr >= 1) for (let r = 0; r < 4; r++) hat(t + r * SD / 4, 0.4 + r * 0.18, false, 1 + r * 0.06);
        if (s16 === 14 && bar % 8 === 7 && tr === 2) for (let r = 0; r < 6; r++) hat(t + r * SD / 3, 0.3 + r * 0.12, false, 1.1 - r * 0.03);
      }
      // una voz de metal por persona, en polimetría 5 · 7 · 11 contra 16
      [5, 7, 11].slice(0, Math.min(3, st.subs)).forEach((L, n) => {
        if (step % L === 0) metal(t + hum(), (n * 2 + Math.floor(step / L)) % 6, (0.1 + st.energy * 0.1) * (inContact ? 0.6 : 1), [-0.55, 0.55, 0][n], n === 2 ? 0.5 : 1);
      });
      step++;
    }

    function setDrone(t) {
      const c = st.contact;
      droneG.gain.setTargetAtTime(0.13 + c * 0.08 + (st.subs ? 0 : 0.05), t, 0.6);
      formG.gain.setTargetAtTime(0.75 + st.energy * 0.4 + c * 0.3, t, 0.5);
      form.frequency.setTargetAtTime(380 + st.energy * 420 + c * 600, t, 0.8);
      formB.frequency.setTargetAtTime(460 + st.energy * 380 + c * 520, t, 0.9);
      p2.detune.setTargetAtTime(5 + st.energy * 16, t, 0.9);
      droneLP.frequency.setTargetAtTime(700 + c * 900 + st.energy * 300, t, 0.6);
      atm.gain.setTargetAtTime(0.022 + c * 0.03 + (st.subs ? 0 : 0.012), t, 1.2);
    }

    function contactStart(t) {
      if (contactPhase !== 0) return;
      // subida continua hasta el siguiente compás (mín. 1,4 s): filtro que se cierra + flanger que crece
      impactAt = startT + Math.ceil((t + 1.4 - startT) / BAR) * BAR;
      drumsLP.frequency.cancelScheduledValues(t); drumsLP.frequency.setValueAtTime(drumsLP.frequency.value, t);
      drumsLP.frequency.exponentialRampToValueAtTime(380, impactAt - 0.02);
      drumsLP.frequency.setValueAtTime(380, impactAt - 0.02); drumsLP.frequency.exponentialRampToValueAtTime(16000, impactAt + 0.06);
      flWet.gain.cancelScheduledValues(t); flWet.gain.setValueAtTime(flWet.gain.value, t);
      flWet.gain.linearRampToValueAtTime(0.35, impactAt - 0.5); flWet.gain.setTargetAtTime(0, impactAt - 0.45, 0.01);
      flLfo.frequency.setValueAtTime(0.11, t); flLfo.frequency.linearRampToValueAtTime(0.6, impactAt);
      // la subida: clúster que crece; luego 0,45 s de silencio total (la máquina contiene el aliento) y el impacto
      swell(t, impactAt - 0.45 - t, 0.12);
      const sil = impactAt - 0.45;
      silG.gain.cancelScheduledValues(t); silG.gain.setValueAtTime(1, t);
      silG.gain.setTargetAtTime(0, sil, 0.006); silG.gain.setValueAtTime(0, impactAt - 0.004); silG.gain.linearRampToValueAtTime(1, impactAt);
      golpe(impactAt, 1.25, true); plate(impactAt, 0.5, 0.6); metal(impactAt, 0, 0.3, 0, 0.5);
      contactPhase = 1;
      building1 = [t, impactAt];
    }
    function contactEnd(t) {
      if (contactPhase === 0) return;
      contactPhase = 0; impactAt = -1; building1 = null;
      flWet.gain.cancelScheduledValues(t); flWet.gain.setValueAtTime(flWet.gain.value, t);
      flWet.gain.linearRampToValueAtTime(0.25, t + 0.6); flWet.gain.linearRampToValueAtTime(0, t + 1.6);
      flLfo.frequency.setValueAtTime(0.6, t); flLfo.frequency.linearRampToValueAtTime(0.08, t + 3);
      plate(t, 0.22, 0.8);
    }

    return {
      out, BAR, SD,
      set(e, n, c, mode) { st.energy = e || 0; st.subs = Math.min(3, n || 0); st.contact = c || 0; if (mode) st.mode = mode; },
      start(t) { startT = t; nextT = t; step = 0; },
      resync(t) { const k = Math.ceil((t - startT) / SD); nextT = startT + k * SD; step = k; },
      run(t) { // programa los pasos que caen antes de t
        while (nextT < t) {
          const inBuild = building1 && nextT >= building1[0] && nextT < building1[1];
          if (inBuild) { // durante la subida: solo bombo en negras y hats que se aceleran
            const s16 = step % 16; if (s16 % 4 === 0) kick(nextT, 0.8, 0.18);
            hat(nextT, 0.4 + 0.6 * (nextT - building1[0]) / (building1[1] - building1[0]), false, 1 + 0.3 * (nextT - building1[0]) / (building1[1] - building1[0]));
            step++;
          } else scheduleStep(nextT);
          nextT += SD;
        }
        setDrone(Math.max(now(), nextT - SD));
      },
      get nextT() { return nextT; }, set nextT(v) { nextT = v; },
      event(ev, t) {
        if (ev.type === 'sacada') { const q = Math.ceil(t / (SD / 2)) * (SD / 2); tick(q, 0.07 + st.energy * 0.05, 330 + (ev.y != null ? (1 - ev.y) * 400 : 150), ((ev.x || 0.5) - 0.5) * 1.6); }
        else if (ev.type === 'entra') { const q = Math.ceil(t / SD) * SD; metal(q, 0, 0.28, 0, 0.5); plate(q, 0.25, 1.2); }
        else if (ev.type === 'sale') { metal(t, 3, 0.16, 0, 0.5); }
        else if (ev.type === 'contacto') contactStart(t);
        else if (ev.type === 'fin-contacto') contactEnd(t);
        else if (ev.type === 'modo') { const q = Math.ceil(t / SD) * SD; for (let r = 0; r < 6; r++) hat(q + r * SD / 4, 0.25 + r * 0.12, false, 0.9 + r * 0.05); }
      },
    };
  }

  // ---------------------------------------------------------------- tiempo real
  OJO.sound = function () {
    let ac = null, mc = null, timer = null, vol = 0.8;
    const st = { e: 0, n: 0, c: 0, mode: 'profundidad' };
    return {
      get on() { return !!ac && ac.state === 'running'; },
      async start() {
        if (!ac) {
          ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
          mc = Machine(ac); mc.out.gain.value = vol; mc.start(ac.currentTime + 0.1);
        }
        await ac.resume();
        mc.out.gain.setTargetAtTime(vol, ac.currentTime, 0.2);
        if (mc.nextT < ac.currentTime) mc.resync(ac.currentTime + 0.05);
        if (!timer) timer = setInterval(() => { mc.set(st.e, st.n, st.c, st.mode); mc.run(ac.currentTime + 0.12); }, 25);
      },
      stop() {
        if (!ac) return;
        mc.out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
        clearInterval(timer); timer = null;
        setTimeout(() => ac && ac.state === 'running' && !timer && ac.suspend(), 500);
      },
      setVolume(v) { vol = v; if (mc) mc.out.gain.setTargetAtTime(v, ac.currentTime, 0.05); },
      update(e, n, c, mode) { st.e = e || 0; st.n = n || 0; st.c = c || 0; if (mode) st.mode = mode; },
      event(ev) { if (!ac || ac.state !== 'running') return; mc.event(ev, ac.currentTime + 0.02); },
    };
  };

  // ---------------------------------------------------------------- render offline (para medir y validar)
  // guion: [{ t, set: { e, n, c, mode } } | { t, ev: { type, … } }, …]
  OJO.sound.render = async function (secs, guion, sr = 48000) {
    const ac = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
    const mc = Machine(ac); mc.start(0);
    const st = { e: 0, n: 0, c: 0, mode: 'profundidad' };
    const items = guion.slice().sort((a, b) => a.t - b.t);
    let i = 0;
    for (let t = 0; t < secs; t += 0.025) {
      while (i < items.length && items[i].t <= t) { const it = items[i++]; if (it.set) Object.assign(st, it.set); if (it.ev) mc.event(it.ev, it.t); }
      mc.set(st.e, st.n, st.c, st.mode);
      mc.run(t + 0.12);
    }
    return ac.startRendering();
  };
})(window);
