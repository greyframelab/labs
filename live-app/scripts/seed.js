// Prepara la copia inicial de piezas que va dentro de la app (live-app/seed/).
// Se ejecuta antes de generar el ejecutable: copia README, live/, shared/ y las piezas Motion
// tal como están en el repo, con su manifiesto (sha de git) y las tipografías de Google Fonts.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const S = require('../sync');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'seed');
const sh = (c) => execSync(c, { cwd: REPO, encoding: 'utf8' }).trim();

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const pre = S.prefixesFrom(fs.readFileSync(path.join(REPO, 'README.md'), 'utf8'));
const files = sh('git -c core.quotepath=off ls-files').split('\n').filter((p) => S.wanted(p, pre));
const man = { files: {}, dirs: pre.dirs, commit: sh('git rev-parse HEAD'), date: new Date(+sh('git log -1 --format=%ct') * 1000).toISOString() };
let bytes = 0;
for (const p of files) {
  const buf = fs.readFileSync(path.join(REPO, p));
  fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true });
  fs.writeFileSync(path.join(OUT, p), buf);
  man.files[p] = S.blobSha(buf);
  bytes += buf.length;
}
fs.writeFileSync(path.join(OUT, '.manifest.json'), JSON.stringify(man));
console.log(`seed · ${pre.dirs.length} piezas · ${files.length} archivos · ${(bytes / 1048576).toFixed(1)} MB · ${man.commit.slice(0, 7)}`);

// tipografías: mismo esquema de caché que usa la app; si no hay red, la app las guardará la primera vez que la tenga
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const get = async (url, ms) => {
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(ms || 10000) });
  return { ok: r.ok, status: r.status, type: r.headers.get('content-type') || '', buf: Buffer.from(await r.arrayBuffer()) };
};
S.prefetchFonts(OUT, files, get).then((n) => console.log(`seed · ${n} archivos de tipografía`), (e) => console.log('seed · sin tipografías: ' + e.message));
