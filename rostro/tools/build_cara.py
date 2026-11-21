"""VØID_LOOM · ROSTRO — convierte el ICT Face Model (ICT-FaceKit, MIT) al formato ligero de la app.

Fuente: https://github.com/ICT-VGL/ICT-FaceKit (carpeta FaceXModel). No va en el repo (167 MB de OBJ).
Uso:  python3 rostro/tools/build_cara.py RUTA/FaceXModel rostro/assets

Salida: cara.json (cabecera) + cara.bin
  · cara neutra (posición y normal, float32), triángulos (uint16), grupos por material
  · 53 expresiones ARKit como deltas dispersos: índices uint16, posición int16 y normal int8 cuantizadas
Se queda con piel (cara + cabeza y cuello), interior de la boca, cuencas, encías y lengua, dientes y globos
oculares; descarta lagrimal, pestañas y mallas de oclusión (transparencias que no aportan en laca negra).
La escala y el origen se ajustan a los planos de la escena (ojos en y≈1,66, nariz hacia +z).
"""
import json, sys, os, glob
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
S, OFF = 0.194, np.array([0, 0.96, 0])

# (nombre, material, rango de polígonos [a, b] inclusivo) según el README de ICT-FaceKit
PARTS = [('piel', 0, 0, 9229), ('piel', 0, 9230, 11143),
         ('interior', 1, 11144, 13225), ('interior', 1, 13226, 13629), ('interior', 1, 13630, 14033), ('interior', 1, 14034, 17005),
         ('dientes', 2, 17006, 21495), ('ojos', 3, 21496, 23093), ('ojos', 3, 23094, 24691)]
NV = 24591  # vértices 0..24590 (hasta los globos oculares)

def read_v(path):
    with open(path) as f:
        return np.array([l.split()[1:4] for l in f if l.startswith('v ')], np.float64)

def read_f(path):
    F = []
    with open(path) as f:
        for l in f:
            if l.startswith('f '):
                F.append([int(t.split('/')[0]) - 1 for t in l.split()[1:]])
    return F

V0 = read_v(os.path.join(SRC, 'generic_neutral_mesh.obj'))
F = read_f(os.path.join(SRC, 'generic_neutral_mesh.obj'))
tris, mats = [], []
for _, m, a, b in PARTS:
    for poly in F[a:b + 1]:
        for k in range(1, len(poly) - 1):
            tris.append((poly[0], poly[k], poly[k + 1])); mats.append(m)
tris = np.array(tris, np.int64); mats = np.array(mats)
assert tris.max() < NV
order = np.argsort(mats, kind='stable'); tris, mats = tris[order], mats[order]
groups = []
for m in range(4):
    idx = np.where(mats == m)[0]
    groups.append([int(idx[0]) * 3, int(len(idx)) * 3, m])

def tf(P): return (P[:NV] * S + OFF).astype(np.float64)

# soldadura de normales: vértices en la misma posición comparten normal (sin costuras entre piezas)
P0 = tf(V0)
key = np.round(P0 * 2e4).astype(np.int64)
_, weld = np.unique(key, axis=0, return_inverse=True); weld = weld.ravel()

def normals(P):
    a, b, c = P[tris[:, 0]], P[tris[:, 1]], P[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    N = np.zeros_like(P)
    for k in range(3): np.add.at(N, tris[:, k], fn)
    W = np.zeros((weld.max() + 1, 3)); np.add.at(W, weld, N); N = W[weld]
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

N0 = normals(P0)
names = sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(SRC, '*.obj'))
               if not os.path.basename(p).startswith(('generic', 'identity')))
blocks, meta = [], []
def add(arr):
    off = sum(len(b) for b in blocks)
    pad = (-off) % 4
    if pad: blocks.append(b'\0' * pad); off += pad
    blocks.append(arr.tobytes()); return off

hdr = {'nv': NV, 'ntri': int(len(tris)), 'groups': groups, 'escala': S, 'offset': OFF.tolist(),
       'fuente': 'ICT-FaceKit (USC ICT), MIT', 'targets': []}
hdr['pos'] = add(P0.astype(np.float32)); hdr['nrm'] = add(N0.astype(np.float32))
hdr['idx'] = add(tris.astype(np.uint16).ravel())
for nm in names:
    P = tf(read_v(os.path.join(SRC, nm + '.obj')))
    dP = P - P0; dN = normals(P) - N0
    moving = np.where((np.abs(dP).max(1) > 2e-5) | (np.abs(dN).max(1) > 2e-3))[0]
    sp = float(np.abs(dP[moving]).max() or 1e-9); sn = float(np.abs(dN[moving]).max() or 1e-9)
    t = {'name': nm, 'n': int(len(moving)), 'sp': sp / 32767, 'sn': sn / 127}
    t['i'] = add(moving.astype(np.uint16))
    t['p'] = add(np.round(dP[moving] / sp * 32767).astype(np.int16).ravel())
    t['q'] = add(np.round(dN[moving] / sn * 127).astype(np.int8).ravel())
    hdr['targets'].append(t)
    print(f'{nm:18s} {len(moving):6d} vértices  máx {sp:.3f}')
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'cara.bin'), 'wb') as f: f.write(b''.join(blocks))
with open(os.path.join(OUT, 'cara.json'), 'w') as f: json.dump(hdr, f)
print('triángulos', len(tris), 'MB', round(sum(len(b) for b in blocks) / 1e6, 2))
