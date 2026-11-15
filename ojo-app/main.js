// VØID_LOOM · OJO · app de escritorio
// Envuelve ojo/ (consola + salida) en una app para Windows y Mac que funciona sin internet:
// · todo va dentro (código, modelos de IA, tipografía): no descarga nada
// · cámara y micrófono permitidos sin preguntar (en Mac, el sistema pide permiso la primera vez)
// · la salida se abre sola en la segunda pantalla (proyector), sin barras
// · grabaciones y capturas se guardan solas en Vídeos / Imágenes › VØID_LOOM OJO
// · modo instalación: arranca solo, abre la salida a pantalla completa y entra en AUTO
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
protocol.registerSchemesAsPrivileged([{ scheme: 'ojo', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

const WWW = path.join(__dirname, 'www');
const CFG_FILE = path.join(app.getPath('userData'), 'ajustes.json');
const cfg = Object.assign({ instalacion: false }, (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { return {}; } })());
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) {} };
const INSTALL = cfg.instalacion || process.argv.includes('--instalacion');
const consoleURL = () => 'ojo://app/index.html' + (INSTALL ? '?instalacion' : '');
const OUT_DIR = (kind) => path.join(app.getPath(kind === 'video' ? 'videos' : 'pictures'), 'VØID_LOOM OJO');

let con = null, out = null, quitting = false;

function serveLocal(req) {
  const u = new URL(req.url);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(WWW, p));
  if (!f.startsWith(path.normalize(WWW + path.sep))) return new Response('', { status: 403 });
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('', { status: 404 });
  return net.fetch(pathToFileURL(f).toString(), { bypassCustomProtocolHandlers: true });
}

// ---------------------------------------------------------------- ventanas
function displayFor(win) { return screen.getDisplayMatching(win.getBounds()); }
function external() {
  if (!con) return null;
  const cur = displayFor(con);
  return screen.getAllDisplays().find((d) => d.id !== cur.id) || null;
}
function fullOn(win, d) {
  win.setBounds(d.bounds);
  if (process.platform === 'darwin') win.setSimpleFullScreen(true); else win.setFullScreen(true);
}
function placeOutput() {
  if (!out || out.isDestroyed()) return;
  const ext = external();
  if (ext) fullOn(out, ext);
  else if (INSTALL) fullOn(out, displayFor(con));
}
function toggleOutputFull() {
  if (!out || out.isDestroyed()) return;
  if (process.platform === 'darwin') out.setSimpleFullScreen(!out.isSimpleFullScreen());
  else out.setFullScreen(!out.isFullScreen());
}
function moveOutput() {
  if (!out || out.isDestroyed()) return;
  const ds = screen.getAllDisplays(), cur = displayFor(out);
  const next = ds[(ds.findIndex((d) => d.id === cur.id) + 1) % ds.length];
  if (process.platform === 'darwin') out.setSimpleFullScreen(false); else out.setFullScreen(false);
  setTimeout(() => fullOn(out, next), 150);
}
function openOutput() {
  if (con) con.webContents.executeJavaScript('window.OJO_CONSOLE && window.OJO_CONSOLE.openOutput()', true).catch(() => {});
}

function createConsole() {
  con = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1100, minHeight: 640, show: false,
    backgroundColor: '#000000', title: 'VØID_LOOM · OJO', autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  con.once('ready-to-show', () => { con.maximize(); con.show(); });

  con.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('ojo://app/output.html')) {
      if (out && !out.isDestroyed()) out.destroy();
      const ext = external();
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          title: 'VØID_LOOM · OJO · SALIDA', backgroundColor: '#000000', autoHideMenuBar: true,
          frame: !(ext || INSTALL), width: 1280, height: 720,
          webPreferences: { backgroundThrottling: false },
        },
      };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  con.webContents.on('did-create-window', (win) => {
    out = win;
    win.setMenuBarVisibility(false);
    win.once('ready-to-show', placeOutput);
    setTimeout(placeOutput, 300);
    win.on('closed', () => { if (out === win) out = null; });
    win.webContents.on('render-process-gone', () => { if (!win.isDestroyed()) win.reload(); });
    if (INSTALL) win.webContents.on('before-input-event', (e, i) => { if (i.key === 'Escape') e.preventDefault(); });
  });
  con.webContents.on('render-process-gone', () => {
    if (out && !out.isDestroyed()) out.destroy();
    if (!con.isDestroyed()) con.loadURL(consoleURL());
  });
  con.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    dialog.showMessageBox(con, { type: 'question', buttons: ['Cerrar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Cerrar VØID_LOOM · OJO?', detail: 'Se apagan la cámara y la salida.' })
      .then((r) => { if (r.response === 0) { quitting = true; app.quit(); } });
  });
  con.on('closed', () => { con = null; if (out && !out.isDestroyed()) out.destroy(); });
  return con;
}

// ---------------------------------------------------------------- menú
function buildMenu() {
  const mac = process.platform === 'darwin';
  const t = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'Acerca de VØID_LOOM · OJO' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar' }, { role: 'hideOthers', label: 'Ocultar otras' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] }] : []),
    { label: 'Ojo', submenu: [
      { label: 'Modo instalación (arranca solo en AUTO)', type: 'checkbox', checked: cfg.instalacion, click: async (m) => {
        cfg.instalacion = m.checked; saveCfg();
        const a = await dialog.showMessageBox(con, { buttons: ['Reiniciar ahora', 'Más tarde'], defaultId: 0, cancelId: 1, message: m.checked ? 'Modo instalación activado' : 'Modo instalación desactivado', detail: 'Se aplica al reiniciar la app.' });
        if (a.response === 0) { quitting = true; app.relaunch(); app.quit(); }
      } },
      { label: 'Abrir al encender el ordenador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
      { type: 'separator' },
      { label: 'Abrir carpeta de grabaciones', click: () => { fs.mkdirSync(OUT_DIR('video'), { recursive: true }); shell.openPath(OUT_DIR('video')); } },
      { label: 'Abrir carpeta de capturas', click: () => { fs.mkdirSync(OUT_DIR('png'), { recursive: true }); shell.openPath(OUT_DIR('png')); } },
      ...(mac ? [] : [{ type: 'separator' }, { label: 'Salir', accelerator: 'Ctrl+Q', click: () => con ? con.close() : app.quit() }]),
    ] },
    { role: 'editMenu', label: 'Edición' },
    { label: 'Salida', submenu: [
      { label: 'Abrir salida', accelerator: 'CmdOrCtrl+Shift+O', click: openOutput },
      { label: 'Pantalla completa sí / no', accelerator: 'CmdOrCtrl+Shift+F', click: toggleOutputFull },
      { label: 'Mover a la siguiente pantalla', accelerator: 'CmdOrCtrl+Shift+M', click: moveOutput },
    ] },
    { label: 'Ver', submenu: [
      { role: 'togglefullscreen', label: 'Consola a pantalla completa' },
      { label: 'Recargar', accelerator: 'CmdOrCtrl+Shift+R', click: async () => {
        const a = await dialog.showMessageBox(con, { buttons: ['Recargar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Recargar OJO?', detail: 'Se apagan la cámara y la salida un momento.' });
        if (a.response === 0 && con) { if (out && !out.isDestroyed()) out.destroy(); con.loadURL(consoleURL()); }
      } },
      { type: 'separator' },
      { label: 'Herramientas de desarrollo', accelerator: 'CmdOrCtrl+Alt+I', click: () => con && con.webContents.toggleDevTools() },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

// ---------------------------------------------------------------- arranque
app.on('second-instance', () => { if (con) { if (con.isMinimized()) con.restore(); con.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; });

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  const allow = new Set(['media', 'mediaKeySystem', 'screen-wake-lock', 'fullscreen', 'midi']);
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(allow.has(perm)));
  ses.setPermissionCheckHandler((wc, perm) => allow.has(perm));
  if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => true);
  // grabaciones y capturas: directas a su carpeta, sin diálogo (no se corta el directo)
  ses.on('will-download', (e, item) => {
    const name = item.getFilename();
    const dir = OUT_DIR(/\.(mp4|webm)$/i.test(name) ? 'video' : 'png');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {}
    item.setSavePath(path.join(dir, name));
  });

  protocol.handle('ojo', serveLocal);
  if (process.platform === 'darwin') { try { await systemPreferences.askForMediaAccess('camera'); } catch (e) {} }

  powerSaveBlocker.start('prevent-display-sleep');
  buildMenu();
  createConsole();
  await con.loadURL(consoleURL());
  screen.on('display-added', () => setTimeout(placeOutput, 800));
  screen.on('display-removed', () => setTimeout(placeOutput, 800));
  if (INSTALL) setTimeout(openOutput, 2500);
});
