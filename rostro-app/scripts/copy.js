// Copia rostro/ (la versión web) dentro de la app: www/ es lo que se empaqueta.
// Añade la visión de OJO que usa ESPEJO (Human y sus modelos), en la misma ruta relativa: www/ojo/…
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DST = path.join(__dirname, '..', 'www');
const skip = (p) => path.basename(p).startsWith('.') || /README\.md$/.test(p) || /[\\/]tools([\\/]|$)/.test(p);
fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'rostro'), DST, { recursive: true, filter: (p) => !skip(p) });
fs.cpSync(path.join(ROOT, 'ojo', 'vendor', 'human'), path.join(DST, 'ojo', 'vendor', 'human'), { recursive: true });
fs.cpSync(path.join(ROOT, 'ojo', 'models'), path.join(DST, 'ojo', 'models'), { recursive: true });
let n = 0; (function count(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? count(p) : n++; } })(DST);
console.log('rostro/ + visión de OJO → www/ ·', n, 'archivos');
