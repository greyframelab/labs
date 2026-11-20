# VØID_LOOM · SEMILLA · app de escritorio

[`semilla/`](../semilla/README.md) como programa para Windows y Mac que funciona **sin internet**: el código, la tipografía y el modelo de voz español van dentro.
La SEMILLA en el navegador sigue igual; esta app es otra forma de abrirla.

## Descargar

Release **semilla-app-latest** del repo (se regenera sola cada vez que cambian `semilla/` o `semilla-app/` en `main`):

- **Windows:** `VOID_LOOM-SEMILLA-…-windows-instalador.exe` (se instala) o `…-windows-portable.exe` (se abre sin instalar).
- **Mac:** `VOID_LOOM-SEMILLA-…-mac-arm64.dmg` (Apple Silicon) o `…-mac-x64.dmg` (Intel).

La app no está firmada con certificado de pago, así que la primera vez el sistema avisa:

- **Windows:** «Windows protegió su PC» → *Más información* → *Ejecutar de todas formas*.
- **Mac:** clic derecho sobre la app → *Abrir* → *Abrir*. Si dice que está dañada, ejecuta `xattr -cr "/Applications/VØID_LOOM SEMILLA.app"` en Terminal. La primera vez pide permiso para el micrófono (Ajustes del Sistema › Privacidad › Micrófono).

## La voz, sin internet

En la app, el modo PÚBLICO reconoce la palabra **en el propio ordenador** con Vosk (WebAssembly) y el modelo español `vosk-model-small-es-0.42` (Apache 2.0). La voz no se envía ni se guarda.

En el navegador se usa el reconocimiento de Chrome, que necesita internet. Si la consola dice *SIN MODELO DE VOZ*, la app se generó sin el modelo (`npm run model`); la obra funciona igual y se puede probar escribiendo la palabra.

## Menú

- **Semilla › Modo instalación:** al abrir, arranca sola (sin clic) en el modo elegido en *La instalación arranca en*: PÚBLICO o AUTOMÁTICO. Con proyector, la consola queda en la pantalla principal y la SALIDA va sola al proyector, a pantalla completa. Con una sola pantalla, la obra ocupa la pantalla completa. Escape no saca de pantalla completa en este modo.
- **PROYECTAR** (en la consola, `P`) abre la SALIDA en el proyector, o en la pantalla actual si no hay otro, a pantalla completa.
- **Semilla › Abrir al encender el ordenador:** junto con el modo instalación, el ordenador arranca directamente en la obra.
- **Semilla › Abrir carpeta de grabaciones / capturas:** GRABAR VUELTA y CAPTURA guardan sin preguntar en *Vídeos › VØID_LOOM SEMILLA* e *Imágenes › VØID_LOOM SEMILLA*.
- **Pantalla › Pantalla completa** (Ctrl/⌘+⇧+F) y **Mover a la siguiente pantalla** (Ctrl/⌘+⇧+M).

En Windows el menú se oculta; aparece pulsando **Alt**.

## Generar la app a mano

```
cd semilla-app
npm ci
npm run model        # descarga el modelo de voz (una vez)
npm run dist:win     # en Windows
npm run dist:mac     # en Mac
```

`npm start` la abre sin empaquetar: antes copia `semilla/` en `www/`. Con `--instalacion` arranca en modo instalación una vez.
