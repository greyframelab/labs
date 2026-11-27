# VØID_LOOM · MURMULLO · app de escritorio

App para Windows y Mac de [MURMULLO](../murmullo/README.md): el mundo escribe en una losa de obsidiana. Las ediciones de Wikipedia de todo el planeta, en tiempo real, se tallan y suenan.

## Descargar
Release **murmullo-app-latest** del repo (se genera sola al hacer merge en main):
- Windows: `VOID_LOOM-MURMULLO-1.0.0-windows-instalador.exe` (recomendado en sala) o `…-portable.exe`
- Mac: `VOID_LOOM-MURMULLO-1.0.0-mac-arm64.dmg` (Apple Silicon) o `…-mac-x64.dmg` (Intel). Sin firmar: la primera vez, clic derecho → Abrir.

## Uso
1. Abre la app: la CONSOLA aparece en tu pantalla.
2. **ARRANCAR** y luego **ABRIR SALIDA**: la obra se abre sola a pantalla completa en el proyector (o en esta pantalla si no hay otra).
3. En la consola ves si el flujo está **EN VIVO** (datos reales) o en **MEMORIA** (sin red: sigue con la misma estadística y el TESTIGO no se escribe).

**Necesita internet** para que el dato sea real. Sin red la obra no se para, pero deja de ser el mundo en directo.

## Menú
- **Murmullo › Modo instalación**: al abrir, arranca sola y manda la salida al proyector. Escape no la cierra.
- **Murmullo › Abrir al encender el ordenador.**
- **Pantalla:** pantalla completa (Ctrl/Cmd+Shift+F) y mover a la siguiente pantalla (Ctrl/Cmd+Shift+M).
- **Ver › Recargar** (pide confirmación).
- Si la GPU falla al arrancar (Windows), la app se reinicia sola probando otro modo gráfico y lo recuerda.

## Desarrollo
`npm install` · `npm start` (copia `murmullo/` a `www/` y abre la app) · `npm run dist:win` / `dist:mac`.
