# VØID_LOOM · MENSAJERO
Sala del acto I (EL MUNDO) de la exposición [VØID_LOOM · PARTITURA](../museo/EXPOSICION.md).

Una antena de espacio profundo de 70 m, de noche, apuntando exactamente donde apunta ahora mismo la de verdad. A oscuras es solo una silueta negra que tapa las estrellas. **Cada paquete real que recibe la revela en puntos de luz.** La señal dibuja a quien la escucha.

**Abrir:** `mensajero/index.html` (consola) → ARRANCAR → ABRIR SALIDA → llevar la ventana al proyector y hacer doble clic. O la app de escritorio ([`mensajero-app/`](../mensajero-app/README.md)).

## El dato (real y en directo)
- **NASA Deep Space Network Now** (`eyes.nasa.gov/dsn/data/dsn.xml`), leído cada 5 s, con los nombres de las naves de `config.xml`.
- La pieza escucha la antena de 70 m de Madrid (**DSS63, Robledo de Chavela**) si está recibiendo. Si no, otra de Madrid; si no, las de 70 m de Goldstone (DSS14) o Canberra (DSS43); si no, cualquiera que reciba.
- Lo que usa:
  - **Azimut y elevación** reales: la antena gira a su posición a la velocidad de una de 70 m.
  - **Nave**: su nombre se escribe en el cielo en la RUPTURA.
  - **Distancia y tiempo de luz** (rtlt/2): van en el TESTIGO.
  - **Velocidad de datos**: cada cuánto llega un paquete, que es el ritmo.
  - **Potencia** (dBm): brillo de la revelación e intensidad del coro.
- **MEMORIA**: si el feed no responde 30 s, sigue con la última lectura y el TESTIGO no se escribe.
- En el navegador el feed puede bloquearse por CORS; en la app va por un puente interno (`mensajero://dsn/`).

## Una vuelta (34 s)
| Tiempo | Acto | Imagen | Sonido |
|---|---|---|---|
| 0–6 | SEÑAL | Silueta contra las estrellas. TESTIGO: `ESCUCHANDO A <NAVE> / <DISTANCIA> · <VELOCIDAD>` | Sub que respira, lecho CS-80, swell de metal |
| 6–20,6 | TENSIÓN | Los paquetes caen del cielo (fotones) y cada uno baja por el eje como una onda plana que revela el cuenco, las juntas de los paneles, la celosía, el pedestal y el suelo | Metal arqueado grave + latido por paquete; racimo grave que se hunde |
| 20,6–22,3 | — | Negro | Silencio total |
| 22,3 | RUPTURA | Los fotones escriben el **nombre de la nave** en el cielo (MATRIZ 5×7) y caen al foco; la antena se revela entera | BRAAM (metal tipo Blade Runner 2049) + caída de sub |
| 28–34 | ECO | Noche. TESTIGO: `ESTA SEÑAL SALIÓ HACE <TIEMPO> / <ANTENA> · <LUGAR> · EN DIRECTO` | Swell y cola |

## Imagen
- Modelos reales de **NASA 3D Resources**: la antena DSN de 70 m (NASA/Brian E. Kumanchik) para DSS14, DSS43 y DSS63, y la de 34 m (NASA/Brian E. Kumanchik, NASA/Christian A. Lopez) para el resto de la red. Convertidos con `tools/convierte_modelo.mjs` a `modelo/dsn70.bin` y `modelo/dsn34.bin`; los dos van articulados en azimut y elevación como los reales. Se ve el de la antena que se escucha.
- Unos 590.000 puntos muestreados sobre su superficie, más densos en lo fino. El sólido va en negro absoluto como silueta.
- Cielo con estrellas y Vía Láctea. La nave es un punto en el eje.
- Profundidad de campo propia (con la profundidad real), bloom contenido, ACES y grano sutil. Acento: blanco espectral.

## Sonido (NADIR)
Dark ambient tipo Tineidae con los metales de Blade Runner 2049 (`sonido.js`; el mismo motor en vivo y en render). Sin tics ni batería: el pulso es un latido. Sin delay, catedral larga y oscura. ≈ −14 LUFS, pico −3 dBFS.

## Render
`node tools/render.js <carpeta> 1280 720 24 0 34 1` usa la lectura real guardada (MEMORIA). `EXTRA="&testigo"` fuerza el TESTIGO para validar.
