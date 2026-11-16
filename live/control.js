/* VØID_LOOM LIVE · consola.
   Biblioteca automática (todas las piezas VØID_LOOM publicadas en Labs), dos decks, audio en Web Audio
   sincronizado con la salida por un reloj compartido, cuantización a golpes o actos, efectos y MIDI. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const ch = new BroadcastChannel(VLL.CHANNEL);
  const LEAD = 45;                         // ms de margen para programar audio e imagen a la vez
  const X0 = 0.5;                          // fundido de vuelta al repetir la pieza entera
  const store = { get(k, d) { try { const v = localStorage.getItem('vll:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
                  set(k, v) { try { localStorage.setItem('vll:' + k, JSON.stringify(v)); } catch (e) {} } };
  const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1600); };
  const tc = (x) => { x = Math.max(0, x); const s = Math.floor(x), f = Math.floor((x - s) * 60); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + ':' + String(f).padStart(2, '0'); };

  // ================================================================== estado global
  const LIB = [];
  const MIX = { xf: 0, mode: 'fundido', onAir: 'A', quality: store.get('calidadAuto', 0) };
  const FX = { trail: 0, hits: 0, split: 0, invert: 0, black: 0, bright: 1, glitch: 0, punch: 0, lens: 0, mosaic: 0, tint: 0, scan: 0, mirror: 0, strobe: 0, tintC: '#ffffff',
    pBloom: 1, pFlash: 1, pScan: 0.2, cMix: 0, view: 0, viewOp: 0.85, viewMode: 'full' };
  const AFX = { filter: 0, echo: 0, echoT: 0.375, room: 0.12, master: 0.9, av: store.get('av', 0) };
  let quant = store.get('quant', 'golpe');
  let focus = 'A';
  let ctx = null, M = null;               // audio
  let outWin = null, outOK = false, lastOutMsg = 0;

  // ================================================================== biblioteca
  async function discover(log) {
    const md = await fetch('../README.md', { cache: 'no-cache' }).then((r) => r.text());
    const rows = [...md.matchAll(/\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*Motion/gi)];
    const out = [];
    await Promise.all(rows.map(async ([, n, title, dir]) => {
      dir = dir.replace(/\/?$/, '/');
      try {
        const html = await fetch('../' + dir + 'index.html', { cache: 'no-cache' }).then((r) => r.text());
        if (!/VØID_LOOM/.test(html) || !/MotionTimeline\.mount/.test(html)) return;
        const audio = (html.match(/audio:\s*'([^']+)'/) || [])[1];
        if (!audio) return;
        let code = html;
        for (const [, f] of html.matchAll(/<script src="([^"/]+-score\.js)"/g)) { try { code += await fetch('../' + dir + f, { cache: 'no-cache' }).then((r) => r.text()); } catch (e) {} }
        const bpm = +((code.match(/const\s+bpm\s*=\s*(\d+(?:\.\d+)?)/i) || code.match(/(\d{2,3})\s?bpm/i) || [])[1]) || null;
        out.push({ id: dir.replace(/\/$/, ''), n: +n, title: title.toUpperCase(), dir: '../' + dir, src: '../' + dir + 'index.html', bpm,
          audio: '../' + dir + audio, thumb: '../' + dir + 'thumb.jpg', accent: (html.match(/accent:\s*'(#[0-9a-f]{3,8})'/i) || [])[1] || '#f2f0ea' });
      } catch (e) {}
    }));
    out.sort((a, b) => a.n - b.n);
    log('BIBLIOTECA · ' + out.length + ' PIEZAS');
    return out;
  }
  // lee duración y actos de cada pieza cargándola un momento sin dibujarla
  const probeWaiters = new Map();
  window.VL_LIVE = { register(win, o) { const f = probeWaiters.get(win); if (f) f(o); } };
  function probe(item) {
    return new Promise((res) => {
      const fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;left:-4000px;top:0;width:640px;height:400px;border:0;opacity:0;pointer-events:none';
      fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
      const done = (o) => { clearTimeout(to); probeWaiters.delete(fr.contentWindow); fr.remove(); res(o); };
      const to = setTimeout(() => done(null), 20000);
      fr.onload = () => {};
      document.body.appendChild(fr);
      fr.src = item.src + '?live';
      probeWaiters.set(fr.contentWindow, (o) => done({ duration: o.duration, acts: o.acts.map(([t, n]) => [+t, String(n)]), accent: o.accent,
        live: o.live ? JSON.parse(JSON.stringify(o.live)) : null }));
    });
  }
  // golpes: flujo de energía de alta frecuencia con umbral adaptativo
  function onsets(buf) {
    const sr = buf.sampleRate, n = buf.length, hop = 256, win = 512;
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const E = [];
    let prev = 0;
    for (let i = 0; i + win < n; i += hop) {
      let e = 0, eh = 0;
      for (let j = i; j < i + win; j += 2) { const s = (L[j] + R[j]) * 0.5, d = s - prev; prev = s; e += s * s; eh += d * d; }
      E.push(Math.log(1e-6 + eh * 4 + e));
    }
    const F = E.map((v, i) => Math.max(0, v - (i ? E[i - 1] : v)));
    const hits = [];
    let last = -1;
    for (let i = 2; i < F.length - 2; i++) {
      let s = 0, c = 0; for (let k = Math.max(0, i - 24); k < Math.min(F.length, i + 8); k++) { s += F[k]; c++; }
      const th = (s / c) * 2.2 + 0.35;
      if (F[i] > th && F[i] >= F[i - 1] && F[i] >= F[i + 1]) {
        const t = i * hop / sr;
        if (last < 0 || t - last > 0.07) { hits.push(+t.toFixed(4)); last = t; }
      }
    }
    return hits;
  }

  // ================================================================== audio
  function wallToCtx(w) {
    const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    let base;
    if (ts && ts.performanceTime > 0) base = ts.contextTime + (w - (performance.timeOrigin + ts.performanceTime)) / 1000;
    else base = ctx.currentTime + (w - VLL.now()) / 1000 + (ctx.outputLatency || ctx.baseLatency || 0);
    return base + AFX.av / 1000;
  }
  function makeImpulse(sec) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / n, k = 0.08 + 0.6 * (1 - t); lp += (Math.random() * 2 - 1 - lp) * k; d[i] = lp * Math.pow(1 - t, 2.6) * (i < sr * 0.012 ? i / (sr * 0.012) : 1); }
    }
    return b;
  }
  function buildMaster() {
    const m = {};
    m.in = ctx.createGain();
    m.dk = ctx.createGain(); m.dk.connect(m.in);   // las piezas (A y B) entran por aquí; la entrada externa va directa a m.in
    m.hp = ctx.createBiquadFilter(); m.hp.type = 'highpass'; m.hp.frequency.value = 10;
    m.lp = ctx.createBiquadFilter(); m.lp.type = 'lowpass'; m.lp.frequency.value = 22000;
    m.in.connect(m.hp).connect(m.lp);
    m.lim = ctx.createDynamicsCompressor();
    Object.assign(m.lim, {}); m.lim.threshold.value = -2; m.lim.knee.value = 0; m.lim.ratio.value = 20; m.lim.attack.value = 0.002; m.lim.release.value = 0.12;
    m.lp.connect(m.lim);
    // eco ping-pong con realimentación oscura
    m.eS = ctx.createGain(); m.eS.gain.value = 0;
    m.dl = ctx.createDelay(2); m.dr = ctx.createDelay(2); m.fbk = ctx.createGain(); m.fbk.gain.value = 0.48;
    m.ef = ctx.createBiquadFilter(); m.ef.type = 'lowpass'; m.ef.frequency.value = 2600;
    const mg = ctx.createChannelMerger(2);
    m.lp.connect(m.eS); m.eS.connect(m.dl); m.dl.connect(m.dr); m.dr.connect(m.ef).connect(m.fbk).connect(m.dl);
    m.dl.connect(mg, 0, 0); m.dr.connect(mg, 0, 1); mg.connect(m.lim);
    // sala
    m.rS = ctx.createGain(); m.cv = ctx.createConvolver(); m.cv.buffer = makeImpulse(4.2);
    m.lp.connect(m.rS).connect(m.cv).connect(m.lim);
    m.out = ctx.createGain(); m.lim.connect(m.out); m.out.connect(ctx.destination);
    m.split = ctx.createChannelSplitter(2); m.out.connect(m.split);
    m.fan = ctx.createAnalyser(); m.fan.fftSize = 2048; m.fan.smoothingTimeConstant = 0.6; m.out.connect(m.fan);
    m.aL = ctx.createAnalyser(); m.aR = ctx.createAnalyser(); m.aL.fftSize = m.aR.fftSize = 1024;
    m.split.connect(m.aL, 0); m.split.connect(m.aR, 1);
    return m;
  }
  function applyAFX() {
    if (!ctx) return;
    const t = ctx.currentTime, f = AFX.filter;
    const lpF = f < -0.02 ? 70 * Math.pow(22000 / 70, 1 + f) : 22000;
    const hpF = f > 0.02 ? 20 * Math.pow(400, f) : 10;
    M.lp.frequency.setTargetAtTime(lpF, t, 0.02); M.hp.frequency.setTargetAtTime(hpF, t, 0.02);
    M.lp.Q.setTargetAtTime(f < -0.02 ? 1.4 : 0.7, t, 0.05); M.hp.Q.setTargetAtTime(f > 0.02 ? 1.4 : 0.7, t, 0.05);
    const pa = presAudio();
    M.eS.gain.setTargetAtTime(Math.min(1, AFX.echo + pa.echo) * 0.8, t, 0.08);
    M.dl.delayTime.setTargetAtTime(AFX.echoT, t, 0.08); M.dr.delayTime.setTargetAtTime(AFX.echoT, t, 0.08);
    M.rS.gain.setTargetAtTime(Math.min(1, AFX.room + pa.room) * 0.9, t, 0.08);
    M.out.gain.setTargetAtTime(AFX.master * (pa.mute ? 0.02 : 1), t, pa.mute ? 0.05 : 0.02);
  }
  function buildDeckAudio(d) {
    const a = {};
    a.in = ctx.createGain();
    const bq = (type, f) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Math.SQRT1_2; return b; };
    // aislador de 3 bandas (Linkwitz-Riley de 4º orden): con KILL desaparece la banda entera
    a.gL = ctx.createGain(); a.gM = ctx.createGain(); a.gH = ctx.createGain(); a.sum = ctx.createGain();
    a.in.connect(bq('lowpass', 240)).connect(bq('lowpass', 240)).connect(a.gL).connect(a.sum);
    a.in.connect(bq('highpass', 240)).connect(bq('highpass', 240)).connect(bq('lowpass', 3400)).connect(bq('lowpass', 3400)).connect(a.gM).connect(a.sum);
    a.in.connect(bq('highpass', 3400)).connect(bq('highpass', 3400)).connect(a.gH).connect(a.sum);
    a.vol = ctx.createGain(); a.xf = ctx.createGain();
    a.an = ctx.createAnalyser(); a.an.fftSize = 512;
    a.sum.connect(a.vol).connect(a.xf).connect(M.dk); a.xf.connect(a.an);
    a.voices = []; a.sched = null;
    d.aud = a;
  }
  const eqGain = (v) => (v <= 0.5 ? Math.pow(v / 0.5, 1.6) : 1 + (v - 0.5) * 0.8);
  function applyDeckAudio(d) {
    if (!ctx || !d.aud) return;
    const t = ctx.currentTime, a = d.aud;
    a.gL.gain.setTargetAtTime(d.kill[0] ? 0 : eqGain(d.eq[0]), t, 0.008);
    a.gM.gain.setTargetAtTime(d.kill[1] ? 0 : eqGain(d.eq[1]), t, 0.008);
    a.gH.gain.setTargetAtTime(d.kill[2] ? 0 : eqGain(d.eq[2]), t, 0.008);
    a.vol.gain.setTargetAtTime(d.vol, t, 0.01);
  }
  function applyXfAudio(at) {
    if (!ctx) return;
    const t = at ? Math.max(ctx.currentTime, wallToCtx(at)) : ctx.currentTime;
    const ga = Math.cos(MIX.xf * Math.PI / 2), gb = Math.sin(MIX.xf * Math.PI / 2);
    if (at) { DECK.A.aud.xf.gain.setValueAtTime(ga, t); DECK.B.aud.xf.gain.setValueAtTime(gb, t); }
    else { ['A', 'B'].forEach((k) => DECK[k].aud.xf.gain.cancelScheduledValues(t)); DECK.A.aud.xf.gain.setTargetAtTime(ga, t, 0.012); DECK.B.aud.xf.gain.setTargetAtTime(gb, t, 0.012); }
  }
  const CURVE_IN = new Float32Array(64).map((_, i) => Math.sin(i / 63 * Math.PI / 2));
  const CURVE_OUT = new Float32Array(64).map((_, i) => Math.cos(i / 63 * Math.PI / 2));
  function voice(d, buf, offset, when, rate, fade, eqp, ramp) {
    const a = d.aud, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.setValueAtTime(Math.abs(rate), when);
    if (ramp) src.playbackRate.linearRampToValueAtTime(Math.max(0.0001, Math.abs(ramp.to)), when + ramp.dur);
    src.connect(g).connect(a.in);
    g.gain.setValueAtTime(0, when);
    if (eqp) g.gain.setValueCurveAtTime(CURVE_IN, when, fade); else g.gain.linearRampToValueAtTime(1, when + fade);
    src.start(when, VLL.clamp(offset, 0, buf.duration - 0.001));
    const v = { src, g, end: Infinity };
    src.onended = () => { const i = a.voices.indexOf(v); if (i >= 0) a.voices.splice(i, 1); try { g.disconnect(); } catch (e) {} };
    a.voices.push(v);
    return v;
  }
  function vOut(v, when, fade, eqp) {
    try {
      if (eqp) v.g.gain.setValueCurveAtTime(CURVE_OUT, when, fade);
      else { v.g.gain.cancelAndHoldAtTime(when); v.g.gain.linearRampToValueAtTime(0, when + fade); }
      v.src.stop(when + fade + 0.02); v.end = when + fade;
    } catch (e) { try { v.src.stop(); } catch (_) {} }
  }
  // el audio de un deck sigue el mismo modelo que la imagen (core.js)
  function audioState(s) {
    if (s && s.freeze != null) return Object.assign({}, s, { pos: s.freeze, rate: 1, ramp: null, a: s.freeze, b: s.freeze + 0.26, x: 0.11, once: false, freeze: null });
    return s;
  }
  function play(d) {
    if (!ctx || !d.aud) return;
    const a = d.aud, s = audioState(d.state);
    const w0 = Math.max(s ? s.wall : 0, VLL.now() + LEAD);
    const t0 = wallToCtx(w0);
    a.voices.slice().forEach((v) => { if (v.end > t0) vOut(v, Math.max(ctx.currentTime, t0), 0.012, false); });
    a.sched = null;
    if (!s || !s.piece || !d.buf) return;
    const P = VLL.pos(s, w0);
    if (!P || P.ended) return;
    const steady = !s.ramp;
    const r = steady ? s.rate : null;
    if (steady && Math.abs(r) < 1e-4) return;
    const fwd = steady ? r > 0 : s.rate + (s.ramp.to - s.rate) * 0.01 > 0;
    const buf = fwd ? d.buf : d.rev, dur = d.buf.duration;
    const off = fwd ? P.p : dur - P.p;
    const ramp = s.ramp ? { to: s.ramp.to, dur: Math.max(0.01, s.ramp.dur - (w0 - s.wall) / 1000) } : null;
    const cur = voice(d, buf, off, t0, s.ramp ? s.rate + (s.ramp.to - s.rate) * VLL.clamp((w0 - s.wall) / 1000 / s.ramp.dur, 0, 1) : r, 0.012, false, ramp);
    if (!steady) return;
    if (s.once) { const tEnd = t0 + (s.b - P.p) / r; vOut(cur, tEnd - 0.03, 0.03, false); return; }
    // próximas vueltas del loop
    const x = s.x || 0;
    let wrapW;
    if (fwd) wrapW = w0 + Math.max(0, (s.b - x - P.p) / r) * 1000;
    else wrapW = w0 + Math.max(0, (P.p - s.a) / -r) * 1000;
    a.sched = { s, d, cur, wrapW, fwd, r, x };
  }
  function schedTick() {
    if (!ctx) return;
    const horizon = VLL.now() + 260;
    for (const k in DECK) {
      const d = DECK[k], sc = d.aud && d.aud.sched;
      if (!sc) continue;
      const s0 = sc.s, per = (sc.fwd ? Math.max(0.02, (s0.b - s0.a - sc.x) / sc.r) : Math.max(0.02, (s0.b - s0.a) / -sc.r)) * 1000;
      while (sc.wrapW + per < VLL.now()) sc.wrapW += per;            // vueltas perdidas: se saltan, no se apilan
      while (sc.wrapW < horizon) {
        let t = wallToCtx(sc.wrapW); const s = sc.s, late = Math.max(0, ctx.currentTime + 0.005 - t);
        t += late;                                                    // si llega tarde, entra ya en su sitio, no en el pasado
        if (sc.fwd) {
          const fade = Math.max(0.006, sc.x / sc.r - late);
          const nv = voice(d, d.buf, s.a + late * sc.r, t, sc.r, fade, sc.x > 0.02 && fade > 0.02);
          vOut(sc.cur, t, fade, sc.x > 0.02);
          sc.cur = nv; sc.wrapW += Math.max(0.02, (s.b - s.a - sc.x) / sc.r) * 1000;
        } else {
          const nv = voice(d, d.rev, d.buf.duration - s.b + late * -sc.r, t, -sc.r, 0.006, false);
          vOut(sc.cur, t, 0.006, false);
          sc.cur = nv; sc.wrapW += Math.max(0.02, (s.b - s.a) / -sc.r) * 1000;
        }
      }
    }
  }

  // ================================================================== decks
  const DECK = {};
  function mkDeck(id) {
    const d = { id, item: null, meta: null, buf: null, rev: null, hits: [], state: null, ready: false,
      eq: [0.5, 0.5, 0.5], kill: [0, 0, 0], vol: 1, speed: 1, rev_: false, stopped: false, loop: false,
      slip: null, rampT: null, queueUntil: 0, el: $('#deck' + id) };
    DECK[id] = d;
    d.el.addEventListener('pointerdown', () => setFocus(id), true);
    renderDeckUI(d);
    return d;
  }
  const now = () => VLL.now();
  function curPos(d, w = now()) { if (!d.state) return 0; const P = VLL.pos(d.state, w); return P ? P.p : 0; }
  function end(d) { return VLL.firmaAt(d.meta); }
  function loopX(len) { return Math.min(0.35, len / 3); }
  function commit(d, patch, wall) {
    wall = wall || now() + LEAD;
    const old = d.state;
    let pos = 0;
    if (old) { const P = VLL.pos(old, wall); pos = P ? P.p : 0; }
    d.state = Object.assign({}, old || {}, { wall, pos, ramp: null }, patch);
    sendState(); play(d);
  }
  // momento cuantizado: siguiente golpe o acto del deck en el aire (o del propio deck)
  function qWall(d) {
    const base = now() + LEAD;
    if (quant === 'libre') return base;
    const ref = DECK[MIX.onAir].state && !DECK[MIX.onAir].stopped ? DECK[MIX.onAir] : d;
    const s = ref.state;
    if (!s || !ref.meta || s.freeze != null || s.ramp || s.rate <= 0) return base;
    const p = curPos(ref, base);
    const marks = quant === 'golpe' ? ref.hits : ref.meta.acts.map((a) => a[0]);
    let target = null, extra = 0;
    for (const m of marks) if (m > p + 0.01 && m < s.b) { target = m; break; }
    if (target == null) {
      if (s.once) return base;
      extra = s.b - p; // tras la vuelta
      const start = s.a + (s.x || 0);
      target = quant === 'acto' ? start : (marks.find((m) => m >= start && m < s.b) ?? start);
      return base + (extra + (target - start)) / s.rate * 1000;
    }
    return base + (target - p) / s.rate * 1000;
  }
  function queued(d, wall) { d.queueUntil = wall; }

  // ---------------------------------------------------------------- acciones de deck
  function load(id, item) {
    const d = DECK[id];
    if (!item.meta || !item.buf) { toast(item.title + ' · AÚN CARGANDO'); return; }
    const wall = id === MIX.onAir ? qWall(d) : now() + LEAD;
    d.item = item; d.meta = item.meta; d.buf = item.buf; d.rev = item.rev; d.hits = item.hits;
    d.ready = false; d.loop = false; d.stopped = false; d.slip = null; d.rev_ = false; clearTimeout(d.rampT);
    d.state = null;
    commit(d, { piece: item.id, src: item.src, pos: 0, rate: d.speed, a: 0, b: end(d), x: X0, once: false, freeze: null }, wall);
    queued(d, wall);
    ch.postMessage({ type: 'hits', piece: item.id, hits: item.hits });
    renderDeckUI(d); markLib();
  }
  function jumpAct(d, i) {
    if (!d.meta || i >= d.meta.acts.length) return;
    const [t0, name] = d.meta.acts[i];
    if (/FIRMA/i.test(name)) return firma(d);
    const wall = qWall(d);
    const [a0, b0] = VLL.actRange(d.meta, i);
    const patch = { pos: t0, freeze: null, once: false };
    if (d.loop) Object.assign(patch, { a: a0, b: Math.min(b0, end(d)), x: loopX(Math.min(b0, end(d)) - a0) });
    else Object.assign(patch, { a: 0, b: end(d), x: X0 });
    if (d.stopped) { d.stopped = false; patch.rate = signedRate(d); }
    d.slip = null;
    commit(d, patch, wall); queued(d, wall); flashAct(d, i);
  }
  function toggleLoop(d) {
    if (!d.state) return;
    d.loop = !d.loop;
    if (!d.loop) { commit(d, { a: 0, b: end(d), x: X0 }); return uiFlags(d); }
    const p = curPos(d); let i = VLL.actAt(d.meta, p);
    if (/FIRMA/i.test(d.meta.acts[i][1])) i = Math.max(0, i - 1);
    // zona loopable declarada por la pieza (loop perfecto, sin fundido); si no, el acto con fundido
    const z = ((d.meta.live && d.meta.live.loops) || []).find(([za, zb]) => p >= za && p < zb) ||
              ((d.meta.live && d.meta.live.loops) || []).find(([za, zb]) => za >= VLL.actRange(d.meta, i)[0] && zb <= VLL.actRange(d.meta, i)[1]);
    if (z) { const pos = VLL.clamp(p, z[0], z[1] - 0.02); commit(d, { a: z[0], b: z[1], x: 0.004, pos, once: false }); return uiFlags(d); }
    let [a0, b0] = VLL.actRange(d.meta, i); b0 = Math.min(b0, end(d));
    const pos = VLL.clamp(p, a0, b0 - 0.05);
    commit(d, { a: a0, b: b0, x: loopX(b0 - a0), pos, once: false });
    uiFlags(d);
  }
  function resizeLoop(d, k) {
    if (!d.state || !d.loop) return;
    const s = d.state, len = VLL.clamp((s.b - s.a) * k, 0.12, end(d) - s.a);
    const p = curPos(d);
    commit(d, { b: s.a + len, x: loopX(len), pos: p >= s.a + len ? s.a + ((p - s.a) % len) : p });
  }
  function signedRate(d) { return d.speed * (d.rev_ ? -1 : 1); }
  function stutter(d, on) {
    if (!d.state || d.stopped) return;
    if (on) {
      if (d.slip) return;
      d.slip = d.state;
      const p = curPos(d), len = 0.115;
      commit(d, { a: p, b: p + len, x: 0.006, pos: p, once: false, freeze: null, rate: Math.abs(d.state.rate) || 1 });
      FX.glitch = 1; sendState();
    } else if (d.slip) {
      d.state = d.slip; d.slip = null; FX.glitch = 0; sendState(); play(d);
    }
    uiFlags(d);
  }
  function freeze(d) {
    if (!d.state) return;
    if (d.state.freeze != null) commit(d, { freeze: null, pos: d.state.freeze });
    else { const p = curPos(d); commit(d, { freeze: p, pos: p }); }
    uiFlags(d);
  }
  function reverse(d, on) {
    if (!d.state || d.stopped || d.state.freeze != null) return;
    d.rev_ = on; commit(d, { rate: signedRate(d) }); uiFlags(d);
  }
  function tape(d) {
    if (!d.state || d.state.freeze != null) return;
    clearTimeout(d.rampT);
    const wall = now() + LEAD;
    if (!d.stopped) {
      const dur = 0.85; d.stopped = true;
      commit(d, { rate: Math.max(0.0001, Math.abs(signedRate(d))), ramp: { to: 0, dur } }, wall);
      d.rampT = setTimeout(() => commit(d, { rate: 0, ramp: null }, wall + dur * 1000), dur * 1000 - 20);
    } else {
      const dur = 0.55; d.stopped = false;
      commit(d, { rate: 0, ramp: { to: Math.abs(signedRate(d)), dur } }, wall);
      d.rampT = setTimeout(() => commit(d, { rate: signedRate(d), ramp: null }, wall + dur * 1000), dur * 1000 - 20);
    }
    uiFlags(d);
  }
  function firma(d) {
    if (!d.meta) return;
    const f = VLL.firmaAt(d.meta);
    if (f >= d.meta.duration) return;
    const wall = qWall(d);
    d.loop = false; d.slip = null; d.stopped = false;
    commit(d, { pos: f, a: f, b: d.meta.duration, x: 0, once: true, freeze: null, rate: Math.abs(d.speed) }, wall);
    queued(d, wall); uiFlags(d);
  }
  // ---------------------------------------------------------------- SYNC: tempo y compás del otro deck
  // La rejilla de compases de cada acto arranca en su primer golpe (tras un SILENCIO la rejilla se desplaza).
  function barGrid(d, p) {
    const bar = 4 * 60 / d.item.bpm, i = VLL.actAt(d.meta, p), t0 = d.meta.acts[i][0];
    const h = d.hits.find((x) => x >= t0 - 0.01 && x < t0 + 0.3);
    return { anchor: h != null ? h : t0, bar };
  }
  function nearestBar(d, p) { const g = barGrid(d, p); return g.anchor + Math.round((p - g.anchor) / g.bar) * g.bar; }
  function nextBar(d, p) { const g = barGrid(d, p); return g.anchor + Math.ceil((p - g.anchor + 1e-3) / g.bar) * g.bar; }
  function sync(d) {
    const m = DECK[d.id === 'A' ? 'B' : 'A'];
    if (!d.state || !m.state || !d.item || !m.item) return toast('SYNC · CARGA UNA PIEZA EN CADA DECK');
    if (!d.item.bpm || !m.item.bpm) return toast('SYNC · ' + (!d.item.bpm ? d.item.title : m.item.title) + ' NO TIENE TEMPO FIJO');
    if (m.stopped || m.state.freeze != null || m.state.ramp || Math.abs(m.state.rate) < 0.01) return toast('SYNC · EL DECK ' + m.id + ' TIENE QUE ESTAR SONANDO');
    // tempo: la relación más cercana (½, ⅔, 1, 3⁄2, 2) para que el cambio sea mínimo
    const bm = m.item.bpm * Math.abs(m.state.rate);
    const k = [0.5, 2 / 3, 1, 1.5, 2].reduce((a, b) => (Math.abs(Math.log(bm * b / d.item.bpm)) < Math.abs(Math.log(bm * a / d.item.bpm)) ? b : a));
    const rate = VLL.clamp(bm * k / d.item.bpm, 0.25, 2);
    // fase: en el próximo compás del otro deck, este entra en su compás más cercano
    const base = now() + LEAD, pm = curPos(m, base);
    let target = nextBar(m, pm);
    if (target >= m.state.b) target = m.state.b;                 // si el otro va a dar la vuelta, en la vuelta
    const wall = base + (target - pm) / Math.abs(m.state.rate) * 1000;
    let pd = nearestBar(d, curPos(d, wall));
    const s = d.state;
    if (pd < s.a || pd >= s.b) pd = VLL.clamp(pd, s.a, s.b - 0.05);
    d.speed = rate; d.rev_ = false; d.stopped = false; d.slip = null;
    d.fSpeed && d.fSpeed.set(spdToV(rate), true);
    clearTimeout(d.rampT);
    commit(d, { rate, pos: pd, freeze: null, ramp: null }, wall);
    queued(d, wall); uiFlags(d);
    const kTxt = k === 1 ? '' : ' (' + ({ 0.5: '½', 0.6667: '⅔', 1.5: '3:2', 2: '×2' })[+k.toFixed(4)] + ')';
    toast(`SYNC · ${d.id} ${d.item.bpm} → ${(d.item.bpm * rate).toFixed(1)} BPM CON ${m.id}${kTxt} · ${rate.toFixed(3)}×`);
    d.syncFlash = performance.now();
  }
  function setSpeed(d, v) {
    d.speed = v;
    if (d.state && !d.stopped && d.state.freeze == null && !d.slip) commit(d, { rate: signedRate(d) });
  }

  // ---------------------------------------------------------------- mezcla
  // un movimiento a mano del crossfader (ratón, teclado o controlador) manda: cancela AUTO y un CORTE en cola
  function manualXf(v) { cancelAuto(); cancelCut(); setXf(v); }
  function setXf(v, at) {
    MIX.xf = VLL.clamp(v, 0, 1);
    if (MIX.xf <= 0.001) MIX.onAir = 'A'; else if (MIX.xf >= 0.999) MIX.onAir = 'B';
    applyXfAudio(at); sendState(); uiMix();
    if (hwPos.xf != null) markHw(hwPos.xf);
  }
  let cutPending = null, cutTimer = null;
  function cancelCut() {
    if (!cutPending) return;
    clearTimeout(cutTimer); cutPending = null; $('#cut').classList.remove('q');
    if (ctx) ['A', 'B'].forEach((k) => DECK[k].aud.xf.gain.cancelScheduledValues(ctx.currentTime));
  }
  function cut() {
    if (cutPending) return;
    cancelAuto();
    const target = MIX.onAir === 'A' ? 1 : 0;
    const wall = qWall(DECK[MIX.onAir]);
    cutPending = wall; $('#cut').classList.add('q');
    applyXfAudioAt(target, wall);
    cutTimer = setTimeout(() => {
      cutPending = null; $('#cut').classList.remove('q');
      MIX.xf = target; MIX.onAir = target ? 'B' : 'A';
      FX.glitch = 1; sendState(); uiMix();
      setTimeout(() => { if (!anyHold()) { FX.glitch = 0; sendState(); } }, 140);
    }, Math.max(0, wall - now()));
  }
  function applyXfAudioAt(target, wall) {
    if (!ctx) return;
    const t = Math.max(ctx.currentTime, wallToCtx(wall));
    DECK.A.aud.xf.gain.setValueAtTime(target ? 0 : 1, t); DECK.B.aud.xf.gain.setValueAtTime(target ? 1 : 0, t);
  }
  let autoAnim = null, autoDur = store.get('auto', 6);
  function cancelAuto() { if (!autoAnim) return; autoAnim = null; $('#autoB').classList.remove('on'); }
  function auto() {
    if (autoAnim) return cancelAuto();
    cancelCut();
    const from = MIX.xf, to = MIX.onAir === 'A' ? 1 : 0, t0 = performance.now();
    $('#autoB').classList.add('on');
    autoAnim = { from, to, t0 };
  }
  function autoStep() {
    if (!autoAnim) return;
    const { from, to, t0 } = autoAnim;
    const k = VLL.clamp((performance.now() - t0) / (autoDur * 1000), 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    setXf(from + (to - from) * e);
    if (k >= 1) { autoAnim = null; $('#autoB').classList.remove('on'); }
  }
  const anyHold = () => Object.values(DECK).some((d) => d.slip);

  // ---------------------------------------------------------------- envío a la salida
  let dirty = false;
  function sendState() { dirty = true; }
  function flush() {
    if (!dirty) return; dirty = false;
    const decks = {};
    for (const k in DECK) decks[k] = DECK[k].state;
    const air = DECK[MIX.onAir]; FX.tintC = air && air.item ? air.item.accent : '#ffffff';
    ch.postMessage({ type: 'state', decks, mix: MIX, fx: presFx(), pres: presOut(), ojo: PRES.on, ext: EXT.mode });
  }

  // ---------------------------------------------------------------- ENTRADA EXTERNA · TR-09 (apagada por defecto)
  // Una caja de ritmos por USB (pensado para la Roland TR-09: audio y MIDI por el mismo cable).
  // · Audio: entra al master de LIVE (pasa por filtro, eco, sala y limitador) y sus golpes mueven la imagen.
  //   MEZCLA: suena con las piezas. SOLO CAJA: las piezas siguen en imagen pero mudas; solo suena la caja.
  // · Reloj MIDI: si la caja lo manda, las piezas siguen su tempo (como SYNC, en la relación ½ ⅔ 1 3:2 2 más cercana).
  const EXT_M = ['APAGADA', 'MEZCLA', 'SOLO CAJA'];
  const EXT = { cnt: 0, started: false, mode: 0, stream: null, src: null, an: null, buf: null, name: '', prev: 0, mean: 0.02, last: 0, tk: [], bpm: 0, clkAt: 0, lastFollow: 0 };
  async function extOpen() {
    if (EXT.stream) return true;
    if (!navigator.mediaDevices) return false;
    const c = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0, channelCount: 2 };
    const get = (id) => navigator.mediaDevices.getUserMedia({ audio: Object.assign({}, c, id ? { deviceId: { exact: id } } : {}) }).catch(() => null);
    let st = await get(store.get('extDev', ''));
    if (!st) st = await get('');
    if (!st) return false;
    // la TR-09 (o cualquier Roland) si está conectada, aunque no sea la entrada por defecto
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const tr = devs.find((d) => d.kind === 'audioinput' && /tr-?0?9|boutique|roland/i.test(d.label));
      if (tr && tr.deviceId !== st.getAudioTracks()[0].getSettings().deviceId) { const s2 = await get(tr.deviceId); if (s2) { st.getTracks().forEach((t) => t.stop()); st = s2; } }
    } catch (e) {}
    EXT.stream = st; EXT.name = st.getAudioTracks()[0].label || 'ENTRADA';
    store.set('extDev', st.getAudioTracks()[0].getSettings().deviceId || '');
    EXT.src = ctx.createMediaStreamSource(st);
    EXT.src.connect(M.in);
    EXT.an = ctx.createAnalyser(); EXT.an.fftSize = 1024; EXT.an.smoothingTimeConstant = 0; EXT.src.connect(EXT.an);
    EXT.buf = new Uint8Array(EXT.an.frequencyBinCount);
    return true;
  }
  function extClose() {
    if (EXT.src) { try { EXT.src.disconnect(); } catch (e) {} }
    if (EXT.stream) EXT.stream.getTracks().forEach((t) => t.stop());
    EXT.stream = EXT.src = EXT.an = null;
  }
  function extApply() {
    if (!M) return;
    const t = ctx.currentTime;
    M.dk.gain.cancelScheduledValues(t); M.dk.gain.setTargetAtTime(EXT.mode === 2 ? 0 : 1, t, 0.12);
  }
  async function extCycle() {
    if (!ctx) return toast('ENTRADA · PRIMERO ARRANCA EL LIVE');
    if (EXT.busy) return;
    const next = (EXT.mode + 1) % 3;
    if (next && !EXT.stream) {
      EXT.busy = true; $('#tg-ext').textContent = 'ENTRADA · ABRIENDO…';
      const ok = await extOpen(); EXT.busy = false;
      if (!ok) { toast('ENTRADA · NO HAY ACCESO AL AUDIO DE ENTRADA'); return; }
    }
    if (!next) extClose();
    EXT.mode = next; extApply(); sendState();
    $('#tg-ext').classList.toggle('on', EXT.mode > 0);
    toast('ENTRADA · ' + EXT_M[EXT.mode] + (EXT.mode ? ' · ' + EXT.name.toUpperCase() : ''));
  }
  // golpes de la caja: subidas bruscas de energía en graves, medios y agudos
  function extTick() {
    if (!EXT.an) return;
    EXT.an.getByteFrequencyData(EXT.buf);
    const hz = ctx.sampleRate / EXT.an.fftSize, B = EXT.buf;
    const avg = (a, b) => { let s = 0, n = 0; for (let i = Math.max(1, Math.floor(a / hz)); i < Math.min(B.length, Math.floor(b / hz)); i++) { s += B[i]; n++; } return n ? s / n / 255 : 0; };
    const e = avg(30, 180) * 0.5 + avg(180, 1800) * 0.25 + avg(1800, 9000) * 0.25;   // bombo · caja/palmas/toms · charles/platos
    const flux = Math.max(0, e - EXT.prev); EXT.prev = e;
    EXT.mean += (flux - EXT.mean) * 0.04;
    const now = performance.now();
    if (flux > Math.max(0.035, EXT.mean * 3) && now - EXT.last > 85) { EXT.last = now; ch.postMessage({ type: 'ext', hit: VLL.clamp(flux * 5, 0.35, 1) }); }
  }
  setInterval(extTick, 10);
  // reloj MIDI: 24 pulsos por negra
  function extClock(st, ts) {
    if (st === 0xf8) {
      EXT.tk.push(ts); if (EXT.tk.length > 49) EXT.tk.shift();
      if (EXT.tk.length >= 25) { const bpm = 60000 / ((EXT.tk[EXT.tk.length - 1] - EXT.tk[0]) / (EXT.tk.length - 1) * 24); EXT.bpm = EXT.bpm ? EXT.bpm + (bpm - EXT.bpm) * 0.2 : bpm; EXT.clkAt = performance.now(); }
      // cada negra de la caja (24 pulsos); cada compás (96) si sabemos dónde empezó (START)
      if (EXT.cnt % 24 === 0) extPhase(performance.timeOrigin + ts, EXT.started && EXT.cnt % 96 === 0);
      EXT.cnt++;
    } else if (st === 0xfa) { EXT.cnt = 0; EXT.started = true; }        // START: el siguiente pulso es el 1 del compás
    else if (st === 0xfc) { EXT.tk = []; EXT.started = false; }
  }
  // FASE: que los pulsos de la pieza caigan en los de la caja (y el 1 del compás en su 1, si la caja mandó START).
  // Mide el desfase en cada negra de la caja y, si pasa de 20 ms, recoloca la pieza en la siguiente negra.
  function extPhase(wall, isBar) {
    if (!EXT.mode || !EXT.bpm || performance.now() - EXT.clkAt > 1500) return;
    const beatMs = 60000 / EXT.bpm;
    for (const id of ['A', 'B']) {
      const d = DECK[id];
      if (!d.state || !d.item || !d.item.bpm || !d.meta || d.stopped || d.state.freeze != null || d.slip || d.state.ramp) continue;
      if (EXT.started && !isBar) continue;                        // con START se alinea por compases
      if (performance.now() - (d.extFix || 0) < beatMs * 3.5) continue;
      const p = curPos(d, wall), g = barGrid(d, p), unit = EXT.started ? g.bar : g.bar / 4;
      let ph = ((p - g.anchor) / unit) % 1; if (ph < 0) ph += 1;
      const err = (ph > 0.5 ? ph - 1 : ph) * unit;                // segundos de pieza por delante (+) o por detrás (−)
      if (Math.abs(err) < 0.02 * Math.abs(d.state.rate || 1)) continue;
      const at = wall + beatMs * (EXT.started ? 4 : 1);
      if (at < now() + LEAD) continue;
      const s = d.state;
      let pos = curPos(d, at) - err;
      if (pos < s.a || pos >= s.b) pos = VLL.clamp(pos, s.a, s.b - 0.05);
      commit(d, { pos }, at); queued(d, at);
      d.extFix = performance.now();
    }
  }
  // las piezas siguen el tempo de la caja (solo con la entrada encendida y el reloj llegando)
  function extFollow() {
    const now = performance.now();
    if (!EXT.mode || now - EXT.clkAt > 1500 || !EXT.bpm || now - EXT.lastFollow < 400) return;
    EXT.lastFollow = now;
    for (const id of ['A', 'B']) {
      const d = DECK[id];
      if (!d.state || !d.item || !d.item.bpm || d.stopped || d.state.freeze != null || d.slip) continue;
      const k = [0.5, 2 / 3, 1, 1.5, 2].reduce((a, b) => (Math.abs(Math.log(EXT.bpm * b / d.item.bpm)) < Math.abs(Math.log(EXT.bpm * a / d.item.bpm)) ? b : a));
      const rate = VLL.clamp(EXT.bpm * k / d.item.bpm, 0.25, 2);
      if (Math.abs(rate - (d.speed ?? 1)) > 0.004) { setSpeed(d, rate); d.fSpeed && d.fSpeed.set(spdToV(rate), true); }
    }
  }
  function extLabel() {
    const b = $('#tg-ext'); if (!b || EXT.busy) return;
    const clk = EXT.bpm && performance.now() - EXT.clkAt < 1500;
    const tx = 'ENTRADA · ' + EXT_M[EXT.mode] + (EXT.mode && clk ? ' · ' + EXT.bpm.toFixed(1) + ' BPM' : '');
    if (b.textContent !== tx) b.textContent = tx;
  }

  // ---------------------------------------------------------------- OJO · PRESENCIA (apagado por defecto)
  // OJO (otra ventana o pestaña del mismo sitio) envía cuánta gente hay, dónde y si alguien mira a la cámara.
  // Sala vacía: LIVE sigue a lo suyo. Alguien entra: aparece encima de la pieza tal como lo ve OJO y la sala
  // suena más abierta, más eco cuanto más se mueve. Contacto (te mira): la pieza a negro y silencio, queda solo él;
  // al apartar la mirada, impacto y vuelve.
  // Dos maneras de reaccionar: ATENCIÓN (mientras haya alguien, lo muestra; el contacto apaga la pieza) y
  // DISTRACCIÓN (cuando entra alguien nuevo lo mira unos segundos y vuelve a lo suyo; si le miran, otra mirada breve).
  const OJO_M = ['APAGADO', 'ATENCIÓN', 'DISTRACCIÓN'];
  const PRES = { mode: store.get('ojoModo', store.get('ojoPres', false) ? 1 : 0), get on() { return this.mode > 0; }, ent: -1, glance: 0, cLook: false, n: 0, energy: 0, contact: 0, x: 0.5, y: 0.5, size: 0, at: 0, k: 0, seenAt: -1e9, cont: false, hit: 0, lastAFX: 0, sent: '' };
  const presCh = new BroadcastChannel('voidloom-presencia');
  presCh.onmessage = (e) => {
    const m = e.data; if (!m || m.type !== 'presencia') return;
    // alguien nuevo entra en la sala (OJO le da un ID nuevo): en DISTRACCIÓN, una mirada de unos segundos
    if (m.ent != null) { if (PRES.ent >= 0 && m.ent > PRES.ent) PRES.glance = performance.now() + 5000 + Math.random() * 3000; PRES.ent = m.ent; }
    Object.assign(PRES, { n: m.n | 0, energy: +m.energy || 0, contact: +m.contact || 0, x: +m.x, y: +m.y, size: +m.size || 0, at: performance.now() });
  };
  const presLive = () => PRES.on && performance.now() - PRES.at < 2000;
  function presFx() {
    if (!presLive() || PRES.k < 0.5) return FX;
    return PRES.cont ? Object.assign({}, FX, { black: 1 }) : FX;
  }
  function presOut() {
    if (!presLive()) return null;
    return { k: +PRES.k.toFixed(3), n: PRES.n, e: +PRES.energy.toFixed(3), c: PRES.cont ? 1 : +PRES.contact.toFixed(3), x: +PRES.x.toFixed(3), y: +PRES.y.toFixed(3), s: +PRES.size.toFixed(3), hit: PRES.hit };
  }
  function presTick() {
    const now = performance.now(), live = presLive();
    if (live && PRES.n > 0) PRES.seenAt = now;
    const dis = PRES.mode === 2;
    // DISTRACCIÓN: si le miran, vuelve a mirar un momento (sin apagar la pieza)
    if (dis && live && PRES.contact > 0.6 && !PRES.cLook) { PRES.cLook = true; PRES.glance = Math.max(PRES.glance, now + 4000); }
    if (PRES.contact < 0.25) PRES.cLook = false;
    const want = !live ? 0 : dis ? (now < PRES.glance && PRES.n > 0 ? 1 : 0) : (now - PRES.seenAt < 3000 ? 1 : 0);   // ATENCIÓN aguanta 3 s después de que se vaya
    PRES.k += (want - PRES.k) * (want ? 0.12 : dis ? 0.04 : 0.02);
    const was = PRES.cont;
    if (!PRES.cont && live && !dis && PRES.contact > 0.6) PRES.cont = true;
    if (PRES.cont && (!live || dis || PRES.contact < 0.25)) { PRES.cont = false; PRES.hit++; }    // el impacto al apartar la mirada
    if (was !== PRES.cont) toast(PRES.cont ? 'OJO · CONTACTO' : 'OJO · FIN DEL CONTACTO');
    if (now - PRES.lastAFX > 90) { PRES.lastAFX = now; applyAFX(); }
    const key = live ? [Math.round(PRES.k * 10), PRES.cont, PRES.hit, Math.round(PRES.x * 40), Math.round(PRES.y * 40), Math.round(PRES.energy * 20), PRES.n].join() : 'off';
    if (key !== PRES.sent) { PRES.sent = key; sendState(); }
    const st = $('#tg-ojo');
    const wait = { camara: 'CÁMARA…', ia: 'CARGANDO IA…', 'sin-camara': 'SIN CÁMARA', 'error-ia': 'ERROR IA' }[PRES.sensor];
    if (st) { const tx = 'OJO · ' + (!PRES.on ? 'APAGADO' : OJO_M[PRES.mode] + ' · ') + (!PRES.on ? '' : !live ? (!outOK ? 'ABRE LA SALIDA' : wait || 'SIN SEÑAL') : PRES.cont ? 'CONTACTO' : PRES.n ? PRES.n + (PRES.n === 1 ? ' PERSONA' : ' PERSONAS') : 'SALA VACÍA'); if (st.textContent !== tx) st.textContent = tx; }
  }
  // el sonido de la sala: más abierto con gente, más eco con movimiento, silencio en el contacto
  function presAudio() {
    if (!presLive()) return { room: 0, echo: 0, mute: 0 };
    return { room: PRES.k * 0.18, echo: PRES.k * Math.min(1, PRES.energy * 1.4) * 0.3, mute: PRES.cont ? 1 : 0 };
  }
  ch.onmessage = (ev) => {
    const m = ev.data; lastOutMsg = performance.now();
    if (m.type === 'ojo') { PRES.sensor = m.st || ''; if (m.st === 'sin-camara') toast('OJO · NO HAY ACCESO A LA CÁMARA' + (m.err ? ' · ' + m.err : '')); if (m.st === 'error-ia') toast('OJO · NO SE PUDO CARGAR LA IA'); return; }
    if (m.type === 'hello') {
      outOK = true;
      for (const it of LIB) if (it.hits) ch.postMessage({ type: 'hits', piece: it.id, hits: it.hits });
      dirty = true; flush();
      VLC.resend && VLC.resend();
    } else if (m.type === 'stats') {
      outOK = true; $('#stOut').textContent = m.fps + ' FPS · ' + m.w + '×' + m.h + (m.q ? ' · ' + (m.q3 ? '3D ' : 'PIEZA ') + m.q + '%' + (m.auto ? ' AUTO' : '') : '');
      $('#ledOut').className = 'led ' + (m.fps >= 50 ? 'on' : m.fps >= 30 ? 'warn' : 'err');
    } else if (m.type === 'ready') { const d = DECK[m.deck]; if (d && d.item && d.item.id === m.piece) { d.ready = true; renderDeckState(d); } }
    else if (m.type === 'loading') { const d = DECK[m.deck]; if (d) { d.ready = false; renderDeckState(d); } }
    else if (m.type === 'preview') drawPreview(m.bmp);
    else if (m.type === 'dprev') drawDeckPrev(DECK[m.deck], m.bmp);
    else if (m.type === 'codeRes') VLC.onCodeRes && VLC.onCodeRes(m);
  };
  const mon = $('#mon'), mctx = mon.getContext('2d');
  function drawPreview(bmp) {
    if (!bmp) return;
    const r = mon.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (mon.width !== Math.round(r.width * dpr)) { mon.width = Math.round(r.width * dpr); mon.height = Math.round(r.height * dpr); }
    const k = Math.min(mon.width / bmp.width, mon.height / bmp.height), w = bmp.width * k, h = bmp.height * k;
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mon.width, mon.height);
    mctx.drawImage(bmp, (mon.width - w) / 2, (mon.height - h) / 2, w, h);
    bmp.close && bmp.close();
    $('#monOv').classList.add('off');
  }
  function drawDeckPrev(d, bmp) {
    if (!d || !d.ui || !bmp) return;
    const c = d.ui.prev, r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d'), k = Math.max(W / bmp.width, H / bmp.height), w = bmp.width * k, h = bmp.height * k;
    g.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
    bmp.close && bmp.close();
    d.el.classList.add('live');
  }
  function openOutput() {
    outWin = window.open('output.html', 'vll-output', 'popup,width=1280,height=720');
    if (!outWin) toast('EL NAVEGADOR HA BLOQUEADO LA VENTANA · PERMITE POPUPS');
    else setTimeout(() => ch.postMessage({ type: 'ping' }), 800);
  }

  // ================================================================== UI: componentes
  const CTL = {};      // id -> { kind, set(v01), press(), release(), el }
  function reg(id, el, o) { el.dataset.ctl = id; CTL[id] = Object.assign({ el }, o); return CTL[id]; }
  function knob(host, id, label, def, onChange, fmt) {
    const el = document.createElement('div'); el.className = 'knob';
    el.innerHTML = `<svg width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="14" fill="none" stroke="#232220" stroke-width="2" stroke-dasharray="65.97 87.96" transform="rotate(135 19 19)"/>
      <circle class="arc" cx="19" cy="19" r="14" fill="none" stroke="var(--acc)" stroke-width="2" stroke-dasharray="0 87.96" transform="rotate(135 19 19)"/>
      <circle cx="19" cy="19" r="9.5" fill="#141413" stroke="#2a2927"/><line class="pt" x1="19" y1="19" x2="19" y2="11" stroke="#f2f0ea" stroke-width="1.5" stroke-linecap="square"/></svg>
      <span class="val"></span><span class="lbl">${label}</span>`;
    host.appendChild(el);
    let v = def;
    const arc = el.querySelector('.arc'), pt = el.querySelector('.pt'), val = el.querySelector('.val');
    const draw = () => { arc.setAttribute('stroke-dasharray', (v * 65.97).toFixed(2) + ' 87.96'); pt.setAttribute('transform', `rotate(${-135 + v * 270} 19 19)`); val.textContent = fmt ? fmt(v) : Math.round(v * 100); };
    const set = (x, silent) => { v = VLL.clamp(x, 0, 1); draw(); if (!silent) onChange(v); };
    let y0, v0;
    el.addEventListener('pointerdown', (e) => { if (learnArm(id)) return; el.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = v; el.classList.add('drag'); });
    el.addEventListener('pointermove', (e) => { if (y0 == null) return; set(v0 + (y0 - e.clientY) / (e.shiftKey ? 600 : 150)); });
    el.addEventListener('pointerup', () => { y0 = null; el.classList.remove('drag'); });
    el.addEventListener('dblclick', () => set(def));
    el.addEventListener('wheel', (e) => { e.preventDefault(); set(v - e.deltaY / 1500); }, { passive: false });
    draw();
    reg(id, el, { kind: 'cc', set: (x) => set(x), get: () => v });
    return { set, get: () => v };
  }
  function fader(host, id, label, def, onChange, fmt, detents = []) {
    const el = document.createElement('div'); el.className = 'fader';
    el.innerHTML = `<div class="row"><span class="lbl">${label}</span><b></b></div><div class="track"><div class="ln"></div><div class="fl"></div>${detents.map((t) => `<div class="dt" style="left:${t * 100}%"></div>`).join('')}<div class="th"></div></div>`;
    host.appendChild(el);
    const tr = el.querySelector('.track'), th = el.querySelector('.th'), fl = el.querySelector('.fl'), b = el.querySelector('b');
    let v = def;
    const draw = () => { th.style.left = v * 100 + '%'; fl.style.width = v * 100 + '%'; b.textContent = fmt ? fmt(v) : Math.round(v * 100); };
    const set = (x, silent) => { v = VLL.clamp(x, 0, 1); for (const t of detents) if (Math.abs(v - t) < 0.015) v = t; draw(); if (!silent) onChange(v); };
    const at = (e) => { const r = tr.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
    let drag = false;
    tr.addEventListener('pointerdown', (e) => { if (learnArm(id)) return; drag = true; tr.setPointerCapture(e.pointerId); at(e); });
    tr.addEventListener('pointermove', (e) => drag && at(e));
    tr.addEventListener('pointerup', () => (drag = false));
    el.addEventListener('dblclick', () => set(def));
    draw();
    reg(id, tr, { kind: 'cc', set: (x) => set(x), get: () => v });
    return { set, get: () => v };
  }
  function btn(el, id, onPress, onRelease) {
    el.addEventListener('pointerdown', (e) => { if (learnArm(id)) return; e.preventDefault(); onPress(); if (onRelease) { const up = () => { onRelease(); removeEventListener('pointerup', up); }; addEventListener('pointerup', up); } });
    reg(id, el, { kind: onRelease ? 'hold' : 'btn', press: onPress, release: onRelease });
  }
  function seg(el, id, cur, onPick) {
    const bs = [...el.querySelectorAll('button')];
    const mark = (v) => bs.forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    bs.forEach((b) => b.addEventListener('click', () => { if (learnArm(id)) return; onPick(b.dataset.v); mark(b.dataset.v); }));
    mark(cur);
    reg(id, el, { kind: 'btn', press: () => { const i = bs.findIndex((b) => b.classList.contains('on')); const v = bs[(i + 1) % bs.length].dataset.v; onPick(v); mark(v); } });
    return mark;
  }

  // ================================================================== UI: decks
  function renderDeckUI(d) {
    const el = d.el, it = d.item, id = d.id;
    el.style.setProperty('--acc', it ? it.accent : '#5d5b57');
    el.innerHTML = `
      <div class="d-head"><span class="d-id">${id}</span><div class="d-title"><b>${it ? it.title : 'VACÍO'}</b><span>${it ? 'LAB ' + String(it.n).padStart(2, '0') + ' · ' + (it.bpm ? it.bpm + ' BPM' : 'TEMPO LIBRE') + ' · ' + d.meta.acts.length + ' ACTOS' : 'CARGA UNA PIEZA DESDE LA BIBLIOTECA'}</span></div><span class="d-state">—</span></div>
      <div class="d-view">${it ? `<img src="${it.thumb}" alt=""><canvas class="d-prev"></canvas>` : ''}<div class="vg"></div>${it ? '' : '<div class="d-empty">SIN PIEZA</div>'}
        <div class="d-act"></div><div class="d-time"></div>
        <div class="d-flags"><span data-f="loop">LOOP</span><span data-f="stut">STUTTER</span><span data-f="frz">CONGELADO</span><span data-f="rev">REVERSA</span><span data-f="tape">CINTA</span><span data-f="firma">FIRMA</span></div>
        <div class="d-queue">EN COLA</div></div>
      <canvas class="d-strip"></canvas>
      <div class="d-acts"></div>
      <div class="d-perf"></div>
      <div class="d-mix"><div class="eq"></div><div class="faders"></div></div>`;
    el.classList.remove('live');
    d.ui = { prev: $('.d-prev', el), state: $('.d-state', el), act: $('.d-act', el), time: $('.d-time', el), q: $('.d-queue', el), strip: $('.d-strip', el), acts: $('.d-acts', el), flags: $('.d-flags', el) };
    // actos
    if (d.meta) d.meta.acts.forEach(([, n], i) => {
      const b = document.createElement('button'); b.innerHTML = `<i>${i + 1}</i>${n}`; if (/FIRMA/i.test(n)) b.classList.add('firma');
      d.ui.acts.appendChild(b); btn(b, `${id}.act${i + 1}`, () => jumpAct(d, i));
    });
    // interpretación
    const perf = $('.d-perf', el);
    [['SYNC', 'Y', 'sync', () => sync(d)], ['LOOP', 'L', 'loop', () => toggleLoop(d)], ['/2', '[', 'half', () => resizeLoop(d, 0.5)], ['×2', ']', 'dbl', () => resizeLoop(d, 2)],
     ['STUTTER', 'S', 'stut', () => stutter(d, true), () => stutter(d, false)], ['CONGELAR', 'F', 'frz', () => freeze(d)],
     ['REVERSA', 'R', 'rev', () => reverse(d, true), () => reverse(d, false)], ['CINTA', 'T', 'tape', () => tape(d)], ['FIRMA · CIERRE', 'G', 'firma', () => firma(d)]]
      .forEach(([t, k, f, p, r]) => { const b = document.createElement('button'); b.className = 'pb'; b.dataset.f = f; if (f === 'firma') b.style.gridColumn = 'span 4'; b.innerHTML = t + `<small>${k}</small>`; perf.appendChild(b); btn(b, `${id}.${f}`, p, r); });
    d.ui.perf = perf;
    // ecualizador + kills
    const eq = $('.eq', el);
    ['GRAV', 'MED', 'AGUD'].forEach((n, i) => {
      const col = document.createElement('div'); col.className = 'kcol'; eq.appendChild(col);
      d['k' + i] = knob(col, `${id}.eq${i}`, n, d.eq[i], (v) => { d.eq[i] = v; applyDeckAudio(d); }, (v) => (v <= 0.5 ? Math.round(20 * Math.log10(Math.max(1e-3, eqGain(v)))) : '+' + (20 * Math.log10(eqGain(v))).toFixed(1)) + 'dB');
      const kb = document.createElement('button'); kb.className = 'kill' + (d.kill[i] ? ' on' : ''); kb.textContent = 'KILL'; col.appendChild(kb);
      btn(kb, `${id}.kill${i}`, () => { d.kill[i] ^= 1; kb.classList.toggle('on', !!d.kill[i]); applyDeckAudio(d); });
      d['kb' + i] = kb;
    });
    const fd = $('.faders', el);
    d.fSpeed = fader(fd, `${id}.speed`, 'VELOCIDAD', spdToV(d.speed), (v) => setSpeed(d, vToSpd(v)), (v) => vToSpd(v).toFixed(2) + '×', [spdToV(1)]);
    d.fVol = fader(fd, `${id}.vol`, 'VOLUMEN', d.vol / 1.2, (v) => { d.vol = v * 1.2; applyDeckAudio(d); }, (v) => (v <= 0 ? '−∞' : (20 * Math.log10(v * 1.2)).toFixed(1)) + 'dB', [1 / 1.2]);
    const mt = document.createElement('div'); mt.className = 'meter'; mt.innerHTML = '<i></i>'; fd.appendChild(mt); d.ui.meter = mt.firstChild;
    // tira de tiempo: clic = saltar (sin cuantizar)
    d.ui.strip.addEventListener('pointerdown', (e) => {
      if (!d.meta || !d.state) return;
      const r = d.ui.strip.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * d.meta.duration;
      if (t >= end(d)) return firma(d);
      const patch = { pos: t, freeze: null, once: false };
      if (d.loop) { const i = VLL.actAt(d.meta, t), [a0, b0] = VLL.actRange(d.meta, i); Object.assign(patch, { a: a0, b: Math.min(b0, end(d)), x: loopX(Math.min(b0, end(d)) - a0) }); }
      else Object.assign(patch, { a: 0, b: end(d), x: X0 });
      commit(d, patch);
    });
    renderDeckState(d); uiFlags(d);
  }
  const vToSpd = (v) => (v < 0.5 ? 0.25 + v / 0.5 * 0.75 : 1 + (v - 0.5) / 0.5 * 1);
  const spdToV = (s) => (s < 1 ? (s - 0.25) / 0.75 * 0.5 : 0.5 + (s - 1) * 0.5);
  function renderDeckState(d) {
    const st = d.ui.state; st.className = 'd-state';
    if (!d.item) st.textContent = '—';
    else if (outOK && !d.ready) st.textContent = 'CARGANDO';
    else if (MIX.onAir === d.id || (d.id === 'A' ? Math.cos(MIX.xf * Math.PI / 2) : Math.sin(MIX.xf * Math.PI / 2)) > 0.05) { st.textContent = 'EN AIRE'; st.classList.add('air'); }
    else st.textContent = 'PREPARADO';
  }
  function uiFlags(d) {
    if (!d.ui) return;
    const s = d.state || {};
    const on = { loop: d.loop, stut: !!d.slip, frz: s.freeze != null, rev: d.rev_, tape: d.stopped, firma: !!s.once };
    d.ui.flags.querySelectorAll('span').forEach((x) => x.classList.toggle('on', !!on[x.dataset.f]));
    d.ui.perf.querySelectorAll('.pb').forEach((x) => x.classList.toggle('on', !!on[x.dataset.f]));
  }
  function flashAct(d, i) { const b = d.ui.acts.children[i]; if (!b) return; b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 160); }
  function setFocus(id) { focus = id; for (const k in DECK) DECK[k].el.classList.toggle('focus', k === id); }

  // tira: actos, golpes, loop y cabezal
  function drawStrip(d) {
    const c = d.ui.strip, r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
    if (!d.meta) return;
    const D_ = d.meta.duration, X = (t) => t / D_ * W, acc = d.item.accent, e = end(d);
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, W, H);
    // FIRMA rayada
    g.save(); g.beginPath(); g.rect(X(e), 0, W - X(e), H); g.clip(); g.strokeStyle = '#1b1a19'; g.lineWidth = dpr;
    for (let x = X(e) - H; x < W; x += 6 * dpr) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); } g.restore();
    const p = curPos(d), ai = VLL.actAt(d.meta, p);
    g.font = `${8 * dpr}px 'JetBrains Mono', monospace`; g.textBaseline = 'top';
    d.meta.acts.forEach(([t0, n], i) => {
      const x = X(t0); g.fillStyle = i === ai ? acc : '#2a2927'; g.fillRect(x, 0, dpr, H);
      const room = Math.floor((X(i < d.meta.acts.length - 1 ? d.meta.acts[i + 1][0] : D_) - x - 8 * dpr) / g.measureText('M').width);
      g.fillStyle = i === ai ? '#f2f0ea' : '#5d5b57'; if (room >= 3) g.fillText(n.slice(0, room), x + 5 * dpr, 6 * dpr);
    });
    // golpes
    g.fillStyle = '#3a3936';
    for (const h of d.hits) g.fillRect(X(h), H - 12 * dpr, dpr, 7 * dpr);
    const s = d.state;
    if (s && d.loop) {
      g.fillStyle = acc + '26'; g.fillRect(X(s.a), 22 * dpr, X(s.b) - X(s.a), H - 22 * dpr);
      g.fillStyle = acc; g.fillRect(X(s.a), 22 * dpr, 2 * dpr, H - 22 * dpr); g.fillRect(X(s.b) - 2 * dpr, 22 * dpr, 2 * dpr, H - 22 * dpr);
    }
    if (s) {
      // golpes recientes iluminados
      g.fillStyle = acc;
      for (const h of d.hits) if (h <= p && p - h < 0.25) { g.globalAlpha = 1 - (p - h) / 0.25; g.fillRect(X(h) - dpr, H - 16 * dpr, 3 * dpr, 11 * dpr); }
      g.globalAlpha = 1;
      const x = X(p); g.shadowColor = acc; g.shadowBlur = 10 * dpr; g.fillStyle = s.freeze != null ? '#f2f0ea' : acc; g.fillRect(x - dpr, 0, 2 * dpr, H); g.shadowBlur = 0;
    }
  }

  // ================================================================== UI: biblioteca
  function renderLib() {
    const host = $('#lib'); host.innerHTML = '';
    LIB.forEach((it, i) => {
      const el = document.createElement('div'); el.className = 'item'; el.style.setProperty('--ia', it.accent); it.el = el;
      el.innerHTML = `<button class="ap" aria-label="Incluir en AUTOPLAY" title="Clic · sacar o meter en AUTOPLAY"><img src="${it.thumb}" alt="" loading="lazy"><i>FUERA</i></button><div class="nm"><b>${it.title}</b><span>${String(it.n).padStart(2, '0')} · <em style="font-style:normal" class="st">CARGANDO</em></span></div><div class="ld"><button data-d="A" aria-label="Cargar en A">A</button><button data-d="B" aria-label="Cargar en B">B</button></div>`;
      el.querySelectorAll('.ld button').forEach((b) => b.addEventListener('click', () => load(b.dataset.d, it)));
      el.querySelector('.ap').addEventListener('click', () => apSkip(it));
      host.appendChild(el);
    });
    markSkip();
  }
  // piezas fuera del AUTOPLAY: se guardan entre sesiones; siguen disponibles para cargar a mano en A y B
  function markSkip() {
    let inAp = 0;
    LIB.forEach((it) => { const off = AP.skip.has(it.id); if (!off) inAp++; if (it.el) { it.el.classList.toggle('skip', off); it.el.querySelector('.ap').setAttribute('aria-pressed', String(!off)); } });
    $('#libN').textContent = inAp === LIB.length ? LIB.length + ' PIEZAS' : 'AUTOPLAY ' + inAp + '/' + LIB.length;
  }
  function apSkip(it, v) {
    const off = v == null ? !AP.skip.has(it.id) : v;
    off ? AP.skip.add(it.id) : AP.skip.delete(it.id);
    store.set('apSkip', [...AP.skip]);
    AP.bag = AP.bag.filter((b) => !AP.skip.has(b.id));
    markSkip();
    toast(it.title + (off ? ' · FUERA DEL AUTOPLAY' : ' · EN AUTOPLAY'));
  }
  function markLib() { LIB.forEach((it) => { if (!it.el) return; it.el.classList.toggle('inA', DECK.A.item === it); it.el.classList.toggle('inB', DECK.B.item === it); }); }
  function libStatus(it, t) { const s = it.el && it.el.querySelector('.st'); if (s) s.textContent = t; }

  // ================================================================== UI: centro y efectos
  function uiMix() {
    const xf = $('#xf'); xf.querySelector('.th').style.left = MIX.xf * 100 + '%';
    $('#xlA').classList.toggle('on', MIX.xf < 0.5); $('#xlB').classList.toggle('on', MIX.xf > 0.5);
    for (const k in DECK) if (DECK[k].ui) renderDeckState(DECK[k]);
  }
  function buildCenter() {
    const xf = $('#xf');
    xf.insertAdjacentHTML('beforeend', [0, 0.25, 0.5, 0.75, 1].map((t) => `<div class="tk" style="left:${t * 100}%"></div>`).join('') + '<div class="hw" id="xfHw" title="Posición del crossfader del controlador: llévalo hasta aquí para recogerlo"></div><div class="th"></div>');
    let drag = false;
    const at = (e) => { const r = xf.getBoundingClientRect(); manualXf((e.clientX - r.left) / r.width); };
    xf.addEventListener('pointerdown', (e) => { if (learnArm('xf')) return; drag = true; xf.setPointerCapture(e.pointerId); at(e); });
    xf.addEventListener('pointermove', (e) => drag && at(e)); xf.addEventListener('pointerup', () => (drag = false));
    reg('xf', xf, { kind: 'cc', set: (v) => manualXf(v), get: () => MIX.xf });
    const markMode = seg($('#xmode'), 'xmode', MIX.mode, (v) => { MIX.mode = v; sendState(); }); CTL.xmode.mark = markMode;
    btn($('#cut'), 'cut', cut);
    const ka = document.createElement('div'); $('#kAuto').appendChild(ka); ka.style.setProperty('--acc', '#f2f0ea');
    const autoK = knob(ka, 'autoT', 'SEG', (autoDur - 1) / 15, (v) => { autoDur = 1 + v * 15; store.set('auto', autoDur); }, (v) => (1 + v * 15).toFixed(1) + 's');
    btn($('#autoB'), 'auto', auto);
    uiMix();
    // efectos de audio
    const fa = $('#fxAudio'); fa.style.setProperty('--acc', '#f2f0ea');
    knob(fa, 'filter', 'FILTRO', 0.5, (v) => { AFX.filter = (v - 0.5) * 2; if (Math.abs(AFX.filter) < 0.03) AFX.filter = 0; applyAFX(); }, (v) => (v < 0.485 ? 'LP' : v > 0.515 ? 'HP' : 'OFF'));
    knob(fa, 'echo', 'ECO', 0, (v) => { AFX.echo = v; applyAFX(); });
    knob(fa, 'echoT', 'TIEMPO', (AFX.echoT - 0.06) / 0.94, (v) => { AFX.echoT = 0.06 + v * 0.94; applyAFX(); }, (v) => Math.round((0.06 + v * 0.94) * 1000) + 'ms');
    knob(fa, 'room', 'SALA', AFX.room, (v) => { AFX.room = v; applyAFX(); });
    knob(fa, 'master', 'MASTER', AFX.master / 1.1, (v) => { AFX.master = v * 1.1; applyAFX(); });
    // efectos de imagen
    const fi = $('#fxImg'); fi.style.setProperty('--acc', '#f2f0ea');
    knob(fi, 'trail', 'ESTELA', FX.trail, (v) => { FX.trail = v; sendState(); });
    knob(fi, 'hits', 'GOLPES', FX.hits, (v) => { FX.hits = v; sendState(); });
    knob(fi, 'split', 'DIVISIÓN', FX.split, (v) => { FX.split = v; sendState(); });
    knob(fi, 'bright', 'BRILLO', FX.bright / 1.5, (v) => { FX.bright = v * 1.5; sendState(); });
    knob(fi, 'punch', 'LATIDO', FX.punch, (v) => { FX.punch = v; sendState(); });
    knob(fi, 'lens', 'LENTE', FX.lens, (v) => { FX.lens = v; sendState(); });
    knob(fi, 'mosaic', 'MOSAICO', FX.mosaic, (v) => { FX.mosaic = v; sendState(); });
    knob(fi, 'tint', 'TINTE', FX.tint, (v) => { FX.tint = v; sendState(); });
    knob(fi, 'scan', 'ESCANEO', FX.scan, (v) => { FX.scan = v; sendState(); });
    const tgs = document.createElement('div'); tgs.className = 'tgs'; fi.appendChild(tgs);
    const mir = document.createElement('div'); mir.className = 'mir';
    mir.innerHTML = '<span class="lbl" style="font-size:7.5px">ESPEJO <span style="color:var(--dim)">· E</span></span><div class="seg" id="mirror"><button data-v="0">OFF</button><button data-v="1">◧</button><button data-v="2">⊞</button><button data-v="3">✳</button></div>';
    fi.insertBefore(mir, tgs);
    CTL.mirrorMark = seg($('#mirror'), 'mirror', '0', (v) => { FX.mirror = +v; sendState(); });
    [['INVERTIR', 'I', 'invert', ''], ['GLITCH', 'V', 'glitch', ''], ['STROBE', 'O', 'strobe', ''], ['NEGRO', 'B', 'black', 'red']].forEach(([t, k, f, cls]) => {
      const b = document.createElement('button'); b.className = 'tg ' + cls; b.innerHTML = t + `<small>${k}</small>`; b.id = 'tg-' + f; tgs.appendChild(b);
      btn(b, f, () => { FX[f] = FX[f] ? 0 : 1; b.classList.toggle('on', !!FX[f]); sendState(); });
    });
    // sistema
    const fs = $('#fxSys'); fs.style.setProperty('--acc', '#f2f0ea');
    knob(fs, 'av', 'SINCRO A/V', AFX.av / 250, (v) => { AFX.av = Math.round(v * 250); store.set('av', AFX.av); for (const k in DECK) play(DECK[k]); }, (v) => '+' + Math.round(v * 250) + 'ms');
    const qc = document.createElement('div'); qc.className = 'grp'; qc.innerHTML = '<span class="lbl" style="font-size:7.5px">CALIDAD</span><div class="seg" id="qual"><button data-v="0" title="Cada pieza a la resolución que el ordenador aguanta con fluidez">AUTO</button><button data-v="1">100</button><button data-v="0.75">75</button><button data-v="0.5">50</button></div>'; fs.appendChild(qc);
    $('#tg-ext').addEventListener('click', extCycle);
    const ob = $('#tg-ojo'); ob.classList.toggle('on', PRES.on);
    // clic: APAGADO → ATENCIÓN → DISTRACCIÓN → APAGADO
    ob.addEventListener('click', () => {
      const wasOn = PRES.on; PRES.mode = (PRES.mode + 1) % 3; store.set('ojoModo', PRES.mode); ob.classList.toggle('on', PRES.on);
      toast(!PRES.on ? 'OJO · APAGADO' : (wasOn ? '' : 'ENCENDIENDO LA CÁMARA · ') + 'OJO · ' + OJO_M[PRES.mode] + (PRES.mode === 1 ? ' · LE MIRA MIENTRAS ESTÉ' : ' · LE MIRA UN MOMENTO AL ENTRAR Y SIGUE A LO SUYO'));
      applyAFX(); sendState();
    });
    seg($('#qual'), 'qual', String(MIX.quality), (v) => { MIX.quality = +v; store.set('calidadAuto', +v); sendState(); });
    const markQ = seg($('#quant'), 'quant', quant, (v) => { quant = v; store.set('quant', v); });
    CTL.quant.mark = markQ;
  }
  // ---------------------------------------------------------------- inputs de código (todo apagado por defecto)
  const VLC = window.VLC = { send: (m) => ch.postMessage(m), mix: () => FX.cMix, compiled: (v) => (VLC._ok = v), isCompiled: () => !!VLC._ok };
  function buildCode() {
    const fp = $('#fxPiece'); fp.style.setProperty('--acc', '#f2f0ea');
    const x2 = (v) => (v * 2).toFixed(2) + '×';
    knob(fp, 'pBloom', 'BLOOM', 0.5, (v) => { FX.pBloom = Math.abs(v - 0.5) < 0.01 ? 1 : v * 2; sendState(); }, x2);
    knob(fp, 'pFlash', 'FLASH', 0.5, (v) => { FX.pFlash = Math.abs(v - 0.5) < 0.01 ? 1 : v * 2; sendState(); }, x2);
    knob(fp, 'pScan', 'LÍNEAS', 0.2, (v) => { FX.pScan = v; sendState(); }, (v) => Math.round(v * 100) + '%');
    const kc = $('#kC'); kc.style.setProperty('--acc', '#f2f0ea');
    knob(kc, 'cMix', 'MEZCLA C', 0, (v) => { FX.cMix = v; sendState(); if (v > 0 && !VLC.isCompiled()) toast('DECK C · ABRE EL EDITOR Y COMPILA UN CÓDIGO'); });
    btn($('#cEdit'), 'cEdit', () => VLC.openEditor && VLC.openEditor());
    btn($('#tg-view'), 'view', () => setFxToggle('view', FX.view ? 0 : 1));
    const kv = $('#kView'); kv.style.setProperty('--acc', '#f2f0ea');
    knob(kv, 'viewOp', 'OPACIDAD', FX.viewOp, (v) => { FX.viewOp = v; sendState(); });
    btn($('#apB'), 'autoplay', () => apToggle());
    seg($('#apLaps'), 'apLaps', String(AP.laps), (v) => { AP.laps = +v; store.set('apLaps', AP.laps); });
    seg($('#viewMode'), 'viewMode', FX.viewMode, (v) => { FX.viewMode = v; if (!FX.view) setFxToggle('view', 1); else sendState(); });
  }
  let lastBands = 0;
  const fbuf = new Uint8Array(1024);
  function sendBands() {
    if (!ctx || !(FX.cMix > 0 || FX.view) || performance.now() - lastBands < 33) return;
    lastBands = performance.now();
    M.fan.getByteFrequencyData(fbuf);
    const hz = ctx.sampleRate / M.fan.fftSize, band = (a, b) => { let s = 0, n = 0; for (let i = Math.max(1, Math.floor(a / hz)); i < Math.min(fbuf.length, Math.floor(b / hz)); i++) { s += fbuf[i]; n++; } return n ? Math.min(1, s / n / 255 * 1.5) : 0; };
    ch.postMessage({ type: 'bands', v: [band(20, 250), band(250, 3400), band(3400, 16000)] });
  }
  function setFxToggle(f, v) { FX[f] = v; const b = $('#tg-' + f); if (b) b.classList.toggle('on', !!v); sendState(); }

  // ================================================================== bucle de interfaz
  const tdata = new Float32Array(1024);
  function rms(an) { an.getFloatTimeDomainData(tdata.subarray(0, an.fftSize)); let s = 0; for (let i = 0; i < an.fftSize; i++) s += tdata[i] * tdata[i]; return Math.sqrt(s / an.fftSize); }
  // ---------------------------------------------------------------- AUTOPLAY: instalación desatendida
  // Recorre todas las piezas en orden aleatorio (sin repetir hasta agotar la bolsa) y pasa de una a otra
  // con AUTO. Pensado para dejarlo solo durante horas: se recupera si una pieza falla o se queda parada.
  const AP = { on: false, bag: [], laps: store.get('apLaps', 1), lap: 0, lastP: 0, stage: 0, next: null, since: 0, skip: new Set(store.get('apSkip', [])) };
  function apBagNext(exclude) {
    const ok = LIB.filter((it) => it.meta && it.buf && !AP.skip.has(it.id));
    if (!ok.length) return null;
    if (!AP.bag.length) AP.bag = ok.slice().sort(() => Math.random() - 0.5);
    let i = AP.bag.findIndex((it) => it !== exclude);
    if (i < 0) { AP.bag = ok.slice().sort(() => Math.random() - 0.5); i = AP.bag.findIndex((it) => it !== exclude); }
    return i < 0 ? ok[0] : AP.bag.splice(i, 1)[0];
  }
  function apClean(d) { if (!d.state) return; d.loop = false; d.stopped = false; d.slip = null; d.rev_ = false; clearTimeout(d.rampT); d.speed = 1; d.fSpeed && d.fSpeed.set(spdToV(1), true); }
  function apToggle(v) {
    AP.on = v == null ? !AP.on : v;
    $('#apB').classList.toggle('on', AP.on);
    if (AP.on) {
      const d = DECK[MIX.onAir];
      AP.stage = 0; AP.lap = 0; AP.next = null; AP.since = performance.now();
      if (!d.state || !d.item) { const it = apBagNext(null); if (it) load(MIX.onAir, it); }
      else { apClean(d); commit(d, { a: 0, b: end(d), x: X0, once: false, freeze: null, rate: 1 }); uiFlags(d); }
      wakeLock();
      ch.postMessage({ type: 'wake' });
      toast('AUTOPLAY · PIEZAS EN ORDEN ALEATORIO');
    } else { $('#apNext').textContent = '—'; toast('AUTOPLAY · APAGADO'); }
  }
  let wl = null;
  async function wakeLock() { try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => (wl = null)); } } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (AP.on && document.visibilityState === 'visible') wakeLock(); });
  function apTick() {
    if (!AP.on) return;
    const air = DECK[MIX.onAir], other = DECK[MIX.onAir === 'A' ? 'B' : 'A'];
    // pieza en el aire parada, terminada o sin cargar: pasar a la siguiente ya
    const P = air.state ? VLL.pos(air.state, now()) : null;
    if (!air.item || !P || P.ended || air.stopped || Math.abs(air.state.rate) < 0.01) {
      if (performance.now() - AP.since > 3000 && !autoAnim) { const it = apBagNext(air.item); if (it) { apClean(air); load(MIX.onAir, it); AP.since = performance.now(); AP.stage = 0; AP.lap = 0; } }
      return;
    }
    if (air.state.freeze != null || air.slip) return;               // alguien está tocando: esperar
    const p = P.p;
    if (p < AP.lastP - 1) AP.lap++;                                  // ha dado la vuelta
    AP.lastP = p;
    const remain = (end(air) - p) / Math.abs(air.state.rate), lastLap = AP.lap >= AP.laps - 1;
    if (AP.stage === 0 && lastLap && remain < autoDur + 4) {         // 1 · precargar la siguiente en el deck que no está en el aire
      const it = apBagNext(air.item); if (!it) return;
      AP.next = it; apClean(other); load(other.id, it); other.state && commit(other, { a: 0, b: end(other), x: X0, rate: 1 });
      $('#apNext').textContent = it.title; AP.stage = 1;
    } else if (AP.stage === 1 && remain < autoDur + 0.3) {           // 2 · arrancarla desde el principio y fundir
      if (other.state) commit(other, { pos: 0, a: 0, b: end(other), x: X0, once: false, freeze: null, rate: 1 });
      MIX.mode = Math.random() < 0.5 ? 'fundido' : 'congelar'; CTL.xmode && CTL.xmode.mark && CTL.xmode.mark(MIX.mode);
      if (!autoAnim) auto();
      AP.stage = 2;
    } else if (AP.stage === 2 && !autoAnim) {                        // 3 · transición hecha: empieza otra cuenta
      if (MIX.xf > 0.001 && MIX.xf < 0.999) setXf(MIX.xf < 0.5 ? 0 : 1);
      AP.stage = 0; AP.lap = 0; AP.lastP = 0; AP.since = performance.now();
      $('#apNext').textContent = '—';
    }
  }
  function tick() {
    requestAnimationFrame(tick);
    sendBands();
    for (const k in DECK) {
      const d = DECK[k]; if (!d.ui) continue;
      drawStrip(d);
      if (d.meta && d.state) {
        const P = VLL.pos(d.state, now()), p = P ? P.p : 0, ai = VLL.actAt(d.meta, p);
        d.ui.act.textContent = P && P.ended ? 'FIN' : d.meta.acts[ai][1];
        d.ui.time.textContent = tc(p) + ' / ' + tc(d.meta.duration) + '   ' + (d.state.ramp ? 'CINTA' : (Math.abs(d.state.rate) * (d.state.rate < 0 ? -1 : 1)).toFixed(2) + '×');
        [...d.ui.acts.children].forEach((b, i) => b.classList.toggle('cur', i === ai));
        d.el.classList.toggle('playing', !d.stopped);
      }
      const w = k === 'A' ? Math.cos(MIX.xf * Math.PI / 2) : Math.sin(MIX.xf * Math.PI / 2);
      d.el.classList.toggle('cue', !!d.item && w < 0.01);
      const q = d.queueUntil > now(); d.ui.q.classList.toggle('on', q); if (q) d.ui.q.textContent = 'EN COLA · ' + ((d.queueUntil - now()) / 1000).toFixed(1) + 's';
      if (ctx && d.aud) d.ui.meter.style.width = Math.min(100, rms(d.aud.an) * 260) + '%';
    }
    if (ctx) { $('#mL').style.width = Math.min(100, rms(M.aL) * 230) + '%'; $('#mR').style.width = Math.min(100, rms(M.aR) * 230) + '%'; }
    if (outOK && performance.now() - lastOutMsg > 2500) { outOK = false; $('#stOut').textContent = 'CERRADA'; $('#ledOut').className = 'led'; $('#monOv').classList.remove('off'); }
    $('#ledMon').className = 'led' + (outOK ? ' on' : '');
    $('#monTag').textContent = outOK ? 'MONITOR · SALIDA EN DIRECTO' : 'MONITOR';
  }

  // ================================================================== teclado
  const HOLD = new Set();
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if ($('#help').classList.contains('on') && e.key !== '?') { $('#help').classList.remove('on'); return; }
    const d = DECK[focus], k = e.code;
    if (e.repeat && !['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); return; }
    if (e.shiftKey && /^Digit[1-9]$/.test(k)) { const it = LIB[+k.slice(5) - 1]; if (it) load(MIX.onAir === 'A' ? 'B' : 'A', it); e.preventDefault(); return; }
    if (/^Digit[1-8]$/.test(k)) { jumpAct(d, +k.slice(5) - 1); return; }
    switch (k) {
      case 'Tab': setFocus(focus === 'A' ? 'B' : 'A'); break;
      case 'KeyL': toggleLoop(d); break;
      case 'BracketLeft': resizeLoop(d, 0.5); break;
      case 'BracketRight': resizeLoop(d, 2); break;
      case 'KeyG': firma(d); break;
      case 'KeyY': sync(d); break;
      case 'KeyS': HOLD.add(k); stutter(d, true); break;
      case 'KeyF': freeze(d); break;
      case 'KeyR': HOLD.add(k); reverse(d, true); break;
      case 'KeyT': tape(d); break;
      case 'KeyZ': case 'KeyX': case 'KeyC': { const i = { KeyZ: 0, KeyX: 1, KeyC: 2 }[k]; d.kill[i] ^= 1; d['kb' + i] && d['kb' + i].classList.toggle('on', !!d.kill[i]); applyDeckAudio(d); break; }
      case 'Space': cut(); break;
      case 'ArrowLeft': manualXf(MIX.xf - 0.04); break;
      case 'ArrowRight': manualXf(MIX.xf + 0.04); break;
      case 'KeyA': if (e.shiftKey) auto(); else return; break;   // AUTO solo con ⇧A: una A suelta no mueve el crossfader
      case 'KeyQ': CTL.quant.press(); toast('CUANTIZAR · ' + quant.toUpperCase()); break;
      case 'KeyI': setFxToggle('invert', FX.invert ? 0 : 1); break;
      case 'KeyV': setFxToggle('glitch', FX.glitch ? 0 : 1); break;
      case 'KeyB': setFxToggle('black', FX.black ? 0 : 1); break;
      case 'KeyO': setFxToggle('strobe', FX.strobe ? 0 : 1); break;
      case 'KeyP': apToggle(); break;
      case 'KeyK': if (e.shiftKey) { CTL.viewMode.press(); toast('VER CÓDIGO · ' + ({ full: 'PANTALLA', win: 'VENTANA', alt: 'ALTERNAR', maq: 'MÁQUINA' }[FX.viewMode] || FX.viewMode)); } else setFxToggle('view', FX.view ? 0 : 1); break;
      case 'Backquote': VLC.openEditor && VLC.openEditor(); break;
      case 'KeyE': CTL.mirror.press(); toast('ESPEJO · ' + ['OFF', 'HORIZONTAL', 'CUADRANTES', 'CALEIDOSCOPIO'][FX.mirror]); break;
      case 'Escape': if (VLC.isOpen && VLC.isOpen()) VLC.closeEditor(); else if (learn) toggleLearn(); break;
      default: if (e.key === '?') { $('#help').classList.toggle('on'); break; } return;
    }
    e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    const d = DECK[focus];
    if (e.code === 'KeyS' && HOLD.delete('KeyS')) { for (const k in DECK) if (DECK[k].slip) stutter(DECK[k], false); }
    if (e.code === 'KeyR' && HOLD.delete('KeyR')) { for (const k in DECK) if (DECK[k].rev_) reverse(DECK[k], false); }
  });

  // ================================================================== MIDI
  let learn = false, armed = null, MAP = store.get('midi', {});
  function toggleLearn() {
    learn = !learn; armed = null; document.body.classList.toggle('learn', learn); $('#learn').classList.toggle('on', learn);
    document.querySelectorAll('[data-ctl].armed').forEach((x) => x.classList.remove('armed'));
    toast(learn ? 'MIDI · TOCA UN CONTROL DE LA CONSOLA Y LUEGO MUEVE EL DEL CONTROLADOR' : 'MIDI · GUARDADO');
  }
  function learnArm(id) {
    if (!learn) return false;
    document.querySelectorAll('[data-ctl].armed').forEach((x) => x.classList.remove('armed'));
    armed = id; CTL[id] && CTL[id].el.classList.add('armed'); return true;
  }
  function onMidi(e) {
    if (e.data[0] >= 0xf8) { extClock(e.data[0], e.timeStamp); return; }   // reloj MIDI (TR-09…)
    const [st, n, v] = e.data, type = st & 0xf0, chn = st & 0x0f;
    if (type !== 0x90 && type !== 0x80 && type !== 0xb0) return;
    const key = (type === 0xb0 ? 'cc' : 'nt') + chn + ':' + n;
    if (learn && armed) {
      if (type === 0x80 || (type === 0x90 && v === 0)) return;
      for (const k in MAP) if (MAP[k] === armed) delete MAP[k];
      MAP[key] = armed; store.set('midi', MAP);
      CTL[armed].el.classList.remove('armed'); CTL[armed].el.classList.add('mapped');
      toast('MIDI · ' + key.toUpperCase() + ' → ' + armed.toUpperCase()); armed = null; return;
    }
    const c = CTL[MAP[key]];
    if (!c) { if (isDDJ(e.target)) ddj(st, n, v); return; }   // lo aprendido a mano manda sobre el mapeo por defecto
    const down = type === 0x90 ? v > 0 : type === 0xb0 ? v > 63 : false;
    if (c.kind === 'cc') { if (type === 0xb0) soft(MAP[key], v / 127); return; }
    else if (c.kind === 'hold') { if (down) c.press(); else c.release(); }
    else if (down) c.press();
  }
  // ---------------------------------------------------------------- recogida suave
  // Si un control se movió desde la pantalla (o lo movió AUTO o un CORTE), el físico no lo arrastra de golpe:
  // primero tiene que llegar a donde está el de la pantalla (o cruzarlo). Así nada «vuelve solo».
  const hwPos = {};
  function soft(id, x) {
    const c = CTL[id]; if (!c) return;
    const prev = hwPos[id]; hwPos[id] = x;
    if (id === 'xf') markHw(x);
    if (!c.get) return c.set(x);
    const cur = c.get();
    if (Math.abs(x - cur) < 0.06 || (prev != null && (prev - cur) * (x - cur) <= 0)) c.set(x);
  }
  function markHw(x) {
    const m = $('#xfHw'); if (!m) return;
    m.style.left = x * 100 + '%'; m.classList.toggle('on', Math.abs(x - MIX.xf) > 0.06);
  }

  // ---------------------------------------------------------------- Pioneer DDJ-200: mapeo por defecto
  // Mensajes según el mapeo publicado del DDJ-200 (Mixxx). Decks: canal 1 = A, canal 2 = B; pads en modo hot cue.
  let ddjOut = null;
  const ddjLed = {};
  const isDDJ = (port) => !!port && /DDJ-?200/i.test(port.name || '');
  function scrub(d, secs) {
    if (!d.state || !d.meta) return;
    d.scrubAcc = (d.scrubAcc || 0) + secs;
    if (d.scrubT) return;
    d.scrubT = setTimeout(() => {
      d.scrubT = null; const s = d.state, acc = d.scrubAcc; d.scrubAcc = 0;
      if (!s) return;
      const p = VLL.clamp(curPos(d) + acc, s.a, s.b - 0.02);
      commit(d, { pos: p, freeze: s.freeze != null ? p : null });
    }, 40);
  }
  function ddj(st, n, v) {
    const type = st & 0xf0, ch = st & 0x0f, on = type === 0x90 && v > 0, off = type === 0x80 || (type === 0x90 && v === 0);
    const set = (id, x) => soft(id, VLL.clamp(x, 0, 1));
    if (type === 0xb0) {
      if (ch === 6) {
        if (n === 0x1f) return set('xf', v / 127);                       // crossfader
        if (n === 0x17) return set('filter', v / 127);                   // CFX A → filtro (centro = apagado)
        if (n === 0x18) { const x = (v - 64) / 63; set('trail', x < -0.04 ? -x : 0); set('scan', x > 0.04 ? x : 0); return; } // CFX B → estela ← · → escaneo
        return;
      }
      const id = ch === 0 ? 'A' : ch === 1 ? 'B' : null, d = DECK[id]; if (!d) return;
      if (n === 0x07) return set(id + '.eq2', v / 127);                  // HI → agudos
      if (n === 0x0b) return set(id + '.eq1', v / 127);                  // MID → medios
      if (n === 0x0f) return set(id + '.eq0', v / 127);                  // LOW → graves
      if (n === 0x13) return set(id + '.vol', v / 127 / 1.2);            // fader de canal → volumen
      if (n === 0x00) return set(id + '.speed', Math.abs(v - 64) <= 2 ? 0.5 : v / 127); // tempo → velocidad (abajo = más rápido)
      if (n === 0x21) return scrub(d, (v - 64) / 120);                   // jog por el borde: empuje fino
      if (n === 0x22) return scrub(d, (v - 64) / 60);                    // jog tocado por arriba: scratch
      if (n === 0x29) return scrub(d, (v - 64) * 0.2);                   // SHIFT + jog: búsqueda rápida
      return;
    }
    if (ch === 6) {
      if (!on) return;
      if (n === 0x63) setFxToggle('view', FX.view ? 0 : 1);              // botón de auriculares master → VER EL CÓDIGO
      else if (n === 0x78) setFxToggle('black', FX.black ? 0 : 1);       // + SHIFT → NEGRO
      // 0x59 / 0x5A (botones sin identificar en el aparato real) ya no mueven el crossfader
      return;
    }
    if (ch >= 7 && ch <= 10) {                                            // pads
      const id = ch <= 8 ? 'A' : 'B', shifted = ch === 8 || ch === 10, d = DECK[id];
      if (n > 7) return;
      if (!shifted) { if (on) { setFocus(id); jumpAct(d, n); } return; }
      const holds = { 0: (x) => stutter(d, x), 2: (x) => reverse(d, x) };
      if (holds[n]) { if (on) holds[n](true); else if (off) holds[n](false); return; }
      if (!on) return;
      [null, () => freeze(d), null, () => tape(d), () => toggleLoop(d), () => resizeLoop(d, 0.5), () => resizeLoop(d, 2), () => firma(d)][n]();
      return;
    }
    const id = ch === 0 ? 'A' : ch === 1 ? 'B' : null, d = DECK[id]; if (!d) return;
    if (n === 0x3f || !on) return;                                        // SHIFT lo resuelve el propio controlador
    switch (n) {
      case 0x0b: tape(d); break;                                          // PLAY → cinta (frenar / arrancar)
      case 0x0c: jumpAct(d, 0); break;                                    // CUE → primer acto
      case 0x47: freeze(d); break;                                        // SHIFT + PLAY → congelar
      case 0x48: firma(d); break;                                         // SHIFT + CUE → FIRMA
      case 0x58: sync(d); break;                                          // BEAT SYNC → tempo y compás del otro deck
      case 0x60: toggleLoop(d); break;                                    // SHIFT + SYNC → loop del acto
      case 0x54: setFocus(id); break;                                     // auriculares del canal → foco
      case 0x68: resizeLoop(d, 2); break;                                 // SHIFT + auriculares → loop ×2
    }
  }
  // luces del controlador: PLAY, SYNC (loop), auriculares (foco) y pads de los actos que existen
  let ddjT = 0;
  function ddjLeds() {
    if (!ddjOut || performance.now() - ddjT < 150) return; ddjT = performance.now();
    const send = (st, n, on) => { const k = st + ':' + n, v = on ? 0x7f : 0; if (ddjLed[k] === v) return; ddjLed[k] = v; try { ddjOut.send([st, n, v]); } catch (e) {} };
    ['A', 'B'].forEach((id, i) => {
      const d = DECK[id], st = 0x90 + i, pad = 0x97 + i * 2;
      send(st, 0x0b, !!d.state && !d.stopped);
      send(st, 0x58, !!d.loop);
      send(st, 0x54, focus === id);
      const nActs = d.meta ? d.meta.acts.length : 0, cur = d.meta && d.state ? VLL.actAt(d.meta, curPos(d)) : -1;
      for (let p = 0; p < 8; p++) send(pad, p, p < nActs && (p !== cur || (performance.now() % 600) < 300));
    });
  }
  async function initMidi() {
    if (!navigator.requestMIDIAccess) { $('#stMidi').textContent = 'NO DISPONIBLE'; return; }
    try {
      const acc = await navigator.requestMIDIAccess();
      const bind = () => {
        let n = 0, name = '', ddjIn = false;
        acc.inputs.forEach((i) => { i.onmidimessage = onMidi; n++; name = name || i.name; if (isDDJ(i)) ddjIn = true; });
        ddjOut = null; acc.outputs.forEach((o) => { if (isDDJ(o)) ddjOut = o; });
        Object.keys(ddjLed).forEach((k) => delete ddjLed[k]);
        $('#stMidi').textContent = ddjIn ? 'DDJ-200 · MAPEO LISTO' : n ? name.toUpperCase().slice(0, 22) : 'SIN CONTROLADOR';
        $('#ledMidi').className = 'led' + (n ? ' on' : '');
        if (ddjIn) toast('PIONEER DDJ-200 CONECTADO · MAPEO POR DEFECTO');
      };
      acc.onstatechange = bind; bind();
    } catch (e) { $('#stMidi').textContent = 'SIN PERMISO'; }
  }

  // ================================================================== arranque
  mkDeck('A'); mkDeck('B'); setFocus('A'); buildCenter(); buildCode();
  $('#openOut').addEventListener('click', openOutput); $('#openOut2').addEventListener('click', openOutput);
  $('#learn').addEventListener('click', toggleLearn);
  $('#helpB').addEventListener('click', () => $('#help').classList.toggle('on'));
  $('#help').addEventListener('click', () => $('#help').classList.remove('on'));
  ch.postMessage({ type: 'ping' });

  $('#go').addEventListener('click', async () => {
    const go = $('#go'); go.disabled = true;
    const log = (t) => ($('#bootlog').textContent = t);
    const bar = (k) => ($('#bootbar').style.width = (k * 100).toFixed(0) + '%');
    if (!outOK) openOutput();
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    M = buildMaster(); applyAFX();
    for (const k in DECK) { buildDeckAudio(DECK[k]); applyDeckAudio(DECK[k]); }
    applyXfAudio();
    $('#stAud').textContent = (ctx.sampleRate / 1000).toFixed(1) + ' kHz'; $('#ledAud').className = 'led on';
    setInterval(schedTick, 40);
    // con audio sonando, Chrome no frena los temporizadores de la pestaña aunque quede detrás de la salida
    setInterval(() => { autoStep(); apTick(); presTick(); extFollow(); extLabel(); flush(); ddjLeds(); }, 30);
    initMidi();
    log('BUSCANDO PIEZAS VØID_LOOM…');
    let items = [];
    try { items = await discover(log); } catch (e) { log('NO SE PUDO LEER LA BIBLIOTECA · ¿SERVIDOR LOCAL?'); go.disabled = false; return; }
    LIB.push(...items); renderLib();
    let done = 0;
    const total = items.length * 2;
    const step = () => { done++; bar(done / total); };
    // audio en paralelo, metadatos de dos en dos
    const audioJobs = items.map(async (it) => {
      try {
        const ab = await fetch(it.audio).then((r) => r.arrayBuffer());
        const buf = await ctx.decodeAudioData(ab);
        const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
        for (let c = 0; c < buf.numberOfChannels; c++) { const s = buf.getChannelData(c), r = rev.getChannelData(c), n = s.length; for (let i = 0; i < n; i++) r[i] = s[n - 1 - i]; }
        it.buf = buf; it.rev = rev; it.hits = onsets(buf);
      } catch (e) { libStatus(it, 'SIN AUDIO'); }
      step();
    });
    const queue = items.slice();
    const metaJobs = [0, 1].map(async () => {
      while (queue.length) {
        const it = queue.shift(); log('LEYENDO ' + it.title + '…');
        const cached = store.get('meta:' + it.id, null);
        const m = await probe(it);
        it.meta = m || cached;
        if (m) store.set('meta:' + it.id, m);
        step();
        libStatus(it, it.meta ? it.meta.acts.length + ' ACTOS' : 'ERROR');
      }
    });
    await Promise.all([...audioJobs, ...metaJobs]);
    LIB.forEach((it) => {
      if (it.meta && !it.buf) libStatus(it, 'SIN AUDIO');
      if (it.meta && it.meta.live && Array.isArray(it.meta.live.hits)) it.hits = it.meta.live.hits;   // golpes exactos de la partitura
    });
    const ok = LIB.filter((it) => it.meta && it.buf);
    log('LISTO · ' + ok.length + ' PIEZAS');
    for (const it of LIB) if (it.hits) ch.postMessage({ type: 'hits', piece: it.id, hits: it.hits });
    if (ok[0]) load('A', ok[ok.length - 1]);
    if (ok[1]) load('B', ok[ok.length - 2]);
    setTimeout(() => $('#boot').classList.add('off'), 400);
    requestAnimationFrame(tick);
    if (INSTALL) setTimeout(() => apToggle(true), 1500);
  });
  // ?instalacion · arranca solo y entra en AUTOPLAY (la app de escritorio lo usa en modo instalación).
  // En un navegador sin gesto previo el audio queda en pausa hasta el primer clic.
  const INSTALL = new URLSearchParams(location.search).has('instalacion');
  if (INSTALL) {
    $('#go').click();
    const resume = () => ctx && ctx.state === 'suspended' && ctx.resume();
    document.addEventListener('pointerdown', resume); document.addEventListener('keydown', resume);
  }
})();
