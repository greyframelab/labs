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

## La cabeza
- **ICT Face Model** (ICT-FaceKit, USC Institute for Creative Technologies, MIT): una cara media registrada a partir de escaneos de light stage. No es una persona concreta. Trae globos oculares, dientes, encías y lengua: la boca se abre de verdad.
- **53 expresiones anatómicas** (nombres de ARKit, separadas en izquierda y derecha) mezcladas en la gráfica como morph targets. Encima, el giro de la cabeza sobre el cuello, el temblor y lo que empuja bajo la piel.
- **Piel:** laca negra con poros y arrugas procedurales que nacen con cada expresión (frente, entrecejo, patas de gallo, surco nasolabial, nariz, barbilla y tendones del cuello). Ojos de cristal negro.
- **Doce emociones**, cada una con su pose y **su propia manera de moverse**:
  - MIEDO tiembla, retrocede y los ojos saltan;
  - FURIA sacude la cabeza y embiste con el bombo;
  - GRITO sostiene la boca con vibrato y se va hacia atrás;
  - RISA rebota y cabecea;
  - TRISTEZA solloza y mira al suelo;
  - ANGUSTIA respira hondo y le tiembla la barbilla;
  - PÁNICO busca sin parar y jadea;
  - SORPRESA se congela;
  - DOLOR se encoge en cada golpe;
  - ASCO se aparta;
  - DESPRECIO ladea con media sonrisa;
  - REPOSO respira y parpadea.

## Cada sonido es un gesto
| Sonido | Gesto |
|---|---|
| Bombo | Espasmo propio de la emoción (embestida, retroceso, mueca), con un muelle poco amortiguado que rebota. |
| Chapa | Algo empuja bajo la piel. |
| Crujido de tendón | Tirón seco tipo stop-motion: la cabeza, la mandíbula o la mirada saltan y vuelven. |
| Bajo | La boca se entreabre con la nota. |
| Barrido | Una luz blanca recorre la cara (solo en la ruptura). |
| Impacto | La ruptura: la emoción salta al extremo. |

## Teclado: emoción en directo
Cada tecla pone esa emoción al momento, con su propio golpe, encima de la pieza. El ritmo y el sonido siguen; las voces del sonido cambian con la emoción. Funciona en cualquier modo y manda sobre ESPEJO. También están como botones en la consola (TECLADO).

| Tecla | Emoción | Tecla | Emoción |
|---|---|---|---|
| Q | MIEDO | U | PÁNICO |
| W | FURIA | I | SORPRESA |
| E | GRITO | O | DOLOR |
| R | RISA | D | ASCO |
| T | TRISTEZA | F | DESPRECIO |
| Y | ANGUSTIA | G | soltar: la cara vuelve al arco de la pieza |

## ESPEJO (`3`)
Una cámara mira la sala desde cerca del proyector, a la altura de la cara. La cabeza copia al visitante y lo exagera:
- lee la cara del visitante y la traduce a las mismas expresiones de la cabeza: si abre la boca, grita; si sube las cejas, se sorprende o se asusta; si frunce el ceño, entra en furia; si sonríe, se ríe con toda la cara; si arruga la nariz, asco;
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
- Fluidez: la deformación va entera en la gráfica y la SALIDA calcula la pieza por su cuenta, sincronizada por reloj con el audio de la consola (no espera mensajes, así que no da tirones).
- Sin saltos en ordenadores modestos: si no llega a 60 fps baja la resolución al 85 %, fija 30 fps, quita sombras y bloom y, al final, baja al 65 %. Los cambios esperan a un corte de plano. Con la salida abierta, la vista previa de la consola va a 15 fps.
- App de escritorio para sala, sin internet: [`rostro-app/`](../rostro-app/README.md).

## Archivos
- `partitura.js`: semilla → pieza (eventos, emociones, planos, actos).
- `cara.js`: carga la cara y sus 53 expresiones (`assets/cara.json` + `assets/cara.bin`, 5 MB).
- `rig.js`: las doce emociones como mezclas de expresiones, y el resumen de la cara para el sonido.
- `anim.js`: convierte cada evento en gesto y da a cada emoción su manera de moverse (muelles, sacadas, parpadeo, sollozos…).
- `escena.js`: la cabeza de laca negra en la gráfica (expresiones, giro, piel procedural), la luz, los planos y la composición con MSAA (three.js).
- `sonido.js`: síntesis en el navegador (WebAudio), BASE y AMBIENT.
- `espejo.js`: ESPEJO (cámara → rasgos de la cara → objetivo exagerado para el rostro).
- `app.js` / `index.html`: consola. `salida.js` / `salida.html`: proyector.
- `vendor/three-rostro.js`: three.js r170 y los módulos que usa, en un solo archivo (sin internet en sala).
- `tools/build_cara.py`: convierte el ICT Face Model (OBJ) a `cara.json` + `cara.bin`.
- `tools/frame.html` y `tools/render.html`: un frame de prueba y el render fotograma a fotograma de una pieza.
- `tools/render-audio.html`: render del audio de una pieza sin tiempo real, para medirlo.

## Créditos
Cabeza y expresiones: ICT Face Model, de [ICT-FaceKit](https://github.com/ICT-VGL/ICT-FaceKit) (USC Institute for Creative Technologies), licencia MIT. three.js (MIT) y Human (MIT).
