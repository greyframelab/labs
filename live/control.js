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
  const MIX = { xf: 0, mode: 'fundido', onAir: 'A', quality: store.get('quality', 1) };
  const FX = { trail: 0, hits: 0.35, split: 0, invert: 0, black: 0, bright: 1, glitch: 0, punch: 0, lens: 0, mosaic: 0, tint: 0, scan: 0, mirror: 0, strobe: 0, tintC: '#ffffff' };
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
        out.push({ id: dir.replace(/\/$/, ''), n: +n, title: title.toUpperCase(), dir: '../' + dir, src: '../' + dir + 'index.html',
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
    M.eS.gain.setTargetAtTime(AFX.echo * 0.8, t, 0.03);
    M.dl.delayTime.setTargetAtTime(AFX.echoT, t, 0.08); M.dr.delayTime.setTargetAtTime(AFX.echoT, t, 0.08);
    M.rS.gain.setTargetAtTime(AFX.room * 0.9, t, 0.03);
    M.out.gain.setTargetAtTime(AFX.master, t, 0.02);
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
    a.sum.connect(a.vol).connect(a.xf).connect(M.in); a.xf.connect(a.an);
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
    else { DECK.A.aud.xf.gain.setTargetAtTime(ga, t, 0.012); DECK.B.aud.xf.gain.setTargetAtTime(gb, t, 0.012); }
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
      while (sc.wrapW < horizon) {
        const t = wallToCtx(sc.wrapW), s = sc.s;
        if (sc.fwd) {
          const fade = Math.max(0.006, sc.x / sc.r);
          const nv = voice(d, d.buf, s.a, t, sc.r, fade, sc.x > 0.02);
          vOut(sc.cur, t, fade, sc.x > 0.02);
          sc.cur = nv; sc.wrapW += Math.max(0.02, (s.b - s.a - sc.x) / sc.r) * 1000;
        } else {
          const nv = voice(d, d.rev, d.buf.duration - s.b, t, sc.r, 0.006, false);
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
  function setSpeed(d, v) {
    d.speed = v;
    if (d.state && !d.stopped && d.state.freeze == null && !d.slip) commit(d, { rate: signedRate(d) });
  }

  // ---------------------------------------------------------------- mezcla
  function setXf(v, at) {
    MIX.xf = VLL.clamp(v, 0, 1);
    if (MIX.xf <= 0.001) MIX.onAir = 'A'; else if (MIX.xf >= 0.999) MIX.onAir = 'B';
    applyXfAudio(at); sendState(); uiMix();
  }
  let cutPending = null;
  function cut() {
    if (cutPending) return;
    const target = MIX.onAir === 'A' ? 1 : 0;
    const wall = qWall(DECK[MIX.onAir]);
    cutPending = wall; $('#cut').classList.add('q');
    applyXfAudioAt(target, wall);
    setTimeout(() => {
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
  function auto() {
    if (autoAnim) { cancelAnimationFrame(autoAnim.raf); autoAnim = null; $('#autoB').classList.remove('on'); return; }
    const from = MIX.xf, to = MIX.onAir === 'A' ? 1 : 0, t0 = performance.now();
    $('#autoB').classList.add('on');
    const step = () => {
      const k = VLL.clamp((performance.now() - t0) / (autoDur * 1000), 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setXf(from + (to - from) * e);
      if (k < 1) autoAnim.raf = requestAnimationFrame(step); else { autoAnim = null; $('#autoB').classList.remove('on'); }
    };
    autoAnim = { raf: requestAnimationFrame(step) };
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
    ch.postMessage({ type: 'state', decks, mix: MIX, fx: FX });
  }
  ch.onmessage = (ev) => {
    const m = ev.data; lastOutMsg = performance.now();
    if (m.type === 'hello') {
      outOK = true;
      for (const it of LIB) if (it.hits) ch.postMessage({ type: 'hits', piece: it.id, hits: it.hits });
      dirty = true; flush();
    } else if (m.type === 'stats') {
      outOK = true; $('#stOut').textContent = m.fps + ' FPS · ' + m.w + '×' + m.h;
      $('#ledOut').className = 'led ' + (m.fps >= 50 ? 'on' : m.fps >= 30 ? 'warn' : 'err');
    } else if (m.type === 'ready') { const d = DECK[m.deck]; if (d && d.item && d.item.id === m.piece) { d.ready = true; renderDeckState(d); } }
    else if (m.type === 'loading') { const d = DECK[m.deck]; if (d) { d.ready = false; renderDeckState(d); } }
    else if (m.type === 'preview') drawPreview(m.bmp);
    else if (m.type === 'dprev') drawDeckPrev(DECK[m.deck], m.bmp);
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
    reg(id, el, { kind: 'cc', set: (x) => set(x) });
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
    reg(id, tr, { kind: 'cc', set: (x) => set(x) });
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
      <div class="d-head"><span class="d-id">${id}</span><div class="d-title"><b>${it ? it.title : 'VACÍO'}</b><span>${it ? 'LAB ' + String(it.n).padStart(2, '0') + ' · ' + d.meta.duration.toFixed(1).replace('.', ',') + ' S · ' + d.meta.acts.length + ' ACTOS' : 'CARGA UNA PIEZA DESDE LA BIBLIOTECA'}</span></div><span class="d-state">—</span></div>
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
    [['LOOP', 'L', 'loop', () => toggleLoop(d)], ['/2', '[', 'half', () => resizeLoop(d, 0.5)], ['×2', ']', 'dbl', () => resizeLoop(d, 2)], ['FIRMA', 'G', 'firma', () => firma(d)],
     ['STUTTER', 'S', 'stut', () => stutter(d, true), () => stutter(d, false)], ['CONGELAR', 'F', 'frz', () => freeze(d)],
     ['REVERSA', 'R', 'rev', () => reverse(d, true), () => reverse(d, false)], ['CINTA', 'T', 'tape', () => tape(d)]]
      .forEach(([t, k, f, p, r]) => { const b = document.createElement('button'); b.className = 'pb'; b.dataset.f = f; b.innerHTML = t + `<small>${k}</small>`; perf.appendChild(b); btn(b, `${id}.${f}`, p, r); });
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
      el.innerHTML = `<img src="${it.thumb}" alt="" loading="lazy"><div class="nm"><b>${it.title}</b><span>${String(it.n).padStart(2, '0')} · <em style="font-style:normal" class="st">CARGANDO</em></span></div><div class="ld"><button data-d="A" aria-label="Cargar en A">A</button><button data-d="B" aria-label="Cargar en B">B</button></div>`;
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => load(b.dataset.d, it)));
      host.appendChild(el);
    });
    $('#libN').textContent = LIB.length + ' PIEZAS';
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
    xf.insertAdjacentHTML('beforeend', [0, 0.25, 0.5, 0.75, 1].map((t) => `<div class="tk" style="left:${t * 100}%"></div>`).join('') + '<div class="th"></div>');
    let drag = false;
    const at = (e) => { const r = xf.getBoundingClientRect(); setXf((e.clientX - r.left) / r.width); };
    xf.addEventListener('pointerdown', (e) => { if (learnArm('xf')) return; drag = true; xf.setPointerCapture(e.pointerId); at(e); });
    xf.addEventListener('pointermove', (e) => drag && at(e)); xf.addEventListener('pointerup', () => (drag = false));
    reg('xf', xf, { kind: 'cc', set: (v) => setXf(v) });
    seg($('#xmode'), 'xmode', MIX.mode, (v) => { MIX.mode = v; sendState(); });
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
    const qc = document.createElement('div'); qc.className = 'grp'; qc.innerHTML = '<span class="lbl" style="font-size:7.5px">CALIDAD</span><div class="seg" id="qual"><button data-v="1">100</button><button data-v="0.75">75</button><button data-v="0.5">50</button></div>'; fs.appendChild(qc);
    seg($('#qual'), 'qual', String(MIX.quality), (v) => { MIX.quality = +v; store.set('quality', +v); sendState(); });
    const markQ = seg($('#quant'), 'quant', quant, (v) => { quant = v; store.set('quant', v); });
    CTL.quant.mark = markQ;
  }
  function setFxToggle(f, v) { FX[f] = v; const b = $('#tg-' + f); if (b) b.classList.toggle('on', !!v); sendState(); }

  // ================================================================== bucle de interfaz
  const tdata = new Float32Array(1024);
  function rms(an) { an.getFloatTimeDomainData(tdata.subarray(0, an.fftSize)); let s = 0; for (let i = 0; i < an.fftSize; i++) s += tdata[i] * tdata[i]; return Math.sqrt(s / an.fftSize); }
  function tick() {
    requestAnimationFrame(tick);
    flush();
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
      case 'KeyS': HOLD.add(k); stutter(d, true); break;
      case 'KeyF': freeze(d); break;
      case 'KeyR': HOLD.add(k); reverse(d, true); break;
      case 'KeyT': tape(d); break;
      case 'KeyZ': case 'KeyX': case 'KeyC': { const i = { KeyZ: 0, KeyX: 1, KeyC: 2 }[k]; d.kill[i] ^= 1; d['kb' + i] && d['kb' + i].classList.toggle('on', !!d.kill[i]); applyDeckAudio(d); break; }
      case 'Space': cut(); break;
      case 'ArrowLeft': setXf(MIX.xf - 0.04); break;
      case 'ArrowRight': setXf(MIX.xf + 0.04); break;
      case 'KeyA': auto(); break;
      case 'KeyQ': CTL.quant.press(); toast('CUANTIZAR · ' + quant.toUpperCase()); break;
      case 'KeyI': setFxToggle('invert', FX.invert ? 0 : 1); break;
      case 'KeyV': setFxToggle('glitch', FX.glitch ? 0 : 1); break;
      case 'KeyB': setFxToggle('black', FX.black ? 0 : 1); break;
      case 'KeyO': setFxToggle('strobe', FX.strobe ? 0 : 1); break;
      case 'KeyE': CTL.mirror.press(); toast('ESPEJO · ' + ['OFF', 'HORIZONTAL', 'CUADRANTES', 'CALEIDOSCOPIO'][FX.mirror]); break;
      case 'Escape': if (learn) toggleLearn(); break;
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
    const c = CTL[MAP[key]]; if (!c) return;
    const down = type === 0x90 ? v > 0 : type === 0xb0 ? v > 63 : false;
    if (c.kind === 'cc') { if (type === 0xb0) c.set(v / 127); else if (down) c.set(c.get ? 0 : 1); }
    else if (c.kind === 'hold') { if (down) c.press(); else c.release(); }
    else if (down) c.press();
  }
  async function initMidi() {
    if (!navigator.requestMIDIAccess) { $('#stMidi').textContent = 'NO DISPONIBLE'; return; }
    try {
      const acc = await navigator.requestMIDIAccess();
      const bind = () => { let n = 0, name = ''; acc.inputs.forEach((i) => { i.onmidimessage = onMidi; n++; name = name || i.name; });
        $('#stMidi').textContent = n ? name.toUpperCase().slice(0, 22) : 'SIN CONTROLADOR'; $('#ledMidi').className = 'led' + (n ? ' on' : ''); };
      acc.onstatechange = bind; bind();
    } catch (e) { $('#stMidi').textContent = 'SIN PERMISO'; }
  }

  // ================================================================== arranque
  mkDeck('A'); mkDeck('B'); setFocus('A'); buildCenter();
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
  });
})();
