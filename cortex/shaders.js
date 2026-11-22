const B_VS=`#version 300 es
precision highp float;
in vec4 a; in vec2 b; in vec3 nr;
uniform mat4 VP; uniform float T, focus, ap, RY, burst, kick, dark, fireAmt, inset, rs; uniform vec3 cam;
uniform vec4 wv[4];
out float vI; out float vS; out float vN; out float vH;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  float id=b.x, kind=b.y; float hr=hh(id+a.x*13.+a.z*7.);
  // ESTALLIDO: la materia sale por la normal y se dispersa
  float hc=hh(id*1.31); vec3 cd=normalize(normalize(a.xyz*vec3(1.,1.2,.8))+(vec3(hh(id*2.1),hh(id*3.7),hh(id*5.3))-.5)*.9);
  float bu = kind>=5. ? 0. : burst;
  vec3 p=a.xyz - nr*inset + cd*bu*(.35+.9*hc) + nr*bu*.06*hr + (vec3(hh(hr*3.),hh(hr*5.),hh(hr*7.))-.5)*bu*bu*.5*step(.93,hr);
  vec4 cp=VP*vec4(p,1.); gl_Position=cp; float dep=cp.w;
  float g = (kind>=3.) ? a.w : .7;
  // materia: casi apagada, solo las crestas se intuyen
  vec3 V=normalize(cam-p); float nv=max(dot(nr,V),0.);
  float key=max(dot(nr,normalize(vec3(.5,.8,.35))),0.);
  float rim=pow(1.-nv,3.)*max(dot(nr,normalize(vec3(-.3,.6,-.8))),0.)*1.5+pow(1.-nv,5.)*.6;
  float crest=smoothstep(.2,.85,g);
  float base = (kind>=3.) ? .05*(.1+crest*(.3+1.*key))+.09*rim*crest + .012*(1.-crest) : .02;
  // ondas de disparo que recorren la corteza
  float fire=0.;
  for(int i=0;i<4;i++){ float d=length(p-wv[i].xyz); float R=wv[i].w;
    fire+=(exp(-pow((d-R)*34.,2.))*2.8 + step(d,R)*exp(-(R-d)*6.)*.32)*step(0.,R)*(1.-smoothstep(.3,1.8,R)); }
  fire*=fireAmt*(.08+.92*pow(crest,1.5));
  float crack = (kind>=3.&&kind<5.) ? smoothstep(.0,.15,burst)*(1.-crest)*(1.6-burst*1.2)*1.4 : 0.;   // el interior se ve por las grietas
  fire+=crack;
  float kk=kick*exp(-pow((length(p)-.35-kick*.0)*0.,2.))*.0+kick*.6*(.2+g);   // pulso global del bombo: la materia respira
  float dust = kind==5. ? .004*(.4+.6*hh(id+floor(T*2.+hr*9.))) : 0.;
  float bg=0.;
  if(kind==6.){ float per=4.+5.*hh(id*.37); float lt=mod(T+hh(id)*per,per); float act=step(.68,hh(id*1.9+floor((T+hh(id)*per)/per)));
    float wv=exp(-pow((a.w-lt*.9)*5.,2.))*act; bg=.06+(wv*1.2+(a.w==0.?exp(-lt*2.)*act*.8:0.));
    fire=wv*1.2*act; base=.0; }
  float I=(base*(1.+kk*3.))*(1.-dark)+fire*(kind==6.?0.:1.)+dust+bg;
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY*(kind==6.?6.:1.);
  float s0=clamp(1.25*2.6/max(dep,.1),1.25,7.);              // de cerca, cada partícula cubre más: la superficie no se vacía
  float sz=max(s0,coc+1.);
  gl_PointSize=inset>0.?(kind>=5.?0.:clamp(3.2*2.6/max(dep,.2)*RY/900.,2.,7.)):min(sz,70.);
  float energy=(s0*s0)/(gl_PointSize*gl_PointSize);
  vI=I*energy*rs*smoothstep(.05,.3,dep); vS=gl_PointSize; vN=kind==6.?clamp(fire*1.5,0.,1.):clamp(fire/(base+fire+1e-4),0.,1.); vH=smoothstep(1.9,3.6,fire);
}`;
const B_FS=`#version 300 es
precision highp float;
in float vI; in float vS; in float vN; in float vH; uniform vec3 neon; out vec4 o;
void main(){ vec2 q=gl_PointCoord*2.-1.; float r=length(q);
  float disk= vS>4. ? smoothstep(1.,.85,r) : exp(-r*r*3.);
  vec3 matter=vec3(.82,.86,.95);                     // materia: blanco frío apagado
  o=vec4(mix(mix(matter,neon,vN),vec3(1.,.98,.95),vH*.85)*vI*disk,1.); }`;
const B_LVS=`#version 300 es
precision highp float;
in vec4 a; in vec2 b; in vec3 nr;
uniform mat4 VP; uniform float burst, fireAmt, dark; uniform vec4 wv[4];
out float vI; out float vN;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){ float hr=hh(b.x);
  vec3 p=a.xyz + nr*burst*(.15+1.1*hr);
  gl_Position=VP*vec4(p,1.);
  float fire=0.; for(int i=0;i<4;i++){ float d=length(p-wv[i].xyz); float R=wv[i].w; fire+=exp(-pow((d-R)*10.,2.))*step(0.,R)*(1.-smoothstep(.2,1.6,R)); }
  vI=.006*(1.-dark)+fire*fireAmt*.9; vN=clamp(fire*fireAmt*8.,0.,1.); }`;
const B_LFS=`#version 300 es
precision highp float; in float vI; in float vN; uniform vec3 neon; out vec4 o;
void main(){ o=vec4(mix(vec3(.82,.86,.95),neon,vN)*vI,1.); }`;
const B_PFS=`#version 300 es
precision highp float;
uniform sampler2D S; uniform vec2 R; uniform float glitch, T, streak, sort, dpulse; uniform vec3 neon; uniform vec4 shock; out vec4 o;
float hh(float n){return fract(sin(n*91.7+floor(T*12.)*13.1)*43758.5453);}
vec3 tap(vec2 u){return texture(S,clamp(u,0.,1.)).rgb;}
float lum(vec3 c){return max(c.r,max(c.g,c.b));}
void main(){
  vec2 uv=gl_FragCoord.xy/R; float g=glitch; vec2 asp=vec2(R.x/R.y,1.);
  // FX 1 · ONDA DE CHOQUE: refracción radial en un anillo (impacto)
  vec2 dv=(uv-shock.xy)*asp; float dl=length(dv);
  float ring=exp(-pow((dl-shock.z)*18.,2.))*shock.w;
  vec2 u2=uv-normalize(dv+1e-5)/asp*ring*.035;
  // FX 2 · GLITCH: franjas desplazadas
  float by=floor(uv.y*30.), by2=floor(uv.y*90.);
  if(hh(by)>1.-.18*g) u2.x+=(hh(by+7.)-.5)*.2*g;
  vec3 c=tap(u2);
  // FX 3 · PIXEL SORT: en franjas finas la luz se arrastra en horizontal
  if(hh(by2*1.7+3.)>1.-.22*sort){ float L=.04+.12*hh(by2);
    for(int i=1;i<14;i++){ vec3 s=tap(u2-vec2(L*float(i)/14.,0.)); c=max(c,s*(1.-float(i)/14.)*step(.35,lum(s))); } }
  // desdoble en el mismo acento
  vec3 gh=tap(u2+vec2(.014*g,0.)); c=max(c, neon*lum(gh)*1.3*g);
  // bloom
  vec3 bl=vec3(0);
  for(int i=0;i<24;i++){ float a=float(i)*2.39996; float rr=sqrt(float(i)+.5)/4.9*.028;
    bl+=tap(u2+vec2(cos(a),sin(a))*rr/asp*vec2(1.,1.)); }
  c+=bl/24.*.5;
  // FX 4 · DESTELLO ANAMÓRFICO: las zonas incandescentes se estiran en horizontal
  vec3 st=vec3(0);
  for(int i=-16;i<=16;i++){ vec3 s=tap(u2+vec2(float(i)*.0065,0.)); st+=max(s-.95,0.)*exp(-abs(float(i))*.22); }
  c+=mix(neon,vec3(1.),.35)*lum(st)*.05*streak;
  c+=neon*ring*.25;
  // FX 5 · DARK PULSE: la exposición cae y la viñeta se cierra
  vec2 v=uv; float vig=pow(16.*v.x*v.y*(1.-v.x)*(1.-v.y),.12+dpulse*1.2);
  c*=vig*(1.-dpulse*.85);
  float l=lum(c);
  c=mix(1.-exp(-c*2.8), vec3(1.), smoothstep(1.4,6.,l)*.8);
  c+=(fract(sin(dot(gl_FragCoord.xy+T,vec2(12.9898,78.233)))*43758.5453)-.5)*.006*smoothstep(0.,.1,c.g+c.b);
  o=vec4(c,1);
}`;
const R_VS=`#version 300 es
precision highp float;
in vec4 a; in vec2 b;
uniform mat4 VP; uniform vec3 cam; uniform float T, focus, ap, RY, spread;
out vec3 vC; out float vA;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  vec4 cp=VP*vec4(a.xyz,1.); gl_Position=cp;
  float dep=cp.w;
  float id=b.x, kind=b.y;
  // cada neurona dispara en su propio ciclo; la onda sale del soma y recorre el árbol
  float per=3.5+5.*hh(id*1.7);
  float lt=mod(T+hh(id)*per,per);
  float act=id<0.?1.:step(hh(id*3.1+floor((T+hh(id)*per)/per)),spread);
  if(id<0.){ per=4.; lt=mod(T+(-id)*.7,per); }     // solo una parte dispara en cada ciclo
  float wave=exp(-pow((a.w-lt*1.1)*9.,2.))*act*1.4;
  float soma=(kind==0.)?(exp(-lt*2.2)*act*3.5+.06):0.;
  float trail=act*smoothstep(lt*1.1,lt*1.1-.5,a.w)*step(a.w,lt*1.1)*exp(-lt*.55)*1.1;
  float I=.045+wave*3.4+soma+trail;
  if(kind==2.) I*=.8;
  // DOF: círculo de confusión en píxeles, energía conservada
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY;
  float sz=max(1.6,coc+1.);
  gl_PointSize=min(sz,90.);
  float energy=(1.6*1.6)/(gl_PointSize*gl_PointSize)*(kind==0.?1.:(.2+.8*smoothstep(1.,7.,coc)));
  float fog=exp(-max(dep-.5,0.)*.26-max(dep-2.2,0.)*.55)*smoothstep(.06,.35,dep);
  vC=vec3(I)*energy*fog; vA=gl_PointSize;
}`;
const R_FS=`#version 300 es
precision highp float;
in vec3 vC; in float vA; uniform vec3 neon; out vec4 o;
void main(){
  vec2 q=gl_PointCoord*2.-1.; float r=length(q);
  float disk = vA>4. ? smoothstep(1.,.86,r)*(.85+.15*r) : exp(-r*r*3.);
  float I=vC.r*disk;
  o=vec4(neon*I + vec3(1.)*max(I-.8,0.)*.0, 1.);
}`;
const R_LVS=`#version 300 es
precision highp float;
in vec4 a; in vec2 b;
uniform mat4 VP; uniform float T, focus, ap, RY, spread;
out float vI;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  vec4 cp=VP*vec4(a.xyz,1.); gl_Position=cp; float dep=cp.w; float id=b.x, kind=b.y;
  float per=3.5+5.*hh(id*1.7); float lt=mod(T+hh(id)*per,per);
  float act=id<0.?1.:step(hh(id*3.1+floor((T+hh(id)*per)/per)),spread);
  if(id<0.){ per=4.; lt=mod(T+(-id)*.7,per); }
  float wave=exp(-pow((a.w-lt*1.1)*7.,2.))*act*3.2;
  float trail=act*smoothstep(lt*1.1,lt*1.1-.5,a.w)*step(a.w,lt*1.1)*exp(-lt*.55)*1.1;
  float I=.06+wave*3.+trail;
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY;
  float fog=exp(-max(dep-.5,0.)*.26-max(dep-2.2,0.)*.55)*smoothstep(.06,.35,dep);
  vI=I*fog*exp(-coc*.3)*1.1;
}`;
const R_LFS=`#version 300 es
precision highp float; in float vI; uniform vec3 neon; out vec4 o; void main(){ o=vec4(neon*vI,1.); }`;