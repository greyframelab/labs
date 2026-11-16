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
  let FX = { trail: 0, hits: 0, split: 0, invert: 0, black: 0, bright: 1, glitch: 0, punch: 0, lens: 0, mosaic: 0, tint: 0, scan: 0, mirror: 0, strobe: 0, tintC: '#ffffff',
    pBloom: 1, pFlash: 1, pScan: 0.2, cMix: 0, view: 0, viewOp: 0.85, viewMode: 'full' };
  let BANDS = [0, 0, 0];
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
          const api = { render: o.render, canvas, piece: fr.dataset.piece, acts: o.acts || [], dur: o.duration, post: { bloom: 1, flash: 0 } };
          // mandos dentro de la pieza: se aplican en su propio postproceso (VL.post), no encima
          try {
            const VLw = win.VL;
            if (VLw && VLw.post && !VLw.__live) {
              const orig = VLw.post; VLw.__live = true;
              VLw.post = function (out, frame, opt = {}) {
                const o2 = Object.assign({}, opt);
                o2.bloom = (opt.bloom ?? 1) * (FX.pBloom ?? 1); o2.flash = (opt.flash ?? 0) * (FX.pFlash ?? 1);
                // líneas horizontales (scanlines) de la pieza: suavizadas por defecto en el live, que en proyección ensucian
                o2.scan = (opt.scan ?? 1) * (FX.pScan ?? 0.2);
                api.post = { bloom: o2.bloom, flash: o2.flash };
                return orig.call(this, out, frame, o2);
              };
            }
            // el programa real de la pieza, para VER EL CÓDIGO
            const scripts = [...win.document.scripts].map((x) => x.textContent || '').filter((t) => /renderFrame/.test(t));
            const main = scripts.sort((a, b) => b.length - a.length)[0] || '';
            api.src = main.replace(/\t/g, '  ').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l, i, a) => l || (a[i - 1] || '').trim());
            api.title = (win.document.title || '').replace(/\s*·\s*(Greyframe Labs|VØID_LOOM)/gi, '');
          } catch (e) {}
          if (slot === 'next') { if (d.frame) d.frame.remove(); d.frame = fr; d.next = null; }
          d.api = api; d.piece = fr.dataset.piece;
          ch.postMessage({ type: 'ready', deck: k, piece: d.piece });
        });
      }
    },
  };
  // ------------------------------------------------------------------ CALIDAD AUTO
  // Cada pieza se pinta a la resolución que el ordenador aguanta con fluidez. La salida mide los FPS de
  // la pieza en el aire (sola, fuera de fundidos y vueltas de loop) y, si va a saltos, la recarga más
  // pequeña; si va sobrada, la sube poco a poco. Lo aprendido se guarda por pieza (localStorage).
  const PQ_KEY = 'vll:calidadPieza', AUTO0 = 0.75, QMIN = 0.45;
  let PQ = {}; try { PQ = JSON.parse(localStorage.getItem(PQ_KEY) || '{}') || {}; } catch (e) {}
  const savePQ = () => { try { localStorage.setItem(PQ_KEY, JSON.stringify(PQ)); } catch (e) {} };
  const isAuto = () => !(MIX.quality > 0);
  function pieceQ(piece) { if (!isAuto()) return MIX.quality; const e = PQ[piece]; return e ? e.q : AUTO0; }
  function frameSize(piece) { const q = pieceQ(piece); return [Math.max(64, Math.round(innerWidth * q)), Math.max(64, Math.round(innerHeight * q))]; }
  function reloadDeck(k) {
    const d = D[k]; if (!d.piece || !d.frame) return;
    const src = d.frame.src.replace(/[?&]live\b/, ''), piece = d.frame.dataset.piece;
    d.piece = null; loadPiece(k, piece, src); d.reloadAt = performance.now();
  }
  const AQ = { n: 0, sum: 0, long: 0, t0: 0, last: 0, ref: 60, piece: null };
  function autoQuality(now, ra, rb) {
    const dt = AQ.last ? now - AQ.last : 0; AQ.last = now;
    if (!isAuto() || !dt || dt > 500) return;
    // solo cuenta con una pieza en el aire, sin fundido ni vuelta de loop, y ya asentada
    const k = ra.drawn && !rb.drawn ? 'A' : rb.drawn && !ra.drawn ? 'B' : null;
    const d = k && D[k];
    if (!d || !d.frame || d.next || (ra.w || 0) > 0 || (rb.w || 0) > 0 || now - (d.reloadAt || 0) < 2500) { AQ.n = 0; AQ.sum = 0; AQ.long = 0; AQ.t0 = now; return; }
    const piece = d.frame.dataset.piece;
    if (AQ.piece !== piece) { AQ.piece = piece; AQ.n = 0; AQ.sum = 0; AQ.long = 0; AQ.t0 = now; return; }
    AQ.n++; AQ.sum += dt; if (dt > 1000 / AQ.ref * 1.6) AQ.long++; if (dt > 3) AQ.minDt = Math.min(AQ.minDt || 1e9, dt);
    if (now - AQ.t0 < 2500) return;
    const fps = AQ.n * 1000 / AQ.sum, longR = AQ.long / AQ.n;
    // frecuencia de la pantalla (50, 60, 120…): el intervalo más corto entre frames es el de su refresco
    if (AQ.minDt) { const r = 1000 / AQ.minDt; AQ.ref = [30, 50, 60, 75, 90, 100, 120, 144, 165, 240].reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a)); }
    AQ.minDt = 0; AQ.n = 0; AQ.sum = 0; AQ.long = 0; AQ.t0 = now;
    const e = PQ[piece] || (PQ[piece] = { q: +(d.frame.dataset.q || AUTO0), good: 0, fail: 0 });
    if (fps < AQ.ref * 0.85 || longR > 0.08) {
      if (e.q <= QMIN + 0.001) return;
      e.fail = e.q; e.q = Math.max(QMIN, Math.round(e.q * 0.86 * 100) / 100); e.good = 0;
      savePQ(); reloadDeck(k);
      CL.trace(tstr(), 'calidad', `${k} · ${piece} va a saltos (${fps.toFixed(0)} fps) → calidad ${Math.round(e.q * 100)}%`);
    } else if (fps >= AQ.ref * 0.96 && longR < 0.02) {
      if (e.q >= 1) return;
      e.good++;
      const next = Math.min(1, Math.round((e.q + 0.08) * 100) / 100);
      // no vuelve enseguida a la calidad que ya fue a saltos: lo reintenta mucho más tarde
      if (e.good >= (e.fail && next >= e.fail - 0.01 ? 24 : 3)) {
        if (e.fail && next >= e.fail - 0.01) e.fail = 0;
        e.q = next; e.good = 0; savePQ(); reloadDeck(k);
        CL.trace(tstr(), 'calidad', `${k} · ${piece} va sobrada → calidad ${Math.round(e.q * 100)}%`);
      } else savePQ();
    } else e.good = 0;
  }
  function frameQ(k) { const d = D[k]; return d && d.frame ? Math.round(+(d.frame.dataset.q || 1) * 100) : 0; }
  function loadPiece(k, piece, src) {
    const d = D[k];
    if (d.next && d.next.dataset.piece === piece) return;
    if (d.next) d.next.remove();
    const fr = document.createElement('iframe');
    const [w, h] = frameSize(piece);
    fr.className = 'deck'; fr.dataset.piece = piece; fr.dataset.q = pieceQ(piece);
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
      ojoSensor(!!m.ojo);
      hint.classList.add('off');
      const prevQ = MIX.quality;
      traceState(m);
      MIX = m.mix; FX = m.fx;
      if (m.pres && PRES_ && m.pres.hit > PRES_.hit) presHit = 1;   // OJO · fin del contacto: impacto
      PRES_ = m.pres || null;
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
    else if (m.type === 'bands') BANDS = m.v;
    else if (m.type === 'wake') wakeLock();
    else if (m.type === 'code') {
      const r = CL.compile(m.src);
      ch.postMessage(Object.assign({ type: 'codeRes' }, r));
      CL.trace(tstr(), 'code', r.ok ? `deck C · compilado · ${r.lines} líneas` : `deck C · error línea ${r.line}`);
    }
  };
  ch.postMessage({ type: 'hello', w: innerWidth, h: innerHeight });

  // pantalla siempre encendida (instalación desatendida)
  let wl = null;
  async function wakeLock() { try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => (wl = null)); } } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeLock(); });
  addEventListener('keydown', (e) => {
    wakeLock();
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
  uniform float env, punch, lens, mosaic, tint, mirror, strobe, up;
  uniform vec3 tintC;
  vec2 LC = vec2(0.);   // aberración radial de la lente
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a*n2(p); p *= 2.03; a *= .5; } return s; }
  // escalado nítido (Catmull-Rom, 5 lecturas) cuando la pieza se pinta a menos resolución que la salida
  vec3 cr(sampler2D t, vec2 q){
    vec2 ts = vec2(textureSize(t, 0)), sp = q * ts, tc = floor(sp - .5) + .5, f = sp - tc;
    vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);
    vec2 w12 = w1 + w2, t0 = (tc - 1.) / ts, t3 = (tc + 2.) / ts, t12 = (tc + w2 / w12) / ts;
    vec3 c = texture(t, vec2(t12.x, t0.y)).rgb * w12.x * w0.y
           + texture(t, vec2(t0.x, t12.y)).rgb * w0.x * w12.y + texture(t, t12).rgb * w12.x * w12.y + texture(t, vec2(t3.x, t12.y)).rgb * w3.x * w12.y
           + texture(t, vec2(t12.x, t3.y)).rgb * w12.x * w3.y;
    return max(c / (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y), 0.);
  }
  vec3 tx(sampler2D t, vec2 q){ return up > .5 ? cr(t, q) : texture(t, q).rgb; }
  vec3 tap1(sampler2D t, vec2 q, vec2 dx){
    if (dot(dx, dx) < 1e-10) return tx(t, q);
    return vec3(texture(t, q+dx).r, tx(t, q).g, texture(t, q-dx).b);
  }
  vec3 tap(sampler2D t0, sampler2D t1, float w, vec2 q){
    vec2 dx = vec2(split*.012, 0.) + LC;
    vec3 c0 = tap1(t0, q, dx);
    if (w <= 0.) return c0;
    vec3 c1 = tap1(t1, q, dx);
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
  uniform sampler2D S, OV; uniform sampler2DArray H; uniform float scan, head, ovOp;
  uniform sampler2D OJ; uniform float ojoK, ojoMq;   // OJO: el visitante como lo ve la máquina, encima de la pieza
  // VISTA MÁQUINA
  uniform sampler2D GA, TX; uniform float maq, mt, menv, mlen, mrows, mlod, moff; uniform vec2 mres; uniform vec3 macc;
  float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lu(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
  // fuente de MÁQUINA: la imagen de la pieza (S) o el visitante visto por OJO (OJ)
  vec3 msrc(bool oj, vec2 q){ return oj ? texture(OJ, q).rgb : texture(S, q).rgb; }
  vec3 machine(vec3 c, bool oj){
    float ch = mres.y / mrows, cw = ch * .62, cols = floor(mres.x / cw);
    vec2 px = vec2(uv.x * mres.x, (1. - uv.y) * mres.y);
    vec2 cell = floor(px / vec2(cw, ch)), f = fract(px / vec2(cw, ch));
    vec2 cc = (cell + .5) * vec2(cw, ch), cuv = vec2(cc.x / mres.x, 1. - cc.y / mres.y);
    vec2 dx = vec2(cw / mres.x, 0.), dy = vec2(0., ch / mres.y);
    vec3 col = msrc(oj, cuv).rgb;
    float l = lu(col);
    // contornos: donde la máquina reconoce forma
    float gx = lu(msrc(oj, cuv + dx).rgb) - lu(msrc(oj, cuv - dx).rgb);
    float gy = lu(msrc(oj, cuv + dy).rgb) - lu(msrc(oj, cuv - dy).rgb);
    float edge = clamp(length(vec2(gx, gy)) * 2.2, 0., 1.);
    // el programa de la pieza como una página de texto quieta; pasa unas líneas en cada golpe
    float i = mod(cell.y * cols + cell.x + moff, mlen);
    // en los golpes los contornos se reescriben
    if (menv > .2 && h2(cell + floor(mt * 11.)) < edge * menv * .8) i = floor(h2(cell * 1.7 + floor(mt * 13.)) * mlen);
    int ii = int(i);
    float gi = floor(texelFetch(TX, ivec2(ii % 1024, ii / 1024), 0).r * 255. + .5);
    vec2 g = vec2(mod(gi, 16.), floor(gi / 16.));
    float glyph = textureLod(GA, (g + vec2(.06 + f.x * .88, .03 + f.y * .94)) / vec2(16., 8.), mlod).r;
    // la imagen existe solo como texto: cada carácter brilla con la luz que tiene debajo
    float img = smoothstep(.03, .55, l);
    // cursor de lectura: una columna que recorre la imagen y enciende lo que lee
    float rx = fract(mt * .045) * (cols + 24.) - 12.;
    float rd = cell.x - rx;
    float read = rd <= 0. ? exp(rd / 7.) : exp(-rd * 1.5);
    float cursor = exp(-abs(rd) * 3.) * (.08 + .5 * img);
    vec3 hue = col / max(max(col.r, max(col.g, col.b)), .04);
    vec3 paper = vec3(.95, .94, .91);
    vec3 tone = mix(paper, paper * hue, .22);
    float a = img * (.42 + .4 * edge + .35 * read) + menv * img * .3;
    vec3 ink = tone * a + macc * edge * (.25 + .9 * menv) * img + paper * cursor;
    // trama de fondo apenas visible: la página entera, aunque no haya luz
    ink += paper * .035 * (1. - img);
    return glyph * ink + c * .03;
  }
  void main(){
    vec3 c = texture(S, uv).rgb;
    // escaneo (slit-scan): cada franja horizontal llega con más retraso hacia abajo
    if (scan > 0.) {
      float d = (1. - uv.y) * scan * 30.;
      float l0 = mod(head - floor(d) + 64., 32.), l1 = mod(l0 - 1. + 32., 32.);
      vec3 hc = mix(texture(H, vec3(uv, l0)).rgb, texture(H, vec3(uv, l1)).rgb, fract(d));
      c = mix(c, hc, smoothstep(0., .12, scan));
    }
    if (maq > 0.) c = mix(c, machine(c, false), maq);
    if (ojoK > 0.) {
      vec3 v = texture(OJ, uv).rgb;
      // BORDES + MÁQUINA: el visitante escrito con el código de la pieza, con sus contornos encima
      if (ojoMq > .5) { vec3 g = machine(vec3(0.), true); c = c * (1. - .35 * ojoK) + g * ojoK * 1.3; v *= .45; }
      v *= ojoK; c = 1. - (1. - c) * (1. - v);
    }
    if (ovOp > 0.) { vec4 v = texture(OV, uv); c = c * (1. - v.a * ovOp) + v.rgb * ovOp; }
    o = vec4(c, 1.);
  }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  function prog(fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); return p; }
  const P = prog(FS), PB = prog(FS_BLIT);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['A0', 'A1', 'B0', 'B1', 'FB', 'aw', 'bw', 'ga', 'gb', 'fa', 'fb', 'trail', 'flash', 'split', 'inv', 'black', 'bright', 'time', 'aspect', 'glitch', 'env', 'punch', 'lens', 'mosaic', 'tint', 'mirror', 'strobe', 'tintC', 'up'].forEach((n) => (U[n] = gl.getUniformLocation(P, n)));
  const UB = {}; ['S', 'H', 'scan', 'head', 'OV', 'ovOp', 'GA', 'TX', 'maq', 'mt', 'menv', 'mlen', 'mrows', 'mlod', 'mres', 'macc', 'moff', 'OJ', 'ojoK', 'ojoMq'].forEach((n) => (UB[n] = gl.getUniformLocation(PB, n)));
  function tex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); return t; }
  const T = { A0: tex(), A1: tex(), B0: tex(), B1: tex() };
  const CL = window.VLCodeLayer(gl, VS);
  let CF = [], ci = 0;
  let FBO = [], HIST = null, HFB = null, HW = 0, HH = 0, head = 0;
  function sizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth * dpr, h = innerHeight * dpr, k = Math.min(1, 1920 / Math.max(w, h));
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    FBO.forEach((f) => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.t); });
    FBO = [0, 1].map(() => { const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); return { fb, t }; });
    CF.forEach((f) => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.t); });
    CF = [0, 1].map(() => { const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
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
  let now_ = 0, scanOn = false, PRES_ = null, presHit = 0;
  // OJO como sensor: cámara + IA sin imagen, oculto en esta ventana (siempre a la vista, nunca se pausa).
  // Envía la presencia directamente a la consola por BroadcastChannel('voidloom-presencia').
  let ojoFr = null, ojoSt = '', ojoK = 0, ojoShown = false, ojoMode = 'bordes';
  // El visitante: la vista CÓDIGO de OJO (te escribe con su propio código) con la malla de la cara y los datos,
  // todo en una sola pasada del sensor. OJO_LOOK = 'mix' escribe además con el código de la pieza
  // (pasa MÁQUINA por la imagen de OJO); OJO_MODES = ['bordes'] para ver solo contornos.
  const OJO_MODES = ['codigo'], OJO_LOOK = 'plain';
  const ojoTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, ojoTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  function ojoCfg(show) { try { ojoFr.contentWindow.postMessage({ type: 'ojo-cfg', show, mode: ojoMode }, '*'); } catch (e) {} }
  function ojoCanvas() { try { return ojoFr.contentDocument.getElementById('c'); } catch (e) { return null; } }
  function ojoSensor(on) {
    if (on && !ojoFr) {
      ojoFr = document.createElement('iframe');
      ojoFr.allow = 'camera; autoplay';
      ojoFr.style.cssText = 'position:fixed;left:-340px;top:0;width:320px;height:180px;border:0;opacity:0;pointer-events:none';
      ojoFr.src = '../ojo/sensor.html';
      document.body.appendChild(ojoFr);
      ojoSt = 'camara'; ch.postMessage({ type: 'ojo', st: ojoSt });
    } else if (!on && ojoFr) { ojoFr.remove(); ojoFr = null; ojoSt = ''; ojoShown = false; ojoK = 0; ch.postMessage({ type: 'ojo', st: '' }); }
  }
  window.addEventListener('message', (e) => { const d = e.data; if (d && d.type === 'ojo-sensor' && ojoFr && e.source === ojoFr.contentWindow) { ojoSt = d.st; ch.postMessage({ type: 'ojo', st: d.st, err: d.err }); } });
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
    r.p = P_.p;
    if (w > 0.5) traceDeck(k, d, s, P_);
    return r;
  }
  // ------------------------------------------------------------------ traza y datos para VER EL CÓDIGO
  const tstr = () => { const t = (performance.now() / 1000) % 3600; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + (t % 60).toFixed(2).padStart(5, '0'); };
  const actName = (api, p) => { let n = ''; (api.acts || []).forEach(([t0, nm]) => { if (p >= t0 - 1e-4) n = nm; }); return n; };
  function traceDeck(k, d, s, P_) {
    const T_ = d.tr || (d.tr = {});
    const hs = HITS[s.piece] || [];
    let hi = -1; for (let i = 0; i < hs.length; i++) { if (hs[i] <= P_.p) hi = i; else break; }
    const act = actName(d.api, P_.p);
    if (T_.piece === s.piece) {
      if (act !== T_.act) CL.trace(tstr(), 'act', `${k} · acto ${act} → t = ${P_.p.toFixed(2)}`);
      if (s.rate > 0 && P_.p < T_.p - 0.05 && !s.freeze) CL.trace(tstr(), 'loop', `${k} · vuelta → [${(+s.a).toFixed(2)}, ${(+s.b).toFixed(2)})`);
      if (hi > T_.hi && hi >= 0) CL.trace(tstr(), 'hit', `${k} · golpe #${hi + 1} → VL.post({ bloom: ${d.api.post.bloom.toFixed(2)}, flash: ${d.api.post.flash.toFixed(2)} })`);
    }
    Object.assign(T_, { piece: s.piece, act, p: P_.p, hi });
  }
  const FXN = { trail: 'estela', split: 'división', bright: 'brillo', punch: 'latido', lens: 'lente', mosaic: 'mosaico', tint: 'tinte', scan: 'escaneo', mirror: 'espejo', pBloom: 'pieza.bloom', pFlash: 'pieza.flash', pScan: 'pieza.líneas', cMix: 'deckC.mezcla', hits: 'golpes' };
  function traceState(m) {
    if (!FX.view) return;
    for (const key in FXN) if (m.fx[key] !== FX[key] && typeof m.fx[key] === 'number') CL.trace(tstr(), 'fx:' + key, `fx.${FXN[key]} = ${(+m.fx[key]).toFixed(2)}`);
    if (m.mix.xf !== MIX.xf) CL.trace(tstr(), 'fx:xf', `crossfader = ${m.mix.xf.toFixed(2)}`);
    for (const k in m.decks) {
      const a = m.decks[k], b = D[k].st; if (!a) continue;
      if (!b || a.piece !== b.piece) CL.trace(tstr(), 'deck', `${k} · carga ${a.piece}`);
      else if (a.freeze != null && b.freeze == null) CL.trace(tstr(), 'deck', `${k} · congelar en t = ${(+a.freeze).toFixed(2)}`);
      else if (a.once && !b.once) CL.trace(tstr(), 'deck', `${k} · FIRMA`);
      else if (a.a !== b.a || a.b !== b.b) CL.trace(tstr(), 'deck', `${k} · loop [${(+a.a).toFixed(2)}, ${(+a.b).toFixed(2)})`);
      else if (a.rate !== b.rate || a.ramp) CL.trace(tstr(), 'deck', `${k} · rate = ${a.ramp ? 'cinta → ' + a.ramp.to.toFixed(2) : (+a.rate).toFixed(2)}`);
    }
  }
  // VER CÓDIGO · ALTERNAR: va pasando entre PANTALLA, VENTANA, MÁQUINA y ratos solo de imagen (nunca dos a la vez), cada 6–12 s, en un golpe
  const ALT = { m: 'full', until: 0, k: 1, want: 1 };
  function viewModeNow(now, env) {
    if (FX.viewMode !== 'alt') { ALT.until = 0; ALT.k = 1; ALT.want = 1; return FX.viewMode; }
    if (!ALT.until) ALT.until = now + 3000 + Math.random() * 2000;
    if (ALT.want && now > ALT.until && (env > 0.35 || now > ALT.until + 1500)) ALT.want = 0;
    ALT.k += (ALT.want - ALT.k) * (ALT.want ? 0.12 : 0.3);
    if (!ALT.want && ALT.k < 0.02) { const o = ['full', 'win', 'maq', 'none', 'none'].filter((m) => m !== ALT.m); ALT.m = o[Math.floor(Math.random() * o.length)]; ALT.want = 1; ALT.until = now + 6000 + Math.random() * 6000; }
    return ALT.m;
  }
  let maqS = 0, maqOff = 0, maqHit = false;
  function viewData(env, mode) {
    const k = MIX.onAir, d = D[k], api = d.api, s = d.st;
    const p = (d.tr && d.tr.p) || 0;
    const vals = [];
    if (api && s) {
      vals.push(['t', p.toFixed(3)], ['frame', Math.floor(p * 60)], ['acto', actName(api, p), true], ['rate', (+s.rate).toFixed(2) + '×'],
        ['bloom', api.post.bloom.toFixed(3), env > 0.25], ['flash', api.post.flash.toFixed(3), env > 0.25],
        ['golpe', d.tr && d.tr.hi >= 0 ? '#' + (d.tr.hi + 1) + '  ' + env.toFixed(2) : '—', env > 0.25]);
      if (s.a > 0 || s.b < api.dur - 0.01) vals.push(['loop', `[${(+s.a).toFixed(2)}, ${(+s.b).toFixed(2)})`]);
    }
    vals.push(['audio', BANDS.map((v) => v.toFixed(2)).join(' ')]);
    return { w: cv.width, h: cv.height, accent: FX.tintC, head: api ? 'VØID_LOOM · ' + (api.title || s.piece).toUpperCase() : 'VØID_LOOM', sub: 'renderFrame(t, frame) · deck ' + k,
      src: api && api.src, p, dur: api ? api.dur : 1, golpe: env, vals, shader: CL.C.prog && FX.cMix > 0.001 ? CL.C.src : '', shaderMix: FX.cMix, mode: mode || FX.viewMode };
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
    autoQuality(now, ra, rb);
    blackS += ((FX.black ? 1 : 0) - blackS) * 0.12;
    const env = Math.max(ra.env, rb.env);
    gl.useProgram(P);
    const src = FBO[cur ^ 1], dst = FBO[cur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, cv.width, cv.height);
    [['A0', 0], ['A1', 1], ['B0', 2], ['B1', 3]].forEach(([n, i]) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, T[n]); gl.uniform1i(U[n], i); });
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(U.FB, 4);
    gl.uniform1f(U.aw, ra.w); gl.uniform1f(U.bw, rb.w); gl.uniform1f(U.ga, ga); gl.uniform1f(U.gb, gb);
    gl.uniform1f(U.fa, fa); gl.uniform1f(U.fb, fb);
    gl.uniform1f(U.trail, FX.trail); gl.uniform1f(U.flash, Math.min(1, FX.hits * env + presHit)); presHit *= 0.86; if (presHit < 0.01) presHit = 0;
    gl.uniform1f(U.split, FX.split * (0.25 + 0.75 * env) + (FX.glitch ? 0.6 : 0));
    gl.uniform1f(U.inv, FX.invert ? 1 : 0); gl.uniform1f(U.black, blackS); gl.uniform1f(U.bright, FX.bright);
    gl.uniform1f(U.time, now / 1000); gl.uniform1f(U.aspect, cv.width / cv.height); gl.uniform1f(U.glitch, FX.glitch ? 1 : 0);
    gl.uniform1f(U.env, env); gl.uniform1f(U.punch, FX.punch || 0); gl.uniform1f(U.lens, FX.lens || 0); gl.uniform1f(U.mosaic, FX.mosaic || 0);
    gl.uniform1f(U.tint, FX.tint || 0); gl.uniform1f(U.mirror, FX.mirror || 0); gl.uniform1f(U.strobe, FX.strobe ? 1 : 0);
    gl.uniform3fv(U.tintC, hex(FX.tintC));
    gl.uniform1f(U.up, (T.A0._w && T.A0._w < cv.width * 0.98) || (T.B0._w && T.B0._w < cv.width * 0.98) ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // deck C: el shader en directo se aplica sobre la imagen compuesta (solo si está activo)
    let fin = dst;
    if (CL.C.prog && FX.cMix > 0.001) {
      const outF = CF[ci], prevF = CF[ci ^ 1];
      CL.pass({ fb: outF.fb, w: cv.width, h: cv.height, img: dst.t, a: T.A0, b: T.B0, prev: prevF.t, t: now / 1000, golpe: env, bands: BANDS, mix: FX.cMix, acc: hex(FX.tintC), pres: PRES_ });
      fin = outF; ci ^= 1;
    }
    // historial del escaneo: solo se graba con el efecto activo; al encenderlo se rellena con el frame actual
    if (FX.scan > 0) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fin.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, HFB);
      const layers = scanOn ? [(head + 1) % 32] : [...Array(32).keys()];
      for (const l of layers) {
        gl.framebufferTextureLayer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, HIST, 0, l);
        gl.blitFramebuffer(0, 0, cv.width, cv.height, 0, 0, HW, HH, gl.COLOR_BUFFER_BIT, gl.LINEAR);
      }
      head = (head + 1) % 32; scanOn = true;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    } else scanOn = false;
    gl.useProgram(PB); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
    // VER EL CÓDIGO
    const viewOn = FX.view && FX.viewOp > 0.001;
    const vMode = viewModeNow(now, env), isMaq = vMode === 'maq';
    const codeOn = viewOn && !isMaq && vMode !== 'none';
    if (codeOn) CL.draw(viewData(env, vMode), now);
    // VISTA MÁQUINA: entra y sale con un fundido corto; apagada no cuesta nada
    maqS += ((viewOn && isMaq ? Math.min(1, FX.viewOp / 0.85) * ALT.k : 0) - maqS) * 0.14;
    if (maqS < 0.002) maqS = 0;
    if (maqS > 0 || (ojoK > 0 && OJO_LOOK === 'mix')) {
      const api = D[MIX.onAir].api; CL.machineSrc(api && api.src);
      const rows = Math.round(Math.min(78, Math.max(40, cv.height / 15)));
      gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, CL.M.atlas); gl.uniform1i(UB.GA, 11);
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, CL.M.text); gl.uniform1i(UB.TX, 12);
      gl.uniform1f(UB.mt, now / 1000); gl.uniform1f(UB.menv, env); gl.uniform1f(UB.mlen, CL.M.len); gl.uniform1f(UB.mrows, rows);
      gl.uniform1f(UB.mlod, Math.max(0, Math.log2(CL.M.ah / (cv.height / rows)))); gl.uniform2f(UB.mres, cv.width, cv.height);
      gl.uniform3fv(UB.macc, hex(FX.tintC));
      // pasa página en cada golpe
      if (env > 0.5 && !maqHit) { maqOff += Math.floor(cv.width / ((cv.height / rows) * 0.62)) * (2 + Math.floor(Math.random() * 5)); maqHit = true; }
      if (env < 0.2) maqHit = false;
      gl.uniform1f(UB.moff, maqOff % Math.max(1, CL.M.len));
    }
    gl.uniform1f(UB.maq, maqS);
    // OJO · el visitante encima de la pieza (en el contacto la pieza va a negro y queda solo él)
    const ojoWant = ojoFr && PRES_ ? Math.min(1, PRES_.k * 1.2) * 0.9 : 0;
    if (ojoWant > 0.3 && !ojoShown) { ojoShown = true; ojoMode = OJO_MODES[Math.floor(Math.random() * OJO_MODES.length)]; ojoCfg(true); }
    if (ojoWant < 0.02 && ojoK < 0.02 && ojoShown) { ojoShown = false; ojoCfg(false); }
    ojoK += (ojoWant - ojoK) * 0.06; if (ojoK < 0.003) ojoK = 0;
    let ojoOn = 0;
    if (ojoK > 0 && ojoShown) {
      const oc = ojoCanvas();
      if (oc && oc.width >= 640) {
        gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, ojoTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, oc);
        gl.uniform1i(UB.OJ, 13); ojoOn = ojoK;
      }
    }
    gl.uniform1f(UB.ojoK, ojoOn); gl.uniform1f(UB.ojoMq, OJO_LOOK === 'mix' ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fin.t); gl.uniform1i(UB.S, 0);
    gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, CL.tex); gl.uniform1i(UB.OV, 10);
    gl.uniform1f(UB.ovOp, codeOn ? FX.viewOp * ALT.k : 0);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, HIST); gl.uniform1i(UB.H, 5);
    gl.uniform1f(UB.scan, FX.scan || 0); gl.uniform1f(UB.head, head);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cur ^= 1;
    // estadísticas + monitor para la consola
    fpsN++;
    if (now - fpsT > 1000) { ch.postMessage({ type: 'stats', fps: Math.round(fpsN * 1000 / (now - fpsT)), w: cv.width, h: cv.height, q: frameQ(MIX.onAir), auto: isAuto() }); fpsN = 0; fpsT = now; }
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
