# VØID_LOOM LIVE · app de escritorio

El live de VØID_LOOM (`live/`) como programa para Windows y Mac que funciona **sin internet**.
El live en el navegador sigue igual; esta app es otra forma de abrirlo.

## Descargar

Release **live-app-latest** del repo (se regenera sola cada vez que cambian `live/` o `live-app/` en `main`):

- Windows: `VOID_LOOM-LIVE-…-windows-instalador.exe` (se instala) o `…-windows-portable.exe` (se abre sin instalar, para llevar en un USB).
- Mac: `VOID_LOOM-LIVE-…-mac-arm64.dmg` (Apple Silicon, M1 en adelante) o `…-mac-x64.dmg` (Intel).

La app no está firmada con certificado de pago, así que la primera vez el sistema avisa:

- **Windows:** «Windows protegió su PC» → *Más información* → *Ejecutar de todas formas*.
- **Mac:** clic derecho sobre la app → *Abrir* → *Abrir*. Si dice que está dañada: `xattr -cr "/Applications/VØID_LOOM LIVE.app"` en Terminal.

## Cómo se actualizan las piezas

1. La app lleva dentro una copia de todas las piezas del momento en que se generó: funciona desde el primer arranque sin red.
2. Cada vez que se abre con internet, mira Labs en GitHub y descarga solo lo nuevo o cambiado (piezas, audio y el propio live). Si en 20 s no ha terminado, arranca con lo guardado y avisa al acabar.
3. Sin internet usa lo último guardado. **Antes de ir a un sitio sin red, ábrela una vez con conexión.**
4. **Live › Actualizar piezas** (Ctrl/⌘+U) fuerza la descarga cuando quieras.

Las tipografías de Google Fonts también se guardan en local la primera vez que se ven.

## Menú

- **Live › Modo instalación:** al abrir, arranca solo, pone la salida a pantalla completa y entra en AUTOPLAY. Para dejarlo desatendido. Escape no saca la salida de pantalla completa en este modo.
- **Live › Abrir al encender el ordenador:** junto con el modo instalación, el ordenador arranca directamente en la pieza.
- **Live › Abrir carpeta de piezas:** la copia local.
- **Salida › Abrir salida** (Ctrl/⌘+⇧+O), **Pantalla completa** (Ctrl/⌘+⇧+F), **Mover a la siguiente pantalla** (Ctrl/⌘+⇧+M).
- **Ver › Recargar el live** (Ctrl/⌘+⇧+R, pide confirmación).

En Windows el menú se oculta; aparece pulsando **Alt**.

## Diferencias con el navegador

- La salida se abre sola en la segunda pantalla (el proyector), a pantalla completa y sin barras. Si conectas el proyector después, se mueve sola.
- La consola nunca se frena aunque quede detrás de la salida.
- La pantalla no se apaga mientras la app está abierta.
- MIDI (DDJ-200) sin pedir permiso.
- Cerrar pide confirmación, para no cortar un directo por accidente.
- Ajustes, mapeo MIDI y piezas fuera del AUTOPLAY se guardan en la app, aparte de los del navegador.

## Generar la app a mano

```
cd live-app
npm ci
npm run dist:win     # en Windows
npm run dist:mac     # en Mac
```

`npm start` la abre sin empaquetar (después de `npm run seed`). Con `VLL_ROOT=/otra/carpeta` usa otra copia local; con `--instalacion` arranca en modo instalación una vez.
