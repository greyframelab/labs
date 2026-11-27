#!/usr/bin/env bash
# Reel de Instagram de MENSAJERO (9:16, 30 fps): un tramo de la vuelta con la capa de datos + la firma de VØID_LOOM en blanco espectral.
# Uso: PW=/ruta/playwright-core tools/reel.sh <carpeta>   (T0 por defecto 12,5 s; la vuelta acaba en 34 s)
# Los tramos se renderizan en paralelo, cortados en los cambios de plano (la larga exposición se reinicia en cada corte).
set -e
OUT=${1:-/tmp/mensajero-reel}; T0=${T0:-12.5}; T1=34; FPS=30; ACENTO=${ACENTO:-#E9EEF7}
D=$(cd "$(dirname "$0")/.." && pwd); mkdir -p "$OUT/pieza" "$OUT/firma"
CORTES=($T0 16 20.6 25.3 28 $T1)
for ((i=0;i<${#CORTES[@]}-1;i++)); do a=${CORTES[$i]}; b=${CORTES[$((i+1))]}; au=$([ "$b" = "$T1" ] && echo 1 || echo 0)
  node "$D/tools/render.js" "$OUT/pieza" 1080 1920 $FPS $a $b $au & done; wait
# firma (la misma de todos los labs; solo cambia el acento)
node -e "
const { chromium } = require(process.env.PW||'playwright-core'); const fs=require('fs');
(async()=>{ const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
 const f=await b.newPage({viewport:{width:1080,height:1920}}); await f.goto('file://$D/../murmullo/tools/firma.html?acento='+encodeURIComponent('$ACENTO'));
 await f.waitForFunction(()=>document.title==='LISTO',null,{timeout:0});
 for(let k=0;k<Math.round(5.5*$FPS);k++){ const d=await f.evaluate(([t,k])=>window.firma(t,k),[k/$FPS,k]); fs.writeFileSync('$OUT/firma/f'+String(k).padStart(5,'0')+'.jpg',Buffer.from(d.split(',')[1],'base64')); }
 await b.close(); })();"
python3 "$D/tools/firma_audio.py" "$OUT/firma.wav"
# montaje: pieza (desde T0) + firma, audio a -14 LUFS / -1 dBTP
S0=$(python3 -c "print(round($T0*$FPS))")
ffmpeg -loglevel error -y -framerate $FPS -start_number $S0 -i "$OUT/pieza/f%05d.jpg" -framerate $FPS -i "$OUT/firma/f%05d.jpg" \
  -ss $T0 -t $(python3 -c "print($T1-$T0)") -i "$OUT/pieza/audio.wav" -i "$OUT/firma.wav" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v];[2:a]afade=t=out:st=$(python3 -c "print($T1-$T0-.6)"):d=0.6[p];[p][3:a]concat=n=2:v=0:a=1,loudnorm=I=-14:TP=-1:LRA=11[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 17 -preset veryfast -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$OUT/MENSAJERO_reel.mp4"
echo "reel: $OUT/MENSAJERO_reel.mp4"
