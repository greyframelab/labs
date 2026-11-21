# VØID_LOOM · ROSTRO · app de escritorio

[`rostro/`](../rostro/README.md) como programa para Windows y Mac que funciona **sin internet**: el código, la cara, la tipografía y la visión del modo ESPEJO van dentro.
ROSTRO en el navegador sigue igual; esta app es otra forma de abrirla, pensada para sala.

## Descargar

Release **rostro-app-latest** del repo. Se regenera sola cada vez que cambian `rostro/` o `rostro-app/` en `main`:

- **Windows:** `VOID_LOOM-ROSTRO-…-windows-instalador.exe` (se instala) o `…-windows-portable.exe` (se abre sin instalar). En sala, mejor el instalador: el portable se descomprime en cada arranque.
- **Mac:** `VOID_LOOM-ROSTRO-…-mac-arm64.dmg` (Apple Silicon) o `…-mac-x64.dmg` (Intel).

La app no está firmada con certificado de pago, así que la primera vez el sistema avisa:

- **Windows:** «Windows protegió su PC» → *Más información* → *Ejecutar de todas formas*.
- **Mac:** clic derecho sobre la app → *Abrir* → *Abrir*. Si dice que está dañada, ejecuta `xattr -cr "/Applications/VØID_LOOM ROSTRO.app"` en Terminal. La primera vez pide permiso para la cámara (Ajustes del Sistema › Privacidad › Cámara); solo hace falta para ESPEJO.

## Fluidez

- Fuerza la gráfica de alto rendimiento en portátiles con dos gráficas.
- No deja que el sistema frene la animación cuando la ventana pierde el foco ni que la pantalla se apague.
- La SALIDA calcula la pieza por su cuenta, sincronizada por reloj con la consola, así que no da tirones aunque la consola esté ocupada.
- Si la tarjeta no consigue preparar la cabeza con el modo gráfico por defecto (Direct3D en Windows), la app se reinicia sola probando otro (OpenGL, D3D11on12, Vulkan) y recuerda el que funciona.
- Calidad automática: si no llega a 60 fps, baja la resolución, fija 30 fps estables y, si hace falta, quita sombras y bloom. Los cambios esperan a un corte de plano.

## ESPEJO, sin internet

La cara del visitante se analiza **en el propio ordenador** con la visión de OJO (Human, MIT). Solo se leen la boca, las cejas, los ojos y el giro de la cabeza. La imagen no se proyecta, no se envía y no se guarda.

## Menú

- **Rostro › Modo instalación:** al abrir, arranca sola (sin clic) en el modo elegido en *La instalación arranca en*: AUTOMÁTICO o ESPEJO. La SALIDA va sola al proyector, a pantalla completa. Escape no saca de pantalla completa en este modo.
- **PROYECTAR** (en la consola, `P`) abre la SALIDA en el proyector, o en la pantalla actual si no hay otro, a pantalla completa.
- **Rostro › Abrir al encender el ordenador:** junto con el modo instalación, el ordenador arranca directamente en la obra.
- **Rostro › Abrir carpeta de capturas:** CAPTURA guarda sin preguntar en *Imágenes › VØID_LOOM ROSTRO*.
- **Pantalla › Pantalla completa** (Ctrl/⌘+⇧+F) y **Mover a la siguiente pantalla** (Ctrl/⌘+⇧+M).

En Windows el menú se oculta; aparece pulsando **Alt**.

## Generar la app a mano

```
cd rostro-app
npm ci
npm run dist:win     # en Windows
npm run dist:mac     # en Mac
```

`npm start` la abre sin empaquetar: antes copia `rostro/` y la visión de OJO en `www/`. Con `--instalacion` arranca en modo instalación una vez.
