/* VØID_LOOM · SEMILLA — consola, modos de sala y reloj común.
   AUTOMÁTICO: las piezas nacen solas. PÚBLICO: la sala las hace nacer con su presencia (sensor de OJO).
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

  const cfg = Object.assign({ mode: 'auto', loops: 3, sig: 30, vol: 70, bri: 100, safe: true, sound: true, accent: 'auto', den: 0.5, cha: 0.5 }, store.get('cfg', {}));
  if (Q.get('modo')) cfg.mode = { automatico: 'auto', auto: 'auto', publico: 'publico', manual: 'manual' }[Q.get('modo')] || cfg.mode;
  const saveCfg = () => store.set('cfg', cfg);

  let ctx, snd, eng, stingC, stingX;
  let cur = null, prev = null, history = [], hIdx = -1;
  let firma = null, black = 0, blackT = 0, lastSig = 0, recording = null, shotReq = false;
  const pres = { n: 0, energy: 0, contact: 0, x: 0.5, y: 0.5, size: 0, ent: 0, ts: 0, ok: false, cam: '—', emptySince: 0, sleep: 1, ox: 0, oy: 0, lastBirth: -1e9, lastRupt: -1e9, entSeen: null, contactOn: false };

  // ---------- tiempo ----------
  const now = () => ctx.currentTime;
  const heard = () => ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  const pieceT = (s, t = heard()) => t - s.t0;

  // ---------- registro ----------
  const log = store.get('registro', []);
  function logBirth(P, how) {
    log.unshift({ c: P.code, sp: P.sp.name, ref: P.ref.name, acc: P.accentKey, modo: how, t: new Date().toISOString() });
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
    cur = { P, t0, voice: v, born: now(), loopsDone: 0, how };
    if (how !== 'historial') { history = history.slice(0, hIdx + 1); history.push(code); if (history.length > 200) history.shift(); hIdx = history.length - 1; }
    if (how !== 'ruptura') logBirth(P, how);
    paintPiece();
    return cur;
  }
  // mismos golpes, otros mandos (densidad, caos, acento): cambia en el siguiente evento sin cortar
  function regen(o) {
    if (!cur) return;
    const P = SM.generate(cur.P.code, o);
    cur.P = P; cur.voice.P = P; paintPiece();
  }

  // ---------- frame ----------
  let lastFrame = 0, fpsAcc = 0, fpsN = 0, fps = 60, errors = 0, slowT = 0, fastT = 0;
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), r = eng.canvas.getBoundingClientRect();
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
      fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; adapt(); }
      snd.tick();
      if (!cur) return;
      const t = heard();
      logic(t, dt);
      size();
      const slots = [];
      let wCur = 1;
      if (prev) {
        const x = Math.min(1, (now() - prev.fadeAt) / prev.fadeDur);
        const k = x * x * (3 - 2 * x);
        slots.push({ P: prev.P, e: envOf(prev, t), w: 1 - k }); wCur = k;
        if (x >= 1) prev = null;
      }
      const Pv = cfg.mode === 'publico' ? withPresence(cur.P) : cur.P;
      slots.push({ P: Pv, e: envOf(cur, t), w: wCur });
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
      if (cfg.mode === 'publico') fade *= 0.12 + 0.88 * (1 - pres.sleep);
      black += ((blackT ? 0 : 1) - black) * Math.min(1, dt / 2.5);
      fade *= black;
      const live = cfg.mode !== 'manual';
      const lk = cur.P.look;
      eng.draw(slots, { bloomBase: lk.bloom, tone: lk.tone, vig: lk.vig, grain: lk.grain, fade, sting: stingC, stingA, drift: live ? now() * 0.02 : 0, scan: 0, ca: lk.tone ? 0.004 : 0.01 });
      if (shotReq) { shotReq = false; shot(); }
      errors = 0;
      hud(t);
    } catch (err) {
      console.error(err);
      if (++errors > 40) reload('error');
    }
  }
  // resolución de la escena según lo que aguante el ordenador
  function adapt() {
    if (fps < 48) { slowT++; fastT = 0; } else if (fps > 58) { fastT++; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT >= 2 && eng.scale > 0.4) { eng.resize(eng.size[0], eng.size[1], +(eng.scale - 0.1).toFixed(2)); slowT = 0; }
    if (fastT >= 8 && eng.scale < 1) { eng.resize(eng.size[0], eng.size[1], +(eng.scale + 0.05).toFixed(2)); fastT = 0; }
  }

  // ---------- lógica de los modos ----------
  let lastLoopIdx = -1;
  function logic(t, dt) {
    const s = cur, P = s.P, pt = pieceT(s, t), li = Math.floor(pt / P.L);
    if (li !== lastLoopIdx && pt >= 0) {
      if (lastLoopIdx >= 0 && li > lastLoopIdx) s.loopsDone++;
      lastLoopIdx = li;
      // en sala, cada vuelta muta un poco: nunca la misma pieza dos veces
      if (cfg.mode === 'auto' && s.loopsDone > 0) {
        cfg.den = clamp(cfg.den + (Math.random() - 0.5) * 0.3, 0.2, 0.9); cfg.cha = clamp(cfg.cha + (Math.random() - 0.5) * 0.3, 0.15, 0.9);
        regen(opts()); syncSliders();
      }
    }
    if (firma) return;
    if (cfg.mode === 'auto') {
      const end = cfg.loops * P.L, left = end - pt;
      $('autoBar').style.width = (100 * Math.min(1, pt / end)) + '%';
      if (left < 4) {
        if (FIRMA && cfg.sig && now() - lastSig > cfg.sig * 60) { firmaStart(true); return; }
        start(nextCode(P), 'automático', 8);
        lastLoopIdx = -1;
      }
    } else if (cfg.mode === 'publico') publico(t, dt, pt);
  }

  // ---------- PÚBLICO ----------
  function withPresence(P) {
    // la luz se desplaza un poco hacia donde está el visitante
    return Object.assign({}, P, { vis: Object.assign({}, P.vis, { off: [P.vis.off[0] + pres.ox, P.vis.off[1] + pres.oy] }) });
  }
  let barSeen = -1;
  function publico(t, dt, pt) {
    const fresh = pres.ok && Date.now() - pres.ts < 2500, n = fresh ? pres.n : 0;
    if (n > 0) pres.emptySince = 0; else if (!pres.emptySince) pres.emptySince = now();
    const empty = pres.emptySince && now() - pres.emptySince > 6;
    pres.sleep += ((empty ? 1 : 0) - pres.sleep) * Math.min(1, dt / (empty ? 9 : 2));
    pres.ox += (((pres.x - 0.5) * 0.35 * (n ? 1 : 0)) - pres.ox) * Math.min(1, dt / 3);
    pres.oy += (((0.5 - pres.y) * 0.2 * (n ? 1 : 0)) - pres.oy) * Math.min(1, dt / 3);
    snd.voices.forEach((v) => { if (v === cur.voice && !v.stopAt) { const g = 0.22 + 0.78 * (1 - pres.sleep); if (Math.abs((v._g || 1) - g) > 0.01) { v.out.gain.setTargetAtTime(g, now(), 0.4); v._g = g; } } });
    // alguien entra: nace una pieza (como mucho una cada 25 s)
    if (pres.entSeen == null) pres.entSeen = pres.ent;
    if (fresh && pres.ent > pres.entSeen) {
      pres.entSeen = pres.ent;
      if (now() - pres.lastBirth > 25) {
        pres.lastBirth = now();
        const code = codeFromMoment();
        start(code, 'público', 3, { density: dens(n), chaos: chaosOf(), accent: 'auto' });
        lastLoopIdx = -1; return;
      }
    }
    // la sala mueve densidad y caos en cada compás
    const bar = Math.floor(pt / cur.P.bar);
    if (bar !== barSeen) {
      barSeen = bar;
      const d = dens(n), c = chaosOf();
      if (Math.abs(d - cur.P.density) > 0.06 || Math.abs(c - cur.P.chaos) > 0.06) { cfg.den = d; cfg.cha = c; regen({ density: d, chaos: c, accent: 'auto' }); syncSliders(); }
    }
    // mirada sostenida: la obra devuelve la RUPTURA
    const c = fresh ? pres.contact : 0;
    if (c > 0.6 && !pres.contactOn) {
      pres.contactOn = true;
      const inRupt = (pt % cur.P.L) >= 8 * cur.P.bar && (pt % cur.P.L) < 12 * cur.P.bar;
      if (!inRupt && now() - pres.lastRupt > 40) {
        pres.lastRupt = now();
        start(cur.P.code, 'ruptura', 0.15, { density: cur.P.density, chaos: cur.P.chaos, accent: 'auto' }, 8 * cur.P.bar - 0.02);
        lastLoopIdx = -1;
      }
    }
    if (c < 0.3) pres.contactOn = false;
  }
  const dens = (n) => clamp(0.25 + 0.16 * Math.min(n, 4) + 0.5 * pres.energy, 0.2, 0.95);
  const chaosOf = () => clamp(0.2 + 0.75 * pres.energy + 0.25 * pres.size, 0.15, 0.95);
  function codeFromMoment() {
    const s = Date.now() + ':' + pres.x.toFixed(3) + ':' + pres.y.toFixed(3) + ':' + pres.size.toFixed(3);
    const ABC = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; let h = SM.hashStr(s), out = '';
    for (let i = 0; i < 6; i++) { out += ABC[h % ABC.length]; h = Math.floor(h / ABC.length) ^ SM.hashStr(out + s); h >>>= 0; }
    return out;
  }
  let sensor = null;
  function sensorOn() {
    if (sensor) return;
    pres.cam = 'ARRANCANDO'; pres.ok = false; pres.entSeen = null;
    sensor = document.createElement('iframe'); sensor.id = 'sensor'; sensor.allow = 'camera';
    sensor.src = '../ojo/sensor.html' + (Q.get('cam') ? '?cam=' + encodeURIComponent(Q.get('cam')) : '');
    document.body.appendChild(sensor);
  }
  function sensorOff() { if (sensor) { sensor.remove(); sensor = null; } pres.ok = false; pres.cam = '—'; }
  const presCh = new BroadcastChannel('voidloom-presencia');
  presCh.onmessage = (e) => {
    const m = e.data; if (!m || m.type !== 'presencia' || !sensor) return;
    Object.assign(pres, { n: m.n || 0, energy: clamp(m.energy || 0), contact: m.contact || 0, x: m.x ?? 0.5, y: m.y ?? 0.5, size: m.size || 0, ent: m.ent || 0, ts: Date.now(), ok: true });
  };
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'ojo-sensor') return;
    pres.cam = { camara: 'PIDIENDO CÁMARA', 'sin-camara': 'SIN CÁMARA', ia: 'CARGANDO IA', ok: 'VIENDO', 'error-ia': 'ERROR DE IA' }[d.st] || d.st.toUpperCase();
  });

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
    const rows = [['semilla', 'especie', 'referencia', 'acento', 'modo', 'hora']].concat(log.map((x) => [x.c, x.sp, x.ref, x.acc, x.modo, x.t]));
    download(new Blob([rows.map((r) => r.join(';')).join('\n')], { type: 'text/csv' }), 'voidloom-semilla-registro.csv');
  }

  // ---------- interfaz ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const MODE_NOTE = {
    auto: 'Las piezas nacen solas y se suceden sin repetirse. Cada vuelta muta un poco: el mismo frame no vuelve a salir.',
    publico: 'La sala genera la pieza. Vacía, la obra queda latente; alguien entra y nace una pieza; el movimiento la densifica; una mirada sostenida le devuelve la ruptura.',
    manual: 'Semilla, acento, densidad y caos a mano, para estudio y montaje. La pieza repite su vuelta perfecta.',
  };
  function setMode(m) {
    cfg.mode = m; saveCfg();
    document.querySelectorAll('#segMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('modeNote').textContent = MODE_NOTE[m];
    $('boxAuto').classList.toggle('hide', m !== 'auto'); $('boxPub').classList.toggle('hide', m !== 'publico');
    $('chipSala').classList.toggle('hide', m !== 'publico');
    $('chMode').textContent = { auto: 'AUTOMÁTICO', publico: 'PÚBLICO', manual: 'MANUAL' }[m];
    const man = m === 'manual';
    ['rDen', 'rCha', 'inCode'].forEach((id) => ($(id).disabled = !man));
    ['bNew', 'bPrev', 'bNext'].forEach((id) => ($(id).disabled = m === 'publico'));
    document.querySelectorAll('#swAcc button').forEach((b) => (b.disabled = !man));
    if (m === 'publico') sensorOn(); else { sensorOff(); pres.sleep = 0; }
    if (cur && snd) { snd.voices.forEach((v) => { if (v === cur.voice && !v.stopAt) { v.out.gain.setTargetAtTime(1, now(), 0.4); v._g = 1; } }); regen(opts()); }
  }
  function paintPiece() {
    const P = cur.P;
    document.documentElement.style.setProperty('--acc', P.accent);
    $('chCode').textContent = P.code; $('chSp').textContent = P.sp.name; $('chRef').textContent = P.ref.name; $('chBpm').textContent = P.bpm;
    $('pieceRef').textContent = P.sp.name + ' · ' + P.ref.name + ' · ' + P.rootName;
    if (document.activeElement !== $('inCode')) $('inCode').value = P.code;
    $('bigName').textContent = P.sp.name; $('bigIdea').textContent = P.sp.idea;
    $('tagTxt').textContent = P.code + ' · ' + P.pal.name + ' · ' + P.bpm + ' BPM · ' + P.rootName;
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
    $('chFps').textContent = Math.round(fps) + ' · ' + Math.round(eng.scale * 100) + '%';
    if (cfg.mode === 'publico') {
      const fresh = pres.ok && Date.now() - pres.ts < 2500;
      $('pCam').textContent = pres.cam; $('pN').textContent = fresh ? pres.n : 0;
      $('pState').textContent = pres.sleep > 0.6 ? 'LATENTE' : 'DESPIERTA';
      $('pMov').style.width = 100 * (fresh ? pres.energy : 0) + '%'; $('pCon').style.width = 100 * Math.min(1, fresh ? pres.contact : 0) + '%';
      $('chSala').textContent = (fresh ? pres.n : 0) + ' · ' + (pres.sleep > 0.6 ? 'LATENTE' : 'DESPIERTA');
      $('ledCam').className = 'led ' + (fresh ? 'on' : pres.cam === 'SIN CÁMARA' || pres.cam.startsWith('ERROR') ? 'err' : 'warn');
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
    $('bProj').onclick = () => proj();
    $('bHelp').onclick = () => $('help').classList.toggle('on');
    $('help').onclick = () => $('help').classList.remove('on');
    $('bNew').onclick = () => { start(nextCode(cur.P), cfg.mode === 'manual' ? 'manual' : 'automático', 1.5); lastLoopIdx = -1; };
    $('bPrev').onclick = () => hist(-1); $('bNext').onclick = () => hist(1);
    $('inCode').onkeydown = (e) => { if (e.key === 'Enter') { goCode(e.target.value); e.target.blur(); } e.stopPropagation(); };
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
      else if (k === 'h') proj(); else if (k === 'f' && FIRMA) firmaStart(false); else if (k === 'b') toggleBlack();
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
      eng = new window.SemillaEngine($('c'));
      logEl.textContent = 'PREPARANDO LAS ESPECIES…';
      await new Promise((r) => setTimeout(r, 30));
      eng.warm();
      stingC = $('sting'); stingC.width = VL.W; stingC.height = VL.H; stingX = stingC.getContext('2d');
      $('c').addEventListener('webglcontextlost', (e) => { e.preventDefault(); setTimeout(() => reload('gpu'), 800); });
      ui(); setVol(); setMode(cfg.mode);
      size();
      const first = Q.get('semilla') ? SM.cleanCode(Q.get('semilla')) : SM.newCode();
      start(first, cfg.mode === 'manual' ? 'manual' : 'automático', 0.5);
      lastSig = now();
      setInterval(() => { if (snd) snd.tick(); if (ctx.state === 'suspended') ctx.resume(); }, 50);
      requestAnimationFrame(frame);
      $('boot').classList.add('off');
      if (Q.has('museo') || Q.has('instalacion') || Q.get('reanudar')) proj(true);
    } catch (err) {
      console.error(err);
      logEl.classList.add('err'); logEl.textContent = 'NO SE PUDO ARRANCAR: ' + (err && err.message || err);
    }
  }
  $('go').onclick = boot;
  // si se recargó sola (error de GPU, fallo), vuelve a arrancar en cuanto haya un gesto o directamente si el navegador lo permite
  if (Q.get('reanudar')) { $('bootlog').textContent = 'REANUDANDO…'; setTimeout(() => boot(), 400); }
})();
