// VØID_LOOM · ROSTRO — carga la cara (ICT Face Model, MIT) con sus 53 expresiones ARKit como morph targets.
import { BufferGeometry, BufferAttribute, Float32BufferAttribute } from './vendor/three-rostro.js';

export async function cargarCara(base = './assets/') {
  const [hdr, buf] = await Promise.all([
    fetch(base + 'cara.json').then(r => r.json()),
    fetch(base + 'cara.bin').then(r => r.arrayBuffer()),
  ]);
  const N = hdr.nv;
  const g = new BufferGeometry();
  const pos = new Float32Array(buf, hdr.pos, N * 3), nrm = new Float32Array(buf, hdr.nrm, N * 3);
  g.setAttribute('position', new Float32BufferAttribute(pos.slice(), 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm.slice(), 3));
  g.setIndex(new BufferAttribute(new Uint16Array(buf, hdr.idx, hdr.ntri * 3).slice(), 1));
  for (const [start, count, m] of hdr.groups) g.addGroup(start, count, m);
  const mp = [], mn = [], names = {};
  hdr.targets.forEach((t, k) => {
    const I = new Uint16Array(buf, t.i, t.n), P = new Int16Array(buf, t.p, t.n * 3), Q = new Int8Array(buf, t.q, t.n * 3);
    const dp = new Float32Array(N * 3), dn = new Float32Array(N * 3);
    for (let j = 0; j < t.n; j++) { const v = I[j] * 3; for (let c = 0; c < 3; c++) { dp[v + c] = P[j * 3 + c] * t.sp; dn[v + c] = Q[j * 3 + c] * t.sn; } }
    mp.push(new Float32BufferAttribute(dp, 3)); mn.push(new Float32BufferAttribute(dn, 3)); names[t.name] = k;
  });
  g.morphAttributes.position = mp; g.morphAttributes.normal = mn; g.morphTargetsRelative = true;
  g.computeBoundingSphere(); g.boundingSphere.radius *= 1.5;
  return { geometry: g, names, nTargets: hdr.targets.length, N,
    // evaluador de un solo vértice en CPU (para que la cámara siga la cara)
    punto(i, w) { const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]; for (let k = 0; k < w.length; k++) { if (!w[k]) continue; const a = mp[k].array; p[0] += a[i * 3] * w[k]; p[1] += a[i * 3 + 1] * w[k]; p[2] += a[i * 3 + 2] * w[k]; } return p; },
    rest: pos,
  };
}
