# VØID_LOOM · PARTITURA
Exposición individual. Propuesta de trabajo (v0 · 27 nov 2026).

> Todo lo que se ve y se oye en la sala lo toca una partitura que no ha escrito nadie: el planeta, un cuerpo dormido, la voz de quien entra, el archivo de la propia máquina.

## La idea
Las piezas de VØID_LOOM ya tienen cuatro actos dentro: **SEÑAL → TENSIÓN → RUPTURA → ECO**. La exposición repite esa misma estructura a escala de edificio. El visitante la recorre en el orden en que vive cada pieza: primero el mundo emite, después el cuerpo responde, luego entra él y lo rompe, y al final queda el eco.

Cada sala es una partitura distinta. La regla es la misma en todas: **nada está grabado, nada se repite y el dato nunca se enseña**. Solo se revela al salir, en una línea.

## Recorrido

| Acto | Sala | Partitura | Piezas |
|---|---|---|---|
| **I · SEÑAL** | EL MUNDO | Datos abiertos en tiempo real | **MURMULLO** (Wikipedia) · LÍTICA (sismos USGS) · CORONA (viento solar NOAA) · ENJAMBRE (Bluesky) · TRÁNSITO (vuelos OpenSky) · LATIDO (Barcelona: Bicing y sensores) |
| **II · TENSIÓN** | EL CUERPO | Biología | CÓRTEX (EEG de una noche de sueño) · ROSTRO (cabeza y emociones) |
| **III · RUPTURA** | EL VISITANTE | La persona que entra | OJO (la máquina te mira) · SEMILLA (tu palabra se hace materia) |
| **IV · ECO** | EL ARCHIVO | La memoria de la máquina | LIVE en AUTOPLAY: la serie de 18 loops, de negro a negro |

**Las que vendrán** encajan en el acto que corresponda a su partitura. Cada pieza nueva declara de qué se alimenta (mundo, cuerpo, visitante o archivo) y con eso ya sabe en qué sala va. Si una pieza no tiene partitura, no entra en PARTITURA.

### Por qué este orden
- Se pasa de lo más lejano (el planeta) a lo más íntimo (tú). La tensión crece sola.
- En el acto I el visitante es testigo. En el III es la causa. La RUPTURA de la expo es el momento en que la obra deja de ignorarle.
- El ECO es descanso: la serie de loops, sin interacción, como un archivo que respira.

## Acto I · EL MUNDO (serie SISMÓGRAFO)
Seis piezas, una fuente cada una. Todas son gratuitas, sin clave y se leen desde el navegador.

| Pieza | Fuente | Ritmo del dato | Qué es |
|---|---|---|---|
| **MURMULLO** | Wikimedia EventStreams (`recentchange`) | 20–50 eventos/s, 24 h | Una losa de obsidiana donde el mundo escribe. Cada edición es una incisión, cada borrado lima la piedra, cada guerra de ediciones la agrieta. |
| LÍTICA | USGS (`all_hour.geojson`, cada minuto) | Irregular, a veces nada | Masa negra que se fractura con cada sismo real; la profundidad del sismo es el tono. La ausencia también es la obra. |
| CORONA | NOAA SWPC (viento solar, Kp) | Lento (minutos) | Un halo que respira. La sala contemplativa. Cuando hay tormenta geomagnética, contamina todas las demás. |
| ENJAMBRE | Bluesky Jetstream (WebSocket) | Cientos/s | Materia de enjambre: forma, idioma y conversación, nunca texto. Nada identificable. |
| TRÁNSITO | OpenSky Network | Cada 10–15 s | Trayectorias de vuelo sobre Europa como cicatrices de luz que se acumulan durante la noche. Sin mapa. |
| LATIDO | GBFS Bicing + Open Data BCN | Minutos | Sístole y diástole de la ciudad donde está la sala. "Esto pasa a 2 km de ti". |

Antes de montar cada una hay que comprobar que la fuente sigue abierta, que acepta conexiones desde el navegador y qué límites tiene.

## La sala cruzada: PULSO
Lo que hace la exposición distinta: **las piezas se escuchan entre ellas**. Es un único organismo, no seis pantallas.

- Bus local `PULSO`: `BroadcastChannel` si todo corre en un mismo PC, o un WebSocket mínimo en la red de la sala si hay varios PCs.
- Cada pieza publica sus eventos fuertes y reacciona a los ajenos con discreción (nunca les cede el protagonismo):

| Si pasa… | Publica | Las demás… |
|---|---|---|
| Sismo M≥4,5 (LÍTICA) | `sismo` | 2 s de silencio y un temblor en la imagen. MURMULLO deja de escribir. |
| Tormenta solar Kp≥5 (CORONA) | `tormenta` | Su acento se tiñe y el dron se ensucia durante la tormenta. |
| Guerra de ediciones (MURMULLO) | `ruptura` | Glitch de un compás en ENJAMBRE. |
| Entra alguien (OJO) | `visitante` | Las del acto I bajan un punto: el mundo baja la voz cuando llegas. |
| Palabra dicha (SEMILLA) | `palabra` (solo su familia, nunca la palabra) | El arquetipo tiñe el siguiente pase de CÓRTEX. |

- Formato: `{de, tipo, fuerza 0–1, t}`. Sin datos personales, nunca.

## Montaje
- **Una app, muchas salas:** `museo/` será el lanzador común (escritorio, como LIVE y SEMILLA). Cada PC de sala abre su pieza a pantalla completa en el proyector, en modo instalación, sin consola visible. La consola del técnico muestra el estado de todas: conexión al dato, fps y bus PULSO.
- **Nunca se para:** si se cae un dato abierto, la pieza pasa a MEMORIA. Reproduce la última hora guardada en local (o, si no hay, un flujo con la misma estadística) hasta que vuelve la conexión. El visitante no lo nota. El técnico sí.
- **Sin UI en las piezas.** Única concesión: una línea mínima en el ECO de cada vuelta en las del acto I, tipo `214 PERSONAS ESCRIBIERON ESTO HACE 3 s`. Hay que validarlo pieza a pieza.
- Sala oscura, negro real, destellos seguros, volumen calibrado por sala. Cada sala con su propio campo sonoro; en los pasillos solo el dron de la siguiente.

## Hoja de ruta
1. **MURMULLO** (en curso): primera sala y plantilla técnica del acto I (flujo en vivo, MEMORIA, partitura única imagen-sonido).
2. LÍTICA: el contrapunto de MURMULLO (casi nada frente a todo el rato).
3. Bus PULSO entre MURMULLO, LÍTICA y las que ya existen (OJO, SEMILLA, CÓRTEX).
4. CORONA, ENJAMBRE, TRÁNSITO, LATIDO.
5. Lanzador `museo/` y dossier de la exposición para centros (no solo festivales: CCCB, Arts Santa Mònica, Matadero, LABoral).
