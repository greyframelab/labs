# VØID_LOOM · ROSTRO

Una cabeza gigante de laca negra, proyectada en sala oscura, que se contorsiona al ritmo de su propio sonido. Miedo, furia, grito, pánico, risa: llevadas al extremo, dentro de lo que una cara puede hacer. Imagen y sonido salen de la misma partitura. Cada pieza existe una sola vez.

**Abrir:** https://greyframelab.github.io/labs/rostro/ (Chrome o Edge).

## Modos (`1` `2` `3`)
| | Modo | Qué hace |
|---|---|---|
| 1 | AUTOMÁTICO | CONTINUO (por defecto): un paso sin cortes por todas las expresiones. PIEZAS: piezas de negro a negro. |
| 2 | MANUAL | Emoción, estilo y acento a mano. La pieza se repite hasta pulsar NUEVA. |
| 3 | ESPEJO | La cabeza copia la cara de quien tiene delante y la lleva al extremo. Sin nadie delante, sigue en AUTOMÁTICO. |

## AUTOMÁTICO · CONTINUO (por defecto)
Un paso sin cortes a negro por **todas las expresiones** (42), pensado para que quien entra en la sala se quede clavado:
- **Orden de contraste máximo:** de cada expresión salta a la más lejana de unas pocas candidatas, alternando oscuridad y luz (del horror a la ternura, del odio a la gratitud). Cada paso tiene un orden distinto y el siguiente empieza donde acaba el anterior: la cara nunca vuelve a neutro.
- **Cambio plástico:** cada cambio de expresión es un golpe en la materia. El cráneo se estira, la cabeza se retuerce sobre su eje, la cara se hincha y a veces se derrite, y todo rebota como gelatina. En el mismo instante hay corte de plano, barrido de luz, glitch, cambio de acento y un golpe de sonido que se hunde, anunciado por un oleaje de ruido.
- **Squash & stretch:** cada bombo aplasta el cráneo y la materia rebota.
- **Expresiones pasadas de rosca:** en el continuo pueden ir hasta 1,75 (fuera de la anatomía).
- **Ritmo:** las expresiones extremas duran dos compases con el bombo lleno, las de tensión dos compases con un pulso medio y las calmas dos compases y medio, casi sin golpes. Cada pocos cambios llega una **RÁFAGA**: cuatro o cinco caras a medio compás cada una, con cortes secos.
- **Color por familia:** rojo, violeta o magenta para lo extremo, cian o verde para la tensión, ámbar o blanco para la luz.

Un paso dura unos 2,5–3 minutos según el tempo. En la consola, **AUTOMÁTICO › CONTINUO / PIEZAS** cambia al modo anterior (piezas de ~40 s de negro a negro).

## La pieza
Una semilla decide el estilo de sonido, el tempo, el acento, la raíz y el arco emocional. Cada pieza tiene cuatro actos:
- **SEÑAL:** reposo, respiración, casi a oscuras.
- **TENSIÓN:** una emoción crece (miedo, sorpresa, tristeza, desprecio o asco).
- **RUPTURA:** tras el impacto, dos emociones extremas (furia, grito, pánico, risa, dolor o miedo).
- **ECO:** la cara se derrumba (angustia, tristeza o reposo) y vuelve a negro.

## La cabeza
- **ICT Face Model** (ICT-FaceKit, USC Institute for Creative Technologies, MIT): una cara media registrada a partir de escaneos de light stage. No es una persona concreta. Trae globos oculares, dientes, encías y lengua: la boca se abre de verdad.
- **53 expresiones anatómicas** (nombres de ARKit, separadas en izquierda y derecha) mezcladas en la gráfica como morph targets. Encima, el giro de la cabeza sobre el cuello, el temblor y lo que empuja bajo la piel.
- **Busto:** cuello, hombros y pecho se disuelven en el negro (fundido y grano), sin borde de corte.
- **Piel:** laca negra con poros y arrugas procedurales que nacen con cada expresión (frente, entrecejo, patas de gallo, surco nasolabial, nariz, barbilla y tendones del cuello). Ojos de cristal negro.
- **Veintisiete emociones** (más el reposo), cada una con su pose y **su propia manera de moverse**. Algunas:
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
  - HORROR se congela con la mirada clavada; ODIO aprieta la mandíbula y avanza; LOCURA se balancea con tics y risitas;
  - AGONÍA se retuerce y convulsiona; ÉXTASIS echa la cabeza atrás con los ojos en blanco; VERGÜENZA aparta la cara;
  - CONFUSIÓN ladea de un lado a otro; LLANTO llora a bocanadas; SÚPLICA asiente hacia arriba; DESESPERACIÓN niega;
  - NÁUSEA tiene arcadas; BURLA se ríe a golpes; SOSPECHA mira de reojo; ARROGANCIA alza la barbilla;
  - AGOTAMIENTO se duerme y despierta de golpe; VÉRTIGO gira la cabeza y los ojos en círculos;
  - REPOSO respira y parpadea.
- Las piezas automáticas eligen su arco entre todas ellas; las nuevas suenan con la voz de su familia (horror como el pánico, odio como la furia…).

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

| Tecla | Emoción | Tecla | Emoción | Tecla | Emoción |
|---|---|---|---|---|---|
| Q | MIEDO | S | SÚPLICA | 4 | DESESPERACIÓN |
| W | FURIA | D | ASCO | 5 | NÁUSEA |
| E | GRITO | F | DESPRECIO | 6 | BURLA |
| R | RISA | J | HORROR | 7 | SOSPECHA |
| T | TRISTEZA | K | ODIO | 8 | ARROGANCIA |
| Y | ANGUSTIA | L | LOCURA | 9 | AGOTAMIENTO |
| U | PÁNICO | Z | AGONÍA | 0 | VÉRTIGO |
| I | SORPRESA | X | ÉXTASIS | G | soltar: vuelve al arco de la pieza |
| O | DOLOR | V | VERGÜENZA | | |
|  |  | N | CONFUSIÓN | | |
|  |  | M | LLANTO | | |

### Luz: emociones positivas (Mayús + tecla)
| Tecla | Emoción | Tecla | Emoción |
|---|---|---|---|
| ⇧Q | ALEGRÍA | ⇧O | ORGULLO |
| ⇧W | EUFORIA | ⇧S | GRATITUD |
| ⇧E | TERNURA | ⇧D | CURIOSIDAD |
| ⇧R | AMOR | ⇧F | DIVERSIÓN |
| ⇧T | SERENIDAD | ⇧J | SATISFACCIÓN |
| ⇧Y | ALIVIO | ⇧K | INSPIRACIÓN |
| ⇧U | ESPERANZA | ⇧L | COMPLICIDAD |
| ⇧I | MARAVILLA | G | soltar |

Cada una se mueve a su manera (la euforia ríe y rebota, la ternura ladea despacio, la serenidad respira con los ojos cerrados, el alivio suspira, la complicidad guiña…). Suenan con una voz propia: un acorde mayor suave y lento (LUZ). Algunas entran también en las piezas automáticas: euforia en la ruptura, serenidad, alivio y maravilla en el eco, curiosidad en la tensión.

## ESPEJO (`3`)
Una cámara mira la sala desde cerca del proyector, a la altura de la cara. La cabeza copia al visitante y lo exagera:
- lee la cara del visitante y la traduce a las mismas expresiones de la cabeza: si abre la boca, grita; si sube las cejas, se sorprende o se asusta; si frunce el ceño, entra en furia; si sonríe, se ríe con toda la cara; si arruga la nariz, asco;
- copia también el giro de la cabeza, como un espejo;
- el ritmo, los golpes y el sonido siguen: los espasmos del bombo caen encima de la cara del visitante, y las voces de las emociones siguen lo que la cámara lee;
- con alguien delante, solo planos frontales (un espejo se mira de frente);
- la cara neutra de cada visitante se aprende sola en el primer segundo, así funciona con cualquier cara.

En la consola: estado de la cámara, presencia, emoción que lee, **EXAGERAR** (50–200 %) y **VER CÁMARA** (solo en la consola, nunca en la proyección). La imagen no se guarda ni sale de la máquina: solo se leen la boca, las cejas, los ojos y el giro. Usa la visión de OJO (Human, modelos locales en `../ojo/models`), sin internet.

## FX (consola › FX)
Siete efectos que van con el sonido. Por defecto, todos activos; cada uno se enciende o apaga en directo y la proyección cambia al momento.
- **GLITCH EN LOS GOLPES:** separación RGB y franjas desplazadas en los tirones (crujidos), los cortes digitales y el impacto. Solo dura el golpe.
- **ESTELA:** los gestos rápidos dejan un eco que se apaga. Dura más cuanto más rápido es el gesto, se mide en segundos (igual a 30 que a 60 fps) y se borra en cada corte de plano.
- **ATMÓSFERA Y HACES:** conos de luz con niebla que se mueve (el de la clave y el del acento, que late con los golpes) y polvo flotando dentro del haz.
- **DESTELLOS:** los brillos de la laca se alargan en horizontal, con un poco del acento. Solo los brillos de verdad, en una línea limpia. En calidad ligera se apagan solos.
- **LÁSER:** en cada cambio de expresión, una línea del color del acento recorre la cara de arriba abajo en menos de un segundo, como un escáner.
- **DOBLE EXPOSICIÓN:** la cara de antes se queda un instante sobreimpresionada sobre la nueva, algo más grande, y se disuelve.
- **LENTE:** aberración cromática en los bordes, como un objetivo grande; da un tirón con cada cambio y cada golpe.

## Vista (`Tab`, consola › VISTA)
- **NORMAL:** la laca negra.
- **CÓDIGO · la piel es el código:** la cara está cubierta del código que la mueve, escrito sobre la piel en 3D. Cada altura lleva lo suyo: la emoción y la plástica en el cráneo, las cejas, los ojos, mejillas y nariz, la boca, la mandíbula y el giro en el cuello, con los valores en vivo. Donde la cara trabaja, el código se enciende con el acento; el texto se estira, se retuerce y se derrite con ella, y en cada cambio se reescribe de arriba abajo con el láser.
- **VECTORES · campo de fuerzas:** cada punto de piel lanza una línea de luz desde donde estaría en reposo hacia donde está, amplificada y hacia fuera. Quieta, la cara no tiene nada; cuanto más intensa es la emoción, más largo y brillante es el campo.
- **AUTO** (por defecto): en cada cambio de expresión elige entre la laca y CÓDIGO. VECTORES no entra sola: solo con su botón o con Tab. La consola y la salida eligen lo mismo.

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
- **Proyección en tiempo real:** el reloj de la obra (sonido, pieza y emoción) lo marca un worker que el navegador no frena aunque la consola quede tapada por la proyección o minimizada. Con la SALIDA abierta, la vista previa de la consola baja a 12 fps, pequeña y en calidad ligera, para dejar la gráfica al proyector. La SALIDA dibuja como mucho ~1080p de píxeles reales aunque el proyector sea 4K.
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
