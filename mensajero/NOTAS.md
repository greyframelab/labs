# MENSAJERO · estado y memoria del proyecto
> Se actualiza en cada PR que toque `mensajero/` o `mensajero-app/`. Última actualización: 27 nov 2026.

## Decisiones (de Toni)
| Fecha | Decisión |
|---|---|
| 27 nov | Siguiente sala tras MURMULLO: entre MENSAJERO y CÉNIT, elige **MENSAJERO** (antena de espacio profundo, NASA DSN). |
| 27 nov | Modelado a mano descartado (parecía una maqueta). Base: **modelo real de NASA de la antena de 70 m**. |
| 27 nov | Primera versión en laca: "no se acaba de ver la representación en real time de data real; plásticamente le falta; sonido más Tineidae/NADIR". |
| 27 nov | Propone el **efecto eco visual** (revelado tipo LIDAR de Lab 28 Eco): sí. La antena en puntos la revela cada paquete real. |
| 27 nov | Le gusta. Pide **ver más clara la data real**, mejorar plástica y conceptualmente, y subir y mergear la PR. Se añaden: el nombre de la nave escrito en el cielo con sus fotones, el TESTIGO en dos tiempos y el feed en directo con consola, salida y app. |

## Hecho
- `mensajero/` (escena, datos, montaje, sonido, consola, salida y render), `mensajero-app/` y su workflow `mensajero-app.yml` (release `mensajero-app-latest`).

## Pendiente
- [ ] Probar con el feed real en la app (en el navegador puede que la NASA no permita CORS: entonces la web irá en MEMORIA).
- [ ] Rendimiento en el PC de sala (590.000 puntos): bajar `calidad` si hace falta.
- [x] Reel de MENSAJERO (27 nov): 9:16, 27 s, desde los 12,5 s de la vuelta (cuenco → LA RED → negro → nombre → golpe → ECO) + firma en blanco espectral con sonido propio (`tools/firma_audio.py`, BRAAM grave y arco metálico, nada de tonos que suben). Se regenera con `PW=… tools/reel.sh <carpeta>`.
- [ ] Si la antena cambia de nave a mitad de vuelta, el nombre del cielo sigue siendo el de la vuelta (se actualiza en la siguiente). Valorar si se quiere un "cambio de nave" como evento.
