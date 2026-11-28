# VØID_LOOM · SEMILLA · estado (28 nov 2026)

Generador de arte abstracto en tiempo real: dices una palabra, se vuelve materia 3D y su emoción la convierte en forma, luz y sonido. Vive en el repo `greyframelab/labs`, carpeta `semilla/` (motor en `semilla/engine.js`).

## PRs
| PR | Qué | Estado |
|---|---|---|
| #140 | Palabra 3D de laca, luz sin quemados y LÁMINAS rehecha | Mergeada (27 nov) |
| #141 | Arregla la lectura de la MATRIZ 5×7 (fila superior de cada letra) | Abierta (de otra sesión, por confirmar) |
| #137 | Causa real de los discos de la tipografía (textura del eco) | Mergeada (22 nov) |
| #128 | Rótulo de la palabra sin discos de color | Mergeada (21 nov) |
| #127 | MÖBIUS de láminas (sustituye a ARMILAR) | Mergeada (21 nov) |
| #125 / #126 | NÚCLEO, ARMILAR, sin saltos al hablar, sin quemados | Mergeadas (21 nov) |

## Decisiones
- **Nivel gráfico:** había piezas quemadas y sin nivel. Se sube todo en el motor, no solo en el reel.
- **Luz:** tope de luminancia con rodilla suave, luz principal comprimida, bloom con umbral 0.32 y curva de tono revisada. Ya no hay blancos quemados.
- **Palabra 3D:** letras negras de laca con volumen, canto encendido en el color de la emoción (MIEDO morado, FUEGO rojo), reflejo de caja de luz en la cara y cámara frontal que encuadra la palabra entera.
- **Palabra limpia:** los trazos de luz pasan solo por detrás y las juntas de lámina se cierran en el ECO (cada letra se lee como bloque).
- **LÁMINAS:** torre de 13 losas con cantos encendidos y pulso que sube.
- **MIEDO:** la oscuridad se cierra, pero no tapa la palabra.
- **Reel con concepto:** formato instalación (banda 16:9 dentro del 9:16) con textos que explican la idea. La palabra se construye en láminas, se rompe y se transforma en su forma con un fundido, sin corte.
- **Cierre:** la firma VØID_LOOM va a pantalla completa, no dentro de la banda.

## Descartado
- Formas: MEMBRANA, PIEL, ECLIPSE (demasiado simple) y NÚCLEO (demasiado complejo). NÚCLEO y ARMILAR quedan archivadas en `semilla/archivo/`.
- Reel con corte seco palabra → forma: no se entendía la transformación.
- Firma dentro de la banda: no se veía el logo.

## Entregado
- `SEMILLA_reel_v6.mp4`: reel final de Instagram, 1080×1920, 30 fps, 31,4 s, audio a −14 LUFS / −1,5 dBTP.
  - Textos: «VØID_LOOM · SEMILLA» · «Di una palabra.» · «La palabra se vuelve materia.» · «Su emoción se convierte en forma, luz y sonido.» · «Instalación audiovisual en tiempo real.» · «Cada obra es única.»
  - Orden: MÖBIUS → MIEDO (palabra 3D → ESPINA) → FUEGO (palabra 3D → FRACTURA) → AGUA/CONCHA → SILENCIO/MONOLITO → MÖBIUS roja → firma.
- Anteriores: `SEMILLA_reel.mp4` (v2, 23 s, sin palabra 3D) y `SEMILLA_reel_v5.mp4` (cierre sin logo, sustituido por v6).

## Pendiente
- [ ] Toni: subir el reel v6 a Instagram.
- [ ] Revisar #141 (MATRIZ 5×7), que está abierta.
- [ ] Probar en la app (consola, salida y modo PÚBLICO) que la palabra 3D nueva y LÁMINAS se ven bien en su PC y en el de la empresa.
- [ ] Opcional: caras de las letras algo más brillantes; algunos encuadres oscuros en PLIEGUE y MONOLITO; apertura MÖBIUS cian algo apagada.
- [ ] Actualizar el deck de SEMILLA con la palabra 3D nueva y LÁMINAS.

## Para retomar
- `main` ya incluye #140. Para cambios nuevos, crear una rama desde `main`.
- Render offline: Playwright + swiftshader. Página `reel3.html` (banda 16:9 + textos), spec `reel_spec5.cjs` (tramos, fundidos, textos) y mezcla de audio `mix5.py`. Estos scripts estaban en el espacio temporal de la sesión: si hacen falta, hay que rehacerlos.
- Siguiente paso: que Toni pruebe en la app; luego, si quiere, subir el brillo de las caras de las letras.
