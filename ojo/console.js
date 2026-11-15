/* VØID_LOOM · OJO — consola.
   Previa en vivo + mandos. La salida (output.html) recibe el estado por BroadcastChannel; si está abierta,
   es ella la que ejecuta la IA a resolución completa y la consola dibuja lo que la salida le cuenta. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const INSTALL = Q.has('instalacion');
  const ch = new BroadcastChannel(OJO.CHANNEL);
  const KEY = 'voidloom-ojo-ajustes';

  // ------------------------------------------------------------------ estado
  const S = OJO.defaultState();
  let quality = 1;
  try {
    const sv = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (sv) {
      // v2: el bloom, el grano y la aberración bajaron; los ajustes guardados antes vuelven al nuevo valor
      const keys = sv.v >= 2 ? ['mode', 'analysis', 'bloom', 'grain', 'ca', 'mirror', 'contactSens', 'device', 'res'] : ['mode', 'analysis', 'mirror', 'contactSens', 'device', 'res'];
      keys.forEach((k) => { if (sv[k] != null) S[k] = sv[k]; });
      if (sv.p) OJO.MODES.forEach((m) => { if (Array.isArray(sv.p[m.id]) && sv.p[m.id].length === m.params.length) S.p[m.id] = sv.p[m.id]; });
      if (sv.acc) OJO.MODES.forEach((m) => { if (OJO.ACCENTS[sv.acc[m.id]]) S.acc[m.id] = sv.acc[m.id]; });
      if (sv.quality) quality = sv.quality;
    }
  } catch (e) {}
  S.freeze = false; S.black = false; S.firma = 0; S.trail = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, S, { quality, firma: 0, v: 2 }))); } catch (e) {} };

  const prev = $('prev');
  const rt = OJO.runtime(prev);
  rt.setState(S);
  const snd = OJO.sound();
  let rec = null;

  function push() { save(); ch.postMessage({ type: 'state', S, quality }); paint(); }
  const accHex = () => OJO.ACCENTS[S.acc[S.mode]];

  // ------------------------------------------------------------------ registro
  const logEl = $('log');
  const clock = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); };
  function log(txt, cls) {
    const d = document.createElement('div'); if (cls) d.className = cls;
    d.innerHTML = '<i>' + clock() + '</i>' + txt;
    logEl.prepend(d);
    while (logEl.children.length > 40) logEl.lastChild.remove();
  }
  const ages = {};
  function onEvent(ev) {
    snd.event(ev);
    const id = ev.id != null ? 'SUJETO ' + String(ev.id).padStart(2, '0') : '';
    if (ev.type === 'entra') { ages[ev.id] = performance.now(); log(id + ' · ENTRA EN EL CAMPO', 'hot'); }
    else if (ev.type === 'sale') { const a = ages[ev.id] ? (performance.now() - ages[ev.id]) / 1000 : 0; log(id + ' · SALE · OBSERVADO ' + a.toFixed(1) + ' S'); delete ages[ev.id]; }
    else if (ev.type === 'contacto') log('CONTACTO · ' + id + ' TE MIRA', 'acc');
    else if (ev.type === 'fin-contacto') log('FIN DEL CONTACTO');
  }

  // ------------------------------------------------------------------ modos
  const list = $('modeList');
  OJO.MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'mode'; b.dataset.id = m.id;
    b.innerHTML = `<span class="k">${i + 1}</span><span class="nm"><b>${m.name}</b><span>${m.idea}</span></span>`;
    b.onclick = () => setMode(m.id);
    list.appendChild(b);
  });
  function setMode(id, quiet) {
    if (S.mode === id) return;
    S.mode = id; S.trail = null; autoT0 = performance.now();
    snd.event({ type: 'modo' });
    if (!quiet) log('MODO · ' + OJO.MODES[OJO.modeIndex(id)].name);
    buildParams(); push();
  }
  const step = (d) => { const i = OJO.modeIndex(S.mode), n = OJO.MODES.length; setMode(OJO.MODES[(i + d + n) % n].id); };

  // ------------------------------------------------------------------ sliders
  function slider(parent, label, get, set, opts = {}) {
    const row = document.createElement('label'); row.className = 'sl';
    const min = opts.min ?? 0, max = opts.max ?? 1, st = opts.step ?? 0.01;
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${st}"><output></output>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    const show = () => { const v = get(); inp.value = v; out.textContent = Math.round((v - min) / (max - min) * 100); inp.style.setProperty('--v', ((v - min) / (max - min) * 100) + '%'); };
    inp.oninput = () => { set(parseFloat(inp.value)); show(); push(); };
    if (opts.reset != null) row.ondblclick = () => { set(opts.reset); show(); push(); };
    parent.appendChild(row); show();
    return show;
  }
  let paramShows = [];
  function buildParams() {
    const m = OJO.MODES[OJO.modeIndex(S.mode)];
    $('pTitle').textContent = m.name;
    const pl = $('pList'); pl.innerHTML = ''; paramShows = [];
    m.params.forEach((p, i) => paramShows.push(slider(pl, p[1], () => S.p[m.id][i], (v) => (S.p[m.id][i] = v), { reset: p[2] })));
    paramShows.push(slider(pl, 'ESTELA', () => (S.trail == null ? m.trail : S.trail), (v) => (S.trail = v), { reset: null }));
  }
  const gl = $('gList');
  const gShows = [
    slider(gl, 'BLOOM', () => S.bloom, (v) => (S.bloom = v), { reset: 0.3 }),
    slider(gl, 'GRANO', () => S.grain, (v) => (S.grain = v), { reset: 0.22 }),
    slider(gl, 'ABERRACIÓN', () => S.ca, (v) => (S.ca = v), { reset: 0.25 }),
    slider(gl, 'CONTACTO', () => S.contactSens, (v) => (S.contactSens = v), { reset: 0.5 }),
  ];

  // acentos
  const sw = $('swatches');
  Object.entries(OJO.ACCENTS).forEach(([k, hex]) => {
    const b = document.createElement('button'); b.dataset.k = k; b.title = k.toUpperCase(); b.style.setProperty('--c', hex);
    b.innerHTML = '<i></i>';
    b.onclick = () => { S.acc[S.mode] = k; push(); };
    sw.appendChild(b);
  });

  // análisis
  $('anSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.analysis = +b.dataset.a; push(); };
  $('resSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.res = +b.dataset.r; push(); };
  $('bMirror').onclick = () => { S.mirror = !S.mirror; push(); };
  $('bFreeze').onclick = () => { S.freeze = !S.freeze; push(); };
  $('bBlack').onclick = () => { S.black = !S.black; push(); };
  const qOut = $('qOut'); qOut.value = quality; $('qOutV').textContent = Math.round(quality * 100);
  qOut.oninput = () => { quality = +qOut.value; $('qOutV').textContent = Math.round(quality * 100); push(); };
  $('vol').oninput = () => { const v = +$('vol').value; $('volV').textContent = Math.round(v * 100); snd.setVolume(v); };

  // cámaras
  async function listCams() {
    try {
      const ds = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const sel = $('selCam'); sel.innerHTML = '';
      ds.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId; o.textContent = (d.label || 'CÁMARA ' + (i + 1)).toUpperCase(); sel.appendChild(o); });
      if (!ds.find((d) => d.deviceId === S.device)) S.device = '';
      sel.value = S.device || (ds[0] && ds[0].deviceId) || '';
      sel.onchange = () => { S.device = sel.value; log('CÁMARA · ' + sel.selectedOptions[0].textContent); push(); };
    } catch (e) {}
  }
  if (navigator.mediaDevices) navigator.mediaDevices.addEventListener('devicechange', listCams);

  // ------------------------------------------------------------------ salida
  let outWin = null, outAt = 0, outInfo = null, outRec = -1;
  function openOutput() {
    if (outWin && !outWin.closed) { outWin.focus(); return; }
    outWin = window.open('output.html' + (INSTALL ? '?instalacion' : ''), 'voidloom-ojo-salida', 'popup,width=1280,height=720');
    log('SALIDA · ABIERTA · ARRÁSTRALA AL PROYECTOR Y PULSA F');
  }
  window.OJO_CONSOLE = { openOutput, rt };
  ch.onmessage = (e) => {
    const d = e.data || {};
    if (d.type === 'hello') { push(); }
    else if (d.type === 'model') {
      const was = outAt && performance.now() - outAt < 4000;
      outAt = performance.now(); outInfo = d; outRec = d.rec;
      if (!was) { log('SALIDA · CONECTADA', 'hot'); rt.useLocalVision(false); }
      if (d.m) rt.setRemoteModel(d.m);
      (d.events || []).forEach(onEvent);
    } else if (d.type === 'bye') { outAt = 0; log('SALIDA · CERRADA'); if (visionReady) rt.useLocalVision(true); }
    else if (d.type === 'vision-error') log('SALIDA · LA IA NO ARRANCÓ: ' + d.msg, 'acc');
  };
  const outAlive = () => outAt && performance.now() - outAt < 4000;

  // ------------------------------------------------------------------ cabecera
  $('bOut').onclick = openOutput;
  $('bSnd').onclick = toggleSound;
  async function toggleSound() { if (snd.on) { snd.stop(); log('SONIDO · APAGADO'); } else { await snd.start(); log('SONIDO · ENCENDIDO'); } paint(); }
  $('bShot').onclick = shot;
  function shot() { if (outAlive()) { ch.postMessage({ type: 'shot' }); log('CAPTURA · SALIDA'); } else { rt.capture('ojo-previa'); log('CAPTURA · PREVIA'); } }
  $('bRec').onclick = toggleRec;
  function toggleRec() {
    if (outAlive()) { ch.postMessage({ type: 'rec', on: outRec < 0 }); log(outRec < 0 ? 'GRABANDO LA SALIDA' : 'GRABACIÓN GUARDADA', outRec < 0 ? 'acc' : ''); return; }
    if (!rec) rec = rt.recorder();
    if (rec.on) { rec.stop(); log('GRABACIÓN GUARDADA'); } else if (rec.start()) log('GRABANDO LA PREVIA · ABRE LA SALIDA PARA GRABAR A RESOLUCIÓN COMPLETA', 'acc');
    paint();
  }
  $('bFirma').onclick = firma;
  let firmaTimer = 0;
  function firma() { S.firma = OJO.wall(); push(); clearTimeout(firmaTimer); firmaTimer = setTimeout(() => { S.firma = 0; push(); }, 5600); }
  $('bHelp').onclick = () => $('help').classList.toggle('on');
  $('help').onclick = () => $('help').classList.remove('on');

  // AUTO
  let autoOn = INSTALL, autoSec = 45, autoT0 = performance.now();
  $('bAuto').onclick = () => { autoOn = !autoOn; autoT0 = performance.now(); log(autoOn ? 'AUTO · CADA ' + autoSec + ' S' : 'AUTO · APAGADO'); paint(); };
  $('autoSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; autoSec = +b.dataset.s; [...$('autoSeg').children].forEach((x) => x.classList.toggle('on', x === b)); };

  // ------------------------------------------------------------------ pintar UI
  function paint() {
    const m = OJO.MODES[OJO.modeIndex(S.mode)];
    document.documentElement.style.setProperty('--acc', accHex());
    [...list.children].forEach((b) => { b.classList.toggle('on', b.dataset.id === S.mode); b.style.setProperty('--ma', OJO.ACCENTS[S.acc[b.dataset.id]]); });
    [...sw.children].forEach((b) => b.classList.toggle('on', b.dataset.k === S.acc[S.mode]));
    $('pAcc').textContent = S.acc[S.mode].toUpperCase();
    [...$('anSeg').children].forEach((b) => b.classList.toggle('on', +b.dataset.a === S.analysis));
    [...$('resSeg').children].forEach((b) => b.classList.toggle('on', +b.dataset.r === S.res));
    $('bMirror').classList.toggle('on', S.mirror); $('bFreeze').classList.toggle('on', S.freeze); $('bBlack').classList.toggle('on', S.black);
    $('bSnd').classList.toggle('on', snd.on); $('bAuto').classList.toggle('on', autoOn);
    $('vBig').textContent = m.name;
    paramShows.forEach((f) => f()); gShows.forEach((f) => f());
  }

  // ------------------------------------------------------------------ previa
  const view = prev.parentElement;
  function sizePrev() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const solo = document.body.classList.contains('solo');
    let w = view.clientWidth * dpr, h = view.clientHeight * dpr;
    const k = Math.min(1, (solo ? 1920 : 1280) / Math.max(w, h));
    if (w > 0 && h > 0) rt.eng.resize(Math.round(w * k), Math.round(h * k));
  }
  new ResizeObserver(sizePrev).observe(view);

  let lastUI = 0;
  rt.onFrame = (now, model) => {
    if (rt.localVision) rt.vision.drainEvents().forEach(onEvent);
    const n = model && model.subjects ? model.subjects.filter((s) => (s.gone || 0) < 0.5).length : 0;
    snd.update(outAlive() && outInfo ? outInfo.energy : rt.eng.energy, n, model ? model.contact : 0);
    // AUTO
    if (autoOn) {
      const k = (now - autoT0) / (autoSec * 1000);
      $('autoBar').style.width = Math.min(100, k * 100) + '%';
      if (k >= 1 && !(model && model.contact > 0.3)) {
        const others = OJO.MODES.filter((m) => m.id !== S.mode);
        setMode(others[Math.floor(Math.random() * others.length)].id);
      }
    } else $('autoBar').style.width = '0';
    if (now - lastUI < 120) return;
    lastUI = now;
    const alive = outAlive();
    $('cFps').textContent = Math.round(rt.fps) + (alive && outInfo ? ' / ' + Math.round(outInfo.fps) : '');
    $('ledOut').className = 'led' + (alive ? ' on' : '');
    $('cOut').textContent = alive && outInfo ? outInfo.size.join('×') : 'CERRADA';
    $('vAir').textContent = alive ? 'EN EL AIRE' : 'PREVIA';
    const camErr = rt.camError || (alive && outInfo && outInfo.camError);
    $('ledCam').className = 'led' + (camErr ? ' err' : rt.eng.camSize[0] ? ' on' : ' warn');
    $('cCam').textContent = camErr ? 'SIN ACCESO' : rt.eng.camSize[0] ? rt.eng.camSize.join('×') : '…';
    const msg = $('vMsg');
    if (camErr) { msg.innerHTML = '<div><b>NO HAY ACCESO A LA CÁMARA</b><br>' + camErr + '<br>PERMITE LA CÁMARA EN EL NAVEGADOR O ELIGE OTRA EN FUENTE</div>'; msg.classList.add('on'); }
    else msg.classList.remove('on');
    const st = visionErr ? 'ERROR' : alive ? 'EN LA SALIDA' : visionReady ? 'LISTA' : visionStatus;
    $('ledIA').className = 'led' + (visionErr ? ' err' : visionReady || alive ? ' on' : ' warn');
    $('cIA').textContent = st.toUpperCase();
    $('vInfo').textContent = rt.eng.size.join('×');
    $('sN').textContent = String(n).padStart(2, '0');
    const cs = model && model.subjects ? model.subjects.find((s) => s.contact > 0.01) : null;
    $('sC').textContent = cs ? 'SUJETO ' + String(cs.id).padStart(2, '0') + ' · ' + Math.max(0, cs.contactT - 0.45).toFixed(1) + ' S' : '—';
    $('sG').textContent = model && model.fovea ? (model.fovea.x.toFixed(2) + ' · ' + model.fovea.y.toFixed(2)) : '—';
    $('sL').textContent = model && model.ms ? Math.round(model.ms) + ' MS' : '—';
    const recOn = alive ? outRec >= 0 : rec && rec.on;
    const secs = alive ? outRec : rec ? rec.secs : 0;
    $('bRec').classList.toggle('on', !!recOn);
    $('bRec').textContent = recOn ? 'GRABANDO ' + Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0') : 'GRABAR';
  };

  // ------------------------------------------------------------------ teclado
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k >= '1' && k <= '7') setMode(OJO.MODES[+k - 1].id);
    else if (k === 'ArrowRight') step(1);
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'a' || k === 'A') { S.analysis = (S.analysis + 1) % 3; push(); }
    else if (k === 'm' || k === 'M') { S.mirror = !S.mirror; push(); }
    else if (k === ' ') { e.preventDefault(); S.freeze = !S.freeze; push(); }
    else if (k === 'b' || k === 'B') { S.black = !S.black; push(); }
    else if (k === 'f' || k === 'F') firma();
    else if (k === 'p' || k === 'P') $('bAuto').click();
    else if (k === 'o' || k === 'O') openOutput();
    else if (k === 's' || k === 'S') toggleSound();
    else if (k === 'r' || k === 'R') toggleRec();
    else if (k === 'c' || k === 'C') shot();
    else if (k === 'h' || k === 'H') { document.body.classList.toggle('solo'); setTimeout(sizePrev, 30); }
    else if (k === '?' ) $('help').classList.toggle('on');
    else if (k === 'Escape') { $('help').classList.remove('on'); document.body.classList.remove('solo'); setTimeout(sizePrev, 30); }
  });

  // ------------------------------------------------------------------ arranque
  let visionReady = false, visionErr = false, visionStatus = 'apagada';
  async function boot() {
    const go = $('go'), bl = $('bootlog');
    go.disabled = true; go.textContent = 'ABRIENDO LA CÁMARA';
    await rt.camera();
    if (rt.camError) {
      bl.className = 'err';
      bl.textContent = 'NO HAY ACCESO A LA CÁMARA (' + rt.camError + ') · PERMÍTELA Y VUELVE A PULSAR';
      go.disabled = false; go.textContent = 'REINTENTAR';
      return;
    }
    await listCams();
    buildParams(); paint();
    rt.start();
    $('boot').classList.add('off');
    log('CÁMARA · ' + (rt.camLabel || 'LISTA').toUpperCase(), 'hot');
    log('LA IMAGEN SE PROCESA AQUÍ · NO SE ENVÍA NI SE GUARDA');
    rt.loadVision((s) => (visionStatus = s))
      .then(() => { visionReady = true; log('IA · CARA, MALLA, IRIS Y CUERPO LISTOS', 'hot'); if (!outAlive()) rt.useLocalVision(true); })
      .catch((err) => { visionErr = true; console.error(err); log('IA · NO SE PUDO CARGAR · ' + String(err.message || err).slice(0, 80), 'acc'); });
    if (INSTALL) log('MODO INSTALACIÓN · AUTO');
    push();
  }
  $('go').onclick = boot;
  buildParams(); paint();
  if (INSTALL) setTimeout(boot, 300);

  // fondo del arranque: un ojo que barre
  (function bootFx() {
    const c = $('bootfx'), x = c.getContext('2d');
    let on = true;
    const f = (now) => {
      if (!on) return;
      if ($('boot').classList.contains('off')) { on = false; return; }
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== innerWidth * dpr) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
      const W = c.width, H = c.height, t = now / 1000;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
      x.strokeStyle = 'rgba(242,240,234,.07)'; x.lineWidth = dpr;
      for (let i = 1; i <= 5; i++) { x.beginPath(); x.arc(cx, cy, R * i / 5, 0, Math.PI * 2); x.stroke(); }
      const a = t * 0.6;
      x.strokeStyle = 'rgba(0,229,255,.35)';
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R * 1.4, cy + Math.sin(a) * R * 1.4); x.stroke();
      const sy = cy + Math.sin(t * 0.8) * R;
      x.fillStyle = 'rgba(0,229,255,.05)'; x.fillRect(0, sy, W, dpr);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  })();
})();
