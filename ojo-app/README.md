# VØID_LOOM · OJO · app de escritorio

[`ojo/`](../ojo/README.md) como programa para Windows y Mac que funciona **sin internet**: el código, los modelos de IA y la tipografía van dentro.
El OJO en el navegador sigue igual; esta app es otra forma de abrirlo.

## Descargar

Release **ojo-app-latest** del repo (se regenera sola cada vez que cambian `ojo/` u `ojo-app/` en `main`):

- Windows: `VOID_LOOM-OJO-…-windows-instalador.exe` (se instala) o `…-windows-portable.exe` (se abre sin instalar, para llevar en un USB).
- Mac: `VOID_LOOM-OJO-…-mac-arm64.dmg` (Apple Silicon, M1 en adelante) o `…-mac-x64.dmg` (Intel).

La app no está firmada con certificado de pago, así que la primera vez el sistema avisa:

- **Windows:** «Windows protegió su PC» → *Más información* → *Ejecutar de todas formas*.
- **Mac:** clic derecho sobre la app → *Abrir* → *Abrir*. Si dice que está dañada: `xattr -cr "/Applications/VØID_LOOM OJO.app"` en Terminal. La primera vez pide permiso para la cámara (Ajustes del Sistema › Privacidad › Cámara).

## Menú

- **Ojo › Modo instalación:** al abrir, arranca solo, abre la salida a pantalla completa y entra en AUTO. Escape no saca la salida de pantalla completa en este modo.
- **Ojo › Abrir al encender el ordenador:** junto con el modo instalación, el ordenador arranca directamente en OJO.
- **Ojo › Abrir carpeta de grabaciones / capturas:** GRABAR y CAPTURA guardan sin preguntar en *Vídeos › VØID_LOOM OJO* e *Imágenes › VØID_LOOM OJO*.
- **Salida › Abrir salida** (Ctrl/⌘+⇧+O), **Pantalla completa** (Ctrl/⌘+⇧+F), **Mover a la siguiente pantalla** (Ctrl/⌘+⇧+M).

En Windows el menú se oculta; aparece pulsando **Alt**.

## Diferencias con el navegador

- La cámara no pide permiso cada vez.
- La salida se abre sola en la segunda pantalla (el proyector), a pantalla completa y sin barras. Si conectas el proyector después, se mueve sola.
- La consola nunca se frena aunque quede detrás de la salida, y la pantalla no se apaga.
- Cerrar pide confirmación, para no cortar una instalación por accidente.

## Generar la app a mano

```
cd ojo-app
npm ci
npm run dist:win     # en Windows
npm run dist:mac     # en Mac
```

`npm start` la abre sin empaquetar (copia antes `ojo/` en `www/`). Con `--instalacion` arranca en modo instalación una vez.
