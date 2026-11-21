// VØID_LOOM · ROSTRO — escena: una cabeza de laca negra en el vacío, luz que no se ve, un solo acento.
// La cara (ICT Face Model) se deforma en la gráfica: 53 expresiones mezcladas como morph targets, y encima
// el giro sobre el cuello, el temblor y lo que empuja bajo la piel. La piel lleva poros y arrugas
// procedurales que nacen con cada expresión (frente, entrecejo, patas de gallo, surco nasolabial).
import {
  WebGLRenderer, WebGLRenderTarget, HalfFloatType, Scene, Color, Mesh, PlaneGeometry, MeshBasicMaterial, DoubleSide, FrontSide, PMREMGenerator,
  PerspectiveCamera, SpotLight, MeshPhysicalMaterial, MeshStandardMaterial, MeshDepthMaterial, RGBADepthPacking, Vector2, Vector3, Vector4, Matrix3, Euler, Matrix4,
  AgXToneMapping, PCFSoftShadowMap,
  EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass,
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
uniform vec4 uBump[6]; uniform float uBumpA[6];
varying vec3 vObj;
float headW(vec3 p){ return smoothstep(-1.95, -0.85, p.y); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;
const VERT_NORMAL = `
#include <morphnormal_vertex>
{ float hw = headW(position); objectNormal = normalize(mix(objectNormal, uHeadR * objectNormal, hw)); }
`;
const VERT_POS = `
#include <morphtarget_vertex>
vObj = transformed;
{
  vec3 nn = normalize(normal);
  for (int b = 0; b < 6; b++) { vec3 d = transformed - uBump[b].xyz; transformed += nn * uBumpA[b] * exp(-dot(d, d) / (uBump[b].w * uBump[b].w)); }
  float fr = smoothstep(0.4, 1.6, position.z) * step(position.y, 3.0);
  transformed += nn * (hash3(floor(position * 9.0)) - 0.5) * sin(uTime * 53.0 + hash3(position) * 40.0) * uTremor * 0.012 * fr;
  float hw = headW(position);
  vec3 rp = uPivot + uHeadR * (transformed - uPivot) + vec3(0.0, 0.0, uThrust);
  transformed = mix(transformed, rp, hw);
}
`;
// --- piel: poros + arrugas que nacen con la expresión (bump procedural con derivadas de pantalla)
const FRAG_SKIN_HEAD = `
varying vec3 vObj; uniform vec4 uWrk; uniform vec4 uWrk2; uniform float uPore;
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

function inyectar(mat, U, piel) {
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = VERT_HEAD + s.vertexShader
      .replace('#include <morphnormal_vertex>', VERT_NORMAL)
      .replace('#include <morphtarget_vertex>', VERT_POS);
    if (piel) {
      s.fragmentShader = FRAG_SKIN_HEAD + s.fragmentShader
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturb(-vViewPosition, normal, skinH(vObj));');
    } else s.fragmentShader = 'varying vec3 vObj;\n' + s.fragmentShader;
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
  const bakeEnv = () => { const old = sc.environment; sc.environment = pm.fromScene(envS, 0.02).texture; if (old) old.dispose(); };
  bakeEnv();

  const cam = new PerspectiveCamera(26, 16 / 9, 0.1, 100);
  const key = new SpotLight(0xf2efe9, 80, 40, 0.3, 0.95, 1.6);
  key.position.set(-8.5, 7.5, 4.5); key.target.position.set(0, 1.4, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.camera.near = 4; key.shadow.camera.far = 22;
  const rimA = new SpotLight(accent, 160, 40, 0.5, 0.8, 1.5); rimA.position.set(7.5, 4.5, -7); rimA.target.position.set(0, 1.2, 0.5);
  const rimB = new SpotLight(accent, 60, 40, 0.5, 0.8, 1.5); rimB.position.set(-8, 1.5, -6); rimB.target.position.set(0, 1.0, 0.5);
  const sweep = new SpotLight(0xffffff, 0, 30, 0.16, 0.6, 1.4); sweep.position.set(0, 1.5, 9); sweep.target.position.set(0, 1.4, 1.5);
  sc.add(key, key.target, rimA, rimA.target, rimB, rimB.target, sweep, sweep.target);

  const cara = await cargarCara(base);
  const U = { uHeadR: { value: new Matrix3() }, uPivot: { value: PIVOT.clone() }, uThrust: { value: 0 }, uTremor: { value: 0 }, uTime: { value: 0 },
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

  // composición: MSAA real, recorte de brillos antes del bloom, viñeta y grano sutil
  const rt = new WebGLRenderTarget(16, 16, { type: HalfFloatType, samples: msaa });
  const comp = new EffectComposer(r, rt);
  comp.addPass(new RenderPass(sc, cam));
  comp.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: VS,
    fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 v;void main(){vec3 c=texture2D(tDiffuse,v).rgb;float m=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*min(1.,1.6/max(m,1e-4)),1.);}' }));
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.15, 0.6, 0.86); comp.addPass(bloom);
  const fin = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new Vector2(16, 9) }, uFade: { value: 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uT,uFade;uniform vec2 uRes;varying vec2 v;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uT)*43758.5453);}
    void main(){vec3 c=texture2D(tDiffuse,v).rgb;vec2 d=v-.5;d.x*=uRes.x/uRes.y;
    c*=smoothstep(1.05,.25,length(d));
    float l=dot(c,vec3(.299,.587,.114));c+=(h(v*uRes)-.5)*.016*(1.-l);
    gl_FragColor=vec4(max(c,0.)*uFade,1.);}`,
  });
  comp.addPass(fin); comp.addPass(new OutputPass());

  const v3 = (a) => new Vector3(...a), eul = new Euler(), m4 = new Matrix4(), anchorD = new Vector3(), w = new Float32Array(cara.nTargets);
  const restNose = new Vector3(cara.rest[NOSE * 3], cara.rest[NOSE * 3 + 1], cara.rest[NOSE * 3 + 2]);
  let curAcc = accentHex, W = 0, H = 0;
  return {
    renderer: r,
    tamano(wd, ht) {
      wd = Math.max(2, Math.round(wd)); ht = Math.max(2, Math.round(ht)); if (wd === W && ht === H) return;
      W = wd; H = ht; r.setSize(wd, ht, false); comp.setSize(wd, ht); cam.aspect = wd / ht; cam.updateProjectionMatrix(); fin.uniforms.uRes.value.set(wd, ht);
    },
    acento(hex) {
      if (hex === curAcc) return; curAcc = hex; accent.set(hex);
      rimA.color.copy(accent); rimB.color.copy(accent); accStrip.material.color.copy(accent).multiplyScalar(5); bakeEnv();
    },
    // ligera: sin sombras ni bloom, poros más suaves (para gráficas integradas)
    calidad(ligera) { key.castShadow = !ligera; bloom.enabled = !ligera; U.uPore.value = ligera ? 0.6 : 1; r.shadowMap.needsUpdate = true; },
    // c: controles (53 expresiones + cabeza); bumps: impulsos bajo la piel
    pose(c, t, bumps) {
      for (let k = 0; k < ARKIT.length; k++) { const v = c[ARKIT[k]] || 0; w[idx[k]] = v; mesh.morphTargetInfluences[idx[k]] = v; }
      eul.set(c.pitch || 0, c.yaw || 0, c.roll || 0, 'XYZ'); m4.makeRotationFromEuler(eul); U.uHeadR.value.setFromMatrix4(m4);
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
      const S = SHOTS[name] || SHOTS.medio; const p = v3(S.pos), l = v3(S.look);
      const dir = l.clone().sub(p).normalize(); const fol = S.follow ?? 0.6;
      p.addScaledVector(anchorD, fol); l.addScaledVector(anchorD, fol);
      cam.position.copy(p.addScaledVector(dir, S.drift * since)); cam.fov = S.fov; cam.updateProjectionMatrix(); cam.lookAt(l);
    },
    luz(rim, sw = 0, swx = 0, bri = 1) {
      rimA.intensity = 160 * rim * bri; rimB.intensity = 60 * rim * bri; key.intensity = 80 * bri;
      sweep.intensity = 900 * sw * bri; sweep.position.x = swx * 6; sweep.target.position.x = swx * 1.2;
    },
    render(t, fade = 1) { fin.uniforms.uT.value = t % 97; fin.uniforms.uFade.value = fade; comp.render(); },
  };
}
