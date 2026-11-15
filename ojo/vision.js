/* VØID_LOOM · OJO — la máquina te mira.
   Detección real con Human (tfjs, modelos locales en models/): cara + malla de 468 puntos + iris, y esqueleto (MoveNet).
   Encima: identidad estable (SUJETO 01…), tiempo observado, dirección de la mirada, CONTACTO cuando miras a la cámara,
   y una fóvea artificial que salta con sacádicos entre tus ojos (o lo más saliente de la escena si no hay nadie).
   No calcula edad, género ni emoción.
   El modelo resultante es serializable: la salida lo calcula y la consola lo recibe para dibujarlo en su previa. */
(function (root) {
  'use strict';
  const OJO = root.OJO || (root.OJO = {});

  // rasgos de la malla (índices de MediaPipe FaceMesh): ojos, cejas, labios y nariz
  const FEAT = [
    [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
    [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263],
    [70, 63, 105, 66, 107], [46, 53, 52, 65, 55],
    [300, 293, 334, 296, 336], [276, 283, 282, 295, 285],
    [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61],
    [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78],
    [168, 6, 197, 195, 5, 4], [98, 97, 2, 326, 327],
  ];
  // aristas únicas de la triangulación de la cara (se rellenan al cargar Human)
  let EDGES = null, TRI = null;
  function buildEdges(tri) {
    if (!tri || !tri.length) return;
    const set = new Set(), out = [];
    for (let i = 0; i + 2 < tri.length; i += 3) {
      for (const [a, b] of [[tri[i], tri[i + 1]], [tri[i + 1], tri[i + 2]], [tri[i + 2], tri[i]]]) {
        const k = a < b ? a * 1000 + b : b * 1000 + a;
        if (!set.has(k)) { set.add(k); out.push(a, b); }
      }
    }
    EDGES = new Uint16Array(out);
  }
  const BONES = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 1], [0, 2], [1, 3], [2, 4]];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

  OJO.vision = function () {
    let human = null, video = null, running = false, status = 'apagada';
    const subjects = new Map();
    let nextId = 1, lastDet = 0, detMs = 0, lastErr = null, active = true;
    const events = [];
    const fov = { x: 0.5, y: 0.45, fx: 0.5, fy: 0.45, sx: 0.5, sy: 0.45, sacT: 0, sacDur: 0.07, next: 0, path: [], target: null, born: performance.now() };
    let model = { subjects: [], body: null, fovea: { x: 0.5, y: 0.45, path: [], sac: 0 }, contact: 0, status, energy: 0 };
    let contactLevel = 0, contactOn = false;
    const trails = [[], []];
    const lost = [];

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
        hand: { enabled: true, maxDetected: 2, minConfidence: 0.55, skipFrames: 6, skipTime: 250, detector: { modelPath: 'handtrack.json' }, skeleton: { modelPath: 'handlandmark-lite.json' } },
        object: { enabled: false, modelPath: 'centernet.json', minConfidence: 0.3, maxDetected: 12, skipFrames: 8, skipTime: 400 },
        gesture: { enabled: false }, segmentation: { enabled: false },
      });
      await human.load();
      buildEdges(human.faceTriangulation);
      TRI = human.faceTriangulation ? Uint16Array.from(human.faceTriangulation) : null;
      say('lista');
    }

    async function loop() {
      while (running) {
        const t0 = performance.now();
        if (active && video && video.readyState >= 2 && video.videoWidth) {
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
          if (!best) {
            // ¿es alguien que acaba de perder? recupera su ID y su tiempo observado
            let back = null, bd2 = 0.3;
            for (const g of lost) { const d = Math.hypot(g.cx - cx, g.cy - cy); if (now - g.last < 8000 && d < bd2) { bd2 = d; back = g; } }
            if (back) { lost.splice(lost.indexOf(back), 1); best = back; best.box = b.slice(); best.contactT = 0; subjects.set(best.id, best); }
            else { best = { id: nextId++, born: now, cx, cy, box: b.slice(), contactT: 0, contact: 0 }; subjects.set(best.id, best); emit('entra', { id: best.id, x: cx }); }
          }
          seen.add(best.id);
          best.last = now; best.cx = cx; best.cy = cy;
          for (let i = 0; i < 4; i++) best.box[i] += (b[i] - best.box[i]) * 0.5;
          const mesh = f.mesh || [];
          const m = new Array(mesh.length * 2), mz = new Array(mesh.length);
          for (let i = 0; i < mesh.length; i++) { m[i * 2] = mesh[i][0] / vw; m[i * 2 + 1] = mesh[i][1] / vh; mz[i] = (mesh[i][2] || 0) / vw; }
          best.mesh = m; best.meshZ = mz;
          const irisC = (k) => { const a = f.annotations && f.annotations[k]; if (!a || !a.length) return null; const r = a.length > 1 ? Math.hypot(a[1][0] - a[0][0], a[1][1] - a[0][1]) / vw : 0.006; return [a[0][0] / vw, a[0][1] / vh, r]; };
          best.irisL = irisC('leftEyeIris'); best.irisR = irisC('rightEyeIris');
          const rot = f.rotation || {};
          const ang = rot.angle || {}; const gz = rot.gaze || {};
          best.yaw = ang.yaw || 0; best.pitch = ang.pitch || 0; best.roll = ang.roll || 0;
          best.gaze = [gz.bearing || 0, gz.strength || 0];
          best.dist = f.distance || null; best.score = f.score || 0;
          // ¿me está mirando?
          const s = S.contactSens != null ? S.contactSens : 0.5;
          const look = Math.abs(best.yaw) < 0.08 + 0.22 * s && Math.abs(best.pitch) < 0.12 + 0.26 * s && best.gaze[1] < 0.14 + 0.32 * s;
          best.contactT = look ? best.contactT + 1 / 60 : Math.max(0, best.contactT - 3 / 60);
        }
      }
      // los que se van
      subjects.forEach((s) => {
        s.gone = seen.has(s.id) ? 0 : clamp((now - s.last - 400) / 1600);
        if (!seen.has(s.id) && now - s.last > 2000) { subjects.delete(s.id); lost.push(s); if (lost.length > 12) lost.shift(); emit('sale', { id: s.id }); }
      });
      // cuerpo
      let body = null;
      if (res && res.body && res.body[0] && (res.body[0].score || 0) > 0.25) {
        body = res.body[0].keypoints.map((k) => [k.position[0] / vw, k.position[1] / vh, k.score || 0]);
        if (body.length < 17) body = null;
      }
      // estelas de las muñecas: las manos dibujan luz
      [9, 10].forEach((j, n) => {
        const tr = trails[n];
        if (body && body[j][2] > 0.3) { tr.push([body[j][0], body[j][1]]); if (tr.length > 36) tr.shift(); }
        else if (tr.length) tr.shift();
      });
      // manos (21 puntos) y objetos
      let hands = null, objects = null;
      if (res && res.hand && res.hand.length) {
        hands = res.hand.filter((h) => (h.score || 0) > 0.5 && h.keypoints && h.keypoints.length >= 21)
          .map((h) => ({ pts: h.keypoints.map((q) => [q[0] / vw, q[1] / vh]), score: h.score, label: h.label || '' }));
        if (!hands.length) hands = null;
      }
      if (res && res.object && res.object.length && human.config.object.enabled) {
        objects = res.object.filter((o) => o.box && (o.score || 0) > 0.3)
          .map((o) => ({ label: o.label || '', score: o.score, box: [o.box[0] / vw, o.box[1] / vh, o.box[2] / vw, o.box[3] / vh] }));
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
        id: s.id, box: s.box, age: (now - s.born) / 1000, mesh: s.mesh, meshZ: s.meshZ, irisL: s.irisL, irisR: s.irisR,
        yaw: s.yaw, pitch: s.pitch, gaze: s.gaze, dist: s.dist, score: s.score, contact: s.contact, contactT: s.contactT, gone: s.gone || 0,
      }));
      model = {
        subjects: list, body, hands, objects, trails: trails.map((x) => x.slice()), contact: contactLevel, status, ms: detMs,
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
      // SEGUIMIENTO, MANOS y OBJETOS se encienden y apagan sin recargar modelos ya cargados
      configure(S) {
        active = S.tracking !== false;
        if (!human) return;
        human.config.hand.enabled = S.hands !== false;
        human.config.object.enabled = S.mode === 'objetos';
        if (!active) { subjects.clear(); trails[0].length = 0; trails[1].length = 0; contactLevel = 0; contactOn = false; }
      },
      get active() { return active; },
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

  function drawModel(c, s, eng, S, t, accent, k, lw, fs, data) {
    const [W, H] = eng.size, [cw, ch] = eng.camSize;
    const m = s.mesh, z = s.meshZ, asp = ch && cw ? ch / cw : 0.5625;
    const show = ease((s.age - 0.9) / 0.8) * (1 - (s.gone || 0));
    if (show <= 0) return;
    const hot = (s.contact || 0) > 0.01;
    // esquina contraria a donde está la persona
    const fc = eng.toScreen(s.box[0] + s.box[2] / 2, s.box[1] + s.box[3] / 2);
    const size = H * 0.3, mg = 34 * k;
    const left = fc[0] > W / 2;
    const cx = left ? mg + size * 0.5 : W - mg - size * 0.5, cy = H - mg - size * 0.55;
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < 468; i++) { mx += m[i * 2]; my += m[i * 2 + 1]; mz += z[i]; }
    mx /= 468; my /= 468; mz /= 468;
    const X = new Float32Array(468), Y = new Float32Array(468), Z = new Float32Array(468);
    let ext = 1e-6;
    for (let i = 0; i < 468; i++) {
      X[i] = (m[i * 2] - mx) * (S.mirror ? -1 : 1); Y[i] = (m[i * 2 + 1] - my) * asp; Z[i] = (z[i] - mz) * (S.mirror ? 1 : 1);
      ext = Math.max(ext, Math.abs(X[i]), Math.abs(Y[i]));
    }
    const sc = (size * 0.46 / ext) * (0.85 + 0.15 * show);
    const yaw = Math.sin(t * 0.45) * 1.05 + (S.mirror ? 0 : 0), pit = Math.sin(t * 0.29) * 0.18;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const px = new Float32Array(468), py = new Float32Array(468), pz = new Float32Array(468);
    let z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < 468; i++) {
      const x1 = X[i] * cyw + Z[i] * syw, zz = -X[i] * syw + Z[i] * cyw;
      const y1 = Y[i] * cp - zz * sp, z2 = Y[i] * sp + zz * cp;
      const persp = 1 / (1 + z2 * 1.2);
      px[i] = cx + x1 * sc * persp; py[i] = cy + y1 * sc * persp; pz[i] = z2;
      if (z2 < z0) z0 = z2; if (z2 > z1) z1 = z2;
    }
    const rng = Math.max(1e-6, z1 - z0);
    // barrido de reconstrucción: las aristas aparecen de arriba abajo la primera vez
    const cut = cy - size * 0.5 + size * 1.1 * show;
    const paths = [new Path2D(), new Path2D(), new Path2D()];
    for (let e = 0; e < EDGES.length; e += 2) {
      const i = EDGES[e], j = EDGES[e + 1];
      if (py[i] > cut || py[j] > cut) continue;
      const d = ((pz[i] + pz[j]) * 0.5 - z0) / rng;
      const pa = paths[d < 0.33 ? 0 : d < 0.62 ? 1 : 2];
      pa.moveTo(px[i], py[i]); pa.lineTo(px[j], py[j]);
    }
    const col = (a) => hot ? rgba(accent, a) : `rgba(242,240,234,${a})`;
    c.lineWidth = Math.max(0.6, 0.8 * k);
    [0.55, 0.26, 0.08].forEach((a, n) => { c.strokeStyle = n === 0 ? rgba(accent, a * show) : col(a * show); c.stroke(paths[n]); });
    // rasgos sobre la réplica
    c.strokeStyle = col(0.75 * show); c.lineWidth = lw;
    c.beginPath();
    for (const f of FEAT) { f.forEach((i, n) => { if (py[i] > cut) return; n ? c.lineTo(px[i], py[i]) : c.moveTo(px[i], py[i]); }); }
    c.stroke();
    // línea de escaneo que recorre la réplica
    const sy = cy - size * 0.5 + ((t * 0.35) % 1) * size;
    const g = c.createLinearGradient(cx - size * 0.5, 0, cx + size * 0.5, 0);
    g.addColorStop(0, rgba(accent, 0)); g.addColorStop(0.5, rgba(accent, 0.6 * show)); g.addColorStop(1, rgba(accent, 0));
    c.strokeStyle = g; c.lineWidth = lw;
    c.beginPath(); c.moveTo(cx - size * 0.5, sy); c.lineTo(cx + size * 0.5, sy); c.stroke();
    // marco y datos
    const hx = size * 0.56, hy = size * 0.56, L = 10 * k;
    c.strokeStyle = `rgba(242,240,234,${0.45 * show})`; c.lineWidth = lw;
    c.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const x = cx + a * hx, y = cy + b * hy; c.moveTo(x - a * L, y); c.lineTo(x, y); c.lineTo(x, y - b * L); });
    c.stroke();
    if (data) {
      c.textAlign = left ? 'left' : 'right';
      const tx = left ? cx - hx : cx + hx;
      c.fillStyle = hot ? rgba(accent, show) : `rgba(242,240,234,${0.85 * show})`;
      decode(c, 'MODELO · SUJETO ' + two(s.id), tx, cy - hy - fs * 1.9, show, t, s.id * 53);
      c.fillStyle = `rgba(242,240,234,${0.45 * show})`;
      decode(c, '468 PUNTOS · ' + (EDGES.length / 2) + ' ARISTAS · GIRO ' + deg(yaw), tx, cy - hy - fs * 0.6, show, t, s.id * 53 + 4);
      c.textAlign = 'left';
    }
  }

  OJO.COCO_ES = { person: 'persona', bicycle: 'bicicleta', car: 'coche', motorcycle: 'moto', airplane: 'avión', bus: 'autobús', train: 'tren', truck: 'camión', boat: 'barco',
    'traffic light': 'semáforo', 'fire hydrant': 'boca de incendios', 'stop sign': 'señal de stop', 'parking meter': 'parquímetro', bench: 'banco', bird: 'pájaro', cat: 'gato', dog: 'perro',
    horse: 'caballo', sheep: 'oveja', cow: 'vaca', elephant: 'elefante', bear: 'oso', zebra: 'cebra', giraffe: 'jirafa', backpack: 'mochila', umbrella: 'paraguas', handbag: 'bolso',
    tie: 'corbata', suitcase: 'maleta', frisbee: 'frisbee', skis: 'esquís', snowboard: 'snowboard', 'sports ball': 'pelota', kite: 'cometa', 'baseball bat': 'bate', 'baseball glove': 'guante',
    skateboard: 'monopatín', surfboard: 'tabla de surf', 'tennis racket': 'raqueta', bottle: 'botella', 'wine glass': 'copa', cup: 'taza', fork: 'tenedor', knife: 'cuchillo', spoon: 'cuchara',
    bowl: 'cuenco', banana: 'plátano', apple: 'manzana', sandwich: 'sándwich', orange: 'naranja', broccoli: 'brócoli', carrot: 'zanahoria', 'hot dog': 'perrito', pizza: 'pizza', donut: 'dónut',
    cake: 'pastel', chair: 'silla', couch: 'sofá', 'potted plant': 'planta', bed: 'cama', 'dining table': 'mesa', toilet: 'váter', tv: 'pantalla', laptop: 'portátil', mouse: 'ratón',
    remote: 'mando', keyboard: 'teclado', 'cell phone': 'móvil', microwave: 'microondas', oven: 'horno', toaster: 'tostadora', sink: 'fregadero', refrigerator: 'nevera', book: 'libro',
    clock: 'reloj', vase: 'jarrón', scissors: 'tijeras', 'teddy bear': 'peluche', 'hair drier': 'secador', toothbrush: 'cepillo de dientes' };

  // Delaunay (Bowyer-Watson) sobre una lista plana [x0, y0, x1, y1, …] → índices de triángulos
  function delaunay(P2) {
    const n = P2.length / 2; if (n < 3) return [];
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < n; i++) { const x = P2[i * 2], y = P2[i * 2 + 1]; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    const d = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    const X = Array.from(P2.filter((_, i) => i % 2 === 0)), Y = Array.from(P2.filter((_, i) => i % 2 === 1));
    X.push(mx - d, mx, mx + d); Y.push(my - d, my + d, my - d);
    const circ = (a, b, c) => {
      const ax = X[a], ay = Y[a], bx = X[b], by = Y[b], cx = X[c], cy = Y[c];
      const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-9;
      const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
      const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
      return [ux, uy, (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)];
    };
    let tris = [[n, n + 1, n + 2, ...circ(n, n + 1, n + 2)]];
    for (let i = 0; i < n; i++) {
      const x = X[i], y = Y[i], bad = [], keep = [];
      for (const t of tris) ((x - t[3]) * (x - t[3]) + (y - t[4]) * (y - t[4]) < t[5] ? bad : keep).push(t);
      const edges = new Map();
      for (const t of bad) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = a < b ? a + ',' + b : b + ',' + a; edges.set(k, edges.has(k) ? null : [a, b]);
      }
      tris = keep;
      edges.forEach((e) => { if (e) tris.push([e[0], e[1], i, ...circ(e[0], e[1], i)]); });
    }
    const out = [];
    for (const t of tris) if (t[0] < n && t[1] < n && t[2] < n) out.push(t[0], t[1], t[2]);
    return out;
  }
  OJO.delaunay = delaunay;

  // malla del entorno: triangula en vivo las esquinas de la escena (y las manos) — todo lo que acercas queda tejido
  let envCache = { t: 0, pts: null, tri: null };
  function drawEnvMesh(c, eng, model, S, t, accent, k, lw) {
    const pm = (S.p && S.p.malla) || [];
    const amt = pm[4] != null ? pm[4] : 0.6;
    if (amt <= 0.01) return;
    if (eng.keysT && eng.keysT !== envCache.t) {
      const kp = eng.keys, pts = [];
      for (let i = 0; i < kp.length; i += 3) pts.push(kp[i], kp[i + 1]);
      envCache = { t: eng.keysT, pts, tri: delaunay(pts), r: kp.filter((_, i) => i % 3 === 2) };
    }
    const { pts, tri } = envCache;
    if (!tri || !tri.length) return;
    const [W, H] = eng.size, maxL = H * (0.05 + amt * 0.09);
    const near = new Path2D(), far = new Path2D();
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c2 = tri[i + 2];
      const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1], cx = pts[c2 * 2], cy = pts[c2 * 2 + 1];
      const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by), l3 = Math.hypot(ax - cx, ay - cy);
      const L = Math.max(l1, l2, l3);
      if (L > maxL) continue;   // solo superficies densas: objetos cercanos, no el vacío
      const pa = L < maxL * 0.5 ? near : far;
      pa.moveTo(ax, ay); pa.lineTo(bx, by); pa.lineTo(cx, cy); pa.closePath();
    }
    c.lineWidth = Math.max(0.6, 0.8 * k);
    c.strokeStyle = rgba(accent, 0.5 * amt + 0.15); c.stroke(near);
    c.strokeStyle = `rgba(242,240,234,${0.12 + 0.18 * amt})`; c.stroke(far);
    // nodos
    const dot = Math.max(1, 1.5 * k);
    c.fillStyle = `rgba(242,240,234,${0.35 + 0.4 * amt})`;
    for (let i = 0; i < pts.length; i += 2) c.fillRect(pts[i] - dot / 2, pts[i + 1] - dot / 2, dot, dot);
  }
  function drawHandMesh(c, hp, accent, k) {
    const flat = []; hp.forEach((p) => flat.push(p[0], p[1]));
    const tri = delaunay(flat);
    const pa = new Path2D();
    for (let i = 0; i < tri.length; i += 3) { const a = hp[tri[i]], b = hp[tri[i + 1]], d = hp[tri[i + 2]]; pa.moveTo(a[0], a[1]); pa.lineTo(b[0], b[1]); pa.lineTo(d[0], d[1]); pa.closePath(); }
    c.fillStyle = rgba(accent, 0.06); c.fill(pa);
    c.strokeStyle = rgba(accent, 0.45); c.lineWidth = Math.max(0.6, 0.8 * k); c.stroke(pa);
  }

  OJO.drawAnalysis = function (eng, model, S, nowMs, accent) {
    const c = eng.overlay; const [W, H] = eng.size;
    c.clearRect(0, 0, W, H);
    eng.markOverlay();
    if (!model || !OJO.overlayOn(S)) return;
    const t = nowMs / 1000;
    const k = H / 1080;
    const lw = Math.max(1, 1.15 * k);
    const fs = Math.round(Math.max(9, 12.5 * k));
    const INK = 'rgba(242,240,234,', data = S.analysis >= 2, minimal = !S.analysis;
    c.lineCap = 'square'; c.lineJoin = 'miter';
    c.font = `400 ${fs}px 'JetBrains Mono', ui-monospace, monospace`;
    c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = (fs * 0.16).toFixed(1) + 'px';
    const P = (u, v) => eng.toScreen(u, v);
    const contact = model.contact || 0;

    if (S.mode === 'malla') drawEnvMesh(c, eng, model, S, t, accent, k, lw);

    // ---- cuerpo: rig con articulaciones, ángulos y estelas de las manos
    if (model.body && !minimal) {
      const b = model.body, on = (i) => b[i][2] >= 0.3;
      const bp = b.map((q) => P(q[0], q[1]));
      const dim = 1 - contact * 0.65;
      // huesos: doble trazo fino (contorno técnico)
      c.lineWidth = lw;
      for (const [i, j] of BONES) {
        if (!on(i) || !on(j) || i < 5) continue;
        const p = bp[i], q = bp[j];
        const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L * 3 * k, ny = dx / L * 3 * k;
        c.strokeStyle = INK + (0.3 * dim) + ')';
        c.beginPath(); c.moveTo(p[0] + nx, p[1] + ny); c.lineTo(q[0] + nx, q[1] + ny); c.moveTo(p[0] - nx, p[1] - ny); c.lineTo(q[0] - nx, q[1] - ny); c.stroke();
        c.strokeStyle = rgba(accent, 0.35 * dim);
        c.setLineDash([2 * k, 5 * k]); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]);
      }
      // articulaciones: anillo con marcas que giran
      for (let i = 5; i < 17; i++) {
        if (!on(i)) continue;
        const p = bp[i], r = (i === 9 || i === 10 ? 7 : 5) * k, a0 = t * (i % 2 ? 1.4 : -1.4) + i;
        c.strokeStyle = INK + (0.75 * dim) + ')'; c.lineWidth = lw;
        c.beginPath(); c.arc(p[0], p[1], r, a0, a0 + Math.PI * 0.6); c.moveTo(p[0] + Math.cos(a0 + Math.PI) * r, p[1] + Math.sin(a0 + Math.PI) * r); c.arc(p[0], p[1], r, a0 + Math.PI, a0 + Math.PI * 1.6); c.stroke();
        c.fillStyle = rgba(accent, 0.9 * dim); c.fillRect(p[0] - lw, p[1] - lw, lw * 2, lw * 2);
      }
      // ángulos de codos y rodillas
      if (data) {
        c.font = `400 ${Math.round(fs * 0.85)}px 'JetBrains Mono', ui-monospace, monospace`;
        for (const [a, m, z] of [[5, 7, 9], [6, 8, 10], [11, 13, 15], [12, 14, 16]]) {
          if (!on(a) || !on(m) || !on(z)) continue;
          const A = bp[a], M = bp[m], Z = bp[z];
          const t1 = Math.atan2(A[1] - M[1], A[0] - M[0]), t2 = Math.atan2(Z[1] - M[1], Z[0] - M[0]);
          let d = t2 - t1; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          const r = 16 * k;
          c.strokeStyle = rgba(accent, 0.7 * dim); c.lineWidth = lw;
          c.beginPath(); c.arc(M[0], M[1], r, t1, t1 + d, d < 0); c.stroke();
          c.fillStyle = INK + (0.6 * dim) + ')';
          const mid = t1 + d / 2;
          c.textAlign = 'center';
          c.fillText(Math.round(Math.abs(d) * 57.3) + '°', M[0] + Math.cos(mid) * r * 2.1, M[1] + Math.sin(mid) * r * 2.1 + fs * 0.3);
        }
        c.textAlign = 'left';
        c.font = `400 ${fs}px 'JetBrains Mono', ui-monospace, monospace`;
      }
    }
    // estelas de las manos
    if (model.trails && !minimal) {
      for (const tr of model.trails) {
        if (tr.length < 3) continue;
        const pts = tr.map((q) => P(q[0], q[1]));
        for (let i = 1; i < pts.length; i++) {
          const a = i / pts.length;
          c.strokeStyle = rgba(accent, a * a * 0.9 * (1 - contact * 0.5)); c.lineWidth = lw * (0.6 + a * 2.2);
          c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
        }
      }
    }

    // ---- manos: 21 puntos por mano
    if (model.hands && (!minimal || S.mode === 'malla')) {
      const FING = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]];
      for (const h of model.hands) {
        const hp = h.pts.map((q) => P(q[0], q[1]));
        if (S.mode === 'malla') drawHandMesh(c, hp, accent, k);
        c.strokeStyle = INK + (0.6 * (1 - contact * 0.5)) + ')'; c.lineWidth = lw;
        c.beginPath();
        for (const f of FING) f.forEach((i, n) => (n ? c.lineTo(hp[i][0], hp[i][1]) : c.moveTo(hp[i][0], hp[i][1])));
        c.stroke();
        for (let i = 0; i < 21; i++) {
          const tip = i % 4 === 0 && i > 0;
          const r = (tip ? 3.2 : 1.8) * k;
          c.fillStyle = tip ? rgba(accent, 0.95) : INK + '0.8)';
          c.fillRect(hp[i][0] - r / 2, hp[i][1] - r / 2, r, r);
          if (tip) { c.strokeStyle = rgba(accent, 0.5); c.beginPath(); c.arc(hp[i][0], hp[i][1], r * 2.2, 0, Math.PI * 2); c.stroke(); }
        }
        if (data) {
          c.fillStyle = INK + '0.6)';
          const w0 = hp[0];
          decode(c, (h.label === 'left' ? 'MANO IZQ' : h.label === 'right' ? 'MANO DCHA' : 'MANO') + ' · ' + (h.score || 0).toFixed(2), w0[0] + 10 * k, w0[1] + fs * 1.4, 1, t, 7);
        }
      }
    }

    // ---- objetos (modo OBJETOS)
    if (model.objects && S.mode === 'objetos') {
      const po = (S.p && S.p.objetos) || [0.35, 0.4, 0.5, 0.5];
      const minS = 0.3 + po[1] * 0.5;
      for (const o of model.objects) {
        if (o.score < minS || (o.label === 'person' && po[2] < 0.5)) continue;
        const a = P(o.box[0], o.box[1]), b = P(o.box[0] + o.box[2], o.box[1] + o.box[3]);
        const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        const L = Math.min(x1 - x0, y1 - y0) * 0.18;
        c.strokeStyle = rgba(accent, 0.9); c.lineWidth = lw * 1.2;
        c.beginPath();
        c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0); c.moveTo(x1 - L, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + L);
        c.moveTo(x1, y1 - L); c.lineTo(x1, y1); c.lineTo(x1 - L, y1); c.moveTo(x0 + L, y1); c.lineTo(x0, y1); c.lineTo(x0, y1 - L);
        c.stroke();
        c.strokeStyle = INK + '0.18)'; c.lineWidth = lw; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        const name = (OJO.COCO_ES[o.label] || o.label).toUpperCase();
        c.fillStyle = rgba(accent, 1);
        const ty = y0 > fs * 2 ? y0 - fs * 0.7 : y1 + fs * 1.4;
        decode(c, name, x0, ty, 1, t, name.length * 7);
        if (data) { c.fillStyle = INK + '0.55)'; c.textAlign = 'right'; decode(c, o.score.toFixed(2), x1, ty, 1, t, 3); c.textAlign = 'left'; }
      }
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
      if (!minimal) {
      // onda de choque al fijar
      if (s.age < 0.9) {
        const pr = ease(s.age / 0.9), cxs = (x0 + x1) / 2, cys = (y0 + y1) / 2;
        const rr = Math.max(x1 - x0, y1 - y0) * (0.35 + pr * 1.6);
        c.strokeStyle = rgba(accent, (1 - pr) * 0.85 * fade); c.lineWidth = lw * (1 + (1 - pr) * 2);
        c.beginPath(); c.arc(cxs, cys, rr, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = INK + ((1 - pr) * 0.35 * fade) + ')'; c.lineWidth = lw;
        c.beginPath(); c.arc(cxs, cys, rr * 0.72, 0, Math.PI * 2); c.stroke();
      }
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

      }
      const m = s.mesh;
      if (m && m.length >= 936) {
        // malla: triangulación completa en hilo fino, sombreada por profundidad; se teje de arriba abajo al fijar
        const reveal = ease((s.age - 0.25) / 0.9);
        const ymin = s.box[1], ymax = s.box[1] + s.box[3];
        const cut = ymin + (ymax - ymin) * 1.2 * reveal;
        const pts = new Float32Array(936);
        for (let i = 0; i < 468; i++) { const p = P(m[i * 2], m[i * 2 + 1]); pts[i * 2] = p[0]; pts[i * 2 + 1] = p[1]; }
        const z = s.meshZ;
        let z0 = 0, z1 = 1;
        if (z) { z0 = 1e9; z1 = -1e9; for (let i = 0; i < 468; i++) { if (z[i] < z0) z0 = z[i]; if (z[i] > z1) z1 = z[i]; } if (z1 - z0 < 1e-6) z1 = z0 + 1e-6; }
        const hot = cc > 0.01;
        const wire = (a) => hot ? rgba(accent, a) : INK + a + ')';
        const isMalla = S.mode === 'malla';
        const pm = (S.p && S.p.malla) || [0.12, 0.4, 0.8, 0.35];
        // MALLA: escultura low-poly sombreada con una luz que gira
        if (isMalla && TRI && z) {
          const ppu = Math.abs(P(1, 0)[0] - P(0, 0)[0]) || W;
          const ang = t * (0.15 + pm[1] * 0.9);
          let lx = Math.cos(ang) * 0.7, ly = -0.35 + Math.sin(ang * 0.7) * 0.25, lz = -0.65;
          const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
          const nT = TRI.length / 3, order = new Array(nT), depth = new Float32Array(nT);
          for (let n = 0; n < nT; n++) { order[n] = n; depth[n] = z[TRI[n * 3]] + z[TRI[n * 3 + 1]] + z[TRI[n * 3 + 2]]; }
          order.sort((p, q) => depth[q] - depth[p]);
          const [ar, ag, ab] = OJO.hex3(accent).map((v) => Math.round(v * 255));
          for (const n of order) {
            const i = TRI[n * 3], j = TRI[n * 3 + 1], l = TRI[n * 3 + 2];
            if (m[i * 2 + 1] > cut || m[j * 2 + 1] > cut || m[l * 2 + 1] > cut) continue;
            const ax = pts[i * 2], ay = pts[i * 2 + 1], az = z[i] * ppu;
            const ux = pts[j * 2] - ax, uy = pts[j * 2 + 1] - ay, uz = z[j] * ppu - az;
            const vx = pts[l * 2] - ax, vy = pts[l * 2 + 1] - ay, vz = z[l] * ppu - az;
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
            if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
            const dif = Math.max(0, nx * lx + ny * ly + nz * lz);
            const rim = Math.pow(1 - Math.abs(nz), 2.2);
            const w = dif * dif * (0.25 + pm[2] * 0.75) * fade;
            const ra = (hot ? 0.9 : 0.55) * rim * fade;
            const r = Math.min(255, Math.round(236 * w + ar * ra)), g = Math.min(255, Math.round(234 * w + ag * ra)), bb = Math.min(255, Math.round(228 * w + ab * ra));
            c.fillStyle = `rgb(${r},${g},${bb})`;
            c.beginPath(); c.moveTo(ax, ay); c.lineTo(pts[j * 2], pts[j * 2 + 1]); c.lineTo(pts[l * 2], pts[l * 2 + 1]); c.closePath(); c.fill();
          }
        }
        if (EDGES) {
          // capas de profundidad + banda de escaneo que recorre la cara sin parar
          const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
          const span = Math.max(1e-4, ymax - ymin);
          const band = ymin - span * 0.1 + span * 1.2 * ((t * 0.32 + s.id * 0.37) % 1), bw = span * 0.05;
          for (let e = 0; e < EDGES.length; e += 2) {
            const i = EDGES[e], j = EDGES[e + 1];
            if (m[i * 2 + 1] > cut || m[j * 2 + 1] > cut) continue;
            const vm = (m[i * 2 + 1] + m[j * 2 + 1]) * 0.5;
            const d = z ? ((z[i] + z[j]) * 0.5 - z0) / (z1 - z0) : 0.5;
            const pa = Math.abs(vm - band) < bw && d < 0.7 ? paths[3] : paths[d < 0.33 ? 0 : d < 0.66 ? 1 : 2];
            pa.moveTo(pts[i * 2], pts[i * 2 + 1]); pa.lineTo(pts[j * 2], pts[j * 2 + 1]);
          }
          c.lineWidth = Math.max(0.6, 0.75 * k);
          const boost = isMalla ? 0.4 + pm[3] * 1.6 : 1;
          const al = [0.3, 0.17, 0.06];
          paths.slice(0, 3).forEach((pa, n) => { c.strokeStyle = wire(Math.min(1, al[n] * fade * boost * (hot ? 1.4 : 1))); c.stroke(pa); });
          c.strokeStyle = rgba(accent, 0.85 * fade * reveal); c.lineWidth = Math.max(0.8, 1 * k); c.stroke(paths[3]);
          // nodos: solo los más cercanos, como puntos de anclaje
          if (z) {
            const dot = Math.max(1, 1.6 * k);
            c.fillStyle = wire(0.55 * fade);
            for (let i = 0; i < 468; i += 3) {
              if (m[i * 2 + 1] > cut || (z[i] - z0) / (z1 - z0) > 0.3) continue;
              c.fillRect(pts[i * 2] - dot / 2, pts[i * 2 + 1] - dot / 2, dot, dot);
            }
          }
        } else {
          const dot = Math.max(1, 1.4 * k);
          c.fillStyle = wire(0.4 * fade);
          for (let i = 0; i < 468; i++) { if (m[i * 2 + 1] > cut) continue; c.fillRect(pts[i * 2] - dot / 2, pts[i * 2 + 1] - dot / 2, dot, dot); }
        }
        // rasgos: ojos, cejas, labios y nariz
        c.strokeStyle = wire(0.62 * fade); c.lineWidth = lw;
        c.beginPath();
        for (const f of FEAT) {
          let open = false;
          for (const i of f) {
            if (m[i * 2 + 1] > cut) { open = false; continue; }
            open ? c.lineTo(pts[i * 2], pts[i * 2 + 1]) : c.moveTo(pts[i * 2], pts[i * 2 + 1]);
            open = true;
          }
        }
        c.stroke();
        // barrido mientras se teje
        if (reveal > 0 && reveal < 1) {
          const sy = P(0, cut)[1];
          c.strokeStyle = rgba(accent, 0.9 * fade); c.lineWidth = lw;
          c.beginPath(); c.moveTo(x0, sy); c.lineTo(x1, sy); c.stroke();
        }
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

    // ---- réplica 3D del sujeto principal: la máquina te reconstruye y te gira
    let main = null;
    for (const s of model.subjects) { if ((s.gone || 0) > 0.3 || !s.meshZ || !s.mesh) continue; const sc = s.box[2] * s.box[3] + (s.contact || 0) * 10; if (!main || sc > main.sc) main = { s, sc }; }
    if (main && EDGES && !minimal) drawModel(c, main.s, eng, S, t, accent, k, lw, fs, data);

    // ---- fóvea: la mirada de la máquina
    const f = model.fovea;
    if (f && !minimal) {
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
