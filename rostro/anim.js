// VØID_LOOM · ROSTRO — animador. La partitura manda: cada evento de sonido es un gesto de la cabeza,
// y cada emoción tiene su propia manera de moverse (no solo su pose):
//   MIEDO     tiembla, retrocede, los ojos saltan de un lado a otro, parpadea poco
//   FURIA     sacude la cabeza, la nariz se dilata a golpes, embiste con el bombo
//   GRITO     sostiene la boca abierta con vibrato, la cabeza se va hacia atrás despacio
//   RISA      la mandíbula rebota, la cabeza cabecea al compás
//   TRISTEZA  sollozos lentos, la cabeza cae, mira al suelo
//   ANGUSTIA  respira hondo y tiembla la barbilla
//   PÁNICO    ojos y cabeza que buscan sin parar, jadeo
//   SORPRESA  se congela: no parpadea, el golpe la echa hacia atrás
//   DOLOR     se encoge en cada golpe (los ojos se aprietan, la boca se estira)
//   ASCO      se aparta y tuerce la nariz en cada golpe
//   DESPRECIO ladea la cabeza despacio, media sonrisa que va y viene
// Todo en pasos fijos y con azar sembrado: la consola y la salida calculan exactamente lo mismo.
import { CONTROLS, pose, macro } from './rig.js';

const LIM = { jawOpen: [0, 1.3], pitch: [-0.55, 0.55], yaw: [-0.7, 0.7], roll: [-0.5, 0.5], thrust: [-0.9, 0.9], tremor: [0, 1.4] };
const sm = u => u * u * (3 - 2 * u);
const BASE_RIM = { 'SEÑAL': 0.35, 'TENSIÓN': 0.75, 'RUPTURA': 1.1, 'ECO': 0.6 };
const S2 = (k) => [k + '_L', k + '_R'];

// respuesta al bombo según la emoción (velocidad que se suma a cada control)
const KICK = {
  REPOSO: { jawOpen: 2, pitch: 0.6 },
  MIEDO: { thrust: -3.5, jawOpen: 3, eyeWide_L: 4, eyeWide_R: 4, pitch: -1.2 },
  FURIA: { thrust: 4, jawOpen: 3.5, noseSneer_L: 5, noseSneer_R: 5, browDown_L: 3, browDown_R: 3, pitch: 1.2 },
  GRITO: { jawOpen: 4.5, thrust: 2, pitch: -1.5, mouthStretch_L: 3, mouthStretch_R: 3 },
  RISA: { jawOpen: 3, pitch: -1.8, cheekSquint_L: 3, cheekSquint_R: 3 },
  TRISTEZA: { pitch: 1.5, mouthFrown_L: 3, mouthFrown_R: 3, jawOpen: 1 },
  ANGUSTIA: { jawOpen: 1.5, browInnerUp_L: 3, browInnerUp_R: 3, pitch: 1 },
  'PÁNICO': { jawOpen: 4, thrust: -3, yaw: 2.5, eyeWide_L: 4, eyeWide_R: 4 },
  SORPRESA: { thrust: -4, browOuterUp_L: 4, browOuterUp_R: 4, jawOpen: 2.5, pitch: -1.5 },
  DOLOR: { eyeSquint_L: 6, eyeSquint_R: 6, mouthStretch_L: 5, mouthStretch_R: 5, cheekRaiser_L: 4, cheekRaiser_R: 4, pitch: 1.5, roll: 1 },
  ASCO: { thrust: -2.5, noseSneer_L: 6, mouthUpperUp_L: 4, yaw: 1.5 },
  DESPRECIO: { roll: 1, mouthSmile_R: 3, pitch: -0.8 },
  HORROR: { thrust: -4.5, eyeWide_L: 5, eyeWide_R: 5, jawOpen: 3.5, pitch: -2 },
  ODIO: { mouthPress_L: 5, mouthPress_R: 5, jawForward: 4, browDown_L: 4, browDown_R: 4, thrust: 2 },
  LOCURA: { roll: 2.5, mouthSmile_L: 5, eyeWide_L: 4, jawLeft: 3, yaw: 1.5 },
  'AGONÍA': { jawOpen: 5, mouthStretch_L: 5, mouthStretch_R: 5, eyeSquint_L: 5, eyeSquint_R: 5, roll: 2, pitch: -1.5 },
  'ÉXTASIS': { pitch: -2.5, jawOpen: 2.5, eyeLookUp_L: 3, eyeLookUp_R: 3 },
  'VERGÜENZA': { pitch: 2, yaw: 1.5, mouthPress_L: 3, mouthPress_R: 3 },
  'CONFUSIÓN': { roll: 2, browOuterUp_R: 3, mouthLeft: 3 },
  LLANTO: { jawOpen: 3, mouthFrown_L: 4, mouthFrown_R: 4, eyeSquint_L: 4, eyeSquint_R: 4, pitch: 1.5 },
  'SÚPLICA': { thrust: 3, browInnerUp_L: 4, browInnerUp_R: 4, pitch: -1.5 },
  'DESESPERACIÓN': { yaw: 3, jawOpen: 3, mouthStretch_L: 3, mouthStretch_R: 3 },
  'NÁUSEA': { pitch: 3, cheekPuff_L: 5, cheekPuff_R: 5, jawOpen: 2 },
  BURLA: { jawOpen: 2.5, mouthSmile_L: 4, roll: -1.5, pitch: -1 },
  SOSPECHA: { eyeSquint_L: 3, eyeSquint_R: 3, yaw: 1.2 },
  ARROGANCIA: { pitch: -1.5, thrust: -1.5 },
  AGOTAMIENTO: { pitch: 2.5, eyeBlink_L: 3, eyeBlink_R: 3 },
  'VÉRTIGO': { roll: 2.5, yaw: 2, eyeWide_L: 3, eyeWide_R: 3 },
};
// tirones (crujido/glitch): qué se descoloca de golpe en cada emoción
const TIRON = {
  REPOSO: ['yaw', 'roll'], MIEDO: ['yaw', 'eyeLookOut_L', 'eyeLookIn_R', 'pitch'], FURIA: ['yaw', 'roll', 'jawLeft', 'jawRight'],
  GRITO: ['roll', 'jawLeft', 'jawRight'], RISA: ['pitch', 'roll'], TRISTEZA: ['roll', 'pitch'], ANGUSTIA: ['roll', 'jawLeft'],
  'PÁNICO': ['yaw', 'pitch', 'eyeLookUp_L', 'eyeLookOut_R'], SORPRESA: ['pitch'], DOLOR: ['roll', 'yaw', 'jawRight'], ASCO: ['yaw', 'roll'], DESPRECIO: ['roll', 'yaw'],
  HORROR: ['pitch', 'roll'], ODIO: ['jawLeft', 'jawRight', 'roll'], LOCURA: ['roll', 'yaw', 'jawLeft', 'eyeLookOut_L', 'eyeLookUp_R', 'mouthSmile_L'],
  'AGONÍA': ['roll', 'yaw', 'jawRight'], 'ÉXTASIS': ['roll'], 'VERGÜENZA': ['yaw', 'eyeLookDown_L'], 'CONFUSIÓN': ['roll', 'eyeLookOut_R'],
  LLANTO: ['pitch', 'roll'], 'SÚPLICA': ['pitch'], 'DESESPERACIÓN': ['yaw', 'roll'], 'NÁUSEA': ['pitch'], BURLA: ['roll', 'pitch'],
  SOSPECHA: ['eyeLookOut_L', 'eyeLookIn_R', 'yaw'], ARROGANCIA: ['roll'], AGOTAMIENTO: ['pitch', 'roll'], 'VÉRTIGO': ['roll', 'yaw', 'eyeLookOut_L'],
};

export function crearAnimador(P, seed = 1, intensidad = 1) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ev = P.events; let ei = 0;
  const tImp = (ev.find(e => e.k === 'impact') || { t: 1e9 }).t;
  const x = {}, v = {}, off = {}; for (const k of CONTROLS) { x[k] = 0; v[k] = 0; off[k] = 0; }
  const bumps = []; let rimPulse = 0, bassEnv = 0, t = 0, sweep = 0, swx = 0, swDir = 1;
  const K = 150, D = 2 * 0.36 * Math.sqrt(K);
  const poseCache = new Map(); const P_ = (e, m) => { const k = e + m; if (!poseCache.has(k)) poseCache.set(k, pose(e, m)); return poseCache.get(k); };
  // estado de los gestos propios
  let sac = { t: 0, ex: 0, ey: 0, hy: 0, hp: 0 }, blink = { next: 2, until: -1 };

  // ESPEJO: un objetivo externo (la cara del visitante) que se mezcla con el arco de la pieza
  let ext = null, extW = 0, extEmo = null;
  function externo(c, w, emo) { ext = c; extW = c ? Math.max(0, Math.min(1, w)) : 0; extEmo = emo || null; }

  function emoAt(time) {
    const E = P.emotions; let i = 0; while (i < E.length - 2 && E[i + 1][0] <= time) i++;
    const [t0, e0, m0] = E[i], [t1, e1, m1] = E[i + 1];
    const u = t1 > t0 ? sm(Math.min(1, Math.max(0, (time - t0) / (t1 - t0)))) : 1;
    return { e0, m0, e1, m1, u };
  }
  function pesos(time) { // peso de cada emoción ahora mismo (arco de la pieza + espejo)
    const m = emoAt(time), w = {}; w[m.e0] = (w[m.e0] || 0) + m.m0 * (1 - m.u); w[m.e1] = (w[m.e1] || 0) + m.m1 * m.u;
    if (extEmo && extW > 0) { for (const k in w) w[k] *= 1 - extW; for (const [k, val] of Object.entries(extEmo)) w[k] = (w[k] || 0) + val * extW; }
    return w;
  }
  const act = time => { let a = P.acts[0][1]; for (const [ta, n] of P.acts) if (time >= ta) a = n; return a; };
  const add = (o, k, val) => { o[k] = (o[k] || 0) + val; };

  function disparar(e) {
    const vel = e.v * intensidad, sign = rnd() < 0.5 ? -1 : 1, rupt = act(e.t) === 'RUPTURA', W = pesos(e.t);
    if (e.k === 'kick') {
      const g = (e.ratchet ? 0.35 : 1) * (rupt ? 1.3 : 1);
      let tot = 0; for (const val of Object.values(W)) tot += val;
      const wR = Math.max(0, 1 - tot);
      for (const [emo, wt] of Object.entries({ ...W, REPOSO: (W.REPOSO || 0) + wR })) {
        const K2 = KICK[emo]; if (!K2 || wt <= 0) continue;
        for (const [k, a] of Object.entries(K2)) v[k] += a * wt * vel * g * (k === 'yaw' || k === 'roll' ? sign : 1);
      }
      rimPulse = Math.max(rimPulse, 0.45 * vel * (e.ratchet ? 0.35 : 1));
    } else if (e.k === 'metal') {
      const ang = (rnd() - 0.5) * 2.2, y = 0.2 + rnd() * 2.8;
      bumps.push({ x: Math.sin(ang) * 1.9, y, z: Math.cos(ang) * 1.9 + 0.2, r: 0.22 + rnd() * 0.22, a0: (0.1 + rnd() * 0.08) * vel * (rupt ? 1.4 : 1), t0: e.t });
    } else if (e.k === 'creak' || e.k === 'glitch') {
      let best = 'REPOSO', bw = 0; for (const [k, val] of Object.entries(W)) if (val > bw) { bw = val; best = k; }
      const pool = TIRON[best] || TIRON.REPOSO, k = pool[Math.floor(rnd() * pool.length)];
      const amp = k.startsWith('eye') || k.startsWith('jaw') ? 0.6 : 0.2;
      off[k] += (k.startsWith('eye') || k.startsWith('jaw') ? 1 : sign) * amp * vel * (rupt ? 1.4 : 1) * (e.k === 'glitch' ? 0.6 : 1);
    } else if (e.k === 'bass') bassEnv = Math.max(bassEnv, vel);
    else if (e.k === 'sweep') { sweep = 1; swDir = e.dir || 1; swx = -swDir; }
    else if (e.k === 'impact') {
      v.jawOpen += 6; v.thrust -= 4; v.pitch -= 2.5; for (const k of [...S2('eyeWide'), ...S2('browInnerUp'), ...S2('mouthStretch')]) v[k] += 5;
      rimPulse = 1; sweep = 1; swx = -1; swDir = 1;
      for (let i = 0; i < 3; i++) { const ang = (rnd() - 0.5) * 2; bumps.push({ x: Math.sin(ang) * 1.9, y: 0.5 + rnd() * 2.3, z: Math.cos(ang) * 1.9 + 0.2, r: 0.35, a0: 0.2, t0: e.t }); }
    }
  }

  // gestos propios de cada emoción: se suman al objetivo con el peso de esa emoción
  function gestos(tg, W, tt, dt) {
    const w = (k) => W[k] || 0, sn = Math.sin, PI2 = Math.PI * 2;
    // sacadas: ojos (y algo la cabeza) que saltan de un punto a otro
    const rate = (0.5 + 2.5 * w('MIEDO') + 5 * w('PÁNICO') + 0.8 * w('ASCO') + 4 * w('LOCURA') + 1.5 * w('CONFUSIÓN') + 0.6 * w('SOSPECHA')) * (1 - 0.85 * Math.min(1, w('HORROR') + w('ODIO') + w('ARROGANCIA') + w('ÉXTASIS')));
    if (tt >= sac.t) { sac.t = tt + (0.15 + rnd() * 0.6) / Math.max(0.3, rate); sac.ex = (rnd() - 0.5) * 2; sac.ey = (rnd() - 0.5) * 2; sac.hy = (rnd() - 0.5) * 2; sac.hp = (rnd() - 0.5) * 2; }
    const eyeA = 0.25 + 0.6 * (w('MIEDO') + w('PÁNICO')), headA = 0.04 + 0.16 * w('PÁNICO') + 0.06 * w('MIEDO');
    if (sac.ex > 0) { add(tg, 'eyeLookOut_L', sac.ex * eyeA); add(tg, 'eyeLookIn_R', sac.ex * eyeA); } else { add(tg, 'eyeLookIn_L', -sac.ex * eyeA); add(tg, 'eyeLookOut_R', -sac.ex * eyeA); }
    if (sac.ey > 0) { add(tg, 'eyeLookUp_L', sac.ey * eyeA * 0.7); add(tg, 'eyeLookUp_R', sac.ey * eyeA * 0.7); } else { add(tg, 'eyeLookDown_L', -sac.ey * eyeA * 0.7); add(tg, 'eyeLookDown_R', -sac.ey * eyeA * 0.7); }
    add(tg, 'yaw', sac.hy * headA); add(tg, 'pitch', sac.hp * headA * 0.6);
    // parpadeo: natural en calma, escaso con miedo o sorpresa, lento en la tristeza
    const freeze = w('SORPRESA') + w('MIEDO') * 0.6 + w('PÁNICO') * 0.4 + w('HORROR') * 1.5 + w('ODIO') * 1.2 + w('LOCURA') * 0.8;
    if (tt >= blink.next) { blink.until = tt + 0.11 + 0.12 * w('TRISTEZA'); blink.next = tt + (2 + rnd() * 3.5) * (1 + 3 * freeze); }
    if (tt < blink.until) { add(tg, 'eyeBlink_L', 1); add(tg, 'eyeBlink_R', 1); }
    // FURIA: sacudida de cabeza y aletas de la nariz que laten
    if (w('FURIA')) { add(tg, 'yaw', sn(tt * PI2 * 4.2) * 0.07 * w('FURIA')); const fl = Math.max(0, sn(tt * PI2 * 1.8)) * 0.4 * w('FURIA'); for (const k of S2('noseSneer')) add(tg, k, fl); }
    // RISA: mandíbula que rebota y cabeceo al compás
    if (w('RISA')) { const r6 = Math.abs(sn(tt * PI2 * 3.4)); add(tg, 'jawOpen', r6 * 0.35 * w('RISA')); add(tg, 'pitch', -r6 * 0.08 * w('RISA')); }
    // GRITO: vibrato en la mandíbula y la cabeza que se va hacia atrás
    if (w('GRITO')) { add(tg, 'jawOpen', sn(tt * PI2 * 9) * 0.04 * w('GRITO')); add(tg, 'pitch', -0.12 * sm(Math.min(1, (tt % 6) / 6)) * w('GRITO')); add(tg, 'tremor', 0.3 * w('GRITO')); }
    // TRISTEZA: sollozos (pequeñas sacudidas a ~1 Hz) y la cabeza que cae
    if (w('TRISTEZA')) { const so = Math.pow(Math.max(0, sn(tt * PI2 * 0.95)), 6); add(tg, 'pitch', so * 0.08 * w('TRISTEZA')); for (const k of S2('mouthFrown')) add(tg, k, so * 0.4 * w('TRISTEZA')); add(tg, 'jawOpen', so * 0.08 * w('TRISTEZA')); }
    // ANGUSTIA: respiración honda y barbilla que tiembla
    if (w('ANGUSTIA')) { const br = sn(tt * PI2 * 0.28); add(tg, 'jawOpen', (0.5 + 0.5 * br) * 0.18 * w('ANGUSTIA')); add(tg, 'pitch', -br * 0.05 * w('ANGUSTIA')); add(tg, 'mouthShrugLower', Math.abs(sn(tt * PI2 * 11)) * 0.25 * w('ANGUSTIA')); }
    // PÁNICO: jadeo
    if (w('PÁNICO')) add(tg, 'jawOpen', Math.max(0, sn(tt * PI2 * 2.6)) * 0.3 * w('PÁNICO'));
    // DESPRECIO: ladea despacio y la media sonrisa va y viene
    if (w('DESPRECIO')) { add(tg, 'roll', sn(tt * PI2 * 0.21) * 0.1 * w('DESPRECIO')); add(tg, 'mouthSmile_R', (0.5 + 0.5 * sn(tt * PI2 * 0.37)) * 0.35 * w('DESPRECIO')); }
    // MIEDO: retrocede poco a poco
    if (w('MIEDO')) add(tg, 'thrust', -0.15 * sm(Math.min(1, (tt % 8) / 8)) * w('MIEDO'));
    // HORROR: se congela y se va hacia atrás muy despacio, la mirada clavada
    if (w('HORROR')) { add(tg, 'thrust', -0.2 * sm(Math.min(1, (tt % 10) / 10)) * w('HORROR')); add(tg, 'pitch', -0.06 * sm(Math.min(1, (tt % 10) / 10)) * w('HORROR')); }
    // ODIO: la mandíbula apretada tiembla y la cabeza baja y avanza despacio
    if (w('ODIO')) { const cl = Math.abs(sn(tt * PI2 * 13)) * 0.25 * w('ODIO'); for (const k of S2('mouthPress')) add(tg, k, cl); add(tg, 'thrust', 0.15 * sm(Math.min(1, (tt % 7) / 7)) * w('ODIO')); }
    // LOCURA: la cabeza se balancea ladeada, tics y risitas a ráfagas
    if (w('LOCURA')) { add(tg, 'roll', sn(tt * PI2 * 0.35) * 0.2 * w('LOCURA')); const tic = Math.pow(Math.max(0, sn(tt * PI2 * 0.7 + sn(tt * 3.1) * 2)), 12); add(tg, 'mouthSmile_L', tic * 0.6 * w('LOCURA')); add(tg, 'eyeSquint_R', tic * 0.8 * w('LOCURA'));
      add(tg, 'jawOpen', Math.max(0, sn(tt * PI2 * 6)) * Math.pow(Math.max(0, sn(tt * PI2 * 0.23)), 4) * 0.35 * w('LOCURA')); }
    // AGONÍA: se retuerce despacio y convulsiona a intervalos
    if (w('AGONÍA')) { add(tg, 'roll', sn(tt * PI2 * 0.4) * 0.15 * w('AGONÍA')); add(tg, 'yaw', sn(tt * PI2 * 0.27 + 1) * 0.15 * w('AGONÍA')); const cv = Math.pow(Math.max(0, sn(tt * PI2 * 0.6)), 20); add(tg, 'jawOpen', cv * 0.4 * w('AGONÍA')); add(tg, 'tremor', cv * 1.2 * w('AGONÍA')); }
    // ÉXTASIS: la cabeza rueda hacia atrás, respiración honda, ojos en blanco
    if (w('ÉXTASIS')) { add(tg, 'roll', sn(tt * PI2 * 0.18) * 0.15 * w('ÉXTASIS')); add(tg, 'jawOpen', (0.5 + 0.5 * sn(tt * PI2 * 0.25)) * 0.2 * w('ÉXTASIS')); add(tg, 'pitch', -0.08 * (0.5 + 0.5 * sn(tt * PI2 * 0.25)) * w('ÉXTASIS')); }
    // VERGÜENZA: aparta la cara y de vez en cuando levanta la mirada un instante
    if (w('VERGÜENZA')) { const mira = Math.pow(Math.max(0, sn(tt * PI2 * 0.15)), 16); add(tg, 'pitch', -mira * 0.35 * w('VERGÜENZA')); for (const k of S2('eyeLookDown')) add(tg, k, -mira * 0.9 * w('VERGÜENZA')); }
    // CONFUSIÓN: ladea la cabeza de un lado a otro
    if (w('CONFUSIÓN')) add(tg, 'roll', -0.25 + sm(0.5 + 0.5 * sn(tt * PI2 * 0.2)) * 0.5 * w('CONFUSIÓN') - 0.25 * (w('CONFUSIÓN') - 1));
    // LLANTO: convulsiones de llanto, boca que se abre a bocanadas
    if (w('LLANTO')) { const so = Math.pow(Math.max(0, sn(tt * PI2 * 1.3)), 4); add(tg, 'jawOpen', so * 0.3 * w('LLANTO')); add(tg, 'pitch', so * 0.1 * w('LLANTO')); add(tg, 'tremor', so * 0.6 * w('LLANTO')); }
    // SÚPLICA: asiente hacia arriba despacio, los labios tiemblan
    if (w('SÚPLICA')) { add(tg, 'pitch', sn(tt * PI2 * 0.5) * 0.08 * w('SÚPLICA')); add(tg, 'mouthShrugLower', Math.abs(sn(tt * PI2 * 9)) * 0.25 * w('SÚPLICA')); }
    // DESESPERACIÓN: niega con la cabeza y jadea
    if (w('DESESPERACIÓN')) { add(tg, 'yaw', sn(tt * PI2 * 1.6) * 0.2 * w('DESESPERACIÓN')); add(tg, 'jawOpen', Math.max(0, sn(tt * PI2 * 2.2)) * 0.2 * w('DESESPERACIÓN')); }
    // NÁUSEA: arcadas a intervalos (la cabeza cae, las mejillas se hinchan)
    if (w('NÁUSEA')) { const ar = Math.pow(Math.max(0, sn(tt * PI2 * 0.45)), 14); add(tg, 'pitch', ar * 0.25 * w('NÁUSEA')); add(tg, 'jawOpen', ar * 0.45 * w('NÁUSEA')); for (const k of S2('cheekPuff')) add(tg, k, -ar * 0.6 * w('NÁUSEA')); add(tg, 'thrust', ar * 0.3 * w('NÁUSEA')); }
    // BURLA: risita a golpes y cabeceo de mofa
    if (w('BURLA')) { const ch = Math.max(0, sn(tt * PI2 * 5)) * Math.pow(Math.max(0, sn(tt * PI2 * 0.4)), 3); add(tg, 'jawOpen', ch * 0.25 * w('BURLA')); add(tg, 'pitch', -ch * 0.06 * w('BURLA')); }
    // SOSPECHA: mirada de reojo que va y viene, la cabeza la sigue un poco
    if (w('SOSPECHA')) { const ro = sn(tt * PI2 * 0.25); add(tg, 'yaw', ro * 0.12 * w('SOSPECHA')); if (ro > 0) { add(tg, 'eyeLookOut_L', ro * 0.5 * w('SOSPECHA')); add(tg, 'eyeLookIn_R', ro * 0.5 * w('SOSPECHA')); } else { add(tg, 'eyeLookIn_L', -ro * 0.5 * w('SOSPECHA')); add(tg, 'eyeLookOut_R', -ro * 0.5 * w('SOSPECHA')); } }
    // ARROGANCIA: casi inmóvil; la barbilla sube despacio
    if (w('ARROGANCIA')) add(tg, 'pitch', -0.08 * sm(0.5 + 0.5 * sn(tt * PI2 * 0.1)) * w('ARROGANCIA'));
    // AGOTAMIENTO: la cabeza se le cae y se levanta de golpe (se duerme)
    if (w('AGOTAMIENTO')) { const cae = (tt * 0.22) % 1; const d = cae < 0.85 ? sm(cae / 0.85) : 1 - sm((cae - 0.85) / 0.15); add(tg, 'pitch', d * 0.3 * w('AGOTAMIENTO')); for (const k of S2('eyeBlink')) add(tg, k, d * 0.4 * w('AGOTAMIENTO')); }
    // VÉRTIGO: la cabeza y los ojos describen círculos
    if (w('VÉRTIGO')) { add(tg, 'roll', sn(tt * PI2 * 0.5) * 0.18 * w('VÉRTIGO')); add(tg, 'yaw', Math.cos(tt * PI2 * 0.5) * 0.15 * w('VÉRTIGO')); const ex = sn(tt * PI2 * 0.9), ey = Math.cos(tt * PI2 * 0.9);
      if (ex > 0) { add(tg, 'eyeLookOut_L', ex * 0.6 * w('VÉRTIGO')); add(tg, 'eyeLookIn_R', ex * 0.6 * w('VÉRTIGO')); } else { add(tg, 'eyeLookIn_L', -ex * 0.6 * w('VÉRTIGO')); add(tg, 'eyeLookOut_R', -ex * 0.6 * w('VÉRTIGO')); }
      for (const k of S2(ey > 0 ? 'eyeLookUp' : 'eyeLookDown')) add(tg, k, Math.abs(ey) * 0.5 * w('VÉRTIGO')); }
  }

  let prevSum = 0, speed = 0;
  function avanzar(time, onEvent) {
    const dt = 1 / 240; let steps = 0;
    if (time - t > 2) t = time - 2;
    while (t < time) {
      while (ei < ev.length && ev[ei].t <= t) { const e = ev[ei++]; disparar(e); if (onEvent) onEvent(e); }
      const m = emoAt(t); const a0 = P_(m.e0, m.m0), a1 = P_(m.e1, m.m1);
      const tg = {}; for (const k of CONTROLS) tg[k] = a0[k] + (a1[k] - a0[k]) * m.u;
      if (ext && extW > 0) for (const k of CONTROLS) tg[k] += ((ext[k] || 0) - tg[k]) * extW;
      if ((steps & 3) === 0 || !avanzar.W) avanzar.W = pesos(t);
      gestos(tg, avanzar.W, t, dt);
      tg.jawOpen += 0.03 * Math.sin(t * 1.4) + 0.12 * bassEnv; tg.pitch += 0.012 * Math.sin(t * 0.9);  // respira; el bajo abre la boca
      for (const k of CONTROLS) {
        const a = K * (tg[k] + off[k] - x[k]) - D * v[k];
        v[k] += a * dt; x[k] += v[k] * dt; off[k] *= Math.exp(-dt / 0.09);
      }
      bassEnv *= Math.exp(-dt / 0.35); rimPulse *= Math.exp(-dt / 0.14);
      sweep *= Math.exp(-dt / 0.5); swx += swDir * dt * 2.6;
      t += dt; steps++;
    }
    for (let i = bumps.length - 1; i >= 0; i--) if (time - bumps[i].t0 > 0.9) bumps.splice(i, 1);
    const live = bumps.slice(-6).map(b => { const age = time - b.t0; return { x: b.x, y: b.y, z: b.z, r: b.r, a: b.a0 * Math.exp(-age / 0.16) * Math.min(1, Math.max(0, age) / 0.02) }; });
    // límites suaves: las expresiones admiten un poco de exceso (hasta 1,4) y la cabeza tiene tope
    const c = {}; let sum = 0;
    for (const k of CONTROLS) {
      const [lo, hi] = LIM[k] || [-0.1, 1.4]; const mid = (hi + lo) / 2, h = (hi - lo) / 2;
      c[k] = mid + h * Math.tanh((x[k] - mid) / h); sum += Math.abs(c[k]);
    }
    const dtF = Math.max(1e-3, steps / 240); speed += (Math.min(6, Math.abs(sum - prevSum) / dtF * 0.25) - speed) * 0.3; prevSum = sum;
    const emo = pesos(time), a = act(time);
    const preImpacto = time < tImp ? Math.min(1, Math.max(0, (time - (tImp - P.BAR)) / P.BAR)) : 0;
    return { c, m: macro(c), bumps: live, rim: BASE_RIM[a] + rimPulse * 0.9, sweep, swx: Math.max(-1, Math.min(1, swx)), act: a, emo, speed, preImpacto };
  }

  function plano(time) {
    let cur = P.shots[0]; for (const sh of P.shots) if (time >= sh[0]) cur = sh;
    return { name: cur[1], since: time - cur[0], at: cur[0] };
  }
  // golpe a mano (teclado): la cara salta a la emoción con su propio espasmo
  function golpe(emo, fuerza = 2.2) {
    const K2 = KICK[emo] || KICK.REPOSO, sign = rnd() < 0.5 ? -1 : 1;
    for (const [k, a] of Object.entries(K2)) v[k] += a * fuerza * (k === 'yaw' || k === 'roll' ? sign : 1);
    rimPulse = Math.max(rimPulse, 0.8);
  }
  return { avanzar, plano, externo, golpe };
}
