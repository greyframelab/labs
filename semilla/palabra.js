/* VØID_LOOM · SEMILLA — la palabra, un instante.
   El visitante ve su palabra escrita por la máquina: la MATRIZ (5×7 celdas) se enciende celda a celda,
   se sostiene y se deshace en la pieza que nace. No se guarda en ningún sitio. La usan la consola y la ventana de salida. */
(function () {
  const WORD_DUR = 3.4;
  const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  // devuelve la opacidad de la capa (0 = ya no se ve)
  function draw(x, W, H, word, t, acc) {
    if (t >= WORD_DUR) return 0;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    const n = Math.max(1, String(word).length);
    const cell = Math.max(2, Math.round(Math.min(Math.min(W, H) * 0.011, (W * 0.6) / (n * 7))));
    const fadeOut = 1 - Math.max(0, (t - 2.7) / 0.7);
    // cada celda se enciende con un retraso propio (la máquina escribe de izquierda a derecha) y se apaga al revés
    const total = window.SEMILLA.matrix(x, word, W / 2, H / 2, cell, {
      gap: 0.22,
      cellFn: (i, r, c, px, py, s) => {
        const k = hh(i * 7 + c, r), on = 0.06 + i * 0.07 + c * 0.012 + k * 0.18, off = 2.55 + (n - i) * 0.03 + k * 0.25;
        if (t < on || t > off + 0.12) return;
        const fresh = t < on + 0.1 || t > off;   // recién encendida o apagándose: color del acento
        x.globalAlpha = Math.max(0, Math.min(1, fadeOut * (fresh ? 0.9 : 0.92)));
        x.fillStyle = fresh ? acc : 'rgba(242,240,234,1)';
        x.fillRect(px + (cell - s) / 2, py + (cell - s) / 2, s, s);
      },
    });
    x.globalAlpha = 1;
    const lw = total * Math.min(1, Math.max(0, (t - 0.3) / 0.8)) * fadeOut;   // una línea fina del acento bajo la palabra
    x.fillStyle = acc; x.globalAlpha = 0.55 * fadeOut; x.fillRect(W / 2 - lw / 2, H / 2 + cell * 6, lw, 1); x.globalAlpha = 1;
    return Math.max(0, fadeOut);
  }
  window.SemillaPalabra = { draw, DUR: WORD_DUR };
})();
