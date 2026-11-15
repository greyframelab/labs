/* VØID_LOOM · OJO — sonido de la mirada (opcional, apagado por defecto).
   Solo senos y FM, todo por debajo de ~1,5 kHz, sin ruido:
   · dron grave en Re cuyo filtro y batido siguen la energía de la escena
   · pulso IDM contenido (euclidiano, swing irregular) que se densifica con el movimiento y con cada persona
   · sacádico → tick metálico panoramizado donde mira · alguien entra → golpe grave con resonancia de placa
   · CONTACTO → el ritmo se corta, silencio, crece un clúster y cae un impacto; al soltar, cola larga */
(function (root) {
  'use strict';
  const OJO = root.OJO || (root.OJO = {});
  OJO.sound = function () {
    let ac = null, out = null, comp = null, filt = null, droneG = null, oscs = [], timer = null;
    let step = 0, nextT = 0, energy = 0, subs = 0, contact = 0, muteUntil = 0, vol = 0.8;
    const BPM = 88, SD = 60 / BPM / 4;

    const euclid = (k, n, rot = 0) => { const r = []; for (let i = 0; i < n; i++) r.push(((i + rot) * k) % n < k ? 1 : 0); return r; };

    function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    function kick(t, v) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(41, t + 0.11);
      env(g, t, 0.004, v, 0.42); o.connect(g).connect(comp); o.start(t); o.stop(t + 0.5);
      // capa de cuerpo
      const o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = 'triangle'; o2.frequency.setValueAtTime(180, t); o2.frequency.exponentialRampToValueAtTime(70, t + 0.04);
      env(g2, t, 0.002, v * 0.25, 0.05); o2.connect(g2).connect(comp); o2.start(t); o2.stop(t + 0.1);
    }
    function metal(t, f, v, pan = 0, dec = 0.09) {
      const c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain(), lp = ac.createBiquadFilter(), p = ac.createStereoPanner();
      c.frequency.value = f; m.frequency.value = f * 1.414;
      mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dec);
      lp.type = 'lowpass'; lp.frequency.value = 1400; p.pan.value = Math.max(-1, Math.min(1, pan));
      m.connect(mg).connect(c.frequency);
      env(g, t, 0.003, v, dec);
      c.connect(g).connect(lp).connect(p).connect(comp);
      c.start(t); m.start(t); c.stop(t + dec + 0.05); m.stop(t + dec + 0.05);
    }
    function plate(t, base, v, dec) {
      [1, 1.41, 2.1, 2.76].forEach((r, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = base * r * (1 + (i % 2 ? 0.003 : -0.002));
        env(g, t, 0.004, v / (1 + i * 0.8), dec / (1 + i * 0.35)); o.connect(g).connect(comp); o.start(t); o.stop(t + dec + 0.1);
      });
    }
    function swell(t) {
      [146.83, 155.56, 220, 73.42].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 + (i === 3 ? 0.06 : 0), t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.62);
        o.connect(g).connect(comp); o.start(t); o.stop(t + 1.7);
      });
      kick(t + 1.6, 0.9); plate(t + 1.6, 98, 0.22, 2.8);
    }

    function tick() {
      const ahead = ac.currentTime + 0.12;
      while (nextT < ahead) {
        const s = step % 32, t = nextT + (s % 2 ? SD * 0.14 * Math.sin(step * 0.7) : 0);
        if (t > muteUntil && contact < 0.5) {
          const dens = Math.min(1, energy * 0.8 + subs * 0.25);
          const K = euclid(3, 16, 0), M = euclid(3 + Math.round(dens * 6), 16, 2), H = euclid(5 + Math.round(dens * 6), 16, 1);
          const i = s % 16;
          if (K[i] && (s < 16 || i !== 12)) kick(t, 0.55 + dens * 0.25);
          if (s === 28 && dens > 0.4) kick(t, 0.35);
          if (M[i]) metal(t, 220 + ((step * 7) % 5) * 37, 0.05 + dens * 0.07, Math.sin(step * 1.3) * 0.5, 0.06 + dens * 0.05);
          if (H[i] && dens > 0.15) metal(t, 690 + (i % 3) * 61, 0.018 + dens * 0.02, Math.sin(step * 2.1) * 0.8, 0.025);
          if (s === 0 && subs) plate(t, 110, 0.05, 1.2);
        }
        nextT += SD; step++;
      }
      // dron
      const tt = ac.currentTime;
      filt.frequency.setTargetAtTime(110 + energy * 380 + subs * 60 + contact * 600, tt, 0.4);
      oscs[1].detune.setTargetAtTime(4 + energy * 18, tt, 0.6);
      droneG.gain.setTargetAtTime(0.16 + contact * 0.08, tt, 0.5);
    }

    return {
      get on() { return !!ac && ac.state === 'running'; },
      async start() {
        if (!ac) {
          ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
          out = ac.createGain(); out.gain.value = vol;
          comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
          comp.connect(out).connect(ac.destination);
          filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 140; filt.Q.value = 0.9;
          droneG = ac.createGain(); droneG.gain.value = 0.0001;
          filt.connect(droneG).connect(comp);
          [[36.71, 'sine', 1], [36.71, 'sine', 0.8], [73.42, 'triangle', 0.25], [55, 'sine', 0.35]].forEach(([f, ty, g], i) => {
            const o = ac.createOscillator(), gg = ac.createGain(); o.type = ty; o.frequency.value = f; gg.gain.value = g;
            o.connect(gg).connect(filt); o.start(); oscs.push(o);
          });
          nextT = ac.currentTime + 0.1;
        }
        await ac.resume();
        out.gain.setTargetAtTime(vol, ac.currentTime, 0.2);
        if (!timer) timer = setInterval(tick, 25);
      },
      stop() {
        if (!ac) return;
        out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
        clearInterval(timer); timer = null;
        setTimeout(() => ac && ac.suspend(), 400);
      },
      setVolume(v) { vol = v; if (out) out.gain.setTargetAtTime(v, ac.currentTime, 0.05); },
      update(e, n, c) { energy = e || 0; subs = Math.min(3, n || 0); contact = c || 0; },
      event(ev) {
        if (!ac || ac.state !== 'running') return;
        const t = ac.currentTime + 0.01;
        if (ev.type === 'sacada') metal(t, 330 + Math.random() * 120, 0.05, ((ev.x || 0.5) - 0.5) * 1.6, 0.05);
        else if (ev.type === 'entra') { kick(t, 0.8); plate(t, 82, 0.16, 1.8); }
        else if (ev.type === 'sale') plate(t, 65, 0.08, 1.4);
        else if (ev.type === 'contacto') { muteUntil = t + 2.2; swell(t + 0.25); }
        else if (ev.type === 'fin-contacto') { plate(t, 73.4, 0.12, 3.2); muteUntil = t + 0.6; }
        else if (ev.type === 'modo') { kick(t, 0.7); metal(t, 260, 0.08, 0, 0.18); }
      },
    };
  };
})(window);
