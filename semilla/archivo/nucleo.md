# NÚCLEO (archivada)

Forma 8 de SEMILLA entre la PR #125 y la sustitución por ARMILAR. Monolito fractal de obsidiana (pliegues caleidoscópicos
iterados), alto, con la luz de acento en las juntas internas. Se guarda aquí para poder recuperarla.

**Cómo volver a activarla:** pegar los tres bloques en `engine.js` (la función antes de `map()`, la distancia en la cadena de
formas de `map()` y la luz en `shade()`), y en `score.js` darle una especie (`form: 8` o un número nuevo; si es nuevo, subir
`FORMS` en `engine.js`). En la cámara general, `dist*=1.0+0.55*step(0.5,fract(K*3.0))` hacía que a veces se viera entera.
También está en el historial de git: `git show 0cef579:semilla/engine.js`.

## Función (antes de `map()`)
```glsl
// NÚCLEO: arquitectura fractal (pliegues caleidoscópicos iterados) que se reordena con el pulso.
// gEnj.x guarda lo cerca que pasa el punto de las juntas internas: ahí vive la luz.
float nucleo(vec3 p){
  float ph=uPhase, s=1.0, trap=1e9;
  float a1=0.42+0.22*uV0.x+0.12*sin(ph*0.5), a2=0.28+0.25*uV0.y+0.1*cos(ph*0.37);
  vec3 off=vec3(1.3,0.62+0.25*uV0.z,0.36+0.2*uV0.w)*(1.0+0.08*uBass+0.3*uImpact);   // en la ruptura la estructura se abre
  mat2 r1=rot(a1), r2=rot(a2);
  for(int i=0;i<3;i++){
    p=abs(p);
    if(p.x<p.y) p.xy=p.yx; if(p.x<p.z) p.xz=p.zx; if(p.y<p.z) p.yz=p.zy;
    p.xy=r1*p.xy; p.yz=r2*p.yz;
    p=p*2.0-off;
    if(p.z<-0.5*off.z) p.z+=off.z;
    s*=2.0;
    trap=min(trap,length(p.yz)/s*4.0);
  }
  gEnj=vec4(trap,0.0,0.0,0.0);
  vec3 b=abs(p)-vec3(1.2,0.32+0.12*uV0.z,0.3);   // vigas: la estructura queda abierta, con vacío dentro
  return (length(max(b,0.0))+min(max(b.x,max(b.y,b.z)),0.0)-0.04)/s;
}
```

## Distancia (dentro de `map()`)
```glsl
  } else if(uForm==8){     // NÚCLEO: arquitectura fractal de obsidiana
    vec3 r=p; r.xz=rot(ph*0.25)*r.xz; r.xy=rot(0.15*sin(ph*0.3))*r.xy;
    return nucleo(vec3(r.x,r.y/1.75,r.z)/0.8)*0.8;   // alto como un monolito: se impone en el encuadre
```

## Luz (dentro de `shade()`)
```glsl
  if(uForm==8){ map(p);   // NÚCLEO: la luz vive en las juntas internas y late con el bombo; en la ruptura la estructura arde por dentro
    float seam=exp(-gEnj.x/(0.02+0.04*uImpact));
    col+=uAcc*seam*(0.22+1.1*uKick+1.8*uImpact+0.6*uEnergy)*(0.35+0.65*ao); }
```

## Especie (`score.js`)
```js
{ id: 'nucleo', form: 8, name: 'NÚCLEO', idea: 'una arquitectura fractal de obsidiana que se reordena; la luz vive en sus juntas', acc: ['cian', 'rojo', 'violeta', 'ambar'], w: 4 },
```
