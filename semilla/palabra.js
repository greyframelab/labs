/* VØID_LOOM · SEMILLA — la palabra, un instante.
   El visitante ve su palabra: se descifra desde glifos, se sostiene y se deshace en la pieza que nace.
   No se guarda en ningún sitio. La usan la consola y la ventana de salida. */
(function () {
  const GLYPHS = '░▒▓/\\|<>_-=+*#ØΣΔ01';
  const WORD_DUR = 3.4;
  // devuelve la opacidad de la capa (0 = ya no se ve)
  function draw(x, W, H, word, t, acc) {
    if (t >= WORD_DUR) return 0;
    const w = String(word).toUpperCase();
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    const size = Math.round(Math.min(W, H) * 0.075), track = size * 0.55;
    x.font = `300 ${size}px 'JetBrains Mono', ui-monospace, monospace`; x.textBaseline = 'middle';
    const cw = x.measureText('M').width + track, total = cw * w.length - track, x0 = (W - total) / 2, y = H * 0.5;
    const fadeIn = Math.min(1, Math.max(0, t) / 0.25), fadeOut = 1 - Math.max(0, (t - 2.7) / 0.7);
    for (let i = 0; i < w.length; i++) {
      const on = 0.03 + i * 0.045, off = 2.5 + (w.length - i) * 0.04;   // se fija letra a letra y se deshace al revés
      if (t < on) continue;
      const fixed = t > on + 0.22 && t < off;
      const ch = fixed ? w[i] : GLYPHS[Math.floor((t * 24 + i * 7) % GLYPHS.length)];
      x.shadowColor = acc; x.shadowBlur = size * (fixed ? 0.35 : 0.6);
      x.fillStyle = fixed ? 'rgba(242,240,234,0.95)' : acc;
      x.globalAlpha = Math.max(0, Math.min(1, fadeIn * fadeOut * (fixed ? 1 : 0.7)));
      x.fillText(ch, x0 + i * cw, y);
    }
    x.globalAlpha = 1; x.shadowBlur = 0;
    const lw = total * Math.min(1, Math.max(0, (t - 0.3) / 0.8)) * fadeOut;   // una línea fina del acento bajo la palabra
    x.fillStyle = acc; x.globalAlpha = 0.85 * fadeOut; x.fillRect(W / 2 - lw / 2, y + size * 0.85, lw, Math.max(1, size * 0.02)); x.globalAlpha = 1;
    return Math.max(0, fadeOut);
  }
  window.SemillaPalabra = { draw, DUR: WORD_DUR };
})();
