# VØID_LOOM · ROSTRO · estado (28 nov 2026)

Una cabeza gigante de laca negra, proyectada en una sala oscura, que se contorsiona con todas las emociones al ritmo de su propio sonido.
- Código: carpeta `rostro/` del repo greyframelab/labs.
- App de escritorio: carpeta `rostro-app/`. Los .exe y .dmg se publican solos al mergear en main.
- Funciona como SEMILLA: una consola, una SALIDA que va al proyector, AUTOPLAY y la app de escritorio.

## PRs
Todas están mergeadas y la rama `rostro-continuo` no tiene nada pendiente de subir a main.

| PR | Qué |
|---|---|
| #129 | Primera versión: consola, SALIDA, AUTOPLAY, audio BASE / BASE + AMBIENT y modo ESPEJO |
| #130 | Nivel museo: cara ICT con 53 expresiones, movimiento propio de cada expresión, sin tirones, y app de escritorio |
| #131 | Teclado de emociones, 27 emociones y FX con interruptores |
| #132 | Proyección fiable en tiempo real, emociones de luz y busto que se disuelve |
| #133 | Paso continuo radical y FX nuevos |
| #135 | Vistas CÓDIGO y VECTORES, haz de luz sin borde y formato vertical |

## Decisiones

**Cabeza y aspecto**
- **Cabeza:** ICT Face Model (ICT-FaceKit, licencia MIT). Es una cara media, no una persona concreta, y sustituye al escaneo anterior, que tenía poca definición y se deformaba de forma rara.
- **Material:** laca negra con un solo acento de color, que cambia con cada emoción.
- **Busto:** cuello, hombros y pecho se deshacen en grano hacia el negro, sin cortes.

**Emociones y movimiento**
- **Emociones:** 42 más el reposo, todas con tecla.
  - 27 oscuras: letras y números del 4 al 0.
  - 15 de luz: Mayús + letra.
  - G suelta la emoción.
- **Movimiento:** cada emoción tiene su propio gesto y su propio golpe.
- **Deformación plástica:** la cara se estira, se retuerce, se hincha y se derrite, con un movimiento blando tipo gelatina.

**Modos**
- **AUTOMÁTICO · CONTINUO** (por defecto): un solo paso, sin cortes, por las 42 expresiones (unos 160 s), ordenadas para alternar oscuras y de luz con el máximo contraste. Cada cambio llega con un golpe de sonido, glitch y luz. Al terminar un paso empieza otro sin saltos.
- **PIEZAS:** el modo anterior, que se elige en la consola.
- **ESPEJO** (tecla 3): la cabeza copia y exagera la cara del visitante. No guarda ni proyecta su imagen.

**Audio**
- Dos capas: BASE y BASE + AMBIENT (dron, ruido oscuro y efectos). Se cambia con A.

**FX** (todos activos por defecto y con interruptor en la consola)
- Glitch.
- Estela.
- Atmósfera y haces.
- Destellos.
- Láser: una línea de luz recorre la cara en cada cambio.
- Doble exposición: la cara anterior queda sobreimpresionada un instante.
- Lente: aberración cromática en los bordes, con un tirón en cada golpe.

**VISTA** (tecla Tab y botones en la consola)
- **CÓDIGO:** la piel es el código que la mueve. Cada zona lleva escritos sus músculos con los valores en vivo, el texto se deforma con la cara y se reescribe con el láser en cada cambio.
- **VECTORES:** campo de fuerzas; cada punto de la piel lanza una chispa de luz hacia fuera. Solo se activa a mano.
- **AUTO** (por defecto): alterna la laca y CÓDIGO.

**Proyección**
- El reloj de la obra va en un worker, así que no se para aunque la consola quede tapada o minimizada.
- La SALIDA simula la pieza ella misma y se sincroniza con la consola.
- Dibuja como mucho a unos 1080p de píxeles reales.
- En vertical se abre el plano para que la cabeza quepa entera.

## Descartado
- La cabeza anterior (escaneo de Lee Perry-Smith): poca definición y deformación rara.
- Los cortes duros en los hombros.
- El borde circular del haz de luz detrás de la cabeza.
- VECTORES dentro de AUTO.
- El clip horizontal: no hacía falta.

**En el cajón**
- La versión abstracta y escultórica de la cabeza, por si se recupera.

## Entregado
- **Reel de Instagram** `ROSTRO_reel_ig.mp4`
  - Vídeo: 1080×1920, 33 s y 92 MB, con 28 s del paso continuo con la vista CÓDIGO y el cierre con la firma animada de VØID_LOOM.
  - Audio: −14,5 LUFS.
  - Los fotogramas se borraron, así que para otra versión hay que volver a renderizar.
- **Caption de Instagram:** «Una cabeza de laca negra que siente 42 emociones seguidas…» y la línea en inglés «One face. 42 emotions. Written in code.».

## Pendiente
- [ ] Probar la proyección en el ordenador de la sala, con la consola tapada por la proyección.
- [ ] Probar el .exe en Windows y el .dmg en Mac.
- [ ] Calibrar ESPEJO con personas reales, con el mando EXAGERAR.
- [ ] Decidir si se borran del repo los archivos del escaneo anterior, que ya no se usan: `rostro/assets/LeePerrySmith*`, `Map-SPEC.jpg` e `Infinite-Level_02_Tangent_SmoothUV.jpg`.
- [ ] Citar ICT-FaceKit (USC ICT, licencia MIT) en el dossier.
- [ ] Presentación de ROSTRO para festivales, firmada como VØID_LOOM, con una diapositiva de la consola. Está por confirmar si quedó hecha en otra conversación.

## Para retomar
- Rama de trabajo: `rostro-continuo`, al día con main. Para cosas nuevas, abre una rama nueva desde main.
- Archivos clave en `rostro/`:
  - `rig.js`: emociones y poses.
  - `anim.js`: movimiento.
  - `partitura.js`: paso continuo y piezas.
  - `escena.js`: render, FX y vistas.
  - `sonido.js`: audio.
  - `app.js`: consola.
  - `salida.js`: proyector.
  - `tools/render.html`: render fotograma a fotograma (`?continuo=1&w=&h=&vista=`).
- Siguiente paso: probarla en la sala.
