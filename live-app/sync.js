// VØID_LOOM LIVE · sincronización con Labs y caché offline
// Copia local de lo que el live necesita: README, live/, shared/, ojo/ (sensor de presencia) y las carpetas de las piezas Motion.
// Con internet descarga solo lo nuevo o cambiado (comparando el sha de git de cada archivo);
// sin internet, el live usa lo último guardado.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = 'greyframelab/labs';
const MOTION = /\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*Motion/gi;
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const blobSha = (buf) => crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };

// carpetas que entran en la copia local, leídas del README igual que hace el live
function prefixesFrom(readme) {
  const dirs = [...readme.matchAll(MOTION)].map((m) => m[3].replace(/^\.\//, '').replace(/\/?$/, '/'));
  return { dirs, all: ['live/', 'shared/', 'ojo/', ...dirs] };
}
const wanted = (p, pre) => p === 'README.md' || pre.all.some((x) => p.startsWith(x));

function writeAtomic(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.part';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- fuentes (Google Fonts) en caché
// Las piezas cargan sus tipografías de Google Fonts. Se guardan la primera vez que se ven y después
// se sirven siempre desde disco, con o sin conexión.
function fontKey(url) { return sha1(url); }
function fontCached(root, url) {
  const f = path.join(root, '_fonts', fontKey(url));
  if (!fs.existsSync(f)) return null;
  return { body: fs.readFileSync(f), type: readJSON(f + '.json', {}).type || 'application/octet-stream' };
}
function fontSave(root, url, body, type) {
  const f = path.join(root, '_fonts', fontKey(url));
  writeAtomic(f, body);
  fs.writeFileSync(f + '.json', JSON.stringify({ url, type }));
}
// fetchFn(url, ms) -> { ok, status, type, buf }
async function fontGet(root, url, fetchFn) {
  const c = fontCached(root, url);
  if (c) return c;
  const r = await fetchFn(url, 6000);
  if (!r.ok) throw new Error('fuente ' + r.status);
  fontSave(root, url, r.buf, r.type);
  return { body: r.buf, type: r.type };
}
// busca las hojas de Google Fonts en el HTML/CSS y las deja en caché con sus archivos
async function prefetchFonts(root, files, fetchFn) {
  const css = new Set();
  for (const f of files) {
    if (!/\.(html|css)$/.test(f)) continue;
    let t = ''; try { t = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { continue; }
    for (const [u] of t.matchAll(/https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)]+/g)) css.add(u.replace(/&amp;/g, '&'));
  }
  let n = 0;
  for (const u of css) {
    try {
      const sheet = (await fontGet(root, u, fetchFn)).body.toString('utf8');
      for (const [, g] of sheet.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) { try { await fontGet(root, g, fetchFn); n++; } catch (e) {} }
    } catch (e) {}
  }
  return n;
}

// ---------------------------------------------------------------- copia inicial incluida en la app
// La app lleva una copia de las piezas del momento en que se generó. Se usa si es más reciente
// que lo guardado (primera vez, o app actualizada sin haber tenido internet).
function ensureData(root, seed) {
  const sm = readJSON(path.join(seed, '.manifest.json'), null);
  if (!sm) return false;
  const dm = readJSON(path.join(root, '.manifest.json'), null);
  if (dm && dm.date && sm.date && dm.date >= sm.date) return false;
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(seed, root, { recursive: true, force: true });
  return true;
}

// ---------------------------------------------------------------- sincronización
// fetchFn(url, ms) -> { ok, status, type, buf }. status({ phase, done, total, file })
async function sync(root, fetchFn, status = () => {}) {
  fs.mkdirSync(root, { recursive: true });
  const manFile = path.join(root, '.manifest.json');
  const man = readJSON(manFile, { files: {} });
  man.files = man.files || {};

  status({ phase: 'check' });
  const j = async (url, ms) => { const r = await fetchFn(url, ms); if (!r.ok) throw new Error(url + ' · ' + r.status); return JSON.parse(r.buf.toString('utf8')); };
  const head = await j(`https://api.github.com/repos/${REPO}/commits/main`, 7000);
  const commit = head.sha, date = head.commit && head.commit.committer && head.commit.committer.date;
  const missing = Object.keys(man.files).some((p) => !fs.existsSync(path.join(root, p)));
  if (man.commit === commit && !missing) return { upToDate: true, commit, updated: 0, removed: 0, newPieces: [] };

  const tree = await j(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`, 20000);
  const blobs = tree.tree.filter((e) => e.type === 'blob');
  const raw = (p) => `https://raw.githubusercontent.com/${REPO}/${commit}/${p.split('/').map(encodeURIComponent).join('/')}`;
  const rm = await fetchFn(raw('README.md'), 15000);
  if (!rm.ok) throw new Error('README · ' + rm.status);
  const pre = prefixesFrom(rm.buf.toString('utf8'));
  const want = blobs.filter((e) => wanted(e.path, pre));
  const todo = want.filter((e) => man.files[e.path] !== e.sha || !fs.existsSync(path.join(root, e.path)));

  const oldDirs = new Set((man.dirs || []));
  let done = 0, failed = 0;
  const queue = todo.slice();
  const worker = async () => {
    while (queue.length) {
      const e = queue.shift();
      status({ phase: 'download', done, total: todo.length, file: e.path });
      let ok = false;
      for (let tries = 0; tries < 2 && !ok; tries++) {
        try {
          const r = await fetchFn(raw(e.path), 60000);
          if (r.ok && blobSha(r.buf) === e.sha) { writeAtomic(path.join(root, e.path), r.buf); man.files[e.path] = e.sha; ok = true; }
        } catch (err) {}
      }
      if (!ok) failed++;
      done++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  // archivos que ya no están en Labs (solo dentro de lo que gestiona la sincronización)
  const keep = new Set(want.map((e) => e.path));
  let removed = 0;
  for (const p of Object.keys(man.files)) {
    if (keep.has(p)) continue;
    const f = path.normalize(path.join(root, p));
    if (f.startsWith(path.normalize(root + path.sep))) { try { fs.unlinkSync(f); } catch (e) {} }
    delete man.files[p]; removed++;
  }

  status({ phase: 'fonts' });
  await prefetchFonts(root, [...keep], fetchFn);

  const newPieces = pre.dirs.filter((d) => !oldDirs.has(d) && oldDirs.size);
  if (!failed) { man.commit = commit; man.date = date || new Date().toISOString(); }
  man.dirs = pre.dirs;
  writeAtomic(manFile, Buffer.from(JSON.stringify(man)));
  return { upToDate: false, commit, updated: todo.length - failed, failed, removed, newPieces };
}

module.exports = { sync, ensureData, prefetchFonts, fontGet, fontCached, fontSave, fontKey, prefixesFrom, wanted, blobSha, FONT_HOSTS };
