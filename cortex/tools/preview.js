// Render offline de CÓRTEX (preview): frames JPG + audio WAV desde el mismo motor que en vivo.
// SIM=1: visitantes simulados (modo PÚBLICO) · DUR: duración total a preparar
// Uso: node tools/preview.js <carpeta> <ancho> <alto> <fps> <t0> <t1> <audio 0|1>
// Render offline de la pieza: frames + audio desde el mismo motor que en vivo
const { chromium } = require(process.env.PW||'playwright-core');
const fs=require('fs');
(async()=>{
  const [,,out,w,h,fps,t0,t1,audio]=process.argv;
  const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required']});
  const p=await b.newPage({viewport:{width:+w,height:+h}});
  p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text()); });
  await p.goto('file://'+require('path').join(__dirname,'..','index.html')+'?render=1&w='+w+'&h='+h+'&q='+(process.env.Q||1)+(process.env.SIM?'&sim':''),{timeout:0});
  await p.waitForFunction(()=>document.title==='LISTO'||document.title.startsWith('ERR'),null,{timeout:0});
  const tt=await p.title(); if(tt.startsWith('ERR')){console.log(tt);process.exit(1);}
  fs.mkdirSync(out,{recursive:true});
  const info=await p.evaluate(d=>window.CORTEX.prepara(d),+(process.env.DUR||t1)); if(process.env.INFO) console.log(JSON.stringify(info));
  if(audio==='1'){ const a=await p.evaluate(d=>window.CORTEX.audio(d),+t1); fs.writeFileSync(out+'/audio.wav',Buffer.from(a,'base64')); console.log('audio ok'); }
  const F=+fps; for(let i=Math.round(+t0*F);i<Math.round(+t1*F);i++){
    const d=await p.evaluate(t=>window.CORTEX.frame(t),i/F);
    fs.writeFileSync(out+'/f'+String(i).padStart(5,'0')+'.jpg',Buffer.from(d.split(',')[1],'base64'));
  }
  await b.close(); console.log('frames ok');
})();
