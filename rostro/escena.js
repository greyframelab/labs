// VØID_LOOM · ROSTRO — escena: cabeza de laca negra en el vacío, luz que no se ve, un solo acento.
import {
  WebGLRenderer, Scene, Color, Mesh, PlaneGeometry, MeshBasicMaterial, DoubleSide, PMREMGenerator,
  PerspectiveCamera, SpotLight, TextureLoader, MeshPhysicalMaterial, Vector2, Vector3, BufferAttribute,
  ACESFilmicToneMapping, PCFSoftShadowMap,
  GLTFLoader, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, mergeVertices, LoopSubdivision,
} from './vendor/three-rostro.js';
import { makeRig } from './rig.js';

export const SHOTS = {
  medio:  { pos: [0.6, 1.5, 12.5], look: [0, 1.25, 0], fov: 27, drift: 0.22 },
  macro:  { pos: [2.2, 1.9, 6.4], look: [0.4, 1.45, 1.6], fov: 24, drift: 0.12, follow: 0.9 },
  ojo:    { pos: [-2.2, 1.9, 7.2], look: [-0.7, 1.6, 1.7], fov: 24, drift: 0.1, follow: 0.85 },
  contra: { pos: [-2.5, -2.6, 11], look: [0, 1.6, 0], fov: 30, drift: 0.18 },
  perfil: { pos: [11.5, 1.2, 3.5], look: [0, 1.3, 0.6], fov: 26, drift: 0.2 },
  boca:   { pos: [1.4, 0.4, 8.2], look: [0, 0.5, 1.8], fov: 28, drift: 0.1, follow: 0.95 },
  cenit:  { pos: [0.8, 9.5, 6.5], look: [0, 1.2, 0.6], fov: 28, drift: 0.15 },
  lejos:  { pos: [0, 1.3, 15.5], look: [0, 1.2, 0], fov: 27, drift: -0.25 },
};

const VS = 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';

export async function crearEscena(canvas, accentHex, base = './assets/') {
  const r = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.toneMapping = ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = PCFSoftShadowMap;
  const sc = new Scene(); sc.background = new Color(0);
  const accent = new Color(accentHex);

  // Entorno: estudio negro con tiras de luz (reflejos en líneas, nunca un gris general)
  const envS = new Scene(); envS.background = new Color(0);
  const strip = (w, h, x, y, z, col, k) => { const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(col).multiplyScalar(k), side: DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); return m; };
  strip(3.2, 7, -6.5, 3, 6, 0xffffff, 2.0);
  strip(0.22, 9, -4, 2, 7, 0xffffff, 4);
  strip(9, 0.2, 0, 7, 3, 0xffffff, 2);
  const accStrip = strip(0.25, 8, 7, 1, -4, accent, 5);
  const pm = new PMREMGenerator(r);
  const bakeEnv = () => { const old = sc.environment; sc.environment = pm.fromScene(envS, 0.02).texture; if (old) old.dispose(); };
  bakeEnv();

  const cam = new PerspectiveCamera(27, 16 / 9, 0.1, 100);
  const key = new SpotLight(0xf2efe9, 75, 40, 0.3, 0.95, 1.6);
  key.position.set(-8.5, 7.5, 4.5); key.target.position.set(0, 1.4, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const rimA = new SpotLight(accent, 160, 40, 0.5, 0.8, 1.5); rimA.position.set(7.5, 4.5, -7); rimA.target.position.set(0, 1.2, 0.5);
  const rimB = new SpotLight(accent, 60, 40, 0.5, 0.8, 1.5); rimB.position.set(-8, 1.5, -6); rimB.target.position.set(0, 1.0, 0.5);
  // BARRIDO: un plano de luz blanca que recorre la cara con los golpes de la ruptura
  const sweep = new SpotLight(0xffffff, 0, 30, 0.16, 0.6, 1.4); sweep.position.set(0, 1.5, 9); sweep.target.position.set(0, 1.4, 1.5);
  sc.add(key, key.target, rimA, rimA.target, rimB, rimB.target, sweep, sweep.target);

  const tl = new TextureLoader();
  const [nmap, smap, gltf] = await Promise.all([tl.loadAsync(base + 'Infinite-Level_02_Tangent_SmoothUV.jpg'), tl.loadAsync(base + 'Map-SPEC.jpg'), new GLTFLoader().loadAsync(base + 'LeePerrySmith.glb')]);
  const mesh = gltf.scene.children[0];
  mesh.material = new MeshPhysicalMaterial({
    color: 0x020202, roughness: 0.36, side: DoubleSide, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.13, normalMap: nmap, normalScale: new Vector2(1.1, 1.1),
    specularIntensity: 1, specularIntensityMap: smap, envMapIntensity: 1,
  });
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.material.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('void main() {', 'attribute float aOcc; varying float vOcc;\nvoid main() { vOcc = aOcc;');
    s.fragmentShader = s.fragmentShader.replace('void main() {', 'varying float vOcc;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= vOcc * vOcc;');
  };
  let geo = LoopSubdivision.modify(mesh.geometry, 1, { split: false, uvSmooth: false });
  geo.deleteAttribute('normal'); geo = mergeVertices(geo, 1e-5); geo.computeVertexNormals(); mesh.geometry = geo;
  geo.setAttribute('aOcc', new BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1));
  sc.add(mesh);
  const rig = makeRig(geo.attributes.position.array.slice(), geo.attributes.normal.array.slice());
  // ancla: la punta de la nariz; la cámara la sigue como un operador
  const PA = geo.attributes.position.array; let ai = 0, best = 1e9;
  for (let i = 0; i < PA.length / 3; i++) { const d = PA[i * 3] ** 2 + (PA[i * 3 + 1] - 1.0) ** 2 + (PA[i * 3 + 2] - 2.6) ** 2; if (d < best) { best = d; ai = i; } }
  const anchorRest = new Vector3(PA[ai * 3], PA[ai * 3 + 1], PA[ai * 3 + 2]), anchorD = new Vector3();

  const comp = new EffectComposer(r);
  comp.addPass(new RenderPass(sc, cam));
  comp.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: VS,
    fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 v;void main(){vec3 c=texture2D(tDiffuse,v).rgb;float m=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*min(1.,1.6/max(m,1e-4)),1.);}' }));
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.16, 0.7, 0.85); comp.addPass(bloom);
  const fin = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new Vector2(16, 9) }, uFade: { value: 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uT,uFade;uniform vec2 uRes;varying vec2 v;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uT)*43758.5453);}
    void main(){vec3 c=texture2D(tDiffuse,v).rgb;vec2 d=v-.5;d.x*=uRes.x/uRes.y;
    c*=smoothstep(1.05,.25,length(d));
    float l=dot(c,vec3(.299,.587,.114));c+=(h(v*uRes)-.5)*.02*(1.-l);
    gl_FragColor=vec4(max(c,0.)*uFade,1.);}`,
  });
  comp.addPass(fin); comp.addPass(new OutputPass());

  const v3 = (a) => new Vector3(...a);
  let curAcc = accentHex, W = 0, H = 0, light = 1;
  const api = {
    rig, renderer: r,
    tamano(w, h) {
      w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (w === W && h === H) return;
      W = w; H = h; r.setSize(w, h, false); comp.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
      fin.uniforms.uRes.value.set(w, h);
    },
    acento(hex) {
      if (hex === curAcc) return; curAcc = hex; accent.set(hex);
      rimA.color.copy(accent); rimB.color.copy(accent); accStrip.material.color.copy(accent).multiplyScalar(5); bakeEnv();
    },
    calidad(ligera) { light = ligera ? 1 : 0; key.castShadow = !ligera; bloom.enabled = !ligera; mesh.material.needsUpdate = true; },
    pose(c, t, bumps) {
      rig.bumps.length = 0; if (bumps) rig.bumps.push(...bumps);
      const out = rig.apply(c, t);
      geo.attributes.position.array.set(out); geo.attributes.position.needsUpdate = true;
      geo.attributes.aOcc.array.set(rig.occ); geo.attributes.aOcc.needsUpdate = true;
      geo.computeVertexNormals();
      anchorD.set(out[ai * 3], out[ai * 3 + 1], out[ai * 3 + 2]).sub(anchorRest);
    },
    camara(name, since) {
      const S = SHOTS[name] || SHOTS.medio; const p = v3(S.pos), l = v3(S.look);
      const dir = l.clone().sub(p).normalize(); const fol = S.follow ?? 0.6;
      p.addScaledVector(anchorD, fol); l.addScaledVector(anchorD, fol);
      cam.position.copy(p.addScaledVector(dir, S.drift * since)); cam.fov = S.fov; cam.updateProjectionMatrix(); cam.lookAt(l);
    },
    // rim: contraluz del acento · sw: barrido (0..1) y su posición (-1..1) · bri: brillo de sala
    luz(rim, sw = 0, swx = 0, bri = 1) {
      rimA.intensity = 160 * rim * bri; rimB.intensity = 60 * rim * bri; key.intensity = 75 * bri;
      sweep.intensity = 900 * sw * bri; sweep.position.x = swx * 6; sweep.target.position.x = swx * 1.2;
    },
    render(t, fade = 1) { fin.uniforms.uT.value = t % 97; fin.uniforms.uFade.value = fade; comp.render(); },
  };
  return api;
}
