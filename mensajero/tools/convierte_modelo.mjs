// Convierte el modelo oficial de NASA de la antena DSN de 70 m (glTF con Draco) a un binario propio y ligero
// para MENSAJERO: piezas con posiciones, normales e índices, agrupadas por eje (fijo / azimut / elevación).
// Uso: node convierte_modelo.mjs "<Deep Space Network 70-meter.glb>" ../modelo/dsn70.bin
// (necesita @gltf-transform/core, @gltf-transform/extensions y draco3dgltf)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(process.argv[2]);
const GRUPO = { base: 'fijo', azimuth: 'azimut', landing: 'azimut', rails: 'azimut', stairs: 'azimut' };
const MAT = { dish: 'panel', 'dish.001': 'panel', 'dish.002': 'panel', truss_dish: 'celosia', truss_box: 'celosia', truss_pendulum: 'celosia', quad: 'cuadripode', collector: 'receptor', base: 'hormigon', azimuth: 'estructura', landing: 'estructura', rails: 'baranda', stairs: 'baranda' };
const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
const piezas = []; const bufs = []; let off = 0;
function walk(n, M, grupo) {
  const name = n.getName(); const L = n.getMatrix();
  let g = GRUPO[name] || grupo;
  // el grupo de elevación guarda sus vértices relativos a su eje (0, 33.9, 0 en el sistema de azimut)
  const Mloc = name === 'elevation' ? [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] : mul(M, L);
  if (name === 'elevation') g = 'elevacion';
  const m = n.getMesh();
  if (m && MAT[name]) for (const p of m.listPrimitives()) {
    const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), I = p.getIndices();
    const pos = new Float32Array(P.getCount() * 3), nor = new Float32Array(P.getCount() * 3);
    const v = [0, 0, 0], w = [0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); const x = Mloc[0]*v[0]+Mloc[4]*v[1]+Mloc[8]*v[2]+Mloc[12], y = Mloc[1]*v[0]+Mloc[5]*v[1]+Mloc[9]*v[2]+Mloc[13], z = Mloc[2]*v[0]+Mloc[6]*v[1]+Mloc[10]*v[2]+Mloc[14]; pos.set([x, y, z], i * 3);
      N.getElement(i, w); const nx = Mloc[0]*w[0]+Mloc[4]*w[1]+Mloc[8]*w[2], ny = Mloc[1]*w[0]+Mloc[5]*w[1]+Mloc[9]*w[2], nz = Mloc[2]*w[0]+Mloc[6]*w[1]+Mloc[10]*w[2]; const l = Math.hypot(nx, ny, nz) || 1; nor.set([nx / l, ny / l, nz / l], i * 3); }
    const idx = new Uint32Array(I ? I.getArray() : [...Array(P.getCount()).keys()]);
    const ent = { nombre: name, grupo: g, mat: MAT[name], nv: P.getCount(), ni: idx.length, pos: off };
    bufs.push(Buffer.from(pos.buffer), Buffer.from(nor.buffer), Buffer.from(idx.buffer)); off += pos.byteLength + nor.byteLength + idx.byteLength;
    piezas.push(ent);
  }
  n.listChildren().forEach((c) => walk(c, Mloc, g));
}
for (const s of doc.getRoot().listScenes()) s.listChildren().forEach((n) => walk(n, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1], 'fijo'));
const head = Buffer.from(JSON.stringify({ fuente: 'NASA 3D Resources · Deep Space Network 70-meter (NASA/Brian E. Kumanchik)', ejeElevacion: [0, 33.9, 0], piezas }));
const pad = Buffer.alloc((4 - (head.length + 4) % 4) % 4, 32);
const len = Buffer.alloc(4); len.writeUInt32LE(head.length + pad.length);
fs.writeFileSync(process.argv[3], Buffer.concat([len, head, pad, ...bufs]));
console.log(piezas.length, 'piezas ·', (off / 1048576).toFixed(2), 'MB');
for (const p of piezas) console.log(' ', p.nombre, p.grupo, p.mat, p.nv, 'v');
