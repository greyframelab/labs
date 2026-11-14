/* Prueba de audio en vivo: Descarga sintetizada en el navegador, con su imagen, A/B contra el .m4a y medidores. */
(function () {
  const $ = (s) => document.querySelector(s);
  const S = window.DSC;
  let ctx, synth, piece = null, origBuf = null, origSrc = null, busSynth, busOrig;
  let imgMode = 1, ab = 'synth', loopSel = 'off';
  const fps = { n: 0, t: performance.now(), v: 0, worst: 0, last: 0 };

  // ---- la pieza: su imagen se dibuja con el mismo reloj que el sonido
  window.VL_LIVE = { register(win, o) { piece = { win, render: o.render, acts: o.acts || [], duration: o.duration }; drawTl(); } };
  $('#piece').src = '../../lab-35-descarga/index.html?live';

  $('#go').addEventListener('click', async () => {
    $('#go').style.display = 'none'; $('#ovlog').textContent = 'PREPARANDO EL SINTETIZADOR…';
    ctx = new AudioContext({ latencyHint: 'interactive' });
    busSynth = ctx.createGain(); busOrig = ctx.createGain(); busOrig.gain.value = 0;
    busSynth.connect(ctx.destination); busOrig.connect(ctx.destination);
    synth = window.VLSynth(ctx, busSynth, S, { duration: piece ? piece.duration : undefined });
    window.__synth = synth; window.__tap = busSynth;
    try { origBuf = await ctx.decodeAudioData(await (await fetch('../../lab-35-descarga/descarga.m4a')).arrayBuffer()); } catch (e) { $('#ab [data-v=orig]').textContent = 'ORIGINAL NO DISPONIBLE'; }
    if (ctx.renderCapacity) { try { ctx.renderCapacity.start({ updateInterval: 1 }); ctx.renderCapacity.addEventListener('update', (e) => (cap = e)); } catch (e) {} }
    $('#ov').classList.add('off');
    requestAnimationFrame(frame);
  });
  let cap = null;

  // ---- transporte
  const loops = () => (loopSel === 'off' ? null : S.LOOPS[+loopSel]);
  function lat() { return ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0; }
  function posNow() { return synth && synth.playing ? Math.max(0, synth.posAt(ctx.currentTime - lat())) : (posNow.held || 0); }
  function startAt(p) {
    const lp = loops(); if (lp && (p < lp[0] || p >= lp[1])) p = lp[0];
    const t0 = synth.start(p, lp);
    if (origSrc) { try { origSrc.stop(); } catch (e) {} origSrc = null; }
    if (origBuf) {
      origSrc = ctx.createBufferSource(); origSrc.buffer = origBuf; origSrc.connect(busOrig);
      if (lp) { origSrc.loop = true; origSrc.loopStart = lp[0]; origSrc.loopEnd = lp[1]; }
      origSrc.start(t0, p);
    }
    $('#play').classList.add('on'); $('#play').textContent = 'STOP · ESPACIO';
  }
  function stopAll() { posNow.held = posNow(); synth.stop(); if (origSrc) { try { origSrc.stop(); } catch (e) {} origSrc = null; } $('#play').classList.remove('on'); $('#play').textContent = 'PLAY · ESPACIO'; }
  const toggle = () => { if (!synth) return; if (synth.playing) stopAll(); else startAt(posNow.held >= synth.DUR - 0.05 ? 0 : posNow.held || 0); };
  $('#play').addEventListener('click', toggle);
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); toggle(); } });

  function seg(sel, cb) { const bs = [...document.querySelectorAll(sel + ' button')]; bs.forEach((b) => b.addEventListener('click', () => { bs.forEach((x) => x.classList.toggle('on', x === b)); cb(b.dataset.v); })); }
  seg('#ab', (v) => { ab = v; if (!ctx) return; const t = ctx.currentTime; busSynth.gain.setTargetAtTime(v === 'synth' ? 1 : 0, t, 0.02); busOrig.gain.setTargetAtTime(v === 'orig' ? 1 : 0, t, 0.02); });
  seg('#loop', (v) => { loopSel = v; if (synth && synth.playing) startAt(posNow()); });
  seg('#stress', (v) => { if (synth) { synth.setStress(+v); synth.resetStats(); fps.worst = 0; } });
  seg('#img', (v) => { imgMode = +v; fps.worst = 0; });
  const slider = (id, out, fn) => $(id).addEventListener('input', (e) => { $(out).textContent = e.target.value; synth && fn(e.target.value / 100); });
  slider('#tension', '#vT', (v) => synth.setTension(v));
  slider('#density', '#vD', (v) => synth.setDensity(v));
  slider('#room', '#vR', (v) => synth.setRoom(v));
  $('#reset').addEventListener('click', () => { if (synth) synth.resetStats(); fps.worst = 0; });

  // ---- línea de tiempo con actos y golpes; clic = saltar
  const tl = $('#tl');
  tl.addEventListener('pointerdown', (e) => { if (!synth) return; const r = tl.getBoundingClientRect(), p = (e.clientX - r.left) / r.width * synth.DUR; if (synth.playing) startAt(p); else posNow.held = p; });
  function drawTl() {
    const r = tl.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (tl.width !== W) { tl.width = W; tl.height = H; }
    const g = tl.getContext('2d'), D = (synth && synth.DUR) || (piece && piece.duration) || 24.4, X = (t) => t / D * W;
    g.fillStyle = '#070707'; g.fillRect(0, 0, W, H);
    g.font = `${9 * dpr}px 'JetBrains Mono', monospace`; g.textBaseline = 'top';
    if (piece) piece.acts.forEach(([t0, n]) => { g.fillStyle = '#2a2927'; g.fillRect(X(t0), 0, dpr, H); g.fillStyle = '#5d5b57'; g.fillText(n, X(t0) + 5 * dpr, 6 * dpr); });
    const lp = loops(); if (lp) { g.fillStyle = 'rgba(180,140,255,.14)'; g.fillRect(X(lp[0]), 22 * dpr, X(lp[1]) - X(lp[0]), H); }
    const colors = { K: '#f2f0ea', S: '#B48CFF', H: '#3a3936', R: '#FF1A1A' };
    for (const e of S.EV) { const c = colors[e.v]; if (!c) continue; g.fillStyle = c; const h = e.v === 'H' ? 6 : e.v === 'R' ? H - 26 * dpr : 12; g.fillRect(X(e.t), H - 6 * dpr - h * (e.v === 'R' ? 1 : dpr), dpr, h * (e.v === 'R' ? 1 : dpr)); }
    const p = posNow(); g.fillStyle = '#B48CFF'; g.shadowColor = '#B48CFF'; g.shadowBlur = 10 * dpr; g.fillRect(X(p) - dpr, 0, 2 * dpr, H); g.shadowBlur = 0;
  }

  // ---- bucle: imagen + medidores
  const tc = (x) => { const s = Math.floor(x), f = Math.floor((x - s) * 60); return '00:' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0'); };
  function meter(id, v, cls) { const el = $(id); el.className = 'm ' + (cls || ''); el.querySelector('.v').innerHTML = v; }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = fps.last ? now - fps.last : 16; fps.last = now; fps.n++; fps.worst = Math.max(fps.worst * 0.995, dt);
    if (now - fps.t > 500) { fps.v = Math.round(fps.n * 1000 / (now - fps.t)); fps.n = 0; fps.t = now; }
    const p = posNow();
    if (piece && imgMode > 0) { try { if (imgMode > 1) piece.render((p + 7) % (synth ? synth.DUR : 24)); piece.render(p); } catch (e) {} }
    drawTl();
    $('#pos').textContent = tc(p);
    if (!synth) return;
    const st = synth.stats;
    meter('#mV', st.voices, '');
    const mm = st.worstMargin === Infinity ? null : Math.round(st.worstMargin);
    meter('#mM', mm == null ? '—' : mm + '<small>ms</small>', mm == null ? '' : mm >= 40 ? 'ok' : mm >= 15 ? 'warn' : 'err');
    meter('#mL', st.late, st.late ? 'err' : 'ok');
    meter('#mJ', Math.round(st.tickJitter) + '<small>ms</small>', st.tickJitter < 40 ? 'ok' : st.tickJitter < 90 ? 'warn' : 'err');
    meter('#mF', imgMode ? fps.v + '<small>fps · pico ' + Math.round(fps.worst) + ' ms</small>' : 'APAGADA', !imgMode ? '' : fps.v >= 55 ? 'ok' : fps.v >= 40 ? 'warn' : 'err');
    if (cap) meter('#mC', Math.round(cap.averageLoad * 100) + '<small>% · pico ' + Math.round(cap.peakLoad * 100) + '% · cortes ' + (cap.underrunRatio * 100).toFixed(1) + '%</small>', cap.peakLoad < 0.7 && !cap.underrunRatio ? 'ok' : cap.peakLoad < 0.95 ? 'warn' : 'err');
    else meter('#mC', 'N/D', '');
    const ok = !st.late && (mm == null || mm >= 15) && st.tickJitter < 90 && (!imgMode || fps.v >= 40);
    $('#verdict').innerHTML = !synth.playing ? 'Pulsa PLAY y sube el estrés poco a poco.' : ok
      ? `<b>AGUANTA</b> con estrés ×${synth.P.stress} e imagen ${imgMode === 2 ? 'de 2 piezas' : imgMode ? 'de 1 pieza' : 'apagada'}. Sube un nivel.`
      : `<b>AL LÍMITE</b> con estrés ×${synth.P.stress}: ${st.late ? st.late + ' golpes tarde. ' : ''}${mm != null && mm < 15 ? 'margen bajo. ' : ''}${imgMode && fps.v < 40 ? 'la imagen cae a ' + fps.v + ' fps.' : ''}`;
  }
  requestAnimationFrame(function idle() { if (!ctx) { drawTl(); requestAnimationFrame(idle); } });
})();
