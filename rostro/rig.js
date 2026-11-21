// VØID_LOOM · ROSTRO — rig. La cara se mueve con las 53 expresiones anatómicas del ICT Face Model
// (nombres de ARKit, separadas en _L y _R) más el giro de la cabeza sobre el cuello, el empuje y el temblor.
// Las emociones son mezclas de esas expresiones llevadas al límite: extremas, pero siempre una cara.

export const ARKIT = ['PupilDilate_L', 'PupilDilate_R', 'browDown_L', 'browDown_R', 'browInnerUp_L', 'browInnerUp_R', 'browOuterUp_L', 'browOuterUp_R',
  'cheekPuff_L', 'cheekPuff_R', 'cheekRaiser_L', 'cheekRaiser_R', 'cheekSquint_L', 'cheekSquint_R', 'eyeBlink_L', 'eyeBlink_R', 'eyeLookDown_L', 'eyeLookDown_R',
  'eyeLookIn_L', 'eyeLookIn_R', 'eyeLookOut_L', 'eyeLookOut_R', 'eyeLookUp_L', 'eyeLookUp_R', 'eyeSquint_L', 'eyeSquint_R', 'eyeWide_L', 'eyeWide_R',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight', 'mouthClose', 'mouthDimple_L', 'mouthDimple_R', 'mouthFrown_L', 'mouthFrown_R', 'mouthFunnel', 'mouthLeft',
  'mouthLowerDown_L', 'mouthLowerDown_R', 'mouthPress_L', 'mouthPress_R', 'mouthPucker', 'mouthRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower',
  'mouthShrugUpper', 'mouthSmile_L', 'mouthSmile_R', 'mouthStretch_L', 'mouthStretch_R', 'mouthUpperUp_L', 'mouthUpperUp_R', 'noseSneer_L', 'noseSneer_R'];
export const CABEZA = ['pitch', 'yaw', 'roll', 'thrust', 'tremor'];
export const CONTROLS = [...ARKIT, ...CABEZA];

// pose simétrica: { browInnerUp: 1 } → browInnerUp_L y _R; una clave con _L/_R se respeta tal cual
const sym = (o) => { const p = {}; for (const [k, v] of Object.entries(o)) { if (ARKIT.includes(k) || CABEZA.includes(k)) p[k] = v; else { p[k + '_L'] = v; p[k + '_R'] = v; } } return p; };

export const EMOCIONES = {
  REPOSO:    {},
  MIEDO:     sym({ browInnerUp: 1.05, browOuterUp: 0.75, eyeWide: 1.1, jawOpen: 0.32, mouthStretch: 1.0, mouthLowerDown: 0.55, mouthFrown: 0.35, noseSneer: 0.15, pitch: -0.14, thrust: -0.5, tremor: 0.6 }),
  FURIA:     sym({ browDown: 1.2, eyeSquint: 0.85, cheekSquint: 0.5, noseSneer: 1.1, mouthUpperUp: 0.95, mouthLowerDown: 0.45, jawOpen: 0.3, mouthStretch: 0.45, mouthFrown: 0.3, thrust: 0.6, pitch: 0.16, tremor: 1 }),
  DOLOR:     sym({ browInnerUp: 1.0, browDown: 0.6, eyeSquint: 1.0, eyeBlink: 0.55, cheekRaiser: 0.85, noseSneer: 0.7, mouthStretch: 1.05, mouthUpperUp: 0.6, jawOpen: 0.22, roll: 0.22, pitch: 0.12 }),
  ASCO:      Object.assign(sym({ mouthFrown: 0.6, mouthShrugLower: 0.85, eyeSquint: 0.55, browDown: 0.5, yaw: 0.38, pitch: -0.12, thrust: -0.3 }), { noseSneer_L: 1.25, noseSneer_R: 0.55, mouthUpperUp_L: 1.05, mouthUpperUp_R: 0.3, cheekSquint_L: 0.7 }),
  GRITO:     sym({ jawOpen: 1.25, mouthFunnel: 0.3, mouthStretch: 0.65, mouthUpperUp: 0.55, mouthLowerDown: 0.85, browInnerUp: 0.95, browOuterUp: 0.85, eyeWide: 1.05, noseSneer: 0.45, pitch: -0.32, thrust: 0.25 }),
  ANGUSTIA:  sym({ browInnerUp: 1.15, mouthFrown: 1.0, mouthStretch: 0.5, mouthRollLower: 0.4, jawOpen: 0.14, eyeBlink: 0.3, eyeLookDown: 0.6, pitch: 0.28, roll: -0.14 }),
  SORPRESA:  sym({ browInnerUp: 1.0, browOuterUp: 1.15, eyeWide: 1.15, jawOpen: 0.7, mouthFunnel: 0.45, pitch: -0.2, thrust: -0.3 }),
  TRISTEZA:  sym({ browInnerUp: 1.05, mouthFrown: 1.15, mouthShrugLower: 0.7, mouthRollLower: 0.3, eyeLookDown: 0.75, eyeBlink: 0.35, cheekRaiser: 0.2, pitch: 0.38 }),
  RISA:      sym({ mouthSmile: 1.25, cheekSquint: 1.0, cheekRaiser: 1.0, eyeSquint: 0.9, eyeBlink: 0.4, jawOpen: 0.45, mouthUpperUp: 0.4, mouthDimple: 0.6, noseSneer: 0.3, pitch: -0.28 }),
  DESPRECIO: Object.assign(sym({ eyeSquint: 0.3, yaw: -0.3, roll: 0.17, pitch: -0.24 }), { mouthSmile_R: 0.85, mouthDimple_R: 0.85, noseSneer_R: 0.45, mouthPress_L: 0.45, browDown_L: 0.35, eyeLookOut_R: 0.5, eyeLookIn_L: 0.5 }),
  'PÁNICO':  sym({ browInnerUp: 1.2, browOuterUp: 1.0, eyeWide: 1.25, jawOpen: 0.9, mouthStretch: 1.15, mouthLowerDown: 1.0, mouthUpperUp: 0.5, noseSneer: 0.5, thrust: -0.6, tremor: 1.2 }),
};

export function pose(name, mix = 1) {
  const e = EMOCIONES[name] || {}; const p = {}; for (const k of CONTROLS) p[k] = (e[k] || 0) * mix; return p;
}

// resumen de la cara para el sonido (apertura, anchura, cejas, giro…): el audio no necesita 53 números
export function macro(c) {
  const a = (k) => ((c[k + '_L'] || 0) + (c[k + '_R'] || 0)) / 2;
  return {
    jaw: c.jawOpen || 0,
    mouthWide: a('mouthStretch') + a('mouthSmile') * 0.6,
    brow: a('browInnerUp') * 0.5 + a('browOuterUp') * 0.5 - a('browDown'),
    skull: Math.max(0, a('eyeWide')) * 0.5,
    twist: c.yaw || 0, roll: c.roll || 0,
    melt: Math.max(0, a('mouthFrown') * 0.6 + (c.pitch > 0 ? c.pitch : 0)),
    snarl: a('noseSneer'),
  };
}
