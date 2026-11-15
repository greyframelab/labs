// VØID_LOOM LIVE · app de escritorio
// Envuelve el live de Labs (live/index.html + live/output.html) en una app que funciona sin internet:
// · sirve una copia local de las piezas por vll://labs/…, sincronizada con GitHub cuando hay conexión
// · abre la salida sola en la segunda pantalla (proyector), sin barras
// · sin frenado de ventanas en segundo plano, MIDI permitido, pantalla siempre encendida
// · modo instalación: arranca solo en AUTOPLAY (y opcionalmente al encender el ordenador)
'use strict';
const { app, BrowserWindow, protocol, net, session, screen, Menu, dialog, powerSaveBlocker, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const S = require('./sync');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
protocol.registerSchemesAsPrivileged([{ scheme: 'vll', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

const ROOT = process.env.VLL_ROOT || path.join(app.getPath('userData'), 'labs');
const SEED = app.isPackaged ? path.join(process.resourcesPath, 'seed') : path.join(__dirname, 'seed');
const CFG_FILE = path.join(app.getPath('userData'), 'ajustes.json');
const cfg = Object.assign({ instalacion: false }, (() => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { return {}; } })());
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) {} };
const INSTALL = cfg.instalacion || process.argv.includes('--instalacion');
const liveURL = () => 'vll://labs/live/index.html' + (INSTALL ? '?instalacion' : '');

let con = null, out = null, quitting = false, syncing = null;

// ---------------------------------------------------------------- red
// fetch desde el proceso principal, sin pasar por los manejadores propios
async function get(url, ms) {
  const r = await net.fetch(url, { bypassCustomProtocolHandlers: true, signal: AbortSignal.timeout(ms || 10000) });
  return { ok: r.ok, status: r.status, type: r.headers.get('content-type') || '', buf: Buffer.from(await r.arrayBuffer()) };
}

function serveLocal(req) {
  const u = new URL(req.url);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(path.normalize(ROOT + path.sep)) || p.split('/').some((s) => s.startsWith('.'))) return new Response('', { status: 403 });
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('', { status: 404 });
  return net.fetch(pathToFileURL(f).toString(), { bypassCustomProtocolHandlers: true });
}

async function serveFont(req) {
  const url = req.url;
  try {
    const c = await S.fontGet(ROOT, url, get);
    return new Response(c.body, { headers: { 'content-type': c.type, 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' } });
  } catch (e) { return new Response('', { status: 504 }); }
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
  if (con) con.webContents.executeJavaScript("document.getElementById('openOut') && document.getElementById('openOut').click()").catch(() => {});
}

function createConsole() {
  con = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1100, minHeight: 640, show: false,
    backgroundColor: '#0a0a0a', title: 'VØID_LOOM LIVE', autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') },
  });
  con.once('ready-to-show', () => { con.maximize(); con.show(); });

  con.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('vll://labs/live/output.html')) {
      if (out && !out.isDestroyed()) out.destroy();
      const ext = external();
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          title: 'VØID_LOOM · SALIDA', backgroundColor: '#000000', autoHideMenuBar: true,
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
    if (!con.isDestroyed()) con.loadURL(liveURL());
  });
  con.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    dialog.showMessageBox(con, { type: 'question', buttons: ['Cerrar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Cerrar VØID_LOOM LIVE?', detail: 'Se para el audio y la salida.' })
      .then((r) => { if (r.response === 0) { quitting = true; app.quit(); } });
  });
  con.on('closed', () => { con = null; if (out && !out.isDestroyed()) out.destroy(); });
  return con;
}

function reloadLive() {
  if (!con) return;
  if (out && !out.isDestroyed()) out.destroy();
  con.loadURL(liveURL());
}

// ---------------------------------------------------------------- sincronización
const status = (s) => { if (con && !con.isDestroyed()) con.webContents.send('vll-status', s); };
function runSync() {
  if (!syncing) syncing = S.sync(ROOT, get, status).finally(() => { syncing = null; });
  return syncing;
}
function summary(r) {
  if (r.upToDate) return 'Todo al día.';
  const parts = [];
  if (r.newPieces.length) parts.push(r.newPieces.length + (r.newPieces.length === 1 ? ' pieza nueva: ' : ' piezas nuevas: ') + r.newPieces.map((d) => d.replace(/\/$/, '')).join(', '));
  parts.push(r.updated + ' archivos actualizados');
  if (r.failed) parts.push(r.failed + ' no se pudieron bajar (se reintentará)');
  return parts.join('\n');
}
async function manualUpdate() {
  try {
    const r = await runSync();
    if (r.upToDate) { dialog.showMessageBox(con, { message: 'Piezas al día', detail: 'No hay nada nuevo en Labs.' }); return; }
    const a = await dialog.showMessageBox(con, { type: 'info', buttons: ['Recargar ahora', 'Más tarde'], defaultId: 1, cancelId: 1, message: 'Piezas actualizadas', detail: summary(r) + '\n\nAl recargar entran las nuevas; el audio y la salida se paran un momento.' });
    if (a.response === 0) reloadLive();
  } catch (e) {
    dialog.showMessageBox(con, { type: 'warning', message: 'Sin conexión con Labs', detail: 'Sigues con las piezas guardadas en este ordenador.' });
  }
}

// ---------------------------------------------------------------- menú
function buildMenu() {
  const mac = process.platform === 'darwin';
  const t = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'Acerca de VØID_LOOM LIVE' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar' }, { role: 'hideOthers', label: 'Ocultar otras' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] }] : []),
    { label: 'Live', submenu: [
      { label: 'Actualizar piezas', accelerator: 'CmdOrCtrl+U', click: manualUpdate },
      { type: 'separator' },
      { label: 'Modo instalación (arranca solo en AUTOPLAY)', type: 'checkbox', checked: cfg.instalacion, click: async (m) => {
        cfg.instalacion = m.checked; saveCfg();
        const a = await dialog.showMessageBox(con, { buttons: ['Reiniciar ahora', 'Más tarde'], defaultId: 0, cancelId: 1, message: m.checked ? 'Modo instalación activado' : 'Modo instalación desactivado', detail: 'Se aplica al reiniciar la app.' });
        if (a.response === 0) { quitting = true; app.relaunch(); app.quit(); }
      } },
      { label: 'Abrir al encender el ordenador', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
      { type: 'separator' },
      { label: 'Abrir carpeta de piezas', click: () => shell.openPath(ROOT) },
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
      { label: 'Recargar el live', accelerator: 'CmdOrCtrl+Shift+R', click: async () => {
        const a = await dialog.showMessageBox(con, { buttons: ['Recargar', 'Cancelar'], defaultId: 1, cancelId: 1, message: '¿Recargar el live?', detail: 'Se para el audio y la salida un momento.' });
        if (a.response === 0) reloadLive();
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
  const allow = new Set(['midi', 'midiSysex', 'screen-wake-lock', 'fullscreen', 'media']);
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(allow.has(perm)));
  ses.setPermissionCheckHandler((wc, perm) => allow.has(perm));
  if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => true);

  protocol.handle('vll', serveLocal);
  protocol.handle('https', (req) => {
    if (S.FONT_HOSTS.has(new URL(req.url).hostname)) return serveFont(req);
    return net.fetch(req, { bypassCustomProtocolHandlers: true });
  });

  powerSaveBlocker.start('prevent-display-sleep');
  buildMenu();
  try { S.ensureData(ROOT, SEED); } catch (e) {}
  createConsole();
  await con.loadFile(path.join(__dirname, 'splash.html'));
  screen.on('display-added', () => setTimeout(placeOutput, 800));
  screen.on('display-removed', () => setTimeout(placeOutput, 800));

  // sincronizar al abrir: si tarda más de 20 s se sigue con lo guardado y termina por detrás
  const hasLocal = fs.existsSync(path.join(ROOT, 'live', 'index.html'));
  let res = null, err = null;
  const p = runSync().then((r) => (res = r), (e) => (err = e));
  await Promise.race([p, new Promise((r) => setTimeout(r, hasLocal ? 20000 : 600000))]);
  if (err || !res) status({ phase: err ? 'offline' : 'late' });
  else status({ phase: 'done', text: summary(res) });
  if (!fs.existsSync(path.join(ROOT, 'live', 'index.html'))) {
    status({ phase: 'empty' });
    return;
  }
  await new Promise((r) => setTimeout(r, 900));
  if (con) con.loadURL(liveURL());
  if (!res && !err) p.then((r) => { if (r && !r.upToDate) dialog.showMessageBox(con, { type: 'info', buttons: ['Recargar ahora', 'Más tarde'], defaultId: 1, cancelId: 1, message: 'Piezas actualizadas', detail: summary(r) }).then((a) => { if (a.response === 0) reloadLive(); }); });
});
