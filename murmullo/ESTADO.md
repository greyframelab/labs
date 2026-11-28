# VØID_LOOM · MURMULLO · estado (28 nov 2026)

Primera sala de la exposición individual VØID_LOOM · PARTITURA. Las ediciones de Wikipedia en tiempo real se tallan en una losa negra y suenan. Vive en `murmullo/` (pieza) y `murmullo-app/` (app de escritorio) del repo `greyframelab/labs`. La app está en la release `murmullo-app-latest` (.exe instalador y portable, .dmg arm64 y x64; publicada el 27 nov, 20:53, después del merge de la #145).

## PRs
| PR | Qué | Estado |
|---|---|---|
| #139 | Primera versión de MURMULLO: losa sin bordes, NADIR, consola + salida, TESTIGO, app | Mergeada |
| #141 | SEMILLA: arreglo de la lectura de la MATRIZ 5×7 | **Abierta** (sin mergear) |
| #142 | Que se entienda el concepto: FUENTE, la piedra talla el dato, planos LÍNEA/ÓRBITA, idioma que rota, NADIR por salas | Mergeada |
| #145 | Arreglo de EN VIVO, MEMORIA sin repeticiones, más color, NADIR más variado, User-Agent en la app | Mergeada |

## Decisiones
- **Losa:** sin bordes, como un territorio que se pierde en negro; plano ABISMO en vez del general (la losa entera parecía una tablet).
- **Audio:** NADIR por defecto (dark ambient inquietante, tipo Tineidae / BSO de Blade Runner 2049). El modo IDM queda como opción RITMO.
- **Concepto:** el dato tiene que ser real y en tiempo real, y que se note. La vista de código (FUENTE) y el texto del final de vuelta (TESTIGO) solo aparecen EN VIVO; en MEMORIA no se enseña código.
- **FUENTE:** cada vuelta se abre con 2 compases en negro donde corre el flujo `recentchange` en crudo (hora, wiki, tipo, bytes, BOT), escrito con la MATRIZ 5×7. El idioma de la vuelta va en el color de acento y cada línea termina en lo que se talla (`→ ES+142`). En las vueltas impares vuelve un compás en la TENSIÓN. Se apaga con `?sinfuente` o desde la consola.
- **La piedra talla el dato:** cada edición humana se talla como idioma + signo + bytes (`DE+3344`, `JA-6`), letra a letra y a la vez que suena. Los bots siguen dejando glifos de máquina.
- **Planos:** ESCRITURA, LÍNEA, ÓRBITA, MACRO, RASANTE, CENITAL y ABISMO. Nunca dos iguales seguidos, y el arranque, la ruptura y el ECO cambian por vuelta.
- **Idioma de la vuelta:** ROTA por defecto, entre los idiomas que más escriben en ese momento. En la consola se puede fijar uno.
- **NADIR por salas:** en cada vuelta cambian la tonalidad (se desliza), el intervalo del fondo, el latido y la voz protagonista (TECLAS, CAMPANA, CORO o VACÍO). Durante la FUENTE suena un teletipo suave. Los susurros tienen vocal propia por persona, el BRAAM cambia por vuelta y el acorde del fondo se mueve en cada acto.
- **Color:** cada letra de una persona se enciende en el acento al tallarse, y más fuerte la del idioma de la vuelta. El blanco solo sale con `?acento=blanco`.

## Arreglado (27 nov, noche)
- **Siempre MEMORIA:** el primer tick la devolvía a MEMORIA y ya no salía. Ahora pasa a EN VIVO en cuanto llega un dato, y la consola enseña el motivo cuando no.
- **Audio repetitivo:** en MEMORIA se generaba el mismo tramo 40 veces por segundo. Ahora va en tramos de 2 s, cada uno con su semilla.
- **Blanco y negro:** el acento casi no aparecía (y 1 de cada 6 semillas era blanca).
- **App:** firma un User-Agent identificable para `stream.wikimedia.org`, como pide Wikimedia.

## Descartado
- Planos con la losa entera vista como un objeto o tablet.
- El modo IDM como sonido por defecto.

## Entregado
- `murmullo_lectura.mp4`: validación de 68 s (2 vueltas, 960×540, 24 fps) con FUENTE forzada y datos de MEMORIA.
- `murmullo_nadir_2vueltas.m4a`: NADIR con los últimos cambios, 68 s, pico −1,5 dBFS.
- Reel de Instagram de MURMULLO (pedido y hecho en la primera tanda; formato por confirmar).

## Pendiente
- [ ] **Toni:** probar con datos reales (web y app). La línea FLUJO de la consola tiene que decir EN VIVO; si dice MEMORIA, pasar el motivo que aparece al lado. Desde la sandbox no se llega a Wikimedia, así que nadie lo ha visto en directo todavía.
- [ ] Comprobar en directo que la FUENTE se lee bien en proyección (tamaño de la MATRIZ) y que el color se nota lo suficiente.
- [ ] Decidir si la FUENTE y el TESTIGO (texto en pantalla) encajan con la regla de "sin UI en la pieza". De momento se han quedado porque explican el concepto.
- [ ] PR #141 (MATRIZ de SEMILLA) sigue abierta: mergear cuando quiera.
- [ ] Siguiente sala de la expo: MENSAJERO (NASA Deep Space Network), en marcha en la rama `mensajero`.

## Para retomar
- Notas detalladas: `murmullo/NOTAS.md`. La exposición está en `museo/EXPOSICION.md`.
- Render offline para validar: `PW=<ruta playwright> SEED=7 DUR=70 EXTRA="&fuente" node murmullo/tools/preview.js <salida> 960 540 24 <t0> <t1> <audio 0/1>`.
- Parámetros útiles: `?fuente` (forzar la FUENTE en el render), `?sinfuente`, `?plano=LINEA`, `?idioma=ja`, `?acento=blanco`, `?testigo`.
- Próximo paso concreto: que Toni lo pruebe en vivo y pase lo que ve en la línea FLUJO.
