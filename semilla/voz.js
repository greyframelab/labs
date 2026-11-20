/* VØID_LOOM · SEMILLA — la palabra.
   Escucha a la sala (reconocimiento de voz de Chrome, en español), se queda con la palabra con más carga
   y la convierte en carácter: forma, material, luces, acento, trazos, ritmo y las vocales que cantará el dron.
   La palabra nunca se proyecta ni se guarda: solo se nota en la obra. */
(function () {
  'use strict';
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\u00f1]/g, '');

  // familias de sentido: lo que la palabra pinta y cómo suena
  const FAM = {
    agua: { w: 'agua mar lluvia llover rio ola oceano lago llorar lagrima nieve hielo niebla marea ola playa azul frio rocio nube tormenta? sudor', forms: ['pliegue', 'masa'], mats: [2, 0], rigs: [0, 1], acc: ['cian', 'blanco'], stroke: 2, den: 0.45, cha: 0.3, refs: ['boc', 'lanark'] },
    fuego: { w: 'fuego llama sol calor rabia ira furia sangre guerra quemar volcan rojo pasion infierno arder brasa incendio odio lucha', forms: ['espina', 'fractura'], mats: [1, 2], rigs: [3, 2], acc: ['rojo', 'ambar'], stroke: 1, den: 0.8, cha: 0.75, refs: ['squarepusher', 'orphx'] },
    amor: { w: 'amor beso corazon abrazo deseo carino ternura piel madre padre hijo hija querer amar amiga amigo familia dulce caricia', forms: ['masa', 'concha'], mats: [0, 3], rigs: [1, 0], acc: ['magenta', 'rojo'], stroke: 3, den: 0.5, cha: 0.35, refs: ['phoenicia', 'boc'] },
    miedo: { w: 'miedo sombra noche oscuridad oscuro muerte morir terror soledad vacio angustia pesadilla fantasma frio perdido dolor ausencia herida', forms: ['monolito', 'concha'], mats: [3, 1], rigs: [3, 2], acc: ['violeta', 'blanco'], stroke: 4, den: 0.3, cha: 0.55, refs: ['lanark', 'autechre'] },
    luz: { w: 'luz dia oro alba amanecer estrella brillo esperanza cielo luna blanco despertar mirar ojo ver claro', forms: ['concha', 'torsion'], mats: [2, 0], rigs: [1, 0], acc: ['ambar', 'blanco'], stroke: 6, den: 0.5, cha: 0.3, refs: ['boc', 'lanark'] },
    tiempo: { w: 'tiempo memoria recuerdo reloj pasado futuro olvido historia ayer manana siempre nunca viejo infancia espera', forms: ['columnas', 'monolito'], mats: [0, 1], rigs: [2, 0], acc: ['ambar', 'cian'], stroke: 7, den: 0.45, cha: 0.4, refs: ['autechre', 'boc'] },
    maquina: { w: 'maquina codigo robot datos red ciudad metal ordenador inteligencia algoritmo pantalla tecnologia sistema motor cable digital', forms: ['torsion', 'columnas'], mats: [2, 0], rigs: [2, 1], acc: ['verde', 'cian'], stroke: 5, den: 0.65, cha: 0.5, refs: ['autechre', 'orphx'] },
    calma: { w: 'calma paz silencio respirar sueno dormir quietud nada descanso suave lento blanco meditar flotar', forms: ['monolito', 'pliegue'], mats: [0, 3], rigs: [0, 1], acc: ['blanco', 'cian'], stroke: 2, den: 0.2, cha: 0.15, refs: ['boc', 'lanark'] },
    caos: { w: 'caos ruido grito explosion locura fiesta baile tormenta rompe romper choque velocidad prisa nervios estres', forms: ['fractura', 'espina'], mats: [1, 2], rigs: [2, 3], acc: ['magenta', 'ambar'], stroke: 5, den: 0.9, cha: 0.95, refs: ['squarepusher', 'phoenicia'] },
    vida: { w: 'vida semilla nacer flor arbol tierra verde bosque cuerpo crecer raiz hoja jardin animal planta respirar', forms: ['masa', 'concha'], mats: [1, 0], rigs: [1, 3], acc: ['verde', 'ambar'], stroke: 3, den: 0.55, cha: 0.45, refs: ['phoenicia', 'boc'] },
  };
  const LEX = [];
  for (const [k, f] of Object.entries(FAM)) for (const w of f.w.split(/\s+/)) if (w && !w.includes('?')) LEX.push([norm(w), k]);
  LEX.sort((a, b) => b[0].length - a[0].length);
  const STOP = new Set('el la los las lo un una unos unas y e o u de del a al en con por para que es eso esto esta este mi tu su sus me te se le les nos hola vale bueno pues ya si no muy mas como yo tu el ella ellos hay ahi aqui algo eh ah oh mmm vamos mira oye pero sin sobre entre hasta desde cuando donde porque gracias adios'.split(' '));

  function family(w) {
    for (const [stem, k] of LEX) {
      if (w === stem) return k;
      if (stem.length >= 4 && w.startsWith(stem.slice(0, Math.max(4, stem.length - 2)))) return k;
    }
    return null;
  }
  // las vocales de la palabra (las cantará el dron) y sus sílabas (su ritmo)
  function vowels(w) { return (w.match(/[aeiou]/g) || ['a']).slice(0, 6); }
  function syllables(w) { const g = w.match(/[aeiou]+/g); return Math.max(1, g ? g.length : 1); }

  // carácter que sale de una palabra (siempre el mismo para la misma palabra; la pieza cambia con el instante)
  function character(word) {
    const w = norm(word), S = window.SEMILLA, R = S.mulberry(S.hashStr('carácter:' + w));
    const pick = (a) => a[Math.floor(R() * a.length)];
    let k = family(w), f;
    if (k) f = FAM[k];
    else {
      // sin significado conocido: manda su sonido
      const n = w.length || 1, sharp = (w.match(/[ptkcqbdg]/g) || []).length / n, open = (w.match(/[aou]/g) || []).length / n, rr = (w.match(/r/g) || []).length / n;
      const acc = Object.keys(S.ACCENTS)[Math.floor(R() * 7)];
      f = sharp > 0.28 ? { forms: ['fractura', 'espina', 'torsion'], mats: [1, 2], rigs: [2, 3], acc: [acc, 'blanco'], stroke: 5, den: 0.6 + sharp * 0.5, cha: 0.5 + rr * 2, refs: ['autechre', 'squarepusher'] }
        : open > 0.42 ? { forms: ['masa', 'pliegue', 'concha'], mats: [0, 3], rigs: [0, 1], acc: [acc, 'blanco'], stroke: 3, den: 0.4 + n * 0.03, cha: 0.3 + rr * 2, refs: ['boc', 'lanark', 'phoenicia'] }
          : { forms: ['monolito', 'columnas', 'concha'], mats: [0, 1, 2], rigs: [0, 1, 2], acc: [acc, 'blanco'], stroke: 7, den: 0.45, cha: 0.4 + rr * 2, refs: ['autechre', 'orphx', 'lanark'] };
      k = 'sonido';
    }
    const c1 = pick(f.acc), c2 = f.acc.find((a) => a !== c1) || 'blanco';
    return {
      fam: k, form: pick(f.forms), mat: pick(f.mats), rig: pick(f.rigs), accent: c1,
      stroke: { style: f.stroke, c1: S.ACCENTS[c1], c2: S.ACCENTS[c2] },
      density: Math.min(0.95, f.den + (R() - 0.5) * 0.1), chaos: Math.min(0.95, f.cha + (R() - 0.5) * 0.1),
      ref: pick(f.refs), vowels: vowels(w), syll: syllables(w),
    };
  }
  // de una frase oída, la palabra con más carga
  function pickWord(text) {
    const ws = String(text || '').split(/\s+/).map((x) => ({ raw: x, n: norm(x) })).filter((x) => x.n.length >= 3 && !STOP.has(x.n));
    if (!ws.length) return null;
    const known = ws.find((x) => family(x.n));
    return (known || ws.sort((a, b) => b.n.length - a.n.length)[0]).n;
  }

  // ---------- escucha ----------
  function Listener(onWord, onState) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.ok = !!SR; this.on = false; this.onWord = onWord; this.onState = onState || (() => {});
    if (!SR) { this.onState('SIN VOZ EN ESTE NAVEGADOR'); return; }
    const r = (this.r = new SR());
    r.lang = 'es-ES'; r.continuous = true; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => this.onState('ESCUCHANDO');
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const txt = e.results[i][0].transcript, w = pickWord(txt);
        if (w) this.onWord(w, txt);
      }
    };
    r.onerror = (e) => {
      const m = { 'not-allowed': 'SIN PERMISO DE MICRÓFONO', 'service-not-allowed': 'SIN PERMISO DE MICRÓFONO', network: 'SIN INTERNET', 'audio-capture': 'SIN MICRÓFONO', 'no-speech': 'ESCUCHANDO' }[e.error] || 'ERROR · ' + e.error;
      this.onState(m);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.on = false;
    };
    // Chrome corta la escucha tras un silencio o cada pocos minutos: se rearma sola
    r.onend = () => { if (this.on) setTimeout(() => { try { this.r.start(); } catch (err) {} }, 350); };
    setInterval(() => { if (this.on && this.lastStart && Date.now() - this.lastStart > 5 * 60e3) { this.lastStart = Date.now(); try { this.r.stop(); } catch (err) {} } }, 30e3);
  }
  Listener.prototype.start = function () { if (!this.ok || this.on) return; this.on = true; this.lastStart = Date.now(); try { this.r.start(); } catch (e) {} };
  Listener.prototype.stop = function () { this.on = false; if (this.ok) try { this.r.stop(); } catch (e) {} this.onState('APAGADA'); };

  // ---------- escucha offline (app de escritorio): Vosk en WebAssembly con el modelo español dentro de la app ----------
  // El reconocimiento de Chrome no existe dentro de una app de escritorio; aquí todo ocurre en el ordenador, sin internet.
  function OfflineListener(onWord, onState) {
    this.onWord = onWord; this.onState = onState || (() => {}); this.on = false; this.ok = true; this.ready = null;
  }
  OfflineListener.prototype.load = function () {
    if (this.ready) return this.ready;
    const st = this.onState;
    this.ready = (async () => {
      st('CARGANDO MODELO DE VOZ');
      if (!window.Vosk) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vosk/vosk.js'; s.onload = res; s.onerror = () => rej(new Error('sin vosk.js')); document.head.appendChild(s); });
      const r = await fetch('vosk/model.tar.gz'); if (!r.ok) throw new Error('sin modelo de voz');
      const model = await window.Vosk.createModel(URL.createObjectURL(await r.blob()));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
      const ac = new AudioContext();
      const rec = new model.KaldiRecognizer(ac.sampleRate);
      rec.on('result', (m) => { const txt = m && m.result && m.result.text; const w = this.on && pickWord(txt); if (w) this.onWord(w, txt); });
      const src = ac.createMediaStreamSource(stream), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0;
      node.onaudioprocess = (e) => { if (this.on) try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} };
      src.connect(node); node.connect(mute); mute.connect(ac.destination);
      this.ac = ac;
    })();
    this.ready.then(() => this.on && st('ESCUCHANDO'), (e) => { this.ok = false; st(/modelo|vosk/i.test(e.message) ? 'SIN MODELO DE VOZ' : /Permission|NotAllowed/i.test(e.name + e.message) ? 'SIN PERMISO DE MICRÓFONO' : 'SIN MICRÓFONO'); this.ready = null; });
    return this.ready;
  };
  OfflineListener.prototype.start = function () { this.on = true; this.load().then(() => { if (this.ac) this.ac.resume(); }, () => {}); };
  OfflineListener.prototype.stop = function () { this.on = false; this.onState('APAGADA'); };

  // dentro de la app de escritorio, offline; en el navegador, el reconocimiento de Chrome
  const isApp = /Electron/i.test(navigator.userAgent);
  function makeListener(onWord, onState) { return isApp ? new OfflineListener(onWord, onState) : new Listener(onWord, onState); }

  window.SemillaVoz = { character, pickWord, family, Listener, OfflineListener, makeListener, isApp, FAMILIES: Object.keys(FAM) };
})();
