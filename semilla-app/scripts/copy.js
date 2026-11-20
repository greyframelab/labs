// Copia semilla/ (la versión web) dentro de la app: www/ es lo que se empaqueta.
// Añade la voz offline: vosk.js (WebAssembly) y el modelo español si ya se ha descargado (npm run model).
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'semilla');
const DST = path.join(__dirname, '..', 'www');
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true, filter: (p) => !path.basename(p).startsWith('.') && !/README\.md$/.test(p) });
fs.mkdirSync(path.join(DST, 'vosk'), { recursive: true });
fs.copyFileSync(require.resolve('vosk-browser/dist/vosk.js'), path.join(DST, 'vosk', 'vosk.js'));
const model = path.join(__dirname, '..', 'models', 'model.tar.gz');
if (fs.existsSync(model)) fs.copyFileSync(model, path.join(DST, 'vosk', 'model.tar.gz'));
else console.warn('· sin modelo de voz (npm run model): la app funcionará, pero el modo PÚBLICO no oirá');
let n = 0; (function count(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? count(p) : n++; } })(DST);
console.log('semilla/ → www/ ·', n, 'archivos');
