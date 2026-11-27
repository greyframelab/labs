# VØID_LOOM · MURMULLO
Sala 1 del acto I (EL MUNDO) de la exposición [VØID_LOOM · PARTITURA](../museo/EXPOSICION.md).

Un territorio de obsidiana sin bordes, que se pierde en la oscuridad. Todo el mundo escribe en ella a la vez: cada edición de Wikipedia, en cualquier idioma, se talla en tiempo real. Nada está grabado. Lo que se ve y se oye es lo que la gente está escribiendo ahora mismo.

**Abrir:** `murmullo/index.html` en Chrome o Edge. Es la CONSOLA: ARRANCAR, y luego ABRIR SALIDA, llevar esa ventana al proyector y hacer doble clic para pantalla completa.

## Consola y salida (como SEMILLA)
- **CONSOLA** (`index.html`): conecta al flujo, suena, enseña la vista previa (a 15 fps si la salida está abierta) y el estado. Muestra el flujo (EN VIVO / MEMORIA), las ediciones por segundo, las recibidas, las humanas de los últimos 34 s y los idiomas, la última edición (wiki y bytes, nunca título ni usuario), el acto, el tempo, el plano y la salida (conectada y fps). En la sala se puede cambiar el audio (NADIR / RITMO) en marcha, el idioma que sigue la cámara, el TESTIGO y el volumen.
- **SALIDA** (`salida.html`): solo la obra, a la resolución del proyector, sin audio. Recibe cada paso de la partitura por `BroadcastChannel` con su instante en reloj de pared y lo dibuja a la vez que suena. Tiene su propia calidad automática.

## El concepto: es real y es ahora
- El dato es real y en tiempo real: cada incisión es una edición que alguien acaba de hacer en alguna Wikipedia del mundo, con 1,4 s de retardo para encajarla en la rejilla.
- **TESTIGO:** en el ECO de cada vuelta, la máquina escribe abajo a la izquierda, celda a celda con la MATRIZ 5×7, `WIKIPEDIA · EN DIRECTO` y `618 EDICIONES EN 25 IDIOMAS · ÚLTIMOS 34 SEGUNDOS` (cifras reales, solo humanas). Después se apaga. **Solo aparece EN VIVO:** en MEMORIA no se escribe nada, porque la obra no miente. Se puede desactivar desde la consola.

## Que se entienda: del código a la piedra
- **FUENTE** (vista de código): cada vuelta se abre con 2 compases en negro donde corre el flujo `recentchange` tal como llega (hora, wiki, tipo, bytes, BOT), escrito con la MATRIZ 5×7. Las líneas del idioma de la vuelta van en el acento, y cada edición humana acaba en lo que se va a tallar (`→ JA+213`). Después, corte a la piedra: ese mismo texto se está tallando. En vueltas impares vuelve un compás en la TENSIÓN. **Solo EN VIVO** (en MEMORIA no se enseña código). Desactivable en la consola (`?sinfuente`).
- **La piedra talla el dato:** cada edición humana se talla como su idioma, su signo y sus bytes (`ES+142`, `DE-40`, `EN×1K` para una reversión), letra a letra, a la vez que suena. Los bots siguen siendo glifos repetidos de máquina. En CENITAL y ESCRITURA se lee.
- **Planos:** ESCRITURA, LÍNEA (travelling lateral por el renglón), ÓRBITA, MACRO, RASANTE, CENITAL y ABISMO. No se repiten dos seguidos y cambian por vuelta.
- **Idioma de la vuelta:** en ROTA (por defecto) la cámara sigue cada vuelta a otro de los idiomas que más escriben en ese momento; se puede fijar uno en la consola.

## La partitura
- **Fuente:** Wikimedia EventStreams `recentchange`, el flujo público de todas las wikis (20–50 eventos/s).
- **MEMORIA:** si en 4 s no llega nada, la pieza sigue sola con un flujo de la misma estadística. La sala nunca se para. Estado para el técnico: `MURMULLO_ESTADO()` en la consola.
- Cada evento cae en una rejilla de semicorcheas con 1,4 s de latencia. El ritmo lo escribe el mundo; la forma (cuatro actos por vuelta de 16 compases) la pone la pieza. El BPM sale del ritmo real de edición (96–136) y cambia solo entre vueltas.

| Evento | Imagen | Sonido |
|---|---|---|
| Edición humana | Incisión de la MATRIZ (5×7) en el renglón de su idioma | DATOS: micro-golpe FM; cada idioma tiene su altura |
| Bot | Incisión más pequeña, a rejilla exacta, glifos repetidos | PISTÓN: hats a rejilla; su densidad es la fracción real de bots |
| Edición enorme | Brillo y punto de interés para la cámara | CHAPA (metal golpeado) y bombo |
| Borrado | La piedra se lima | Golpe más largo; si el borrado es grande, aire que entra |
| Página nueva | Se enciende por dentro (acento) | Nota de bajo reese |
| Reversión (guerra de ediciones) | La grieta de la RUPTURA nace ahí | Glitch: el golpe se repite cada vez más rápido y más grave |

## Cuatro actos
- **SEÑAL:** casi siempre ESCRITURA: la cámara acompaña el renglón del español mientras el mundo lo escribe (`?idioma=ca`, `en`… para seguir otro). Si no, rasante o macro. Solo suenan los golpes humanos que más pesan.
- **TENSIÓN:** entran el bombo (rejilla euclidiana que rota), los bots y la caja, que solo suena cuando hay un borrado real en ese paso. Shuffle distinto en cada vuelta. Cortes: macro, rasante, cenital y ABISMO (cámara muy baja y abierta que se eleva despacio). Nunca se ven los bordes: no es un objeto, es un lugar. Antes del golpe, negro y silencio.
- **RUPTURA:** ABISMO sobre la grieta. La losa se agrieta donde fue la última guerra de ediciones. Veta incandescente del acento, tritono en el dron.
- **ECO:** un pulido barre la losa. Lo escrito queda debajo, apenas legible (palimpsesto). Vuelve al negro.

## Imagen
Superficie infinita: la escritura de 16×9 se repite más allá de la vista y la luz solo existe en un charco alrededor de lo que pasa; lo que arde se ve más lejos, como estrellas. Barra de luz estrecha y rasante, que lee la piedra. La altura vive en un mapa de 4096×2304 (R16F) que solo se escribe por blending, con sellos y pulido, sin pasadas a pantalla completa. La emisión vive aparte, en baja (1024×576), y se apaga sola. Así las letras quedan talladas con pared recta y fondo plano incluso en macro. La losa nunca se borra del todo. Al arrancar ya lleva ~14 min de historia escrita. Laca negra con reflejo de una barra de luz que barre y una caja de luz tenue. La luz rasante solo encuentra los bordes de lo escrito. Bisel pulido en el filo, polvo tenue en el haz de la barra (solo en planos abiertos), DOF, bloom contenido y grano sutil. La grieta tiene labio levantado y veta incandescente en el centro. Un solo acento por pieza (ámbar por defecto; `?acento=rojo|cian|violeta|blanco`).

## Fluidez
Calidad automática: si no llega a ~55 fps baja la resolución interna (80 %, 70 %, 60 %) y después fija 30 fps; si va sobrado, recupera. Los cambios esperan a un corte de plano.

## Sonido
Dos modos (`?audio=`):
- **NADIR** (por defecto): cada vuelta es otra sala (tonalidad que se desliza, intervalo del lecho, latido y voz protagonista: TECLAS, CAMPANA, CORO o VACÍO; teletipo en la FUENTE). Dark ambient inquietante, con un lecho tipo Tineidae y los metales de Blade Runner 2049. Sub que respira, un lecho CS-80 desafinado (raíz y segunda menor que baten), cristal que bate y un racimo que se hunde en la TENSIÓN. Cada edición humana es un susurro con la vocal de su idioma (el murmullo de la gente). Ediciones enormes: metal arqueado. Páginas nuevas: swell CS-80. Bots: tic lejano. Borrados: un portazo en otra sala. Reversiones: aire al revés. RUPTURA: BRAAM y caída de sub tras el silencio. El pulso es un latido. Sala larga y oscura, sin delay. ≈ −13,8 LUFS, pico −1,8 dBFS.
- **RITMO** (`?audio=ritmo`): IDM. Referencia: Autechre (rejillas que rotan, golpes secos, sin melodía). Seco: sin delay ni eco, con solo una sala corta para la chapa y el bajo. Estante −6 dB desde 2,2 kHz, compresor y limitador. Bombo con cuerpo, armónico y clic; golpe doble cuando un mismo idioma escribe dos veces en el mismo paso. Medido ≈ −13,9 LUFS, pico −1,5 dBFS.

## Herramientas
`node tools/preview.js <carpeta> <ancho> <alto> <fps> <t0> <t1> <audio 0|1>` hace el render offline (frames JPG + WAV) con el flujo de MEMORIA. Variables: `SEED` y `EXTRA` (por ejemplo `&plano=MACRO`, `&acento=cian`). `index.html?render=1` expone `MURMULLO.prepara(dur)`, `frame(t)` y `audio(dur)`.

## Pendiente
- Validar en vivo con el flujo real (desde la sandbox no se llega a Wikimedia; el render usa MEMORIA).
- App de escritorio, como SEMILLA.
- Línea final del ECO con el dato real (pendiente de decidir si va).
