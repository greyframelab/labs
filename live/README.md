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
- **CALIDAD** (abajo, en SISTEMA): **AUTO** por defecto. Cada pieza se pinta a la resolución que el ordenador aguanta con fluidez: empieza al 75 %, la salida mide sus FPS mientras está sola en el aire y, si va a saltos, la recarga más pequeña (hasta el 45 %); si va sobrada, la sube poco a poco hasta el 100 %. Lo aprendido se guarda por pieza, así que la siguiente vez ya sale a su resolución. La salida amplía con escalado nítido (Catmull-Rom). El chip SALIDA muestra los FPS y la calidad de la pieza en el aire; con VER CÓDIGO, cada ajuste aparece en la traza. 100 / 75 / 50 fijan la calidad a mano para todas.
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
    - **ALTERNAR:** va pasando entre PANTALLA, VENTANA, MÁQUINA y ratos solo de imagen, sin código, en orden aleatorio y nunca dos a la vez: el primer cambio a los 3–5 s y después cada 6–12 s, siempre en un golpe. Pensado para el AUTOPLAY.
    - **MÁQUINA:** la imagen convertida en una página del código real de la pieza. Cada carácter brilla con la luz que tiene debajo, los contornos se encienden con el acento de la pieza, un cursor de lectura recorre la imagen y en cada golpe la página avanza y los contornos se reescriben. Lo dibuja la GPU en el paso final; apagado no cuesta nada.

## AUTOPLAY

`P` o el botón AUTOPLAY recorre las piezas en orden aleatorio, sin repetir hasta pasar por todas, y funde de una a otra tras 1, 2 o 3 vueltas (VUELTAS). Sigue funcionando con la salida a pantalla completa delante, para dejar la instalación sola.

Clic en la miniatura de una pieza en la biblioteca la saca del AUTOPLAY (queda rayada y en gris) o la vuelve a meter. La selección se guarda en el navegador; las piezas fuera siguen pudiéndose cargar a mano en A y B.

Con `?instalacion` en la URL (`live/index.html?instalacion`) arranca solo y entra en AUTOPLAY; en el navegador el audio empieza con el primer clic.

**App de escritorio sin internet** para Windows y Mac: ver [`live-app/`](../live-app/README.md).

## OJO · PRESENCIA (apagado por defecto)

LIVE puede reaccionar a la gente que hay en la sala usando [OJO](../ojo/README.md) como sensor. OJO solo envía números (cuántas personas, dónde, cuánto se mueven y si alguien mira a la cámara), nunca la imagen.

1. Con la salida abierta, pulsa **OJO** en la cabecera de LIVE. La salida enciende la cámara con la IA de OJO, oculta y sin imagen (`ojo/sensor.html`). La primera vez el navegador pide permiso para la cámara en la ventana de salida; en la app de escritorio no pregunta.
2. El botón muestra lo que pasa: CÁMARA…, CARGANDO IA…, SALA VACÍA, 1 PERSONA, CONTACTO… Si dice SIN CÁMARA, revisa el permiso o que no la esté usando otra app.

También funciona con OJO completo abierto en otra ventana del mismo navegador, pero esa ventana tiene que estar a la vista: si queda detrás u oculta, Chrome la pausa y LIVE deja de recibir.

Qué pasa:
- **Sala vacía:** LIVE sigue a lo suyo.
- **Entra alguien:** aparece encima de la pieza tal como lo ve la máquina, en la vista CÓDIGO de OJO (la máquina le escribe con su propio código), con la malla de la cara y los rótulos de datos (SUJETO, CONTACTO, distancia…). Todo lo pinta el sensor en una sola pasada, a 960×540, y la sala suena más abierta: más reverberación y más eco cuanto más se mueve la gente. Aguanta 3 s después de que se vaya.
- **Contacto** (alguien mira a la cámara medio segundo): la pieza a negro y silencio; solo queda el visitante dibujado por la máquina.

Ligero a propósito: una sola cámara y una sola IA (el mismo sensor). Con la sala vacía el sensor trabaja a 320×180 en su modo más barato; solo con alguien delante pinta su vista a 960×540, que la salida funde encima (una textura de ~2 MB).
- **Fin del contacto:** impacto de luz y todo vuelve.

En el deck C, el shader recibe `presencia` (0–1), `personas`, `energia` (movimiento), `contacto` (0–1), `pos` (posición de la persona principal, 0–1, arriba = 0) y `talla` (lo cerca que está). El preset **PRESENCIA** abre la imagen alrededor del visitante y la cierra cuando le mira.

Funciona igual en el navegador y en la app de escritorio de LIVE (que ya incluye OJO en su copia local).

## Atajos
Pulsa **?** en la consola. Cualquier control se puede asignar a un controlador MIDI con **MIDI · APRENDER**.
