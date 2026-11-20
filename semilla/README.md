# VØID_LOOM · SEMILLA

Materia negra que nace de una palabra. Un generador infinito de piezas abstractas en tiempo real, con imagen y sonido de la misma partitura. Cada pieza existe una sola vez.

**Abrir:** https://greyframelab.github.io/labs/semilla/ (Chrome o Edge).

## Modos (`1` `2` `3`)
| | Modo | Qué hace |
|---|---|---|
| 1 | AUTOMÁTICO | Las piezas nacen solas y se suceden con un fundido largo, sin repetir forma ni estilo de sonido seguidos. Cada vuelta muta un poco: el mismo frame no vuelve a salir. |
| 2 | PÚBLICO | La sala dice una palabra y la obra nace de ella. En silencio, la obra sigue sola y nunca se apaga. |
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

## Montaje en sala
1. Proyector como pantalla extendida, altavoces y micrófono en sala. Abre la app en Chrome y pulsa **ARRANCAR** (autoriza el micrófono la primera vez).
2. Elige el modo, ajusta **VOLUMEN** y **BRILLO** y pulsa **PROYECTAR** (`H`): solo la pieza, a pantalla completa y sin cursor.
3. `?museo&modo=publico` en la URL arranca directamente en proyección y en ese modo.
4. **APAGAR** (`B`) funde a negro y silencio al cerrar la sala.

Por defecto:
- **DESTELLOS SEGUROS** limita los pulsos de luz para público general.
- La resolución se adapta sola a los FPS del ordenador.
- Si falla la GPU, la app se recarga y sigue en el mismo modo.

## Salidas
- **GRABAR VUELTA** (`R`): graba una vuelta completa con sonido, empezando en su SEÑAL.
- **CAPTURA** (`C`): guarda la imagen actual.
- **GUARDAR** (`G`): conserva la semilla.
- **REGISTRO:** anota cada pieza que nace (semilla, forma y hora, nunca la palabra) y se exporta a CSV.

## Atajos
`1 2 3` modo · `espacio` nueva · `← →` historial · `H` proyectar · `B` apagar · `S` sonido · `↑ ↓` volumen · `R` grabar · `C` captura · `G` guardar · `?` ayuda.

## Archivos
- `score.js`: partitura (semilla → pieza).
- `engine.js`: motor WebGL2.
- `sound.js`: síntesis.
- `voz.js`: escucha y léxico de sentido.
- `app.js` + `index.html`: consola y modos.
- `void-loom-sting.js`: la firma, desactivada de momento.
- `fonts/`: JetBrains Mono (OFL).
