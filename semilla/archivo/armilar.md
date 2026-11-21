# ARMILAR (archivada)

Forma 8 de SEMILLA entre NÚCLEO y MÖBIUS. Esfera armilar de obsidiana: seis anillos anidados alrededor de una estrella pequeña.
Punto medio: los de fuera son cuchillas limpias y segmentadas, y hacia el centro se vuelven vivos (respiran, cuentas como vértebras,
se retuercen y se funden). La luz sale solo del núcleo. Pasa por la capa común de `map()` (sin tallas de superficie ni grietas de FUEGO,
que partían los anillos finos).

**Cómo volver a activarla:** pegar los bloques en `engine.js` (funciones antes de `map()`, distancia en `map()`, luz en `shade()` y el
núcleo en `main()` antes del suelo), y darle una especie en `score.js`. En la cámara general: `if(uForm==8) dist*=0.72+0.25*step(0.5,fract(K*3.0));`
y `lift` de la forma 8: `1.05+0.45*uEnergy`. Historial de git: `git show 42504cc:semilla/engine.js`.

## Funciones (antes de `map()`)
```glsl
// ARMILAR: una esfera armilar de obsidiana. Seis anillos-cuchilla anidados, cada uno partido en segmentos y girando sobre su propio eje,
// alrededor de un núcleo de luz. Los anillos se cruzan, se alinean un instante con el bombo y en la ruptura se abren hacia fuera.
float sep8(){ return 0.22*uImpact+0.03*uBass; }
float armilar(vec3 p){
  // punto medio: los anillos de fuera son cuchillas limpias y segmentadas (se lee el mecanismo);
  // hacia el centro se vuelven vivos: respiran, se llenan de cuentas como vértebras, se retuercen y se funden como tendones
  float d=1e9, ph=uPhase;
  for(int i=0;i<6;i++){ float fi=float(i), o=fi/5.0; o=o*o*(3.0-2.0*o);   // 0 = mecanismo, 1 = vivo
    float R=(1.08-fi*0.155)*(1.0+sep8()*(0.4+0.12*fi));
    vec3 q=p;
    q.xy=rot(fi*0.53+uV0.x*3.0+ph*(0.13+0.05*fi)*(mod(fi,2.0)<0.5?1.0:-1.0))*q.xy;
    q.yz=rot(fi*1.17+uV0.y*3.0+ph*(0.21-0.03*fi))*q.yz;
    q.xz=rot(ph*(0.3+0.1*fi))*q.xz;
    float N=6.0+fi*2.0+floor(uV0.z*4.0), seg=6.2832/N, a=atan(q.z,q.x), r=length(q.xz), da=(fract(a/seg)-0.5)*seg;
    float ond=(sin(a*(2.0+fi)+ph*1.3+fi)*0.035+sin(a*(5.0+fi)-ph*0.9)*0.012)*o;
    float bead=pow(0.5+0.5*cos(a*N+ph*0.6*(mod(fi,2.0)<0.5?1.0:-1.0)),1.6);
    bead*=1.0-0.6*clamp(sep8()*3.0,0.0,1.0)*o;                                            // en la ruptura los cuellos vivos casi se parten
    float w=mix(0.07,0.035+0.05*bead,o)*(1.0-fi*0.05), th=mix(0.02,0.016+0.022*bead,o)*(1.0-fi*0.04);
    vec2 cs=vec2(r-R*(1.0+ond),q.y+0.03*sin(a*3.0+ph+fi)*o);
    cs=rot((a*1.5+ph*0.4+fi)*o)*cs;
    float blade=length(max(abs(cs)-vec2(w,th),0.0))+min(max(abs(cs.x)-w,abs(cs.y)-th),0.0)-0.008;
    float tube=(length(cs/vec2(w,th))-1.0)*min(w,th);
    float ring=mix(blade,tube,o);
    float gap=0.004+0.05*clamp(sep8()*4.0,0.0,1.0);
    ring=mix(max(ring,abs(da)*r-(seg*0.5*r-gap)),ring,o);                                   // solo el mecanismo va partido en segmentos
    d=smin(d,ring,0.004+0.045*o);
  }
  return d*0.85;
}
```

## Distancia (en `map()`)
```glsl
  } else if(uForm==8){     // ARMILAR
    d=armilar(p);   // pasa por la capa común: respira, y la familia de la palabra la deforma como al resto
```

## Luz de los anillos (en `shade()`)
```glsl
  if(uForm==8){            // ARMILAR: el núcleo ilumina las caras de los anillos que lo miran
    vec3 lp=-p; float dl=length(lp); vec3 ld=lp/max(dl,1e-4);
    float pulse=0.35+0.9*uKick+1.6*uImpact+0.4*uEnergy;
    float fin=max(dot(n,ld),0.0);
    col+=mix(uAcc,vec3(1.0,0.96,0.9),0.25)*(fin*fin*0.75+pow(fin,16.0)*0.7)*pulse/(0.2+dl*dl*1.15)*(0.5+0.5*ao); }
```

## Núcleo (en `main()`)
```glsl
  if(uForm==8){            // ARMILAR: el núcleo, una estrella pequeña; su luz se derrama en el aire entre los anillos
    float tc=dot(-ro,rd), dc=length(cross(rd,-ro)); float pulse=0.35+0.9*uKick+1.6*uImpact+0.4*uEnergy;
    float vis=(t>=9.0||tc<t)?1.0:0.0;
    col+=vis*(vec3(1.0,0.97,0.92)*smoothstep(0.04,0.018,dc)*(0.8+0.6*pulse)+mix(uAcc,vec3(1.0),0.35*exp(-dc*40.0))*(exp(-dc*28.0)*0.9+exp(-dc*7.0)*0.25+exp(-dc*2.5)*0.06)*pulse);   // núcleo pequeño y muy caliente; la corona toma el color
    col+=uAcc*0.02*exp(-dc*1.2)*pulse; }
```

## Especie (`score.js`)
```js
{ id: 'armilar', form: 8, name: 'ARMILAR', idea: 'un mecanismo de obsidiana que se vuelve vivo hacia su centro, alrededor de una estrella pequeña', acc: ['cian', 'rojo', 'violeta', 'ambar'], w: 4 },
```
