/* VØID_LOOM · OJO — motor de visión.
   Todo pasa en la GPU (WebGL2), sobre la imagen de la cámara:
     análisis   luminancia → bordes (Sobel) + esquinas (Harris) + movimiento → flujo óptico (Lucas-Kanade)
                → saliencia (centro-periferia + bordes + movimiento) → puntos clave por celda
     modos      PROFUNDIDAD · BORDES · FLUJO · CÓDIGO · ATENCIÓN · NEURONAS · MEMORIA
     post       estela, capa de análisis (2D), transición, firma, bloom, aberración, grano, viñeta
   La consola y la salida usan este mismo motor; cada una con su propia resolución. */
(function (root) {
  'use strict';
  const OJO = root.OJO || (root.OJO = {});

  OJO.ACCENTS = {
    rojo: '#FF1A1A', cian: '#00E5FF', ambar: '#FFB000', verde: '#39FF6A',
    violeta: '#8A2BFF', magenta: '#FF2BD6', blanco: '#F2F0EA',
  };

  // p: parámetros del modo, siempre 0..1. trail: estela por defecto del modo.
  OJO.MODES = [
    { id: 'profundidad', name: 'PROFUNDIDAD', accent: 'cian', trail: 0.55,
      idea: 'Te reconstruye como nube de puntos y te barre con un sonar.',
      params: [['orbita', 'ÓRBITA', 0.4], ['relieve', 'RELIEVE', 0.55], ['densidad', 'DENSIDAD', 0.65], ['sonar', 'SONAR', 0.5]] },
    { id: 'bordes', name: 'BORDES', accent: 'blanco', trail: 0.35,
      idea: 'Solo contornos, y los puntos que usa para seguirte.',
      params: [['umbral', 'UMBRAL', 0.3], ['puntos', 'PUNTOS CLAVE', 0.4], ['fondo', 'FONDO', 0.12], ['grosor', 'GROSOR', 0.4]] },
    { id: 'flujo', name: 'FLUJO', accent: 'violeta', trail: 0.82,
      idea: 'Lo quieto desaparece. Lo que se mueve deja corrientes.',
      params: [['arrastre', 'ARRASTRE', 0.55], ['cantidad', 'PARTÍCULAS', 0.7], ['fantasma', 'FANTASMA', 0.25], ['turbulencia', 'TURBULENCIA', 0.3]] },
    { id: 'codigo', name: 'CÓDIGO', accent: 'verde', trail: 0.2,
      idea: 'Te escribe con su propio código fuente, y lo reescribe donde te mueves.',
      params: [['celda', 'TAMAÑO', 0.35], ['contraste', 'CONTRASTE', 0.55], ['reescritura', 'REESCRITURA', 0.6], ['lectura', 'VELOCIDAD', 0.35]] },
    { id: 'atencion', name: 'ATENCIÓN', accent: 'ambar', trail: 0.3,
      idea: 'Un mapa de lo que le interesa, con isolíneas.',
      params: [['niveles', 'ISOLÍNEAS', 0.3], ['foco', 'FOCO', 0.55], ['fondo', 'FONDO', 0.6], ['calor', 'CALOR', 0.35]] },
    { id: 'neuronas', name: 'NEURONAS', accent: 'rojo', trail: 0.15,
      idea: 'Cada casilla es un filtro de la red viéndote a su manera.',
      params: [['capas', 'CASILLAS', 0.35], ['ganancia', 'GANANCIA', 0.55], ['zoom', 'ZOOM', 0], ['frecuencia', 'FRECUENCIA', 0.45]] },
    { id: 'memoria', name: 'MEMORIA', accent: 'magenta', trail: 0.1,
      idea: 'Cada zona de la imagen vive en un instante distinto.',
      params: [['profundidad', 'RETARDO', 0.7], ['forma', 'FORMA', 0.67], ['color', 'COLOR', 0.5], ['contraste', 'CONTRASTE', 0.5]] },
    { id: 'malla', name: 'MALLA', accent: 'cian', trail: 0.0,
      idea: 'Tu cara en polígonos iluminados; todo lo que acercas, tejido en malla.',
      params: [['fondo', 'FONDO', 0.12], ['luz', 'LUZ', 0.4], ['relleno', 'RELLENO', 0.8], ['alambre', 'ALAMBRE', 0.35], ['entorno', 'ENTORNO', 0.6]] },
    { id: 'objetos', name: 'OBJETOS', accent: 'ambar', trail: 0.0,
      idea: 'Nombra lo que ve a tu alrededor, con su grado de certeza.',
      params: [['fondo', 'FONDO', 0.4], ['certeza', 'CERTEZA MÍN.', 0.25], ['personas', 'PERSONAS', 1], ['contorno', 'CONTORNO', 0.4]] },
    { id: 'entrada', name: 'ENTRADA', accent: 'blanco', trail: 0.0,
      idea: 'La imagen como la recibe la red: bloques de píxeles y sus valores.',
      params: [['celda', 'TAMAÑO', 0.4], ['niveles', 'NIVELES', 0.35], ['numeros', 'VALORES', 0.7], ['foco', 'FOCO EN TI', 0.8]] },
  ];
  OJO.overlayOn = (S) => S.tracking !== false && (S.analysis > 0 || S.mode === 'malla' || S.mode === 'objetos');
  OJO.modeIndex = (id) => Math.max(0, OJO.MODES.findIndex((m) => m.id === id));

  OJO.defaultState = function () {
    const S = {
      mode: 'profundidad',
      p: {}, acc: {},
      analysis: 2,          // 0 nada · 1 geometría · 2 geometría + datos
      tracking: true,       // SEGUIMIENTO: IA de cara, cuerpo y manos
      hands: true,
      trail: null,          // null = la del modo
      bloom: 0.3, grain: 0.22, ca: 0.25,
      mirror: true, freeze: false, black: false,
      contactSens: 0.5,
      firma: 0,             // instante (reloj compartido, ms) en que arrancó la firma; 0 = no
      device: '', res: 720,
    };
    OJO.MODES.forEach((m) => { S.p[m.id] = m.params.map((x) => x[2]); S.acc[m.id] = m.accent; });
    return S;
  };

  const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  OJO.hex3 = hex3;

  // ================================================================== GLSL
  const VS = `#version 300 es
out vec2 vUV;
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vUV = p; gl_Position = vec4(p*2.-1., 0., 1.); }`;

  const HEAD = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUV; out vec4 o;
uniform sampler2D uCam, uLuma, uLumaP, uFeat, uFlow, uSal, uKey, uPrev;
uniform vec2 uRes, uAna, uKeyRes, uCamTx;
uniform vec4 uCover;      // xy escala, zw desplazamiento: uv de pantalla → uv de imagen
uniform float uT, uMirror, uContact, uSalMax, uEnergy;
uniform vec3 uAcc;
uniform vec4 uP;          // parámetros del modo
uniform vec4 uFace;       // cara principal en uv de pantalla (centro xy, tamaño zw); z = 0 si no hay
#define PI 3.14159265
vec2 C(vec2 uv){ return uv*uCover.xy + uCover.zw; }
vec3 cam(vec2 cuv){ return texture(uCam, vec2(uMirror > .5 ? 1.-cuv.x : cuv.x, 1.-cuv.y)).rgb; }
float h1(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x+p.y)*p.x); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
float faceMask(vec2 uv){ if (uFace.z <= 0.) return 0.; vec2 d = (uv - uFace.xy) * vec2(uRes.x/uRes.y, 1.); return smoothstep(uFace.z*.75, uFace.z*.35, length(d)); }
`;

  // ---------------------------------------------------------------- análisis
  const FS_LUMA = HEAD + `
float L(vec2 uv){ return dot(cam(uv), vec3(.299,.587,.114)); }
void main(){
  float l = L(vUV);
  vec2 d = uCamTx * 2.0;
  float b = l*.25;
  b += (L(vUV+vec2(d.x,0.)) + L(vUV-vec2(d.x,0.)) + L(vUV+vec2(0.,d.y)) + L(vUV-vec2(0.,d.y)))*.125;
  b += (L(vUV+d) + L(vUV-d) + L(vUV+vec2(d.x,-d.y)) + L(vUV+vec2(-d.x,d.y)))*.0625;
  o = vec4(l, b, 0., 1.);
}`;

  const FS_FEAT = HEAD + `
float B(vec2 uv){ return texture(uLuma, uv).g; }
void main(){
  vec2 tx = 1./uAna;
  float tl=B(vUV+tx*vec2(-1,1)), t=B(vUV+tx*vec2(0,1)), tr=B(vUV+tx*vec2(1,1));
  float l=B(vUV+tx*vec2(-1,0)), r=B(vUV+tx*vec2(1,0));
  float bl=B(vUV+tx*vec2(-1,-1)), b=B(vUV+tx*vec2(0,-1)), br=B(vUV+tx*vec2(1,-1));
  float gx = (tr + 2.*r + br) - (tl + 2.*l + bl);
  float gy = (tl + 2.*t + tr) - (bl + 2.*b + br);
  float mag = length(vec2(gx, gy)) * 1.6;
  float ori = atan(gy, gx);
  // Harris: tensor de estructura en 3×3
  float sxx = 0., syy = 0., sxy = 0.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 p = vUV + tx*vec2(i, j);
    float ix = B(p + vec2(tx.x,0.)) - B(p - vec2(tx.x,0.));
    float iy = B(p + vec2(0.,tx.y)) - B(p - vec2(0.,tx.y));
    sxx += ix*ix; syy += iy*iy; sxy += ix*iy;
  }
  float R = (sxx*syy - sxy*sxy) - .05*(sxx+syy)*(sxx+syy);
  float mot = abs(texture(uLuma, vUV).g - texture(uLumaP, vUV).g);
  o = vec4(mag, ori, max(R, 0.) * 900., smoothstep(.02, .18, mot));
}`;

  // Lucas-Kanade en ventana 5×5 con paso 2 (resultado en píxeles de análisis por frame)
  const FS_FLOW = HEAD + `
void main(){
  vec2 tx = 1./uAna;
  float a11 = 0., a12 = 0., a22 = 0., b1 = 0., b2 = 0.;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 p = vUV + tx*vec2(i, j)*2.;
    float ix = (texture(uLuma, p + vec2(tx.x*2.,0.)).g - texture(uLuma, p - vec2(tx.x*2.,0.)).g) * .25;
    float iy = (texture(uLuma, p + vec2(0.,tx.y*2.)).g - texture(uLuma, p - vec2(0.,tx.y*2.)).g) * .25;
    float it = texture(uLuma, p).g - texture(uLumaP, p).g;
    a11 += ix*ix; a12 += ix*iy; a22 += iy*iy; b1 += ix*it; b2 += iy*it;
  }
  float det = a11*a22 - a12*a12;
  vec2 v = vec2(0.);
  if (det > 1e-6 && (a11 + a22) > 2e-4) v = -vec2(a22*b1 - a12*b2, a11*b2 - a12*b1) / det;
  float m = length(v); if (m > 8.) v *= 8./m;
  float mot = texture(uFeat, vUV).a;
  v *= smoothstep(.0, .25, mot + .05);
  vec2 pv = texture(uPrev, vUV).xy;
  o = vec4(mix(pv, v, .55), 0., 1.);
}`;

  // saliencia a 1/4: contraste centro-periferia + color + bordes + movimiento, suavizada en el tiempo
  const FS_SAL = HEAD + `
void main(){
  vec2 tx = 1./uAna;
  float c = texture(uLuma, vUV).g;
  vec3 cc = cam(vUV);
  float s = 0.; vec3 sc = vec3(0.);
  for (int k = 0; k < 12; k++) {
    float a = float(k) * PI / 6.;
    vec2 p = vUV + vec2(cos(a), sin(a)) * tx * 14.;
    s += texture(uLuma, p).g; sc += cam(p);
  }
  s /= 12.; sc /= 12.;
  float e = 0., m = 0.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec4 f = texture(uFeat, vUV + tx*vec2(i,j)*2.); e += f.r; m += f.a; }
  e /= 9.; m /= 9.;
  float sal = abs(c - s)*2.2 + length(cc - sc)*1.1 + e*.45 + m*1.6;
  float prev = texture(uPrev, vUV).r;
  o = vec4(mix(prev, sal, .08), 0., 0., 1.);
}`;

  // un punto clave por celda de 8×8 píxeles de análisis: respuesta máxima y su posición en la celda
  const FS_KEY = HEAD + `
void main(){
  vec2 cell = floor(vUV * uKeyRes);
  float best = 0.; vec2 bp = vec2(.5);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    vec2 px = cell*8. + vec2(i, j) + .5;
    float r = texture(uFeat, px / uAna).b;
    if (r > best) { best = r; bp = (vec2(i, j) + .5) / 8.; }
  }
  o = vec4(best, bp, 1.);
}`;

  // ---------------------------------------------------------------- modos
  // PROFUNDIDAD: nube de puntos (vértices sin atributos: el id da la posición en la rejilla)
  const VS_POINTS = `#version 300 es
precision highp float;
uniform sampler2D uLuma, uFeat;
uniform vec4 uCover, uP, uFace;
uniform vec2 uRes, uGrid;
uniform float uT, uPx, uContact;
uniform vec3 uAcc;
out vec3 vCol;
float h1(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x+p.y)*p.x); }
void main(){
  float gw = uGrid.x;
  float id = float(gl_VertexID);
  vec2 g = vec2(mod(id, gw), floor(id / gw));
  vec2 uv = (g + .5 + (vec2(h1(g), h1(g + 17.)) - .5) * .7) / uGrid;
  vec2 cuv = uv * uCover.xy + uCover.zw;
  vec4 L = texture(uLuma, cuv), F = texture(uFeat, cuv);
  float asp = uRes.x / uRes.y;
  float rel = .25 + uP.y * 1.5;
  vec3 p = vec3((uv.x - .5) * 2. * asp, (uv.y - .5) * 2., (L.g - .45) * rel + F.a * .25 * rel);
  // cara: relieve propio (la máquina te modela con más detalle)
  float fm = 0.;
  if (uFace.z > 0.) { vec2 d = (uv - uFace.xy) * vec2(asp, 1.); fm = smoothstep(uFace.z * .8, uFace.z * .2, length(d)); p.z += fm * .22 * rel * (1. - dot(d, d) / (uFace.z * uFace.z + 1e-4) * .5); }
  float a = (sin(uT * .19) * .55 + sin(uT * .071 + 1.3) * .3) * uP.x;
  float b = (sin(uT * .13 + .4) * .22) * uP.x;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  p.yz = mat2(cos(b), -sin(b), sin(b), cos(b)) * p.yz;
  float dist = 3.2, z = dist - p.z;
  vec2 ndc = p.xy * (dist / z) * .9 / vec2(asp, 1.);
  gl_Position = vec4(ndc, clamp(p.z * .1, -.9, .9), 1.);
  // sonar: un frente que recorre la profundidad
  float sp = .12 + uP.w * .5;
  float ph = fract(uT * sp);
  float zs = mix(-1.2, 1.2, ph) * rel * .7;
  float ring = exp(-pow((p.z - zs) / (.018 + .03 * uP.w), 2.)) * smoothstep(0., .1, ph) * smoothstep(1., .85, ph);
  float base = .025 + F.r * .75 + L.r * .1;
  vCol = vec3(.93, .92, .9) * base * .45 + uAcc * ring * (.35 + F.r * 1.6 + L.r * .4) + uAcc * fm * (.12 + .25 * F.r) + uAcc * uContact * fm * .45;
  vCol *= 1. - uContact * (1. - fm) * .75;
  gl_PointSize = uPx * (dist / z) * (1. + ring * 1.4);
}`;
  const FS_POINTS = `#version 300 es
precision highp float;
in vec3 vCol; out vec4 o;
void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, .15, r); o = vec4(vCol * a, 1.); }`;

  const FS_BORDES = HEAD + `
float Lc(vec2 c){ return dot(cam(c), vec3(.299, .587, .114)); }
vec3 sob(vec2 c, vec2 d){
  float tl = Lc(c + d*vec2(-1,1)), t = Lc(c + d*vec2(0,1)), tr = Lc(c + d*vec2(1,1));
  float l = Lc(c + d*vec2(-1,0)), r = Lc(c + d*vec2(1,0));
  float bl = Lc(c + d*vec2(-1,-1)), b = Lc(c + d*vec2(0,-1)), br = Lc(c + d*vec2(1,-1));
  vec2 g = vec2((tr + 2.*r + br) - (tl + 2.*l + bl), (tl + 2.*t + tr) - (bl + 2.*b + br));
  return vec3(length(g), g / max(length(g), 1e-5));
}
void main(){
  vec2 cuv = C(vUV);
  // bordes a resolución de pantalla, sobre la imagen de la cámara (trazo fino)
  vec2 d = uCover.xy / uRes * (1. + uP.w * 1.6);
  vec3 s0 = sob(cuv, d);
  float m1 = sob(cuv + s0.yz * d, d).x, m2 = sob(cuv - s0.yz * d, d).x;
  float thin = (s0.x >= m1 && s0.x >= m2) ? 1. : uP.w * .25;
  float thr = .08 + uP.x * .45;
  float e = smoothstep(thr, thr + .35, s0.x) * thin;
  vec4 F = texture(uFeat, cuv);
  vec3 col = vec3(.94, .93, .9) * e * .5;
  col = mix(col, uAcc * .9 * e, smoothstep(.1, .6, F.a));
  col += uAcc * e * faceMask(vUV) * .35;
  col += cam(cuv) * uP.z * uP.z * .3;
  // puntos clave: cruz fina en el máximo de cada celda
  vec2 kc = cuv * uKeyRes;
  float kp = 0.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cell = floor(kc) + vec2(i, j);
    vec4 K = texture(uKey, (cell + .5) / uKeyRes);
    float on = step(.7 - uP.y * .6, K.r) * step(.001, uP.y);
    vec2 kpix = (cell + K.gb) / uKeyRes;
    vec2 dd = (cuv - kpix) / uCover.xy * uRes;
    float s = 5. + 3. * uRes.y / 1080.;
    float cross = (step(abs(dd.x), .6) + step(abs(dd.y), .6)) * step(max(abs(dd.x), abs(dd.y)), s) * step(1.5, max(abs(dd.x), abs(dd.y)));
    kp = max(kp, cross * on);
  }
  col += uAcc * kp * .7;
  col *= 1. - uContact * (1. - faceMask(vUV)) * .7;
  o = vec4(col, 1.);
}`;

  // FLUJO · partículas: estado (x, y, edad, vida) en textura flotante
  const FS_PSTEP = HEAD + `
uniform sampler2D uState;
uniform float uDt, uSeed;
vec2 rnd2(vec2 s){ return vec2(h1(s + uSeed), h1(s * 1.7 + uSeed * 3.1)); }
void main(){
  vec4 s = texture(uState, vUV);
  vec2 p = s.xy; float age = s.z, life = s.w;
  vec2 cuv = C(p);
  vec2 fl = texture(uFlow, cuv).xy;                       // píxeles de análisis / frame
  vec2 v = fl / uAna / uCover.xy;                          // uv de pantalla / frame
  float a = vnoise(p * 6. + uT * .2) * 6.283;
  v += vec2(cos(a), sin(a)) * .0006 * uP.w * (.3 + length(fl));
  p += v * (1.2 + uP.x * 2.5);
  age += uDt;
  bool dead = age > life || p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1.;
  if (dead) {
    // renace donde hay movimiento (4 intentos)
    vec2 best = rnd2(vUV * 91.7 + uT); float bm = -1.;
    for (int k = 0; k < 4; k++) {
      vec2 q = rnd2(vUV * (13.1 + float(k) * 7.3) + uT * 1.3);
      float m = texture(uFeat, C(q)).a + h1(q + uT) * .05;
      if (m > bm) { bm = m; best = q; }
    }
    p = best; age = 0.; life = .6 + h1(vUV + uT * .7) * 2.2;
  }
  o = vec4(p, age, life);
}`;
  const VS_PART = `#version 300 es
precision highp float;
uniform sampler2D uState, uFlow, uFeat;
uniform vec4 uCover; uniform vec2 uRes, uAna, uPGrid; uniform vec3 uAcc; uniform float uPx, uCount, uContact; uniform vec4 uFace;
out vec3 vCol;
void main(){
  float id = float(gl_VertexID);
  if (id >= uCount) { gl_Position = vec4(2., 2., 0., 1.); gl_PointSize = 0.; return; }
  vec2 st = (vec2(mod(id, uPGrid.x), floor(id / uPGrid.x)) + .5) / uPGrid;
  vec4 s = texture(uState, st);
  vec2 cuv = s.xy * uCover.xy + uCover.zw;
  vec2 fl = texture(uFlow, cuv).xy;
  float sp = length(fl);
  float fade = smoothstep(0., .15, s.z) * smoothstep(s.w, s.w * .6, s.z);
  float mot = texture(uFeat, cuv).a;
  vec3 c = mix(vec3(.9, .9, .88) * .35, uAcc * 1.5, smoothstep(.3, 2.5, sp));
  float fm = 0.; if (uFace.z > 0.) fm = smoothstep(uFace.z * .8, uFace.z * .3, length((s.xy - uFace.xy) * vec2(uRes.x / uRes.y, 1.)));
  vCol = c * fade * (.16 + mot * .7 + min(sp, 4.) * .1) * (1. + fm * uContact * 2.);
  gl_Position = vec4(s.xy * 2. - 1., 0., 1.);
  gl_PointSize = uPx * (1. + smoothstep(.5, 4., sp));
}`;
  const FS_FLUJO_BG = HEAD + `
void main(){
  vec2 cuv = C(vUV);
  vec4 F = texture(uFeat, cuv);
  float g = smoothstep(.12, .5, F.r) * uP.z * .22;
  vec3 col = vec3(.9) * g * (1. - uContact * (1. - faceMask(vUV)) * .8);
  o = vec4(col, 1.);
}`;

  // CÓDIGO: rejilla de caracteres; uChars = código fuente (rejilla), uAtlas = glifos ASCII 32–127 (16×6)
  const FS_CODIGO = HEAD + `
uniform sampler2D uChars, uAtlas;
uniform vec2 uGridC; uniform float uCell;
void main(){
  vec2 px = vUV * uRes;
  vec2 cs = vec2(uCell, uCell * 1.6);
  vec2 cell = floor(px / cs);
  vec2 lc = fract(px / cs);
  vec2 cuv = C((cell + .5) * cs / uRes);
  vec4 L = texture(uLuma, cuv), F = texture(uFeat, cuv);
  float ch = floor(texture(uChars, (cell + .5) / uGridC).r * 255. + .5);
  // reescritura: donde te mueves el código cambia a hexadecimal cada pocos frames
  float rw = F.a * (.05 + uP.z * .6);
  float tick = floor(uT * (8. + 22. * uP.z));
  if (h1(cell + tick) < rw) { ch = 48. + floor(h1(cell * 1.3 + tick) * 16.); if (ch > 57.) ch += 7.; }
  float g = clamp(ch - 32., 0., 95.);
  vec2 gi = vec2(mod(g, 16.), floor(g / 16.));
  vec2 auv = (gi + vec2(lc.x, 1. - lc.y)) / vec2(16., 6.);
  float glyph = texture(uAtlas, auv).a;
  float k = .25 + uP.y * 1.2;
  float v = smoothstep(.12 * k, .65 / k + .1, L.g);
  v = pow(v, 1.2);
  float fm = faceMask(vUV);
  vec3 ink = vec3(.93, .92, .88);
  vec3 col = ink * glyph * (.045 + v * .95);
  col = mix(col, uAcc * glyph * (.25 + v * 1.4), clamp(smoothstep(.15, .6, F.r) * .7 + F.a * .8 + fm * .6, 0., 1.));
  col *= 1. - uContact * (1. - fm) * .75;
  col += uAcc * glyph * uContact * fm * .35;
  o = vec4(col, 1.);
}`;

  const FS_ATENCION = HEAD + `
void main(){
  vec2 cuv = C(vUV);
  float s = texture(uSal, cuv).r / max(uSalMax, 1e-3);
  s = clamp(s, 0., 1.);
  float sf = pow(s, 1.0 + uP.y * 2.);
  float lum = dot(cam(cuv), vec3(.299, .587, .114));
  vec3 col = vec3(lum) * (uP.z * .6) * (.2 + .8 * sf);
  // isolíneas
  float lv = 3. + floor(uP.x * 10.);
  float f = s * lv;
  float d = abs(fract(f + .5) - .5) / max(fwidth(f), 1e-4);
  float line = (1. - clamp(d, 0., 1.)) * smoothstep(.3, .55, s);
  col += mix(vec3(.9) * .08, uAcc * .95, smoothstep(.45, .95, s)) * line;
  col += uAcc * pow(s, 3.) * uP.w * .45;
  col += uAcc * faceMask(vUV) * .04 * (1. + uContact);
  float fm = faceMask(vUV);
  col *= 1. - uContact * (1. - fm) * .7;
  o = vec4(col, 1.);
}`;

  const FS_NEURONAS = HEAD + `
uniform float uN, uFocus;
float lumA(vec2 p){ return texture(uLuma, p).g; }
float gabor(vec2 cuv, float th, float fr){
  vec2 tx = 1./uAna; vec2 dr = vec2(cos(th), sin(th)); float s = 0.;
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec2 q = vec2(i, j); float x = dot(q, dr), y = dot(q, vec2(-dr.y, dr.x));
    s += exp(-(x*x + y*y) / 8.) * cos(6.2831 * x * fr) * lumA(cuv + q * tx * 1.6);
  }
  return abs(s) * .35;
}
float dog(vec2 cuv, float r){ vec2 tx = 1./uAna; float c = lumA(cuv), s = 0.;
  for (int k = 0; k < 8; k++){ float a = float(k) * PI / 4.; s += lumA(cuv + vec2(cos(a), sin(a)) * tx * r); } return c - s / 8.; }
float act(int k, vec2 cuv){
  float fr = .12 + uP.w * .3;
  k = k % 16;
  if (k == 0) return gabor(cuv, 0., fr);
  if (k == 1) return gabor(cuv, PI*.25, fr);
  if (k == 2) return gabor(cuv, PI*.5, fr);
  if (k == 3) return gabor(cuv, PI*.75, fr);
  if (k == 4) return max(dog(cuv, 4.), 0.) * 5.;
  if (k == 5) return max(-dog(cuv, 4.), 0.) * 5.;
  if (k == 6) return texture(uFeat, cuv).a;
  if (k == 7) { vec3 c = cam(cuv); return abs(c.r - c.g) * 2.; }
  if (k == 8) { vec3 c = cam(cuv); return abs(c.b - (c.r + c.g) * .5) * 2.; }
  if (k == 9) return abs(dog(cuv, 1.5)) * 8.;
  if (k == 10) return texture(uFeat, cuv).b * 4.;
  if (k == 11) { vec2 b = (floor(cuv * uAna / 10.) + .5) * 10. / uAna; float m = 0.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) m = max(m, texture(uFeat, b + vec2(i, j) * 3. / uAna).r); return m; }
  if (k == 12) return length(texture(uFlow, cuv).xy) * .4;
  if (k == 13) return texture(uSal, cuv).r / max(uSalMax, 1e-3);
  if (k == 14) return gabor(cuv, PI*.125, fr * 1.8);
  return gabor(cuv, PI*.625, fr * .6);
}
void main(){
  float N = uN;
  // zoom: la cámara entra en la casilla de foco
  vec2 fc = vec2(mod(uFocus, N), floor(uFocus / N));
  vec2 uvz = mix(vUV, (fc + vUV) / N, uP.z);
  vec2 cellf = uvz * N;
  vec2 cell = floor(cellf);
  vec2 lc = fract(cellf);
  int k = int(cell.y * N + cell.x);
  vec2 cuv = C(lc);
  float a = act(k, cuv) * (.3 + uP.y * 1.4);
  a = 1.6 * (1. - exp(-a * 1.1));   // compresión: ninguna casilla se quema
  float pulse = (float(k) == uFocus) ? 1. : 0.;
  vec3 col = uAcc * smoothstep(.02, .8, a) * .85 + vec3(1., .97, .94) * smoothstep(.85, 1.8, a) * .8;
  col *= .55 + .45 * pulse + uEnergy * .3;
  // en el CONTACTO solo queda encendida la casilla de foco
  col *= 1. - uContact * .6 * (1. - pulse);
  // separación entre casillas
  vec2 e = min(lc, 1. - lc) * uRes / N * (1. - uP.z * .7);
  float gap = smoothstep(.5, 1.5, min(e.x, e.y));
  col *= gap;
  o = vec4(col, 1.);
}`;

  // MALLA y OBJETOS: fondo casi negro; la malla y las detecciones las dibuja la capa de análisis
  const FS_FONDO = HEAD + `
float Lc(vec2 c){ return dot(cam(c), vec3(.299, .587, .114)); }
void main(){
  vec2 cuv = C(vUV);
  float l = texture(uLuma, cuv).g;
  vec4 F = texture(uFeat, cuv);
  float bg = uP.x;
  vec3 col = vec3(pow(l, 1.3)) * bg * .55;
  // contorno técnico tenue para situar la escena
  col += vec3(.9) * smoothstep(.3, .7, F.r) * uP.w * .06;
  col *= 1. - uContact * (1. - faceMask(vUV)) * .6;
  o = vec4(col, 1.);
}`;

  // ENTRADA: el tensor. Bloques cuantizados con su valor (0–255) escrito dentro; más resolución donde estás
  const FS_ENTRADA = HEAD + `
uniform sampler2D uAtlas;
float glyph(float ch, vec2 lc){
  float g = clamp(ch - 32., 0., 95.);
  vec2 gi = vec2(mod(g, 16.), floor(g / 16.));
  return texture(uAtlas, (gi + vec2(lc.x, 1. - lc.y)) / vec2(16., 6.)).a;
}
void main(){
  vec2 px = vUV * uRes;
  float cs = floor((14. + uP.x * 70.) * uRes.y / 1080.);
  float fm = faceMask(vUV) * step(.01, uP.w);
  if (fm > .5) cs = max(6., floor(cs / (1. + floor(uP.w * 2.5))));
  vec2 cell = floor(px / cs), lc = fract(px / cs);
  vec2 cuv = C((cell + .5) * cs / uRes);
  vec2 d = uCover.xy * cs / uRes * .25;
  float l = (dot(cam(cuv + d), vec3(.299,.587,.114)) + dot(cam(cuv - d), vec3(.299,.587,.114))
           + dot(cam(cuv + vec2(d.x, -d.y)), vec3(.299,.587,.114)) + dot(cam(cuv + vec2(-d.x, d.y)), vec3(.299,.587,.114))) * .25;
  float N = 2. + floor(uP.y * 14.);
  float q = floor(l * N + .5) / N;
  float mot = texture(uFeat, cuv).a;
  float gap = step(1. / cs, lc.x) * step(1. / cs, lc.y);
  vec3 col = vec3(q) * .82 * gap;
  // valor numérico centrado (3 dígitos)
  float v = floor(q * 255. + .5);
  vec2 tl = (lc - vec2(.5 - .27, .5 - .14)) / vec2(.54, .28);
  if (cs >= 22. && uP.z > .01 && tl.x > 0. && tl.x < 1. && tl.y > 0. && tl.y < 1.) {
    float k = floor(tl.x * 3.);
    float dgt = k < .5 ? floor(v / 100.) : k < 1.5 ? mod(floor(v / 10.), 10.) : mod(v, 10.);
    float gv = glyph(48. + dgt, vec2(fract(tl.x * 3.), tl.y));
    vec3 ink = q > .5 ? vec3(0.) : vec3(.9);
    col = mix(col, ink, gv * uP.z * .9);
  }
  // los bloques que cambian se marcan en el acento
  col = mix(col, uAcc * (.35 + q), smoothstep(.15, .6, mot) * .55 * gap);
  col += uAcc * fm * .06 * gap;
  col *= 1. - uContact * (1. - faceMask(vUV)) * .6;
  o = vec4(col, 1.);
}`;

  // MEMORIA: anillo de frames en una textura array
  const FS_HIST_W = HEAD + `
void main(){ o = vec4(cam(vUV), 1.); }`;
  const FS_MEMORIA = HEAD + `
uniform sampler2DArray uHist; uniform float uHead, uLayers;
void main(){
  vec2 cuv = C(vUV);
  float asp = uRes.x / uRes.y;
  vec4 L = texture(uLuma, cuv), F = texture(uFeat, cuv);
  vec2 ctr = uFace.z > 0. ? uFace.xy : vec2(.5);
  float d1 = 1. - smoothstep(.05, .8, L.g);                    // la sombra es pasado
  float d2 = 1. - vUV.y;                                         // barrido vertical
  float d3 = clamp(length((vUV - ctr) * vec2(asp, 1.)) * 1.3, 0., 1.);   // desde ti hacia fuera
  float d4 = 1. - smoothstep(.0, .25, F.a);                     // lo que se mueve llega tarde
  float f = uP.y * 3.;
  float d = f < 1. ? mix(d1, d2, f) : f < 2. ? mix(d2, d3, f - 1.) : mix(d3, d4, f - 2.);
  float delay = d * uP.x * (uLayers - 1.);
  float l0 = floor(delay), fr = delay - l0;
  float a = mod(uHead - l0 + uLayers * 2., uLayers), b = mod(uHead - l0 - 1. + uLayers * 2., uLayers);
  vec3 c = mix(texture(uHist, vec3(cuv, a)).rgb, texture(uHist, vec3(cuv, b)).rgb, fr);
  float lum = dot(c, vec3(.299, .587, .114));
  float k = .8 + uP.w * 1.2;
  lum = pow(clamp(lum, 0., 1.), k);
  vec3 col = mix(vec3(lum) * vec3(.95, .93, .9), c, uP.z * .25) * .62;
  col = mix(col, uAcc * lum * 1.6, smoothstep(.35, 1., d) * uP.z);
  col *= 1. - uContact * (1. - faceMask(vUV)) * .6;
  o = vec4(col, 1.);
}`;

  // ---------------------------------------------------------------- composición y post
  const FS_TRAIL = HEAD + `
uniform sampler2D uMode; uniform float uTrail;
void main(){
  vec3 m = texture(uMode, vUV).rgb;
  vec3 p = texture(uPrev, vUV).rgb * uTrail;
  o = vec4(max(m, p), 1.);
}`;
  const FS_COMP = HEAD + `
uniform sampler2D uTrailT, uOver, uTrans, uSting;
uniform float uTransK, uBlack, uStingK, uOverK, uSeedT;
void main(){
  vec2 uv = vUV;
  vec3 c = texture(uTrailT, uv).rgb;
  if (uTransK > 0.) {
    // corte glitch: franjas desplazadas del frame anterior que se apagan
    float band = floor(uv.y * 38.);
    float off = (h1(vec2(band, uSeedT)) - .5) * .08 * uTransK * step(.55, h1(vec2(band * 1.7, uSeedT)));
    vec3 pc = texture(uTrans, vec2(uv.x + off, uv.y)).rgb;
    c = mix(c, pc, uTransK);
  }
  vec4 ov = texture(uOver, uv);
  c += ov.rgb * ov.a * uOverK;
  c *= 1. - uStingK;
  vec4 st = texture(uSting, uv);
  c += st.rgb * st.a * 1.15;
  c *= 1. - uBlack;
  o = vec4(c, 1.);
}`;
  const FS_DOWN = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTx; uniform float uFirst;
void main(){
  vec3 c = texture(uSrc, vUV).rgb * 4.;
  c += texture(uSrc, vUV + uTx * vec2(-1, -1)).rgb + texture(uSrc, vUV + uTx * vec2(1, -1)).rgb
     + texture(uSrc, vUV + uTx * vec2(-1, 1)).rgb + texture(uSrc, vUV + uTx * vec2(1, 1)).rgb;
  c /= 8.;
  if (uFirst > .5) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(.45, 1.1, l); }
  o = vec4(c, 1.);
}`;
  const FS_UP = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTx;
void main(){
  vec3 c = vec3(0.);
  c += texture(uSrc, vUV + uTx * vec2(-2, 0)).rgb + texture(uSrc, vUV + uTx * vec2(2, 0)).rgb
     + texture(uSrc, vUV + uTx * vec2(0, -2)).rgb + texture(uSrc, vUV + uTx * vec2(0, 2)).rgb;
  c += (texture(uSrc, vUV + uTx * vec2(-1, 1)).rgb + texture(uSrc, vUV + uTx * vec2(1, 1)).rgb
     + texture(uSrc, vUV + uTx * vec2(-1, -1)).rgb + texture(uSrc, vUV + uTx * vec2(1, -1)).rgb) * 2.;
  o = vec4(c / 12., 1.);
}`;
  const FS_FINAL = HEAD + `
uniform sampler2D uComp, uBloom; uniform float uBloomK, uGrain, uCA, uFrame;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main(){
  vec2 uv = vUV;
  vec2 dc = uv - .5;
  vec2 ca = dc * (.0025 + uCA * .006) * (.4 + dot(dc, dc) * 2.);
  vec3 c = vec3(texture(uComp, uv + ca).r, texture(uComp, uv).g, texture(uComp, uv - ca).b);
  c += texture(uBloom, uv).rgb * uBloomK * .9;
  c = aces(c * 1.05);
  c *= 1. - smoothstep(.35, 1.15, length(dc * vec2(1., .85))) * .55;
  float l = dot(c, vec3(.299, .587, .114));
  float g = h1(gl_FragCoord.xy + fract(uFrame * .6180339) * 917.) - .5;
  c += g * uGrain * .055 * (1. - smoothstep(.15, .7, l) * .7);
  o = vec4(c, 1.);
}`;

  // ================================================================== motor
  OJO.engine = function (canvas, opt = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: !!opt.preserve, powerPreference: 'high-performance', desynchronized: !!opt.lowLatency });
    if (!gl) throw new Error('WebGL2 no disponible');
    const cbf = gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const HF = cbf ? gl.RGBA16F : gl.RGBA8, HT = cbf ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // ---------- programas
    const sources = {};
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(s); console.error(e, src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n')); throw new Error('shader: ' + e); }
      return s;
    }
    function prog(name, fs, vs = VS) {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link ' + name + ': ' + gl.getProgramInfoLog(p));
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      sources[name] = (vs === VS ? '' : vs + '\n') + fs;
      return { p, u, name };
    }
    const P = {
      luma: prog('luma', FS_LUMA), feat: prog('feat', FS_FEAT), flow: prog('flujo-optico', FS_FLOW),
      sal: prog('saliencia', FS_SAL), key: prog('puntos-clave', FS_KEY),
      points: prog('profundidad', FS_POINTS, VS_POINTS), bordes: prog('bordes', FS_BORDES),
      pstep: prog('particulas', FS_PSTEP), part: prog('flujo', FS_POINTS, VS_PART), fbg: prog('flujo-fondo', FS_FLUJO_BG),
      codigo: prog('codigo', FS_CODIGO), atencion: prog('atencion', FS_ATENCION), neuronas: prog('neuronas', FS_NEURONAS),
      histw: prog('memoria-escritura', FS_HIST_W), memoria: prog('memoria', FS_MEMORIA),
      fondo: prog('malla-objetos', FS_FONDO), entrada: prog('entrada', FS_ENTRADA),
      trail: prog('estela', FS_TRAIL), comp: prog('composicion', FS_COMP), down: prog('bloom-baja', FS_DOWN), up: prog('bloom-sube', FS_UP), final: prog('final', FS_FINAL),
    };

    // ---------- texturas y FBOs
    function tex(w, h, ifmt = HF, fmt = gl.RGBA, type = HT, filter = gl.LINEAR) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function fbo(w, h, ifmt, fmt, type, filter) {
      const t = tex(w, h, ifmt, fmt, type, filter); const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { t, f, w, h };
    }
    const free = (o) => { if (!o) return; gl.deleteTexture(o.t); gl.deleteFramebuffer(o.f); };

    const camTex = tex(2, 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const overTex = tex(2, 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const stingTex = tex(2, 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const black = tex(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.bindTexture(gl.TEXTURE_2D, black); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    let AW = 0, AH = 0, A = null;   // análisis
    let W = 0, H = 0, R = null;     // render
    let camW = 0, camH = 0;
    function allocAnalysis(cw, ch) {
      const aw = 320, ah = Math.max(90, Math.round(320 * ch / cw / 8) * 8);
      if (aw === AW && ah === AH) return;
      if (A) Object.values(A).forEach((x) => Array.isArray(x) ? x.forEach(free) : free(x));
      AW = aw; AH = ah;
      A = {
        luma: [fbo(AW, AH), fbo(AW, AH)], feat: fbo(AW, AH), flow: [fbo(AW, AH), fbo(AW, AH)],
        sal: [fbo(AW / 4, AH / 4), fbo(AW / 4, AH / 4)], key: fbo(AW / 8, AH / 8, HF, gl.RGBA, HT, gl.NEAREST),
      };
      salBuf = new Float32Array((AW / 4) * (AH / 4) * 4);
      hist && freeHist();
    }
    function allocRender(w, h) {
      if (w === W && h === H) return;
      if (R) { ['mode', 'comp', 'trans'].forEach((k) => free(R[k])); R.trail.forEach(free); R.bl.forEach(free); }
      W = w; H = h;
      R = { mode: fbo(W, H), comp: fbo(W, H), trans: fbo(W, H), trail: [fbo(W, H), fbo(W, H)], bl: [] };
      let bw = W >> 1, bh = H >> 1;
      for (let i = 0; i < 5 && bw > 8 && bh > 8; i++) { R.bl.push(fbo(bw, bh)); bw >>= 1; bh >>= 1; }
      over.width = W; over.height = H;
      codeGrid = null;
    }

    // ---------- capa 2D de análisis (la dibuja vision.js)
    const over = document.createElement('canvas');
    const overCtx = over.getContext('2d');
    let overDirty = false;

    // ---------- partículas
    const PW = 256, PH = 256;
    let part = null;
    function allocPart() {
      if (part || !cbf) return;
      const init = new Float32Array(PW * PH * 4);
      for (let i = 0; i < PW * PH; i++) { init[i * 4] = Math.random(); init[i * 4 + 1] = Math.random(); init[i * 4 + 2] = Math.random() * 2; init[i * 4 + 3] = 0.6 + Math.random() * 2; }
      const mk = () => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, PW, PH, 0, gl.RGBA, gl.FLOAT, init);
        [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST));
        const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return { t, f, w: PW, h: PH };
      };
      part = [mk(), mk()];
    }

    // ---------- memoria
    const HL = 64; let hist = null, histHead = 0, HW = 0, HH = 0;
    function allocHist() {
      if (hist) return;
      HW = 480; HH = Math.round(480 * AH / AW);
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, HW, HH, HL);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D_ARRAY, k, gl.LINEAR));
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      hist = { t, f: gl.createFramebuffer() };
    }
    function freeHist() { if (!hist) return; gl.deleteTexture(hist.t); gl.deleteFramebuffer(hist.f); hist = null; }

    // ---------- código: atlas de glifos + rejilla de texto
    const atlasTex = tex(2, 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    let atlasReady = false;
    function buildAtlas() {
      const cw = 40, ch = 64, c = document.createElement('canvas'); c.width = cw * 16; c.height = ch * 6;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = "400 50px 'JetBrains Mono', ui-monospace, monospace";
      for (let i = 0; i < 96; i++) { const s = String.fromCharCode(32 + i); x.fillText(s, (i % 16) * cw + cw / 2, Math.floor(i / 16) * ch + ch / 2 + 2); }
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      atlasReady = true;
    }
    (document.fonts && document.fonts.load ? document.fonts.load("400 50px 'JetBrains Mono'").catch(() => {}) : Promise.resolve()).then(buildAtlas);

    let codeLines = [];
    const charTex = tex(2, 2, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.NEAREST);
    let codeGrid = null, codeScroll = 0, codeStep = -1;
    function setSource(text) {
      codeLines = text.replace(/\t/g, '  ').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l, i, a) => l || (a[i - 1] || '').trim());
    }
    setSource(Object.values(sources).join('\n\n'));
    function updateChars(cols, rows, step) {
      if (!codeGrid || codeGrid.cols !== cols || codeGrid.rows !== rows) {
        codeGrid = { cols, rows, buf: new Uint8Array(cols * rows) };
        gl.bindTexture(gl.TEXTURE_2D, charTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cols, rows, 0, gl.RED, gl.UNSIGNED_BYTE, null);
        codeStep = -1;
      }
      if (step === codeStep) return;
      codeStep = step;
      const { buf } = codeGrid, n = codeLines.length || 1;
      for (let r = 0; r < rows; r++) {
        const line = codeLines[(step + r) % n] || '';
        const row = rows - 1 - r;
        // margen de números de línea
        const num = String(((step + r) % n) + 1).padStart(4, ' ') + '  ';
        const s = num + line;
        for (let c = 0; c < cols; c++) { const k = s.charCodeAt(c); buf[row * cols + c] = k >= 32 && k < 127 ? k : 32; }
      }
      gl.bindTexture(gl.TEXTURE_2D, charTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.UNSIGNED_BYTE, buf);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    }

    // ---------- utilidades de dibujo
    let unit = 0;
    function use(pr) { gl.useProgram(pr.p); unit = 0; return pr; }
    function bindT(pr, name, t, target = gl.TEXTURE_2D) {
      const loc = pr.u[name]; if (loc == null) return;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t); gl.uniform1i(loc, unit); unit++;
    }
    const u1 = (pr, n, v) => { const l = pr.u[n]; if (l != null) gl.uniform1f(l, v); };
    const u2 = (pr, n, a, b) => { const l = pr.u[n]; if (l != null) gl.uniform2f(l, a, b); };
    const u3 = (pr, n, v) => { const l = pr.u[n]; if (l != null) gl.uniform3fv(l, v); };
    const u4 = (pr, n, v) => { const l = pr.u[n]; if (l != null) gl.uniform4fv(l, v); };
    function target(o) { gl.bindFramebuffer(gl.FRAMEBUFFER, o ? o.f : null); gl.viewport(0, 0, o ? o.w : W, o ? o.h : H); }
    const quad = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---------- estado
    let S = OJO.defaultState();
    let video = null, li = 0, fi = 0, si = 0, frame = 0, lastT = 0, salMax = 0.4;
    let curMode = null, transT = -1, transSeed = 0;
    let vis = { face: null, contact: 0, energy: 0 };
    let salBuf = null, energy = 0, keyBuf = null, wantKeys = false, keyThr = 0.25, keysT = 0;
    const keys = [];
    const peaks = [];
    let stingCanvas = null, stingDraw = null;
    let pendingCapture = null;

    const cover = new Float32Array(4);
    // encuadre: "cover" de la cámara + acercamiento lento a la cara durante el CONTACTO (la máquina se inclina hacia ti)
    let zoomK = 0, fcx = 0.5, fcy = 0.5, coverDy = 0;
    function computeCover() {
      const A2 = W / H, a = camW / camH || 16 / 9;
      let sx, sy;
      if (A2 > a) { sx = 1; sy = a / A2; } else { sx = A2 / a; sy = 1; }
      const ox = (1 - sx) / 2, oy = (1 - sy) / 2;
      const f = vis.focus;
      const target = f && (vis.contact || 0) > 0.25 ? 1 : 0;
      zoomK += (target - zoomK) * (target ? 0.012 : 0.03);
      if (f) {
        const cu = S.mirror ? 1 - f[0] : f[0], cvu = 1 - f[1];
        fcx += ((cu - ox) / sx - fcx) * 0.08; fcy += ((cvu - oy) / sy - fcy) * 0.08;
      }
      const z = 1 + 0.42 * (zoomK * zoomK * (3 - 2 * zoomK));
      const k = Math.min(1, zoomK * 1.2);
      // centro de la vista: hacia la cara, sin salirse de la imagen
      let cx = 0.5 + (fcx - 0.5) * k, cy = 0.5 + (fcy - 0.5) * k;
      const hw = 0.5 / z;
      cx = Math.max(hw, Math.min(1 - hw, cx)); cy = Math.max(hw, Math.min(1 - hw, cy));
      cover[0] = sx / z; cover[1] = sy / z;
      cover[2] = (cx - hw) * sx + ox; cover[3] = (cy - hw) * sy + oy;
      coverDy = 1 - cover[3] - cover[1];   // desplazamiento vertical en coordenadas hacia abajo
    }

    // uniformes comunes de los pases de modo
    function common(pr, t) {
      bindT(pr, 'uCam', camTex); bindT(pr, 'uLuma', A.luma[li].t); bindT(pr, 'uLumaP', A.luma[1 - li].t);
      bindT(pr, 'uFeat', A.feat.t); bindT(pr, 'uFlow', A.flow[fi].t); bindT(pr, 'uSal', A.sal[si].t); bindT(pr, 'uKey', A.key.t);
      u2(pr, 'uRes', W, H); u2(pr, 'uAna', AW, AH); u2(pr, 'uKeyRes', AW / 8, AH / 8); u2(pr, 'uCamTx', 1 / (camW || 1), 1 / (camH || 1));
      u4(pr, 'uCover', cover); u1(pr, 'uT', t); u1(pr, 'uMirror', S.mirror ? 1 : 0);
      u1(pr, 'uContact', vis.contact || 0); u1(pr, 'uSalMax', salMax); u1(pr, 'uEnergy', energy);
      const m = OJO.MODES[OJO.modeIndex(S.mode)];
      u3(pr, 'uAcc', hex3(OJO.ACCENTS[S.acc[S.mode]] || OJO.ACCENTS[m.accent]));
      const p = S.p[S.mode] || m.params.map((x) => x[2]);
      u4(pr, 'uP', [p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0]);
      const f = vis.face; u4(pr, 'uFace', f ? [f[0], f[1], f[2], 1] : [0, 0, 0, 0]);
    }

    function analyse(t) {
      gl.disable(gl.BLEND);
      // cámara
      gl.bindTexture(gl.TEXTURE_2D, camTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, video);
      li = 1 - li;
      let pr = use(P.luma); target(A.luma[li]); common(pr, t); quad();
      pr = use(P.feat); target(A.feat); common(pr, t); quad();
      fi = 1 - fi; pr = use(P.flow); target(A.flow[fi]); common(pr, t); bindT(pr, 'uPrev', A.flow[1 - fi].t); quad();
      si = 1 - si; pr = use(P.sal); target(A.sal[si]); common(pr, t); bindT(pr, 'uPrev', A.sal[1 - si].t); quad();
      pr = use(P.key); target(A.key); common(pr, t); quad();
      // lectura de puntos clave (esquinas) para la malla del entorno
      if (wantKeys && frame % 3 === 0 && cbf) {
        const kw = AW / 8, kh = AH / 8;
        if (!keyBuf || keyBuf.length !== kw * kh * 4) keyBuf = new Float32Array(kw * kh * 4);
        target(A.key);
        gl.readPixels(0, 0, kw, kh, gl.RGBA, gl.FLOAT, keyBuf);
        keys.length = 0;
        for (let j = 0; j < kh; j++) for (let i = 0; i < kw; i++) {
          const q = (j * kw + i) * 4, r = keyBuf[q];
          if (r < keyThr) continue;
          const cu = (i + keyBuf[q + 1]) / kw, cv = (j + keyBuf[q + 2]) / kh;
          const x = (cu - cover[2]) / cover[0], y = 1 - (cv - cover[3]) / cover[1];
          if (x < 0 || x > 1 || y < 0 || y > 1) continue;
          keys.push(x * W, y * H, Math.min(1, r));
        }
        keysT = performance.now();
      }
      // lectura de saliencia: picos para la mirada y normalización
      if (frame % 5 === 0 && cbf) {
        const sw = AW / 4, shh = AH / 4;
        target(A.sal[si]);
        gl.readPixels(0, 0, sw, shh, gl.RGBA, gl.FLOAT, salBuf);
        let mx = 0, sum = 0; const cand = [];
        for (let i = 0; i < sw * shh; i++) sum += salBuf[i * 4];
        energy = energy * 0.8 + Math.min(1, Math.max(0, (sum / (sw * shh)) / (salMax || 1) * 2.2 - 0.4)) * 0.2;
        for (let j = 1; j < shh - 1; j++) for (let i = 1; i < sw - 1; i++) {
          const v = salBuf[(j * sw + i) * 4]; if (v > mx) mx = v;
          if (v > salBuf[(j * sw + i - 1) * 4] && v >= salBuf[(j * sw + i + 1) * 4] && v > salBuf[((j - 1) * sw + i) * 4] && v >= salBuf[((j + 1) * sw + i) * 4]) cand.push([i, j, v]);
        }
        salMax = salMax * 0.8 + Math.max(0.05, mx) * 0.2;
        cand.sort((a, b) => b[2] - a[2]);
        peaks.length = 0;
        for (const c of cand) {
          if (peaks.length >= 6) break;
          // a uv de pantalla, y hacia abajo (como el lienzo 2D)
          const cu = (c[0] + 0.5) / sw, cv = (c[1] + 0.5) / shh;
          const x = (cu - cover[2]) / cover[0], y = 1 - (cv - cover[3]) / cover[1];
          if (x < 0.03 || x > 0.97 || y < 0.03 || y > 0.97) continue;
          if (peaks.some((p) => Math.hypot((p[0] - x) * W / H, p[1] - y) < 0.12)) continue;
          peaks.push([x, y, c[2] / (salMax || 1)]);
        }
      }
    }

    function renderMode(t, dt) {
      const id = S.mode;
      target(R.mode);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      const p = S.p[id];
      if (id === 'profundidad') {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        const dens = p[2];
        const gw = Math.round(120 + dens * 300), gh = Math.round(gw * H / W);
        const pr = use(P.points); common(pr, t);
        u2(pr, 'uGrid', gw, gh); u1(pr, 'uPx', Math.max(1.2, 2.6 * H / 1080 * (1.3 - dens * 0.5)));
        gl.drawArrays(gl.POINTS, 0, gw * gh);
        gl.disable(gl.BLEND);
      } else if (id === 'flujo') {
        allocPart();
        let pr = use(P.fbg); common(pr, t); quad();
        if (part) {
          // paso de partículas
          gl.disable(gl.BLEND);
          pr = use(P.pstep); target(part[1]); common(pr, t); bindT(pr, 'uState', part[0].t); u1(pr, 'uDt', dt); u1(pr, 'uSeed', (frame % 997) * 0.731); quad();
          part.reverse();
          target(R.mode);
          gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
          pr = use(P.part); bindT(pr, 'uState', part[0].t); bindT(pr, 'uFlow', A.flow[fi].t); bindT(pr, 'uFeat', A.feat.t);
          u4(pr, 'uCover', cover); u2(pr, 'uRes', W, H); u2(pr, 'uAna', AW, AH); u2(pr, 'uPGrid', PW, PH);
          u3(pr, 'uAcc', hex3(OJO.ACCENTS[S.acc[id]])); u1(pr, 'uPx', Math.max(1, 1.8 * H / 1080)); u1(pr, 'uCount', Math.round(PW * PH * (0.15 + 0.85 * p[1])));
          u1(pr, 'uContact', vis.contact || 0); const f = vis.face; u4(pr, 'uFace', f ? [f[0], f[1], f[2], 1] : [0, 0, 0, 0]);
          gl.drawArrays(gl.POINTS, 0, PW * PH);
          gl.disable(gl.BLEND);
        }
      } else if (id === 'codigo') {
        const cell = Math.max(6, Math.round((7 + p[0] * 18) * H / 1080));
        const cols = Math.ceil(W / cell), rows = Math.ceil(H / (cell * 1.6));
        const speed = 0.4 + p[3] * 10 + energy * 6;
        codeScroll += dt * speed;
        updateChars(cols, rows, Math.floor(codeScroll));
        const pr = use(P.codigo); common(pr, t);
        bindT(pr, 'uChars', charTex); bindT(pr, 'uAtlas', atlasTex);
        u2(pr, 'uGridC', cols, rows); u1(pr, 'uCell', cell);
        if (atlasReady) quad();
      } else if (id === 'memoria') {
        allocHist();
        // escribir el frame actual en el anillo
        histHead = (histHead + 1) % HL;
        gl.bindFramebuffer(gl.FRAMEBUFFER, hist.f);
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, hist.t, 0, histHead);
        gl.viewport(0, 0, HW, HH);
        let pr = use(P.histw); common(pr, t); quad();
        target(R.mode);
        pr = use(P.memoria); common(pr, t); bindT(pr, 'uHist', hist.t, gl.TEXTURE_2D_ARRAY); u1(pr, 'uHead', histHead); u1(pr, 'uLayers', HL); quad();
      } else if (id === 'neuronas') {
        const N = [2, 3, 4, 5, 6][Math.min(4, Math.floor(p[0] * 5))];
        const pr = use(P.neuronas); common(pr, t);
        u1(pr, 'uN', N);
        // la casilla de foco salta con un ritmo irregular (más rápido si hay movimiento)
        nrPhase += dt * (0.5 + energy * 2.5);
        if (nrPhase > 1) { nrPhase = 0; nrFocus = Math.floor(Math.random() * N * N); }
        if (nrFocus >= N * N) nrFocus = 0;
        u1(pr, 'uFocus', nrFocus);
        quad();
      } else if (id === 'entrada') {
        const pr = use(P.entrada); common(pr, t); bindT(pr, 'uAtlas', atlasTex); if (atlasReady) quad();
      } else if (id === 'malla' || id === 'objetos') {
        const pr = use(P.fondo); common(pr, t); quad();
      } else {
        const pr = use(id === 'bordes' ? P.bordes : P.atencion); common(pr, t); quad();
      }
    }
    let nrPhase = 0, nrFocus = 0;

    function post(t, nowMs, dt) {
      gl.disable(gl.BLEND);
      const m = OJO.MODES[OJO.modeIndex(S.mode)];
      // estela
      const tr = S.trail == null ? m.trail : S.trail;
      R.trail.reverse();
      let pr = use(P.trail); target(R.trail[0]); bindT(pr, 'uMode', R.mode.t); bindT(pr, 'uPrev', R.trail[1].t);
      u1(pr, 'uTrail', S.freeze ? 1 : tr > 0.001 ? Math.pow(Math.pow(tr, 0.35) * 0.985, Math.max(0.25, dt * 60)) : 0); quad();
      // capa de análisis
      if (overDirty) {
        gl.bindTexture(gl.TEXTURE_2D, overTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, over);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        overDirty = false;
      }
      // firma
      let stingK = 0, stingOn = false;
      if (S.firma && stingDraw) {
        const ts = (nowMs - S.firma) / 1000;
        if (ts >= 0 && ts < 5.5) {
          stingOn = true;
          stingK = Math.min(1, ts / 0.6) * (ts > 4.9 ? Math.max(0, 1 - (ts - 4.9) / 0.6) : 1);
          stingDraw(ts, OJO.ACCENTS[S.acc[S.mode]]);
          gl.bindTexture(gl.TEXTURE_2D, stingTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, stingCanvas);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        }
      }
      const tk = transT >= 0 ? Math.max(0, 1 - (t - transT) / 0.7) : 0;
      if (tk <= 0) transT = -1;
      pr = use(P.comp); target(R.comp);
      bindT(pr, 'uTrailT', R.trail[0].t); bindT(pr, 'uOver', OJO.overlayOn(S) ? overTex : black); bindT(pr, 'uTrans', R.trans.t);
      bindT(pr, 'uSting', stingOn ? stingTex : black);
      u1(pr, 'uTransK', tk * tk); u1(pr, 'uSeedT', transSeed + Math.floor(t * 30) * 0.37); u1(pr, 'uBlack', S.black ? 1 : 0);
      u1(pr, 'uStingK', stingK * 0.92); u1(pr, 'uOverK', 1 - stingK); quad();
      // bloom
      let src = R.comp;
      R.bl.forEach((b, i) => { pr = use(P.down); target(b); bindT(pr, 'uSrc', src.t); u2(pr, 'uTx', 1 / src.w, 1 / src.h); u1(pr, 'uFirst', i === 0 ? 1 : 0); quad(); src = b; });
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = R.bl.length - 1; i > 0; i--) { pr = use(P.up); target(R.bl[i - 1]); bindT(pr, 'uSrc', R.bl[i].t); u2(pr, 'uTx', 1 / R.bl[i].w, 1 / R.bl[i].h); quad(); }
      gl.disable(gl.BLEND);
      // final
      pr = use(P.final); target(null);
      bindT(pr, 'uComp', R.comp.t); bindT(pr, 'uBloom', R.bl[0].t);
      u2(pr, 'uRes', W, H); u1(pr, 'uBloomK', S.bloom); u1(pr, 'uGrain', S.grain); u1(pr, 'uCA', S.ca + (vis.contact || 0) * 0.15); u1(pr, 'uFrame', frame);
      u1(pr, 'uContact', vis.contact || 0); u1(pr, 'uT', t);
      quad();
    }

    function snapshot(t) {
      // copia el último frame compuesto para el corte de transición
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, R.comp.f); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.trans.f);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      transT = t; transSeed = Math.random() * 100;
      // la estela del modo anterior no pasa al nuevo
      R.trail.forEach((o) => { target(o); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); });
    }

    const api = {
      gl, sources,
      get overlay() { return overCtx; },
      get size() { return [W, H]; },
      get camSize() { return [camW, camH]; },
      get peaks() { return peaks; },
      get state() { return S; },
      setVideo(v) { video = v; },
      setState(ns) { S = ns; },
      setVision(v) { vis = v || vis; },
      setSource,
      setSting(canvas, draw) { stingCanvas = canvas; stingDraw = draw; },
      markOverlay() { overDirty = true; },
      // imagen (u,v ∈ 0..1, v hacia abajo, sin espejo) → píxeles del lienzo
      toImage(x, y) {
        const uu = (x / W) * cover[0] + cover[2], v = (y / H) * cover[1] + coverDy;
        return [S.mirror ? 1 - uu : uu, v];
      },
      get energy() { return energy; },
      get zoom() { return zoomK; },
      get keys() { return keys; },
      get keysT() { return keysT; },
      wantKeypoints(on, thr) { wantKeys = on; if (thr != null) keyThr = thr; },
      toScreen(u, v) {
        const uu = S.mirror ? 1 - u : u;
        return [((uu - cover[2]) / cover[0]) * W, ((v - coverDy) / cover[1]) * H];
      },
      capture() { return new Promise((res) => { pendingCapture = res; }); },
      resize(w, h) { canvas.width = w; canvas.height = h; allocRender(w, h); },
      frame(nowMs, tSec) {
        const t = tSec != null ? tSec : nowMs / 1000;
        const dt = lastT ? Math.min(0.1, Math.max(0, t - lastT)) : 1 / 60; lastT = t;
        if (canvas.width !== W || canvas.height !== H) allocRender(canvas.width, canvas.height);
        const ready = video && video.readyState >= 2 && video.videoWidth > 0;
        if (!ready) { target(null); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); return false; }
        if (video.videoWidth !== camW || video.videoHeight !== camH) { camW = video.videoWidth; camH = video.videoHeight; allocAnalysis(camW, camH); }
        computeCover();
        if (curMode !== S.mode) { if (curMode) snapshot(t); curMode = S.mode; }
        if (!S.freeze) analyse(t);
        if (!S.freeze) renderMode(t, dt);
        else { target(R.mode); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
        post(t, nowMs, dt);
        frame++;
        if (pendingCapture) { const r = pendingCapture; pendingCapture = null; canvas.toBlob((b) => r(b), 'image/png'); }
        return true;
      },
    };
    return api;
  };
})(window);
