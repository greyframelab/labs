# VØID_LOOM LIVE

Rig para tocar en directo todas las piezas de VØID_LOOM, con imagen al proyector y audio sincronizados. Funciona en Chrome y no necesita instalar nada.

**Abrir:** https://greyframelab.github.io/labs/live/

## Montaje
1. Conecta el proyector como pantalla extendida y la salida de audio (tarjeta o mesa).
2. Abre la consola y pulsa **ARRANCAR**. Se abre la ventana de **salida**: arrástrala al proyector y pulsa **F** para ponerla a pantalla completa.
3. La biblioteca se llena sola con todas las piezas VØID_LOOM publicadas en Labs (lee el README del repo).
4. Si la imagen va por detrás del sonido en el proyector, sube **SINCRO A/V** hasta que los golpes coincidan.

## Cómo funciona
- Las piezas no se exportan a vídeo: la salida carga cada lab en un iframe (`?live`) y lo dibuja con su propia función `render(t)`. La resolución es nativa, sin pérdida de calidad.
- Consola y salida comparten un reloj. Solo se envían los cambios de estado (saltar, loop, velocidad…) y las dos calculan la misma posición (`core.js`).
- El audio de cada pieza se decodifica en Web Audio: loop con crossfade de igual potencia, reversa, cinta, stutter, aislador de 3 bandas con kill, filtro, eco y sala.
- Golpes: se detectan del audio o se leen de la partitura si la pieza los declara.

## Lo que puede declarar una pieza (opcional)
En `MotionTimeline.mount({ ..., live: { ... } })`:
- `loops: [[a, b], ...]`: zonas que repiten perfectas, sin fundido. Si no hay, el loop del acto usa un fundido corto.
- `hits: [s, ...]`: golpes exactos de la partitura.
- `bpm`: tempo de la pieza, si lo tiene.
- `stems: { dron, golpes, ritmo, ruptura }`: pistas separadas (reservado para la v1 del rig).

## Inputs de código (opcionales, apagados por defecto)
- **PIEZA · BLOOM / FLASH:** cambian el postproceso propio de cada pieza (`VL.post`), no se aplican como efecto encima. Al centro (1×) la pieza queda como fue diseñada.
- **PIEZA · LÍNEAS:** intensidad de las líneas horizontales (scanlines) que llevan las piezas. Por defecto al 20 %, porque en proyección ensucian; 100 % es como en la web, 0 las quita.
- **Deck C · live coding:** con la tecla ` o EDITAR CÓDIGO se abre un editor GLSL. Se escribe `vec3 code(vec2 uv)`, se compila con Ctrl/⌘ + Enter y entra con MEZCLA C. Tiene acceso a `img(uv)` (mezcla de A y B), `deckA`, `deckB`, `prev` (su frame anterior), `t`, `golpe`, `graves`, `medios`, `agudos`, `acento`, `res`, `aspect` y a `noise`, `fbm`, `hash` y `rot`. Si el código tiene un error, se marca la línea y sigue funcionando el último código bueno. Incluye los presets CONTORNO, REJILLA y DERIVA.
- **VER EL CÓDIGO (tecla K):** proyecta el programa real de la pieza en el aire, que avanza con `t`, junto a sus valores vivos (t, frame, acto, bloom, flash, golpe, audio), la traza de lo que pasa (golpes → `VL.post`, actos, vueltas, órdenes de la consola) y el código del deck C cuando está activo. La opacidad se ajusta con su propio knob.
  - **VER CÓDIGO COMO** (⇧K pasa de uno a otro):
    - **PANTALLA:** el programa y la traza ocupan toda la proyección.
    - **VENTANA:** una consola pequeña tipo PowerShell en una esquina.
    - **ALTERNAR:** pasa de PANTALLA a VENTANA y vuelta, nunca las dos a la vez, cada 7–16 s y siempre en un golpe. Pensado para el AUTOPLAY.
    - **MÁQUINA:** la imagen convertida en una página del código real de la pieza. Cada carácter brilla con la luz que tiene debajo, los contornos se encienden con el acento de la pieza, un cursor de lectura recorre la imagen y en cada golpe la página avanza y los contornos se reescriben. Lo dibuja la GPU en el paso final; apagado no cuesta nada.

## AUTOPLAY

`P` o el botón AUTOPLAY recorre las piezas en orden aleatorio, sin repetir hasta pasar por todas, y funde de una a otra tras 1, 2 o 3 vueltas (VUELTAS). Sigue funcionando con la salida a pantalla completa delante, para dejar la instalación sola.

Clic en la miniatura de una pieza en la biblioteca la saca del AUTOPLAY (queda rayada y en gris) o la vuelve a meter. La selección se guarda en el navegador; las piezas fuera siguen pudiéndose cargar a mano en A y B.

Con `?instalacion` en la URL (`live/index.html?instalacion`) arranca solo y entra en AUTOPLAY; en el navegador el audio empieza con el primer clic.

**App de escritorio sin internet** para Windows y Mac: ver [`live-app/`](../live-app/README.md).

## Atajos
Pulsa **?** en la consola. Cualquier control se puede asignar a un controlador MIDI con **MIDI · APRENDER**.
