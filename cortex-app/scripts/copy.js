// Copia cortex/ (la versión web) dentro de la app: www/ es lo que se empaqueta.
// Va todo dentro (código y la noche de EEG que hace de partitura): la app funciona sin internet.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DST = path.join(__dirname, '..', 'www');
const skip = (p) => path.basename(p).startsWith('.') || /(README|ESTADO)\.md$/.test(p) || /[\\/]tools([\\/]|$)/.test(p);
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'cortex'), DST, { recursive: true, filter: (p) => !skip(p) });
let n = 0; (function count(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? count(p) : n++; } })(DST);
console.log('cortex/ → www/ ·', n, 'archivos');
