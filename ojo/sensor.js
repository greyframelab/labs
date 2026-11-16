/* VØID_LOOM · OJO · sensor
   La IA de OJO sin la parte visual: cámara → visión → presencia. Envía por BroadcastChannel('voidloom-presencia')
   lo mismo que la consola de OJO (personas, posición, movimiento, contacto), solo números, nunca la imagen.
   Además avisa a la ventana que lo contiene del estado de la cámara y de la IA. */
(function () {
  'use strict';
  const OJO = window.OJO;
  const ch = new BroadcastChannel('voidloom-presencia');
  const say = (st, extra) => { try { parent.postMessage(Object.assign({ type: 'ojo-sensor', st }, extra || {}), '*'); } catch (e) {} };
  const rt = OJO.runtime(document.getElementById('c'), { preserve: true });
  const S = OJO.defaultState();
  // lo mínimo para ver gente: sin manos, sin capa de análisis, cámara a 480p y el modo más barato
  Object.assign(S, { mode: 'entrada', analysis: 0, hands: false, res: 480, mirror: true, bloom: 0, grain: 0, ca: 0 });
  const dev = new URLSearchParams(location.search).get('cam'); if (dev) S.device = dev;
  rt.setState(S);
  rt.eng.resize(320, 180);
  // LIVE pide ver al visitante: un modo de OJO a 640×360 que la salida funde encima de la pieza.
  // Sin nadie en la sala vuelve al modo más barato a 320×180.
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'ojo-cfg') return;
    if (d.show) { S.mode = d.mode || 'bordes'; S.bloom = 0.25; rt.eng.resize(640, 360); }
    else { S.mode = 'entrada'; S.bloom = 0; rt.eng.resize(320, 180); }
    rt.setState(S);
  });
  let t = 0;
  rt.onFrame = (now, model) => {
    if (rt.localVision) rt.vision.drainEvents();
    if (now - t < 66) return; t = now;
    const subs = model && model.subjects ? model.subjects.filter((s) => (s.gone || 0) < 0.5) : [];
    let x = 0.5, y = 0.5, size = 0;
    const [cw, chh] = rt.eng.camSize;
    if (subs.length && cw) {
      let best = null;
      subs.forEach((s) => { const a = s.box[2] * s.box[3]; if (!best || a > best.a) best = { s, a }; });
      const b = best.s.box; x = (b[0] + b[2] / 2) / cw; y = (b[1] + b[3] * 0.45) / chh; size = Math.min(1, Math.sqrt(best.a / (cw * chh)) * 2); if (S.mirror) x = 1 - x;
    }
    ch.postMessage({ type: 'presencia', n: subs.length, energy: rt.eng.energy || 0, contact: model ? model.contact || 0 : 0, x, y, size, ts: Date.now(), from: 'sensor' });
  };
  (async () => {
    say('camara');
    await rt.camera();
    if (rt.camError) { say('sin-camara', { err: rt.camError }); return; }
    rt.start();
    say('ia');
    try { await rt.loadVision(); rt.useLocalVision(true); say('ok'); }
    catch (e) { say('error-ia', { err: String(e && e.message || e) }); }
  })();
  window.addEventListener('pagehide', () => rt.stop());
})();
