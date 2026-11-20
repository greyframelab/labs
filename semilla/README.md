# VØID_LOOM · SEMILLA

Materia negra que nace de una palabra. Un generador infinito de piezas abstractas en tiempo real, con imagen y sonido de la misma partitura. Cada pieza existe una sola vez.

**Abrir:** https://greyframelab.github.io/labs/semilla/ (Chrome o Edge).

## Modos (`1` `2` `3`)
| | Modo | Qué hace |
|---|---|---|
| 1 | AUTOMÁTICO | Las piezas nacen solas y se suceden con un fundido largo, sin repetir forma ni estilo de sonido seguidos. Cada vuelta muta un poco: el mismo frame no vuelve a salir. |
| 2 | PÚBLICO | Mientras la sala calla, autoplay: las piezas cambian al azar. Cuando alguien dice una palabra, se proyecta un instante y la obra nace de ella; tras dos vueltas sin palabras, vuelve el autoplay. |
| 3 | MANUAL | Semilla, acento, densidad y caos a mano, para estudio y montaje. La pieza repite su vuelta perfecta. |

## La obra
Una sola familia, infinita, renderizada en la GPU (raymarching). La semilla decide:
- **Forma:** MASA, TORSIÓN, CONCHA, PLIEGUE, COLUMNAS, FRACTURA, ESPINA y MONOLITO.
- **Material:** laca, obsidiana, cromo oscuro y terciopelo.
- **Luces:** tiras, aro, barrido y contraluz.
- **Encuadre y acento.**

Cada vuelta tiene cuatro actos: SEÑAL (casi a oscuras), TENSIÓN, RUPTURA (las vetas de luz interior se encienden) y ECO.

## La palabra (modo PÚBLICO)
- El reconocimiento de voz es el de Chrome, en español: escucha siempre y necesita internet en sala. Se queda con la palabra con más carga de la frase.
- Su significado (agua, fuego, amor, miedo, luz, tiempo, máquina, calma, caos, vida…) elige la forma, el material, las luces, el acento, la densidad, el caos y el estilo de sonido. Si la palabra no está en el léxico, manda su sonido.
- La palabra **pinta trazos de luz** sobre la materia con el gesto de su sentido: subidas cortantes para el fuego, ondas largas para el agua, arcos para el amor, líneas que tiemblan para el miedo, rayos para la luz, rectas cruzadas para la máquina y el caos. Unos pasan por delante del objeto y otros por detrás.
- Sus sílabas escriben el ritmo del bombo y **el dron canta sus vocales** con sus formantes.
- Mismo carácter, nunca la misma pieza: la semilla es la palabra y el instante.
- La palabra se proyecta un instante: se descifra desde glifos, se sostiene y se deshace en la pieza que nace, para que el visitante sepa que la obra es suya. No se guarda en ningún sitio (el registro anota la pieza, nunca la palabra). Para probar sin micrófono, escribe una palabra en PROBAR UNA PALABRA.

## Sonido
Sintetizado en el navegador desde la partitura: industrial, abstracto y ambient. Cada corte de plano es un golpe de chapa y cambia el intervalo del dron; cada forma suena con sus resonadores metálicos y un pulso de máquina; el plano decide el espacio (el macro, cercano y seco; el general, con mucha sala). Dron vivo como columna y una gran ruptura metálica. El master tiene limitador y techo de seguridad; el nivel de la sala se ajusta con VOLUMEN.

## La palabra
- Cualquier palabra dicha tiene carácter: si se parece a un arquetipo (fuego, agua, amor, miedo, luz, tiempo, máquina, calma, caos, vida) lo hereda; si no, mandan sus ejes de significado. Las desconocidas (nombres, inventadas) se leen por su sonido.
- El 70 % de las veces la palabra se vuelve materia: escrita con la MATRIZ de la máquina (5×7 celdas), dispersa en el espacio durante la pieza y ordenada en el ECO, donde se lee. Un tercio en vóxeles 3D, el resto en teselas finas.
- El sentido decide imagen (acento, forma, material, luz, trazos, tratamiento de la materia) y sonido (tempo, dron entre 8 motores, bajo entre 5, golpes, textura, armonía, peso del grave).

## Montaje en sala
1. Proyector como pantalla extendida, altavoces y micrófono en sala. Abre la app en Chrome y pulsa **ARRANCAR** (autoriza el micrófono la primera vez).
2. Elige el modo, ajusta **VOLUMEN** y **BRILLO** y pulsa **PROYECTAR** (`P`). Se abre la **ventana de SALIDA**: solo la obra, a la resolución del proyector y en sincronía con la consola. Llévala al proyector y haz doble clic para ponerla a pantalla completa. La consola sigue con todos los controles; el sonido sale de ella. `H` deja la vista limpia en la propia consola.
3. `?museo&modo=publico` en la URL arranca directamente en proyección y en ese modo.
4. **APAGAR** (`B`) funde a negro y silencio al cerrar la sala.

Por defecto:
- **DESTELLOS SEGUROS** limita los pulsos de luz para público general.
- Sin saltos en ordenadores modestos: si no llega a 60 fps baja la resolución (hasta el 80 %), fija 30 fps exactos, aligera la calidad y, solo al final, baja más la resolución. Los cambios de resolución esperan a un corte de plano.
- Si falla la GPU, la app se recarga y sigue en el mismo modo.

## Salidas
- **GRABAR VUELTA** (`R`): graba una vuelta completa con sonido, empezando en su SEÑAL.
- **CAPTURA** (`C`): guarda la imagen actual.
- **GUARDAR** (`G`): conserva la semilla.
- **REGISTRO:** anota cada pieza que nace (semilla, forma y hora, nunca la palabra) y se exporta a CSV.

## Atajos
`1 2 3` modo · `espacio` nueva · `← →` historial · `P` proyectar (salida) · `H` vista limpia · `B` apagar · `K` vista código · `S` sonido · `↑ ↓` volumen · `R` grabar · `C` captura · `G` guardar · `?` ayuda.

## Archivos
- `score.js`: partitura (semilla → pieza).
- `engine.js`: motor WebGL2.
- `sound.js`: síntesis.
- `voz.js`: escucha, elección de la palabra y su carácter.
- `sentido.txt`: sentido de ~40.000 palabras del español (8 ejes: valencia, activación, calor, luz, máquina, dureza, peso, abstracción, y su arquetipo más cercano). Se genera con `tools/sentido.py` (vectores `es_core_news_lg` de spaCy + frecuencias de `wordfreq`); la app solo lo lee, sin internet.
- `app.js` + `index.html`: consola y modos.
- `salida.html` + `salida.js`: ventana de salida.
- `palabra.js`: la palabra proyectada.
- `codigo.js`: VISTA CÓDIGO, una franja pequeña abajo con lo que la máquina ejecuta en tiempo real (semilla, forma, acto y cada evento). Apagada por defecto; se activa en SALA o con `K`.
- `void-loom-sting.js`: la firma, desactivada de momento.
- `fonts/`: JetBrains Mono (OFL).
