# VØID_LOOM · CÓRTEX · app de escritorio

[`cortex/`](../cortex/README.md) como programa para Windows y Mac que funciona **sin internet**: el código y la noche de EEG que hace de partitura van dentro.
CÓRTEX en el navegador sigue igual; esta app es otra forma de abrirla, pensada para sala.

## Descargar

Release **cortex-app-latest** del repo. Se regenera sola cada vez que cambian `cortex/` o `cortex-app/` en `main`:

- **Windows:** `VOID_LOOM-CÓRTEX-…-windows-instalador.exe` (se instala) o `…-windows-portable.exe` (se abre sin instalar). En sala, mejor el instalador: el portable se descomprime en cada arranque.
- **Mac:** `VOID_LOOM-CÓRTEX-…-mac-arm64.dmg` (Apple Silicon) o `…-mac-x64.dmg` (Intel).

La app no está firmada con certificado de pago, así que la primera vez el sistema avisa:

- **Windows:** «Windows protegió su PC» → *Más información* → *Ejecutar de todas formas*.
- **Mac:** clic derecho sobre la app → *Abrir* → *Abrir*. Si dice que está dañada, ejecuta `xattr -cr "/Applications/VØID_LOOM CÓRTEX.app"` en Terminal. La primera vez pide permiso para el micrófono (Ajustes del Sistema › Privacidad › Micrófono); solo hace falta para PÚBLICO.

## Fluidez

- Fuerza la gráfica de alto rendimiento en portátiles con dos gráficas.
- No deja que el sistema frene la animación cuando la ventana pierde el foco ni que la pantalla se apague.
- Calidad automática: si no llega a 60 fps, baja resolución, fija 30 fps y dibuja menos partículas; los cambios esperan a un corte de plano.
- Si la tarjeta no consigue preparar el cerebro con el modo gráfico por defecto (Direct3D en Windows), la app se reinicia sola probando otro (OpenGL, D3D11on12, Vulkan) y recuerda el que funciona.

## PÚBLICO, sin internet

El micrófono de la sala se analiza **en el propio ordenador**: nivel, golpes, tono y lado. Los últimos segundos de voz se quedan solo en memoria para cantarlos en granos y se borran al cerrar. No se graba en disco, no se envía y no se guarda.

**Calibrar la sala:** *Pantalla › Calibrar la sala* (o la tecla K) con la sala en silencio 4 s; la app lo recuerda. La DDJ-200 funciona sin preguntar (permiso MIDI).

## Menú

- **Córtex › Modo instalación:** al abrir, arranca sola (sin clic) en el modo elegido en *La instalación arranca en*: AUTOPLAY, PÚBLICO o INTÉRPRETE (DDJ-200). La obra va al proyector (o a la única pantalla) a pantalla completa. Escape no saca de pantalla completa en este modo.
- **Córtex › Abrir al encender el ordenador:** junto con el modo instalación, el ordenador arranca directamente en la obra.
- **Pantalla › Pantalla completa** (Ctrl/⌘+⇧+F) y **Mover a la siguiente pantalla** (Ctrl/⌘+⇧+M), para llevarla al proyector.

En Windows el menú se oculta; aparece pulsando **Alt**.

## Generar la app a mano

```
cd cortex-app
npm ci
npm run dist:win     # en Windows
npm run dist:mac     # en Mac
```

`npm start` la abre sin empaquetar: antes copia `cortex/` en `www/`. Con `--instalacion` arranca en modo instalación una vez.
