// VØID_LOOM · CÓRTEX · app de escritorio
// Envuelve cortex/ en una app para Windows y Mac que funciona sin internet:
// · todo va dentro (código y la noche de EEG que hace de partitura): no descarga nada
// · en PÚBLICO el micro de la sala se analiza en el ordenador, sin enviar ni guardar nada
// · micrófono permitido sin preguntar (en Mac, el sistema pide permiso la primera vez)
// · fuerza la gráfica de alto rendimiento y no deja que el sistema frene la animación
// · modo instalación: arranca sola, con la SALIDA a pantalla completa en el proyector
'use strict';
const { app, BrowserWindow, protocol, net, session, screen, Menu, dialog, powerSaveBlocker, shell, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');   // portátiles con dos gráficas: usa la potente
app.commandLine.appendSwitch('enable-gpu-rasterization');
// MODO GRÁFICO: si la tarjeta no consigue preparar la materia con el modo por defecto (Direct3D en Windows),
// la app se reinicia sola probando otro (OpenGL, Vulkan…). El que funciona se queda guardado.
const ANGLES = process.platform === 'win32' ? ['', 'gl', 'd3d11on12', 'vulkan'] : [''];
const GPU_FILE = (() => { try { return require('path').join(app.getPath('userData'), 'grafico.json'); } catch (e) { return null; } })();
const gpu = (() => { try { return JSON.parse(require('fs').readFileSync(GPU_FILE, 'utf8')); } catch (e) { return { i: 0 }; } })();
if (ANGLES[gpu.i]) app.commandLine.appendSwitch('use-angle', ANGLES[gpu.i]);
protocol.registerSchemesAsPrivileged([{ scheme: 'cortex', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

const WWW = path.join(__dirname, 'www');
const CFG_FILE = path.join(app.getPath('userData'), 'ajustes.json');
const cfg = Object.assign({ instalacion: false, modo: 'auto' }, (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { return {}; } })());
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) {} };
const INSTALL = cfg.instalacion || process.argv.includes('--instalacion');
// en instalación con proyector: consola en la pantalla principal y la SALIDA sola en el proyector
const pageURL = () => 'cortex://app/index.html' + (INSTALL ? '?museo&modo=' + (['pub', 'ddj'].includes(cfg.modo) ? cfg.modo : 'auto') : '');
const OUT_DIR = (kind) => path.join(app.getPath(kind === 'video' ? 'videos' : 'pictures'), 'VØID_LOOM CÓRTEX');

let win = null, quitting = false;

function serveLocal(req) {
  const u = new URL(req.url);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(WWW, p));
  if (!f.startsWith(path.normalize(WWW + path.sep))) return new Response('', { status: 403 });
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('', { status: 404 });
  return net.fetch(pathToFileURL(f).toString(), { bypassCustomProtocolHandlers: true });
}

// ---------------------------------------------------------------- pantalla
const displayOf = (w) => screen.getDisplayMatching(w.getBounds());
function external() {
  const cur = screen.getPrimaryDisplay();
  return screen.getAllDisplays().find((d) => d.id !== cur.id) || null;
}
function fullOn(d) {
  win.setBounds(d.bounds);
  if (process.platform === 'darwin') win.setSimpleFullScreen(true); else win.setFullScreen(true);
}
function toggleFull() {
  if (process.platform === 'darwin') win.setSimpleFullScreen(!win.isSimpleFullScreen());
  else win.setFullScreen(!win.isFullScreen());
}
function moveNext() {
  const ds = screen.getAllDisplays(), cur = displayOf(win);
  const next = ds[(ds.findIndex((d) => d.id === cur.id) + 1) % ds.length];
  if (process.platform === 'darwin') win.setSimpleFullScreen(false); else win.setFullScreen(false);
  setTimeout(() => fullOn(next), 150);
}
// en instalación, la obra va al proyector (o a la única pantalla) a pantalla completa
function placeInstall() { if (win && INSTALL && !external()) fullOn(screen.getPrimaryDisplay()); }

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1100, minHeight: 640, show: false,
    backgroundColor: '#000000', title: 'VØID_LOOM · CÓRTEX', autoHideMenuBar: true,
    frame: !(INSTALL && !external()), webPreferences: { backgroundThrottling: false },
  });
  win.once('ready-to-show', () => { if (INSTALL && !external()) placeInstall(); else win.maximize(); win.show(); });
  // PROYECTAR abre la ventana de salida: va sola al proyector (o a la pantalla actual) a pantalla completa
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/salida\.html/.test(url)) {
      const d = external() || displayOf(win);
      return { action: 'allow', overrideBrowserWindowOptions: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, frame: false, backgroundColor: '#000000', title: 'VØID_LOOM · CÓRTEX · SALIDA', autoHideMenuBar: true, webPreferences: { backgroundThrottling: false } } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', (w) => {
    const d = external() || displayOf(win);
    w.setBounds(d.bounds);
    if (process.platform === 'darwin') w.setSimpleFullScreen(true); else w.setFullScreen(true);
    w.webContents.on('before-input-event', (e, i) => { if (i.key === 'Escape') e.preventDefault(); });
  });
  win.webContents.on('render-process-gone', () => { if (!win.isDestroyed()) win.loadURL(pageURL()); });
  // la página avisa si la GPU no pudo preparar el cerebro: se prueba el siguiente modo gráfico
  win.webContents.on('console-message', (...args) => {
    const msg = typeof args[2] === 'string' ? args[2] : (args[0] && args[0].message) || '';
    if (!msg.includes('[CORTEX_GPU_FALLO]') || gpu.tried) return;
    gpu.tried = true;
    if (gpu.i + 1 < ANGLES.length) {
      try { fs.writeFileSync(GPU_FILE, JSON.stringify({ i: gpu.i + 1 })); } catch (e) {}
      setTimeout(() => { app.relaunch(); app.exit(0); }, 2500);
    }
  });
  if (INSTALL) win.webContents.on('before-input-event', (e, i) => { if (i.key === 'Escape') e.preventDefault(); });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    dialog.showMessageBox(win, { type: 'question', buttons: ['Cerrar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Cerrar VØID_LOOM · CÓRTEX?', detail: 'Se apagan la obra y el sonido.' })
      .then((r) => { if (r.response === 0) { quitting = true; app.quit(); } });
  });
  win.on('closed', () => { win = null; });
}

// ---------------------------------------------------------------- menú
async function restartAsk(msg) {
  const a = await dialog.showMessageBox(win, { buttons: ['Reiniciar ahora', 'Más tarde'], defaultId: 0, cancelId: 1, message: msg, detail: 'Se aplica al reiniciar la app.' });
  if (a.response === 0) { quitting = true; app.relaunch(); app.quit(); }
}
function buildMenu() {
  const mac = process.platform === 'darwin';
  const t = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'Acerca de VØID_LOOM · CÓRTEX' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar' }, { role: 'hideOthers', label: 'Ocultar otras' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] }] : []),
    { label: 'Córtex', submenu: [
      { label: 'Modo instalación (arranca sola en el proyector)', type: 'checkbox', checked: cfg.instalacion, click: (m) => { cfg.instalacion = m.checked; saveCfg(); restartAsk(m.checked ? 'Modo instalación activado' : 'Modo instalación desactivado'); } },
      { label: 'La instalación arranca en', submenu: [
        { label: 'AUTOPLAY (cada pase toca otro tramo de la noche)', type: 'radio', checked: !['pub', 'ddj'].includes(cfg.modo), click: () => { cfg.modo = 'auto'; saveCfg(); if (INSTALL) restartAsk('La instalación arrancará en AUTOPLAY'); } },
        { label: 'PÚBLICO (el cerebro duerme hasta que la sala lo toca con la voz o las manos)', type: 'radio', checked: cfg.modo === 'pub', click: () => { cfg.modo = 'pub'; saveCfg(); if (INSTALL) restartAsk('La instalación arrancará en PÚBLICO'); } },
        { label: 'INTÉRPRETE (DDJ-200 + micro)', type: 'radio', checked: cfg.modo === 'ddj', click: () => { cfg.modo = 'ddj'; saveCfg(); if (INSTALL) restartAsk('La instalación arrancará en INTÉRPRETE'); } },
      ] },
      { label: 'Abrir al encender el ordenador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
      { type: 'separator' },
      ...(mac ? [] : [{ type: 'separator' }, { label: 'Salir', accelerator: 'Ctrl+Q', click: () => (win ? win.close() : app.quit()) }]),
    ] },
    { role: 'editMenu', label: 'Edición' },
    { label: 'Pantalla', submenu: [
      { label: 'Pantalla completa sí / no', accelerator: 'CmdOrCtrl+Shift+F', click: toggleFull },
      { label: 'Mover a la siguiente pantalla', accelerator: 'CmdOrCtrl+Shift+M', click: moveNext },
      { label: 'Calibrar la sala (4 s en silencio)', accelerator: 'CmdOrCtrl+Shift+K', click: () => { if (win) { win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'K' }); } } },
    ] },
    { label: 'Ver', submenu: [
      { label: 'Recargar', accelerator: 'CmdOrCtrl+Shift+R', click: async () => {
        const a = await dialog.showMessageBox(win, { buttons: ['Recargar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Recargar CÓRTEX?', detail: 'La obra y el sonido se cortan un momento.' });
        if (a.response === 0 && win) win.loadURL(pageURL());
      } },
      { type: 'separator' },
      { label: 'Herramientas de desarrollo', accelerator: 'CmdOrCtrl+Alt+I', click: () => win && win.webContents.toggleDevTools() },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

// ---------------------------------------------------------------- arranque
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; });

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  const allow = new Set(['media', 'midi', 'midiSysex', 'screen-wake-lock', 'fullscreen']);   // micro y DDJ-200 sin preguntar
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(allow.has(perm)));
  ses.setPermissionCheckHandler((wc, perm) => allow.has(perm));
  ses.on('will-download', (e, item) => {
    const name = item.getFilename();
    const dir = OUT_DIR(/\.(mp4|webm)$/i.test(name) ? 'video' : 'png');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {}
    item.setSavePath(path.join(dir, name));
  });
  protocol.handle('cortex', serveLocal);
  if (process.platform === 'darwin') { try { await systemPreferences.askForMediaAccess('microphone'); } catch (e) {} }
  powerSaveBlocker.start('prevent-display-sleep');
  buildMenu();
  createWindow();
  await win.loadURL(pageURL());
  screen.on('display-added', () => setTimeout(placeInstall, 800));
  screen.on('display-removed', () => setTimeout(placeInstall, 800));
});
