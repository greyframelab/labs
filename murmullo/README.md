# VØID_LOOM · MURMULLO
Sala 1 del acto I (EL MUNDO) de la exposición [VØID_LOOM · PARTITURA](../museo/EXPOSICION.md).

Una losa de obsidiana flota en el vacío. Todo el mundo escribe en ella a la vez: cada edición de Wikipedia, en cualquier idioma, se talla en tiempo real. Nada está grabado. Lo que se ve y se oye es lo que la gente está escribiendo ahora mismo.

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
- **SEÑAL:** plano rasante o macro, casi a oscuras. Solo los golpes de los humanos que más pesan.
- **TENSIÓN:** entra el bombo (rejilla euclidiana que rota) y los bots. Cortes: macro, rasante, cenital (la página entera del mundo) y general. Antes del golpe, negro y silencio.
- **RUPTURA:** la losa se agrieta donde fue la última guerra de ediciones. Veta incandescente del acento, tritono en el dron.
- **ECO:** un pulido barre la losa. Lo escrito queda debajo, apenas legible (palimpsesto). Vuelve al negro.

## Imagen
Losa de 16×9 con un mapa de altura de 2048×1152 (RGBA16F: altura, emisión, destello, frescura) que nunca se borra del todo. Al arrancar ya lleva ~14 min de historia escrita. Laca negra con reflejo de una barra de luz que barre y una caja de luz tenue. La luz rasante solo encuentra los bordes de lo escrito. Bisel pulido en el filo, DOF, bloom contenido y grano sutil. Un solo acento por pieza (ámbar por defecto; `?acento=rojo|cian|violeta|blanco`).

## Sonido
Referencia: Autechre (rejillas que rotan, golpes secos, sin melodía). Seco: sin delay ni eco, con solo una sala corta para la chapa y el bajo. Estante −6 dB desde 2,2 kHz, compresor y limitador. Medido ≈ −13,7 LUFS, pico −1,5 dBFS.

## Herramientas
`node tools/preview.js <carpeta> <ancho> <alto> <fps> <t0> <t1> <audio 0|1>` hace el render offline (frames JPG + WAV) con el flujo de MEMORIA. Variables: `SEED` y `EXTRA` (por ejemplo `&plano=MACRO`, `&acento=cian`). `index.html?render=1` expone `MURMULLO.prepara(dur)`, `frame(t)` y `audio(dur)`.

## Pendiente
- Validar en vivo con el flujo real (desde la sandbox no se llega a Wikimedia; el render usa MEMORIA).
- Calidad automática y app de escritorio, como SEMILLA.
- Línea final del ECO con el dato real (pendiente de decidir si va).
