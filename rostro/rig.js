// VØID_LOOM · ROSTRO — rig procedural de la cabeza.
// Deforma el escaneo en CPU a partir de la posición de reposo: cada control es
// una región con caída suave. Todo se calcula desde el reposo, así que nunca acumula error.

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const g2 = (dx, dy, rx, ry) => Math.exp(-((dx / rx) ** 2 + (dy / ry) ** 2));

// Puntos de referencia del escaneo (Lee Perry-Smith, Y arriba, Z hacia delante).
export const LM = {
  mouthY: 0.42, eyeY: 1.66, eyeX: 0.95, browY: 2.12, noseY: 1.1,
  hinge: [1.0, -0.35],      // bisagra de la mandíbula (y, z)
  neckPivot: [-1.5, -0.2],  // giro de la cabeza sobre el cuello (y, z)
};

export const CONTROLS = ['jaw', 'mouthWide', 'mouthDown', 'snarl', 'asym', 'brow', 'browInner', 'eyes',
  'skull', 'twist', 'cheeks', 'pitch', 'yaw', 'roll', 'thrust', 'melt', 'tremor', 'shake'];
// shake no deforma por sí mismo: el animador lo convierte en una mandíbula que tiembla (risa)

export function makeRig(pos, nrm) {
  const n = pos.length / 3;
  const W = {}; const mk = k => (W[k] = new Float32Array(n));
  ['jaw', 'cav', 'mouth', 'upLip', 'brow', 'browIn', 'eye', 'skull', 'cheek', 'head', 'twist', 'melt', 'front', 'forehead'].forEach(mk);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], ax = Math.abs(x);
    const front = ss(0.6, 1.7, z); W.front[i] = front;
    const face = ss(-0.2, 0.9, z);
    // mandíbula: bajo la línea de la boca, delante de la oreja; el cuello se estira
    W.jaw[i] = ss(LM.mouthY + 0.03, LM.mouthY - 0.09, y) * ss(-2.0, -0.85, y) * ss(-1.2, 0.1, z) * (1 - ss(2.0, 2.7, ax));
    { const wj0 = W.jaw[i]; W.cav[i] = 4 * wj0 * (1 - wj0) * Math.exp(-((x / 0.6) ** 2)) * front; }
    W.mouth[i] = g2(x, y - LM.mouthY, 1.25, 0.62) * face;
    W.upLip[i] = g2(x, y - 0.78, 0.85, 0.36) * front;
    W.brow[i] = g2(ax - 0.95, y - LM.browY, 0.85, 0.42) * face;
    W.browIn[i] = g2(ax - 0.42, y - 2.02, 0.45, 0.4) * face;
    W.eye[i] = g2(ax - LM.eyeX, y - LM.eyeY, 0.5, 0.33) * face;
    W.forehead[i] = g2(x, y - 2.75, 1.6, 0.5) * face;
    W.skull[i] = ss(1.9, 3.0, y);
    W.cheek[i] = g2(ax - 1.35, y - 0.85, 0.7, 0.75) * ss(0.0, 1.0, z);
    W.head[i] = ss(-1.85, -0.75, y);
    W.twist[i] = ss(-1.2, 3.8, y);
    W.melt[i] = ss(2.0, -0.7, y) * face * W.head[i];
  }
  const out = new Float32Array(pos.length);
  const occ = new Float32Array(n); // 1 = luz, 0 = cavidad negra
  const bumps = []; // impulsos bajo la piel: {x,y,z,r,a}

  function apply(c, t) {
    const jawA = Math.min(c.jaw, 1.15) * 0.5, jawDrop = Math.max(0, c.jaw - 1.15) * 1.3;
    const [hy, hz] = LM.hinge, [py, pz] = LM.neckPivot;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cr = Math.cos(c.roll), sr = Math.sin(c.roll);
    for (let i = 0; i < n; i++) {
      let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
      const sgn = x < 0 ? -1 : 1, asymF = 1 + c.asym * sgn;
      // --- capa local (sobre el reposo) ---
      let dx = 0, dy = 0, dz = 0;
      const wm = W.mouth[i];
      dx += x * c.mouthWide * 0.32 * wm;
      dy -= Math.abs(x) * c.mouthDown * 0.35 * wm;
      dy += c.snarl * 0.32 * W.upLip[i] * asymF; dz += c.snarl * 0.08 * W.upLip[i] * asymF;
      const wb = W.brow[i];
      if (c.brow > 0) dy += c.brow * 0.38 * wb;
      else { dy += c.brow * 0.3 * wb; dx += x * c.brow * 0.18 * wb; dz += -c.brow * 0.12 * wb; }
      dy += c.browInner * 0.32 * W.browIn[i];
      // arrugas de la frente al subir las cejas
      const fw = W.forehead[i] * Math.max(0, c.brow + c.browInner * 0.6);
      dz += Math.sin(y * 26) * 0.028 * fw;
      // ojos: positivo = cuencas que se hunden, negativo = aplastados
      const we = W.eye[i];
      if (c.eyes > 0) { dz -= c.eyes * 0.75 * we; dx -= nx * c.eyes * 0.08 * we; }
      else { dy += (LM.eyeY - y) * -c.eyes * 0.55 * we; dz -= c.eyes * 0.06 * we; }
      dx += nx * c.cheeks * 0.36 * W.cheek[i]; dz += nz * c.cheeks * 0.36 * W.cheek[i];
      // derretido: la cara cae, con un poco de goteo
      const wl = W.melt[i] * c.melt;
      dy -= wl * (0.75 + 0.25 * Math.sin(x * 3.1 + 1.7)); dz -= wl * 0.15;
      // impulsos bajo la piel (los dispara el sonido)
      for (let b = 0; b < bumps.length; b++) {
        const B = bumps[b]; const d2 = (x - B.x) ** 2 + (y - B.y) ** 2 + (z - B.z) ** 2;
        const k = B.a * Math.exp(-d2 / (B.r * B.r));
        dx += nx * k; dy += ny * k; dz += nz * k;
      }
      // temblor
      if (c.tremor > 0) {
        const q = Math.sin(i * 12.9898 + t * 61.0) * Math.sin(i * 78.233 + t * 47.0);
        const k = q * c.tremor * 0.012 * W.front[i];
        dx += nx * k; dy += ny * k; dz += nz * k;
      }
      // la boca se abre: el labio se hunde y deja una cavidad negra
      dz -= W.cav[i] * Math.min(c.jaw, 1.2) * 1.35;
      x += dx; y += dy; z += dz;
      // cráneo que se estira
      if (W.skull[i] > 0) y += (y - 1.9) * c.skull * 0.38 * W.skull[i];
      // mandíbula: gira sobre la bisagra y, si se pasa, se disloca
      const wj = W.jaw[i];
      if (wj > 0) {
        const a = jawA * wj, ry = y - hy, rz = z - hz, ca = Math.cos(a), sa = Math.sin(a);
        y = hy + ry * ca - rz * sa; z = hz + ry * sa + rz * ca;
        y -= jawDrop * wj;
      }
      // torsión: la cabeza se retuerce sobre su eje
      const tw = c.twist * 0.7 * W.twist[i];
      if (tw) { const ct = Math.cos(tw), st = Math.sin(tw), rz = z - 0.3; const nx2 = x * ct + rz * st; z = 0.3 - x * st + rz * ct; x = nx2; }
      // cabeza entera sobre el cuello
      const wh = W.head[i];
      if (wh > 0) {
        let ry = y - py, rz = z - pz, rx = x;
        // pitch (x), yaw (y), roll (z), mezclados por peso
        const ry1 = ry * cp - rz * sp, rz1 = ry * sp + rz * cp;
        const rx2 = rx * cy + rz1 * sy, rz2 = -rx * sy + rz1 * cy;
        const rx3 = rx2 * cr - ry1 * sr, ry3 = rx2 * sr + ry1 * cr;
        x = x + (rx3 - rx) * wh; y = y + (py + ry3 - y) * wh; z = z + (pz + rz2 + c.thrust * 0.9 - z) * wh;
      }
      occ[i] = Math.max(0, 1 - W.cav[i] * Math.min(c.jaw, 1.5) * 1.6 - W.eye[i] * Math.max(0, c.eyes) * 1.1);
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    return out;
  }
  return { apply, bumps, n, occ };
}

// Emociones: poses extremas, dentro de lo lógico pero al límite.
export const EMOCIONES = {
  REPOSO:   {},
  MIEDO:    { brow: 1, browInner: 0.9, eyes: 0.75, jaw: 0.75, mouthWide: 0.9, skull: 0.55, pitch: -0.22, thrust: -0.55, tremor: 0.7 },
  FURIA:    { brow: -1, eyes: -0.9, snarl: 1.3, jaw: 0.6, mouthWide: 0.7, cheeks: -0.35, thrust: 0.75, pitch: 0.18, skull: -0.35, tremor: 1 },
  DOLOR:    { twist: 0.55, browInner: 1.1, brow: 0.2, eyes: -0.65, mouthWide: 0.75, mouthDown: 1.1, roll: 0.28, melt: 0.15, asym: 0.6, jaw: 0.45 },
  ASCO:     { snarl: 1.2, asym: 1, yaw: 0.5, pitch: -0.15, eyes: -0.55, brow: -0.5, mouthDown: 0.6, cheeks: 0.25, roll: -0.12 },
  GRITO:    { jaw: 1.75, skull: 1.1, eyes: 1, brow: 1, browInner: 0.6, mouthWide: 1.1, pitch: -0.45, melt: 0.25, tremor: 0.5 },
  ANGUSTIA: { melt: 0.9, eyes: 0.5, jaw: 0.4, twist: -0.35, roll: -0.3, mouthDown: 0.8, browInner: 0.7, pitch: 0.25 },
  SORPRESA: { brow: 1.1, eyes: 0.45, jaw: 0.95, mouthWide: -0.2, skull: 0.45, pitch: -0.3, thrust: -0.3 },
  TRISTEZA: { browInner: 1.2, brow: -0.2, mouthDown: 1.2, eyes: 0.3, melt: 0.35, pitch: 0.4, roll: 0.15, cheeks: -0.2 },
  RISA:     { jaw: 0.6, mouthWide: 1.25, eyes: -0.8, cheeks: 0.55, snarl: 0.35, pitch: -0.35, shake: 1, brow: 0.3, asym: 0.25 },
  DESPRECIO:{ snarl: 0.8, asym: -1, mouthDown: 0.4, eyes: -0.35, pitch: -0.3, yaw: -0.35, roll: 0.2, brow: -0.25 },
  'PÁNICO': { brow: 1, browInner: 1, eyes: 1.05, jaw: 1.2, mouthWide: 1.2, skull: 0.8, twist: 0.25, tremor: 1.2, thrust: -0.8, cheeks: -0.5 },
};

export function pose(name, mix = 1) {
  const p = {}; for (const k of CONTROLS) p[k] = (EMOCIONES[name][k] || 0) * mix; return p;
}
