# VØID_LOOM · ROSTRO

Una cabeza gigante de laca negra, proyectada en sala oscura, que se contorsiona al ritmo de su propio sonido. Miedo, furia, grito, pánico, risa: llevadas al extremo, dentro de lo que una cara puede hacer. Imagen y sonido salen de la misma partitura. Cada pieza existe una sola vez.

**Abrir:** https://greyframelab.github.io/labs/rostro/ (Chrome o Edge).

## Modos (`1` `2` `3`)
| | Modo | Qué hace |
|---|---|---|
| 1 | AUTOMÁTICO | Las piezas nacen solas y se suceden de negro a negro, sin repetir acento seguido. |
| 2 | MANUAL | Emoción, estilo y acento a mano. La pieza se repite hasta pulsar NUEVA. |
| 3 | ESPEJO | La cabeza copia la cara de quien tiene delante y la lleva al extremo. Sin nadie delante, sigue en AUTOMÁTICO. |

## La pieza
Una semilla decide el estilo de sonido, el tempo, el acento, la raíz y el arco emocional. Cada pieza tiene cuatro actos:
- **SEÑAL:** reposo, respiración, casi a oscuras.
- **TENSIÓN:** una emoción crece (miedo, sorpresa, tristeza, desprecio o asco).
- **RUPTURA:** tras el impacto, dos emociones extremas (furia, grito, pánico, risa, dolor o miedo).
- **ECO:** la cara se derrumba (angustia, tristeza o reposo) y vuelve a negro.

Doce expresiones construidas sobre el escaneo: REPOSO, MIEDO, FURIA, DOLOR, ASCO, GRITO, ANGUSTIA, SORPRESA, TRISTEZA, RISA, DESPRECIO y PÁNICO.

## Cada sonido es un gesto
| Sonido | Gesto |
|---|---|
| Bombo | Espasmo: mandíbula, empuje y cabeceo, con un muelle poco amortiguado que rebota. |
| Chapa | Algo empuja bajo la piel. |
| Crujido de tendón | Tirón seco tipo stop-motion: salta a otra torsión y vuelve. |
| Bajo | El cráneo se estira con la nota. |
| Barrido | Una luz blanca recorre la cara (solo en la ruptura). |
| Impacto | La ruptura: la emoción salta al extremo. |

## ESPEJO (`3`)
Una cámara mira la sala desde cerca del proyector, a la altura de la cara. La cabeza copia al visitante y lo exagera:
- si abre la boca, grita; si sube las cejas, se sorprende o se asusta; si frunce el ceño, entra en furia; si sonríe, se ríe con toda la cara; si arruga la nariz, asco;
- copia también el giro de la cabeza, como un espejo;
- el ritmo, los golpes y el sonido siguen: los espasmos del bombo caen encima de la cara del visitante, y las voces de las emociones siguen lo que la cámara lee;
- con alguien delante, solo planos frontales (un espejo se mira de frente);
- la cara neutra de cada visitante se aprende sola en el primer segundo, así funciona con cualquier cara.

En la consola: estado de la cámara, presencia, emoción que lee, **EXAGERAR** (50–200 %) y **VER CÁMARA** (solo en la consola, nunca en la proyección). La imagen no se guarda ni sale de la máquina: solo se leen la boca, las cejas, los ojos y el giro. Usa la visión de OJO (Human, modelos locales en `../ojo/models`), sin internet.

## Audio (`A`)
- **BASE:** el sonido del clip de validación. Bombo esculpido, chapa FM, crujidos de cuerda física, bajo con armónicos para el móvil, impacto y dron aditivo en la raíz.
- **BASE + AMBIENT:** encima, dark ambient: capas de dron (sierras desafinadas, coro aditivo, pad FM en una reverb de 9 s), ruido oscuro (retumbo, aliento, polvo), flanger en el eco, una voz por emoción y el sonido de la piel al estirarse, que sigue la velocidad de la deformación.

Se cambia en directo. Agudos domados (estante −6 dB desde 2,2 kHz) y limitador en el máster; el nivel de sala lo pone VOLUMEN.

## Montaje en sala
1. Proyector como pantalla extendida y altavoces. Abre la app en Chrome y pulsa **ARRANCAR**.
2. Ajusta **VOLUMEN** y **BRILLO** y pulsa **PROYECTAR** (`P`). Lleva la ventana de SALIDA al proyector y haz doble clic para ponerla a pantalla completa. El sonido sale de la consola.
3. `?museo` en la URL arranca directamente proyectando. `?modo=manual` o `?modo=espejo` arranca en ese modo; `?pieza=CODIGO` abre una pieza concreta.
4. **APAGAR** (`B`) funde a negro y silencio.

Por defecto:
- **DESTELLOS SEGUROS** limita los pulsos de luz y el barrido.
- Sin saltos en ordenadores modestos: si no llega a 60 fps baja la resolución al 80 %, fija 30 fps, quita sombras y bloom y, al final, baja al 60 %. Los cambios esperan a un corte de plano. Con la salida abierta, la vista previa de la consola va a 15 fps.

## Archivos
- `partitura.js`: semilla → pieza (eventos, emociones, planos, actos).
- `rig.js`: el rig procedural de la cabeza y las doce expresiones.
- `anim.js`: convierte cada evento en gesto (muelles, impulsos, tirones).
- `escena.js`: la cabeza de laca negra, la luz y los planos (three.js).
- `sonido.js`: síntesis en el navegador (WebAudio), BASE y AMBIENT.
- `espejo.js`: ESPEJO (cámara → rasgos de la cara → objetivo exagerado para el rostro).
- `app.js` / `index.html`: consola. `salida.js` / `salida.html`: proyector.
- `vendor/three-rostro.js`: three.js r170 y los módulos que usa, en un solo archivo (sin internet en sala).
- `tools/render-audio.html`: render del audio de una pieza sin tiempo real, para medirlo.

## Créditos
Escaneo de cabeza: «Infinite, 3D Head Scan» de Lee Perry-Smith (Infinite-Realities), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), basado en una obra de triplegangers.com (ver `assets/LeePerrySmith_License.txt`). three.js (MIT), three-subdivide (MIT) y Human (MIT).
