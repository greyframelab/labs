/* VØID_LOOM · SEMILLA — motor visual WebGL2.
   Seis especies abstractas, cada una un sistema distinto. Todo el tiempo pasa por la fase del bucle
   (2π·t/L con múltiplos enteros), así que cada pieza repite perfecta y render(t) no guarda estado.
   Post de estudio: bloom en cadena, aberración, viñeta, grano sutil, firma de VØID_LOOM encima. */
(function () {
  const HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT, uPhase, uEnergy, uSec, uW, uDen, uChaos, uAspect, uN;
uniform float uKick, uKickN, uKickDt, uMetal, uMetalN, uMetalDt, uMetalP, uTick, uBass, uBassP, uImpact, uImpactDt;
uniform vec3 uAcc; uniform vec4 uV0, uV1; uniform float uZoom, uRot, uDrift; uniform vec2 uOff; uniform int uMask, uVar;
#define TAU 6.28318530718
uniform vec3 uGround, uP0, uP1, uP2; uniform float uDark, uLight;
vec3 PAL(int i){ return i==0?uP0:i==1?uP1:uP2; }
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
float mod289(float x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
float permute(float x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float taylorInvSqrt(float r){return 1.79284291400159-0.85373472095314*r;}
vec4 grad4(float j, vec4 ip){
  const vec4 ones=vec4(1.0,1.0,1.0,-1.0); vec4 p,s;
  p.xyz=floor(fract(vec3(j)*ip.xyz)*7.0)*ip.z-1.0;
  p.w=1.5-dot(abs(p.xyz),ones.xyz);
  s=vec4(lessThan(p,vec4(0.0)));
  p.xyz=p.xyz+(s.xyz*2.0-1.0)*s.www;
  return p;
}
float snoise(vec4 v){
  const vec4 C=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958);
  vec4 i=floor(v+dot(v,vec4(0.309016994374947451)));
  vec4 x0=v-i+dot(i,C.xxxx);
  vec4 i0; vec3 isX=step(x0.yzw,x0.xxx); vec3 isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z; i0.yzw=1.0-isX;
  i0.y+=isYZ.x+isYZ.y; i0.zw+=1.0-isYZ.xy;
  i0.z+=isYZ.z; i0.w+=1.0-isYZ.z;
  vec4 i3=clamp(i0,0.0,1.0); vec4 i2=clamp(i0-1.0,0.0,1.0); vec4 i1=clamp(i0-2.0,0.0,1.0);
  vec4 x1=x0-i1+C.xxxx; vec4 x2=x0-i2+C.yyyy; vec4 x3=x0-i3+C.zzzz; vec4 x4=x0+C.wwww;
  i=mod289(i);
  float j0=permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1=permute(permute(permute(permute(i.w+vec4(i1.w,i2.w,i3.w,1.0))+i.z+vec4(i1.z,i2.z,i3.z,1.0))+i.y+vec4(i1.y,i2.y,i3.y,1.0))+i.x+vec4(i1.x,i2.x,i3.x,1.0));
  vec4 ip=vec4(1.0/294.0,1.0/49.0,1.0/7.0,0.0);
  vec4 p0=grad4(j0,ip); vec4 p1=grad4(j1.x,ip); vec4 p2=grad4(j1.y,ip); vec4 p3=grad4(j1.z,ip); vec4 p4=grad4(j1.w,ip);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w; p4*=taylorInvSqrt(dot(p4,p4));
  vec3 m0=max(0.6-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.0);
  vec2 m1=max(0.6-vec2(dot(x3,x3),dot(x4,x4)),0.0);
  m0=m0*m0; m1=m1*m1;
  return 49.0*(dot(m0*m0,vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2)))+dot(m1*m1,vec2(dot(p3,x3),dot(p4,x4))));
}
// ruido que da la vuelta: recorre un círculo en las dimensiones 3 y 4 (k entero = bucle perfecto)
float nL(vec2 p, float r, float k){ float a=uPhase*k; return snoise(vec4(p+uDrift*vec2(0.11,-0.07), r*cos(a)+uDrift*0.05, r*sin(a))); }
float fbmL(vec2 p, float r, int oct){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*nL(p,r,1.0); p=p*2.03+vec2(17.1,-9.3); a*=0.5; r*=1.35; } return s; }
float h11(float x){ return fract(sin(x*127.1)*43758.5453); }
vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float h12(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
const vec3 INK=vec3(0.95,0.93,0.88);
`;
  const FRAG = `
vec2 screenP(){ return (gl_FragCoord.xy-0.5*uRes)/uRes.y; }
vec2 frameP(){ vec2 p=screenP(); p=rot(uRot+0.06*sin(uPhase)+0.25*sin(uDrift*0.21))*p; return p/(uZoom*(1.0+0.12*sin(uDrift*0.13)))+uOff; }
// composición: el negro manda; la luz vive en una zona
float compMask(vec2 q){
  if(uMask==1) return smoothstep(0.75,0.12,length(q*vec2(0.75,1.0)));
  if(uMask==2) return smoothstep(0.34,0.04,abs(q.y+0.06));
  if(uMask==3) return smoothstep(0.42,0.08,abs(q.x-uOff.x*0.6));
  return 1.0;
}
// el soporte: lienzo o papel con su grano y la luz de sala, nunca un color plano digital
vec3 ground(vec2 q){
  vec2 g=gl_FragCoord.xy*(1080.0/uRes.y);
  float weave=(sin(g.x*1.9)*sin(g.y*1.9))*0.5+0.5;
  float tooth=fbmL(q*9.0,0.15,2);
  vec3 c=uGround*(0.965+0.045*weave*(1.0-uDark)+0.035*tooth);
  return c*(1.0-0.1*(1.0-uDark)*smoothstep(0.35,1.1,length(q*vec2(0.7,1.0))));
}
// empaste: relieve con luz rasante y brillo (gloss 0 mate, 1 pintura mojada)
vec3 lit(vec3 base, float h, float gloss){
  float S=uRes.y*0.0022;
  vec3 n=normalize(vec3(-dFdx(h)*S,-dFdy(h)*S,1.0));
  vec3 L=normalize(vec3(-0.55,0.62,0.56)), V=vec3(0.0,0.0,1.0);
  float dif=0.8+0.3*dot(n,L);
  float sp=pow(max(dot(n,normalize(L+V)),0.0),55.0)*gloss;
  return base*dif+vec3(1.0,0.98,0.95)*sp*0.4;
}
`;

  const FS_VERT = `#version 300 es
void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;

  // ---------- especies (fragment) ----------
  // Cada especie pinta su cuadro entero (fondo incluido). Los fundidos entre piezas suman pesos que dan 1.
  const SP = {};

  // GESTO: pincel cargado con dos o tres colores, empaste con relieve y brillo húmedo; el ECO lo disuelve en el fondo
  SP.gesto = `
out vec4 o;
uniform float uBar;
vec2 bz(vec2 a,vec2 b,vec2 c,float t){ return mix(mix(a,b,t),mix(b,c,t),t); }
void main(){
  vec2 q=screenP(), p=frameP();
  float bars=uT/uBar;
  float wash=bars>=12.0?smoothstep(12.0,15.6,bars):0.0;
  vec3 g=ground(q), col=g; float h=0.0, wet=0.0;
  for(int i=0;i<7;i++){
    float fi=float(i), ti=i==6?8.0:0.6+fi*1.25;
    if(bars<ti) break;
    float prog=clamp((bars-ti)/0.6,0.0,1.0); prog=1.0-pow(1.0-prog,3.0);
    float hA=h11(fi*3.1+uV0.x*40.0), hB=h11(fi*5.7+uV0.y*40.0), hC=h11(fi*9.3+uV0.z*40.0), hD=h11(fi*1.9+uV0.w*40.0), hE=h11(fi*4.7+uV1.x*40.0);
    float big=i==6?1.0:0.0, wide=step(0.68,hE)*(1.0-big);
    float ang=(hA<0.4?1.5708:hA<0.75?0.6:-0.6)+(hB-0.5)*0.7;
    vec2 dir=vec2(cos(ang),sin(ang)), nrm=vec2(-dir.y,dir.x);
    float len=0.55+0.7*hC+0.35*big;
    vec2 a=vec2((hB-0.5)*0.9,(hD-0.5)*0.5)-dir*len*0.5;
    vec2 c=a+dir*len, b=(a+c)*0.5+nrm*(hD-0.5)*(0.45+0.5*wide)*(0.4+uChaos);
    float w=(0.03+0.05*hD+0.06*big+0.07*wide)*(0.8+0.4*uDen);
    float best=9.0, bs=0.0, side=0.0; vec2 pr=a;
    for(int k=1;k<=20;k++){
      float tk=float(k)/20.0; if(tk>prog+0.05) break;
      vec2 pk=bz(a,b,c,min(tk,prog)), ab=pk-pr, ap=p-pr;
      float hh=clamp(dot(ap,ab)/max(dot(ab,ab),1e-6),0.0,1.0); vec2 cl=pr+ab*hh; float dd=length(p-cl);
      if(dd<best){ best=dd; bs=(float(k-1)+hh)/20.0; side=dot(p-cl,normalize(vec2(-ab.y,ab.x)+1e-6)); }
      pr=pk;
    }
    if(best>w*1.6) continue;
    float s=bs, taper=(0.6+0.4*smoothstep(0.0,0.05,s))*(1.0-smoothstep(0.8,1.0,s/max(prog,0.01))*0.4);
    float across=side/w;
    float rough=fbmL(vec2(s*5.0+fi,across*1.3),0.3,2)*0.22;
    float body=1.0-smoothstep(0.82-rough,1.0-rough,best/w/max(taper,0.05));
    float bristle=fbmL(vec2(s*(3.0+5.0*hC)+fi*4.0,across*(wide>0.5?4.0:10.0)),0.25,3);
    float load=1.0-s*(0.5+0.4*hC);
    float dry=smoothstep(-0.35+0.8*(1.0-load),0.3+0.8*(1.0-load),bristle+0.25);
    float paint=body*dry;
    int ia=int(mod(fi,3.0)), ib=int(mod(fi+1.0+floor(hB*2.0),3.0)), ic=int(mod(fi+2.0,3.0));
    float band=smoothstep(-0.18,0.18,across+0.7*fbmL(vec2(s*2.0,fi),0.3,2)-(hA-0.5)*0.8);
    vec3 sc=mix(PAL(ia),PAL(ib),band);
    sc=mix(sc,PAL(ic),smoothstep(0.5,0.75,bristle)*0.45*(1.0-uDark*0.5));
    if(big>0.5) sc=mix(uAcc,uAcc*0.72,band*0.6);
    float hs=paint*(0.35+0.65*bristle)*(0.55+0.45*load)*(1.0+big*0.4);
    col=mix(col,sc,paint);
    h=mix(h,h*0.35+hs,paint);
    wet=max(wet,paint*exp(-(bars-ti)*0.5));
  }
  col=lit(col,h,0.25+0.9*wet);
  col=mix(col,g,wash);
  o=vec4(col*(1.0+uKick*0.05)*uW,1.0);
}`;

  // ESPÁTULA: pasadas de rasqueta en horizontal; lo de debajo asoma donde la rasqueta salta; el ECO lo cubre con el fondo
  SP.espatula = `
out vec4 o;
uniform float uBar;
void main(){
  vec2 q=screenP(), uv=gl_FragCoord.xy/uRes;
  float bars=uT/uBar;
  vec3 col=ground(q); float h=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i), ti=i==3?8.0:i==4?12.2:0.4+fi*2.4;
    if(bars<ti) break;
    float hA=h11(fi*3.7+uV0.x*30.0), hB=h11(fi*7.1+uV0.y*30.0), hC=h11(fi*2.3+uV0.z*30.0);
    float pr=clamp((bars-ti)/(i==4?3.0:1.15),0.0,1.0); pr=pr*pr*(3.0-2.0*pr);
    float y0=i==4?-0.1:hB*0.45, y1=i==4?1.1:y0+0.45+0.5*hC;
    float x=hA<0.5?uv.x:1.0-uv.x;
    float front=pr*1.12-0.04+0.025*fbmL(vec2(uv.y*5.0,fi),0.3,2);
    float edgeN=0.02*fbmL(vec2(uv.x*4.0,fi*3.0),0.3,2);
    float inBand=smoothstep(y0-0.015+edgeN,y0+0.015+edgeN,uv.y)*smoothstep(y1+0.015+edgeN,y1-0.015+edgeN,uv.y);
    float swept=smoothstep(front+0.004,front-0.004,x)*inBand;
    float st=0.6*fbmL(vec2(uv.x*0.9+fi*5.0,uv.y*22.0+fi*3.0),0.2,3)+0.4*fbmL(vec2(uv.x*0.35,uv.y*6.0+fi),0.2,2)+0.12*fbmL(vec2(uv.x*1.5,uv.y*90.0+fi),0.15,1);
    float skip=fbmL(vec2(uv.x*1.6+fi,uv.y*3.5),0.25,2);
    float thr=(i==4?-0.8:-0.12+0.25*uChaos)+0.45*skip;
    float cov=smoothstep(thr-0.12,thr+0.08,st)*swept;
    vec3 c=i==3?uAcc:i==4?uGround:PAL(i);
    float smear=smoothstep(0.0,0.6,st-thr)*(1.0-smoothstep(0.6,1.0,st-thr));
    c=mix(c,mix(col,PAL(int(mod(fi+1.0,3.0))),0.3),0.35*smear*(i==4?0.0:1.0));
    cov*=i==4?1.0:(0.75+0.25*smoothstep(-0.2,0.4,st));
    float ridge=exp(-pow((x-front)*140.0,2.0))*inBand*(1.0-step(0.999,pr));
    col=mix(col,c,cov);
    h=mix(h,0.25+0.35*st+0.08*fbmL(vec2(uv.x*2.0,uv.y*120.0),0.1,1),cov)+ridge*0.5;
  }
  col=lit(col,h,0.6);
  o=vec4(col*uW,1.0);
}`;

  // RASGADO: carteles superpuestos que se arrancan hasta el muro; borde de fibra blanca y sombra del papel; el ECO pega uno nuevo
  SP.rasgado = `
out vec4 o;
uniform float uBar;
float tear(vec2 p, float k, float grow){
  vec2 an=vec2(h11(k*3.1+uV0.x*20.0)-0.5,h11(k*5.3+uV0.y*20.0)-0.5)*vec2(1.1,0.6);
  float d=length((p-an)*vec2(1.0,1.2+0.7*h11(k*9.0)));
  float n=fbmL(p*2.0+k*7.0,0.25,3)*0.34+fbmL(p*16.0+k,0.2,2)*0.05;
  return grow-(d+n);
}
vec3 poster(vec2 p, int k){
  float fk=float(k);
  vec3 base=k==0?uGround:PAL(k-1), ink2=PAL(int(mod(fk+1.0,3.0)));
  vec2 c=vec2(h11(fk*4.4+uV1.x*9.0)-0.5,h11(fk*6.6+uV1.y*9.0)-0.5)*0.8;
  vec2 d=abs(p-c)-vec2(0.15+0.35*h11(fk*2.2+uV1.z),0.06+0.22*h11(fk*8.8+uV1.w));
  float blk=1.0-smoothstep(-0.002,0.002,max(d.x,d.y));
  vec2 g=gl_FragCoord.xy*(1080.0/uRes.y)/6.0;
  float dots=1.0-smoothstep(0.24,0.3,length(fract(rot(0.4)*g)-0.5)/(0.35+0.65*smoothstep(-0.4,0.4,p.x-c.x)));
  float band=step(0.5,h11(fk*1.3))*(1.0-smoothstep(0.025,0.03,abs(p.y-c.y+0.22)));
  vec3 r=mix(base,ink2,blk*(0.82+0.18*dots));
  r=mix(r,ink2,band*0.9);
  return r*(0.97+0.03*fbmL(p*30.0+fk,0.1,1));
}
void main(){
  vec2 q=screenP(), p=frameP(), uv=gl_FragCoord.xy/uRes;
  float bars=uT/uBar;
  vec3 col=uDark>0.5?vec3(0.012):mix(uGround,vec3(0.12),0.75); // el muro
  col*=0.85+0.15*fbmL(p*4.0,0.2,2);
  float paste=bars>=12.0?smoothstep(12.0,15.5,bars):0.0;
  float h=0.0;
  for(int k=3;k>=0;k--){
    float fk=float(k);
    float t0=1.0+fk*2.4;
    float grow=clamp((bars-t0)/5.5,0.0,1.0)*(0.35+0.3*uDen)+(bars>=8.0?0.18*smoothstep(8.0,8.4,bars):0.0)+uKick*0.006;
    grow*=1.0-fk*0.18;
    float e=bars<t0?-1.0:tear(p,fk,grow);
    if(k==0 && 1.0-uv.y<paste*1.12) e=-1.0;
    float present=1.0-smoothstep(-0.002,0.002,e);
    float fiber=smoothstep(-0.018,-0.004,e+fbmL(p*40.0+fk,0.1,1)*0.006)*present;
    float shadow=(1.0-smoothstep(0.0,0.03,e))*(1.0-present);
    col*=1.0-0.35*shadow;
    vec3 pc=poster(p,k);
    pc=mix(pc,vec3(0.96,0.94,0.9),fiber*0.92);
    col=mix(col,pc,present);
    h=mix(h,0.2+fiber*0.6,present);
  }
  col=lit(col,h,0.08);
  o=vec4(col*uW,1.0);
}`;

  // VELADURA: capas de color translúcido sobre papel (multiplican), con chorreos, recortes y una línea a lápiz
  SP.veladura = `
out vec4 o;
uniform float uBar;
void main(){
  vec2 q=screenP(), p=frameP();
  float bars=uT/uBar;
  float dry=bars>=12.0?smoothstep(12.0,15.6,bars):0.0;
  vec3 paperC=ground(q), col=paperC;
  for(int i=0;i<6;i++){
    float fi=float(i), ti=i==5?8.0:0.3+fi*1.4;
    if(bars<ti) break;
    float grow=smoothstep(ti,ti+0.9,bars);
    float hA=h11(fi*2.9+uV0.x*30.0), hB=h11(fi*6.1+uV0.y*30.0), hC=h11(fi*8.3+uV0.z*30.0);
    vec2 c=vec2((hA-0.5)*0.9,(hB-0.5)*0.4);
    vec2 hs=vec2(0.18+0.3*hC,0.22+0.25*hB)*(0.6+0.4*grow);
    vec2 d=abs(p-c)-hs;
    float n=fbmL(p*3.5+fi*5.0,0.3,3)*0.05;
    float sd=max(d.x,d.y)+n;
    float area=1.0-smoothstep(-0.006,0.006,sd);
    float edge=exp(-pow(sd*60.0,2.0))*area*0.6;                  // el pigmento se acumula en el borde
    float gran=0.7+0.3*fbmL(p*18.0+fi,0.2,2);
    // chorreos desde el borde inferior
    float cw=22.0+10.0*hC, col_x=floor((p.x-c.x)*cw+fbmL(vec2(p.y*3.0,fi),0.2,1)*0.6); float hx=h11(col_x*1.7+fi*13.0);
    float dl=(0.03+0.4*hx*hx*hx)*smoothstep(ti+0.3,ti+3.5,bars);
    float yb=c.y-hs.y+n, dx=abs(fract((p.x-c.x)*cw+fbmL(vec2(p.y*3.0,fi),0.2,1)*0.6)-0.5);
    float wd=(0.06+0.12*hx)*(1.0-0.5*clamp((yb-p.y)/max(dl,1e-3),0.0,1.0));
    float drip=step(0.78,hx)*(1.0-smoothstep(wd,wd+0.06,dx))*smoothstep(yb+0.01,yb-0.005,p.y)*smoothstep(yb-dl-0.004,yb-dl+0.004,p.y)*step(abs(p.x-c.x),hs.x);
    float bulb=0.0;
    float a=clamp((area*(0.55+0.3*gran)+edge+drip*0.7+bulb*0.8)*grow,0.0,1.0)*(i==5?0.95:0.75);
    vec3 tint=i==5?uAcc:PAL(int(mod(fi,3.0)));
    col*=mix(vec3(1.0),tint,a);
  }
  // recortes de papel (collage) con líneas impresas
  for(int j=0;j<2;j++){ float fj=float(j);
    if(bars<2.5+fj*3.0) break;
    vec2 c=vec2(h11(fj*4.1+uV1.x*9.0)-0.5,h11(fj*7.7+uV1.y*9.0)-0.5)*vec2(0.9,0.5);
    vec2 d=abs(rot(0.12*(fj-0.5))*(p-c))-vec2(0.07,0.1);
    float sq=1.0-smoothstep(-0.001,0.001,max(d.x,d.y));
    float lines=step(0.55,fract((p.y-c.y)*90.0))*0.25*step(abs(p.x-c.x+0.01),0.05);
    col=mix(col,paperC*(1.0-lines),sq*0.85*smoothstep(2.5+fj*3.0,3.0+fj*3.0,bars));
  }
  // una línea a lápiz que recorre la hoja
  float lx=p.x*1.3, ly=0.18*fbmL(vec2(lx*1.2,3.0),0.3,3)+0.15*sin(lx*2.0+uV0.w*6.0)-0.05;
  float ld=abs(p.y-ly)*uRes.y;
  float pencil=(1.0-smoothstep(0.6,1.8,ld))*step(lx,(bars-2.0)/5.0*2.6-1.3)*(0.5+0.5*h12(floor(gl_FragCoord.xy*0.5)));
  col=mix(col,PAL(2)*0.45,pencil*0.75);
  col=mix(col,paperC,dry*0.92);
  o=vec4(col*uW,1.0);
}`;

  // VELO: campos de color que respiran sobre su fondo; uno en el acento
  SP.velo = `
out vec4 o;
float field(vec2 q, vec2 c, vec2 hs, float soft, float seed){
  vec2 d=abs(q-c)-hs;
  float n=fbmL(q*3.0+seed,0.35,3)*0.035+fbmL(q*14.0+seed,0.3,2)*0.008;
  float sd=length(max(d,0.0))+min(max(d.x,d.y),0.0)+n;
  return 1.0-smoothstep(-soft,soft,sd);
}
void main(){
  vec2 q=screenP();
  float A=uRes.x/uRes.y, wdt=min(0.36*A,0.62)*(0.85+0.2*uV0.x);
  int NF=2+int(uV0.y*1.99);
  float gap=0.03+0.02*uImpact+0.01*uKick, H=0.78, y=H*0.5;
  vec3 col=ground(q);
  for(int i=0;i<3;i++){ if(i>=NF) break; float fi=float(i);
    float hh=(H-gap*float(NF-1))*(i==0?(0.38+0.25*uV1.x):(NF==2?1.0-(0.38+0.25*uV1.x):(i==1?0.4:0.6-0.25*uV1.x)));
    vec2 c=vec2(uOff.x*0.2,y-hh*0.5); y-=hh+gap;
    float soft=0.035+0.03*uChaos;
    float f=field(q,c,vec2(wdt,hh*0.5),soft,fi*7.0+uV0.z*9.0);
    float core=field(q,c,vec2(wdt,hh*0.5)*0.82,soft*2.5,fi*7.0+uV0.z*9.0+3.0);
    float halo=field(q,c,vec2(wdt,hh*0.5),soft*6.0,fi*5.0)*(1.0-f);
    float inner=0.72+0.28*fbmL(q*1.2+vec2(fi*3.0,0.0),0.4,3)+0.05*fbmL(vec2(q.x*2.0,q.y*60.0)+fi,0.3,2);
    bool hot=(i==int(uV0.w*float(NF)));
    vec3 tone;
    if(uDark>0.5) tone=hot?uAcc*(0.05+0.05*uEnergy):vec3(1.0,0.9,0.82)*(0.012+0.01*uEnergy+0.006*fi);
    else tone=hot?uAcc:PAL(i);
    float lum=(0.78+0.35*core)*(1.0+uKick*0.08+uBass*0.06)*(0.9+0.12*uEnergy);
    col=mix(col,tone*inner*lum,f*0.94);
    col=mix(col,tone,halo*0.18);
    col+=(hot?uAcc:vec3(1.0))*core*uMetal*(uDark>0.5?0.05:0.03);
  }
  o=vec4(col*uW,1.0);
}`;

  // CORTE: lienzo de un color que se abre; dentro, vacío y una luz que solo aparece en la ruptura; el ECO lo cierra
  SP.corte = `
out vec4 o;
uniform float uBar;
void main(){
  vec2 q=screenP(), p=frameP();
  float bars=uT/uBar;
  float heal=bars>=12.0?smoothstep(12.0,15.5,bars):0.0;
  float h=0.0, inside=0.0, glow=0.0;
  for(int i=0;i<5;i++){ float fi=float(i), ti=i==4?8.0:1.0+fi*1.7;
    if(bars<ti) break;
    float hA=h11(fi*3.3+uV0.x*30.0), hB=h11(fi*5.9+uV0.y*30.0);
    float big=i==4?1.0:0.0;
    vec2 c=vec2((fi-1.5)*0.16+(hA-0.5)*0.06+(big>0.5?0.04:0.0),(hB-0.5)*0.12);
    float ang=0.18+(hB-0.5)*0.16;
    vec2 l=rot(ang)*(p-c);
    float L=0.18+0.18*h11(fi*7.1)+0.12*big;
    float u=l.y/L;
    if(abs(u)>1.2) continue;
    float open=smoothstep(ti,ti+0.35,bars)*(1.0-heal)*(1.0+uKick*0.05);
    float w=open*(0.01+0.016*big+0.006*h11(fi))*pow(max(0.0,1.0-u*u),0.65);
    float v=abs(l.x);
    inside=max(inside,1.0-smoothstep(w*0.8,w,v));
    h+=-0.9*exp(-v/(w*3.5+0.006))*max(0.0,1.0-u*u)*open+0.25*exp(-pow((v-w*1.1)/(w*0.6+0.002),2.0))*open;
    glow=max(glow,exp(-v/(w*0.35+0.001))*(1.0-smoothstep(w*0.5,w,v))*max(0.0,1.0-u*u));
  }
  vec3 canvas=lit(ground(q),h,0.05);
  vec3 col=mix(canvas,vec3(0.004),inside);
  col+=uAcc*glow*inside*(0.04+uImpact*0.5+uMetal*0.12)*(bars>=8.0&&bars<12.0?1.0:0.3);
  o=vec4(col*uW,1.0);
}`;

  // VERTIDO: pintura derramada en vetas con celdas; brillo de pintura mojada; el ECO lo cubre otro vertido del fondo
  SP.vertido = `
out vec4 o;
uniform float uBar;
void main(){
  vec2 q=screenP(), p=frameP()*0.9;
  float bars=uT/uBar;
  float r=0.12+1.15*smoothstep(0.2,9.0,bars);
  float cover=bars>=12.0?smoothstep(12.0,15.6,bars):0.0;
  vec2 w=vec2(fbmL(p*0.6,0.4,3),fbmL(p*0.6+4.0,0.4,3));
  vec2 pw=p+w*(0.8+0.6*uChaos+0.25*uBass);
  vec2 w2=vec2(fbmL(pw*1.6+9.0,0.4,3),fbmL(pw*1.6+2.0,0.4,3));
  pw+=w2*0.35;
  float f=fbmL(pw*0.9,0.45,4)+length(p)*0.5;
  float x=f*(7.0+3.0*uDen);
  float id=floor(x), fr=fract(x);
  int ci=int(mod(id,4.0));
  vec3 c=ci==3?uGround*0.9+0.1*PAL(0):PAL(ci);
  float lace=1.0-smoothstep(0.0,max(fwidth(x),1e-4)*1.4,min(fr,1.0-fr));
  float cn=fbmL(pw*26.0,0.2,2); float cells=smoothstep(0.3,0.36,cn)*step(1.5,mod(id,4.0))*step(mod(id,4.0),2.5);
  float cellRim=(smoothstep(0.26,0.3,cn)-smoothstep(0.3,0.34,cn))*step(1.5,mod(id,4.0))*step(mod(id,4.0),2.5);
  c=mix(c,PAL(2),cells*0.85); c=mix(c,vec3(1.0),cellRim*0.6);
  c=mix(c,uDark>0.5?vec3(0.9):vec3(1.0),lace*0.75);
  c=mix(c,uAcc,lace*uMetal*0.6);
  float d=length(p*vec2(0.9,1.1))+0.06*fbmL(p*3.0,0.3,2);
  float inPour=1.0-smoothstep(r-0.01,r+0.01,d);
  float inCover=1.0-smoothstep(1.4*(1.0-cover)-0.01,1.4*(1.0-cover)+0.01,1.6-d);
  vec3 g=ground(q);
  vec3 col=mix(g,c,inPour);
  col=mix(col,g,inCover*step(0.001,cover));
  col=lit(col,(f*0.6+lace*0.1)*inPour*(1.0-inCover),0.9);
  o=vec4(col*uW,1.0);
}`;

  SP.isobara = `
out vec4 o;
void main(){
  vec2 q=screenP(), p=frameP()*(1.0-uKick*0.045);
  vec2 w=vec2(fbmL(p*0.9+uV0.xy*10.0,0.55,3), fbmL(p*0.9+uV0.zw*10.0+5.2,0.55,3));
  vec2 pw=p+w*(0.45+0.6*uChaos+0.35*uBass);
  float f=fbmL(pw*1.25+uV1.xy*7.0,0.75,4);
  float x=f*(12.0+16.0*uDen);
  float fw=max(fwidth(x),1e-4);
  float dd=0.5-abs(fract(x)-0.5);
  float line=1.0-smoothstep(0.0,fw*(1.1+1.6*uKick),dd);
  float lvl=floor(x+0.5);
  float major=1.0-step(0.5,mod(lvl,5.0));
  float m=smoothstep(-0.12,0.5,fbmL(p*0.5+3.1,0.45,2)+(uEnergy-0.5)*0.7)*compMask(q);
  float sel=step(0.88,h11(lvl*1.73+uMetalN*13.1));
  vec3 col;
  if(uDark>0.5){
    col=ground(q)+INK*line*m*(0.1+0.42*uEnergy+major*0.55*(0.4+uEnergy));
    col+=uAcc*line*sel*uMetal*3.6*(0.35+m)+INK*line*m*uKick*0.55+uAcc*line*m*uImpact*2.2;
  } else {
    // grafito sobre papel: presión que cambia y grano del papel que se come la línea
    float press=0.45+0.55*fbmL(p*2.0+lvl*0.37,0.3,2);
    float grain=0.55+0.45*h12(floor(gl_FragCoord.xy*0.7));
    float a=clamp(line*m*grain*(0.75+0.4*uEnergy+major*0.5)*(0.8+press)*1.3,0.0,1.0);
    col=mix(ground(q),vec3(0.07,0.07,0.08),a);
    col=mix(col,uAcc,clamp(line*sel*m*uMetal*1.2,0.0,1.0)*0.9);
  }
  o=vec4(col*uW,1.0);
}`;

  // LACA: superficie negra trabajada a pincel; la luz solo existe en las crestas de los surcos
  SP.laca = `
out vec4 o;
float groove(vec2 d, float bi){
  return fbmL(vec2(d.x*0.55+bi*3.1, d.y*34.0+bi*11.0),0.35,3)+0.35*sin(d.y*170.0+fbmL(vec2(d.x*0.3,bi),0.3,2)*6.0);
}
void main(){
  vec2 q=screenP(), p=frameP();
  float nb=3.0+floor(uDen*4.0);
  float yy=p.y*nb*0.9+fbmL(vec2(p.x*0.6,3.0),0.3,2)*0.6;
  float bi=floor(yy), bf=fract(yy);
  float ang=(h11(bi+uV0.x*20.0)-0.5)*(0.25+0.5*uChaos);
  vec2 d=rot(ang)*p;
  float e=0.0025;
  float h=groove(d,bi), h2=groove(d+vec2(0.0,e),bi);
  vec3 n=normalize(vec3(0.0,-(h2-h)/e*0.006,1.0));
  n.xy=rot(-ang)*n.xy;
  float la=uPhase+uV1.x*6.0;
  vec3 L=normalize(vec3(cos(la)*0.8,sin(la)*0.5+0.3,0.55)), V=vec3(0.0,0.0,1.0);
  vec3 Hv=normalize(L+V), H2=normalize(normalize(vec3(-0.35,0.75,0.6))+V); float sp=pow(max(dot(n,Hv),0.0),70.0)*1.6+pow(max(dot(n,Hv),0.0),8.0)*0.05+pow(max(dot(n,H2),0.0),90.0)*0.45;
  float seam=smoothstep(0.0,0.06,bf)*smoothstep(1.0,0.94,bf);
  float m=compMask(q)*seam*smoothstep(-0.6,0.2,fbmL(p*0.4+5.0,0.3,2)+(uEnergy-0.5)*0.6);
  vec3 col=ground(q)*0.7+vec3(0.9,0.93,1.0)*sp*(0.35+1.1*uEnergy)*m;
  col*=1.0+uKick*0.3;
  float pick=step(0.8,fract(h11(bi*7.7)+max(uMetalN,0.0)*0.618));
  col+=uAcc*sp*pick*uMetal*2.4*m;
  col+=uAcc*sp*uImpact*1.8*m;
  o=vec4(col*uW,1.0);
}`;

  SP.lente = `
out vec4 o;
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float map(vec3 p){
  float d=1e9;
  if(uVar==3||uVar==1){
    vec3 r=p; r.xz=rot(r.y*(1.2+uChaos)+uPhase)*r.xz; vec3 b=abs(r)-vec3(0.42,0.9,0.42);
    d=length(max(b,0.0))+min(max(b.x,max(b.y,b.z)),0.0)-0.12-uKick*0.03;
  } else {
    int NB=3+int(uDen*2.0+0.5);
    for(int i=0;i<5;i++){ if(i>=NB) break; float fi=float(i);
      vec3 c=vec3(cos(uPhase+fi*1.7+uV0.x*6.0)*0.6, sin(uPhase*float(1+i%2)+fi*2.3)*0.38, sin(uPhase+fi*1.1+uV0.y*6.0)*0.45);
      d=smin(d,length(p-c)-(0.36+0.14*fract(fi*0.37+uV0.z)+uKick*0.05),0.32+0.25*uChaos);
    }
  }
  d+=0.03*(0.35+uBass+uChaos)*sin(p.x*9.0+uPhase*2.0)*sin(p.y*8.0-uPhase)*sin(p.z*10.0+uPhase*3.0);
  return d;
}
vec3 nrm(vec3 p){ const vec2 e=vec2(0.0015,-0.0015);
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx)); }
void main(){
  vec2 q=screenP(); vec2 sp=rot(uRot*0.4)*q;
  float ca=uPhase+uV0.w*6.0;
  vec3 ro=vec3(sin(ca)*0.6,0.2+0.12*cos(ca),3.9)/(0.75+0.3*uZoom);
  vec3 ta=vec3(uOff*0.5,0.0), fw=normalize(ta-ro), rt=normalize(cross(fw,vec3(0,1,0))), up=cross(rt,fw);
  vec3 rd=normalize(fw*1.7+rt*sp.x+up*sp.y);
  float t=0.0, d=1.0; int it=0;
  for(int i=0;i<84;i++){ d=map(ro+rd*t); if(d<0.0012||t>7.0) break; t+=d*0.9; it=i; }
  vec3 col=vec3(0.0);
  if(t<7.0){
    vec3 p=ro+rd*t, n=nrm(p), v=-rd, r=reflect(rd,n);
    float fr=pow(1.0-max(dot(n,v),0.0),4.0);
    float strip=exp(-pow((r.y-0.48-0.12*sin(uPhase))*15.0,2.0))*smoothstep(-0.6,0.5,r.x+0.2);
    float strip2=exp(-pow((r.x+0.55+0.1*cos(uPhase))*16.0,2.0))*smoothstep(-0.3,0.6,r.y+0.3);
    float spec=pow(max(dot(r,normalize(vec3(0.6,0.7,0.4))),0.0),90.0);
    float ao=clamp(1.0-float(it)/90.0,0.0,1.0);
    col=INK*(strip*(0.7+1.1*uEnergy)*(0.2+fr)+spec*0.9+fr*0.035)*ao;
    col+=INK*strip*uKick*0.8;
    col+=mix(PAL(1),uAcc,clamp(uMetal+uImpact,0.0,1.0))*strip2*(0.25+uMetal*2.0+uImpact*2.0)*(0.3+fr);
    col+=uAcc*fr*uImpact*2.5;
    col+=INK*0.004;
  }
  // suelo negro que refleja una banda tenue
  if(rd.y<0.0){ float tp=(-0.95-ro.y)/rd.y; if(tp>0.0&&(tp<t||t>=7.0)){ vec3 pp=ro+rd*tp; col+=INK*0.03*exp(-length(pp.xz)*0.9)*(0.4+uEnergy)+uAcc*0.04*uMetal*exp(-length(pp.xz)*1.4); } }
  col=ground(q)*(t<7.0?0.0:1.0)+col*compMask(q*0.8);
  o=vec4(col*uW,1.0);
}`;

  SP.fondo = `
out vec4 o;
void main(){ o=vec4(ground(screenP())*uW,1.0); }`;

  // POLVO: partículas (gl.POINTS), una forma que casi se deshace
  const POLVO_VS = `
out vec3 vC; out float vA;
vec3 knot(float s){ return vec3((2.0+cos(3.0*s))*cos(2.0*s),(2.0+cos(3.0*s))*sin(2.0*s),-sin(3.0*s)*1.4)*0.3; }
float hu(uint x){ x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; x^=x>>16; return float(x)/4294967295.0; }
vec3 liss(float s){ return vec3(sin(2.0*s),sin(3.0*s+0.5),sin(5.0*s)*0.7)*0.82; }
void main(){
  float fid=float(gl_VertexID);
  float u=hu(uint(gl_VertexID)*2u+1u), v=hu(uint(gl_VertexID)*2u+7919u);
  vec3 pos, n;
  int var=uVar%3;
  if(var==0){ float th=TAU*u, ph=acos(1.0-2.0*v); n=vec3(sin(ph)*cos(th),cos(ph),sin(ph)*sin(th)); pos=n*0.82; }
  else { float s=v*TAU; vec3 c=var==1?knot(s):liss(s), c2=var==1?knot(s+0.01):liss(s+0.01);
    vec3 T=normalize(c2-c), B=normalize(cross(T,vec3(0.3,0.2,1.0))), N=cross(B,T);
    float th=TAU*u;
    if(var==1){ n=cos(th)*B+sin(th)*N; pos=c+n*0.12; } else { n=N; pos=c+B*(u*2.0-1.0)*0.2; } }
  float a=uPhase;
  float nz=snoise(vec4(pos*1.7+uV0.xyz*5.0+vec3(uDrift*0.09,0.0,0.55*cos(a)),0.55*sin(a)+uDrift*0.04));
  float hs=hu(uint(gl_VertexID)+104729u);
  pos+=n*nz*(0.14+0.3*uChaos+0.22*uBass);
  pos+=n*uKick*0.1*hs*hs*hs+n*uImpact*0.5*hs*hs;
  pos.xz=rot(uPhase+uV0.w*6.28)*pos.xz; pos.yz=rot(0.35+uRot*0.3)*pos.yz;
  vec3 cp=pos; cp.z+=2.6/(0.75+0.4*uZoom);
  float f=1.75;
  gl_Position=vec4(cp.x*f/cp.z/uAspect+uOff.x*0.4, cp.y*f/cp.z+uOff.y*0.3, 0.0, 1.0);
  float depth=smoothstep(3.6,1.6,cp.z);
  gl_PointSize=max(1.0,(1.2+1.6*depth)*uRes.y/1080.0);
  float yb=fract(max(uMetalN,0.0)*0.618)*1.5-0.75;
  float slab=exp(-pow((pos.y-yb)*12.0,2.0))*uMetal;
  float spark=step(0.985,hs)*uTick*2.0;
  vec3 pig=hs<0.55?INK:hs<0.82?PAL(1)*1.4:PAL(2)*1.4;
  vC=mix(pig,uAcc*2.4,clamp(slab*1.4+uImpact*0.6,0.0,1.0));
  vA=(0.05+0.2*uEnergy+spark)*(0.35+depth)*(1.0+uKick*0.8)*(0.7+0.6*hs);
}`;
  const POLVO_FS = `
in vec3 vC; in float vA; out vec4 o;
void main(){ vec2 c=gl_PointCoord-0.5; float f=exp(-dot(c,c)*9.0); o=vec4(vC*vA*f*uW,1.0); }`;

  // CONTRAPUNTO: una sola línea de luz del acento, en sección áurea. Crece con la tensión, se parte en la ruptura.
  const CONTRA = `
uniform vec4 uC; // x: posición (0–1), y: horizontal (0/1), z: aparición, w: corte
out vec4 o;
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float along=uC.y>0.5?uv.x:uv.y, across=uC.y>0.5?uv.y:uv.x, px=uC.y>0.5?uRes.y:uRes.x;
  float d=abs(across-uC.x)*px;
  float len=uC.z;                       // de 0 a 1: cuánto de la línea existe
  float c0=0.5-len*0.5, c1=0.5+len*0.5;
  float seg=smoothstep(c0,c0+0.02,along)*smoothstep(c1,c1-0.02,along);
  float gap=1.0-smoothstep(0.0,0.012,abs(along-0.5+0.08*sin(uMetalN))-uC.w*0.09); // la ruptura abre un hueco
  float core=exp(-d*d*0.9), halo=exp(-d*0.18)*0.18;
  float flick=0.82+0.18*sin(along*40.0+uPhase*8.0);
  float cut=mix(1.0,gap,clamp(uC.w,0.0,1.0));
  if(uLight>0.5||uDark<0.5){
    float a=clamp((1.0-smoothstep(0.6,1.6,d))*seg*cut,0.0,1.0)*0.95;
    o=vec4(uAcc*a*uW,a*uW);
  } else {
    vec3 col=uAcc*(core*1.6+halo)*seg*cut*flick*(0.6+uMetal*0.9+uImpact*1.2);
    col+=INK*core*seg*uKick*0.25;
    o=vec4(col*uW,0.0);
  }
}`;

  // ---------- post ----------
  const DOWN = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 uv=gl_FragCoord.xy*uTexel*2.0; vec2 h=uTexel*0.5;
  vec3 s=texture(uTex,uv).rgb*4.0+texture(uTex,uv-h).rgb+texture(uTex,uv+h).rgb+texture(uTex,uv+vec2(h.x,-h.y)).rgb+texture(uTex,uv-vec2(h.x,-h.y)).rgb;
  o=vec4(s/8.0,1.0); }`;
  const UP = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform vec2 uTexel, uOut; uniform float uMix; out vec4 o;
void main(){ vec2 uv=gl_FragCoord.xy/uOut; vec2 h=uTexel*0.5;
  vec3 s=texture(uTex,uv+vec2(-h.x*2.0,0)).rgb+texture(uTex,uv+vec2(-h.x,h.y)).rgb*2.0+texture(uTex,uv+vec2(0,h.y*2.0)).rgb+texture(uTex,uv+vec2(h.x,h.y)).rgb*2.0
        +texture(uTex,uv+vec2(h.x*2.0,0)).rgb+texture(uTex,uv+vec2(h.x,-h.y)).rgb*2.0+texture(uTex,uv+vec2(0,-h.y*2.0)).rgb+texture(uTex,uv+vec2(-h.x,-h.y)).rgb*2.0;
  o=vec4(s/12.0*uMix,1.0); }`;
  const FINAL = `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom, uSting; uniform vec2 uOut; uniform float uBloomAmt, uFlash, uStingA, uFade, uGrain, uScan, uCA, uFrame, uTone, uVig; uniform vec3 uFlashC;
out vec4 o;
float hh(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv=gl_FragCoord.xy/uOut, dc=uv-0.5; float ca=uCA*dot(dc,dc);
  vec3 c=vec3(texture(uScene,uv-dc*ca).r, texture(uScene,uv).g, texture(uScene,uv+dc*ca).b);
  c+=texture(uBloom,uv).rgb*uBloomAmt;
  c+=uFlashC*uFlash*0.22;
  c*=uFade;
  if(uTone<0.5) c=1.0-exp(-c*1.18);
  else c=mix(c,0.85+0.15*(1.0-exp(-(c-0.85)/0.15)),step(0.85,c));   // color fiel, solo un hombro arriba
  c*=1.0-uVig*pow(clamp(length(dc*vec2(1.0,1.12))*1.3,0.0,1.0),2.4);
  c*=1.0-uScan*(0.5+0.5*sin(gl_FragCoord.y*3.14159));
  float lum=dot(c,vec3(0.3,0.59,0.11));
  float g=hh(gl_FragCoord.xy+mod(uFrame,64.0)*vec2(17.0,31.0))-0.5;
  c+=g*(uGrain*0.03*(1.0-0.85*smoothstep(0.15,0.8,lum))+1.0/255.0);
  if(uStingA>0.0){ vec4 s=texture(uSting,vec2(uv.x,1.0-uv.y)); c=c*(1.0-s.a*uStingA)+s.rgb*s.a*uStingA; }
  o=vec4(max(c,0.0),1.0);
}`;

  function Engine(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Este navegador no tiene WebGL2.');
    this.gl = gl; this.canvas = canvas;
    this.half = !gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.vao = gl.createVertexArray();
    this.progs = {};
    this.scale = 0.75; this.frame = 0;
    this.post = { down: this.prog(FS_VERT, DOWN), up: this.prog(FS_VERT, UP), fin: this.prog(FS_VERT, FINAL) };
    this.sting = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sting);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    this.texParams(gl.LINEAR);
    this.size = [0, 0];
  }
  const E = Engine.prototype;
  E.texParams = function (f) {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  E.prog = function (vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s); console.error(log, src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
        throw new Error('Shader: ' + log);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  };
  E.species = function (id) {
    if (this.progs[id]) return this.progs[id];
    if (id === 'contra') return (this.progs[id] = this.prog(FS_VERT, HEAD + FRAG + CONTRA));
    if (id === 'fondo') return (this.progs[id] = this.prog(FS_VERT, HEAD + FRAG + SP.fondo));
    if (id === 'polvo') {
      const vs = HEAD + POLVO_VS;
      this.progs[id] = this.prog(vs, HEAD + FRAG + POLVO_FS);
    } else this.progs[id] = this.prog(FS_VERT, HEAD + FRAG + SP[id]);
    return this.progs[id];
  };
  // compila todo de antemano (evita el tirón la primera vez que sale una especie)
  E.warm = function () { for (const s of window.SEMILLA.SPECIES) this.species(s.id); this.species('contra'); this.species('fondo'); };
  E.fbo = function (w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    this.texParams(gl.LINEAR);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  };
  E.free = function (f) { if (!f) return; this.gl.deleteFramebuffer(f.fb); this.gl.deleteTexture(f.tex); };
  E.resize = function (w, h, scale) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    scale = Math.max(0.3, Math.min(1, scale || this.scale));
    if (w === this.size[0] && h === this.size[1] && scale === this.scale && this.scene) return;
    this.canvas.width = w; this.canvas.height = h; this.size = [w, h]; this.scale = scale;
    this.free(this.scene); (this.chain || []).forEach((f) => this.free(f));
    const sw = Math.round(w * scale), sh = Math.round(h * scale);
    this.scene = this.fbo(sw, sh);
    this.chain = []; let cw = sw, ch = sh;
    for (let i = 0; i < 6; i++) { cw = Math.max(1, cw >> 1); ch = Math.max(1, ch >> 1); this.chain.push(this.fbo(cw, ch)); }
  };
  function setU(gl, u, P, e, w, extra) {
    const v = P.vis.v, acc = hex(P.accent);
    const f1 = (n, x) => u[n] && gl.uniform1f(u[n], x);
    f1('uT', e.u); f1('uPhase', e.phase); f1('uEnergy', e.energy); f1('uSec', e.sec); f1('uW', w);
    f1('uDen', P.density); f1('uChaos', P.chaos);
    f1('uKick', Math.min(e.kick, 1.6)); f1('uKickN', e.kickN); f1('uKickDt', e.kickDt);
    f1('uMetal', Math.min(e.metal, 1.6)); f1('uMetalN', e.metalN); f1('uMetalDt', Math.min(e.metalDt, 99)); f1('uMetalP', e.metalP);
    f1('uTick', Math.min(e.tick, 1.5)); f1('uBass', Math.min(e.bass, 1.2)); f1('uBassP', e.bassP);
    f1('uImpact', Math.min(e.impact, 1.2)); f1('uImpactDt', Math.min(e.impactDt, 99));
    f1('uZoom', P.vis.zoom); f1('uRot', P.vis.rot); f1('uDrift', extra.uDrift || 0);
    u.uOff && gl.uniform2f(u.uOff, P.vis.off[0], P.vis.off[1]);
    u.uAcc && gl.uniform3f(u.uAcc, acc[0], acc[1], acc[2]);
    u.uV0 && gl.uniform4f(u.uV0, v[0], v[1], v[2], v[3]);
    u.uV1 && gl.uniform4f(u.uV1, v[4], v[5], v[6], v[7]);
    const pal = P.pal, v3 = (n, h) => { if (u[n]) { const c = hex(h); gl.uniform3f(u[n], c[0], c[1], c[2]); } };
    v3('uGround', pal.ground); v3('uP0', pal.ink[0]); v3('uP1', pal.ink[1]); v3('uP2', pal.ink[2]);
    f1('uDark', pal.dark); f1('uLight', P.light);
    u.uMask && gl.uniform1i(u.uMask, P.vis.mask);
    u.uVar && gl.uniform1i(u.uVar, P.vis.variant);
    for (const k in extra) if (k !== 'uDrift') f1(k, extra[k]);
  }
  const hexCache = {};
  function hex(h) {
    if (hexCache[h]) return hexCache[h];
    const n = parseInt(h.slice(1), 16);
    return (hexCache[h] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
  }
  // dónde y cuánto existe el contrapunto en este instante (sale de la partitura)
  function contraOf(P, e) {
    const v = P.vis.v, golden = v[5] < 0.5 ? 0.382 : 0.618, horiz = v[6] < 0.3 ? 1 : 0;
    const bars = e.u / P.bar;
    let grow = Math.min(1, Math.max(0, (bars - 2.5) / 5.5));           // nace en la SEÑAL, crece en la TENSIÓN
    if (bars >= 12) grow *= Math.max(0, 1 - (bars - 12) / 3.6);        // se retira en el ECO
    const cut = bars >= 8 && bars < 12 ? Math.min(1, e.impact * 1.4 + 0.35) : 0;
    return [golden + (v[7] - 0.5) * 0.03, horiz, grow * grow * (0.55 + 0.45 * e.energy), cut];
  }
  E.pointCount = (P) => Math.round(110000 + 160000 * P.density);
  // slots: [{ P, e, w }]  ·  o: { bloom, flash, flashColor, fade, grain, scan, sting (canvas), stingA }
  E.draw = function (slots, o = {}) {
    const gl = this.gl, S = this.scene;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb); gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (const s of slots) {
      if (!s || s.w < 0.002) continue;
      const pr = this.species(s.P.sp.id);
      gl.useProgram(pr.p);
      const N = s.P.sp.id === 'polvo' ? this.pointCount(s.P) : 0;
      gl.uniform2f(pr.u.uRes, S.w, S.h);
      setU(gl, pr.u, s.P, s.e, s.w, { uAspect: S.w / S.h, uN: N, uDrift: o.drift || 0, uBar: s.P.bar });
      if (N) {
        const fp = this.species('fondo'); gl.useProgram(fp.p); gl.uniform2f(fp.u.uRes, S.w, S.h);
        setU(gl, fp.u, s.P, s.e, s.w, { uDrift: o.drift || 0 }); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.useProgram(pr.p); gl.drawArrays(gl.POINTS, 0, N);
      } else gl.drawArrays(gl.TRIANGLES, 0, 3);
      const c = contraOf(s.P, s.e);
      if (c[2] > 0.002) {
        const cp = this.species('contra'); gl.useProgram(cp.p);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform2f(cp.u.uRes, S.w, S.h); setU(gl, cp.u, s.P, s.e, s.w, { uDrift: o.drift || 0 });
        gl.uniform4f(cp.u.uC, c[0], c[1], c[2], c[3]); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.blendFunc(gl.ONE, gl.ONE);
      }
    }
    gl.disable(gl.BLEND);
    // bloom: bajar y subir por la cadena
    const D = this.post.down, U = this.post.up;
    let src = S;
    gl.useProgram(D.p);
    for (const f of this.chain) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.viewport(0, 0, f.w, f.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(D.u.uTex, 0);
      gl.uniform2f(D.u.uTexel, 1 / src.w, 1 / src.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3); src = f;
    }
    gl.useProgram(U.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.chain.length - 1; i > 0; i--) {
      const a = this.chain[i], b = this.chain[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb); gl.viewport(0, 0, b.w, b.h);
      gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(U.u.uTex, 0);
      gl.uniform2f(U.u.uTexel, 1 / a.w, 1 / a.h); gl.uniform2f(U.u.uOut, b.w, b.h); gl.uniform1f(U.u.uMix, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    // final
    const F = this.post.fin;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.useProgram(F.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.uniform1i(F.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.chain[0].tex); gl.uniform1i(F.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.sting); gl.uniform1i(F.u.uSting, 2);
    if (o.sting && o.stingA > 0) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o.sting);
    }
    gl.uniform2f(F.u.uOut, this.size[0], this.size[1]);
    gl.uniform1f(F.u.uBloomAmt, (o.bloomBase ?? 0.32) * (o.bloom ?? 1));
    gl.uniform1f(F.u.uFlash, o.flash || 0);
    const fc = hex(o.flashColor || '#F2F0EA'); gl.uniform3f(F.u.uFlashC, fc[0], fc[1], fc[2]);
    gl.uniform1f(F.u.uStingA, o.stingA || 0);
    gl.uniform1f(F.u.uFade, o.fade ?? 1);
    gl.uniform1f(F.u.uGrain, o.grain ?? 1);
    gl.uniform1f(F.u.uScan, o.scan ?? 0.025);
    gl.uniform1f(F.u.uCA, o.ca ?? 0.012);
    gl.uniform1f(F.u.uTone, o.tone ?? 0); gl.uniform1f(F.u.uVig, o.vig ?? 0.6);
    gl.uniform1f(F.u.uFrame, this.frame++);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  };

  window.SemillaEngine = Engine;
})();
