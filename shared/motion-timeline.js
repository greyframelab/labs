/* Greyframe Labs · Motion Timeline
   Timeline navegable común para todos los labs de motion.

   Uso:
     <script src="../shared/motion-timeline.js"></script>
     MotionTimeline.mount({
       duration: 24.5,                       // segundos
       render: (t) => renderFrame(t, Math.floor(t * 60)),
       acts: [[0, 'LATIDO'], [6.2, 'GRIETAS'], ...],   // [inicio en s, nombre]
       accent: '#FFB000',                    // color del cabezal y del acto activo
       audio: 'masa.m4a',                    // opcional: pista sincronizada
     });

   Controles: arrastrar o tocar la línea para saltar, ← → un segundo, espacio para pausa.
   El audio sigue al tiempo al saltar. Los controles se ocultan solos en reposo. */
(function () {
  const CSS = `
  .mtl{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:18px 22px 22px;font:400 10px 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.18em;color:#8f8c86;background:linear-gradient(transparent,rgba(0,0,0,.78));transition:opacity .5s;user-select:none;-webkit-user-select:none}
  .mtl.idle{opacity:0}
  .mtl-row{display:flex;align-items:center;gap:16px;margin-bottom:10px}
  .mtl-row button{all:unset;cursor:pointer;color:#f2f0ea;letter-spacing:.24em;padding:4px 0}
  .mtl-row button:hover,.mtl-row button.on{color:var(--mtl-acc)}
  .mtl-row button:focus-visible,.mtl-track:focus-visible{outline:1px solid var(--mtl-acc);outline-offset:4px}
  .mtl-act-name{color:#bdbab3}
  .mtl-tc{margin-left:auto;font-variant-numeric:tabular-nums;color:#bdbab3}
  .mtl-track{position:relative;height:34px;cursor:pointer;touch-action:none}
  .mtl-line{position:absolute;left:0;right:0;top:16px;height:1px;background:#3a3936}
  .mtl-fill{position:absolute;left:0;top:16px;height:1px;background:var(--mtl-acc);width:0}
  .mtl-head{position:absolute;top:10px;width:1px;height:13px;background:var(--mtl-acc);box-shadow:0 0 8px var(--mtl-acc);transform:translateX(-.5px)}
  .mtl-act{position:absolute;top:0;height:34px;border-left:1px solid #2a2927;padding-left:5px;font-size:8.5px;letter-spacing:.16em;color:#6b6964;white-space:nowrap;overflow:hidden;box-sizing:border-box}
  .mtl-act.cur{color:#f2f0ea;border-left-color:var(--mtl-acc)}
  .mtl-act span{position:absolute;bottom:0}
  @media (max-width:520px){.mtl-act span{display:none}.mtl{padding:14px 16px 18px}}`;

  function mount(o) {
    const D = o.duration, acts = o.acts || [], acc = o.accent || '#F2F0EA';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const ui = document.createElement('div'); ui.className = 'mtl'; ui.style.setProperty('--mtl-acc', acc);
    ui.innerHTML = `<div class="mtl-row"><button class="mtl-play" aria-label="Pausa">❚❚ PAUSA</button>${o.audio ? '<button class="mtl-snd" aria-label="Activar sonido">○ SONIDO</button>' : ''}<span class="mtl-act-name">—</span><span class="mtl-tc">00:00:00</span></div>
      <div class="mtl-track" role="slider" tabindex="0" aria-label="Línea de tiempo" aria-valuemin="0" aria-valuemax="${D}"><div class="mtl-line"></div><div class="mtl-fill"></div><div class="mtl-acts"></div><div class="mtl-head"></div></div>`;
    document.body.appendChild(ui);
    const q = (s) => ui.querySelector(s);
    const track = q('.mtl-track'), actsEl = q('.mtl-acts'), playB = q('.mtl-play'), sndB = q('.mtl-snd');
    acts.forEach(([t0, name], i) => {
      const t1 = i < acts.length - 1 ? acts[i + 1][0] : D;
      const d = document.createElement('div'); d.className = 'mtl-act';
      d.style.left = (t0 / D * 100) + '%'; d.style.width = ((t1 - t0) / D * 100) + '%';
      d.innerHTML = '<span>' + name + '</span>'; actsEl.appendChild(d);
    });
    const audio = o.audio ? Object.assign(new Audio(o.audio), { preload: 'auto' }) : null;
    let t = 0, last = performance.now(), playing = true, sound = false, scrub = false;
    const syncAudio = () => {
      if (!audio) return;
      if (sound && playing && !scrub) { if (Math.abs(audio.currentTime - t) > 0.08) audio.currentTime = t; if (audio.paused) audio.play().catch(() => {}); }
      else audio.pause();
    };
    const setT = (x) => { t = Math.max(0, Math.min(D - 1e-3, x)); if (audio && sound) audio.currentTime = t; };
    const togglePlay = () => { playing = !playing; playB.textContent = playing ? '❚❚ PAUSA' : '▶ REPRODUCIR'; playB.setAttribute('aria-label', playing ? 'Pausa' : 'Reproducir'); syncAudio(); };
    playB.onclick = togglePlay;
    if (sndB) sndB.onclick = () => { sound = !sound; sndB.classList.toggle('on', sound); sndB.textContent = (sound ? '● ' : '○ ') + 'SONIDO'; audio.currentTime = t; syncAudio(); };
    const seek = (ev) => { const r = track.getBoundingClientRect(); setT((ev.clientX - r.left) / r.width * D); };
    track.addEventListener('pointerdown', (ev) => { scrub = true; track.setPointerCapture(ev.pointerId); seek(ev); syncAudio(); });
    track.addEventListener('pointermove', (ev) => { if (scrub) seek(ev); });
    track.addEventListener('pointerup', () => { scrub = false; syncAudio(); });
    track.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') setT(t + 1); else if (ev.key === 'ArrowLeft') setT(t - 1); else return;
      ev.preventDefault(); syncAudio();
    });
    window.addEventListener('keydown', (ev) => { if (ev.code === 'Space' && ev.target === document.body) { ev.preventDefault(); togglePlay(); } });
    let idleT; const wake = () => { ui.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!scrub) ui.classList.add('idle'); }, 2600); };
    ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, wake, { passive: true })); wake();
    const tc = (x) => { const s = Math.floor(x), f = Math.floor((x - s) * 60); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + ':' + String(f).padStart(2, '0'); };
    let cur = -1;
    const loop = (now) => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = Math.max(last, now);
      if (playing && !scrub) {
        t = audio && sound && !audio.paused ? audio.currentTime : t + dt;
        if (t >= D - 1e-3) { t = 0; if (audio && sound) { audio.currentTime = 0; audio.play().catch(() => {}); } }
      }
      t = Math.max(0, Math.min(D - 1e-3, t));
      o.render(t);
      const k = t / D * 100; q('.mtl-fill').style.width = k + '%'; q('.mtl-head').style.left = k + '%';
      q('.mtl-tc').textContent = tc(t); track.setAttribute('aria-valuenow', t.toFixed(1));
      let ai = 0; acts.forEach(([t0], i) => { if (t >= t0) ai = i; });
      if (acts.length && ai !== cur) { cur = ai; [...actsEl.children].forEach((d, i) => d.classList.toggle('cur', i === ai)); q('.mtl-act-name').textContent = acts[ai][1]; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return { seek: setT, get time() { return t; } };
  }
  window.MotionTimeline = { mount };
})();
