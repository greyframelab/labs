# CÓRTEX · estado (28 nov 2026)

VØID_LOOM · CÓRTEX es un instrumento cerebro en tiempo real: un cerebro hecho de neuronas que toca sonido e imagen a partir de una noche real de EEG.
- **Web:** carpeta `cortex/` del repo greyframelab/labs (https://greyframelab.github.io/labs/cortex/).
- **App de escritorio:** carpeta `cortex-app/`, con el .exe y el .dmg en la release `cortex-app-latest`.

## PRs
| PR | Qué | Estado |
|---|---|---|
| #134 | Primera versión: motor en tiempo real y app .exe/.dmg | Mergeada (22 nov). No se cerró por error, como se dijo en el chat: ya estaba mergeada. |
| #136 | Pulido de imagen, calidad automática, instrumento de museo (PÚBLICO, INTÉRPRETE con DDJ-200), tractografía y FX | Mergeada (22 nov) |
| #138 | Voces físicas (AudioWorklet), la voz dibuja, arcos de respuesta, hats 909 IDM | Mergeada (23 nov) |

- Todo está en main. La rama `cortex-v2` no tiene commits pendientes y no hay cambios posteriores en `cortex/` ni en `cortex-app/`.
- Release `cortex-app-latest` publicada el 23 nov, ya con la PR #138.

## Decisiones
- **Concepto:** el cerebro es la red. Es un cerebro protagonista hecho de neuronas, y en la RUPTURA la cámara viaja por dentro de la red.
- **Partitura:** EEG real de una noche de sueño, de la CAP Sleep Database, sujeto sano n16 (PhysioNet, licencia ODC-BY). Son 8,5 h y 7.666 tramos sin artefactos.
- **Estética VØID_LOOM:** el negro manda y la materia es blanco frío casi apagado. El neón cian solo aparece cuando algo dispara, con el frente en blanco incandescente. Un solo acento por pieza, que también usa el glitch.
- **Fondo:** red de neuronas lejana y desenfocada, con disparos de vez en cuando.
- **Modos:**
  - **AUTOPLAY:** pases de unos 32 s con cuatro actos: SEÑAL, TENSIÓN, RUPTURA y ECO.
  - **PÚBLICO · MICRO:** el cerebro duerme hasta que la sala lo toca.
  - **INTÉRPRETE · DDJ-200:** si se toca la DDJ en otro modo, entra al momento.
- **Instrumento (PÚBLICO):**
  - Reposo vivo mínimo: latido muy bajo, respiración y algún disparo suelto.
  - El lóbulo temporal "oye" lo que entra por el micro.
  - Los golpes suenan con un timbre según el brillo del sonido.
  - La voz sostenida "dibuja": el tono mueve la luz por la corteza, de atrás (grave) a delante (agudo).
  - Pregunta y respuesta: un arco de luz cruza de una región a otra y el cerebro contesta armonizado.
  - Aprende el tempo de las palmas y monta un groove; la ruptura llega por la energía de la sala.
  - Cada gesto corta el plano a la región que suena.
- **Seis voces por región:**
  - Chapa modal (frontal).
  - Cuerda Karplus-Strong (central).
  - Formantes (parietal).
  - Pulso de sub (occipital).
  - La voz del visitante en granos (temporal), que solo se guarda en memoria y se borra al cerrar.
  - Micro-clics (cerebelo).
- **Sueños:** cada despertar cambia la escala, el kit, el motor de dron, la sala y la referencia de la skill. La raíz no cambia mientras suena.
- **Audio:** referencia principal Autechre, seco. Bombo rediseñado y hats tipo 909 tratados IDM. Máster alrededor de −14 LUFS; en reposo, alrededor de −21.
- **Imagen:**
  - Tractografía en la ruptura.
  - Interior con conducción saltatoria, sinapsis y neurotransmisor.
  - Luz bajo la corteza.
  - FX: persistencia tipo fosfeno solo en lo que brilla; onda de choque, glitch y pixel sort solo en golpes muy fuertes y en la ruptura; destello anamórfico corto y dark pulse.
- **Calidad automática por fps:** baja la resolución, fija 30 fps y dibuja menos partículas. Los cambios se aplican en un corte de plano.
- **App:** sin internet, con modo instalación (AUTOPLAY, PÚBLICO o INTÉRPRETE), permisos de micro y MIDI sin preguntar y *Pantalla › Calibrar la sala* (tecla K).
- **Firma VØID_LOOM:** desactivada, como en SEMILLA y LIVE.

## Descartado
- El cerebro de laca negra sólida con secciones axiales: "no da el nivel" y las secciones no quedaban bien.
- Un viaje por neuronas sin cerebro: el cerebro tiene que ser el protagonista.
- Neón como color de base: el neón solo es un evento.
- La cabeza de neuronas sin fondo: Toni pidió contexto detrás.
- Un brillo demasiado oscuro: pidió más luz.
- Una pieza que suene sola en PÚBLICO: debe dormir y solo dar señales mínimas de vida.

## Entregado
- `cortex_publico_sim_v2.mp4`: 34 s, 960×540, 24 fps, con audio. Modo PÚBLICO con visitantes simulados. −14,4 LUFS, true peak −1,8 dBTP.
- `cortex_publico_sim_v1.mp4` y `cortex_rt_preview_v2.mp4` (AUTOPLAY, 32 s): versiones anteriores.
- .exe (instalador y portable) y .dmg (arm64 y x64) en la release `cortex-app-latest`.

## Pendiente
- [ ] **Toni:** probar en sala real con micro real (calibrar con K), la DDJ-200 real y GPU real en Windows y Mac. No se ha probado nunca con hardware real.
- [ ] **Toni:** escuchar y ajustar a su oído las seis voces, los sueños y el groove.
- [ ] Valorar en proyección si la RUPTURA lleva demasiado cian.
- [ ] Opcional: despertar por presencia con cámara (como OJO).
- [ ] **Rider técnico para la presentación** (lo pidió Toni). Base: micro de superficie o dos para estéreo, DDJ-200, proyector, altavoces con sub, PC con GPU dedicada y sala oscura.
- [ ] Presentación propia de CÓRTEX, que hable solo de esta pieza, con el mismo ADN VØID_LOOM y su propia identidad (por confirmar cuándo).

## Para retomar
- Partir de main en greyframelab/labs con una rama nueva (`cortex-v2` ya está fusionada).
- **Preview offline con visitantes simulados:** desde `cortex/`, `SIM=1 DUR=34 node tools/preview.js <carpeta> 960 540 24 0 34 1`. Sin `SIM` renderiza AUTOPLAY. Necesita `PW=` apuntando a playwright-core.
- **Regenerar la partitura:** `python3 tools/eeg_night.py n16.edf`.
- **Código:**
  - `partitura.js`: noche de EEG y sueños.
  - `dsp.js`: voces físicas en AudioWorklet.
  - `oido.js`: micro.
  - `instrumento.js`: lógica y cámara.
  - `sonido.js`: motor de sonido.
  - `ddj.js`: DDJ-200.
  - `imagen.js`: WebGL2.
  - `cerebro.js`, `red.js` y `shaders.js`: la materia.
  - `main.js`: arranque.
- **Próximo paso:** la prueba en sala de Toni y, con su feedback, ajustar voces, sensibilidad del micro y el cian de la ruptura.
