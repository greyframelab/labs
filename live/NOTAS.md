# VØID_LOOM · estado del proyecto — 20/11/2026

Repo: `greyframelab/labs` · Web: https://greyframelab.github.io/labs/ · App: https://github.com/greyframelab/labs/releases/tag/live-app-latest

## 1. LIVE (`live/`)

### Audio — botón AUDIO (3 modos, se guarda como `audioModo`)
| Modo | Qué hace |
|---|---|
| **GRABADO** | El audio original de cada pieza. |
| **SÍNTESIS** | Se sintetiza en tiempo real al cargar (render offline del navegador). Kit aleatorio en cada pase (bombo ×4, bajo ×4, tick ×3, hat ×3, ice ×4) + transposición; en la ruptura cambia a un segundo kit. Semilla 0 = versión canónica. |
| **AMBIENT · NADIR** | Dark ambient estilo Tineidae, sin batería. Una pieza musical distinta por vídeo, cada una con su instrumento de bajo (órgano, FM, braam, cuerda, laca…), riser y golpe cinemático propios. Render a 24 kHz. |

- La consola elige la semilla y la manda a la salida; la salida recarga la pieza si cambia.
- El deck espera en silencio hasta que el audio sintetizado está listo (no se mezcla con la base).
- Autoplay precarga 14 s antes en modos de síntesis.
- Archivos: `live/synth/vl-voces.js` (instrumentos y kits), `live/synth/piezas.js` (partituras, NADIR por pieza en `ND`).

### Biblioteca del live
- Fuera del live: **Descarga** (`FUERA = ['lab-35-descarga']` en `control.js`).
- **Ciudad**: quitada y vuelta a añadir.
- Síntesis + NADIR hechos también para Órbitas, Estrella y Surco.

### Arranque (estado de carga)
- Al pulsar ARRANCAR, el botón pasa a `CARGANDO · NN%` y se ven cuatro fases: AUDIO → BIBLIOTECA → PIEZAS → DECKS (activa en rojo, hechas en gris).
- Debajo, qué se está leyendo y cuántas piezas llevan audio y actos (`AUDIO 12/18 · ACTOS 08/18`), con porcentaje real.
- En SÍNTESIS / NADIR espera a que el audio generado de los decks A y B esté listo (máx. 30 s) antes de entrar.
- Si falla (sin conexión, biblioteca vacía…), lo dice y el botón pasa a REINTENTAR.

### Rendimiento
- La ventana de salida va en su propio proceso (`noopener`); las previews del monitor viajan como JPEG.
- IMPERMANENCIA: amplitudes de cámara más fuertes por pieza.

## 2. App de escritorio (`live-app/`)
- Menú **Gráfica**: Auto (GPU de alto rendimiento, ignora blocklist) · Compatible (+ OpenGL en Windows) · Software (SwiftShader). Nunca `enable-zero-copy` (dejaba la salida en negro).
- Si la salida no consigue WebGL2, avisa en pantalla y la app propone el siguiente modo.
- Icono y splash con el logo VØID_LOOM en cian frío `#00E5FF` (construcción SYS.01).
- El workflow de la app solo se lanza con cambios en `live/**`, `live-app/**` o el propio workflow. La app sincroniza las piezas desde GitHub al arrancar.

## 3. Labs web — calidad de imagen
- Sin scanlines; grano 0.05.
- Resolución completa en escritorio + FXAA en Masa, Campo, Grieta y Teseracto.
- Arreglado `smoothstep` invertido (a > b, indefinido en algunas gráficas) en 11 piezas + Ojo.

## 4. Estrella — la luz de las caras (PR #108–#112)
**Problema:** en Windows, Chrome traduce WebGL a DirectX (ANGLE D3D11). El shader 3D completo de Estrella no compila al dibujar → se pierde el contexto → desaparece todo el 3D. Pasa con cualquier gráfica en Windows, no es cuestión de potencia. Además, tras varios fallos Chrome bloquea el 3D en la web hasta reiniciar el navegador.

**Solución actual (#112, mergeado):**
- La luz de las caras se dibuja en **2D** (velo de vidrio, más claro arriba y en ángulo rasante; caras de atrás tenues). Se ve igual en todos los equipos.
- Sin WebGL2 o con el 3D bloqueado, la pieza sigue en 2D en vez de romperse.
- Donde el 3D funciona se suma el brillo volumétrico y el reflejo en el suelo.
- Con DirectX se usa además un shader ligero (#111).
- Parámetros de prueba: `?lite` (shader ligero) · `?nogl` (solo 2D).

**Pendiente:** confirmar en los dos PCs (casa: AMD Radeon integrada; empresa) con `?v=112`. Si Chrome tiene el 3D bloqueado, cerrar el navegador del todo y volver a abrir.

### Lecciones para shaders (Windows / DirectX)
- Nada de `smoothstep(a,b,x)` con a > b → usar `1.-smoothstep(b,a,x)`.
- Bucles con límite uniforme (`for(int i=0;i<uN;i++)`), no fijos con `break`.
- Llamar a la escena una sola vez (no duplicarla para reflejos) y un solo bucle por elemento: cada llamada extra multiplica el shader y en DirectX deja de compilar.
- Proteger divisiones, `pow` de base negativa y NaN/Inf en el color final.
- Lo esencial de la pieza (lo que el usuario tiene que ver sí o sí) mejor en 2D; el 3D como capa extra.

## 5. Pendiente / ideas
- Comprobar Estrella en los dos PCs (PR #112, ya mergeado).
- Opcional: NADIR con instrumentos aleatorios por pase (como SÍNTESIS).
