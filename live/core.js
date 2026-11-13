/* VØID_LOOM LIVE · núcleo compartido entre la consola (index.html) y la salida (output.html).

   Modelo de tiempo de un deck. Un estado es una foto inmutable:
     { piece, wall, pos, rate, ramp, a, b, x, once, freeze }
       wall   instante de reloj compartido (ms) en el que el estado entra en vigor
       pos    posición en la pieza (s) en ese instante
       rate   velocidad (1 normal, <0 reversa); ramp = { to, dur } para frenar o arrancar como una cinta
       a, b   tramo que se repite; x = fundido de la vuelta (s); once = tocar hasta b y parar
       freeze posición congelada para la imagen (el audio sostiene un grano)
   Consola y salida calculan la misma posición a partir del mismo estado: no hace falta enviar
   el tiempo en cada frame, solo los cambios. */
(function (root) {
  const VLL = {};
  VLL.now = () => performance.timeOrigin + performance.now();
  VLL.CHANNEL = 'voidloom-live';

  // posición de un deck en el instante w (ms de reloj compartido)
  VLL.pos = function (s, w) {
    if (!s || !s.piece) return null;
    const tau = Math.max(0, (w - s.wall) / 1000);
    let d;
    if (s.ramp) {
      const D = s.ramp.dur, r0 = s.rate, r1 = s.ramp.to;
      d = tau < D ? r0 * tau + (r1 - r0) * tau * tau / (2 * D) : (r0 + r1) * D / 2 + r1 * (tau - D);
    } else d = s.rate * tau;
    const a = s.a, b = s.b, x = s.x || 0;
    let p = s.pos + d, blend = 0, pin = 0, ended = false;
    if (d >= 0) {
      if (p >= b) {
        if (s.once) { p = b - 1e-3; ended = true; }
        else { const L = Math.max(1e-3, b - a - x); p = a + x + ((p - b) % L); }
      }
      if (!s.once && x > 0 && p > b - x && p < b) { blend = (p - (b - x)) / x; pin = a + (p - (b - x)); }
    } else if (p < a) {
      const L = Math.max(1e-3, b - a); p = b - ((a - p) % L);
    }
    if (s.freeze != null) { p = s.freeze; blend = 0; }
    return { p, blend, pin, ended };
  };

  // tramo de un acto: [inicio, fin)
  VLL.actRange = function (meta, i) {
    const acts = meta.acts, t0 = acts[i][0];
    const t1 = i < acts.length - 1 ? acts[i + 1][0] : meta.duration;
    return [t0, t1];
  };
  VLL.actAt = function (meta, p) {
    let k = 0; meta.acts.forEach(([t0], i) => { if (p >= t0 - 1e-4) k = i; }); return k;
  };
  // fin "musical" de la pieza: el inicio de la FIRMA (el logo se lanza a mano para cerrar)
  VLL.firmaAt = function (meta) {
    const f = meta.acts.find(([, n]) => /FIRMA/i.test(n));
    return f ? f[0] : meta.duration;
  };
  VLL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  root.VLL = VLL;
})(window);
