# VØID_LOOM · MENSAJERO · app de escritorio
App para Windows y Mac de [MENSAJERO](../mensajero/README.md): la antena de 70 m revelada por las señales reales que recibe ahora mismo la NASA Deep Space Network.

- **Descargar:** release **mensajero-app-latest** (se genera sola al hacer merge en main): `.exe` instalador o portable, y `.dmg` para Apple Silicon e Intel. Sin firmar: en el Mac, la primera vez, clic derecho → Abrir.
- **Uso:** ARRANCAR → ABRIR SALIDA (se abre sola a pantalla completa en el proyector). La consola indica si el feed está EN VIVO o en MEMORIA.
- **Necesita internet** para el dato real. El feed pasa por un puente interno (`mensajero://dsn/`), así que no hay bloqueos de CORS.
- **Menú:** modo instalación (arranca sola y manda la salida al proyector), abrir al encender, pantalla completa, mover de pantalla y recargar. Si la GPU falla, la app prueba otro modo gráfico y lo recuerda.
