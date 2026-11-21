// VØID_LOOM · ROSTRO — sonido. Dos capas que se pueden separar en directo (AUDIO: BASE / BASE + AMBIENT):
//  BASE    = el sonido del clip de validación: bombo esculpido, chapa FM, crujidos de tendón, bajo con
//            armónicos, impacto, dron aditivo en la raíz con su quinta y el oleaje hacia la ruptura.
//  AMBIENT = dark ambient encima: mucho dron, ruido como materia y efectos con intención.
// Los golpes son pocos y esculpidos; el resto es un cuerpo sonoro que respira con la cabeza:
//  · capas de dron (sierras desafinadas, coro aditivo, pad FM metálico) que se abren en la ruptura
//  · ruido: retumbo marrón, aliento que barre, polvo; todo oscuro, nada estridente
//  · cada emoción tiene su voz, que sube con su peso en el rostro
//  · el movimiento suena: la piel que se estira, el tendón que se tuerce, lo que empuja bajo la piel
// Funciona igual en tiempo real (AudioContext) y en render (OfflineAudioContext).

const hz = m => 440 * 2 ** ((m - 69) / 12);

function ruido(ctx, color = 'white', dur = 6) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; }
      else d[i] = w * 0.5;
    }
    if (ch === 1) { const L0 = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = 0.65 * L0[i] + 0.35 * d[i]; } // estéreo ancho pero compatible en mono
    const f = Math.floor(ctx.sampleRate * 0.05); for (let i = 0; i < f; i++) { const g = i / f; d[i] *= g; d[n - 1 - i] *= g; } // sin clic en el bucle
  }
  return b;
}
function impulso(ctx, dur, damp, pre = 0.02) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0; const a = Math.exp(-2 * Math.PI * damp / ctx.sampleRate);
    for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; lp = a * lp + (1 - a) * (Math.random() * 2 - 1); d[i] = t < pre ? 0 : lp * Math.exp(-t / (dur / 5.5)); }
    if (ch === 1) { const L0 = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = 0.55 * L0[i] + 0.45 * d[i]; } // cola ancha pero sólida en mono
  }
  return b;
}

export function crearSonido(ctx) {
  const now = () => ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = 0.7;
  const trim = ctx.createGain(); trim.gain.value = 0.385; // nivel interno ≈ −14 LUFS; el de sala lo pone VOLUMEN
  // máster: agudos domados (estante −6 dB desde 2,2 kHz), compresión suave y limitador
  const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 2200; shelf.gain.value = -6;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 24;
  const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -20; glue.ratio.value = 2.5; glue.attack.value = 0.02; glue.release.value = 0.3; glue.knee.value = 10;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12; lim.knee.value = 0;
  const bus = ctx.createGain();
  const mk = ctx.createGain(); mk.gain.value = 0.78; // nivel tras el limitador: ≈ −14 LUFS en ambos modos
  bus.connect(trim).connect(hp).connect(shelf).connect(glue).connect(lim).connect(mk).connect(out).connect(ctx.destination);
  // bus de batería con saturación paralela (el bombo se oye en altavoces pequeños)
  const drum = ctx.createGain(); drum.connect(bus);
  { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 180; const ws = ctx.createWaveShaper(); ws.curve = curva(3); const g = ctx.createGain(); g.gain.value = 0.45; drum.connect(h).connect(ws).connect(g).connect(bus); }
  // espacios: SALA (cercana, oscura) y ABISMO (larga, 9 s, muy oscura)
  const sala = ctx.createConvolver(); sala.buffer = impulso(ctx, 2.6, 3200); const salaG = ctx.createGain(); salaG.gain.value = 0.55; sala.connect(salaG).connect(bus);
  const abismo = ctx.createConvolver(); abismo.buffer = impulso(ctx, 9, 1400, 0.05); const abG = ctx.createGain(); abG.gain.value = 0.8; abismo.connect(abG).connect(bus);
  // flanger de máster para el ECO (el grave queda fuera)
  const flIn = ctx.createGain(), flHP = ctx.createBiquadFilter(); flHP.type = 'highpass'; flHP.frequency.value = 220;
  const flD = ctx.createDelay(0.05); flD.delayTime.value = 0.004; const flFb = ctx.createGain(); flFb.gain.value = 0.72;
  const flL = ctx.createOscillator(); flL.frequency.value = 0.11; const flLG = ctx.createGain(); flLG.gain.value = 0.0032; flL.connect(flLG).connect(flD.delayTime); flL.start();
  const flWet = ctx.createGain(); flWet.gain.value = 0;
  flIn.connect(flHP).connect(flD); flD.connect(flFb).connect(flD); flD.connect(flWet).connect(bus);

  let amb = true; // capa AMBIENT encendida
  const AMB = 0.42;  // nivel de la capa AMBIENT respecto a la BASE
  const NB = { white: ruido(ctx, 'white'), pink: ruido(ctx, 'pink'), brown: ruido(ctx, 'brown') };
  const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
  const lfo = (f, amt, target, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = amt; o.connect(g).connect(target); o.start(); return o; };
  const send = (node, s = 0, a = 0, fl = 0) => { if (s) { const g = ctx.createGain(); g.gain.value = s; node.connect(g).connect(sala); } if (a) { const g = ctx.createGain(); g.gain.value = a; node.connect(g).connect(abismo); } if (fl) { const g = ctx.createGain(); g.gain.value = fl; node.connect(g).connect(flIn); } };
  const pan = (p) => { const n = ctx.createStereoPanner(); n.pan.value = p; return n; };

  // ---------------- capas continuas
  const L = {}; // nombre → gain (para automatizar)
  const capa = (name, g0 = 0) => { const g = ctx.createGain(); g.gain.value = g0; L[name] = g; g.connect(bus); return g; };
  let root = 36;
  const oscs = []; // osciladores que siguen la raíz: {o, mul}
  const osc = (type, mul, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.detune.value = det; oscs.push({ o, mul }); o.start(); return o; };

  // DRON BASE (el del clip): parciales de la raíz con un formante que se abre hacia la ruptura, quinta abajo; se agacha con el bombo
  const duck = ctx.createGain(); duck.connect(bus); const baseG = ctx.createGain(); baseG.gain.value = 0; baseG.connect(duck); L.base = baseG;
  const parc = [];
  for (let k = 2; k <= 19; k++) for (const det of [-0.12, 0.12]) {
    const o = osc('sine', 0.5 * k, det * k), g = ctx.createGain(); g.gain.value = 0; o.connect(pan(det * 4)).connect(g).connect(baseG); parc.push({ k, g });
  }
  { const o = osc('sine', 0.75), g = ctx.createGain(); g.gain.value = 0.14; o.connect(g).connect(baseG); }
  send(baseG, 0, 0.25);
  const formante = (fc, when) => { const r0 = hz(root) * 0.5; for (const p of parc) p.g.gain.setTargetAtTime(Math.exp(-((((r0 * p.k) - fc) / (fc * 0.5)) ** 2)) / p.k ** 0.25 * 0.11, when, 0.4); };
  // DRON A: sierras desafinadas en la raíz, filtro que respira
  { const g = capa('dronA'); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 3; L.dronAf = f;
    lfo(0.045, 160, f.frequency); for (const [m, d, p] of [[1, -9, -0.5], [1, 7, 0.5], [2, -4, -0.2], [0.5, 3, 0.2]]) { const o = osc('sawtooth', m, d); const pp = pan(p); o.connect(pp).connect(f); }
    f.connect(g); send(g, 0.2, 0.35, 0.3); }
  // DRON B: coro aditivo; cada parcial con su deriva lenta (formante que se mueve)
  { const g = capa('dronB'); for (const [m, a] of [[2, .5], [3, .42], [4, .3], [5, .26], [6, .2], [8, .14], [10, .1], [12, .07]]) {
      const o = osc('sine', m, (Math.random() - 0.5) * 8), gg = ctx.createGain(); gg.gain.value = a * 0.5; lfo(0.02 + Math.random() * 0.06, a * 0.45, gg.gain);
      o.connect(gg).connect(pan((Math.random() - 0.5) * 1.4)).connect(g); }
    send(g, 0, 0.6, 0.2); }
  // DRON C: pad FM metálico grave, solo en el abismo (fondo)
  { const g = capa('dronC'); const car = osc('sine', 4, -3), mod = osc('sine', 4 * 1.414), mg = ctx.createGain(); mg.gain.value = 0; L.fmIdx = mg;
    mod.connect(mg).connect(car.frequency); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    car.connect(lp).connect(g); g.disconnect(); const dry = ctx.createGain(); dry.gain.value = 0.25; g.connect(dry).connect(bus); send(g, 0, 1.1); }
  // SUB: seno en la raíz, mono, para el peso
  { const g = capa('sub'); osc('sine', 1).connect(g); }
  // RUIDO: retumbo marrón (viento grave), aliento que barre, polvo
  { const g = capa('retumbo'); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170; lfo(0.03, 60, f.frequency); loop(NB.brown).connect(f).connect(g); send(g, 0, 0.4); }
  { const g = capa('aliento'); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2; f.frequency.value = 650; L.alientoF = f;
    lfo(0.07, 380, f.frequency); const pa = pan(0); lfo(0.05, 0.8, pa.pan); loop(NB.pink, 0.8).connect(f).connect(pa).connect(g); send(g, 0.3, 0.6, 0.4); }
  { const g = capa('polvo'); // crujido de vinilo/arena: impulsos dispersos muy filtrados
    const n = ctx.sampleRate * 5, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let k = 0; k < 160; k++) { const i = Math.floor(Math.random() * (n - 200)), a = Math.random() ** 3; for (let j = 0; j < 60; j++) d[i + j] += a * (Math.random() * 2 - 1) * Math.exp(-j / 8); } }
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8; loop(b).connect(f).connect(g); send(g, 0.4, 0.3); }
  // MOVIMIENTO: la piel que se estira (ruido resonante que sigue a la mandíbula) y el tendón (seno que se tuerce)
  { const g = capa('piel'); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 7; f.frequency.value = 400; L.pielF = f;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9; f2.frequency.value = 700; L.pielF2 = f2;
    const src = loop(NB.white, 0.6); src.connect(f).connect(g); src.connect(f2).connect(g); send(g, 0.4, 0.5); }
  { const g = capa('tendon'); const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 110; L.tendonHz = o; o.start();
    const ws = ctx.createWaveShaper(); ws.curve = curva(2.5); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(ws).connect(lp).connect(g); send(g, 0.3, 0.6); }

  // ---------------- voces de las emociones (suben con su peso en el rostro)
  const V = {};
  const OFF = globalThis.ROSTRO_OFF || [];
  const voz = (name, build, s = 0.3, a = 0.6) => { if (OFF.includes(name)) return; const g = ctx.createGain(); g.gain.value = 0; V[name] = g; build(g); g.connect(bus); send(g, s, a, 0.15); };
  voz('MIEDO', g => { for (const [m, d] of [[8, 0], [8, 31]]) { const o = osc('sine', m, d), t = ctx.createGain(); t.gain.value = 0.5; lfo(9, 0.5, t.gain); o.connect(t).connect(g); } });
  voz('FURIA', g => { const o = osc('sawtooth', 1, -6), o2 = osc('sawtooth', 1.003, 6); const ws = ctx.createWaveShaper(); ws.curve = curva(6); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lfo(5.3, 260, lp.frequency); const am = ctx.createGain(); am.gain.value = 0.6; lfo(31, 0.4, am.gain);
    o.connect(ws); o2.connect(ws); ws.connect(lp).connect(am).connect(g); }, 0.2, 0.3);
  voz('GRITO', g => { const o = osc('sawtooth', 4); const vib = lfo(5.5, 9, o.detune); const gm = ctx.createGain(); gm.gain.value = 0.35;
    for (const [f, q, a] of [[720, 9, 1], [1150, 10, 0.6], [1900, 12, 0.25]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const ga = ctx.createGain(); ga.gain.value = a; o.connect(bp).connect(ga).connect(gm); }
    gm.connect(g); }, 0.3, 0.9);
  voz('PÁNICO', g => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5; bp.frequency.value = 900; lfo(0.4, 450, bp.frequency); const t = ctx.createGain(); t.gain.value = 0.5; lfo(13, 0.5, t.gain, 'square'); loop(NB.pink).connect(bp).connect(t).connect(g); });
  voz('DOLOR', g => { for (const [m, d] of [[3, 0], [3, 23], [4.5, -11]]) osc('sine', m, d).connect(g); });
  voz('RISA', g => { const o = osc('sawtooth', 3); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 6; const gate = ctx.createGain(); gate.gain.value = 0; lfo(7, 0.6, gate.gain, 'square'); o.connect(bp).connect(gate).connect(g); });
  voz('TRISTEZA', g => { osc('sine', 2).connect(g); osc('sine', 2 * 1.1892).connect(g); });
  voz('ANGUSTIA', g => { const o = ctx.createOscillator(); o.type = 'sine'; o.start(); L.angustiaHz = o; const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.start(); L.angustiaHz2 = o2; o.connect(g); o2.connect(g); }, 0.1, 1);
  // Filtros modulados solo con LFO senoidal: una onda con saltos (cuadrada, sierra) vuelve inestable el
  // biquad, da NaN y apaga todo el máster.
  // ASCO: el filtro nunca baja de ~190 Hz (un filtro en frecuencia negativa da NaN y apaga todo)
  voz('ASCO', g => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 8; bp.frequency.value = 700; lfo(3.7, 360, bp.frequency); lfo(0.9, 150, bp.frequency); loop(NB.white, 0.5).connect(bp).connect(g); }, 0.4, 0.4);
  voz('DESPRECIO', g => { const o = osc('square', 1.5), m = osc('sine', 1.5 * 1.33), rm = ctx.createGain(); rm.gain.value = 0; m.connect(rm.gain); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; o.connect(rm).connect(lp).connect(g); }, 0.2, 0.4);
  voz('SORPRESA', g => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.value = 400; L.sorpF = bp; loop(NB.pink, 1.2).connect(bp).connect(g); }, 0.3, 0.7);
  const VOZ_DE = { HORROR: 'PÁNICO', ODIO: 'FURIA', LOCURA: 'RISA', 'AGONÍA': 'GRITO', 'ÉXTASIS': 'SORPRESA', 'VERGÜENZA': 'TRISTEZA', 'CONFUSIÓN': 'DESPRECIO',
    LLANTO: 'TRISTEZA', 'SÚPLICA': 'ANGUSTIA', 'DESESPERACIÓN': 'ANGUSTIA', 'NÁUSEA': 'ASCO', BURLA: 'RISA', SOSPECHA: 'DESPRECIO', ARROGANCIA: 'DESPRECIO', AGOTAMIENTO: 'ANGUSTIA', 'VÉRTIGO': 'MIEDO' };
  const VGAIN = { MIEDO: 0.05, FURIA: 0.09, GRITO: 0.09, 'PÁNICO': 0.22, DOLOR: 0.06, RISA: 0.08, TRISTEZA: 0.07, ANGUSTIA: 0.08, ASCO: 0.5, DESPRECIO: 0.08, SORPRESA: 0.35 };

  function raiz(m, when = now()) { root = m; for (const { o, mul } of oscs) o.frequency.setTargetAtTime(hz(m) * mul, when, 0.3); }
  raiz(36);

  // ---------------- golpes (en el instante exacto de la partitura)
  function env(g, when, a, peak, dec) { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(peak, when + a); g.gain.setTargetAtTime(0, when + a, dec); }
  function kick(when, v, estilo, ratchet) {
    const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper(); ws.curve = curva(1.8);
    const f0 = ratchet ? 190 : estilo === 'PULSO' ? 150 : 165, f1 = estilo === 'PULSO' ? 49 : 52;
    o.frequency.setValueAtTime(f0, when); o.frequency.setTargetAtTime(f1, when, 0.03);
    env(g, when, 0.0015, v * (ratchet ? 0.45 : 0.95), ratchet ? 0.03 : estilo === 'GOLPE' ? 0.11 : 0.08);
    o.connect(ws).connect(g).connect(drum); o.start(when); o.stop(when + 1);
    if (!ratchet) { duck.gain.setValueAtTime(1 - 0.45 * Math.min(1, v), when); duck.gain.setTargetAtTime(1, when + 0.01, 0.16); }
    // clic esculpido + capa media para el móvil
    const c = ctx.createBufferSource(); c.buffer = NB.white; const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1600; cf.Q.value = 1.2; const cg = ctx.createGain();
    env(cg, when, 0.0005, v * 0.5, 0.005); c.connect(cf).connect(cg).connect(drum); c.start(when, Math.random() * 3); c.stop(when + 0.05);
    if (!ratchet) send(g, 0.08, estilo === 'GOLPE' ? 0.12 : 0);
  }
  function chapa(when, v) { // FM golpeada y oscura (sin campana): el brillo cae en milisegundos
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    car.frequency.value = 131; mod.frequency.value = 287; lp.type = 'lowpass'; lp.frequency.value = 3200;
    mg.gain.setValueAtTime(3.2 * 287, when); mg.gain.setTargetAtTime(0, when, 0.012);
    const ws = ctx.createWaveShaper(); ws.curve = curva(1.5);
    env(g, when, 0.001, v * 0.42, 0.11); mod.connect(mg).connect(car.frequency); car.connect(ws).connect(lp).connect(g);
    const c2 = ctx.createOscillator(); c2.frequency.value = 523; const m2 = ctx.createGain(); m2.gain.setValueAtTime(0.7 * 3.2 * 287, when); m2.gain.setTargetAtTime(0, when, 0.012); mod.connect(m2).connect(c2.frequency);
    const g2 = ctx.createGain(); env(g2, when, 0.001, v * 0.13, 0.03); c2.connect(g2).connect(lp);
    const p = pan((Math.random() - .5) * .8); g.connect(p).connect(drum); send(p, 0.35, amb ? 0.35 : 0);
    for (const o of [car, mod, c2]) { o.start(when); o.stop(when + 0.8); }
  }
  function crujido(when, v) { // tendón: Karplus grave (bucle de retardo) con caída de tono
    const f = 70 + Math.random() * 70, n = ctx.createBufferSource(); n.buffer = NB.white; const ng = ctx.createGain(); env(ng, when, 0.001, v * 0.9, 0.006);
    const d = ctx.createDelay(0.05); d.delayTime.setValueAtTime(1 / f, when); d.delayTime.linearRampToValueAtTime(1 / (f * 0.82), when + 0.4);
    // el filtro del bucle sin resonancia (Q en dB): con pico, la ganancia del bucle pasa de 1 y explota
    const fb = ctx.createGain(); fb.gain.setValueAtTime(0.9, when); fb.gain.setValueAtTime(0, when + 0.7); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = -6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, when); g.gain.setTargetAtTime(0, when + 0.15, 0.08);
    n.connect(ng).connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(g); const p = pan((Math.random() - .5) * 1.4); g.connect(p).connect(bus); send(p, 0.3, 0.5);
    n.start(when, Math.random() * 4); n.stop(when + 0.05);
  }
  function bajo(when, midi, dur, v) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 1.004; // sin octava abajo: a 30 Hz el móvil no lo oye
    const ws = ctx.createWaveShaper(); ws.curve = curva(2); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(900, when); lp.frequency.setTargetAtTime(160, when, 0.12);
    const g = ctx.createGain(); env(g, when, 0.004, v * 0.22, dur * 0.4);
    const sg = ctx.createGain(); sg.gain.value = 0.5; o2.connect(sg).connect(lp); o.connect(ws).connect(lp).connect(g).connect(drum);
    o.start(when); o2.start(when); o.stop(when + dur * 2.5); o2.stop(when + dur * 2.5);
  }
  function impacto(when) {
    const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper(); ws.curve = curva(1.6);
    o.frequency.setValueAtTime(120, when); o.frequency.setTargetAtTime(30, when, 0.09); env(g, when, 0.002, 0.9, 0.8);
    o.connect(ws).connect(g).connect(drum); o.start(when); o.stop(when + 5);
    const n = ctx.createBufferSource(); n.buffer = NB.brown; const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.setValueAtTime(2400, when); bp.frequency.setTargetAtTime(120, when, 0.25);
    const ng = ctx.createGain(); env(ng, when, 0.003, 0.9, 0.6); n.connect(bp).connect(ng).connect(drum); send(ng, 0, amb ? 1.2 : 0.3); n.start(when); n.stop(when + 5);
    // cuerpo: armónicos graves (como en el clip)
    for (let k = 1; k <= 6; k++) { const b = ctx.createOscillator(); b.frequency.value = hz(26) * k; const bg = ctx.createGain(); env(bg, when, 0.002, 0.35 / k, 0.5); b.connect(bg).connect(drum); b.start(when); b.stop(when + 4); }
    if (!amb) return;
    // tiro al abismo (AMBIENT): la cola del impacto se queda sonando como dron
    const t = ctx.createOscillator(); t.type = 'sawtooth'; t.frequency.value = hz(root) * 2; const tg = ctx.createGain(); env(tg, when, 0.01, 0.12, 1.5); const tl = ctx.createBiquadFilter(); tl.type = 'lowpass'; tl.frequency.value = 600;
    t.connect(tl).connect(tg); send(tg, 0, 1.5); t.start(when); t.stop(when + 6);
  }
  function oleaje(from, to) { // swell invertido hacia el impacto: ruido que sube y se abre
    const n = ctx.createBufferSource(); n.buffer = NB.pink; n.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(180, from); f.frequency.exponentialRampToValueAtTime(2200, to);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, from); g.gain.linearRampToValueAtTime(0.5, to - 0.03); g.gain.linearRampToValueAtTime(0, to);
    n.connect(f).connect(g).connect(bus); send(g, 0, 0.5, 0.6); n.start(from); n.stop(to + 0.1);
  }
  function piel(when, v) { // algo empuja bajo la piel: chapoteo resonante que cae (AMBIENT)
    if (!amb) return;
    const n = ctx.createBufferSource(); n.buffer = NB.white; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 12;
    bp.frequency.setValueAtTime(900 + Math.random() * 500, when); bp.frequency.exponentialRampToValueAtTime(160, when + 0.25);
    const g = ctx.createGain(); env(g, when, 0.004, v * 0.9, 0.08); const p = pan((Math.random() - .5) * 1.2);
    n.connect(bp).connect(g).connect(p).connect(bus); send(p, 0.3, 0.4); n.start(when, Math.random() * 4); n.stop(when + 0.5);
  }
  function glitch(when, v) { // micro-corte digital: ráfaga cuadrada escalonada, grave y corta
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(root) * (Math.random() < .5 ? 4 : 6); const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.12, when); g.gain.setValueAtTime(0, when + 0.025); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    o.connect(lp).connect(g).connect(bus); o.start(when); o.stop(when + 0.04);
  }
  function barrido(when, dir) { // la luz que recorre la cara suena como un barrido de ruido por el estéreo (AMBIENT)
    if (!amb) return;
    const n = ctx.createBufferSource(); n.buffer = NB.pink; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(300, when); bp.frequency.exponentialRampToValueAtTime(1500, when + 0.35); bp.frequency.exponentialRampToValueAtTime(250, when + 0.9);
    const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-dir, when); p.pan.linearRampToValueAtTime(dir, when + 0.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.16, when + 0.3); g.gain.linearRampToValueAtTime(0, when + 0.9);
    n.connect(bp).connect(g).connect(p).connect(bus); send(p, 0, 0.4, 0.5); n.start(when, Math.random() * 3); n.stop(when + 1);
  }

  const ACT = { 'SEÑAL': { dronA: .12, dronB: .2, dronC: .45, sub: .1, retumbo: .35, aliento: .12, polvo: .25, fm: 40, lp: 260 },
    'TENSIÓN': { dronA: .2, dronB: .26, dronC: .6, sub: .16, retumbo: .4, aliento: .18, polvo: .3, fm: 120, lp: 420 },
    'RUPTURA': { dronA: .3, dronB: .2, dronC: .75, sub: .2, retumbo: .5, aliento: .26, polvo: .35, fm: 420, lp: 900 },
    'ECO':     { dronA: .16, dronB: .3, dronC: .7, sub: .1, retumbo: .3, aliento: .14, polvo: .3, fm: 80, lp: 300 } };

  let master = 0.7, muted = false;
  const BASE_LVL = { 'SEÑAL': .35, 'TENSIÓN': .55, 'RUPTURA': .5, 'ECO': .45 }, FORM = { 'SEÑAL': 520, 'TENSIÓN': 800, 'RUPTURA': 950, 'ECO': 340 };
  return {
    ctx, out,
    volumen(v) { master = v; out.gain.setTargetAtTime(muted ? 0 : v, now(), 0.1); },
    silencio(m) { muted = m; out.gain.setTargetAtTime(m ? 0 : master, now(), 0.4); },
    raiz,
    ambiente(on) { amb = !!on; trim.gain.setTargetAtTime(amb ? 0.385 : 0.78, now(), 0.5); mk.gain.setTargetAtTime(amb ? 0.78 : 1.15, now(), 0.5); },
    get conAmbient() { return amb; },
    // pieza nueva: raíz y voces a cero
    pieza(P, when = now()) { raiz(P.root, when); },
    golpe(e, when, P) {
      if (OFF.includes(e.k)) return;
      switch (e.k) {
        case 'kick': kick(when, e.v, P.estilo, e.ratchet); break;
        case 'metal': chapa(when, e.v); piel(when + 0.01, e.v * 0.6); break;
        case 'creak': crujido(when, e.v); break;
        case 'bass': bajo(when, e.midi, e.dur, e.v); break;
        case 'impact': impacto(when); break;
        case 'glitch': glitch(when, e.v); break;
        case 'sweep': barrido(when, e.dir || 1); break;
      }
    },
    oleaje,
    // capas continuas desde el estado del rostro (st del animador) y el acto
    vivo(st, when = now(), fadeK = 1) {
      const A = ACT[st.act] || ACT['SEÑAL'], aK = amb ? 1 : 0, M = st.m || st.c; // resumen de la cara
      // BASE: dron del clip (sube hacia la ruptura con la tensión)
      const pre = st.preImpacto || 0;
      L.base.gain.setTargetAtTime((BASE_LVL[st.act] + 0.25 * pre) * fadeK * (amb ? 1.1 : 1.6), when, 0.5);
      formante((FORM[st.act] + 600 * pre) * (1 + 0.2 * Math.max(0, M.skull)), when);
      L.sub.gain.setTargetAtTime(A.sub * fadeK * 0.45, when, 0.8);
      for (const k of ['dronA', 'dronB', 'dronC', 'retumbo', 'aliento', 'polvo']) L[k].gain.setTargetAtTime(A[k] * fadeK * aK * AMB, when, 0.8);
      L.fmIdx.gain.setTargetAtTime(A.fm * (1 + M.skull * 0.5), when, 0.5);
      L.dronAf.frequency.setTargetAtTime(A.lp * (1 + M.jaw * 0.5), when, 0.4);
      const c = M;
      L.pielF.frequency.setTargetAtTime(220 + 520 * Math.max(0, c.jaw) + 300 * Math.max(0, c.skull), when, 0.05);
      L.pielF2.frequency.setTargetAtTime(500 + 600 * Math.abs(c.twist) + 400 * Math.max(0, c.mouthWide), when, 0.05);
      L.piel.gain.setTargetAtTime(Math.min(0.5, st.speed * 0.09) * fadeK * aK, when, 0.04);
      L.tendonHz.frequency.setTargetAtTime(hz(root) * (1.5 + 1.2 * Math.abs(c.twist) + 0.8 * Math.abs(c.roll)), when, 0.06);
      L.tendon.gain.setTargetAtTime(Math.min(0.06, (Math.abs(c.twist) + Math.abs(c.roll)) * 0.05) * fadeK * aK, when, 0.1);
      L.angustiaHz.frequency.setTargetAtTime(hz(root) * (3 - 1.4 * Math.max(0, c.melt)), when, 0.5);
      L.angustiaHz2.frequency.setTargetAtTime(hz(root) * (3.02 - 1.45 * Math.max(0, c.melt)), when, 0.5);
      L.sorpF.frequency.setTargetAtTime(300 + 900 * Math.max(0, c.brow), when, 0.2);
      L.aliento.gain.setTargetAtTime(A.aliento * (1 + st.speed * 0.15) * fadeK * aK, when, 0.3);
      // las emociones nuevas suenan con la voz de su familia
      const ev = {}; for (const [k, val] of Object.entries(st.emo || {})) { const vz = VOZ_DE[k] || k; ev[vz] = (ev[vz] || 0) + val; }
      for (const [name, g] of Object.entries(V)) g.gain.setTargetAtTime(Math.min(1.2, ev[name] || 0) * (VGAIN[name] || 0.06) * fadeK * aK * AMB, when, 0.35);
      flWet.gain.setTargetAtTime((st.act === 'ECO' ? 0.55 : 0.08) * aK, when, 1.2);
    },
  };
}

function curva(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
