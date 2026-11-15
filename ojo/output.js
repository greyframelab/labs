/* VØID_LOOM · OJO — salida para proyector.
   Abre su propia cámara (la misma que eligió la consola), calcula la visión a resolución completa
   y manda a la consola el modelo de lo que ve (sujetos, mirada, contacto) y los eventos. */
(function () {
  'use strict';
  const ch = new BroadcastChannel(OJO.CHANNEL);
  const cv = document.getElementById('out');
  const hint = document.getElementById('hint'), hs = document.getElementById('hs');
  const Q = new URLSearchParams(location.search);
  let quality = 1, got = false;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = innerWidth * dpr * quality, h = innerHeight * dpr * quality;
    const k = Math.min(1, 1920 / Math.max(w, h));
    rt.eng.resize(Math.round(w * k), Math.round(h * k));
  }
  const rt = OJO.runtime(cv, { lowLatency: true });
  rt.setState(OJO.defaultState());
  size();
  addEventListener('resize', size);

  const rec = rt.recorder();
  let lastSend = 0;
  rt.onFrame = (now) => {
    if (now - lastSend < 50) return;
    lastSend = now;
    const m = rt.localVision ? rt.vision.model : null;
    ch.postMessage({
      type: 'model', m, events: rt.localVision ? rt.vision.drainEvents() : [],
      fps: rt.fps, size: rt.eng.size, cam: rt.eng.camSize, camLabel: rt.camLabel, camError: rt.camError, rec: rec.on ? rec.secs : -1,
      energy: rt.eng.energy,
    });
  };

  ch.onmessage = (e) => {
    const d = e.data || {};
    if (d.type === 'state') {
      rt.setState(d.S);
      if (d.quality && d.quality !== quality) { quality = d.quality; size(); }
      if (!got) { got = true; hs.textContent = 'CONECTADA'; setTimeout(() => hint.classList.add('off'), 1600); }
    } else if (d.type === 'rec') { d.on ? rec.start() : rec.stop(); }
    else if (d.type === 'shot') rt.capture('ojo-salida');
    else if (d.type === 'close') window.close();
  };

  addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  });
  addEventListener('dblclick', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); });
  addEventListener('beforeunload', () => ch.postMessage({ type: 'bye' }));

  rt.start();
  ch.postMessage({ type: 'hello' });
  rt.loadVision((s) => { if (!got) hs.textContent = 'IA · ' + s.toUpperCase(); })
    .then(() => rt.useLocalVision(true))
    .catch((err) => { console.error(err); ch.postMessage({ type: 'vision-error', msg: String(err) }); });
  if (Q.has('instalacion')) setTimeout(() => document.documentElement.requestFullscreen().catch(() => {}), 500);
})();
