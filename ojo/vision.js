/* VØID_LOOM · OJO — la máquina te mira.
   Detección real con Human (tfjs, modelos locales en models/): cara + malla de 468 puntos + iris, y esqueleto (MoveNet).
   Encima: identidad estable (SUJETO 01…), tiempo observado, dirección de la mirada, CONTACTO cuando miras a la cámara,
   y una fóvea artificial que salta con sacádicos entre tus ojos (o lo más saliente de la escena si no hay nadie).
   No calcula edad, género ni emoción.
   El modelo resultante es serializable: la salida lo calcula y la consola lo recibe para dibujarlo en su previa. */
(function (root) {
  'use strict';
  const OJO = root.OJO || (root.OJO = {});

  const SIL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  const BONES = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 1], [0, 2], [1, 3], [2, 4]];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

  OJO.vision = function () {
    let human = null, video = null, running = false, status = 'apagada';
    const subjects = new Map();
    let nextId = 1, lastDet = 0, detMs = 0, lastErr = null;
    const events = [];
    const fov = { x: 0.5, y: 0.45, fx: 0.5, fy: 0.45, sx: 0.5, sy: 0.45, sacT: 0, sacDur: 0.07, next: 0, path: [], target: null, born: performance.now() };
    let model = { subjects: [], body: null, fovea: { x: 0.5, y: 0.45, path: [], sac: 0 }, contact: 0, status, energy: 0 };
    let contactLevel = 0, contactOn = false;

    async function load(onStatus) {
      const say = (s) => { status = s; onStatus && onStatus(s); };
      say('cargando modelos');
      const { Human } = await import(new URL('vendor/human/human.esm.js', document.baseURI).href);
      human = new Human({
        modelBasePath: new URL('models/', document.baseURI).href,
        backend: 'webgl', debug: false, warmup: 'none', cacheSensitivity: 0,
        filter: { enabled: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 5, minConfidence: 0.4, return: false },
          mesh: { enabled: true }, iris: { enabled: true },
          emotion: { enabled: false }, description: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false }, attention: { enabled: false },
        },
        body: { enabled: true, modelPath: 'movenet-lightning.json', maxDetected: 1, minConfidence: 0.25 },
        hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
      });
      await human.load();
      say('lista');
    }

    async function loop() {
      while (running) {
        const t0 = performance.now();
        if (video && video.readyState >= 2 && video.videoWidth) {
          try { await human.detect(video); lastDet = performance.now(); detMs = detMs * 0.9 + (lastDet - t0) * 0.1; } catch (e) { lastErr = e; }
        }
        await new Promise((r) => setTimeout(r, Math.max(4, 30 - (performance.now() - t0))));
      }
    }

    function emit(type, data) { events.push(Object.assign({ type, t: performance.now() }, data || {})); if (events.length > 40) events.shift(); }

    // ---------------------------------------------------------------- actualización por frame
    function update(nowMs, eng, S) {
      const now = nowMs;
      const vw = video ? video.videoWidth : 0, vh = video ? video.videoHeight : 0;
      const res = human && running && vw ? human.next(human.result) : null;
      const seen = new Set();
      if (res && res.face) {
        for (const f of res.face) {
          if (!f.box || (f.score || 0) < 0.35) continue;
          const b = [f.box[0] / vw, f.box[1] / vh, f.box[2] / vw, f.box[3] / vh];
          const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
          // emparejar con el sujeto más cercano
          let best = null, bd = 0.22;
          subjects.forEach((s) => { if (seen.has(s.id)) return; const d = Math.hypot(s.cx - cx, s.cy - cy); if (d < bd) { bd = d; best = s; } });
          if (!best) { best = { id: nextId++, born: now, cx, cy, box: b.slice(), contactT: 0, contact: 0 }; subjects.set(best.id, best); emit('entra', { id: best.id, x: cx }); }
          seen.add(best.id);
          best.last = now; best.cx = cx; best.cy = cy;
          for (let i = 0; i < 4; i++) best.box[i] += (b[i] - best.box[i]) * 0.5;
          const mesh = f.mesh || [];
          const m = new Array(mesh.length * 2);
          for (let i = 0; i < mesh.length; i++) { m[i * 2] = mesh[i][0] / vw; m[i * 2 + 1] = mesh[i][1] / vh; }
          best.mesh = m;
          const irisC = (k) => { const a = f.annotations && f.annotations[k]; if (!a || !a.length) return null; const r = a.length > 1 ? Math.hypot(a[1][0] - a[0][0], a[1][1] - a[0][1]) / vw : 0.006; return [a[0][0] / vw, a[0][1] / vh, r]; };
          best.irisL = irisC('leftEyeIris'); best.irisR = irisC('rightEyeIris');
          const rot = f.rotation || {};
          const ang = rot.angle || {}; const gz = rot.gaze || {};
          best.yaw = ang.yaw || 0; best.pitch = ang.pitch || 0; best.roll = ang.roll || 0;
          best.gaze = [gz.bearing || 0, gz.strength || 0];
          best.dist = f.distance || null; best.score = f.score || 0;
          // ¿me está mirando?
          const s = S.contactSens != null ? S.contactSens : 0.5;
          const look = Math.abs(best.yaw) < 0.12 + 0.3 * s && Math.abs(best.pitch) < 0.16 + 0.3 * s && best.gaze[1] < 0.18 + 0.4 * s;
          best.contactT = look ? best.contactT + 1 / 60 : Math.max(0, best.contactT - 3 / 60);
        }
      }
      // los que se van
      subjects.forEach((s) => {
        s.gone = clamp((now - s.last) / 1200);
        if (!seen.has(s.id) && now - s.last > 1200) { subjects.delete(s.id); emit('sale', { id: s.id }); }
      });
      // cuerpo
      let body = null;
      if (res && res.body && res.body[0] && (res.body[0].score || 0) > 0.25) {
        body = res.body[0].keypoints.map((k) => [k.position[0] / vw, k.position[1] / vh, k.score || 0]);
        if (body.length < 17) body = null;
      }
      // contacto global: el sujeto que más tiempo lleva mirando
      let cs = null;
      subjects.forEach((s) => { s.contact = clamp((s.contactT - 0.45) / 0.35); if (s.contact > 0 && (!cs || s.contactT > cs.contactT)) cs = s; });
      const target = cs ? 1 : 0;
      contactLevel += (target - contactLevel) * (target ? 0.12 : 0.06);
      if (cs && !contactOn) { contactOn = true; emit('contacto', { id: cs.id }); }
      if (!cs && contactOn && contactLevel < 0.2) { contactOn = false; emit('fin-contacto'); }

      updateFovea(now, eng, cs);

      const list = [...subjects.values()].sort((a, b) => a.id - b.id).map((s) => ({
        id: s.id, box: s.box, age: (now - s.born) / 1000, mesh: s.mesh, irisL: s.irisL, irisR: s.irisR,
        yaw: s.yaw, pitch: s.pitch, gaze: s.gaze, dist: s.dist, score: s.score, contact: s.contact, contactT: s.contactT, gone: s.gone || 0,
      }));
      model = {
        subjects: list, body, contact: contactLevel, status, ms: detMs,
        fovea: { x: fov.x, y: fov.y, path: fov.path.slice(), sac: fov.sacK || 0, lock: cs ? 1 : 0, born: fov.born },
        energy: model.energy,
      };
      return model;
    }

    // fóvea en coordenadas de imagen (u, v hacia abajo, sin espejo)
    function updateFovea(now, eng, cs) {
      const t = now / 1000;
      // sacádico en curso
      const k = clamp((t - fov.sacT) / fov.sacDur);
      fov.sacK = k < 1 ? 1 - k : 0;
      const e = ease(k);
      let x = fov.sx + (fov.fx - fov.sx) * e, y = fov.sy + (fov.fy - fov.sy) * e;
      // seguir al objetivo si es una cara (se mueve con la persona)
      if (fov.target && k >= 1) { const p = fov.target(); if (p) { fov.fx += (p[0] - fov.fx) * 0.25; fov.fy += (p[1] - fov.fy) * 0.25; x = fov.fx; y = fov.fy; } }
      // micro-temblor de fijación
      x += Math.sin(t * 37.1) * 0.0012 + Math.sin(t * 53.7) * 0.0008;
      y += Math.cos(t * 41.3) * 0.0012;
      fov.x = x; fov.y = y;
      if (t < fov.next) return;
      // elegir el siguiente punto
      let pick = null, dwell = 0.3 + Math.random() * 0.9;
      const subs = [...subjects.values()].filter((s) => s.mesh && s.mesh.length);
      const featureOf = (s, which) => () => {
        const cur = subjects.get(s.id); if (!cur || !cur.mesh) return null;
        if (which === 'L' && cur.irisL) return cur.irisL;
        if (which === 'R' && cur.irisR) return cur.irisR;
        const i = which === 'boca' ? 13 : which === 'frente' ? 151 : 1;
        return [cur.mesh[i * 2], cur.mesh[i * 2 + 1]];
      };
      if (cs) {
        pick = featureOf(cs, Math.random() < 0.5 ? 'L' : 'R'); dwell = 0.8 + Math.random() * 1.4;
      } else if (subs.length && Math.random() < 0.85) {
        const s = subs[Math.floor(Math.random() * subs.length)];
        const r = Math.random();
        pick = featureOf(s, r < 0.36 ? 'L' : r < 0.72 ? 'R' : r < 0.86 ? 'boca' : r < 0.95 ? 'nariz' : 'frente');
      } else if (eng && eng.peaks.length) {
        const pk = eng.peaks[Math.floor(Math.random() * Math.min(3, eng.peaks.length))];
        const im = eng.toImage(pk[0] * eng.size[0], pk[1] * eng.size[1]);
        pick = () => im; dwell = 0.5 + Math.random() * 1.2;
      } else {
        const im = [0.3 + Math.random() * 0.4, 0.3 + Math.random() * 0.4]; pick = () => im; dwell = 0.6 + Math.random();
      }
      const p = pick && pick();
      if (!p) { fov.next = t + 0.1; return; }
      if (Math.hypot(p[0] - fov.fx, p[1] - fov.fy) > 0.01) {
        fov.path.push([fov.fx, fov.fy]); if (fov.path.length > 9) fov.path.shift();
        fov.sx = fov.x; fov.sy = fov.y; fov.fx = p[0]; fov.fy = p[1];
        fov.sacT = t; fov.sacDur = 0.045 + Math.hypot(p[0] - fov.x, p[1] - fov.y) * 0.25;
        emit('sacada', { x: p[0], y: p[1] });
      }
      fov.target = pick; fov.next = t + fov.sacDur + dwell;
    }

    return {
      load, update,
      start(v) { video = v; if (!human || running) return; running = true; loop(); },
      stop() { running = false; },
      get running() { return running; },
      get model() { return model; },
      get status() { return status; },
      get error() { return lastErr; },
      get human() { return human; },
      drainEvents() { return events.splice(0, events.length); },
    };
  };

  // ================================================================== capa de ANÁLISIS (lienzo 2D, en píxeles de pantalla)
  const GLYPHS = '0123456789ABCDEF#%<>/\\=+*:.';
  function rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function decode(c, str, x, y, prog, t, seed) {
    const n = str.length, done = Math.floor(clamp(prog) * (n + 2));
    let s = '';
    for (let i = 0; i < n; i++) {
      const ch = str[i];
      if (i < done - 2 || ch === ' ') s += ch;
      else if (i < done) s += GLYPHS[Math.floor(rnd(seed + i * 7.3 + Math.floor(t * 24)) * GLYPHS.length)];
      else s += ' ';
    }
    c.fillText(s, x, y);
  }
  const two = (n) => String(n).padStart(2, '0');
  const fmtT = (s) => two(Math.floor(s / 60)) + ':' + two(Math.floor(s % 60)) + '.' + Math.floor((s % 1) * 10);
  const deg = (r) => (r >= 0 ? '+' : '-') + two(Math.round(Math.abs(r) * 57.3));

  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  OJO.drawAnalysis = function (eng, model, S, nowMs, accent) {
    const c = eng.overlay; const [W, H] = eng.size;
    c.clearRect(0, 0, W, H);
    eng.markOverlay();
    if (!S.analysis || !model) return;
    const t = nowMs / 1000;
    const k = H / 1080;
    const lw = Math.max(1, 1.15 * k);
    const fs = Math.round(Math.max(9, 12.5 * k));
    const INK = 'rgba(242,240,234,', data = S.analysis >= 2;
    c.lineCap = 'square'; c.lineJoin = 'miter';
    c.font = `400 ${fs}px 'JetBrains Mono', ui-monospace, monospace`;
    c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = (fs * 0.16).toFixed(1) + 'px';
    const P = (u, v) => eng.toScreen(u, v);
    const contact = model.contact || 0;

    // ---- esqueleto
    if (model.body) {
      const b = model.body;
      c.strokeStyle = INK + (0.32 * (1 - contact * 0.6)) + ')'; c.lineWidth = lw;
      c.beginPath();
      for (const [i, j] of BONES) {
        if (b[i][2] < 0.3 || b[j][2] < 0.3) continue;
        const p = P(b[i][0], b[i][1]), q = P(b[j][0], b[j][1]);
        c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]);
      }
      c.stroke();
      c.fillStyle = INK + '0.7)';
      for (let i = 5; i < 17; i++) { if (b[i][2] < 0.3) continue; const p = P(b[i][0], b[i][1]); const s = 3 * k; c.fillRect(p[0] - s / 2, p[1] - s / 2, s, s); }
    }

    // ---- sujetos
    for (const s of model.subjects) {
      const fade = 1 - (s.gone || 0);
      if (fade <= 0) continue;
      // caja ajustada a la malla (la del detector lleva mucho margen)
      let bu0 = s.box[0], bv0 = s.box[1], bu1 = s.box[0] + s.box[2], bv1 = s.box[1] + s.box[3];
      if (s.mesh && s.mesh.length >= 936) {
        bu0 = bv0 = 1e9; bu1 = bv1 = -1e9;
        for (let i = 0; i < 468; i++) { const u = s.mesh[i * 2], v = s.mesh[i * 2 + 1]; if (u < bu0) bu0 = u; if (u > bu1) bu1 = u; if (v < bv0) bv0 = v; if (v > bv1) bv1 = v; }
      }
      const a = P(bu0, bv0), b = P(bu1, bv1);
      let x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      const lock = ease(s.age / 0.55);
      const grow = (1 - lock) * Math.max(x1 - x0, y1 - y0) * 0.9;
      const pad = (x1 - x0) * 0.12;
      x0 -= pad + grow; x1 += pad + grow; y0 -= pad * 1.4 + grow; y1 += pad + grow;
      const mg = 18 * k;
      x0 = Math.max(mg, x0); y0 = Math.max(mg + fs * 2.2, y0); x1 = Math.min(W - mg, x1); y1 = Math.min(H - mg, y1);
      const cc = s.contact || 0;
      const col = cc > 0.01 ? rgba(accent, (0.85 + 0.15 * cc) * fade) : INK + (0.85 * fade * (0.4 + 0.6 * lock)) + ')';
      const L = Math.min(x1 - x0, y1 - y0) * 0.16;
      c.strokeStyle = col; c.lineWidth = lw * (1 + cc * 0.8);
      c.beginPath();
      c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0);
      c.moveTo(x1 - L, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + L);
      c.moveTo(x1, y1 - L); c.lineTo(x1, y1); c.lineTo(x1 - L, y1);
      c.moveTo(x0 + L, y1); c.lineTo(x0, y1); c.lineTo(x0, y1 - L);
      c.stroke();
      // ticks de centro
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, tk = 5 * k;
      c.beginPath(); c.moveTo(mx, y0 - tk); c.lineTo(mx, y0 + tk); c.moveTo(mx, y1 - tk); c.lineTo(mx, y1 + tk); c.moveTo(x0 - tk, my); c.lineTo(x0 + tk, my); c.moveTo(x1 - tk, my); c.lineTo(x1 + tk, my); c.stroke();

      const m = s.mesh;
      if (m && m.length >= 936) {
        // malla: se dibuja de arriba abajo al fijar
        const reveal = ease((s.age - 0.25) / 0.9);
        const ymin = s.box[1], ymax = s.box[1] + s.box[3];
        const cut = ymin + (ymax - ymin) * 1.2 * reveal;
        const dot = Math.max(1, 1.5 * k);
        c.fillStyle = cc > 0.01 ? rgba(accent, 0.55 * fade) : INK + (0.42 * fade) + ')';
        for (let i = 0; i < 468; i++) {
          const v = m[i * 2 + 1]; if (v > cut) continue;
          const p = P(m[i * 2], v); c.fillRect(p[0] - dot / 2, p[1] - dot / 2, dot, dot);
        }
        // barrido de la malla
        if (reveal > 0 && reveal < 1) {
          const sy = P(0, cut)[1];
          c.strokeStyle = rgba(accent, 0.9 * fade); c.lineWidth = lw;
          c.beginPath(); c.moveTo(x0, sy); c.lineTo(x1, sy); c.stroke();
        }
        // silueta
        c.strokeStyle = cc > 0.01 ? rgba(accent, 0.8 * fade) : INK + (0.22 * fade * reveal) + ')'; c.lineWidth = lw;
        c.beginPath();
        SIL.forEach((i, n) => { const p = P(m[i * 2], m[i * 2 + 1]); n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
        c.closePath(); c.stroke();
        // iris y mirada
        const eyes = [s.irisL, s.irisR].filter(Boolean);
        eyes.forEach((ir) => {
          const p = P(ir[0], ir[1]); const r = Math.max(3 * k, ir[2] * W * (eng.size[0] / W)) * 1.25;
          const sr = (P(ir[0] + ir[2], ir[1])[0] - p[0]);
          const rr = Math.max(3 * k, Math.abs(sr) * 1.3) || r;
          c.strokeStyle = rgba(accent, (0.65 + cc * 0.35) * fade * reveal); c.lineWidth = lw;
          c.beginPath(); c.arc(p[0], p[1], rr, 0, Math.PI * 2); c.stroke();
          c.fillStyle = rgba(accent, 0.9 * fade * reveal); c.fillRect(p[0] - lw, p[1] - lw, lw * 2, lw * 2);
        });
        if (eyes.length === 2 && s.gaze) {
          const e0 = P((eyes[0][0] + eyes[1][0]) / 2, (eyes[0][1] + eyes[1][1]) / 2);
          const fw = x1 - x0;
          const st = Math.min(1, s.gaze[1]);
          let dx = Math.sin(s.yaw || 0) * 1.4, dy = Math.sin(s.pitch || 0) * 1.4;
          dx += Math.cos(s.gaze[0]) * st * 0.6; dy += Math.sin(s.gaze[0]) * st * 0.6;
          if (S.mirror) dx = -dx;
          c.strokeStyle = INK + (0.5 * fade * reveal * (1 - cc)) + ')';
          c.setLineDash([3 * k, 4 * k]);
          c.beginPath(); c.moveTo(e0[0], e0[1]); c.lineTo(e0[0] + dx * fw, e0[1] + dy * fw); c.stroke();
          c.setLineDash([]);
        }
      }

      // datos
      if (data) {
        const prog = clamp((s.age - 0.2) / 0.8) * fade;
        const lh = fs * 1.55;
        let tx = x1 + 12 * k, ty = y0 + fs;
        const right = tx + fs * 16 > W;
        c.textAlign = right ? 'right' : 'left';
        if (right) tx = x0 - 12 * k;
        if (right && tx - fs * 16 < 0) { c.textAlign = 'left'; tx = x0 + 12 * k; ty = y0 + fs * 2.2; }
        c.fillStyle = cc > 0.01 ? rgba(accent, fade) : INK + (0.92 * fade) + ')';
        decode(c, 'SUJETO ' + two(s.id), tx, ty, prog, t, s.id * 13);
        c.fillStyle = INK + (0.55 * fade) + ')';
        decode(c, 'T+ ' + fmtT(s.age), tx, ty + lh, prog, t, s.id * 13 + 3);
        decode(c, 'GIRO ' + deg(s.yaw || 0) + '  INCL ' + deg(s.pitch || 0), tx, ty + lh * 2, clamp(prog * 1.2 - 0.1), t, s.id * 13 + 5);
        if (s.dist) decode(c, 'DIST ' + s.dist.toFixed(1) + ' M', tx, ty + lh * 3, clamp(prog * 1.2 - 0.2), t, s.id * 13 + 7);
        decode(c, 'CONF ' + (s.score || 0).toFixed(2), tx, ty + lh * (s.dist ? 4 : 3), clamp(prog * 1.2 - 0.3), t, s.id * 13 + 9);
        if (cc > 0.01) {
          c.textAlign = 'center';
          c.fillStyle = rgba(accent, cc * fade);
          const big = Math.round(fs * 1.35);
          c.font = `400 ${big}px 'JetBrains Mono', ui-monospace, monospace`;
          decode(c, 'CONTACTO  ' + fmtT(Math.max(0, s.contactT - 0.45)), (x0 + x1) / 2, y0 - big * 0.9, cc, t, s.id * 31);
          c.font = `400 ${fs}px 'JetBrains Mono', ui-monospace, monospace`;
        }
        c.textAlign = 'left';
      }
    }

    // ---- fóvea: la mirada de la máquina
    const f = model.fovea;
    if (f) {
      const p = P(f.x, f.y);
      const R = (26 - (model.contact || 0) * 10) * k * (1 + (f.sac || 0) * 0.6);
      // recorrido: fijaciones anteriores
      if (f.path && f.path.length) {
        const pts = f.path.map((q) => P(q[0], q[1])).concat([p]);
        for (let i = 1; i < pts.length; i++) {
          const a = (i / pts.length) * 0.45;
          c.strokeStyle = rgba(accent, a); c.lineWidth = lw;
          c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
          c.fillStyle = rgba(accent, a + 0.1); const d = 2.5 * k; c.fillRect(pts[i - 1][0] - d / 2, pts[i - 1][1] - d / 2, d, d);
        }
      }
      c.strokeStyle = rgba(accent, 0.95); c.lineWidth = lw * 1.2;
      c.beginPath(); c.arc(p[0], p[1], R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = INK + '0.9)'; c.lineWidth = lw;
      const g = R * 0.45, o = R * 1.7;
      c.beginPath();
      c.moveTo(p[0] - o, p[1]); c.lineTo(p[0] - R - g * 0.3, p[1]); c.moveTo(p[0] + R + g * 0.3, p[1]); c.lineTo(p[0] + o, p[1]);
      c.moveTo(p[0], p[1] - o); c.lineTo(p[0], p[1] - R - g * 0.3); c.moveTo(p[0], p[1] + R + g * 0.3); c.lineTo(p[0], p[1] + o);
      c.stroke();
      c.fillStyle = rgba(accent, 1); c.fillRect(p[0] - lw, p[1] - lw, lw * 2, lw * 2);
      if (data && !model.subjects.length) {
        c.fillStyle = INK + '0.55)';
        const since = (nowMs - (f.born || 0)) / 1000;
        decode(c, 'BUSCANDO', p[0] + o + 8 * k, p[1] + fs * 0.35, clamp(since / 1.2), t, 99);
      }
    }
  };
})(window);
