/* VØID_LOOM · SEMILLA — la palabra.
   Escucha a la sala (reconocimiento de voz de Chrome, en español), se queda con la palabra con más carga
   y la convierte en carácter: forma, material, luces, acento, trazos, ritmo y las vocales que cantará el dron.
   La palabra nunca se proyecta ni se guarda: solo se nota en la obra. */
(function () {
  'use strict';
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\u00f1]/g, '');

  // familias de sentido: lo que la palabra pinta y cómo suena
  const FAM = {
    agua: { w: 'agua mar lluvia llover rio ola oceano lago llorar lagrima nieve hielo niebla marea ola playa azul frio rocio nube tormenta? sudor', forms: ['pliegue', 'masa'], mats: [2, 0], rigs: [0, 1], acc: ['cian', 'blanco'], stroke: 2, den: 0.45, cha: 0.3, refs: ['cinta', 'abismo'] },
    fuego: { w: 'fuego llama sol calor rabia ira furia sangre guerra quemar volcan rojo pasion infierno arder brasa incendio odio lucha', forms: ['espina', 'fractura'], mats: [1, 2], rigs: [3, 2], acc: ['rojo', 'ambar'], stroke: 1, den: 0.8, cha: 0.75, refs: ['quiebre', 'pulso'] },
    amor: { w: 'amor beso corazon abrazo deseo carino ternura piel madre padre hijo hija querer amar amiga amigo familia dulce caricia', forms: ['masa', 'concha'], mats: [0, 3], rigs: [1, 0], acc: ['magenta', 'rojo'], stroke: 3, den: 0.5, cha: 0.35, refs: ['vaiven', 'cinta'] },
    miedo: { w: 'miedo sombra noche oscuridad oscuro muerte morir terror soledad vacio angustia pesadilla fantasma frio perdido dolor ausencia herida', forms: ['monolito', 'concha'], mats: [3, 1], rigs: [3, 2], acc: ['violeta', 'blanco'], stroke: 4, den: 0.3, cha: 0.55, refs: ['abismo', 'rejilla'] },
    luz: { w: 'luz dia oro alba amanecer estrella brillo esperanza cielo luna blanco despertar mirar ojo ver claro', forms: ['concha', 'torsion'], mats: [2, 0], rigs: [1, 0], acc: ['ambar', 'blanco'], stroke: 6, den: 0.5, cha: 0.3, refs: ['cinta', 'abismo'] },
    tiempo: { w: 'tiempo memoria recuerdo reloj pasado futuro olvido historia ayer manana siempre nunca viejo infancia espera', forms: ['columnas', 'monolito'], mats: [0, 1], rigs: [2, 0], acc: ['ambar', 'cian'], stroke: 7, den: 0.45, cha: 0.4, refs: ['rejilla', 'cinta'] },
    maquina: { w: 'maquina codigo robot datos red ciudad metal ordenador inteligencia algoritmo pantalla tecnologia sistema motor cable digital', forms: ['torsion', 'columnas'], mats: [2, 0], rigs: [2, 1], acc: ['verde', 'cian'], stroke: 5, den: 0.65, cha: 0.5, refs: ['rejilla', 'pulso'] },
    calma: { w: 'calma paz silencio respirar sueno dormir quietud nada descanso suave lento blanco meditar flotar', forms: ['monolito', 'pliegue'], mats: [0, 3], rigs: [0, 1], acc: ['blanco', 'cian'], stroke: 2, den: 0.2, cha: 0.15, refs: ['cinta', 'abismo'] },
    caos: { w: 'caos ruido grito explosion locura fiesta baile tormenta rompe romper choque velocidad prisa nervios estres', forms: ['fractura', 'espina'], mats: [1, 2], rigs: [2, 3], acc: ['magenta', 'ambar'], stroke: 5, den: 0.9, cha: 0.95, refs: ['quiebre', 'vaiven'] },
    vida: { w: 'vida semilla nacer flor arbol tierra verde bosque cuerpo crecer raiz hoja jardin animal planta respirar', forms: ['masa', 'concha'], mats: [1, 0], rigs: [1, 3], acc: ['verde', 'ambar'], stroke: 3, den: 0.55, cha: 0.45, refs: ['vaiven', 'cinta'] },
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

  // ---------- SENTIDO: todo el idioma ----------
  // sentido.txt: ~40.000 palabras del español con 8 ejes de significado (0–f) y su arquetipo más cercano.
  // Se calculó una vez con vectores de palabras (ver semilla/README); aquí solo se lee. Sin internet.
  const AXES = ['valencia', 'activacion', 'calor', 'luz', 'maquina', 'dureza', 'peso', 'abstraccion'];
  const ARQ = ['agua', 'fuego', 'amor', 'miedo', 'luz', 'tiempo', 'maquina', 'calma', 'caos', 'vida'];
  const SENT = new Map(); let KEYS = [];
  const sentidoReady = fetch((window.SEMILLA_BASE || '') + 'sentido.txt').then((r) => r.ok ? r.text() : '').then((t) => {
    for (const line of t.split('\n')) { if (!line || line[0] === '#') continue; const i = line.indexOf(' '); SENT.set(line.slice(0, i), line.slice(i + 1)); }
    KEYS = [...SENT.keys()].sort();
  }).catch(() => {});
  // lee una palabra; si no está, busca su raíz (incendiaron → incendi…) entre las conocidas
  function sentido(w) {
    let code = SENT.get(w), via = w;
    if (!code && KEYS.length && w.length >= 5) {
      for (let cut = w.length - 1; cut >= Math.max(4, w.length - 4) && !code; cut--) {
        const pre = w.slice(0, cut); let lo = 0, hi = KEYS.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (KEYS[m] < pre) lo = m + 1; else hi = m; }
        let bestK = null;
        for (let j = lo; j < KEYS.length && KEYS[j].startsWith(pre) && j < lo + 40; j++) if (!bestK || Math.abs(KEYS[j].length - w.length) < Math.abs(bestK.length - w.length)) bestK = KEYS[j];
        if (bestK) { code = SENT.get(bestK); via = bestK; }
      }
    }
    if (!code) return null;
    const ax = {}; AXES.forEach((k, i) => (ax[k] = parseInt(code[i], 16) / 15));
    return { ax, arq: ARQ[parseInt(code[8], 16)], fuerza: parseInt(code[9], 16) / 15, via };
  }
  // cuánta carga tiene una palabra (para elegir la más significativa de una frase)
  function carga(w) {
    if (family(w)) return 9;
    const s = sentido(w); if (!s) return 0;
    return s.fuerza * 5 + AXES.reduce((a, k) => a + Math.abs(s.ax[k] - 0.53), 0);
  }

  // carácter que sale de una palabra (siempre el mismo para la misma palabra; la pieza cambia con el instante)
  function character(word) {
    const w = norm(word), S = window.SEMILLA, R = S.mulberry(S.hashStr('carácter:' + w));
    const pick = (a) => a[Math.floor(R() * a.length)];
    const sn = sentido(w), ax = sn ? sn.ax : null;
    let k = family(w), f;
    if (!k && sn && sn.fuerza >= 0.5) k = sn.arq;          // cerca de un arquetipo: lo hereda (hoguera → fuego)
    if (k) f = FAM[k];
    else if (ax) {
      // cualquier otra palabra: su carácter sale de sus ejes de significado
      const { valencia: v, activacion: a, calor: c, luz: l, maquina: m, dureza: d, peso: p, abstraccion: b } = ax;
      const acc = m > 0.75 ? pick(['verde', 'cian']) : c > 0.68 ? (v < 0.45 ? 'rojo' : 'ambar') : c < 0.32 ? (v < 0.45 ? 'violeta' : 'cian')
        : l < 0.3 ? (v < 0.45 ? 'violeta' : 'rojo') : a > 0.7 && v > 0.55 ? 'magenta' : l > 0.7 ? 'blanco' : pick(['blanco', 'cian', 'ambar', 'violeta']);
      const forms = b > 0.72 ? ['mobius', 'laminas', 'concha'] : d > 0.65 && p > 0.6 ? ['monolito', 'fractura', 'torsion'] : d > 0.65 && a > 0.6 ? ['espina', 'fractura']
        : d < 0.35 ? ['masa', 'pliegue', 'concha'] : m > 0.65 ? ['torsion', 'laminas', 'fractura'] : ['concha', 'torsion', 'masa', 'pliegue'];
      f = {
        forms, acc: [acc, l < 0.4 ? 'blanco' : pick(['blanco', 'cian', 'ambar'])],
        mats: [d > 0.62 ? (m > 0.6 ? 2 : 1) : d < 0.38 ? 3 : 0], rigs: [l < 0.35 ? 3 : a > 0.65 ? 2 : l > 0.62 ? 1 : 0],
        stroke: c > 0.7 ? 1 : l < 0.3 ? 4 : m > 0.65 ? 5 : l > 0.7 ? 6 : d < 0.35 || c < 0.3 ? 2 : v > 0.65 ? 3 : 7,
        den: 0.2 + 0.65 * a, cha: 0.15 + 0.6 * a + 0.25 * (1 - v) * a,
        refs: [a > 0.66 ? (m > 0.55 || v < 0.45 ? 'quiebre' : 'pulso') : a < 0.35 ? (l < 0.45 || v < 0.45 ? 'abismo' : 'cinta') : m > 0.6 ? 'rejilla' : v > 0.55 ? 'vaiven' : 'rejilla'],
      };
      k = sn.fuerza >= 0.45 ? sn.arq                           // tratamiento: el arquetipo cercano, o el eje que más destaca
        : c > 0.85 ? 'fuego' : l < 0.15 ? 'miedo' : l > 0.85 ? 'luz' : m > 0.85 ? 'maquina' : a > 0.85 ? 'caos' : a < 0.15 ? 'calma' : 'sentido';
    } else {
      // palabra desconocida (un nombre, una palabra inventada): manda su sonido
      const n = w.length || 1, sharp = (w.match(/[ptkcqbdg]/g) || []).length / n, open = (w.match(/[aou]/g) || []).length / n, rr = (w.match(/r/g) || []).length / n;
      const acc = Object.keys(S.ACCENTS)[Math.floor(R() * 7)];
      f = sharp > 0.28 ? { forms: ['fractura', 'espina', 'torsion'], mats: [1, 2], rigs: [2, 3], acc: [acc, 'blanco'], stroke: 5, den: 0.6 + sharp * 0.5, cha: 0.5 + rr * 2, refs: ['rejilla', 'quiebre'] }
        : open > 0.42 ? { forms: ['masa', 'pliegue', 'concha'], mats: [0, 3], rigs: [0, 1], acc: [acc, 'blanco'], stroke: 3, den: 0.4 + n * 0.03, cha: 0.3 + rr * 2, refs: ['cinta', 'abismo', 'vaiven'] }
          : { forms: ['monolito', 'columnas', 'concha'], mats: [0, 1, 2], rigs: [0, 1, 2], acc: [acc, 'blanco'], stroke: 7, den: 0.45, cha: 0.4 + rr * 2, refs: ['rejilla', 'pulso', 'abismo'] };
      k = 'sonido';
    }
    const c1 = pick(f.acc), c2 = f.acc.find((x) => x !== c1) || 'blanco';
    let den = f.den, cha = f.cha;
    if (ax && FAM[k]) { den = 0.6 * den + 0.4 * (0.2 + 0.65 * ax.activacion); cha = 0.6 * cha + 0.4 * (0.15 + 0.7 * ax.activacion); }
    return {
      fam: k, form: w.length >= 3 && R() < 0.7 ? 'palabra' : pick(f.forms), mat: pick(f.mats), rig: pick(f.rigs), accent: c1,
      stroke: { style: f.stroke, c1: S.ACCENTS[c1], c2: S.ACCENTS[c2] },
      density: Math.min(0.95, den + (R() - 0.5) * 0.1), chaos: Math.min(0.95, cha + (R() - 0.5) * 0.1),
      ref: pick(f.refs), vowels: vowels(w), syll: syllables(w), axes: ax ? AXES.map((x) => +ax[x].toFixed(3)) : null,
    };
  }
  // de una frase oída, la palabra con más carga de significado
  function pickWord(text) {
    const ws = String(text || '').split(/\s+/).map((x) => ({ raw: x, n: norm(x) })).filter((x) => x.n.length >= 3 && !STOP.has(x.n));
    if (!ws.length) return null;
    ws.forEach((x) => (x.c = carga(x.n) + x.n.length * 0.01));
    return ws.sort((a, b) => b.c - a.c)[0].n;
  }

  // PALABRA TEMPRANA: no se espera a que el visitante acabe la frase. Si la misma palabra aparece en dos lecturas
  // parciales seguidas, ya vale; la lectura final solo la confirma (y no se repite si ya salió).
  function early(onWord) {
    let cand = null, n = 0, fired = null, firedAt = 0;
    const fire = (w, txt) => { if (w === fired && Date.now() - firedAt < 5000) return; fired = w; firedAt = Date.now(); onWord(w, txt); };
    return {
      partial(txt) { const w = pickWord(txt); if (!w) return; if (w === cand) n++; else { cand = w; n = 1; } if (n >= 2) fire(w, txt); },
      final(txt) { const w = pickWord(txt); cand = null; n = 0; if (w) fire(w, txt); },
    };
  }

  // ---------- escucha ----------
  function Listener(onWord, onState) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.ok = !!SR; this.on = false; this.onWord = onWord; this.onState = onState || (() => {});
    if (!SR) { this.onState('SIN VOZ EN ESTE NAVEGADOR'); return; }
    const r = (this.r = new SR());
    r.lang = 'es-ES'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    const ear = early((w, txt) => this.onWord(w, txt));
    r.onstart = () => this.onState('ESCUCHANDO');
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript; this.heard = txt;
        if (e.results[i].isFinal) ear.final(txt); else ear.partial(txt);
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
    this.level = 0; this.heard = ''; this.deviceId = null;
  }
  OfflineListener.prototype.load = function () {
    if (this.ready) return this.ready;
    const st = this.onState;
    this.ready = (async () => {
      st('CARGANDO MODELO DE VOZ');
      if (!window.Vosk) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vosk/vosk.js'; s.onload = res; s.onerror = () => rej(new Error('sin vosk.js')); document.head.appendChild(s); });
      const r = await fetch('vosk/model.tar.gz'); if (!r.ok) throw new Error('sin modelo de voz');
      const model = await window.Vosk.createModel(URL.createObjectURL(await r.blob())).catch((e) => { throw new Error('modelo: ' + (e && e.message || e || 'no carga')); });
      this.model = model;
      await this.openMic();
    })();
    this.ready.then(() => this.on && st('ESCUCHANDO'), (e) => {
      const m = String((e && (e.name + ' ' + e.message)) || e || '');
      console.error('[voz offline]', m);
      st(/modelo|vosk/i.test(m) ? 'SIN MODELO DE VOZ' : /Permission|NotAllowed|Security/i.test(m) ? 'SIN PERMISO DE MICRÓFONO' : /NotFound|Device/i.test(m) ? 'SIN MICRÓFONO' : 'ERROR DE VOZ');
      this.ready = null;
    });
    return this.ready;
  };
  // abre el micrófono elegido (o el de por defecto) y lo conecta al reconocedor; mide el nivel para la consola
  OfflineListener.prototype.openMic = async function () {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ac) try { await this.ac.close(); } catch (e) {}
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };
    if (this.deviceId) audio.deviceId = { exact: this.deviceId };
    const stream = (this.stream = await navigator.mediaDevices.getUserMedia({ audio, video: false }));
    const ac = (this.ac = new AudioContext());
    const rec = new this.model.KaldiRecognizer(ac.sampleRate);
    const ear = early((w, txt) => this.on && this.onWord(w, txt));
    rec.on('result', (m) => { const txt = m && m.result && m.result.text; if (txt) { this.heard = txt; ear.final(txt); } });
    rec.on('partialresult', (m) => { const p = m && m.result && m.result.partial; if (p) { this.heard = p + '…'; ear.partial(p); } });
    const src = ac.createMediaStreamSource(stream), node = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0;
    node.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0); let s2 = 0; for (let i = 0; i < d.length; i += 4) s2 += d[i] * d[i];
      this.level = Math.min(1, Math.sqrt(s2 / (d.length / 4)) * 8);
      if (this.on) try { rec.acceptWaveform(e.inputBuffer); } catch (err) {}
    };
    src.connect(node); node.connect(mute); mute.connect(ac.destination);
    this.micName = (stream.getAudioTracks()[0] || {}).label || 'MICRÓFONO';
  };
  OfflineListener.prototype.setDevice = function (id) { this.deviceId = id || null; if (this.model) this.openMic().then(() => this.onState('ESCUCHANDO'), (e) => this.onState('SIN MICRÓFONO')); };
  OfflineListener.prototype.start = function () { this.on = true; this.load().then(() => { if (this.ac) this.ac.resume(); }, () => {}); };
  OfflineListener.prototype.stop = function () { this.on = false; this.onState('APAGADA'); };

  // dentro de la app de escritorio, offline; en el navegador, el reconocimiento de Chrome
  const isApp = /Electron/i.test(navigator.userAgent);
  function makeListener(onWord, onState) { return isApp ? new OfflineListener(onWord, onState) : new Listener(onWord, onState); }

  window.SemillaVoz = { character, pickWord, family, sentido, sentidoReady, AXES, Listener, OfflineListener, makeListener, isApp, FAMILIES: Object.keys(FAM) };
})();
