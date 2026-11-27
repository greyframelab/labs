// Copia mensajero/ (la versión web) dentro de la app: www/ es lo que se empaqueta.
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'mensajero');
const DST = path.join(__dirname, '..', 'www');
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true, filter: (p) => !path.basename(p).startsWith('.') && !/(README|NOTAS)\.md$/.test(p) && !p.includes(path.sep + 'tools') });
let n = 0; (function count(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? count(p) : n++; } })(DST);
console.log('mensajero/ → www/ ·', n, 'archivos');
