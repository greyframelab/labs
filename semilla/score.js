/* VØID_LOOM · SEMILLA — partitura generativa.
   Una semilla decide la pieza entera: especie visual, referencia IDM, tempo, tono y cada golpe.
   Imagen y sonido leen esta misma partitura, así que van siempre a tiempo.
   Todo depende solo de (semilla, mandos, t): se puede saltar, repetir e ir hacia atrás. */
(function () {
  const ACCENTS = {
    rojo: '#FF1A1A', cian: '#00E5FF', ambar: '#FFB000', verde: '#39FF6A',
    violeta: '#8A2BFF', magenta: '#FF2BD6', blanco: '#F2F0EA',
  };
  const ACCENT_NAMES = { paleta: 'PALETA', rojo: 'ROJO', cian: 'CIAN', ambar: 'ÁMBAR', verde: 'VERDE', violeta: 'VIOLETA', magenta: 'MAGENTA', blanco: 'BLANCO' };

  // fondo siempre negro: la oscuridad de VØID_LOOM; el color es un evento (un solo acento)
  const PALETTES = {
    vacio: { name: 'VACÍO', ground: '#000000', ink: ['#F2F0EA', '#8F8C86', '#3A3835'], acc: null, dark: 1 },
    carbon: { name: 'CARBÓN', ground: '#030303', ink: ['#F2F0EA', '#2B2B2B', '#5A5856'], acc: null, dark: 1 },
  };
  // FORMAS: una familia infinita de materia negra; la semilla elige forma, material, luces y encuadre
  const SPECIES = [
    { id: 'masa', form: 0, name: 'MASA', idea: 'cuerpos negros que se funden y se separan', acc: ['rojo', 'violeta', 'ambar'], w: 3 },
    { id: 'torsion', form: 1, name: 'TORSIÓN', idea: 'un monolito que se retuerce sobre sí mismo', acc: ['rojo', 'cian', 'blanco'], w: 3 },
    { id: 'concha', form: 2, name: 'CONCHA', idea: 'una cáscara calada por una superficie mínima', acc: ['ambar', 'cian', 'violeta'], w: 3 },
    { id: 'pliegue', form: 3, name: 'PLIEGUE', idea: 'una lámina de materia que se dobla como un pensamiento', acc: ['blanco', 'cian', 'magenta'], w: 2 },
    { id: 'columnas', form: 4, name: 'COLUMNAS', idea: 'una arquitectura que respira con el pulso', acc: ['ambar', 'verde', 'rojo'], w: 2 },
    { id: 'fractura', form: 5, name: 'FRACTURA', idea: 'un bloque que se abre en lonchas en la ruptura', acc: ['rojo', 'magenta', 'ambar'], w: 3 },
    { id: 'espina', form: 6, name: 'ESPINA', idea: 'un cuerpo erizado que se defiende de la luz', acc: ['rojo', 'verde', 'violeta'], w: 2 },
    { id: 'monolito', form: 7, name: 'MONOLITO', idea: 'una losa en el vacío y una luz que la recorre', acc: ['blanco', 'rojo', 'cian'], w: 2 },
  ];
  SPECIES.forEach((s) => { s.bloom = 0.26; s.pals = ['vacio', 'carbon']; });
  const SP_W = SPECIES.reduce((a, s) => a + s.w, 0);
  const pickSpecies = (r) => { let x = r * SP_W; for (const s of SPECIES) { x -= s.w; if (x < 0) return s; } return SPECIES[0]; };
  const MATS = ['LACA', 'OBSIDIANA', 'CROMO', 'TERCIOPELO'], RIGS = ['TIRAS', 'ARO', 'BARRIDO', 'CONTRALUZ'];

  // una referencia manda en cada pieza: decide ritmo, espacio y gesto
  const REFS = {
    autechre: { name: 'AUTECHRE', bpm: [86, 102], swing: 0.0, kick: 'euclid', verb: 0.10, room: 1.3, ratchet: 0.35, stutter: 0.35, metalDecay: 0.32, tickRes: 16, bass: 'sparse', wow: 0 },
    orphx: { name: 'ORPHX', bpm: [122, 130], swing: 0.0, kick: 'four', verb: 0.13, room: 1.8, ratchet: 0.15, stutter: 0.15, metalDecay: 0.5, tickRes: 16, bass: 'offbeat', wow: 0 },
    lanark: { name: 'LANARK ARTEFAX', bpm: [68, 78], swing: 0.03, kick: 'sparse', verb: 0.24, room: 3.0, ratchet: 0.5, stutter: 0.25, metalDecay: 1.1, tickRes: 32, bass: 'long', wow: 0 },
    squarepusher: { name: 'SQUAREPUSHER', bpm: [136, 150], swing: 0.0, kick: 'broken', verb: 0.08, room: 1.0, ratchet: 0.6, stutter: 0.4, metalDecay: 0.24, tickRes: 32, bass: 'lead', wow: 0 },
    phoenicia: { name: 'PHOENICIA', bpm: [96, 108], swing: 0.14, kick: 'groove', verb: 0.10, room: 1.2, ratchet: 0.3, stutter: 0.6, metalDecay: 0.3, tickRes: 16, bass: 'sparse', wow: 0 },
    boc: { name: 'BOARDS OF CANADA', bpm: [80, 90], swing: 0.09, kick: 'simple', verb: 0.2, room: 2.2, ratchet: 0.1, stutter: 0.1, metalDecay: 0.6, tickRes: 16, bass: 'long', wow: 1 },
  };

  const ACTS = [[0, 'SEÑAL'], [4, 'TENSIÓN'], [8, 'RUPTURA'], [12, 'ECO']]; // en compases
  const NOTE = ['DO', 'DO#', 'RE', 'MI♭', 'MI', 'FA', 'FA#', 'SOL', 'LA♭', 'LA', 'SI♭', 'SI'];
  const BARS = 16;
  // energía por compás: crece, rompe en el 8 y vuelve al estado del principio (bucle sin costura)
  const ENERGY = [0.12, 0.2, 0.28, 0.38, 0.48, 0.58, 0.68, 0.8, 1, 0.96, 1, 0.92, 0.7, 0.5, 0.32, 0.16];
  const ABC = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  // ---------- azar determinista ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // azar por (semilla, voz, compás, paso): cambiar un mando no reordena el resto de la pieza
  function h4(s, a, b, c) {
    let h = Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 1, 0xc2b2ae35) ^ Math.imul(b + 7, 0x27d4eb2f) ^ Math.imul(c + 13, 0x165667b1);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function newCode() {
    const b = new Uint32Array(6);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 1e9));
    let s = ''; for (let i = 0; i < 6; i++) s += ABC[b[i] % ABC.length];
    return s;
  }
  function cleanCode(s) {
    return String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/I/g, '1').replace(/O/g, '0').slice(0, 10);
  }
  const euclid = (k, n, i) => (((i % n) + n) % n * k) % n < k;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // plantillas de bombo escritas (no azar): el ritmo manda y el detalle va encima
  const KICK_T = {
    four: [[0, 4, 8, 12]],
    sparse: [[0], [0, 11], [0], [0, 10]],
    broken: [[0, 3, 6, 10, 11], [0, 7, 10, 13], [0, 2, 8, 11, 14], [0, 5, 9, 12, 15]],
    groove: [[0, 6, 10], [0, 3, 8, 11, 14]],
    simple: [[0, 6, 8], [0, 8, 11]],
  };

  // ---------- generar una pieza ----------
  function generate(code, opts = {}) {
    code = cleanCode(code) || '000000';
    const density = clamp((opts.force && opts.force.density) ?? opts.density ?? 0.5), chaos = clamp((opts.force && opts.force.chaos) ?? opts.chaos ?? 0.5);
    const S = hashStr(code), R = mulberry(S);
    const F = opts.force || {};
    let sp = pickSpecies(R()); if (F.form) sp = SPECIES.find((s) => s.id === F.form) || sp;
    const refIds = Object.keys(REFS); let refId = refIds[Math.floor(R() * refIds.length)]; if (F.ref && REFS[F.ref]) refId = F.ref; const ref = REFS[refId];
    const bpm = Math.round(ref.bpm[0] + R() * (ref.bpm[1] - ref.bpm[0]));
    const roots = [28, 29, 30, 31, 33, 34, 35];
    const root = roots[Math.floor(R() * roots.length)];
    let accAuto = sp.acc[Math.floor(R() * sp.acc.length)]; if (F.accent && ACCENTS[F.accent]) accAuto = F.accent;
    const palId = sp.pals[Math.floor(R() * sp.pals.length)], pal = PALETTES[palId];
    const manualAcc = opts.accent && opts.accent !== 'auto' && ACCENTS[opts.accent];
    const accentKey = manualAcc ? opts.accent : pal.acc ? 'paleta' : accAuto;
    const accent = manualAcc ? ACCENTS[opts.accent] : pal.acc || ACCENTS[accAuto];
    const lum = ((h) => { const n = parseInt(h.slice(1), 16); return (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; })(pal.ground);
    const look = pal.dark ? { bloom: sp.bloom, tone: 0, vig: 0.6, grain: 0.8 } : { bloom: lum > 0.45 ? 0.04 : 0.08, tone: 1, vig: 0.22, grain: 1 };
    const vis = {
      v: Array.from({ length: 8 }, R),
      zoom: 0.8 + R() * 0.7, rot: (R() - 0.5) * 1.2,
      off: [(R() - 0.5) * 0.5, (R() - 0.5) * 0.3],
      mask: Math.floor(R() * 4), variant: Math.floor(R() * 4),
      mat: Math.floor(R() * 4), rig: Math.floor(R() * 4),
    };
    if (F.mat != null) vis.mat = F.mat; if (F.rig != null) vis.rig = F.rig;
    const kickK = 3 + Math.floor(R() * 3), tickK = 7 + Math.floor(R() * 6);
    const tickN = [16, 12, 14, 18, 10][Math.floor(R() * 5)];
    const metalN = [5, 7, 9, 11, 13, 20][Math.floor(R() * 6)], metalK = 2 + Math.floor(R() * 2);
    const rotBase = Math.floor(R() * 16), bassRot = Math.floor(R() * 16);
    const metalBase = 150 + R() * 210; // altura base del metal (Hz), por debajo de 1,5 kHz con sus parciales
    const droneShape = R(), roomSeed = Math.floor(R() * 1000);

    const beat = 60 / bpm, bar = beat * 4, step = bar / 16, L = bar * BARS;
    const E = ENERGY.map((e) => clamp(e * (0.62 + 0.76 * density)));
    const ev = { kick: [], tick: [], metal: [], bass: [], impact: [] };
    const add = (voice, bi, s, v, p = 0, d = 0, off = 0) => {
      let t = bi * bar + s * step + off;
      if (s % 2 === 1 && Math.floor(s) === s) t += ref.swing * step;
      if (voice !== 'kick' && voice !== 'impact') t += (h4(S, 90 + voice.length, bi, s * 7) - 0.5) * 0.006 * (0.4 + chaos);
      ev[voice].push({ t: Math.max(0, t), v, p, d });
    };

    for (let b = 0; b < BARS; b++) {
      const e = E[b], sec = b >> 2, phraseEnd = b % 4 === 3;
      // --- bombo: entra en la TENSIÓN (antes, según la referencia) y se va en el ECO
      const kickOn = refId === 'orphx' ? b >= 2 && b <= 14 : b >= 3 && b <= 14 && ENERGY[b] > 0.3;
      if (kickOn) {
        let steps;
        if (ref.kick === 'euclid') {
          const rot = (rotBase + Math.floor(b / 2) * Math.round(1 + chaos * 3)) % 16;
          steps = []; for (let s = 0; s < 16; s++) if (euclid(kickK, 16, s + rot)) steps.push(s);
          if (!steps.includes(0)) steps.unshift(0);
        } else {
          const T = KICK_T[ref.kick];
          const k = (Math.floor(b / 2) + (chaos > 0.6 ? b : 0)) % T.length;
          steps = T[k].slice();
        }
        if (F.syll) { // la palabra escribe el bombo: tantos golpes como sílabas, rotados por su acento
          const k = Math.min(7, F.syll + 1), rot = (F.syll * 3 + (F.vowels || []).length) % 16;
          steps = []; for (let s = 0; s < 16; s++) if (euclid(k, 16, s + rot)) steps.push(s);
          if (!steps.includes(0)) steps.unshift(0);
        }
        if (sec === 0) steps = steps.filter((s) => s % 8 === 0); // en la SEÑAL, solo el pulso grande
        for (const s of steps) add('kick', b, s, s === 0 ? 1 : 0.8 + h4(S, 1, b, s) * 0.12);
        if (sec >= 1 && sec <= 2) for (const s of steps) {
          if (h4(S, 2, b, s) < density * 0.35 && !steps.includes(s + 1) && s < 15) add('kick', b, s + 1, 0.28 + h4(S, 3, b, s) * 0.1);
        }
      }
      // --- ticks (hats FM suaves): rejilla euclidiana en polimetría que rota
      for (let s = 0; s < 16; s++) {
        const g = b * 16 + s;
        const on = euclid(tickK, tickN, g + Math.floor(b / 4) * Math.round(chaos * 5));
        const p = clamp(e * 1.25 * (0.45 + density));
        if (on && h4(S, 4, b, s) < p && (sec > 0 || s % 2 === 1)) {
          const accent = s % 4 === 2 ? 0.35 : 0;
          add('tick', b, s, (0.3 + accent + h4(S, 5, b, s) * 0.2) * (0.5 + 0.5 * e), h4(S, 6, b, s));
        }
        if (ref.tickRes === 32 && sec === 2 && h4(S, 7, b, s) < 0.25 * density) add('tick', b, s, 0.22, 0.5, 0, step / 2);
      }
      // ratchets escritos al final de frase (y siempre antes de la ruptura)
      if ((phraseEnd && h4(S, 8, b, 0) < ref.ratchet * (0.5 + chaos)) || b === 7) {
        const s0 = 12 + Math.floor(h4(S, 9, b, 0) * 3), r = b === 7 ? 4 : 2 + Math.floor(h4(S, 10, b, 0) * 3);
        for (let s = s0; s < 16; s++) for (let k = 0; k < r; k++) add('tick', b, s, 0.25 + 0.5 * (k / r) * ((s - s0 + 1) / (16 - s0)), 0.4 + 0.6 * (k / r), 0, (k * step) / r);
      }
      // --- metal: otra rejilla en otro ciclo (se desfasa y se reencuentra)
      if (b >= 1) for (let s = 0; s < 16; s++) {
        const g = b * 16 + s;
        if (euclid(metalK, metalN, g) && h4(S, 11, b, s) < clamp(0.25 + e * 0.8)) add('metal', b, s, 0.45 + h4(S, 12, b, s) * 0.45, Math.floor(h4(S, 13, b, s) * 4));
      }
      // --- bajo: entra con la TENSIÓN, se va antes de cerrar el bucle
      if (b >= 4 && b <= 13) {
        const pick = (s) => { const r = h4(S, 15, b, s); return sec === 2 ? (r < 0.62 ? 0 : r < 0.8 ? 12 : r < 0.92 ? 7 : 1) : (r < 0.85 ? 0 : 12); };
        if (ref.bass === 'offbeat') for (const s of [2, 6, 10, 14]) add('bass', b, s, 0.8, pick(s), step * 1.6);
        else if (ref.bass === 'long') { add('bass', b, 0, 0.9, b === 7 ? 1 : 0, beat * 2.2); if (h4(S, 14, b, 0) < 0.5 * density + 0.2) add('bass', b, 10, 0.7, pick(10), beat * 1.1); }
        else if (ref.bass === 'lead') for (let s = 0; s < 16; s++) { if (euclid(7, 16, s + bassRot)) add('bass', b, s, 0.6 + h4(S, 16, b, s) * 0.3, [0, 12, 7, 1, 10][Math.floor(h4(S, 17, b, s) * (sec === 2 ? 5 : 2))], step * 0.9); }
        else for (let s = 0; s < 16; s++) { if (euclid(3, 16, s + bassRot) && h4(S, 18, b, s) < 0.55 + density * 0.4) add('bass', b, s, 0.75, pick(s), step * 2.2); }
      }
    }
    // --- ruptura: un golpe claro al entrar en el clímax
    ev.impact.push({ t: 8 * bar, v: 1, p: 0, d: 0 });
    if (refId === 'lanark') ev.impact.push({ t: 12 * bar, v: 0.55, p: 1, d: 0 });

    // --- stutters compartidos: el audio repite un trozo y la imagen repite esos mismos frames
    const warps = [];
    for (const b of [5, 7, 9, 10, 11]) {
      if (h4(S, 20, b, 0) > ref.stutter * (0.3 + 0.9 * chaos)) continue;
      const full = h4(S, 21, b, 0) < 0.5;
      const a = b * bar + (full ? 12 : 14) * step, z = (b + 1) * bar;
      const len = step * (h4(S, 22, b, 0) < 0.5 ? 1 : 0.5);
      warps.push({ a, b: z, len });
      for (const k of Object.keys(ev)) {
        if (k === 'impact') continue;
        const src = ev[k].filter((x) => x.t >= a && x.t < a + len);
        ev[k] = ev[k].filter((x) => x.t < a || x.t >= z);
        const reps = Math.round((z - a) / len);
        for (let r = 0; r < reps; r++) for (const x of src) ev[k].push({ ...x, t: x.t + r * len, v: x.v * (0.55 + 0.45 * (r / reps)), p: k === 'tick' ? Math.min(1, x.p + r * 0.08) : x.p });
      }
    }
    for (const k of Object.keys(ev)) ev[k].sort((x, y) => x.t - y.t);
    const hits = [...ev.kick.filter((x) => x.v > 0.5), ...ev.metal.filter((x) => x.v > 0.7), ...ev.impact].map((x) => +x.t.toFixed(4)).sort((x, y) => x - y);

    return {
      code, seed: S, sp, refId, ref, bpm, beat, bar, step, bars: BARS, L,
      root, rootName: NOTE[root % 12], accentKey, accentAuto: accAuto, accent, palId, pal, light: lum > 0.45 ? 1 : 0, look,
      vis, energy: E, ev, warps, hits, density, chaos, droneShape, roomSeed, metalBase,
      acts: ACTS.map(([b, n]) => [b * bar, n]), word: F.word || null, fam: F.fam || null,
      stroke: F.stroke || { style: 0, c1: '#000000', c2: '#000000' }, vowels: F.vowels || null,
    };
  }

  // ---------- lectura en un instante t (lo usa la imagen) ----------
  function warp(P, t) {
    for (const w of P.warps) if (t >= w.a && t < w.b) return w.a + ((t - w.a) % w.len);
    return t;
  }
  function voiceAt(arr, t, L, tau) {
    const out = { e: 0, n: -1, dt: 1e9, p: 0 };
    if (!arr.length) return out;
    let lo = 0, hi = arr.length - 1, idx = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].t <= t) { idx = m; lo = m + 1; } else hi = m - 1; }
    for (let k = 0; k < 5; k++) {
      let i = idx - k, dt;
      if (i >= 0) dt = t - arr[i].t; else { i += arr.length; if (i < 0) break; dt = t - (arr[i].t - L); }
      if (k === 0) { out.n = idx; out.dt = dt; out.p = arr[i].p; }
      if (dt > tau * 7) break;
      out.e += arr[i].v * Math.exp(-dt / tau);
    }
    return out;
  }
  function energyAt(P, u) {
    const x = u / P.bar - 0.5, i = Math.floor(x), f = x - i;
    const a = P.energy[(i + P.bars) % P.bars], b = P.energy[(i + 1 + P.bars) % P.bars];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  }
  function env(P, t) {
    t = ((t % P.L) + P.L) % P.L;
    const u = warp(P, t);
    const k = voiceAt(P.ev.kick, t, P.L, 0.16), m = voiceAt(P.ev.metal, t, P.L, Math.max(0.12, P.ref.metalDecay * 0.5));
    const h = voiceAt(P.ev.tick, t, P.L, 0.05), b = voiceAt(P.ev.bass, t, P.L, 0.3), im = voiceAt(P.ev.impact, t, P.L, 0.9);
    const act = P.acts.reduce((a, x, i) => (t >= x[0] ? i : a), 0);
    return {
      t, u, phase: (u / P.L) * Math.PI * 2, energy: energyAt(P, u), act, sec: u / (P.bar * 4),
      kick: k.e, kickN: k.n, kickDt: k.dt, metal: m.e, metalN: m.n, metalDt: m.dt, metalP: m.p,
      tick: h.e, bass: b.e, bassP: b.p, impact: im.e, impactDt: im.dt,
    };
  }

  window.SEMILLA = { MATS, RIGS, PALETTES, ACCENTS, ACCENT_NAMES, SPECIES, REFS, ACTS, NOTE, BARS, newCode, cleanCode, generate, env, warp, energyAt, hashStr, mulberry, h4 };
})();
