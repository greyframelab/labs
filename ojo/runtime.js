/* VØID_LOOM · OJO — bucle común de consola y salida: cámara → visión → motor → pantalla.
   El reloj de la firma es compartido entre ventanas (performance.timeOrigin + now). */
(function (root) {
  'use strict';
  const OJO = root.OJO;
  OJO.CHANNEL = 'voidloom-ojo';
  OJO.wall = () => performance.timeOrigin + performance.now();

  OJO.runtime = function (canvas, opt = {}) {
    const eng = OJO.engine(canvas, { lowLatency: opt.lowLatency });
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    eng.setVideo(video);

    // firma (VL de void-loom-sting.js, cargado con VL_SIZE = 1920×1080)
    if (window.VL && window.VL.drawSting) {
      const sc = document.createElement('canvas'); sc.width = window.VL.W; sc.height = window.VL.H;
      const sx = sc.getContext('2d');
      eng.setSting(sc, (ts, accent) => { sx.globalCompositeOperation = 'source-over'; sx.clearRect(0, 0, sc.width, sc.height); sx.globalCompositeOperation = 'lighter'; window.VL.drawSting(sx, ts, { accent }); });
    }

    let S = OJO.defaultState();
    let stream = null, camKey = '', camBusy = false, camError = null, camLabel = '';
    const V = OJO.vision();
    let visionOn = false, remote = null, remoteAt = 0;
    let fps = 0, lastF = 0, raf = 0;
    const self = {
      eng, video, vision: V,
      get state() { return S; },
      get fps() { return fps; },
      get camError() { return camError; },
      get camLabel() { return camLabel; },
      get model() { return visionOn ? V.model : remote; },
      setState(ns) { S = ns; eng.setState(S); },
      setRemoteModel(m) { remote = m; remoteAt = performance.now(); },
      onFrame: null,
      async loadVision(onStatus) { await V.load(onStatus); },
      useLocalVision(on) { if (on === visionOn) return; visionOn = on; if (on) V.start(video); else V.stop(); },
      get localVision() { return visionOn; },
      async camera() {
        const key = (S.device || '') + '@' + S.res;
        if (camBusy || (key === camKey && stream)) return;
        camBusy = true; camKey = key;
        try {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          const h = S.res, w = Math.round(h * 16 / 9);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { deviceId: S.device ? { exact: S.device } : undefined, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 60 } },
          });
          video.srcObject = stream;
          await video.play().catch(() => {});
          const tr = stream.getVideoTracks()[0]; camLabel = tr ? tr.label : '';
          camError = null;
          if (visionOn) V.start(video);
        } catch (e) { camError = e.name || String(e); camKey = ''; }
        camBusy = false;
      },
      start() {
        const loop = (now) => {
          raf = requestAnimationFrame(loop);
          if (lastF) fps = fps * 0.92 + (1000 / Math.max(1, now - lastF)) * 0.08;
          lastF = now;
          if (((S.device || '') + '@' + S.res) !== camKey) self.camera();
          const wall = OJO.wall();
          let model = visionOn ? V.update(now, eng, S) : remote;
          if (!visionOn && remote && now - remoteAt > 4000) model = null;
          // cara principal para los modos: la que tiene contacto o la más grande
          let face = null, focus = null;
          if (model && model.subjects && model.subjects.length) {
            let best = null;
            model.subjects.forEach((s) => { if ((s.gone || 0) > 0.5) return; const sc = s.box[2] * s.box[3] + (s.contact || 0) * 10; if (!best || sc > best.sc) best = { s, sc }; });
            if (best) {
              const [W, H] = eng.size, b = best.s.box;
              const p = eng.toScreen(b[0] + b[2] / 2, b[1] + b[3] * 0.45);
              const q = eng.toScreen(b[0] + b[2], b[1]);
              const r = Math.abs(q[0] - p[0]) / H * 1.5;
              face = [p[0] / W, 1 - p[1] / H, r];
              focus = [b[0] + b[2] / 2, b[1] + b[3] * 0.45];
            }
          }
          eng.setVision({ face, focus, contact: model ? model.contact || 0 : 0 });
          OJO.drawAnalysis(eng, model, S, wall, OJO.ACCENTS[S.acc[S.mode]] || '#F2F0EA');
          eng.frame(wall, now / 1000);
          if (self.onFrame) self.onFrame(now, model);
        };
        raf = requestAnimationFrame(loop);
      },
      stop() { cancelAnimationFrame(raf); V.stop(); if (stream) stream.getTracks().forEach((t) => t.stop()); },
      async capture(name) {
        const b = await eng.capture();
        if (b) OJO.download(b, (name || 'ojo') + '-' + OJO.stamp() + '.png');
      },
      recorder() { return OJO.recorder(canvas); },
    };
    return self;
  };

  OJO.stamp = function () { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };
  OJO.download = function (blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  // grabación de la salida: H.264 en MP4 si el navegador lo permite, si no WebM
  OJO.recorder = function (canvas) {
    let rec = null, chunks = [], t0 = 0;
    const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    return {
      get on() { return !!rec; },
      get secs() { return rec ? (performance.now() - t0) / 1000 : 0; },
      start() {
        if (rec || !mime) return false;
        const st = canvas.captureStream(60);
        rec = new MediaRecorder(st, { mimeType: mime, videoBitsPerSecond: 24e6 });
        chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => { const b = new Blob(chunks, { type: mime }); OJO.download(b, 'ojo-' + OJO.stamp() + (mime.includes('mp4') ? '.mp4' : '.webm')); st.getTracks().forEach((t) => t.stop()); };
        rec.start(1000); t0 = performance.now(); return true;
      },
      stop() { if (!rec) return; rec.stop(); rec = null; },
    };
  };
})(window);
