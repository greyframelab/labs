/* VØID_LOOM · SEMILLA — vista código.
   Una franja pequeña, abajo, que muestra en tiempo real lo que la máquina está ejecutando: la semilla,
   la forma, el acto y cada evento de la partitura (pulso, golpe, bajo, corte, ruptura) en el instante en que suena.
   Apagada por defecto; se activa desde la consola (VISTA CÓDIGO · tecla K). La usan la consola y la ventana de salida. */
(function () {
  const MATS = ['laca', 'obsidiana', 'cromo', 'terciopelo'];
  const COMPS = ['solo', 'espejo', 'anillo', 'constelacion'];
  const SHOTS = ['general', 'macro', 'rasante', 'cenital'];
  const NOTE = ['do', 'do#', 're', 'mib', 'mi', 'fa', 'fa#', 'sol', 'lab', 'la', 'sib', 'si'];
  const WINDOW = 4.0, MAX = 5;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const tc = (s) => { const m = Math.floor(s / 60), x = s - m * 60; return String(m).padStart(2, '0') + ':' + x.toFixed(1).padStart(4, '0'); };

  // eventos de la partitura en la ventana (lt - WINDOW, lt], como líneas de código
  function events(P, lt) {
    const out = [], lo = lt - WINDOW, S = window.SEMILLA;
    const take = (arr, fn) => { for (const x of arr) if (x.t > lo && x.t <= lt) out.push([x.t, fn(x)]); };
    take(P.ev.kick, (x) => `<i>materia</i>.pulso(${x.v.toFixed(2)})`);
    take(P.ev.metal, (x) => `<i>${P.kit || 'chapa'}</i>.golpe(${Math.round(P.metalBase * [1, 1.19, 1.5, 0.75][x.p | 0])}hz) <u>→</u> luz.acento()`);
    take(P.ev.bass, (x) => `<i>bajo</i>.${P.bassEng || 'sierra'}(${NOTE[(P.root + 12 + x.p) % 12]})`);
    take(P.ev.impact, () => `<b>RUPTURA</b>.impacto() <u>→</u> materia.abrir()`);
    for (let i = 0; i < S.CUTS.length; i++) {
      const ct = S.CUTS[i] * P.bar;
      if (ct > lo && ct <= lt && i > 0) out.push([ct, `<i>camara</i>.corte(${SHOTS[S.shotAt(P, S.CUTS[i] + 0.01).type]})`]);
    }
    return out.sort((a, b) => a[0] - b[0]).slice(-MAX);
  }

  let lastT = 0, lastHTML = '';
  // el: el contenedor; P: la pieza; pt: segundos de pieza; word: palabra viva (o null); on: si se muestra
  function draw(el, P, pt, word, on) {
    if (!el) return;
    el.classList.toggle('off', !on);
    if (!on || !P) return;
    const now = performance.now(); if (now - lastT < 70) return; lastT = now;   // ~14 actualizaciones por segundo: barato
    const lt = ((pt % P.L) + P.L) % P.L, bar = Math.floor(lt / P.bar) + 1;
    const act = P.acts.reduce((a, x) => (lt >= x[0] ? x[1] : a), 'SEÑAL');
    const head = `<div><s>// semilla ${esc(P.code)} · ${P.sp.id} · ${COMPS[P.vis.comp || 0]} · ${MATS[P.vis.mat]} · ${act} · ${P.bpm} bpm · compás ${String(bar).padStart(2, '0')}/${P.bars}</s></div>` +
      (word ? `<div><s>// palabra("${esc(word)}") → ${esc(P.fam || 'sentido')}</s></div>` : '');
    const ev = events(P, lt);
    const lines = ev.map(([t, code], k) => {
      const age = lt - t, last = k === ev.length - 1;
      const plain = code.replace(/<[^>]+>/g, ''), shown = Math.min(plain.length, Math.floor(age * 70) + 3);   // la última línea se escribe
      const body = last && shown < plain.length ? esc(plain.slice(0, shown)) + '<em>▌</em>' : code;
      return `<span class="${last ? 'now' : ''}" style="opacity:${(0.35 + 0.65 * (k + 1) / ev.length).toFixed(2)}">${tc(t)}  ${body}</span>`;
    });
    const html = head + lines.join('');
    if (html !== lastHTML) { el.innerHTML = html; lastHTML = html; }
    el.style.setProperty('--acc', P.accent);
  }
  window.SemillaCodigo = { draw };
})();
