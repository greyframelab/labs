// VØID_LOOM · ROSTRO — escena: una cabeza de laca negra en el vacío, luz que no se ve, un solo acento.
// La cara (ICT Face Model) se deforma en la gráfica: 53 expresiones mezcladas como morph targets, y encima
// el giro sobre el cuello, el temblor y lo que empuja bajo la piel. La piel lleva poros y arrugas
// procedurales que nacen con cada expresión (frente, entrecejo, patas de gallo, surco nasolabial).
import {
  WebGLRenderer, WebGLRenderTarget, HalfFloatType, Scene, Color, Mesh, PlaneGeometry, MeshBasicMaterial, DoubleSide, FrontSide, PMREMGenerator,
  PerspectiveCamera, SpotLight, MeshPhysicalMaterial, MeshStandardMaterial, MeshDepthMaterial, RGBADepthPacking, Vector2, Vector3, Vector4, Matrix3, Euler, Matrix4,
  AgXToneMapping, PCFSoftShadowMap,
  EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, AfterimagePass,
  ConeGeometry, ShaderMaterial, OrthographicCamera, CanvasTexture, LineSegments, LineBasicMaterial, AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, Object3D,
} from './vendor/three-rostro.js';
import { cargarCara } from './cara.js';
import { ARKIT } from './rig.js';

export const SHOTS = {
  medio:  { pos: [0.5, 1.4, 12.0], look: [0, 1.2, 0], fov: 26, drift: 0.22 },
  macro:  { pos: [1.9, 1.75, 6.6], look: [0.25, 1.35, 1.6], fov: 24, drift: 0.12, follow: 0.9 },
  ojo:    { pos: [-1.6, 1.85, 6.4], look: [-0.45, 1.6, 1.7], fov: 22, drift: 0.1, follow: 0.9 },
  contra: { pos: [-2.4, -2.4, 10.5], look: [0, 1.5, 0], fov: 30, drift: 0.18 },
  perfil: { pos: [11.0, 1.2, 3.6], look: [0, 1.3, 0.8], fov: 25, drift: 0.2 },
  boca:   { pos: [1.2, 0.35, 7.6], look: [0, 0.45, 1.9], fov: 26, drift: 0.1, follow: 0.95 },
  lejos:  { pos: [0, 1.2, 15.0], look: [0, 1.1, 0], fov: 26, drift: -0.25 },
};
const NOSE = 4841, PIVOT = new Vector3(0, -1.5, -0.2);
const VS = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';

// --- deformación extra en la gráfica (después de las expresiones)
const VERT_HEAD = `
uniform mat3 uHeadR; uniform vec3 uPivot; uniform float uThrust, uTremor, uTime;
uniform float uStretch, uTwist, uMelt, uBulge;
float twistA(vec3 p){ return uTwist * 0.75 * smoothstep(-1.3, 3.6, p.y) * smoothstep(-1.95, -0.85, p.y); }
uniform vec4 uBump[6]; uniform float uBumpA[6];
varying vec3 vObj; varying vec3 vRest; varying float vDef;
float headW(vec3 p){ return smoothstep(-1.95, -0.85, p.y); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;
const VERT_NORMAL = `
#include <morphnormal_vertex>
{ float hw = headW(position); float tw = twistA(position); float c0 = cos(tw), s0 = sin(tw);
  objectNormal = vec3(objectNormal.x * c0 + objectNormal.z * s0, objectNormal.y, -objectNormal.x * s0 + objectNormal.z * c0);
  objectNormal = normalize(mix(objectNormal, uHeadR * objectNormal, hw)); }
`;
const VERT_POS = `
#include <morphtarget_vertex>
vObj = transformed; vRest = position;
{
  vec3 nn = normalize(normal);
  for (int b = 0; b < 6; b++) { vec3 d = transformed - uBump[b].xyz; transformed += nn * uBumpA[b] * exp(-dot(d, d) / (uBump[b].w * uBump[b].w)); }
  float fr = smoothstep(0.4, 1.6, position.z) * step(position.y, 3.0);
  transformed += nn * (hash3(floor(position * 9.0)) - 0.5) * sin(uTime * 53.0 + hash3(position) * 40.0) * uTremor * 0.012 * fr;
  // PLÁSTICA: el cráneo se estira, la cara se derrite, la materia se hincha y la cabeza se retuerce sobre su eje
  float hwP = headW(position), frP = smoothstep(-0.2, 1.2, position.z);
  transformed.y += (transformed.y - 1.9) * uStretch * 0.42 * smoothstep(1.5, 2.8, position.y);
  transformed.y += (transformed.y - 0.45) * uStretch * 0.14 * smoothstep(0.9, -0.6, position.y) * hwP;
  float mw = uMelt * smoothstep(2.1, -0.8, position.y) * frP * hwP;
  transformed.y -= mw * 0.75 * (0.75 + 0.25 * sin(position.x * 3.1 + 1.7)); transformed.z -= mw * 0.12;
  float bn = sin(position.x * 2.3 + uTime * 1.7) * sin(position.y * 1.9 - uTime * 1.3) * sin(position.z * 2.1 + uTime * 1.1);
  transformed += nn * uBulge * 0.22 * (0.4 + 0.6 * bn) * hwP;
  { float tw = twistA(position); float c1 = cos(tw), s1 = sin(tw); vec2 xz = vec2(transformed.x, transformed.z - 0.3);
    transformed.x = xz.x * c1 + xz.y * s1; transformed.z = 0.3 - xz.x * s1 + xz.y * c1; }
  vDef = length(transformed - position);   // cuánto se ha movido este punto de piel (expresión + plástica)
  float hw = headW(position);
  vec3 rp = uPivot + uHeadR * (transformed - uPivot) + vec3(0.0, 0.0, uThrust);
  transformed = mix(transformed, rp, hw);
}
`;
// --- piel: poros + arrugas que nacen con la expresión (bump procedural con derivadas de pantalla)
const FRAG_SKIN_HEAD = `
varying vec3 vObj; uniform vec4 uWrk; uniform vec4 uWrk2; uniform float uPore; uniform float uScan, uScanK; uniform vec3 uScanCol; varying vec3 vRest; varying float vDef; uniform sampler2D tCode; uniform float uCode, uVec;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float g2(vec2 d, vec2 r){ return exp(-dot(d / r, d / r)); }
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float skinH(vec3 p){
  float ax = abs(p.x), front = smoothstep(0.6, 1.8, p.z);
  float h = 0.0;
  // poros y textura fina (en la cara, más suave en el cráneo)
  h += (vnoise(p * 60.0) - 0.5) * 0.0012 * uPore + (vnoise(p * 130.0) - 0.5) * 0.0005 * uPore;
  h += (vnoise(p * 14.0) - 0.5) * 0.0015;
  // frente: líneas horizontales al subir las cejas
  float fw = g2(vec2(p.x, p.y - 2.62), vec2(1.05, 0.42)) * front;
  h -= fw * uWrk.x * 0.017 * pow(abs(sin(p.y * 24.0 + vnoise(p * 3.0) * 2.5)), 6.0);
  // entrecejo: surcos verticales al fruncir
  // dos surcos cortos a ambos lados del centro
  float bw = g2(vec2(ax - 0.11, p.y - 1.98), vec2(0.05, 0.2)) * front;
  h -= bw * uWrk.y * 0.022;
  // rabillo del ojo: un pliegue suave y horizontal al apretar los ojos (sin líneas dibujadas)
  float cw = g2(vec2(ax - 1.02, p.y - 1.6), vec2(0.16, 0.08)) * smoothstep(0.9, 1.0, ax);
  h -= cw * uWrk.z * 0.012;
  // surco nasolabial: del ala de la nariz a la comisura
  float nd = segD(vec2(ax, p.y), vec2(0.36, 1.02), vec2(0.66, 0.22));
  h -= exp(-nd * nd / 0.0035) * uWrk.w * 0.022 * front;
  // arrugas de la nariz (asco, furia) y barbilla que se arruga
  h -= g2(vec2(p.x, p.y - 1.42), vec2(0.22, 0.1)) * uWrk2.x * 0.006 * pow(abs(sin(p.y * 26.0 + 0.8)), 3.0) * front;
  h -= g2(vec2(p.x, p.y + 0.35), vec2(0.35, 0.22)) * uWrk2.y * 0.012 * vnoise(p * 30.0) * front;
  // tendones del cuello en tensión
  h += g2(vec2(ax - 0.55, p.y + 1.35), vec2(0.12, 0.9)) * uWrk2.z * 0.028 * smoothstep(-0.5, 0.8, p.z);
  return h;
}
vec3 perturb(vec3 pos, vec3 n, float h){
  vec3 dx = dFdx(pos), dy = dFdy(pos); vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 r1 = cross(dy, n), r2 = cross(n, dx); float det = dot(dx, r1) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * n - g);
}
`;

// el busto se disuelve en el negro: cuello, hombros y pecho se apagan y se deshacen en grano (sin borde de corte)
const FRAG_BUSTO = `
float bustoFade(vec3 p){
  float y = smoothstep(-2.45, -0.95, p.y);                                   // de abajo hacia el cuello
  float lado = 1.0 - smoothstep(1.15, 2.4, abs(p.x)) * smoothstep(-0.55, -1.6, p.y); // hombros por los lados
  float atras = 1.0 - smoothstep(-0.2, -1.6, p.z) * smoothstep(-0.4, -1.8, p.y);   // espalda
  return clamp(y * lado * atras, 0.0, 1.0);
}
float ign(vec2 c){ return fract(52.9829189 * fract(dot(c, vec2(0.06711056, 0.00583715)))); }
`;
const DISOLVER = 'float bF = bustoFade(vObj); if (bF < ign(gl_FragCoord.xy) * 0.9) discard;';

function inyectar(mat, U, piel) {
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = VERT_HEAD + s.vertexShader
      .replace('#include <morphnormal_vertex>', VERT_NORMAL)
      .replace('#include <morphtarget_vertex>', VERT_POS);
    const pre = (piel ? FRAG_SKIN_HEAD : 'varying vec3 vObj;\n') + FRAG_BUSTO;
    let fs = pre + s.fragmentShader.replace('void main() {', 'void main() {\n' + DISOLVER);
    if (piel) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturb(-vViewPosition, normal, skinH(vObj));');
    // además del grano, la luz se apaga hacia abajo: un fundido, no un corte
    if (fs.includes('#include <dithering_fragment>')) fs = fs.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= bF * bF;');
    // FX · LÁSER: una línea de luz del acento recorre la piel de arriba abajo (y deja una estela tenue encima)
    if (piel) fs = fs.replace('gl_FragColor.rgb *= bF * bF;', 'gl_FragColor.rgb *= bF * bF;\n{ float dS = (vObj.y - uScan) / 0.016; float tr = vObj.y > uScan ? exp(-(vObj.y - uScan) / 0.3) * 0.08 : 0.0; gl_FragColor.rgb += uScanCol * uScanK * (2.2 * exp(-dS * dS) + tr) * bF; }\n'
      // VISTA CÓDIGO: la piel es el código que la mueve. Proyección cilíndrica en reposo: el texto va pegado a la piel y se estira, se retuerce y se derrite con ella
      + '{ gl_FragColor.rgb *= 1.0 - 0.55 * uVec; if (uCode > 0.002) { float ang = atan(vRest.x, vRest.z - 0.3); vec2 cu = vec2(ang / 6.2831853 + 0.5, (vRest.y + 1.0) / 4.8);'
      + ' float gc = texture2D(tCode, cu).r; float act = smoothstep(0.004, 0.11, vDef); vec3 ink = mix(vec3(0.82, 0.86, 0.9), uScanCol * 1.4, 0.35 + 0.65 * act);'
      + ' gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - 0.6 * uCode) + ink * gc * (0.06 + 1.7 * act * act + 0.5 * act) * uCode * bF * bF; } }');
    s.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'rostro-' + (piel ? 'piel' : 'otro');
}

export async function crearEscena(canvas, accentHex, base = './assets/', { msaa = 4 } = {}) {
  const r = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  r.toneMapping = AgXToneMapping; r.toneMappingExposure = 1.15; r.shadowMap.enabled = true; r.shadowMap.type = PCFSoftShadowMap;
  const sc = new Scene(); sc.background = new Color(0);
  const accent = new Color(accentHex);

  // entorno: estudio negro con tiras de luz (reflejos en líneas, nunca un gris general)
  const envS = new Scene(); envS.background = new Color(0);
  const strip = (w, h, x, y, z, col, k) => { const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(col).multiplyScalar(k), side: DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); return m; };
  strip(3.2, 7, -6.5, 3, 6, 0xffffff, 2.2);
  strip(0.22, 9, -4, 2, 7, 0xffffff, 4);
  strip(9, 0.2, 0, 7, 3, 0xffffff, 2);
  const accStrip = strip(0.25, 8, 7, 1, -4, accent, 5);
  const pm = new PMREMGenerator(r);
  const envCache = new Map();
  const bakeEnv = () => { const k = accent.getHexString(); let tex = envCache.get(k); if (!tex) { tex = pm.fromScene(envS, 0.02).texture; envCache.set(k, tex); } sc.environment = tex; };
  bakeEnv();

  const cam = new PerspectiveCamera(26, 16 / 9, 0.1, 100);
  const key = new SpotLight(0xf2efe9, 80, 40, 0.3, 0.95, 1.6);
  key.position.set(-8.5, 7.5, 4.5); key.target.position.set(0, 1.4, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.camera.near = 4; key.shadow.camera.far = 22;
  const rimA = new SpotLight(accent, 160, 40, 0.5, 0.8, 1.5); rimA.position.set(7.5, 4.5, -7); rimA.target.position.set(0, 1.2, 0.5);
  const rimB = new SpotLight(accent, 60, 40, 0.5, 0.8, 1.5); rimB.position.set(-8, 1.5, -6); rimB.target.position.set(0, 1.0, 0.5);
  const sweep = new SpotLight(0xffffff, 0, 30, 0.16, 0.6, 1.4); sweep.position.set(0, 1.5, 9); sweep.target.position.set(0, 1.4, 1.5);
  sc.add(key, key.target, rimA, rimA.target, rimB, rimB.target, sweep, sweep.target);

  // FX · ATMÓSFERA: conos de luz (niebla iluminada) y polvo flotando en el haz
  const atmos = new Object3D(); sc.add(atmos);
  const coneMat = (col, k) => new ShaderMaterial({
    uniforms: { uCol: { value: new Color(col) }, uK: { value: k }, uT: { value: 0 }, uLen: { value: 1 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uCol; uniform float uK, uT, uLen; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        float a = clamp(0.5 - vP.y / uLen, 0.0, 1.0);          // 0 en el foco, 1 al final del cono
        float edge = pow(abs(dot(vN, vV)), 2.6);                 // bordes muy suaves: el haz no tiene silueta
        float fog = 0.55 + 0.45 * n3(vP * 1.3 + vec3(0.0, -uT * 0.25, uT * 0.1));
        gl_FragColor = vec4(uCol * uK * edge * fog * smoothstep(0.0, 0.15, a) * (1.0 - a * 0.6) * smoothstep(1.0, 0.45, a), 1.0); // se apaga antes de acabar: sin borde circular al final
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const haz = (from, to, radio, col, k) => {
    const L = from.distanceTo(to); const g = new ConeGeometry(radio, L, 48, 1, true); const m = coneMat(col, k); m.uniforms.uLen.value = L;
    const c = new Mesh(g, m); c.position.copy(from).add(to).multiplyScalar(0.5); c.lookAt(to); c.rotateX(-Math.PI / 2); c.renderOrder = 2; atmos.add(c); return c; // la punta del cono, en el foco
  };
  const hazKey = haz(new Vector3(-8.5, 7.5, 4.5), new Vector3(1.5, -1.5, -1), 3.4, 0xf2efe9, 0.038);
  const hazRim = haz(new Vector3(7.5, 4.5, -7), new Vector3(-1.2, 0.2, 1.8), 3.0, accent, 0.075);
  const NP = 900, pp = new Float32Array(NP * 3), ps = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { pp[i * 3] = (Math.random() - 0.5) * 12; pp[i * 3 + 1] = (Math.random() - 0.3) * 9; pp[i * 3 + 2] = (Math.random() - 0.5) * 10; ps[i] = Math.random(); }
  const pg = new BufferGeometry(); pg.setAttribute('position', new Float32BufferAttribute(pp, 3)); pg.setAttribute('aS', new Float32BufferAttribute(ps, 1));
  const polvoMat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new Color(0xf2efe9) }, uPx: { value: 1 } },
    vertexShader: `attribute float aS; uniform float uT, uPx; varying float vA;
      void main(){ vec3 p = position; p.y += mod(uT * (0.05 + aS * 0.08) + aS * 9.0, 9.0) - 4.5; p.x += sin(uT * 0.3 + aS * 30.0) * 0.3;
        // solo brilla dentro del haz de la clave (de arriba a la izquierda hacia el centro)
        vec3 d = normalize(vec3(10.0, -9.0, -5.5)); vec3 o = vec3(-8.5, 7.5, 4.5); vec3 q = p - o; float along = dot(q, d); float dist = length(q - d * along);
        vA = smoothstep(along * 0.34 + 0.2, along * 0.12, dist) * (0.35 + 0.65 * aS);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (1.2 + aS * 2.2) * (6.0 / -mv.z); }`,
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA; gl_FragColor = vec4(uCol * a * 0.75, 1.0); }',
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const polvo = new Points(pg, polvoMat); polvo.renderOrder = 3; atmos.add(polvo);

  const cara = await cargarCara(base);
  const U = { tCode: { value: null }, uCode: { value: 0 }, uVec: { value: 0 }, uScan: { value: -9 }, uScanK: { value: 0 }, uScanCol: { value: new Color(accentHex) }, uStretch: { value: 0 }, uTwist: { value: 0 }, uMelt: { value: 0 }, uBulge: { value: 0 }, uHeadR: { value: new Matrix3() }, uPivot: { value: PIVOT.clone() }, uThrust: { value: 0 }, uTremor: { value: 0 }, uTime: { value: 0 },
    uBump: { value: Array.from({ length: 6 }, () => new Vector4(0, 0, -99, 0.3)) }, uBumpA: { value: new Array(6).fill(0) },
    uWrk: { value: new Vector4() }, uWrk2: { value: new Vector4() }, uPore: { value: 1 } };
  const piel = new MeshPhysicalMaterial({ color: 0x030303, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, specularIntensity: 1, envMapIntensity: 1 });
  const interior = new MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0, envMapIntensity: 0 });
  const dientes = new MeshPhysicalMaterial({ color: 0x020202, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 0.3, specularIntensity: 0.5 });
  const ojos = new MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
  inyectar(piel, U, true); [interior, dientes, ojos].forEach(m => inyectar(m, U, false));
  interior.onBeforeCompile = ((prev) => (s) => { prev(s); s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= 0.15;'); })(interior.onBeforeCompile);
  interior.customProgramCacheKey = () => 'rostro-interior';
  const mesh = new Mesh(cara.geometry, [piel, interior, dientes, ojos]);
  mesh.castShadow = mesh.receiveShadow = true;
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking }); inyectar(depth, U, false); mesh.customDepthMaterial = depth;
  mesh.morphTargetInfluences = new Array(cara.nTargets).fill(0);
  mesh.frustumCulled = false;
  sc.add(mesh);
  const idx = ARKIT.map(n => cara.names[n]);

  // ---------------------------------------------------------------- VISTA CÓDIGO
  // Un lienzo de 72 renglones que envuelve la cabeza: cada altura lleva el código de lo que mueve esa zona
  // (cejas arriba, ojos, mejillas y nariz, boca, mandíbula; el cuello lleva el giro; el cráneo, la emoción y la plástica).
  const CW = 2048, CH = 1152, ROWS = 72, RH = CH / ROWS;
  const lienzo = document.createElement('canvas'); lienzo.width = CW; lienzo.height = CH;
  const ctx = lienzo.getContext('2d');
  const codeTex = new CanvasTexture(lienzo); codeTex.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy()); U.tCode.value = codeTex;
  const zona = (y) => y > 2.45 ? 'craneo' : y > 1.86 ? 'ceja' : y > 1.3 ? 'ojo' : y > 0.64 ? 'mejilla' : y > 0.2 ? 'boca' : y > -0.25 ? 'mandibula' : 'cuello';
  const DE = {
    ceja: ARKIT.filter(n => /^brow/.test(n)), ojo: ARKIT.filter(n => /^eye|^Pupil/.test(n)), mejilla: ARKIT.filter(n => /^cheek|^nose/.test(n)),
    boca: ARKIT.filter(n => /^mouth/.test(n) && !/Close|ShrugLower|LowerDown/.test(n)), mandibula: ARKIT.filter(n => /^jaw|mouthClose|mouthShrugLower|mouthLowerDown/.test(n)),
    cuello: ['pitch', 'yaw', 'roll', 'thrust', 'tremor'], craneo: ['stretch', 'twist', 'melt', 'bulge'],
  };
  const rowY = (i) => 3.8 - 4.8 * (i + 0.5) / ROWS;
  const filas = new Array(ROWS).fill(null), GLIFOS = '01{}[]();=+-*/<>#ØΔΣ%&|^~$@:._';
  let codeC = {}, codeEmo = '', codeTick = -1, codeOn = false;
  ctx.font = '500 ' + Math.round(RH * 0.86) + 'px "JetBrains Mono", "DejaVu Sans Mono", monospace'; const cw = ctx.measureText('M').width;
  const fmt = (v) => (v < 0 ? '' : ' ') + (+v || 0).toFixed(2);
  function fila(i, t) {
    const z = zona(rowY(i)), lista = DE[z], segs = []; let n = 0, k = i * 3;
    const push = (s, bright) => { segs.push([n, s, bright]); n += s.length; };
    while (n < CW / cw + 8) {
      if (z === 'craneo' && k % 5 === 0) { push('emocion = ', 0); push('"' + codeEmo + '"', 1); push(';  ', 0); }
      else if (z === 'craneo' && k % 5 === 2) { push('t = ', 0); push(t.toFixed(3), 1); push(';  ', 0); }
      else { const nm = lista[k % lista.length]; push(nm + ' =', 0); push(fmt(codeC[nm]), 1); push(';  ', 0); }
      k++;
    }
    return segs;
  }
  function basura(i) { let s = ''; for (let j = 0; j < CW / cw + 2; j++) s += GLIFOS[(Math.random() * GLIFOS.length) | 0]; return [[0, s, 1]]; }
  function pintarCodigo(t, mAge) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH); ctx.textBaseline = 'alphabetic';
    const sc = U.uScan.value, rees = mAge < 0.9;
    for (let i = 0; i < ROWS; i++) {
      const y = rowY(i);
      // en cada cambio de expresión el código se reescribe con el láser: arriba ya nuevo, en la línea basura, debajo el de antes
      if (!rees || y > sc + 0.14 || !filas[i]) filas[i] = fila(i, t); else if (y > sc - 0.14) filas[i] = basura(i);
      const by = (i + 0.82) * RH;
      for (const [x, s, b] of filas[i]) { ctx.fillStyle = b ? '#ffffff' : '#6c6c6c'; ctx.fillText(s, x * cw, by); }
    }
    codeTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- VISTA VECTORES
  // Cada punto de piel traza una línea de luz desde donde estaría en reposo hasta donde está (amplificado):
  // la emoción se ve como un campo de fuerzas que sale de la cara.
  const vecMesh = (() => {
    const g0 = cara.geometry, P0 = g0.attributes.position.array, N0 = g0.attributes.normal.array, I0 = g0.index.array;
    const piel0 = g0.groups.find(gr => gr.materialIndex === 0), usado = new Uint8Array(cara.N);
    for (let j = piel0.start; j < piel0.start + piel0.count; j++) usado[I0[j]] = 1;
    const sel = []; for (let i = 0; i < cara.N; i += 5) if (usado[i] && P0[i * 3 + 1] > -0.9) sel.push(i);
    const n = sel.length, pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), end = new Float32Array(n * 2);
    sel.forEach((v, j) => { for (let e = 0; e < 2; e++) { for (let c = 0; c < 3; c++) { pos[(j * 2 + e) * 3 + c] = P0[v * 3 + c]; nor[(j * 2 + e) * 3 + c] = N0[v * 3 + c]; } end[j * 2 + e] = e; } });
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('aEnd', new Float32BufferAttribute(end, 1));
    g.morphAttributes.position = g0.morphAttributes.position.map(a => { const d = new Float32Array(n * 6); sel.forEach((v, j) => { for (let e = 0; e < 2; e++) for (let c = 0; c < 3; c++) d[(j * 2 + e) * 3 + c] = a.array[v * 3 + c]; }); return new Float32BufferAttribute(d, 3); });
    g.morphTargetsRelative = true; g.computeBoundingSphere(); g.boundingSphere.radius *= 3;
    const m = new LineBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: AdditiveBlending });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U, { uAmp: { value: 3.2 }, uVcol: { value: accent } });
      s.vertexShader = VERT_HEAD + 'attribute float aEnd; uniform float uAmp; varying float vL; varying float vE;\n' + s.vertexShader.replace('#include <morphtarget_vertex>', VERT_POS + `
{ vec3 r0 = position + normalize(normal) * 0.012; float hw0 = headW(position);
  vec3 rr = mix(r0, uPivot + uHeadR * (r0 - uPivot) + vec3(0.0, 0.0, uThrust), hw0);
  vec3 dl = transformed - rr; vL = length(dl); vE = aEnd;
  vec3 nr = normalize(uHeadR * normal); transformed = rr + (dl * uAmp * 0.6 + nr * min(vL, 0.4) * uAmp * 0.55) * aEnd; } // hacia fuera: un campo que sale de la piel`);
      s.fragmentShader = 'varying float vL; varying float vE; uniform float uVec; uniform vec3 uVcol;\n' + s.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  { float k = smoothstep(0.006, 0.16, vL); vec3 c = mix(vec3(0.75, 0.8, 0.85) * 0.05, uVcol * 3.0 + vec3(0.5), clamp(vE, 0.0, 1.0) * sqrt(clamp(vE, 0.0, 1.0)) * k);
    gl_FragColor = vec4(c * k * mix(0.02, 1.6, vE * vE) * uVec, 1.0); }`);
    };
    m.customProgramCacheKey = () => 'rostro-vectores';
    const L = new LineSegments(g, m); L.morphTargetInfluences = mesh.morphTargetInfluences; L.frustumCulled = false; L.renderOrder = 4; L.visible = false;
    sc.add(L); return L;
  })();
  let vista = 'auto', vCode = 0, vVec = 0, vAuto = 'normal', vAutoKey = null, lastV = -1;

  // composición: MSAA real, recorte de brillos antes del bloom, viñeta y grano sutil
  const rt = new WebGLRenderTarget(16, 16, { type: HalfFloatType, samples: msaa });
  const comp = new EffectComposer(r, rt);
  comp.addPass(new RenderPass(sc, cam));
  comp.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: VS,
    fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 v;void main(){vec3 c=texture2D(tDiffuse,v).rgb;float m=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*min(1.,1.6/max(m,1e-4)),1.);}' }));
  // FX · DESTELLOS: los brillos de la laca se alargan en horizontal, con un poco del acento
  const destellos = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new Vector2(16, 9) }, uAcc: { value: accent }, uK: { value: 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform vec3 uAcc; uniform float uK; varying vec2 v;
      void main(){ vec3 c = texture2D(tDiffuse, v).rgb; vec3 s = vec3(0.0); float px = 1.0 / uRes.x;
        // muestras continuas (paso de 3 px) y suavizadas en vertical: una línea limpia, nunca rayas
        for (int i = -32; i <= 32; i++) { float o = float(i) * 3.0 * px * (uRes.x / 1280.0); float w = exp(-abs(float(i)) / 11.0);
          vec3 t = texture2D(tDiffuse, v + vec2(o, 0.0)).rgb + texture2D(tDiffuse, v + vec2(o, 1.5 / uRes.y)).rgb + texture2D(tDiffuse, v - vec2(-o, 1.5 / uRes.y)).rgb;
          t /= 3.0; float l = max(max(t.r, t.g), t.b); s += t * max(0.0, l - 1.25) * w; }
        s = s * 0.065 * uK; s = mix(s, uAcc * dot(s, vec3(0.333)), 0.35);
        gl_FragColor = vec4(c + s, 1.0); }`,
  });
  comp.addPass(destellos);
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.15, 0.6, 0.86); comp.addPass(bloom);
  // FX · ESTELA: el movimiento deja un eco que se apaga (más largo cuanto más rápido es el gesto)
  const estela = new AfterimagePass(0.0); comp.addPass(estela);
  // FX · GLITCH: separación RGB y franjas desplazadas en tirones e impacto
  const glitch = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uG: { value: 0 }, uT: { value: 0 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uG, uT; varying vec2 v;
      float h(float x){ return fract(sin(x * 91.17 + uT * 13.0) * 43758.5453); }
      void main(){ vec2 uv = v; float band = floor(uv.y * (14.0 + 30.0 * h(1.0)));
        float on = step(1.0 - uG * 0.55, h(band)); uv.x += (h(band + 7.0) - 0.5) * 0.16 * uG * on;
        float ca = 0.009 * uG + 0.004 * uG * on;
        vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  // FX · DOBLE EXPOSICIÓN: la cara anterior se queda un instante sobreimpresionada sobre la nueva y se disuelve
  const ghostRT = new WebGLRenderTarget(16, 16, { type: HalfFloatType });
  const blitCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1), blitMat = new MeshBasicMaterial({ map: null, depthTest: false, depthWrite: false });
  const blitScene = new Scene(); blitScene.add(new Mesh(new PlaneGeometry(2, 2), blitMat));
  const doble = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tGhost: { value: ghostRT.texture }, uA: { value: 0 }, uS: { value: 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse, tGhost; uniform float uA, uS; varying vec2 v;
      void main(){ vec3 c = texture2D(tDiffuse, v).rgb; vec3 g = texture2D(tGhost, (v - 0.5) / uS + 0.5).rgb * uA;
        gl_FragColor = vec4(max(c, g) + g * 0.2, 1.0); }`,
  });
  let ghostTick = 0, ghostLive = true;
  const dobleRender = doble.render.bind(doble);
  doble.render = (rr, wb, rb, dt, mk) => {
    // mientras no hay cambio, guarda la imagen cada pocos fotogramas: al cambiar, queda la cara de antes
    if (ghostLive && (ghostTick++ % 3 === 0)) { blitMat.map = rb.texture; const prev = rr.getRenderTarget(); rr.setRenderTarget(ghostRT); rr.render(blitScene, blitCam); rr.setRenderTarget(prev); }
    if (doble.uniforms.uA.value > 0.004) dobleRender(rr, wb, rb, dt, mk); else { blitMat.map = rb.texture; rr.setRenderTarget(doble.renderToScreen ? null : wb); rr.render(blitScene, blitCam); }
  };
  comp.addPass(doble);
  comp.addPass(glitch);
  const fin = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new Vector2(16, 9) }, uFade: { value: 1 }, uLens: { value: 1 }, uLensP: { value: 0 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uT,uFade,uLens,uLensP;uniform vec2 uRes;varying vec2 v;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uT)*43758.5453);}
    void main(){vec2 dd=v-.5;float r2=dot(dd,dd);vec2 off=dd*(uLens*0.05*r2+uLensP*0.014); // FX · LENTE: aberración cromática radial y tirón en cada golpe
    vec3 c=vec3(texture2D(tDiffuse,v+off).r,texture2D(tDiffuse,v).g,texture2D(tDiffuse,v-off).b);vec2 d=v-.5;d.x*=uRes.x/uRes.y;
    c*=smoothstep(1.05,.25,length(d));
    float l=dot(c,vec3(.299,.587,.114));c+=(h(v*uRes)-.5)*.016*(1.-l);
    gl_FragColor=vec4(max(c,0.)*uFade,1.);}`,
  });
  comp.addPass(fin); comp.addPass(new OutputPass());

  let rimNow = 1, lastR = 0, corte = false, lastShot = '', lastSince = 0;
  const v3 = (a) => new Vector3(...a), eul = new Euler(), m4 = new Matrix4(), anchorD = new Vector3(), w = new Float32Array(cara.nTargets);
  const restNose = new Vector3(cara.rest[NOSE * 3], cara.rest[NOSE * 3 + 1], cara.rest[NOSE * 3 + 2]);
  let curAcc = accentHex, W = 0, H = 0, lig = false;
  // en vertical (reel, pantalla girada) abre el campo para que la cabeza quepa igual que en horizontal
  const vfov = (fv) => { const a = W / H; if (!(a < 1)) return fv; const k = 0.95 / a; return 2 * Math.atan(Math.tan(fv * Math.PI / 360) * k) * 180 / Math.PI; };
  const FX = { glitch: true, estela: true, atmos: true, destellos: true, laser: true, doble: true, lente: true };
  const aplicarFx = () => { glitch.enabled = FX.glitch; estela.enabled = FX.estela; atmos.visible = FX.atmos; destellos.enabled = FX.destellos && !lig; fin.uniforms.uLens.value = FX.lente ? 1 : 0; };
  aplicarFx();
  return {
    renderer: r,
    tamano(wd, ht) {
      wd = Math.max(2, Math.round(wd)); ht = Math.max(2, Math.round(ht)); if (wd === W && ht === H) return;
      W = wd; H = ht; r.setSize(wd, ht, false); comp.setSize(wd, ht); cam.aspect = wd / ht; cam.updateProjectionMatrix(); fin.uniforms.uRes.value.set(wd, ht); ghostRT.setSize(Math.max(2, wd >> 1), Math.max(2, ht >> 1)); destellos.uniforms.uRes.value.set(wd, ht); polvoMat.uniforms.uPx.value = ht / 720;
    },
    acento(hex) {
      if (hex === curAcc) return; curAcc = hex; accent.set(hex);
      rimA.color.copy(accent); rimB.color.copy(accent); hazRim.material.uniforms.uCol.value.copy(accent); U.uScanCol.value.copy(accent); accStrip.material.color.copy(accent).multiplyScalar(5); bakeEnv();
    },
    // ligera: sin sombras ni bloom, poros más suaves (para gráficas integradas)
    calidad(ligera) { lig = ligera; key.castShadow = !ligera; bloom.enabled = !ligera; U.uPore.value = ligera ? 0.6 : 1; r.shadowMap.needsUpdate = true; aplicarFx(); },
    // FX: { glitch, estela, atmos, destellos } — cada uno se enciende y se apaga en directo
    fx(o) { Object.assign(FX, o); aplicarFx(); },
    // c: controles (53 expresiones + cabeza); bumps: impulsos bajo la piel
    // VISTA: 'normal' · 'codigo' · 'vectores' · 'auto' (cambia sola en los cambios de expresión)
    vista(v) { vista = v; },
    pose(c, t, bumps, emo) {
      codeC = c; if (emo) { let mx = -1; for (const k in emo) if (emo[k] > mx) { mx = emo[k]; codeEmo = k; } }
      for (let k = 0; k < ARKIT.length; k++) { const v = c[ARKIT[k]] || 0; w[idx[k]] = v; mesh.morphTargetInfluences[idx[k]] = v; }
      eul.set(c.pitch || 0, c.yaw || 0, c.roll || 0, 'XYZ'); m4.makeRotationFromEuler(eul); U.uHeadR.value.setFromMatrix4(m4);
      U.uStretch.value = c.stretch || 0; U.uTwist.value = c.twist || 0; U.uMelt.value = Math.max(0, c.melt || 0); U.uBulge.value = Math.max(0, c.bulge || 0);
      U.uThrust.value = (c.thrust || 0) * 0.9; U.uTremor.value = Math.max(0, c.tremor || 0); U.uTime.value = t % 1000;
      for (let b = 0; b < 6; b++) { const B = bumps && bumps[b]; if (B) { U.uBump.value[b].set(B.x, B.y, B.z, B.r); U.uBumpA.value[b] = B.a; } else U.uBumpA.value[b] = 0; }
      // arrugas: cada una nace de las expresiones que la provocan
      const a = (n) => ((c[n + '_L'] || 0) + (c[n + '_R'] || 0)) / 2, cl = (x) => Math.max(0, Math.min(1.4, x));
      U.uWrk.value.set(cl(a('browInnerUp') * 0.6 + a('browOuterUp') * 0.6), cl(a('browDown') + a('browInnerUp') * 0.3 * a('browDown')),
        cl(a('eyeSquint') * 0.7 + a('cheekSquint') * 0.6 + a('mouthSmile') * 0.4), cl(a('mouthSmile') * 0.8 + a('noseSneer') * 0.6 + a('mouthUpperUp') * 0.5 + a('cheekRaiser') * 0.4));
      U.uWrk2.value.set(cl(a('noseSneer')), cl(a('mouthShrugLower') + a('mouthFrown') * 0.5), cl(a('mouthStretch') * 0.9 + (c.jawOpen || 0) * 0.3 + a('mouthFrown') * 0.4), 0);
      // ancla para que la cámara siga la cara: la punta de la nariz deformada en CPU
      const p = cara.punto(NOSE, w); const hw = 1; const q = new Vector3(...p).sub(PIVOT).applyMatrix4(m4).add(PIVOT); q.z += U.uThrust.value;
      anchorD.copy(q).sub(restNose).multiplyScalar(hw);
    },
    camara(name, since) {
      if (name !== lastShot || since < lastSince) corte = true; lastShot = name; lastSince = since;
      const S = SHOTS[name] || SHOTS.medio; const p = v3(S.pos), l = v3(S.look);
      const dir = l.clone().sub(p).normalize(); const fol = S.follow ?? 0.6;
      p.addScaledVector(anchorD, fol); l.addScaledVector(anchorD, fol);
      cam.position.copy(p.addScaledVector(dir, S.drift * since)); cam.fov = vfov(S.fov); cam.updateProjectionMatrix(); cam.lookAt(l);
    },
    luz(rim, sw = 0, swx = 0, bri = 1) {
      rimNow = rim; rimA.intensity = 160 * rim * bri; rimB.intensity = 60 * rim * bri; key.intensity = 80 * bri;
      sweep.intensity = 900 * sw * bri; sweep.position.x = swx * 6; sweep.target.position.x = swx * 1.2;
    },
    // g: golpe de glitch (0..1) · speed: velocidad del gesto (alarga la estela) · mAge: segundos desde el último cambio de expresión
    render(t, fade = 1, g = 0, speed = 0, mAge = 99) {
      const mk = Math.max(0, 1 - mAge / 0.9);
      U.uScan.value = 3.3 - Math.min(1, mAge / 0.9) * 5.0; U.uScanK.value = FX.laser ? mk * mk * 1.3 : 0;
      ghostLive = mAge > 0.6; doble.uniforms.uA.value = FX.doble && mAge < 1.2 ? 0.6 * Math.exp(-mAge / 0.38) : 0; doble.uniforms.uS.value = 1 + Math.min(1.2, mAge) * 0.14;
      fin.uniforms.uLensP.value = FX.lente ? Math.exp(-mAge / 0.18) + g * 0.5 : 0;
      // vista: en AUTO elige en cada cambio de expresión, con la hora del cambio como semilla (consola y salida eligen lo mismo)
      if (vista === 'auto' && mAge < 50) { const key = Math.round((t - mAge) * 10); if (key !== vAutoKey) { vAutoKey = key; const h = Math.abs(Math.sin(key * 12.9898) * 43758.5453) % 1; vAuto = h < 0.55 ? 'normal' : 'codigo'; // VECTORES no entra sola: solo a mano } }
      const vv = vista === 'auto' ? vAuto : vista, dv = t > lastV && t - lastV < 0.25 ? t - lastV : 1 / 30; lastV = t;
      const kv = 1 - Math.exp(-dv / 0.12); vCode += ((vv === 'codigo' ? 1 : 0) - vCode) * kv; vVec += ((vv === 'vectores' ? 1 : 0) - vVec) * kv;
      U.uCode.value = vCode; U.uVec.value = vVec; vecMesh.visible = vVec > 0.01;
      if (vCode > 0.01 && (t - codeTick > 1 / 15 || t < codeTick)) { codeTick = t; pintarCodigo(t, mAge); }
      fin.uniforms.uT.value = t % 97; fin.uniforms.uFade.value = fade;
      glitch.uniforms.uG.value = Math.min(1, g); glitch.uniforms.uT.value = Math.floor(t * 24) % 97; glitch.enabled = FX.glitch && g > 0.01;
      // la estela dura en segundos, no en fotogramas (igual a 60 que a 30 fps), y se borra en cada corte de plano
      const dtR = t > lastR && t - lastR < 0.25 ? t - lastR : 1 / 60; lastR = t; // tiempo de la pieza: vale igual en directo y en render
      const tau = 0.05 + 0.09 * Math.min(1.4, speed);
      estela.uniforms.damp.value = corte ? 0 : Math.exp(-dtR / tau); corte = false;
      hazKey.material.uniforms.uT.value = t; hazRim.material.uniforms.uT.value = t; polvoMat.uniforms.uT.value = t;
      hazRim.material.uniforms.uK.value = 0.075 * Math.min(2, rimNow);
      comp.render();
    },
  };
}
