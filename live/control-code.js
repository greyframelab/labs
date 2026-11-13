/* VØID_LOOM LIVE · consola: editor del deck C (live coding en GLSL).
   Se carga después de control.js y usa su API mínima (window.VLC). */
(function () {
  const $ = (s) => document.querySelector(s);
  const API = window.VLC;
  const PRESETS = {
    VACÍO: `// deck C · escribe aquí. Ctrl/⌘ + Enter compila.
// img(uv)  mezcla de A y B      deckA(uv) · deckB(uv)
// prev(uv) frame anterior de C  t · golpe · graves · medios · agudos
// acento (color de la pieza en el aire) · res · aspect
// noise(p) · fbm(p) · hash(p) · rot(a)
vec3 code(vec2 uv) {
  return img(uv);
}`,
    CONTORNO: `// CONTORNO · la mezcla de A y B convertida en líneas de luz
vec3 code(vec2 uv) {
  vec2 e = 1.5 / res;
  float l  = dot(img(uv), vec3(.3, .59, .11));
  float lx = dot(img(uv + vec2(e.x, 0.)), vec3(.3, .59, .11));
  float ly = dot(img(uv + vec2(0., e.y)), vec3(.3, .59, .11));
  float edge = length(vec2(lx - l, ly - l)) * (6. + 10. * golpe);
  vec3 c = acento * edge + vec3(edge * edge);
  return max(c, prev(uv) * .82);
}`,
    REJILLA: `// REJILLA · un campo de líneas que respira con los graves
vec3 code(vec2 uv) {
  vec2 p = (uv - .5) * vec2(aspect, 1.);
  p *= rot(t * .03);
  float d = 1e3;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float y = sin(p.x * (2. + fi) + t * (.2 + fi * .07)) * (.08 + graves * .25) + (fi - 2.5) * .12;
    d = min(d, abs(p.y - y));
  }
  float line = exp(-d * (420. - golpe * 260.));
  return img(uv) * .35 + acento * line * 1.6 + vec3(line * .4);
}`,
    DERIVA: `// DERIVA · la imagen arrastrada por un flujo de ruido
vec3 code(vec2 uv) {
  vec2 q = uv * vec2(aspect, 1.) * 2.2;
  vec2 f = vec2(fbm(q + t * .07), fbm(q - t * .05 + 7.3)) - .5;
  vec2 w = uv + f * (.03 + medios * .08 + golpe * .03);
  vec3 c = img(w);
  return max(c, prev(uv + f * .004) * (.9 - agudos * .2));
}`,
  };

  // ---------------------------------------------------------------- panel
  const dr = document.createElement('div'); dr.id = 'code'; dr.className = 'code-dr'; dr.setAttribute('aria-label', 'Deck C · live coding');
  dr.innerHTML = `
    <div class="cd-head"><span class="d-id" style="color:#f2f0ea">C</span><div class="d-title"><b>CÓDIGO</b><span>GLSL · DECK C</span></div>
      <div class="seg" id="cdPre">${Object.keys(PRESETS).map((k) => `<button data-v="${k}">${k}</button>`).join('')}</div>
      <button class="tbtn" id="cdRun">COMPILAR · ⌘↵</button><button class="tbtn" id="cdClose" aria-label="Cerrar">✕</button></div>
    <div class="cd-body"><pre class="cd-gut" id="cdGut"></pre><textarea id="cdEd" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea></div>
    <div class="cd-foot"><span class="led" id="cdLed"></span><span id="cdMsg">SIN COMPILAR · LA MEZCLA ESTÁ A CERO</span></div>`;
  document.body.appendChild(dr);
  const ed = $('#cdEd'), gut = $('#cdGut');
  let errLine = 0, pending = '', good = '';
  const store = { get(k, d) { try { const v = localStorage.getItem('vll:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('vll:' + k, JSON.stringify(v)); } catch (e) {} } };
  ed.value = store.get('code', PRESETS.VACÍO);
  function gutter() {
    const n = ed.value.split('\n').length;
    gut.innerHTML = Array.from({ length: n }, (_, i) => (i + 1 === errLine ? `<b>${i + 1}</b>` : i + 1)).join('\n');
    gut.scrollTop = ed.scrollTop;
  }
  ed.addEventListener('input', () => { store.set('code', ed.value); gutter(); });
  ed.addEventListener('scroll', () => (gut.scrollTop = ed.scrollTop));
  ed.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.key === 'Tab') { e.preventDefault(); const s = ed.selectionStart; ed.setRangeText('  ', s, ed.selectionEnd, 'end'); gutter(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    e.stopPropagation();
  });
  function run() {
    pending = ed.value; API.send({ type: 'code', src: pending });
    $('#cdMsg').textContent = 'COMPILANDO…'; $('#cdLed').className = 'led warn';
    clearTimeout(run.t); run.t = setTimeout(() => { if ($('#cdMsg').textContent === 'COMPILANDO…') { $('#cdMsg').textContent = 'SIN RESPUESTA · ¿SALIDA ABIERTA?'; $('#cdLed').className = 'led err'; } }, 2500);
  }
  API.onCodeRes = (r) => {
    clearTimeout(run.t);
    if (r.ok) { errLine = 0; good = pending; $('#cdLed').className = 'led on'; $('#cdMsg').textContent = `COMPILADO · ${r.lines} LÍNEAS` + (API.mix() > 0 ? '' : ' · SUBE LA MEZCLA DE C PARA VERLO'); API.compiled(true); }
    else { errLine = r.line; $('#cdLed').className = 'led err'; $('#cdMsg').textContent = (r.line ? `LÍNEA ${r.line} · ` : '') + r.msg + ' · SIGUE EL ÚLTIMO CÓDIGO BUENO'; }
    gutter();
  };
  let mark;
  function open() { dr.classList.add('on'); placeDrawer(); gutter(); setTimeout(() => ed.focus(), 50); }
  function close() { dr.classList.remove('on'); ed.blur(); }
  // el editor ocupa la biblioteca y el deck A: el centro (crossfader, mezcla de C) queda a mano
  function placeDrawer() {
    const f = document.querySelector('footer.fx'), c = document.querySelector('.center');
    dr.style.bottom = (f ? f.offsetHeight : 0) + 'px';
    if (c) dr.style.width = Math.max(420, c.getBoundingClientRect().left - 1) + 'px';
  }
  addEventListener('resize', placeDrawer);
  $('#cdRun').addEventListener('click', run);
  $('#cdClose').addEventListener('click', close);
  mark = (v) => document.querySelectorAll('#cdPre button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  document.querySelectorAll('#cdPre button').forEach((b) => b.addEventListener('click', () => { ed.value = PRESETS[b.dataset.v]; store.set('code', ed.value); mark(b.dataset.v); gutter(); run(); ed.focus(); }));
  API.closeEditor = close;
  API.isOpen = () => dr.classList.contains('on');
  API.openEditor = () => (dr.classList.contains('on') ? close() : open());
  // al reabrir la salida, vuelve a enviar el último código compilado
  API.resend = () => { if (good) API.send({ type: 'code', src: good }); };
  gutter();
})();
