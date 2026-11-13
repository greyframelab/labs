/* VØID_LOOM LIVE · inputs de código en la salida.
   - Deck C: un shader GLSL escrito en directo desde la consola. Recibe la mezcla de A y B, cada deck,
     su propio frame anterior, los golpes y las bandas del audio, y se mezcla con MEZCLA.
   - VER EL CÓDIGO: capa que proyecta el código real de la pieza en el aire, sus valores vivos
     y la traza de lo que está pasando (golpes, actos, vueltas, órdenes de la consola).
   Las dos cosas están apagadas por defecto y no cuestan nada mientras lo están. */
window.VLCodeLayer = function (gl, VS) {
  // ------------------------------------------------------------------ deck C
  const PRE = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D IMG, A, B, PREV;
uniform float t, golpe, graves, medios, agudos, aspect, mezcla;
uniform vec2 res; uniform vec3 acento;
vec3 img(vec2 p){ return texture(IMG, p).rgb; }
vec3 deckA(vec2 p){ return texture(A, p).rgb; }
vec3 deckB(vec2 p){ return texture(B, p).rgb; }
vec3 prev(vec2 p){ return texture(PREV, p).rgb; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a*noise(p); p *= 2.03; a *= .5; } return s; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;
  const PRE_LINES = PRE.split('\n').length - 1;
  const POST = `
void main(){ vec3 base = img(uv); o = vec4(mix(base, code(uv), mezcla), 1.); }`;
  const C = { prog: null, U: {}, src: '', lines: 0 };
  function compile(src) {
    const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VS); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, PRE + src + POST); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(fs) || 'error';
      gl.deleteShader(fs); gl.deleteShader(vs);
      const m = log.match(/ERROR:\s*\d+:(\d+):\s*(.*)/);
      const line = m ? +m[1] - PRE_LINES : 0;
      return { ok: false, line: line > 0 ? line : 0, msg: (m ? m[2] : log).trim().slice(0, 160) };
    }
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return { ok: false, line: 0, msg: (gl.getProgramInfoLog(p) || 'link').slice(0, 160) };
    if (C.prog) gl.deleteProgram(C.prog);
    C.prog = p; C.src = src; C.lines = src.split('\n').length;
    C.U = {}; ['IMG', 'A', 'B', 'PREV', 't', 'golpe', 'graves', 'medios', 'agudos', 'aspect', 'mezcla', 'res', 'acento'].forEach((n) => (C.U[n] = gl.getUniformLocation(p, n)));
    return { ok: true, lines: C.lines };
  }
  // dibuja el deck C sobre la imagen ya compuesta
  function pass(o) {
    const U = C.U;
    gl.useProgram(C.prog); gl.bindFramebuffer(gl.FRAMEBUFFER, o.fb); gl.viewport(0, 0, o.w, o.h);
    [['IMG', o.img], ['A', o.a], ['B', o.b], ['PREV', o.prev]].forEach(([n, tx], i) => { gl.activeTexture(gl.TEXTURE6 + i); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(U[n], 6 + i); });
    gl.uniform1f(U.t, o.t); gl.uniform1f(U.golpe, o.golpe); gl.uniform1f(U.graves, o.bands[0]); gl.uniform1f(U.medios, o.bands[1]); gl.uniform1f(U.agudos, o.bands[2]);
    gl.uniform1f(U.aspect, o.w / o.h); gl.uniform1f(U.mezcla, o.mix); gl.uniform2f(U.res, o.w, o.h); gl.uniform3fv(U.acento, o.acc);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ------------------------------------------------------------------ VER EL CÓDIGO
  const ov = document.createElement('canvas');
  const g = ov.getContext('2d');
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  let last = 0;
  const TRACE = [];
  function trace(time, kind, txt) {
    const prev = TRACE[TRACE.length - 1];
    if (prev && prev.kind === kind && kind.startsWith('fx:')) { prev.txt = txt; prev.time = time; prev.born = performance.now(); return; }
    TRACE.push({ time, kind, txt, born: performance.now() });
    if (TRACE.length > 60) TRACE.shift();
  }
  const F = "'JetBrains Mono', ui-monospace, monospace";
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  function draw(D, now) {
    if (now - last < 66) return false;  // ~15 fps
    last = now;
    const W = D.w, H = D.h;
    if (ov.width !== W || ov.height !== H) { ov.width = W; ov.height = H; }
    g.clearRect(0, 0, W, H);
    const fs = Math.max(10, Math.round(H / 54)), lh = Math.round(fs * 1.42), m = Math.round(H * 0.055);
    const acc = D.accent || '#f2f0ea';
    g.textBaseline = 'top';
    const scrim = (x, y, w, h) => { g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(x, y, w, h); };
    // ---- columna izquierda: el programa
    const lx = m, lw = Math.round(W * 0.5) - m, rows = Math.floor((H - 2 * m - 3 * lh) / lh);
    scrim(lx - fs, m - fs * 0.8, lw + fs, H - 2 * m + fs * 1.6);
    g.font = `400 ${fs}px ${F}`;
    g.fillStyle = 'rgba(242,240,234,0.9)'; g.fillText(D.head || 'VØID_LOOM', lx, m);
    g.fillStyle = 'rgba(242,240,234,0.38)'; g.fillText(D.sub || '', lx, m + lh);
    const src = D.src || [];
    if (src.length) {
      const cur = Math.floor(VLL.clamp(D.p / D.dur, 0, 0.9999) * src.length);
      const top = Math.max(0, Math.min(src.length - rows, cur - Math.floor(rows / 2)));
      const maxc = Math.floor(lw / (fs * 0.6)) - 6;
      for (let i = 0; i < rows && top + i < src.length; i++) {
        const n = top + i, line = src[n], y = m + 3 * lh + i * lh;
        const isCur = n === cur, isPost = /VL\.post|flash|bloom/.test(line) && D.golpe > 0.25;
        g.fillStyle = isCur ? acc : 'rgba(242,240,234,0.18)';
        g.fillText(String(n + 1).padStart(4, ' '), lx, y);
        g.fillStyle = isCur ? 'rgba(242,240,234,0.95)' : isPost ? acc : `rgba(242,240,234,${0.2 + 0.32 * (1 - Math.abs(n - cur) / rows)})`;
        g.fillText(line.slice(0, maxc), lx + fs * 3.4, y);
        if (isCur) { g.fillStyle = acc; g.fillRect(lx - fs * 0.6, y + 2, 2, fs); }
      }
    }
    // ---- columna derecha: valores vivos + traza
    const rx = Math.round(W * 0.56), rw = W - rx - m;
    const vals = D.vals || [];
    let y = m;
    scrim(rx - fs, m - fs * 0.8, rw + fs, H - 2 * m + fs * 1.6);
    g.fillStyle = 'rgba(242,240,234,0.38)'; g.fillText('// estado', rx, y); y += lh * 1.3;
    for (const [k, v, hot] of vals) {
      g.fillStyle = 'rgba(242,240,234,0.42)'; g.fillText(pad(k, 8), rx, y);
      g.fillStyle = hot ? acc : 'rgba(242,240,234,0.92)'; g.fillText(String(v), rx + fs * 0.6 * 9, y); y += lh;
    }
    y += lh * 0.6;
    g.fillStyle = 'rgba(242,240,234,0.38)'; g.fillText('// traza', rx, y); y += lh * 1.3;
    const shaderRows = D.shader ? Math.min(14, D.shader.split('\n').length + 2) : 0;
    const traceRows = Math.max(3, Math.floor((H - m - y) / lh) - shaderRows - (shaderRows ? 1 : 0));
    const list = TRACE.slice(-traceRows);
    const tnow = performance.now();
    list.forEach((e, i) => {
      const fresh = Math.max(0, 1 - (tnow - e.born) / 700);
      const age = (list.length - 1 - i) / Math.max(1, traceRows);
      g.fillStyle = `rgba(242,240,234,${0.2 + 0.25 * (1 - age)})`; g.fillText(e.time, rx, y + i * lh);
      g.fillStyle = fresh > 0 ? acc : `rgba(242,240,234,${0.3 + 0.55 * (1 - age)})`;
      g.fillText(e.txt.slice(0, Math.floor(rw / (fs * 0.6)) - 9), rx + fs * 0.6 * 9, y + i * lh);
    });
    if (D.shader) {
      let sy = H - m - (shaderRows - 1) * lh;
      g.fillStyle = 'rgba(242,240,234,0.38)'; g.fillText('// deck C · ' + (D.shaderMix * 100).toFixed(0) + '%', rx, sy - lh * 1.3);
      D.shader.split('\n').slice(-(shaderRows - 2)).forEach((l, i) => { g.fillStyle = 'rgba(242,240,234,0.75)'; g.fillText(l.slice(0, Math.floor(rw / (fs * 0.6))), rx, sy + i * lh); });
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ov);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return true;
  }
  return { compile, pass, C, draw, tex, trace };
};
