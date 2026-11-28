# MENSAJERO · estado y memoria del proyecto
> Se actualiza en cada PR que toque `mensajero/` o `mensajero-app/`. Última actualización: 28 nov 2026.

## Decisiones (de Toni)
| Fecha | Decisión |
|---|---|
| 27 nov | Siguiente sala tras MURMULLO: entre MENSAJERO y CÉNIT, elige **MENSAJERO** (antena de espacio profundo, NASA DSN). |
| 27 nov | Modelado a mano descartado (parecía una maqueta). Base: **modelo real de NASA de la antena de 70 m**. |
| 27 nov | Primera versión en laca: "no se acaba de ver la representación en real time de data real; plásticamente le falta; sonido más Tineidae/NADIR". |
| 27 nov | Propone el **efecto eco visual** (revelado tipo LIDAR de Lab 28 Eco): sí. La antena en puntos la revela cada paquete real. |
| 27 nov | Le gusta. Pide **ver más clara la data real**, mejorar plástica y conceptualmente, y subir y mergear la PR. Se añaden: el nombre de la nave escrito en el cielo con sus fotones, el TESTIGO en dos tiempos y el feed en directo con consola, salida y app. |
| 28 nov | Antenas de 34 m: comprobar si NASA publica el modelo (sí) y usarlo, con el tamaño en la frase. |
| 28 nov | Ir **cambiando de antena receptora (prioridad DSS63) y de nave**; el visitante tiene que ver que algo ocurre en real time. Planos y audio no pueden ser siempre los mismos: que cambien con el dato y que el concepto sea más evidente. |

## Rotación de escucha y el dato manda (28 nov)
- **Rotación:** cada vuelta, otro enlace real activo (antena → nave). DSS63 sale una vuelta sí y otra no si recibe; el resto por turno (el que hace más que no se escucha, mejor de otra estación). Interruptor ROTAR en la consola.
- **GIRO:** al cambiar de escucha la vuelta abre con cámara fija en el mundo y la antena gira (rápido, para la sala) a la posición real nueva. Frase: `CAMBIO DE ESCUCHA → DSS65 · MADRID / AHORA ESCUCHA A MMS 4 / distancia · velocidad`.
- **Planos:** salen del enlace (`montaje.planos`): velocidad → nº de cortes (2–5); distancia → óptica (lejos tele, cerca angular) y repertorio; nave + vuelta → semilla. Cada lectura real puede cortar de plano en la TENSIÓN (`montaje.corte`).
- **Sonido:** `sonido.opciones(enlace)`: distancia → nota (MIDI 46 → 31), velocidad → BPM (54–84) y paquetes, potencia → coro, estación → timbre del metal (Madrid barra, Goldstone cuerda, Canberra placa), nave → semilla e intervalo (cada nave tiene su voz). El lecho se desliza a la nota nueva. Sonoridad compensada (≈ −13/−14 LUFS en todos los enlaces).
- **Registro de eventos reales** (arriba a la izquierda, hora UTC): ADQUIERE / DEJA DE ESCUCHAR / PASA DE X A Y / cambio de velocidad, más `▸ LA PIEZA PASA A ESCUCHAR…`.
- **Leyenda** (7–13 s): `TONO ← DISTANCIA · PULSO ← VELOCIDAD = BPM · BRILLO ← DBM · TIMBRE ← ESTACIÓN · VOZ ← NAVE`.
- Render: `EXTRA="&enlace=DSS65&desde=DSS63"` simula un cambio de escucha con la lectura guardada.

## Hecho
- `mensajero/` (escena, datos, montaje, sonido, consola, salida y render), `mensajero-app/` y su workflow `mensajero-app.yml` (release `mensajero-app-latest`).

## Pendiente
- [ ] Probar con el feed real en la app (en el navegador puede que la NASA no permita CORS: entonces la web irá en MEMORIA).
- [ ] Rendimiento en el PC de sala (590.000 puntos): bajar `calidad` si hace falta.
- [x] Reel de MENSAJERO (27 nov): 9:16, 27 s, desde los 12,5 s de la vuelta (cuenco → LA RED → negro → nombre → golpe → ECO) + firma en blanco espectral con sonido propio (`tools/firma_audio.py`, BRAAM grave y arco metálico, nada de tonos que suben). Se regenera con `PW=… tools/reel.sh <carpeta>`.
- [x] Cambio de nave como evento: entra en el registro; la pieza rota en la vuelta siguiente.
- [x] Antenas de 34 m (28 nov): modelo real de NASA 3D Resources «Deep Space Network 34-meter» (Kumanchik y Lopez, GLB de GitHub nasa/NASA-3D-Resources) → `modelo/dsn34.bin`. DSS14/43/63 = 70 m; el resto = 34 m. En el GIRO (cámara fija) se ve el cambio de tamaño; en los demás planos la cámara se acerca a su escala. La frase dice `· 34 M` / `· 70 M`. La NASA no dice si el modelo es de guía de ondas o de alta eficiencia: se usa para todas las de 34 m.
