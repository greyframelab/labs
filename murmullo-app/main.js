// VØID_LOOM · MURMULLO · app de escritorio
// Envuelve murmullo/ en una app para Windows y Mac:
// · todo el código va dentro; el dato llega en directo de Wikimedia (sin red, la pieza sigue en MEMORIA)
// · consola en la pantalla principal; SALIDA sola, a pantalla completa, en el proyector
// · modo instalación: arranca sola, abre la salida en el proyector y no se cierra con Escape
'use strict';
const { app, BrowserWindow, protocol, net, session, screen, Menu, dialog, powerSaveBlocker, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// MODO GRÁFICO: si la GPU falla con el modo por defecto (Direct3D en Windows), la app se reinicia probando otro y lo recuerda
const ANGLES = process.platform === 'win32' ? ['', 'gl', 'd3d11on12', 'vulkan'] : [''];
const GPU_FILE = (() => { try { return path.join(app.getPath('userData'), 'grafico.json'); } catch (e) { return null; } })();
const gpu = (() => { try { return JSON.parse(fs.readFileSync(GPU_FILE, 'utf8')); } catch (e) { return { i: 0 }; } })();
if (ANGLES[gpu.i]) app.commandLine.appendSwitch('use-angle', ANGLES[gpu.i]);
protocol.registerSchemesAsPrivileged([{ scheme: 'murmullo', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

const WWW = path.join(__dirname, 'www');
const CFG_FILE = path.join(app.getPath('userData'), 'ajustes.json');
const cfg = Object.assign({ instalacion: false }, (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { return {}; } })());
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) {} };
const INSTALL = cfg.instalacion || process.argv.includes('--instalacion');
const pageURL = () => 'murmullo://app/index.html' + (INSTALL ? '?instalacion' : '');

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

// ---------------------------------------------------------------- pantallas
const displayOf = (w) => screen.getDisplayMatching(w.getBounds());
function external() { const cur = screen.getPrimaryDisplay(); return screen.getAllDisplays().find((d) => d.id !== cur.id) || null; }
function setFull(w, on) { if (process.platform === 'darwin') w.setSimpleFullScreen(on); else w.setFullScreen(on); }
function toggleFull() { const w = BrowserWindow.getFocusedWindow() || win; if (!w) return; setFull(w, process.platform === 'darwin' ? !w.isSimpleFullScreen() : !w.isFullScreen()); }
function moveNext() {
  const w = BrowserWindow.getFocusedWindow() || win; if (!w) return;
  const ds = screen.getAllDisplays(), cur = displayOf(w), next = ds[(ds.findIndex((d) => d.id === cur.id) + 1) % ds.length];
  setFull(w, false); setTimeout(() => { w.setBounds(next.bounds); setFull(w, true); }, 150);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1100, minHeight: 640, show: false,
    backgroundColor: '#000000', title: 'VØID_LOOM · MURMULLO', autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // ABRIR SALIDA: la ventana de la obra va sola al proyector (o a esta pantalla) a pantalla completa
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/salida\.html/.test(url)) {
      const d = external() || displayOf(win);
      return { action: 'allow', overrideBrowserWindowOptions: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, frame: false, backgroundColor: '#000000', title: 'VØID_LOOM · MURMULLO · SALIDA', autoHideMenuBar: true, webPreferences: { backgroundThrottling: false } } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', (w) => {
    const d = external() || displayOf(win);
    w.setBounds(d.bounds); setFull(w, true);
    w.webContents.on('before-input-event', (e, i) => { if (i.key === 'Escape') e.preventDefault(); });
  });
  win.webContents.on('render-process-gone', () => { if (!win.isDestroyed()) win.loadURL(pageURL()); });
  win.webContents.on('console-message', (...args) => {
    const msg = typeof args[2] === 'string' ? args[2] : (args[0] && args[0].message) || '';
    if (!msg.includes('[MURMULLO_GPU_FALLO]') || gpu.tried) return;
    gpu.tried = true;
    if (gpu.i + 1 < ANGLES.length) { try { fs.writeFileSync(GPU_FILE, JSON.stringify({ i: gpu.i + 1 })); } catch (e) {} setTimeout(() => { app.relaunch(); app.exit(0); }, 2500); }
  });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    dialog.showMessageBox(win, { type: 'question', buttons: ['Cerrar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Cerrar VØID_LOOM · MURMULLO?', detail: 'Se apagan la obra y el sonido.' })
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
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'Acerca de VØID_LOOM · MURMULLO' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar' }, { role: 'hideOthers', label: 'Ocultar otras' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] }] : []),
    { label: 'Murmullo', submenu: [
      { label: 'Modo instalación (arranca sola y abre la salida en el proyector)', type: 'checkbox', checked: cfg.instalacion, click: (m) => { cfg.instalacion = m.checked; saveCfg(); restartAsk(m.checked ? 'Modo instalación activado' : 'Modo instalación desactivado'); } },
      { label: 'Abrir al encender el ordenador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
      ...(mac ? [] : [{ type: 'separator' }, { label: 'Salir', accelerator: 'Ctrl+Q', click: () => (win ? win.close() : app.quit()) }]),
    ] },
    { role: 'editMenu', label: 'Edición' },
    { label: 'Pantalla', submenu: [
      { label: 'Pantalla completa sí / no', accelerator: 'CmdOrCtrl+Shift+F', click: toggleFull },
      { label: 'Mover a la siguiente pantalla', accelerator: 'CmdOrCtrl+Shift+M', click: moveNext },
    ] },
    { label: 'Ver', submenu: [
      { label: 'Recargar', accelerator: 'CmdOrCtrl+Shift+R', click: async () => {
        const a = await dialog.showMessageBox(win, { buttons: ['Recargar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Recargar MURMULLO?', detail: 'La obra y el sonido se cortan un momento.' });
        if (a.response === 0 && win) win.loadURL(pageURL());
      } },
      { type: 'separator' },
      { label: 'Herramientas de desarrollo', accelerator: 'CmdOrCtrl+Alt+I', click: () => { const w = BrowserWindow.getFocusedWindow() || win; w && w.webContents.toggleDevTools(); } },
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
  const allow = new Set(['screen-wake-lock', 'fullscreen']);
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(allow.has(perm)));
  ses.setPermissionCheckHandler((wc, perm) => allow.has(perm));
  // Wikimedia bloquea clientes sin User-Agent identificable: el flujo sale firmado como VØID_LOOM · MURMULLO
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://stream.wikimedia.org/*'] }, (d, cb) => {
    d.requestHeaders['User-Agent'] = 'VOID_LOOM-MURMULLO/' + app.getVersion() + ' (https://greyframelab.github.io/labs/; museo, instalación) ' + d.requestHeaders['User-Agent'];
    cb({ requestHeaders: d.requestHeaders }); });
  protocol.handle('murmullo', serveLocal);
  powerSaveBlocker.start('prevent-display-sleep');
  buildMenu();
  createWindow();
  await win.loadURL(pageURL());
});
