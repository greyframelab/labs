/* VØID_LOOM · SEMILLA — ventana de salida.
   Solo la obra, a la resolución del proyector. La consola manda en cada frame qué piezas suenan,
   con qué mandos y en qué instante; aquí se vuelven a dibujar igual (la partitura es determinista).
   El sonido sale de la consola. */
(function () {
  'use strict';
  const SM = window.SEMILLA, eng = new window.SemillaEngine(document.getElementById('c'));
  eng.warm().catch((e) => console.error('[SEMILLA_GPU_FALLO]', e && e.message));
  const wc = document.getElementById('w'), wx = wc.getContext('2d');
  const sizeW = () => { const v = innerWidth >= innerHeight ? [1920, 1080] : [1080, 1920]; if (wc.width !== v[0]) { wc.width = v[0]; wc.height = v[1]; } };
  const ch = new BroadcastChannel('semilla-salida');
  let last = null, lastTs = 0;
  const cache = new Map();
  const piece = (code, o) => {
    const k = code + JSON.stringify(o || {});
    if (!cache.has(k)) { cache.set(k, SM.generate(code, o || {})); if (cache.size > 24) cache.delete(cache.keys().next().value); }
    return cache.get(k);
  };
  ch.onmessage = (e) => { if (e.data && e.data.type === 'frame') last = e.data; };
  setInterval(() => ch.postMessage({ type: 'vivo' }), 500);
  ch.postMessage({ type: 'vivo' });
  // doble clic: pantalla completa; el aviso desaparece al estar a pantalla completa
  const hint = document.getElementById('hint');
  addEventListener('dblclick', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}));
  document.addEventListener('fullscreenchange', () => hint.classList.toggle('off', !!document.fullscreenElement));
  setTimeout(() => hint.classList.add('off'), 9000);
  const pacer = new window.SemillaEngine.Pacer(eng);
  let lastShot = '';
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
    if (!pacer.tick()) return;   // a 30 fps fijos si el ordenador no llega a 60: sin tirones
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    eng.resize(innerWidth * dpr, innerHeight * dpr, eng.scale);
    if (!last) return;
    const late = Math.max(0, Math.min(0.25, (performance.timeOrigin + performance.now() - last.at) / 1000));
    const slots = last.slots.map((s) => {
      const P = piece(s.code, s.o), e = SM.env(P, s.t + late);
      if (last.safe) { e.kick *= 0.6; e.impact *= 0.7; e.metal = Math.min(e.metal, 1.1); }
      return { P, e, w: s.w };
    });
    let stingA = 0;
    if (last.word) { sizeW(); stingA = window.SemillaPalabra.draw(wx, wc.width, wc.height, last.word.w, last.word.t + late, last.word.acc); }
    const top = slots[slots.length - 1], sh = top ? last.slots[last.slots.length - 1].code + ':' + SM.shotAt(top.P, top.e.u / top.P.bar).i : '';
    pacer.cut(sh !== lastShot, dt); lastShot = sh;   // la resolución solo cambia en un corte de plano
    try { eng.draw(slots, Object.assign({}, last.look, { sting: wc, stingA })); } catch (e) { console.error(e); }
    pacer.done(ts);
    { const ls = last.slots[last.slots.length - 1]; if (top) window.SemillaCodigo.draw(document.getElementById('code'), top.P, ls.t + late, top.P.word, !!(last.look && last.look.code)); }
  }
  requestAnimationFrame(frame);
})();
