/* VØID_LOOM · SEMILLA — consola, modos de sala y reloj común.
   AUTOMÁTICO: las piezas nacen solas. PÚBLICO: la sala dice una palabra y la pieza nace de ella (voz.js).
   MANUAL: semilla y mandos a mano. El reloj es el del audio: imagen y sonido leen la misma partitura. */
(function () {
  'use strict';
  const SM = window.SEMILLA, $ = (id) => document.getElementById(id);
  const FIRMA = false; // de momento la pieza va sin firma (el código queda listo para recuperarla)
  const Q = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('semilla.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('semilla.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  const cfg = Object.assign({ mode: window.SemillaVoz && window.SemillaVoz.isApp ? 'publico' : 'auto', loops: 3, sig: 30, vol: 70, bri: 100, safe: true, sound: true, accent: 'auto', den: 0.5, cha: 0.5 }, store.get('cfg', {}));
  if (Q.get('modo')) cfg.mode = { automatico: 'auto', auto: 'auto', publico: 'publico', manual: 'manual' }[Q.get('modo')] || cfg.mode;
  const saveCfg = () => store.set('cfg', cfg);

  let ctx, snd, eng, stingC, stingX;
  let cur = null, prev = null, history = [], hIdx = -1;
  let firma = null, black = 0, blackT = 0, lastSig = 0, recording = null, shotReq = false, wordFx = null;

  // ---------- tiempo ----------
  const now = () => ctx.currentTime;
  // RELOJ SUAVE: el reloj del audio avanza a saltos (bloques de 10–40 ms); la imagen usa el reloj del sistema,
  // enganchado al del audio con un seguimiento lento. Así el movimiento es continuo y sigue a tiempo con el sonido.
  let clkOff = null, clkAt = -1;
  const heard = () => {
    const p = performance.now() / 1000;
    if (p !== clkAt) {
      clkAt = p;
      const a = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0), off = a - p;
      if (clkOff === null || Math.abs(off - clkOff) > 0.25) clkOff = off; else clkOff += (off - clkOff) * 0.015;
    }
    return p + clkOff;
  };
  const pieceT = (s, t = heard()) => t - s.t0;

  // ---------- registro ----------
  const log = store.get('registro', []);
  function logBirth(P, how) {
    log.unshift({ c: P.code, sp: P.sp.name, acc: P.accentKey, modo: how, t: new Date().toISOString() });
    if (log.length > 5000) log.length = 5000;
    store.set('registro', log); renderLog();
  }

  // ---------- piezas ----------
  function opts() { return { density: cfg.den, chaos: cfg.cha, accent: cfg.mode === 'manual' ? cfg.accent : 'auto' }; }
  function nextCode(avoid) {
    for (let i = 0; i < 24; i++) {
      const c = SM.newCode(), P = SM.generate(c, opts());
      if (!avoid || (P.sp.id !== avoid.sp.id && P.refId !== avoid.refId)) return c;
    }
    return SM.newCode();
  }
  function start(code, how, xf = 2.5, o = opts(), atT = 0) {
    const P = SM.generate(code, o);
    const t0 = now() + 0.1 - atT;
    const v = snd.piece(P, t0, 1);
    if (cur) { prev = cur; prev.fadeAt = now(); prev.fadeDur = xf; prev.voice.fadeOut(now() + 0.05, xf); }
    cur = { P, t0, voice: v, born: now(), loopsDone: 0, how, force: o.force, opts: o };
    if (how !== 'historial') { history = history.slice(0, hIdx + 1); history.push(code); if (history.length > 200) history.shift(); hIdx = history.length - 1; }
    if (how !== 'ruptura') logBirth(P, how);
    paintPiece();
    return cur;
  }
  // mismos golpes, otros mandos (densidad, caos, acento): cambia en el siguiente evento sin cortar
  function regen(o) {
    if (!cur) return;
    const P = SM.generate(cur.P.code, Object.assign({}, o, cur.force ? { force: cur.force } : {}));
    cur.P = P; cur.voice.P = P; cur.opts = Object.assign({}, o, cur.force ? { force: cur.force } : {}); paintPiece();
  }

  // ---------- SALIDA: la obra en su propia ventana (proyector); la consola sigue con todos los controles ----------
  // La salida dibuja la misma pieza en el mismo instante: recibe semilla, mandos y tiempo de cada pieza en cada frame.
  const salCh = new BroadcastChannel('semilla-salida');
  let salWin = null, salSeen = 0;
  salCh.onmessage = (e) => { if (e.data && e.data.type === 'vivo') salSeen = Date.now(); };
  const salidaOn = () => Date.now() - salSeen < 2500;
  function salidaSend(slots, t, look) {
    if (!salidaOn()) return;
    salCh.postMessage({
      type: 'frame', at: performance.timeOrigin + performance.now(), safe: cfg.safe,
      slots: slots.map((x) => ({ code: x.s.P.code, o: x.s.opts, t: Math.max(0, pieceT(x.s, t)), w: x.w })),
      look, word: wordFx ? { w: wordFx.w, t: now() - wordFx.at, acc: cur.P.accent } : null,
    });
  }
  function salida() {
    if (salWin && !salWin.closed) { salWin.close(); salWin = null; salSeen = 0; return; }
    salWin = window.open('salida.html', 'semilla-salida', 'popup,width=1280,height=720');
  }

  // ---------- frame ----------
  let lastFrame = 0, errors = 0, pacer = null, previewN = 0, lastShot = '';
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = eng.canvas.getBoundingClientRect();
    eng.resize(r.width * dpr, r.height * dpr, eng.scale);
  }
  function envOf(s, t) {
    let pt = pieceT(s, t);
    if (pt < 0) pt = 0;
    const e = SM.env(s.P, pt);
    if (cfg.safe) { e.kick *= 0.6; e.impact *= 0.7; e.metal = Math.min(e.metal, 1.1); }
    return e;
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    try {
      const dt = Math.min(0.1, (ts - lastFrame) / 1000 || 0.016); lastFrame = ts;
      snd.tick();
      if (!cur) return;
      const t = heard();
      logic(t, dt);
      size();
      if (salidaOn() && eng.scale > 0.5) eng.resize(eng.size[0], eng.size[1], 0.5);   // vista previa ligera mientras proyecta la salida
      const slots = [];
      let wCur = 1;
      if (prev) {
        const x = Math.min(1, (now() - prev.fadeAt) / prev.fadeDur);
        const k = x * x * (3 - 2 * x);
        slots.push({ P: prev.P, e: envOf(prev, t), w: 1 - k, s: prev }); wCur = k;
        if (x >= 1) prev = null;
      }
      slots.push({ P: cur.P, e: envOf(cur, t), w: wCur, s: cur });
      // corte de plano o pieza nueva: el único momento en que puede cambiar la resolución sin que se note
      const sh = cur.code + ':' + SM.shotAt(cur.P, slots[slots.length - 1].e.u / cur.P.bar).i;
      pacer.cut(sh !== lastShot, dt); lastShot = sh;
      // firma: la pieza se apaga y entra el sting
      let fade = cfg.bri / 100, stingA = 0;
      if (firma) {
        const lt = now() - firma.at;
        fade *= lt < 0 ? 1 : Math.max(0, 1 - lt / 0.6);
        const st = lt - 0.6;
        if (st >= 0 && st < VL.STING_DUR) {
          stingX.setTransform(1, 0, 0, 1, 0, 0); stingX.clearRect(0, 0, stingC.width, stingC.height);
          stingX.globalCompositeOperation = 'lighter';
          VL.drawSting(stingX, st, { accent: cur.P.accent }); stingA = 1;
        } else if (st >= VL.STING_DUR) { firmaEnd(); }
        if (firma && st > VL.STING_DUR - 0.8) fade = cfg.bri / 100 * Math.min(1, (st - (VL.STING_DUR - 0.8)) / 0.8);
      }
      if (wordFx && !firma) { const wa = drawWord(now() - wordFx.at); if (wa > 0) stingA = wa; else wordFx = null; }
      black += ((blackT ? 0 : 1) - black) * Math.min(1, dt / 2.5);
      fade *= black;
      const live = cfg.mode !== 'manual';
      const lk = cur.P.look;
      const look = { bloomBase: lk.bloom, tone: lk.tone, vig: lk.vig, grain: lk.grain, fade, drift: live ? now() * 0.02 : 0, scan: 0, ca: lk.tone ? 0.004 : 0.01 };
      // con la ventana de salida abierta, la vista previa de la consola se dibuja a 15 fps y pequeña: la GPU es para el proyector
      const draw = salidaOn() ? (++previewN % 4 === 0) : pacer.tick();
      if (draw) { eng.draw(slots, Object.assign({ sting: stingC, stingA }, look)); if (!salidaOn()) pacer.done(ts); }
      salidaSend(slots, t, look);
      if (shotReq) { shotReq = false; shot(); }
      errors = 0;
      hud(t);
    } catch (err) {
      console.error(err);
      if (++errors > 40) reload('error');
    }
  }

  // ---------- la palabra, un instante (palabra.js, la comparten consola y salida) ----------
  function drawWord(t) { return window.SemillaPalabra.draw(stingX, stingC.width, stingC.height, wordFx.w, t, cur ? cur.P.accent : '#F2F0EA'); }

  // ---------- lógica de los modos ----------
  let lastLoopIdx = -1;
  function logic(t, dt) {
    const s = cur, P = s.P, pt = pieceT(s, t), li = Math.floor(pt / P.L);
    if (li !== lastLoopIdx && pt >= 0) {
      if (lastLoopIdx >= 0 && li > lastLoopIdx) s.loopsDone++;
      lastLoopIdx = li;
      // en sala, cada vuelta muta un poco: nunca la misma pieza dos veces
      if (autoplay() && s.how !== 'voz' && s.loopsDone > 0) {
        cfg.den = clamp(cfg.den + (Math.random() - 0.5) * 0.3, 0.2, 0.9); cfg.cha = clamp(cfg.cha + (Math.random() - 0.5) * 0.3, 0.15, 0.9);
        regen(opts()); syncSliders();
      }
    }
    if (firma) return;
    if (cfg.mode === 'publico') publico();
    if (autoplay()) {
      const loops = s.how === 'voz' ? 2 : cfg.loops, end = loops * P.L, left = end - pt;
      $('autoBar').style.width = (100 * Math.min(1, pt / end)) + '%';
      if (left < 4) {
        if (FIRMA && cfg.sig && now() - lastSig > cfg.sig * 60) { firmaStart(true); return; }
        start(nextCode(P), cfg.mode === 'auto' ? 'automático' : 'autoplay', 8);
        lastLoopIdx = -1;
      }
    }
  }
  // AUTOPLAY: en AUTOMÁTICO siempre; en PÚBLICO, mientras la sala calla (la pieza de una palabra dura 2 vueltas y vuelve el autoplay)
  function autoplay() { return cfg.mode === 'auto' || (cfg.mode === 'publico' && !voz.pending && now() - voz.lastAt > 15); }

  // ---------- PÚBLICO: la palabra ----------
  // La sala dice una palabra y la obra nace de ella. La palabra nunca se proyecta ni se guarda.
  const voz = { state: '—', last: '', fam: '', lastAt: -1e9, lastBirth: -1e9, pending: null, listener: null };
  function vozOn() {
    if (!voz.listener) { voz.listener = window.SemillaVoz.makeListener(onWord, (st) => { voz.state = st; if (st === 'ESCUCHANDO') listMics(); }); voz.listener.deviceId = cfg.mic || null; }
    voz.listener.start();
  }
  // selector de micrófono (solo en la app; en el navegador elige Chrome)
  async function listMics() {
    if (!voz.listener || !voz.listener.setDevice) return;
    const ds = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const sel = $('selMic'); sel.innerHTML = '<option value="">POR DEFECTO</option>' + ds.map((d) => `<option value="${d.deviceId}">${(d.label || 'MICRÓFONO').toUpperCase()}</option>`).join('');
    sel.value = cfg.mic || ''; $('rowMic').classList.remove('hide');
  }
  function vozOff() { if (voz.listener) voz.listener.stop(); }
  function onWord(w) {
    voz.last = w; voz.lastAt = now();
    if (cfg.mode !== 'publico') return;
    if (now() - voz.lastBirth > 12) birth(w); else voz.pending = w;
  }
  function birth(w) {
    const c = window.SemillaVoz.character(w);
    wordFx = { w, at: now() + 0.1 };   // la sala ve su palabra un instante
    voz.lastBirth = now(); voz.pending = null; voz.fam = c.fam;
    // mismo carácter, nunca la misma pieza: la semilla es la palabra y el instante
    const code = SM.cleanCode(SM.hashStr(w + ':' + Date.now()).toString(36).toUpperCase()).slice(0, 6).padEnd(6, '0');
    start(code, 'voz', 3, { density: c.density, chaos: c.chaos, accent: 'auto', force: Object.assign({ word: w }, c) });
    lastLoopIdx = -1;
  }
  function publico() {
    if (voz.pending && now() - voz.lastBirth > 12) birth(voz.pending);
  }

  // ---------- firma ----------
  function firmaStart(thenNext) {
    if (firma) return;
    firma = { at: now(), next: !!thenNext };
    lastSig = now();
    snd.voices.forEach((v) => v.duck(now(), 0.08, 0.6));
    snd.sting(now() + 0.6, cur.P.root);
  }
  function firmaEnd() {
    const next = firma.next; firma = null;
    if (next) { start(nextCode(cur.P), 'automático', 1.5); lastLoopIdx = -1; }
    else snd.voices.forEach((v) => v.duck(now(), 1, 1.2));
  }

  // ---------- salidas ----------
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function shot() { eng.canvas.toBlob((b) => b && download(b, `voidloom-semilla-${cur.P.code}.png`), 'image/png'); }
  function rec() {
    if (recording) { recording.r.stop(); return; }
    const s = cur, P = s.P, pt = pieceT(s, now()), k = Math.ceil(pt / P.L + 0.001), startAt = s.t0 + k * P.L;
    const stream = eng.canvas.captureStream(60); snd.stream().getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const type = types.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
    const r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 18e6 }), chunks = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => { download(new Blob(chunks, { type: type || 'video/webm' }), `voidloom-semilla-${P.code}.${type.includes('mp4') ? 'mp4' : 'webm'}`); recording = null; $('bRec').classList.remove('on'); };
    recording = { r };
    $('bRec').classList.add('on');
    setTimeout(() => { if (recording && recording.r === r) { r.start(250); setTimeout(() => r.state !== 'inactive' && r.stop(), P.L * 1000); } }, Math.max(0, (startAt - now()) * 1000));
  }
  function csv() {
    const rows = [['semilla', 'forma', 'acento', 'modo', 'hora']].concat(log.map((x) => [x.c, x.sp, x.acc, x.modo, x.t]));
    download(new Blob([rows.map((r) => r.join(';')).join('\n')], { type: 'text/csv' }), 'voidloom-semilla-registro.csv');
  }

  // ---------- interfaz ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const MODE_NOTE = {
    auto: 'Las piezas nacen solas y se suceden sin repetirse. Cada vuelta muta un poco: el mismo frame no vuelve a salir.',
    publico: 'Mientras la sala calla, autoplay: las piezas cambian al azar. Cuando alguien dice una palabra, se proyecta un instante y la obra nace de ella (forma, luz, trazos y sonido; el dron canta sus vocales). Tras dos vueltas sin palabras, vuelve el autoplay.',
    manual: 'Semilla, acento, densidad y caos a mano, para estudio y montaje. La pieza repite su vuelta perfecta.',
  };
  function setMode(m) {
    cfg.mode = m; saveCfg();
    document.querySelectorAll('#segMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('modeNote').textContent = MODE_NOTE[m];
    $('boxAuto').classList.toggle('hide', m === 'manual'); $('boxPub').classList.toggle('hide', m !== 'publico');
    $('chipSala').classList.toggle('hide', m !== 'publico');
    $('chMode').textContent = { auto: 'AUTOMÁTICO', publico: 'PÚBLICO', manual: 'MANUAL' }[m];
    const man = m === 'manual';
    ['rDen', 'rCha', 'inCode'].forEach((id) => ($(id).disabled = !man));
    ['bNew', 'bPrev', 'bNext'].forEach((id) => ($(id).disabled = m === 'publico'));
    document.querySelectorAll('#swAcc button').forEach((b) => (b.disabled = !man));
    if (m === 'publico') vozOn(); else vozOff();
    if (cur && snd) { snd.voices.forEach((v) => { if (v === cur.voice && !v.stopAt) { v.out.gain.setTargetAtTime(1, now(), 0.4); v._g = 1; } }); regen(opts()); }
  }
  function paintPiece() {
    const P = cur.P;
    document.documentElement.style.setProperty('--acc', P.accent);
    $('chCode').textContent = P.code; $('chSp').textContent = P.sp.name; $('chBpm').textContent = P.bpm;
    $('pieceRef').textContent = P.sp.name + ' · ' + SM.MATS[P.vis.mat] + ' · ' + P.rootName;
    if (document.activeElement !== $('inCode')) $('inCode').value = P.code;
    $('bigName').textContent = P.sp.name; $('bigIdea').textContent = P.sp.idea;
    $('tagTxt').textContent = P.code + ' · ' + SM.MATS[P.vis.mat] + ' · ' + SM.RIGS[P.vis.rig] + ' · ' + SM.ACCENT_NAMES[P.accentKey] + ' · ' + P.bpm + ' BPM';
    document.querySelectorAll('#swAcc button').forEach((b) => b.classList.toggle('on', b.dataset.a === (cfg.mode === 'manual' ? cfg.accent : 'auto')));
    const tl = $('tl'); tl.innerHTML = '<i id="tlBar"></i>';
    P.acts.forEach(([t, n]) => { const x = (100 * t) / P.L; tl.insertAdjacentHTML('beforeend', `<em style="left:${x}%"></em><span style="left:${x}%">${n}</span>`); });
  }
  let hudT = 0;
  function hud(t) {
    const P = cur.P, pt = Math.max(0, pieceT(cur, t)), lt = pt % P.L;
    const bar = $('tlBar'); if (bar) bar.style.width = (100 * lt) / P.L + '%';
    if (performance.now() - hudT < 200) return; hudT = performance.now();
    $('chAct').textContent = P.acts.reduce((a, x) => (lt >= x[0] ? x[1] : a), 'SEÑAL');
    $('chFps').textContent = (salidaOn() ? 'SALIDA' : Math.round(pacer.fps) + (pacer.half ? ' (30)' : '')) + ' · ' + Math.round(eng.scale * 100) + '%' + ((eng.quality ?? 1) < 0.5 ? ' · LIGERA' : '');
    const so = salidaOn(); $('bProj').classList.toggle('on', so); $('bProj').textContent = so ? 'SALIDA ABIERTA' : 'PROYECTAR';
    $('tagTxt').dataset.salida = so ? '1' : '';
    if (cfg.mode === 'publico') {
      $('pMic').textContent = voz.state; $('pWord').textContent = voz.last ? voz.last.toUpperCase() : '—';
      const L = voz.listener; $('pLvl').style.width = 100 * ((L && L.level) || 0) + '%'; $('pHeard').textContent = (L && L.heard) ? L.heard.toUpperCase() : '—';
      $('pFam').textContent = voz.fam ? voz.fam.toUpperCase() : '—';
      $('pNext').textContent = voz.pending ? 'EN ESPERA: ' + voz.pending.toUpperCase() : autoplay() ? 'AUTOPLAY' : 'PIEZA DE LA PALABRA';
      $('chSala').textContent = voz.state;
      $('ledCam').className = 'led ' + (voz.state === 'ESCUCHANDO' ? 'on' : voz.state.startsWith('SIN') || voz.state.startsWith('ERROR') ? 'err' : 'warn');
    }
  }
  function syncSliders() {
    $('rDen').value = Math.round(cfg.den * 100); $('oDen').textContent = $('rDen').value;
    $('rCha').value = Math.round(cfg.cha * 100); $('oCha').textContent = $('rCha').value;
    document.querySelectorAll('input[type=range]').forEach((r) => r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'));
  }
  function renderSaved() {
    const s = store.get('guardadas', []); $('nSaved').textContent = s.length;
    $('listSaved').innerHTML = s.map((x, i) => `<div><button class="go" data-c="${x.c}">${x.c}</button><i>${x.sp}</i><button data-del="${i}" aria-label="Quitar">×</button></div>`).join('') || '<div><i>Pulsa GUARDAR para conservar una semilla.</i></div>';
  }
  function renderLog() {
    $('nLog').textContent = log.length;
    $('listLog').innerHTML = log.slice(0, 40).map((x) => `<div><button class="go" data-c="${x.c}">${x.c}</button><i>${x.sp} · ${x.modo} · ${x.t.slice(11, 16)}</i></div>`).join('');
  }
  function save() { const s = store.get('guardadas', []); if (!s.find((x) => x.c === cur.P.code)) s.unshift({ c: cur.P.code, sp: cur.P.sp.name }); store.set('guardadas', s.slice(0, 200)); renderSaved(); }
  function goCode(c) { c = SM.cleanCode(c); if (!c) return; if (cfg.mode === 'publico') setMode('manual'); start(c, 'manual', 1.5); lastLoopIdx = -1; }
  function proj(on) {
    const v = on ?? !document.body.classList.contains('solo');
    document.body.classList.toggle('solo', v);
    if (v && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!v && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  function setVol() { snd.volume(cfg.sound ? Math.pow(cfg.vol / 100, 1.6) : 0, 0.4); $('bSound').classList.toggle('on', cfg.sound); }
  function reload(why) { const u = new URL(location.href); u.searchParams.set('reanudar', why); u.searchParams.set('modo', { auto: 'automatico', publico: 'publico', manual: 'manual' }[cfg.mode]); location.replace(u.toString()); }

  function ui() {
    // acentos
    const sw = $('swAcc');
    sw.innerHTML = `<button data-a="auto">AUTO</button>` + Object.entries(SM.ACCENTS).map(([k, c]) => `<button data-a="${k}" style="--c:${c}" title="${SM.ACCENT_NAMES[k]}"><i></i></button>`).join('');
    sw.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; cfg.accent = b.dataset.a; saveCfg(); regen(opts()); };
    $('segMode').onclick = (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); };
    const seg = (id, key, cb) => { const el = $(id); const paint = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === cfg[key])); el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; cfg[key] = +b.dataset.v; saveCfg(); paint(); cb && cb(); }; paint(); };
    seg('segLoops', 'loops');
    const range = (id, out, fn) => { $(id).oninput = () => { $(out).textContent = $(id).value; fn(+$(id).value); syncSliders(); }; };
    range('rDen', 'oDen', (v) => { cfg.den = v / 100; saveCfg(); regen(opts()); });
    range('rCha', 'oCha', (v) => { cfg.cha = v / 100; saveCfg(); regen(opts()); });
    $('rVol').value = cfg.vol; $('oVol').textContent = cfg.vol; range('rVol', 'oVol', (v) => { cfg.vol = v; saveCfg(); setVol(); });
    $('rBri').value = cfg.bri; $('oBri').textContent = cfg.bri; range('rBri', 'oBri', (v) => { cfg.bri = v; saveCfg(); });
    $('bSafe').classList.toggle('on', cfg.safe);
    $('bSafe').onclick = () => { cfg.safe = !cfg.safe; saveCfg(); $('bSafe').classList.toggle('on', cfg.safe); };
    $('bBlack').onclick = toggleBlack;
    $('bSound').onclick = () => { cfg.sound = !cfg.sound; saveCfg(); setVol(); };
    $('bProj').onclick = salida;
    $('bHelp').onclick = () => $('help').classList.toggle('on');
    $('help').onclick = () => $('help').classList.remove('on');
    $('bNew').onclick = () => { start(nextCode(cur.P), cfg.mode === 'manual' ? 'manual' : 'automático', 1.5); lastLoopIdx = -1; };
    $('bPrev').onclick = () => hist(-1); $('bNext').onclick = () => hist(1);
    $('inCode').onkeydown = (e) => { if (e.key === 'Enter') { goCode(e.target.value); e.target.blur(); } e.stopPropagation(); };
    $('inWord').onkeydown = (e) => { if (e.key === 'Enter') { const w = window.SemillaVoz.pickWord(e.target.value) || ''; if (w) { if (cfg.mode !== 'publico') setMode('publico'); voz.last = w; voz.lastAt = now(); birth(w); } e.target.value = ''; } e.stopPropagation(); };
    $('selMic').onchange = (e) => { cfg.mic = e.target.value; saveCfg(); if (voz.listener && voz.listener.setDevice) voz.listener.setDevice(cfg.mic); };
    $('bRec').onclick = rec; $('bShot').onclick = () => (shotReq = true);  $('bSave').onclick = save; $('bCsv').onclick = csv;
    const listClick = (e) => { const g = e.target.closest('[data-c]'), d = e.target.closest('[data-del]'); if (d) { const s = store.get('guardadas', []); s.splice(+d.dataset.del, 1); store.set('guardadas', s); renderSaved(); } else if (g) goCode(g.dataset.c); };
    $('listSaved').onclick = listClick; $('listLog').onclick = listClick;
    syncSliders(); renderSaved(); renderLog();
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      const k = e.key.toLowerCase();
      if (k === '1') setMode('auto'); else if (k === '2') setMode('publico'); else if (k === '3') setMode('manual');
      else if (k === ' ') { e.preventDefault(); if (cfg.mode !== 'publico') $('bNew').click(); }
      else if (k === 'arrowleft') hist(-1); else if (k === 'arrowright') hist(1);
      else if (k === 'h') proj(); else if (k === 'p') salida(); else if (k === 'f' && FIRMA) firmaStart(false); else if (k === 'b') toggleBlack();
      else if (k === 's') $('bSound').click(); else if (k === 'r') rec(); else if (k === 'c') shotReq = true; else if (k === 'g') save();
      else if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); cfg.vol = clamp(cfg.vol + (k === 'arrowup' ? 5 : -5), 0, 100); $('rVol').value = cfg.vol; $('oVol').textContent = cfg.vol; syncSliders(); saveCfg(); setVol(); }
      else if (k === '?' || k === '/') $('help').classList.toggle('on');
      else if (k === 'escape') { $('help').classList.remove('on'); }
    });
  }
  function hist(d) {
    if (cfg.mode === 'publico') return;
    const i = hIdx + d; if (i < 0 || i >= history.length) return;
    hIdx = i; start(history[i], 'historial', 1.5); lastLoopIdx = -1;
  }
  function toggleBlack() {
    blackT = blackT ? 0 : 1; $('bBlack').classList.toggle('on', !!blackT); $('bBlack').textContent = blackT ? 'ENCENDER' : 'APAGAR';
    snd.volume(blackT ? 0 : cfg.sound ? Math.pow(cfg.vol / 100, 1.6) : 0, blackT ? 6 : 3);
  }

  // ---------- arranque ----------
  async function boot() {
    const logEl = $('bootlog');
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback', sampleRate: 48000 });
      await ctx.resume();
      snd = new window.SemillaSound(ctx);
      eng = new window.SemillaEngine($('c')); pacer = new window.SemillaEngine.Pacer(eng);
      // pantalla de carga: la materia se prepara (la primera vez en cada ordenador tarda más; luego queda en caché)
      $('go').classList.add('off'); $('bootbar').classList.add('on');
      const t0 = performance.now();
      await eng.warm((ok, n) => {
        $('bootfill').style.transform = 'scaleX(' + (ok / n).toFixed(3) + ')';
        const sec = (performance.now() - t0) / 1000;
        logEl.textContent = 'PREPARANDO LA MATERIA · ' + ok + ' / ' + n + (sec > 6 ? ' · LA PRIMERA VEZ TARDA MÁS' : '');
      });
      logEl.textContent = 'CARGANDO EL SENTIDO DE LAS PALABRAS…'; $('bootfill').style.transform = 'scaleX(1)';
      await Promise.race([window.SemillaVoz.sentidoReady, new Promise((r) => setTimeout(r, 4000))]);
      stingC = $('sting'); const vs = window.VL ? [VL.W, VL.H] : innerWidth >= innerHeight ? [1920, 1080] : [1080, 1920]; stingC.width = vs[0]; stingC.height = vs[1]; stingX = stingC.getContext('2d');
      $('c').addEventListener('webglcontextlost', (e) => { e.preventDefault(); setTimeout(() => reload('gpu'), 800); });
      if (window.SemillaVoz.isApp) $('vozNote').textContent = 'En la app la voz se reconoce en este ordenador, sin internet.';
      ui(); setVol(); setMode(cfg.mode);
      size();
      const first = Q.get('semilla') ? SM.cleanCode(Q.get('semilla')) : SM.newCode();
      start(first, cfg.mode === 'manual' ? 'manual' : 'automático', 0.5);
      lastSig = now();
      setInterval(() => { if (snd) snd.tick(); if (ctx.state === 'suspended') ctx.resume(); }, 50);
      requestAnimationFrame(frame);
      $('boot').classList.add('off');
      if (Q.has('salida')) setTimeout(salida, 800);
      else if (Q.has('museo') || Q.has('instalacion') || Q.get('reanudar')) proj(true);
    } catch (err) {
      console.error(err);
      $('go').classList.remove('off'); $('bootbar').classList.remove('on');
      logEl.classList.add('err');
      logEl.textContent = err && err.gpu ? 'LA TARJETA GRÁFICA NO PUDO PREPARAR LA MATERIA · ' + (window.SemillaVoz.isApp ? 'LA APP SE REINICIA CON OTRO MODO GRÁFICO…' : 'PRUEBA EN CHROME ACTUALIZADO') : 'NO SE PUDO ARRANCAR: ' + (err && err.message || err);
    }
  }
  $('go').onclick = boot;
  // si se recargó sola (error de GPU, fallo), vuelve a arrancar en cuanto haya un gesto o directamente si el navegador lo permite
  // se recargó sola (fallo de GPU) o es la app de escritorio en modo instalación: arranca sin esperar un clic
  if (Q.get('reanudar') || (Q.has('museo') && window.SemillaVoz && window.SemillaVoz.isApp)) { $('bootlog').textContent = Q.get('reanudar') ? 'REANUDANDO…' : 'ARRANCANDO…'; setTimeout(() => boot(), 600); }
})();
