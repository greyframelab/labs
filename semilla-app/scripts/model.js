// Descarga el modelo de voz español de Vosk (alphacephei.com, Apache 2.0) y lo deja en models/model.tar.gz,
// el formato que carga vosk-browser. Se hace una vez; el build lo guarda en caché.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const NAME = 'vosk-model-small-es-0.42';
const URL = `https://alphacephei.com/vosk/models/${NAME}.zip`;
const DIR = path.join(__dirname, '..', 'models');
const OUT = path.join(DIR, 'model.tar.gz');
(async () => {
  if (fs.existsSync(OUT)) { console.log('modelo de voz ya descargado:', OUT); return; }
  fs.mkdirSync(DIR, { recursive: true });
  const zip = path.join(DIR, NAME + '.zip');
  console.log('descargando', URL);
  const r = await fetch(URL);
  if (!r.ok) throw new Error('no se pudo descargar el modelo: HTTP ' + r.status);
  fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  const tmp = path.join(DIR, 'tmp'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
  // tar de Windows y Mac (bsdtar) abre zip; en Linux se usa unzip
  try { execFileSync('tar', ['-xf', zip, '-C', tmp], { stdio: 'inherit' }); }
  catch (e) { execFileSync('unzip', ['-q', zip, '-d', tmp], { stdio: 'inherit' }); }
  const inner = fs.readdirSync(tmp).find((f) => fs.statSync(path.join(tmp, f)).isDirectory()) || NAME;
  fs.renameSync(path.join(tmp, inner), path.join(tmp, 'model'));
  execFileSync('tar', ['-czf', OUT, '-C', tmp, 'model'], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
  console.log('modelo de voz listo:', OUT, Math.round(fs.statSync(OUT).size / 1e6), 'MB');
})().catch((e) => { console.error(e.message); process.exit(1); });
