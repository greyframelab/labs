/* VØID_LOOM — núcleo compartido + firma animada (sting) de cierre.
   Todo es determinista: el estado de cada frame depende solo de t.
   Uso en cualquier lab:  VL.post(...), VL.drawSymbol(...), VL.stingState(t, opts)  */
(function () {
  // tamaño del lienzo: 1080×1920 para el vídeo; la web puede fijar window.VL_SIZE = [w, h] antes de cargar
  const W = (window.VL_SIZE && window.VL_SIZE[0]) || 1080, H = (window.VL_SIZE && window.VL_SIZE[1]) || 1920;
  const VL = { W, H };
  // marco virtual de la firma (1080×1920), centrado y escalado dentro del lienzo real
  VL.FRAME = (function () { const k = Math.min(W / 1080, H / 1920); return { k, ox: (W - 1080 * k) / 2, oy: (H - 1920 * k) / 2 }; })();
  VL.fx = (x) => VL.FRAME.ox + x * VL.FRAME.k;
  VL.fy = (y) => VL.FRAME.oy + y * VL.FRAME.k;

  // ---------- utilidades ----------
  VL.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  VL.lerp = (a, b, k) => a + (b - a) * k;
  VL.seg = (t, a, b) => VL.clamp((t - a) / (b - a));
  VL.ease = {
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    in: (x) => x * x * x,
  };
  VL.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  VL.hash = (a, b) => {
    let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
    h = (h ^ (h >>> 13)) * 1103515245;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  VL.rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  VL.INK = '#F2F0EA';
  VL.GREY = '#8F8C86';
  VL.ACCENTS = {
    rojo: '#FF1A1A', cian: '#00E5FF', ambar: '#FFB000', verde: '#39FF6A',
    violeta: '#8A2BFF', magenta: '#FF2BD6', blanco: '#F2F0EA',
  };
  VL.FONT = "'JetBrains Mono', ui-monospace, monospace";

  // ---------- geometría del símbolo (viewBox 200 → pantalla) ----------
  VL.geo = function (cx = 540, cy = 820, s = 3.0) {
    const cols = [];
    for (let k = 0; k < 7; k++) cols.push(cx + (k - 3) * 20 * s);
    return {
      cx, cy, s, cols,
      R: 66 * s,                 // radio del vacío
      top: cy - 86 * s, bottom: cy + 86 * s,
      wA: [cx - 42 * s, cy + 42 * s], wB: [cx + 42 * s, cy - 42 * s],
    };
  };

  // ---------- capas de post-procesado ----------
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  let P = null;
  function initPost() {
    if (P) return P;
    P = {};
    P.scene = mk(W, H);
    P.b1 = mk(W / 4, H / 4);
    P.b2 = mk(W / 12, H / 12);
    // grano: 6 texturas precalculadas
    P.grain = [];
    const r = VL.rng(77);
    for (let g = 0; g < 6; g++) {
      const c = mk(540, 960), x = c.getContext('2d');
      const im = x.createImageData(540, 960);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = (r() * 255) | 0;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      P.grain.push(c);
    }
    // scanlines
    P.scan = mk(W, H);
    const sx = P.scan.getContext('2d');
    sx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 4) sx.fillRect(0, y, W, 1.5);
    // viñeta
    P.vig = mk(W, H);
    const vx = P.vig.getContext('2d');
    const gr = vx.createRadialGradient(W / 2, H * 0.45, H * 0.18, W / 2, H * 0.45, H * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.78)');
    vx.fillStyle = gr; vx.fillRect(0, 0, W, H);
    return P;
  }
  VL.sceneCtx = function () {
    const p = initPost();
    const c = p.scene.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    return c;
  };
  // compone escena → salida con bloom, flash, scanlines, viñeta y grano
  VL.post = function (out, frame, opt = {}) {
    const p = initPost();
    const bloom = opt.bloom ?? 1, flash = opt.flash ?? 0;
    const b1 = p.b1.getContext('2d'), b2 = p.b2.getContext('2d');
    b1.globalCompositeOperation = 'copy'; b1.filter = 'blur(3px)';
    b1.drawImage(p.scene, 0, 0, p.b1.width, p.b1.height); b1.filter = 'none';
    b2.globalCompositeOperation = 'copy'; b2.filter = 'blur(4px)';
    b2.drawImage(p.b1, 0, 0, p.b2.width, p.b2.height); b2.filter = 'none';

    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.drawImage(p.scene, 0, 0);
    out.globalCompositeOperation = 'lighter';
    out.imageSmoothingEnabled = true; out.imageSmoothingQuality = 'high';
    out.globalAlpha = VL.clamp(0.85 * bloom, 0, 1); out.drawImage(p.b1, 0, 0, W, H);
    out.globalAlpha = VL.clamp(0.9 * bloom, 0, 1); out.drawImage(p.b2, 0, 0, W, H);
    if (bloom > 1.1) { out.globalAlpha = VL.clamp((bloom - 1) * 0.5, 0, 1); out.drawImage(p.b2, 0, 0, W, H); }
    if (flash > 0) {
      out.globalAlpha = 1;
      out.fillStyle = opt.flashColor ? VL.rgba(opt.flashColor, flash * 0.22) : `rgba(242,240,234,${flash * 0.22})`;
      out.fillRect(0, 0, W, H);
    }
    out.globalAlpha = 1;
    out.globalCompositeOperation = 'source-over';
    out.drawImage(p.scan, 0, 0);
    out.drawImage(p.vig, 0, 0);
    // grano sutil: en zonas planas y luminosas (horizontes, halos) un grano fuerte ensucia la imagen
    const g = p.grain[frame % p.grain.length], gk = opt.grain ?? 1;
    out.globalCompositeOperation = 'overlay'; out.globalAlpha = 0.11 * gk;
    out.drawImage(g, 0, 0, W, H);
    out.globalCompositeOperation = 'lighter'; out.globalAlpha = 0.01 * gk;
    out.drawImage(g, 0, 0, W, H);
    out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
  };

  // ---------- primitivas de luz ----------
  // línea luminosa: halo ancho + cuerpo + núcleo caliente
  VL.lightLine = function (c, x1, y1, x2, y2, col, w, k = 1) {
    c.lineCap = 'round';
    const pass = (lw, a, cc) => { c.strokeStyle = VL.rgba(cc, a * k); c.lineWidth = lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    pass(w * 7, 0.06, col);
    pass(w * 3.2, 0.16, col);
    pass(w, 0.95, col);
    pass(Math.max(1.2, w * 0.3), 0.55, '#FFFFFF');
  };

  // ---------- el símbolo ----------
  // st: { threads, top, bottom, vib, open, ring, ringColor, weft, weftGlow, ghost, accent, ca, dim }
  VL.drawSymbol = function (c, g, st, t) {
    const acc = st.accent;
    const R = g.R * (st.open || 0);
    const thr = st.threads ?? 1;
    const dim = st.dim ?? 1;
    const top = st.top ?? g.top, bottom = st.bottom ?? g.bottom;
    const vib = st.vib || 0;
    const coreW = 3 * g.s;

    // fantasma de los hilos dentro del vacío
    if ((st.ghost || 0) > 0 && thr > 0) {
      c.lineCap = 'butt';
      c.strokeStyle = VL.rgba(VL.INK, 0.1 * st.ghost * thr * dim);
      c.lineWidth = coreW;
      c.beginPath();
      for (const x of g.cols) { c.moveTo(x, Math.max(top, g.cy - R)); c.lineTo(x, Math.min(bottom, g.cy + R)); }
      c.stroke();
    }

    // urdimbre: 7 hilos (con vibración de cuerda y corte del vacío)
    if (thr > 0) {
      const passes = [[coreW * 5, 0.05], [coreW * 2.2, 0.14], [coreW, 0.92], [coreW * 0.35, 0.45]];
      for (let pi = 0; pi < passes.length; pi++) {
        const [lw, a] = passes[pi];
        c.lineCap = 'butt';
        c.lineWidth = lw;
        c.strokeStyle = pi === 3 ? `rgba(255,255,255,${a * thr * dim})` : VL.rgba(VL.INK, a * thr * dim);
        c.beginPath();
        for (let k = 0; k < 7; k++) {
          const X = g.cols[k], dx = X - g.cx;
          const h = R > Math.abs(dx) ? Math.sqrt(R * R - dx * dx) : 0;
          const segs = h > 0 ? [[top, g.cy - h], [g.cy + h, bottom]] : [[top, bottom]];
          for (const [ya, yb] of segs) {
            if (yb - ya < 1) continue;
            const n = vib > 0.3 ? 48 : 1;
            for (let i = 0; i <= n; i++) {
              const y = ya + (yb - ya) * (i / n);
              const u = (y - top) / Math.max(1, bottom - top);
              const off = vib * Math.sin(Math.PI * u) * Math.sin(t * 23 + k * 1.7 + u * 9.0) * (0.6 + 0.4 * Math.sin(k * 2.3 + t * 3));
              if (i === 0) c.moveTo(X + off, y); else c.lineTo(X + off, y);
            }
          }
        }
        c.stroke();
      }
    }

    // onda de choque del vacío
    if (st.ring != null && st.ring >= 0 && st.ring < 1) {
      const rr = g.R * (1 + 1.9 * VL.ease.out(st.ring));
      const a = Math.pow(1 - st.ring, 2);
      const rc = st.ringColor || acc;
      c.strokeStyle = VL.rgba(rc, 0.9 * a); c.lineWidth = 10 * (1 - st.ring) + 1.5;
      c.beginPath(); c.arc(g.cx, g.cy, rr, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = VL.rgba(VL.INK, 0.5 * a); c.lineWidth = 2;
      c.beginPath(); c.arc(g.cx, g.cy, rr * 0.93, 0, Math.PI * 2); c.stroke();
    }

    // trama: el hilo de color
    if ((st.weft || 0) > 0) {
      const p = st.weft;
      const [ax, ay] = g.wA, [bx, by] = g.wB;
      const hx = VL.lerp(ax, bx, p), hy = VL.lerp(ay, by, p);
      const gk = (st.weftGlow ?? 1) * dim;
      const ww = 5 * g.s;
      const ca = st.ca || 0;
      if (ca > 0.5) {
        VL.lightLine(c, ax - ca, ay, hx - ca, hy, '#FF2A2A', ww * 0.8, 0.45 * gk);
        VL.lightLine(c, ax + ca, ay, hx + ca, hy, '#2AB8FF', ww * 0.8, 0.45 * gk);
      }
      VL.lightLine(c, ax, ay, hx, hy, acc, ww, gk);
      if (p < 1) { // cabeza incandescente
        const gr = c.createRadialGradient(hx, hy, 0, hx, hy, 90);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(0.15, VL.rgba(acc, 0.8));
        gr.addColorStop(1, VL.rgba(acc, 0));
        c.fillStyle = gr; c.beginPath(); c.arc(hx, hy, 90, 0, Math.PI * 2); c.fill();
      }
    }
  };

  // ---------- texto ----------
  const GLYPHS = 'Ø#/\\|_=+<>01X:;*%';
  VL.decodeText = function (c, str, x, y, opt) {
    const size = opt.size || 40, spacing = opt.spacing ?? 0.42, prog = opt.prog ?? 1;
    const alpha = opt.alpha ?? 1, align = opt.align || 'center';
    const weight = opt.weight || 300, t = opt.t || 0, seed = opt.seed || 1;
    c.font = `${weight} ${size}px ${VL.FONT}`;
    c.textBaseline = 'middle'; c.textAlign = 'left';
    const adv = c.measureText('M').width + size * spacing;
    const total = adv * str.length - size * spacing;
    let x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const n = str.length;
    for (let i = 0; i < n; i++) {
      const ch = str[i];
      if (ch === ' ') continue;
      const ri = VL.clamp((prog * (n + 3) - i) / 3);
      if (ri <= 0) continue;
      let draw = ch;
      if (ri < 1) draw = GLYPHS[Math.floor(VL.hash(i + seed * 31, Math.floor(t * 24)) * GLYPHS.length)];
      const isAcc = opt.accentChar && ch === opt.accentChar && ri >= 1;
      const col = isAcc ? opt.accent : (opt.color || VL.INK);
      c.font = `${isAcc ? 600 : weight} ${size}px ${VL.FONT}`;
      c.fillStyle = VL.rgba(col, alpha * (ri < 1 ? 0.55 + 0.45 * ri : 1));
      c.fillText(draw, x0 + i * adv, y);
    }
  };

  // HUD de esquinas (telemetría)
  VL.hud = function (c, t, opt = {}) {
    const a = opt.alpha ?? 1;
    if (a <= 0) return;
    c.font = `400 22px ${VL.FONT}`;
    c.textBaseline = 'middle';
    c.fillStyle = VL.rgba(VL.GREY, 0.9 * a);
    const fps = 30, tt = Math.max(0, t);
    const tc = [Math.floor(tt / 3600), Math.floor(tt / 60) % 60, Math.floor(tt) % 60, Math.floor((tt % 1) * fps)]
      .map((v) => String(v).padStart(2, '0')).join(':');
    c.textAlign = 'left'; c.fillText(opt.tl || 'VØID_LOOM / SYS.01', 72, 120);
    c.textAlign = 'right'; c.fillText(tc, W - 72, 120);
    c.textAlign = 'left'; c.fillText(opt.bl || 'GREYFRAME LABS', 72, 1640);
    c.textAlign = 'right'; c.fillText(opt.br || 'SEÑAL 07/07', W - 72, 1640);
    // corchetes de encuadre
    c.strokeStyle = VL.rgba(VL.GREY, 0.55 * a); c.lineWidth = 2;
    const m = 48, L = 36;
    c.beginPath();
    c.moveTo(m, m + L); c.lineTo(m, m); c.lineTo(m + L, m);
    c.moveTo(W - m - L, m); c.lineTo(W - m, m); c.lineTo(W - m, m + L);
    c.moveTo(m, 1700 - L); c.lineTo(m, 1700); c.lineTo(m + L, 1700);
    c.moveTo(W - m - L, 1700); c.lineTo(W - m, 1700); c.lineTo(W - m, 1700 - L);
    c.stroke();
  };

  // ---------- cierre: logotipo + firma ----------
  VL.drawSignature = function (c, g, st, t) {
    if ((st.wordAlpha || 0) > 0)
      VL.decodeText(c, 'VØID_LOOM', g.cx, g.bottom + 150, {
        size: 70, spacing: 0.42, prog: st.word, alpha: st.wordAlpha, t, seed: 3,
        accentChar: 'Ø', accent: st.accent, weight: 300,
      });
    if ((st.tag || 0) > 0)
      VL.decodeText(c, 'SEÑAL · RUIDO · MOTION EXPERIMENTAL', g.cx, g.bottom + 240, {
        size: 22, spacing: 0.5, prog: VL.clamp(st.tag * 1.6), alpha: st.tag, t, seed: 5, color: VL.GREY, weight: 400,
      });
    const lines = st.creditLines || ['GREYFRAME LABS', 'greyframelab.github.io/labs'];
    if ((st.credit || 0) > 0) {
      VL.decodeText(c, lines[0], g.cx, 1500, { size: 24, spacing: 0.34, prog: VL.clamp(st.credit * 1.5), alpha: st.credit, t, seed: 7, color: '#BDBAB3', weight: 400 });
      if (lines[1]) VL.decodeText(c, lines[1], g.cx, 1550, { size: 22, spacing: 0.06, prog: VL.clamp(st.credit * 1.5 - 0.3), alpha: st.credit * 0.9, t, seed: 9, color: VL.GREY, weight: 400 });
    }
  };

  // ---------- STING: firma animada reutilizable (5.5 s) ----------
  // Llamar con t local (0 → VL.STING_DUR). opts: { accent, creditLines, skipDrop }
  VL.STING_DUR = 5.5;
  VL.stingState = function (t, opts = {}) {
    const g = opts.geo || VL.geo();
    const e = VL.ease, sg = VL.seg;
    const drop = opts.skipDrop ? 1 : e.out(sg(t, 0.0, 0.7));
    const tOpen = 0.75, tWeft = 1.05;
    const out = 1 - e.inOut(sg(t, 4.7, 5.5));
    return {
      accent: opts.accent || VL.ACCENTS.rojo,
      creditLines: opts.creditLines,
      threads: drop * out,
      top: VL.lerp(g.cy, g.top, drop), bottom: VL.lerp(g.cy, g.bottom, drop),
      vib: 14 * (1 - sg(t, 0.2, 1.6)) * (t > 0.2 ? 1 : 0),
      open: e.outExpo(sg(t, tOpen, tOpen + 0.35)),
      ring: t >= tOpen ? sg(t, tOpen, tOpen + 0.9) : -1,
      weft: e.outQuart(sg(t, tWeft, tWeft + 0.28)),
      weftGlow: (1 + 0.12 * Math.sin(t * 2.4)) * VL.clamp(out + (1 - sg(t, 4.7, 5.4)) * 0.6),
      ghost: sg(t, 1.2, 2.0),
      ca: 10 * (1 - sg(t, tWeft, tWeft + 0.5)) * (t >= tWeft ? 1 : 0),
      word: sg(t, 1.5, 2.6), wordAlpha: sg(t, 1.5, 1.7) * out,
      tag: sg(t, 2.6, 3.2) * out,
      credit: sg(t, 3.0, 3.6) * out,
      flash: Math.max(t >= tOpen ? 1 - sg(t, tOpen, tOpen + 0.5) : 0, t >= tWeft ? 0.7 * (1 - sg(t, tWeft, tWeft + 0.45)) : 0),
    };
  };
  // dibuja el sting completo en un contexto de escena
  VL.drawSting = function (c, t, opts = {}) {
    const g = opts.geo || VL.geo();
    const st = VL.stingState(t, opts);
    const F = VL.FRAME, framed = W !== 1080 || H !== 1920;
    if (framed) { c.save(); c.translate(F.ox, F.oy); c.scale(F.k, F.k); }
    VL.drawSymbol(c, g, st, t);
    VL.drawSignature(c, g, st, t);
    if (framed) c.restore();
    return st;
  };

  window.VL = VL;
})();
