# MURMULLO y la exposición PARTITURA · estado y memoria del proyecto

> Este archivo es la memoria del proyecto: lo que se decidió, lo que está hecho y lo que falta.
> **Regla:** se actualiza en cada PR que toque `murmullo/`, `murmullo-app/` o `museo/`, y se le pasa a Toni cuando lo pida o de vez en cuando.
> Última actualización: 27 nov 2026.

## Qué es
- **VØID_LOOM · PARTITURA** es la exposición individual de VØID_LOOM, con todas las piezas y las que vendrán, en cuatro actos: I EL MUNDO, II EL CUERPO, III EL VISITANTE y IV EL ARCHIVO. Concepto completo en [`museo/EXPOSICION.md`](../museo/EXPOSICION.md).
- **MURMULLO** es la sala 1 del acto I: un territorio de obsidiana sin bordes donde escribe todo el planeta. Cada edición real de Wikipedia, en cualquier idioma y en tiempo real, se talla en la piedra y suena.

## Decisiones (de Toni)
| Fecha | Decisión |
|---|---|
| 27 nov | Le gustan todas las salas del acto I: MURMULLO (Wikipedia), LÍTICA (sismos), CORONA (viento solar), ENJAMBRE (Bluesky), TRÁNSITO (vuelos) y LATIDO (Barcelona). Empezar por MURMULLO, pero pensando en grande: una expo individual. |
| 27 nov | Primera versión validada. Pide subirla mucho de nivel: losa en alta, letras talladas nítidas, plano ESCRITURA que sigue el renglón del español. |
| 27 nov | **Fuera los planos de tablet.** La losa nunca se ve entera ni con bordes: es un lugar, no un objeto. El plano general se sustituye por ABISMO (cámara baja que se eleva, territorio que se pierde en negro). La luz solo existe donde pasa algo. |
| 27 nov | **Audio NADIR por defecto**: dark ambient inquietante, tipo Tineidae, con los metales de la BSO de Blade Runner 2049. El IDM anterior queda como opción RITMO. |
| 27 nov | Consola + salida al proyector, como SEMILLA. |
| 27 nov | **El dato es real y en tiempo real, y hay que transmitirlo.** Para eso se hizo el TESTIGO: en el ECO, la máquina escribe `WIKIPEDIA · EN DIRECTO / N EDICIONES EN M IDIOMAS · ÚLTIMOS 34 SEGUNDOS`. Solo con datos en vivo; en MEMORIA no se escribe nada. Activado por defecto y desactivable en la consola (va contra la regla de "nada de texto en la proyección": confirmar con Toni). |
| 27 nov | App de escritorio (.exe y .dmg) como las demás, en la release `murmullo-app-latest`. |
| 27 nov | Reel de Instagram de MURMULLO. |
| 27 nov | **Que se entienda el concepto.** Pide más variedad de planos, ver cómo se escribe el dato y quizá una vista de código. Se hace (rama `murmullo-lectura`): vista **FUENTE** (el flujo `recentchange` en crudo, con la MATRIZ, solo EN VIVO), la piedra **talla el dato real** (idioma + signo + bytes: `JA+213`) letra a letra, planos nuevos **LÍNEA** y **ÓRBITA**, y el idioma que sigue la cámara **rota por vuelta** entre los que más escriben. Pendiente de su OK. |
| 27 nov (noche) | Toni: siempre sale MEMORIA, todo en blanco y negro y el audio repetitivo. **Causas:** (1) el flujo pasaba a EN VIVO al abrir la conexión, pero el primer tick lo devolvía a MEMORIA y ya no salía aunque llegaran datos; (2) MEMORIA regeneraba el mismo tramo 40 veces por segundo (misma semilla); (3) el acento solo vivía en los golpes que suenan y una de cada seis semillas era blanco. **Arreglo** (rama `murmullo-vivo`): EN VIVO en cuanto llega un dato y motivo visible en la consola si no; MEMORIA en tramos de 2 s con semilla propia; reintento si el navegador se rinde; la app firma el User-Agent que pide Wikimedia; cada signo humano se enciende en el acento al tallarse (más el idioma de la vuelta); blanco solo con `?acento=blanco`; NADIR: susurros con vocal y voz propias por persona, BRAAM distinto por vuelta y el intervalo del lecho se mueve en cada acto. |
| 27 nov | **NADIR más variado.** Cada vuelta es otra sala: tonalidad que se desliza, intervalo del lecho, latido y una voz protagonista distinta (TECLAS, CAMPANA, CORO o VACÍO). En la FUENTE suena un teletipo suave al ritmo real de llegada. Pendiente de su OK. |

## Hecho
- **PR #139** (rama `murmullo`): `museo/EXPOSICION.md`; `murmullo/` (flujo, partitura, imagen, sonido RITMO, NADIR, TESTIGO, consola y salida); `murmullo-app/` y su workflow `.github/workflows/murmullo-app.yml`.
- **Reel de Instagram** (27 nov): 9:16, 18,8 s. Arranca en el corte a la vista cenital de la TENSIÓN y pasa por negro, silencio, BRAAM, grieta y ECO, con audio NADIR y la firma en ámbar. Sin TESTIGO, porque el render usa datos simulados. Se regenera con `tools/reel.js` + `tools/firma.html` + `tools/firma_audio.py` (semilla 7, `EXTRA="&ritmo=60"`, recorte desde el frame 53).
- **PR #141** (rama `semilla-matriz`): arregla la lectura de la tipografía MATRIZ 5×7 en `semilla/score.js` (la fila superior de cada letra se leía mal). Es preventivo: esa función no se usa hoy.

## Pendiente
- [ ] **Probar en vivo con datos reales** en Chrome y en la app. Desde la sandbox de Claude no se llega a Wikimedia, así que todo se ha validado en MEMORIA.
- [ ] Merge de #139 → GitHub Actions genera la release `murmullo-app-latest` (.exe y .dmg). Probar en el PC de sala, sobre todo en Windows (Direct3D).
- [ ] Confirmar si el TESTIGO se queda activado por defecto.
- [ ] Cartela de sala (texto en pared) que explique que el dato es real.
- [ ] Siguientes salas: LÍTICA (contrapunto: casi nada frente a todo el rato) y después el bus PULSO entre piezas.

## Cómo retomarlo
- Render de validación: `node murmullo/tools/preview.js <carpeta> 1280 720 24 0 34 1` (variables `SEED`, `EXTRA="&plano=ABISMO"`, `"&audio=ritmo"`, `"&testigo"`).
- Skills: `void-loom-abstracto` (dirección de arte), `void-loom-music` (sonido) y `void-loom-motion` (Reels).
- Memoria de Claude: archivo `murmullo-exposicion`.
