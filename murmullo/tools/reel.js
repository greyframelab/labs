// Reel de Instagram de MURMULLO (9:16): un tramo de la pieza + la firma de VØID_LOOM.
// Uso: node tools/reel.js <carpeta>   (variables: T0, T1, SEED, EXTRA)
const { chromium } = require(process.env.PW || 'playwright-core');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], FPS = 30, T0 = +(process.env.T0 || 12.35), T1 = +(process.env.T1 || 27.5), SD = 5.5;
  fs.mkdirSync(out + '/pieza', { recursive: true }); fs.mkdirSync(out + '/firma', { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  // 1 · la pieza, en vertical
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '?render=1&w=1080&h=1920&q=1&seed=' + (process.env.SEED || 7) + (process.env.EXTRA || ''), { timeout: 0 });
  await p.waitForFunction(() => document.title === 'LISTO' || document.title.startsWith('ERR'), null, { timeout: 0 });
  await p.evaluate((d) => window.MURMULLO.prepara(d), T1 + 3);
  const a = await p.evaluate((d) => window.MURMULLO.audio(d), T1 + 3); fs.writeFileSync(out + '/pieza.wav', Buffer.from(a, 'base64'));
  for (let i = Math.round(T0 * FPS), k = 0; i < Math.round(T1 * FPS); i++, k++) {
    const d = await p.evaluate((t) => window.MURMULLO.frame(t), i / FPS);
    fs.writeFileSync(out + '/pieza/f' + String(k).padStart(5, '0') + '.jpg', Buffer.from(d.split(',')[1], 'base64'));
  }
  // 2 · la firma, con el acento de la pieza
  const f = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await f.goto('file://' + path.join(__dirname, 'firma.html') + '?acento=' + encodeURIComponent(process.env.ACENTO || '#FFB000'));
  await f.waitForFunction(() => document.title === 'LISTO', null, { timeout: 0 });
  for (let k = 0; k < Math.round(SD * FPS); k++) {
    const d = await f.evaluate(([t, k]) => window.firma(t, k), [k / FPS, k]);
    fs.writeFileSync(out + '/firma/f' + String(k).padStart(5, '0') + '.jpg', Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close(); console.log('reel ok');
})();
