# VØID_LOOM · CÓRTEX

Un cerebro hecho de neuronas, proyectado en sala oscura, que toca su propio sonido. La partitura es una noche real de sueño: un electroencefalograma (EEG) de una persona sana. Lo que suena, lo que se enciende en la corteza y el montaje de cámara salen de esa misma partitura. Ningún pase se repite.

**Abrir:** https://greyframelab.github.io/labs/cortex/ (Chrome o Edge). **F**: pantalla completa.

## Modos
| Modo | Qué hace |
|---|---|
| AUTOPLAY | Infinito. Cada pase (≈32 s, 16 compases a 120 BPM) toca un tramo distinto de la noche: 8,5 h de sueño y 7.666 tramos sin artefactos. |
| PÚBLICO · MICRO | **Un instrumento.** Sin nadie, el cerebro duerme: latido muy bajo, respiración y algún disparo suelto. La sala lo toca con la voz y las manos (abajo). |
| INTÉRPRETE · DDJ-200 | Lo tocas tú con la DDJ-200 (y el micro suma si hay público). Si se toca la DDJ en cualquier otro modo, entra al momento. |

**Teclas:** F pantalla completa · K calibrar la sala (4 s en silencio; se recuerda) · P / I pasar a PÚBLICO / INTÉRPRETE.

### El instrumento (PÚBLICO)
- **Te oye:** el lóbulo temporal (el oído) vibra con lo que llega al micro.
- **Golpe** (palmada, chasquido, golpe en la mesa): dispara una región y su voz. El timbre sale del brillo del sonido: sordo → pulso de sub (occipital); medio → cuerda física (central) o voz en granos (temporal); brillante → metal FM (frontal) o micro-clics (cerebelo). Cada golpe corta el plano a la región que suena.
- **Voz sostenida:** la región se queda encendida mientras dura y el cerebro sostiene la nota, ajustada a la escala del sueño (grave → temporal, media → parietal, aguda → frontal). Travelling lento sobre la corteza.
- **Pregunta y respuesta:** al callarse, el cerebro contesta la frase transformada (otras regiones y timbres; en espejo, a otra velocidad o transportada).
- **Aprende el tempo:** con palmas regulares se sincroniza y construye un groove IDM encima.
- **Ruptura:** un sonido muy fuerte con la sala encendida desgarra el cerebro, aparece la tractografía y la cámara viaja dentro. Después, ECO y vuelta al sueño.
- **Tu voz en granos:** los últimos segundos de voz se quedan **solo en memoria** para que el lóbulo temporal la cante en granos. No se graba en disco, no se envía, no se guarda; se borra al cerrar.
- **Cada sesión es un sueño distinto:** escala, kit, motor de dron, sala y referencia de la skill cambian al despertar.

### DDJ-200 (INTÉRPRETE)
| Control | Acción |
|---|---|
| Pads A 1–6 | Golpe en cada región (frontal, central, parietal, occipital, temporal, cerebelo) |
| Pad A 7 · Pad A 8 | El cerebro contesta · RUPTURA |
| SHIFT + pads A 1–6 | Nota sostenida por región (mientras se mantiene) |
| Pads B 1–8 | Groove on/off · negro · glitch · onda de choque · dentro · tractografía · nuevo sueño · dormir |
| SHIFT + pads B 1–8 | Planos: macro, región, cenital, bajo, órbita, grúa, alejamiento, sueño |
| Jog A · Jog B | Recorre la noche de sueño · gira la cámara |
| Fader A · Fader B | Actividad · drones |
| EQ A (HI · MID · LOW) | Brillo de los metales · densidad del groove · peso del sub |
| Tempo A | BPM del groove (90–150) |
| PLAY · CUE · SYNC (A) | Despierta / duerme · RUPTURA · groove al tempo del controlador |
| Crossfader | Fuera (el cerebro) ↔ dentro (la red de neuronas) |

## La partitura
- **Fuente:** CAP Sleep Database, sujeto sano n16 (PhysioNet, licencia ODC-BY). Cinco canales (Fp2-F4, F4-C4, C4-P4, P4-O2, C4-A1).
- **Bandas → sonido e imagen:**

| Banda | Sonido | Imagen |
|---|---|---|
| Delta | sub y latido del bombo | la materia respira |
| Theta | bajo, formante del dron | densidad de golpes fantasma |
| Alfa | brillo del dron FM | — |
| Sigma (husos de sueño) | ratchets | ondas en la corteza |
| Beta | densidad de micro-golpes | qué región se enciende y cuántas neuronas disparan dentro |
| Gamma | timbre de los golpes, glitch | glitch y onda de choque |

- Cada golpe acentuado enciende la región del cerebro cuyo canal está más activo en ese instante.

## La pieza (cuatro actos por pase)
- **SEÑAL:** sale de negro. Órbitas lentas y disparos sueltos; el bombo late como un corazón.
- **TENSIÓN:** cortes cada segundo (macro de surco, plano bajo, lateral, cenital). Más ondas. Antes del golpe, negro.
- **RUPTURA:** el cerebro se desgarra siguiendo los surcos, con onda de choque y glitch. La cámara se lanza dentro y viaja por la red de neuronas; dentro, las neuronas disparan con el bombo.
- **ECO:** fuera otra vez. El cerebro se recompone y se apaga.

## Imagen
- **Cerebro:** 1,5 millones de partículas (2,6 con `?q=2`) sobre la corteza, con circunvoluciones, cisura de Silvio, cerebelo con folias y tronco. La materia es blanco frío casi apagado y el neón solo existe donde hay actividad: frente incandescente y luz atrapada en los surcos.
- **Tractografía:** en la ruptura el cerebro se vuelve translúcido y aparecen los haces de fibra (cuerpo calloso, proyección y asociación), recorridos por impulsos.
- **Interior:** neuronas crecidas por código. El impulso salta de nodo en nodo por el axón (conducción saltatoria), destella en los botones sinápticos y suelta una nube de neurotransmisor.
- **Fondo:** la red de neuronas lejana y desenfocada.
- **FX:** persistencia (los disparos dejan huella, como un fosfeno; solo lo que brilla), onda de choque, glitch en el mismo acento y pixel sort solo en golpes muy fuertes y en la ruptura, destello anamórfico corto, dark pulse y profundidad de campo real.
- Un solo acento por pieza: cian (`?neon=r,g,b` para probar otro).

## Fluidez
Calidad automática: si no llega a 60 fps, por este orden baja la resolución al 80 %, fija 30 fps exactos, dibuja el 65 % de las partículas, baja al 60 % y al 45 % de las partículas. Si va sobrado, recupera poco a poco. Los cambios esperan a un corte de plano.

## Sonido
Motor WebAudio en vivo (referencia: Autechre; seco, ritmo en plantillas que rotan): bombo diseñado, micro-golpes FM (DATOS), bajo, sub, dron FM, dron aditivo con formante y la segunda menor de la ruptura. Estante −6 dB desde 2,2 kHz, compresor y limitador en el máster; ≈ −13 LUFS (en sala manda el volumen).

## Herramientas
- `tools/eeg_night.py n16.edf`: regenera `noche.bin` / `noche.json` (2 Hz, 6 bandas × 5 canales).
- `tools/preview.js`: render offline (frames + audio) con el mismo motor. Con `SIM=1`, visitantes simulados (palmadas, voz, silencio, palmas a tempo, un grito) para validar el modo PÚBLICO. `index.html?render=1` expone `window.CORTEX.prepara(dur)`, `frame(t)` y `audio(dur)`.

## Código
`partitura.js` (noche de EEG y sueños) · `oido.js` (micro) · `instrumento.js` (lógica: AUTOPLAY, instrumento, cámara) · `sonido.js` (motor WebAudio) · `ddj.js` (DDJ-200) · `imagen.js` (WebGL2) · `cerebro.js` / `red.js` / `shaders.js` (materia) · `main.js` (arranque).

## App de escritorio
[`cortex-app/`](../cortex-app/README.md): .exe y .dmg sin internet, con modo instalación.
