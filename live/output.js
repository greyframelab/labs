/* VØID_LOOM LIVE · salida para proyector.
   Carga cada pieza en un iframe invisible (?live), la dibuja con el reloj compartido y compone los dos
   decks en un único lienzo WebGL2: fundido o disolución congelada, estela, destellos en los golpes,
   división de color, inversión y negro. */
(function () {
  const ch = new BroadcastChannel(VLL.CHANNEL);
  const hint = document.getElementById('hint');
  const cv = document.getElementById('out');
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });

  // ------------------------------------------------------------------ estado recibido
  let MIX = { xf: 0, mode: 'fundido', onAir: 'A', quality: 1 };
  let FX = { trail: 0, hits: 0.35, split: 0, invert: 0, black: 0, bright: 1, glitch: 0, punch: 0, lens: 0, mosaic: 0, tint: 0, scan: 0, mirror: 0, strobe: 0, tintC: '#ffffff' };
  const HITS = {};          // piece id -> [s]
  const D = {};             // deck id -> { st, pending, piece, src, frame, api, next }
  ['A', 'B'].forEach((k) => (D[k] = { st: null, pending: [], piece: null, frame: null, api: null, next: null }));

  // ------------------------------------------------------------------ piezas en iframes
  window.VL_LIVE = {
    register(win, o) {
      for (const k in D) {
        const d = D[k];
        [['frame', d.frame], ['next', d.next]].forEach(([slot, fr]) => {
          if (!fr || fr.contentWindow !== win) return;
          const canvas = win.document.getElementById('c') || win.document.querySelector('canvas');
          const api = { render: o.render, canvas, piece: fr.dataset.piece };
          if (slot === 'next') { if (d.frame) d.frame.remove(); d.frame = fr; d.next = null; }
          d.api = api; d.piece = fr.dataset.piece;
          ch.postMessage({ type: 'ready', deck: k, piece: d.piece });
        });
      }
    },
  };
  function frameSize() { const q = MIX.quality || 1; return [Math.round(innerWidth * q), Math.round(innerHeight * q)]; }
  function loadPiece(k, piece, src) {
    const d = D[k];
    if (d.next && d.next.dataset.piece === piece) return;
    if (d.next) d.next.remove();
    const fr = document.createElement('iframe');
    const [w, h] = frameSize();
    fr.className = 'deck'; fr.dataset.piece = piece; fr.dataset.q = MIX.quality;
    fr.style.width = w + 'px'; fr.style.height = h + 'px';
    fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    fr.src = src + (src.includes('?') ? '&' : '?') + 'live';
    document.body.appendChild(fr);
    d.next = fr;
    ch.postMessage({ type: 'loading', deck: k, piece });
  }
  function reloadAll() { for (const k in D) { const d = D[k]; if (d.piece && d.frame) { const src = d.frame.src.replace(/[?&]live\b/, ''); d.piece = null; loadPiece(k, d.frame.dataset.piece, src); } } }

  // ------------------------------------------------------------------ mensajes
  ch.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'state') {
      hint.classList.add('off');
      const prevQ = MIX.quality;
      MIX = m.mix; FX = m.fx;
      for (const k in m.decks) {
        const s = m.decks[k], d = D[k];
        if (!s) continue;
        const want = s.piece;
        const have = d.next ? d.next.dataset.piece : d.frame ? d.frame.dataset.piece : null;
        if (want && want !== have) loadPiece(k, want, s.src);
        if (s.wall > VLL.now()) d.pending.push(s); else { d.st = s; d.pending.length = 0; }
      }
      if (prevQ !== MIX.quality) reloadAll();
    } else if (m.type === 'hits') HITS[m.piece] = m.hits;
    else if (m.type === 'ping') ch.postMessage({ type: 'hello', w: innerWidth, h: innerHeight });
  };
  ch.postMessage({ type: 'hello', w: innerWidth, h: innerHeight });

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
  });
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { sizeCanvas(); reloadAll(); }, 500); });

  // ------------------------------------------------------------------ WebGL
  const VS = `#version 300 es
  in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 uv; out vec4 o;
  uniform sampler2D A0, A1, B0, B1, FB;
  uniform float aw, bw, ga, gb, fa, fb, trail, flash, split, inv, black, bright, time, aspect, glitch;
  uniform float env, punch, lens, mosaic, tint, mirror, strobe;
  uniform vec3 tintC;
  vec2 LC = vec2(0.);   // aberración radial de la lente
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a*n2(p); p *= 2.03; a *= .5; } return s; }
  vec3 tap(sampler2D t0, sampler2D t1, float w, vec2 q){
    vec2 dx = vec2(split*.012, 0.) + LC;
    vec3 c0 = vec3(texture(t0, q+dx).r, texture(t0, q).g, texture(t0, q-dx).b);
    if (w <= 0.) return c0;
    vec3 c1 = vec3(texture(t1, q+dx).r, texture(t1, q).g, texture(t1, q-dx).b);
    return mix(c0, c1, w);
  }
  // un deck: si está congelado (f>0) se deshace en polvo hacia arriba según su peso
  vec3 deck(sampler2D t0, sampler2D t1, float w, float g, float f, vec2 q){
    if (g <= 0.001) return vec3(0);
    if (f < .5) return tap(t0, t1, w, q) * g;
    vec2 s = q * vec2(aspect, 1.) * 3.2;
    float n = fbm(s + vec2(0., time*.15));
    float melt = 1. - g;
    vec2 d = vec2(fbm(s*1.7 + 4.1) - .5, -abs(fbm(s*1.3 + 9.7))) * melt * .09;
    vec3 c = tap(t0, t1, 0., q + d);
    float k = smoothstep(n - .06, n + .06, g * 1.12 - .06);
    float edge = smoothstep(.0, .06, abs(g*1.12 - .06 - n)); // borde incandescente
    return c * k + c * (1. - edge) * 1.6 * step(.02, g);
  }
  vec2 kal(vec2 q, float n){
    vec2 p = (q - .5) * vec2(aspect, 1.);
    float r = length(p), a = atan(p.y, p.x) + time * .04, s = 6.2831853 / n;
    a = mod(a, s); a = abs(a - s * .5);
    return vec2(cos(a), sin(a)) * r / vec2(aspect, 1.) + .5;
  }
  void main(){
    vec2 q = uv;
    // espejo: 1 = horizontal, 2 = cuatro cuadrantes, 3 = caleidoscopio
    if (mirror > .5 && mirror < 1.5) q.x = .5 - abs(q.x - .5);
    else if (mirror > 1.5 && mirror < 2.5) q = .5 - abs(q - .5);
    else if (mirror > 2.5) q = kal(q, 6.);
    // latido: empujón de cámara en cada golpe
    q = (q - .5) / (1. + punch * .09 * env) + .5;
    // lente: barril + aberración radial
    if (lens > 0.) { vec2 d = (q - .5) * vec2(aspect, 1.); float r2 = dot(d, d); q = .5 + (q - .5) * (1. - lens * .22 * r2 * (1. + .6 * env)); LC = (q - .5) * lens * .018; }
    // mosaico
    if (mosaic > 0.) { float cells = mix(900., 18., pow(mosaic, .55)); vec2 g = vec2(cells * aspect, cells); q = (floor(q * g) + .5) / g; }
    if (glitch > 0.) { float r = floor(q.y * 48.) ; float jj = h(vec2(r, floor(time*24.))); if (jj > 1. - glitch*.35) q.x += (h(vec2(r, time)) - .5) * .08 * glitch; }
    vec3 a = deck(A0, A1, aw, ga, fa, q);
    vec3 b = deck(B0, B1, bw, gb, fb, q);
    vec3 c = max(a, b) + .25 * min(a, b);
    if (trail > 0.) {
      vec2 z = (uv - .5) * (1. - .004 - trail*.008) + .5;
      vec3 prev = texture(FB, z).rgb;
      c = max(c, prev * (.80 + trail*.18));
    }
    c *= bright;
    // tinte: todo en el acento de la pieza en el aire, con las luces altas en blanco
    if (tint > 0.) { float l = dot(c, vec3(.299, .587, .114)); vec3 m = mix(tintC * l * 1.5, vec3(l), smoothstep(.65, 1., l)); c = mix(c, m, tint); }
    // strobe: la imagen solo existe en los golpes
    if (strobe > .5) c *= smoothstep(.12, .3, env);
    c = mix(c, vec3(1.) - c, inv);
    c += flash * (vec3(1.) - c) * .55;
    c *= 1. - black;
    o = vec4(c, 1.);
  }`;
  const FS_BLIT = `#version 300 es
  precision highp float; precision highp sampler2DArray; in vec2 uv; out vec4 o;
  uniform sampler2D S; uniform sampler2DArray H; uniform float scan, head;
  void main(){
    vec3 c = texture(S, uv).rgb;
    // escaneo (slit-scan): cada franja horizontal llega con más retraso hacia abajo
    if (scan > 0.) {
      float d = (1. - uv.y) * scan * 30.;
      float l0 = mod(head - floor(d) + 64., 32.), l1 = mod(l0 - 1. + 32., 32.);
      vec3 hc = mix(texture(H, vec3(uv, l0)).rgb, texture(H, vec3(uv, l1)).rgb, fract(d));
      c = mix(c, hc, smoothstep(0., .12, scan));
    }
    o = vec4(c, 1.);
  }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  function prog(fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); return p; }
  const P = prog(FS), PB = prog(FS_BLIT);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['A0', 'A1', 'B0', 'B1', 'FB', 'aw', 'bw', 'ga', 'gb', 'fa', 'fb', 'trail', 'flash', 'split', 'inv', 'black', 'bright', 'time', 'aspect', 'glitch', 'env', 'punch', 'lens', 'mosaic', 'tint', 'mirror', 'strobe', 'tintC'].forEach((n) => (U[n] = gl.getUniformLocation(P, n)));
  const UB = {}; ['S', 'H', 'scan', 'head'].forEach((n) => (UB[n] = gl.getUniformLocation(PB, n)));
  function tex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); return t; }
  const T = { A0: tex(), A1: tex(), B0: tex(), B1: tex() };
  let FBO = [], HIST = null, HFB = null, HW = 0, HH = 0, head = 0;
  function sizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth * dpr, h = innerHeight * dpr, k = Math.min(1, 1920 / Math.max(w, h));
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    FBO.forEach((f) => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.t); });
    FBO = [0, 1].map(() => { const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); return { fb, t }; });
    // historial de 32 frames a media resolución para el escaneo
    if (HIST) gl.deleteTexture(HIST);
    HW = Math.round(cv.width / 2); HH = Math.round(cv.height / 2);
    HIST = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, HIST);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, HW, HH, 32, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (!HFB) HFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  sizeCanvas();
  const hex = (h) => { h = (h || '#ffffff').replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // subir el lienzo de la pieza: reutiliza la textura si no cambia de tamaño
  function upload(t, canvas) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (t._w === canvas.width && t._h === canvas.height) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); t._w = canvas.width; t._h = canvas.height; }
  }

  // ------------------------------------------------------------------ bucle
  const hitEnv = (piece, p, rate) => {
    const hs = HITS[piece]; if (!hs || !hs.length) return 0;
    let lo = 0, hi = hs.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (hs[m] <= p) { k = m; lo = m + 1; } else hi = m - 1; }
    if (k < 0) return 0;
    const age = (p - hs[k]) / Math.max(0.25, Math.abs(rate || 1));
    return age < 0.4 ? Math.exp(-age * 16) : 0;
  };
  let now_ = 0, scanOn = false;
  let cur = 0, blackS = 0, fpsN = 0, fpsT = performance.now(), lastPrev = 0, info = {};
  function drawDeck(k, w, live) {
    const d = D[k];
    while (d.pending.length && d.pending[0].wall <= VLL.now()) d.st = d.pending.shift();
    const s = d.st;
    const r = { w: 0, env: 0 };
    if (!s || !s.piece || !d.api || d.api.piece !== s.piece) return r;
    const P_ = VLL.pos(s, VLL.now());
    if (!P_ || P_.ended) return r;
    info[k] = P_.p;
    if (w > 0.001 && live) {
      try {
        // en la vuelta de un loop solo se dibujan dos frames mientras los dos se ven de verdad
        if (P_.blend > 0.97) { d.api.render(P_.pin); upload(T[k + '0'], d.api.canvas); }
        else {
          d.api.render(P_.p); upload(T[k + '0'], d.api.canvas);
          if (P_.blend > 0.03) { d.api.render(P_.pin); upload(T[k + '1'], d.api.canvas); r.w = P_.blend; }
        }
        r.drawn = true;
      } catch (e) { console.warn(e); }
    }
    // vista previa para la consola: solo se copia un frame que ya se ha dibujado para el proyector.
    // El deck que no está en el aire nunca se dibuja aparte: coste cero en el frame de la salida.
    if (r.drawn && now_ - (d.lastPrev || 0) > 160) {
      d.lastPrev = now_;
      try {
        const cw = d.api.canvas.width, chh = d.api.canvas.height, pw = 400;
        createImageBitmap(d.api.canvas, { resizeWidth: pw, resizeHeight: Math.round(pw * chh / cw), resizeQuality: 'low' })
          .then((bmp) => { try { ch.postMessage({ type: 'dprev', deck: k, bmp }); } catch (e) {} bmp.close(); }).catch(() => {});
      } catch (e) {}
    }
    r.env = hitEnv(s.piece, P_.p, s.rate) * w;
    r.ok = true;
    return r;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    now_ = now;
    const xf = MIX.xf;
    let ga = Math.cos(xf * Math.PI / 2), gb = Math.sin(xf * Math.PI / 2);
    if (MIX.mode === 'fundido') { ga = Math.min(1, 2 * (1 - xf)); gb = Math.min(1, 2 * xf); }
    const frz = MIX.mode === 'congelar' && xf > 0.001 && xf < 0.999;
    const fa = frz && MIX.onAir === 'A' ? 1 : 0, fb = frz && MIX.onAir === 'B' ? 1 : 0;
    const ra = drawDeck('A', ga, !fa), rb = drawDeck('B', gb, !fb);
    if (!ra.ok) ga = 0; if (!rb.ok) gb = 0;
    blackS += ((FX.black ? 1 : 0) - blackS) * 0.12;
    const env = Math.max(ra.env, rb.env);
    gl.useProgram(P);
    const src = FBO[cur ^ 1], dst = FBO[cur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, cv.width, cv.height);
    [['A0', 0], ['A1', 1], ['B0', 2], ['B1', 3]].forEach(([n, i]) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, T[n]); gl.uniform1i(U[n], i); });
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(U.FB, 4);
    gl.uniform1f(U.aw, ra.w); gl.uniform1f(U.bw, rb.w); gl.uniform1f(U.ga, ga); gl.uniform1f(U.gb, gb);
    gl.uniform1f(U.fa, fa); gl.uniform1f(U.fb, fb);
    gl.uniform1f(U.trail, FX.trail); gl.uniform1f(U.flash, FX.hits * env);
    gl.uniform1f(U.split, FX.split * (0.25 + 0.75 * env) + (FX.glitch ? 0.6 : 0));
    gl.uniform1f(U.inv, FX.invert ? 1 : 0); gl.uniform1f(U.black, blackS); gl.uniform1f(U.bright, FX.bright);
    gl.uniform1f(U.time, now / 1000); gl.uniform1f(U.aspect, cv.width / cv.height); gl.uniform1f(U.glitch, FX.glitch ? 1 : 0);
    gl.uniform1f(U.env, env); gl.uniform1f(U.punch, FX.punch || 0); gl.uniform1f(U.lens, FX.lens || 0); gl.uniform1f(U.mosaic, FX.mosaic || 0);
    gl.uniform1f(U.tint, FX.tint || 0); gl.uniform1f(U.mirror, FX.mirror || 0); gl.uniform1f(U.strobe, FX.strobe ? 1 : 0);
    gl.uniform3fv(U.tintC, hex(FX.tintC));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // historial del escaneo: solo se graba con el efecto activo; al encenderlo se rellena con el frame actual
    if (FX.scan > 0) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, dst.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, HFB);
      const layers = scanOn ? [(head + 1) % 32] : [...Array(32).keys()];
      for (const l of layers) {
        gl.framebufferTextureLayer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, HIST, 0, l);
        gl.blitFramebuffer(0, 0, cv.width, cv.height, 0, 0, HW, HH, gl.COLOR_BUFFER_BIT, gl.LINEAR);
      }
      head = (head + 1) % 32; scanOn = true;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    } else scanOn = false;
    gl.useProgram(PB); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.uniform1i(UB.S, 0);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, HIST); gl.uniform1i(UB.H, 5);
    gl.uniform1f(UB.scan, FX.scan || 0); gl.uniform1f(UB.head, head);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cur ^= 1;
    // estadísticas + monitor para la consola
    fpsN++;
    if (now - fpsT > 1000) { ch.postMessage({ type: 'stats', fps: Math.round(fpsN * 1000 / (now - fpsT)), w: cv.width, h: cv.height }); fpsN = 0; fpsT = now; }
    if (now - lastPrev > 150) {
      lastPrev = now;
      const pw = 480, ph = Math.round(pw * cv.height / cv.width);
      createImageBitmap(cv, { resizeWidth: pw, resizeHeight: ph, resizeQuality: 'low' }).then((bmp) => {
        try { ch.postMessage({ type: 'preview', bmp }); } catch (e) {}
        bmp.close();
      }).catch(() => {});
    }
  }
  requestAnimationFrame(frame);
})();
