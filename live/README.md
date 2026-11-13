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

## Atajos
Pulsa **?** en la consola. Cualquier control se puede asignar a un controlador MIDI con **MIDI · APRENDER**.
