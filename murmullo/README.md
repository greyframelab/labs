# VØID_LOOM · MURMULLO
Sala 1 del acto I (EL MUNDO) de la exposición [VØID_LOOM · PARTITURA](../museo/EXPOSICION.md).

Un territorio de obsidiana sin bordes, que se pierde en la oscuridad. Todo el mundo escribe en ella a la vez: cada edición de Wikipedia, en cualquier idioma, se talla en tiempo real. Nada está grabado. Lo que se ve y se oye es lo que la gente está escribiendo ahora mismo.

**Abrir:** `murmullo/index.html` en Chrome o Edge → ARRANCAR. **F** pone la pantalla completa.

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
Referencia: Autechre (rejillas que rotan, golpes secos, sin melodía). Seco: sin delay ni eco, con solo una sala corta para la chapa y el bajo. Estante −6 dB desde 2,2 kHz, compresor y limitador. Bombo con cuerpo, armónico y clic; golpe doble cuando un mismo idioma escribe dos veces en el mismo paso. Medido ≈ −13,9 LUFS, pico −1,5 dBFS.

## Herramientas
`node tools/preview.js <carpeta> <ancho> <alto> <fps> <t0> <t1> <audio 0|1>` hace el render offline (frames JPG + WAV) con el flujo de MEMORIA. Variables: `SEED` y `EXTRA` (por ejemplo `&plano=MACRO`, `&acento=cian`). `index.html?render=1` expone `MURMULLO.prepara(dur)`, `frame(t)` y `audio(dur)`.

## Pendiente
- Validar en vivo con el flujo real (desde la sandbox no se llega a Wikimedia; el render usa MEMORIA).
- App de escritorio, como SEMILLA.
- Línea final del ECO con el dato real (pendiente de decidir si va).
