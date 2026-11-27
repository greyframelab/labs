// render offline de MENSAJERO: frames JPG (+ WAV) de un tramo de la vuelta.
// Uso: node tools/render.js <carpeta> <ancho> <alto> <fps> <t0> <t1> <audio 0|1>   (EXTRA="&testigo")
const { chromium } = require(process.env.PW || 'playwright-core'); const fs=require('fs'), path=require('path');
(async()=>{ const [dir,w,h,fps,t0,t1,au]=process.argv.slice(2); fs.mkdirSync(dir,{recursive:true});
  const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const p=await b.newPage({viewport:{width:+w,height:+h}}); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+path.join(__dirname,'..','render.html')+`?w=${w}&h=${h}`+(process.env.EXTRA||''));
  await p.waitForFunction(()=>document.title==='LISTO',null,{timeout:0});
  if(+au){ const a=await p.evaluate(d=>window.audio(d),+t1); fs.writeFileSync(dir+'/audio.wav',Buffer.from(a,'base64')); }
  for(let i=Math.round(t0*fps);i<Math.round(t1*fps);i++){ const d=await p.evaluate(t=>window.frame(t),i/fps); fs.writeFileSync(dir+'/f'+String(i).padStart(5,'0')+'.jpg',Buffer.from(d.split(',')[1],'base64')); }
  await b.close(); console.log('ok',t0,t1); })();
