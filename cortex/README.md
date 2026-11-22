# VØID_LOOM · CÓRTEX

Un cerebro hecho de neuronas, proyectado en sala oscura, que toca su propio sonido. La partitura es una noche real de sueño: un electroencefalograma (EEG) de una persona sana. Lo que suena, lo que se enciende en la corteza y el montaje de cámara salen de esa misma partitura. Ningún pase se repite.

**Abrir:** https://greyframelab.github.io/labs/cortex/ (Chrome o Edge). **F**: pantalla completa.

## Modos
| Modo | Qué hace |
|---|---|
| AUTOPLAY | Infinito. Cada pase (≈32 s, 16 compases a 120 BPM) toca un tramo distinto de la noche: 8,5 h de sueño y 7.666 tramos sin artefactos. |
| PÚBLICO · MICRO | El micrófono de la sala entra al cerebro como un canal más. Cada sonido fuerte lanza una onda por la corteza y una ráfaga; la energía sostenida lo lleva a la RUPTURA; el silencio lo devuelve al sueño. |

El micro se analiza en el ordenador: no se graba, no se envía y no se guarda.

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
- **Cerebro:** 1,5 millones de partículas (2,6 con `?q=2`) sobre la corteza, siguiendo circunvoluciones, cisura de Silvio, cerebelo con folias y tronco, más microneuronas que solo se ven al disparar. Materia blanca fría casi apagada: el neón solo existe donde hay actividad, con frente incandescente.
- **Fondo:** la red de neuronas del viaje, lejana y desenfocada, con disparos que recorren sus ramas.
- **Interior:** cientos de neuronas crecidas por código (soma, apical, basales, axón).
- **FX:** onda de choque con refracción, glitch de franjas en el mismo acento, pixel sort, destello anamórfico corto, dark pulse, profundidad de campo real.
- Un solo acento por pieza: cian (`?neon=r,g,b` para probar otro).

## Sonido
Motor WebAudio en vivo (referencia: Autechre; seco, ritmo en plantillas que rotan): bombo diseñado, micro-golpes FM (DATOS), bajo, sub, dron FM, dron aditivo con formante y la segunda menor de la ruptura. Estante −6 dB desde 2,2 kHz, compresor y limitador en el máster.

## Herramientas
- `tools/eeg_night.py n16.edf`: regenera `noche.bin` / `noche.json` (2 Hz, 6 bandas × 5 canales).
- `tools/preview.js`: render offline (frames + audio) con el mismo motor. `index.html?render=1` expone `window.CORTEX.frame(t)` y `window.CORTEX.audio(dur)`.

## App de escritorio
[`cortex-app/`](../cortex-app/README.md): .exe y .dmg sin internet, con modo instalación.
