// VØID_LOOM · SEMILLA · app de escritorio
// Envuelve semilla/ en una app para Windows y Mac que funciona sin internet:
// · todo va dentro (código, tipografía y el modelo de voz español): no descarga nada
// · la voz del modo PÚBLICO se reconoce en el ordenador (Vosk), sin enviar nada
// · micrófono permitido sin preguntar (en Mac, el sistema pide permiso la primera vez)
// · modo instalación: arranca solo, a pantalla completa en el proyector y en el modo elegido
// · grabaciones y capturas se guardan solas en Vídeos / Imágenes › VØID_LOOM SEMILLA
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
protocol.registerSchemesAsPrivileged([{ scheme: 'semilla', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

const WWW = path.join(__dirname, 'www');
const CFG_FILE = path.join(app.getPath('userData'), 'ajustes.json');
const cfg = Object.assign({ instalacion: false, modo: 'publico' }, (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { return {}; } })());
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) {} };
const INSTALL = cfg.instalacion || process.argv.includes('--instalacion');
const pageURL = () => 'semilla://app/index.html' + (INSTALL ? '?museo&modo=' + (cfg.modo === 'auto' ? 'automatico' : 'publico') : '');
const OUT_DIR = (kind) => path.join(app.getPath(kind === 'video' ? 'videos' : 'pictures'), 'VØID_LOOM SEMILLA');

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
function placeInstall() { if (win && INSTALL) fullOn(external() || screen.getPrimaryDisplay()); }

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1100, minHeight: 640, show: false,
    backgroundColor: '#000000', title: 'VØID_LOOM · SEMILLA', autoHideMenuBar: true,
    frame: !INSTALL, webPreferences: { backgroundThrottling: false },
  });
  win.once('ready-to-show', () => { if (INSTALL) placeInstall(); else win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('render-process-gone', () => { if (!win.isDestroyed()) win.loadURL(pageURL()); });
  if (INSTALL) win.webContents.on('before-input-event', (e, i) => { if (i.key === 'Escape') e.preventDefault(); });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    dialog.showMessageBox(win, { type: 'question', buttons: ['Cerrar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Cerrar VØID_LOOM · SEMILLA?', detail: 'Se apagan la obra y el sonido.' })
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
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'Acerca de VØID_LOOM · SEMILLA' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar' }, { role: 'hideOthers', label: 'Ocultar otras' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] }] : []),
    { label: 'Semilla', submenu: [
      { label: 'Modo instalación (arranca sola en el proyector)', type: 'checkbox', checked: cfg.instalacion, click: (m) => { cfg.instalacion = m.checked; saveCfg(); restartAsk(m.checked ? 'Modo instalación activado' : 'Modo instalación desactivado'); } },
      { label: 'La instalación arranca en', submenu: [
        { label: 'PÚBLICO (la sala dice una palabra)', type: 'radio', checked: cfg.modo !== 'auto', click: () => { cfg.modo = 'publico'; saveCfg(); if (INSTALL) restartAsk('La instalación arrancará en PÚBLICO'); } },
        { label: 'AUTOMÁTICO (las piezas nacen solas)', type: 'radio', checked: cfg.modo === 'auto', click: () => { cfg.modo = 'auto'; saveCfg(); if (INSTALL) restartAsk('La instalación arrancará en AUTOMÁTICO'); } },
      ] },
      { label: 'Abrir al encender el ordenador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
      { type: 'separator' },
      { label: 'Abrir carpeta de grabaciones', click: () => { fs.mkdirSync(OUT_DIR('video'), { recursive: true }); shell.openPath(OUT_DIR('video')); } },
      { label: 'Abrir carpeta de capturas', click: () => { fs.mkdirSync(OUT_DIR('png'), { recursive: true }); shell.openPath(OUT_DIR('png')); } },
      ...(mac ? [] : [{ type: 'separator' }, { label: 'Salir', accelerator: 'Ctrl+Q', click: () => (win ? win.close() : app.quit()) }]),
    ] },
    { role: 'editMenu', label: 'Edición' },
    { label: 'Pantalla', submenu: [
      { label: 'Pantalla completa sí / no', accelerator: 'CmdOrCtrl+Shift+F', click: toggleFull },
      { label: 'Mover a la siguiente pantalla', accelerator: 'CmdOrCtrl+Shift+M', click: moveNext },
    ] },
    { label: 'Ver', submenu: [
      { label: 'Recargar', accelerator: 'CmdOrCtrl+Shift+R', click: async () => {
        const a = await dialog.showMessageBox(win, { buttons: ['Recargar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Recargar SEMILLA?', detail: 'La obra y el sonido se cortan un momento.' });
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
  const allow = new Set(['media', 'screen-wake-lock', 'fullscreen']);
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(allow.has(perm)));
  ses.setPermissionCheckHandler((wc, perm) => allow.has(perm));
  ses.on('will-download', (e, item) => {
    const name = item.getFilename();
    const dir = OUT_DIR(/\.(mp4|webm)$/i.test(name) ? 'video' : 'png');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {}
    item.setSavePath(path.join(dir, name));
  });
  protocol.handle('semilla', serveLocal);
  if (process.platform === 'darwin') { try { await systemPreferences.askForMediaAccess('microphone'); } catch (e) {} }
  powerSaveBlocker.start('prevent-display-sleep');
  buildMenu();
  createWindow();
  await win.loadURL(pageURL());
  screen.on('display-added', () => setTimeout(placeInstall, 800));
  screen.on('display-removed', () => setTimeout(placeInstall, 800));
});
