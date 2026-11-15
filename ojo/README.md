# VØID_LOOM · OJO

Lo que la máquina ve de ti. La cámara proyectada en la pared tal como la ve una IA, en tiempo real: te detecta, te sigue con la mirada y sabe cuándo la miras.

**Abrir:** https://greyframelab.github.io/labs/ojo/ (Chrome o Edge). **App de escritorio sin internet** para Windows y Mac: ver [`ojo-app/`](../ojo-app/README.md).

La imagen se procesa en el propio ordenador. No se envía a ningún sitio ni se guarda, salvo que pulses GRABAR o CAPTURA.

## Montaje
1. Conecta el proyector como pantalla extendida y la cámara (la del portátil o una webcam).
2. Abre la consola y pulsa **ARRANCAR**. Elige la cámara en **FUENTE**.
3. **SALIDA** (`O`) abre la ventana limpia: arrástrala al proyector y pulsa **F**. Con la salida abierta, la IA trabaja en ella a resolución completa y la consola muestra lo que le llega.
4. Sin segunda pantalla: **H** deja solo la previa a pantalla completa en la propia consola.

## Modos (1–7)
Cada modo es visión por ordenador real, calculada en la GPU sobre la imagen de la cámara.

| | Modo | Qué ve la máquina |
|---|---|---|
| 1 | PROFUNDIDAD | Nube de puntos con relieve estimado; un frente de sonar la recorre en profundidad. |
| 2 | BORDES | Solo contornos (Sobel con supresión de no máximos) y los puntos clave (Harris) que usa para seguirte. |
| 3 | FLUJO | Flujo óptico (Lucas-Kanade): lo quieto desaparece; 65 000 partículas siguen el movimiento. |
| 4 | CÓDIGO | Te escribe con su propio código fuente (los shaders de esta app); donde te mueves lo reescribe en hexadecimal. |
| 5 | ATENCIÓN | Mapa de saliencia con isolíneas: lo que le interesa de la escena. |
| 6 | NEURONAS | Mosaico de mapas de activación: Gabor en 4 orientaciones, centro-periferia, color oponente, movimiento, esquinas… |
| 7 | MEMORIA | Las últimas 64 imágenes en capas: cada zona vive en un instante distinto (desde ti hacia fuera, barrido, sombras o movimiento). |

Cada modo tiene su acento y cuatro mandos propios, más ESTELA. El acento se cambia en ACENTO.

## La capa de ANÁLISIS (`A`: nada · forma · datos)
Va encima de cualquier modo. Usa modelos de IA que van dentro de la app (`models/`, con [Human](https://github.com/vladmandic/human), licencia MIT):
- **Cara:** detección, malla de 468 puntos, iris y dirección de la mirada. **Cuerpo:** esqueleto de 17 puntos (MoveNet).
- Cada persona que entra queda **fijada**: los corchetes se cierran sobre ella, la malla se dibuja de arriba abajo, recibe un ID (SUJETO 01…) y se cuenta el tiempo que lleva observada.
- Una **fóvea** artificial salta con sacádicos entre ojos, boca y lo más saliente de la escena, y deja su recorrido.
- **CONTACTO:** si alguien mira directamente a la cámara durante medio segundo, todo se apaga menos su cara, entra el acento y la máquina le sostiene la mirada. La sensibilidad se ajusta en CONTACTO.
- No calcula edad, género ni emoción.

## Sonido (`S`, apagado por defecto)
Dron grave en Re que sigue la energía de la escena, pulso IDM contenido que se densifica con el movimiento y con cada persona, un tick metálico en cada sacádico, golpe y placa cuando alguien entra, y el CONTACTO corta el ritmo, deja silencio y cae un impacto.

## Salidas
- **GRABAR** (`R`): vídeo de la salida (MP4 H.264 si el navegador lo permite, si no WebM). Sin la salida abierta graba la previa.
- **CAPTURA** (`C`): PNG del frame.
- **FIRMA** (`F`): la firma animada de VØID_LOOM con el acento del modo, para cerrar.

## Instalación
`ojo/index.html?instalacion` arranca solo y entra en AUTO (cambia de modo cada 20, 45 o 90 s, y espera si alguien está en CONTACTO). En la app de escritorio, el modo instalación abre además la salida a pantalla completa.

## Atajos
`1–7` modo · `← →` modo anterior / siguiente · `A` análisis · `M` espejo · `espacio` congelar · `B` negro · `F` firma · `P` auto · `O` salida · `S` sonido · `R` grabar · `C` captura · `H` solo previa · `?` ayuda.

## Archivos
- `engine.js`: motor WebGL2 (análisis, modos y postproceso). `vision.js`: IA, sujetos, mirada y capa de análisis. `runtime.js`: cámara → visión → motor. `sound.js`: sonido.
- `index.html` + `console.js`: consola. `output.html` + `output.js`: salida.
- `vendor/human/` y `models/`: librería y modelos de IA (MIT). `fonts/`: JetBrains Mono (OFL). `void-loom-sting.js`: la firma.
