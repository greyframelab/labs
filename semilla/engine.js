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

  // ---------- OBJETO ----------
  // Una sola familia, infinita: materia negra que gira en el vacío, tocada por una luz que no se ve.
  // La semilla decide la forma, el material, el aparejo de luces, el encuadre y el acento.
  const SP = {};
  SP.objeto = `
out vec4 o;
uniform int uForm, uMat, uRig, uStroke, uShot; uniform float uBar, uShotK, uShotT; uniform vec3 uSC1, uSC2;
vec2 bz(vec2 a,vec2 b,vec2 c,float t){ return mix(mix(a,b,t),mix(b,c,t),t); }
// TRAZOS: la palabra pinta luz sobre la materia negra; cada familia de sentido tiene su gesto.
// Unos trazos pasan por delante del objeto y otros por detrás (los tapa).
vec3 trazos(vec2 q, float bars, float hit){
  if(uStroke==0) return vec3(0.0);
  int N=uStroke==5?9:uStroke==4?7:uStroke==2?4:uStroke==1?6:uStroke==6?8:5;
  float wash=bars>=12.0?smoothstep(12.0,15.6,bars):0.0;
  vec3 acc=vec3(0.0);
  for(int i=0;i<9;i++){ if(i>=N) break;
    float fi=float(i), ti=0.4+fi*(7.2/float(N));
    if(bars<ti) break;
    float dur=uStroke==1?0.22:uStroke==4?1.1:uStroke==2?0.9:0.5;
    float prog=clamp((bars-ti)/dur,0.0,1.0); prog=1.0-pow(1.0-prog,3.0);
    float hA=h11(fi*3.1+uV0.x*41.0), hB=h11(fi*5.7+uV0.y*41.0), hC=h11(fi*9.3+uV0.z*41.0), hD=h11(fi*1.9+uV0.w*41.0);
    vec2 a,b,c; float w, jit=0.0, jf=0.0;
    if(uStroke==1){        // fuego: subidas rápidas y cortantes
      float x=(hA-0.5)*1.1; a=vec2(x,-0.44-0.05*hB); c=a+vec2((hC-0.5)*0.3,0.42+0.38*hD); b=(a+c)*0.5+vec2((hB-0.5)*0.18,0.0); w=0.005+0.012*hD; jit=0.012; jf=22.0;
    } else if(uStroke==2){ // agua: ondas largas
      float y=(fi/float(N)-0.5)*0.55+(hA-0.5)*0.08; a=vec2(-0.98,y); c=vec2(0.98,y+(hB-0.5)*0.12); b=vec2((hC-0.5)*0.4,y+(hD-0.5)*0.28); w=0.003+0.007*hD; jit=0.03; jf=9.0;
    } else if(uStroke==3){ // amor: arcos redondos
      vec2 cc=vec2((hA-0.5)*0.45,(hB-0.5)*0.25); float r=0.16+0.24*hC, th=hD*6.283, dt=1.5+1.7*hA;
      a=cc+r*vec2(cos(th),sin(th)); c=cc+r*vec2(cos(th+dt),sin(th+dt)); b=cc+r/cos(dt*0.5)*vec2(cos(th+dt*0.5),sin(th+dt*0.5)); w=0.006+0.012*hD;
    } else if(uStroke==4){ // miedo: líneas finas que tiemblan
      float x=(hA-0.5)*1.2; a=vec2(x,-0.46+0.2*hB); c=vec2(x+(hC-0.5)*0.3,0.46-0.2*hD); b=(a+c)*0.5; w=0.0016+0.0022*hD; jit=0.009; jf=70.0;
    } else if(uStroke==5){ // caos / máquina: rectas que se cruzan
      a=(vec2(hA,hB)-0.5)*vec2(1.6,0.9); c=a+rot(floor(hC*8.0)*0.785)*vec2(0.45+0.5*hD,0.0); b=(a+c)*0.5; w=0.0025+0.009*hD*hD;
    } else if(uStroke==6){ // luz: rayos desde el centro
      float an=fi/float(N)*6.283+hA*0.5; vec2 dv=vec2(cos(an),sin(an)); a=dv*(0.2+0.06*hC); c=dv*(0.5+0.35*hB); b=(a+c)*0.5; w=0.002+0.005*hC;
    } else {               // tiempo y sin familia: gesto amplio
      float an=(hA-0.5)*2.4; vec2 dv=vec2(cos(an),sin(an)); a=vec2((hB-0.5)*0.8,(hD-0.5)*0.4)-dv*0.35; c=a+dv*(0.5+0.4*hC); b=(a+c)*0.5+vec2(-dv.y,dv.x)*(hD-0.5)*0.3; w=0.008+0.016*hD;
    }
    float best=9.0, bs=0.0; vec2 pr=a;
    for(int k=1;k<=18;k++){
      float tk=float(k)/18.0; if(tk>prog+0.06) break;
      float tt=min(tk,prog); vec2 pk=bz(a,b,c,tt);
      vec2 tg=normalize(bz(a,b,c,min(tt+0.02,1.0))-bz(a,b,c,max(tt-0.02,0.0))+1e-5);
      float wob=uStroke==1?0.6*sin(tt*jf*0.7+fi*3.0+uPhase*6.0)+0.4*sin(tt*jf*1.9-fi+uPhase*11.0):sin(tt*jf+fi*3.0+uPhase*(uStroke==4?40.0:2.0));
      pk+=vec2(-tg.y,tg.x)*jit*wob*(uStroke==1?tt:1.0);   // la llama se abre arriba
      vec2 ab=pk-pr, ap=q-pr; float hh=clamp(dot(ap,ab)/max(dot(ab,ab),1e-7),0.0,1.0);
      float dd=length(q-pr-ab*hh); if(dd<best){ best=dd; bs=(float(k-1)+hh)/18.0; }
      pr=pk;
    }
    float taper=(0.55+0.45*smoothstep(0.0,0.06,bs))*(1.0-0.65*smoothstep(0.55,1.0,bs/max(prog,0.01)));
    float bristle=fbmL(vec2(bs*7.0+fi*3.0,best/max(w,1e-4)*1.5),0.25,2);
    float body=1.0-smoothstep(w*0.55*taper,w*taper+1.0/uRes.y,best);
    float dry=smoothstep(-0.3+0.7*bs,0.25+0.7*bs,bristle+0.3);
    float press=0.45+0.55*fbmL(vec2(bs*5.0+fi*7.0,fi),0.3,2)+0.15*sin(bs*70.0+fi);  // la mano no aprieta igual
    float paint=body*(0.35+0.65*dry)*clamp(press,0.15,1.2);
    float core=1.0-smoothstep(0.0,w*0.32*taper+0.6/uRes.y,best);
    float halo=exp(-best/(w*2.2+0.0015))*0.06;
    float behind=step(0.55,h11(fi*11.3+uV1.w*7.0));
    float occl=behind>0.5?1.0-hit:1.0;
    vec3 sc=mix(uSC1,uSC2,step(0.68,hA));
    float br=(0.4+0.5*uEnergy)*(1.0+uImpact*0.6+uKick*0.12)*(bars>=8.0&&bars<12.0?1.15:1.0);
    vec3 lightc=mix(sc,vec3(1.0,0.97,0.92),core*0.55*press);               // núcleo caliente de luz, borde de color
    acc+=(lightc*paint+sc*halo)*br*occl;
  }
  return acc*(1.0-wash);
}
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float gyr(vec3 p){ return dot(sin(p),cos(p.yzx)); }
vec3 twistY(vec3 p,float k){ float c=cos(k*p.y), s=sin(k*p.y); return vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z); }
float tw(){ return (uV1.x-0.5)*2.0*(0.5+uChaos); }
float map(vec3 p){
  float ph=uPhase;
  p.xz=rot(ph+uV0.w*6.28)*p.xz;
  p.xy=rot(0.22*sin(ph)+uRot*0.25)*p.xy;
  float sc=1.0+uKick*0.025; p/=sc;
  float d;
  if(uForm==0){            // MASA: cuerpos que se funden
    d=1e9; int NB=3+int(uDen*2.0+0.5);
    for(int i=0;i<5;i++){ if(i>=NB) break; float fi=float(i);
      vec3 c=vec3(cos(ph+fi*1.7+uV0.x*6.0)*0.6, sin(ph*float(1+i%2)+fi*2.3)*0.38, sin(ph+fi*1.1+uV0.y*6.0)*0.45);
      d=smin(d,length(p-c)-(0.36+0.14*fract(fi*0.37+uV0.z)),0.32+0.25*uChaos);
    }
  } else if(uForm==1){     // TORSIÓN: un monolito que se retuerce
    d=sdBox(twistY(p,0.9+tw()*1.4+0.25*sin(ph)),vec3(0.36,0.95,0.36))-0.1;
  } else if(uForm==2){     // CONCHA: cáscara calada por una superficie mínima
    float k=4.5+4.0*uDen;
    float s=abs(length(p)-0.82)-0.07;
    float g=abs(gyr(p*k+vec3(0.0,ph,ph*0.0)))/k-(0.03+0.025*uBass+0.02*uChaos);
    d=max(s,g)*0.8;
  } else if(uForm==3){     // PLIEGUE: una lámina gruesa que se dobla
    float w=0.2*sin(p.x*2.6+ph*2.0)+0.13*sin(p.z*3.4-ph)+0.08*sin((p.x+p.z)*6.0+ph*3.0)*(0.3+uChaos);
    d=max(abs(p.y-w)-0.045,sdBox(p,vec3(1.05,0.7,0.62))-0.04)*0.7;
  } else if(uForm==4){     // COLUMNAS: arquitectura que respira
    float cell=0.27, n=floor(2.0+uDen*2.0);
    float id=clamp(floor(p.x/cell+0.5),-n,n); vec3 r=p; r.x-=id*cell;
    float hh=(0.3+0.55*fract(sin(id*12.9+uV0.x*40.0)*43758.5))*(0.8+0.2*sin(ph+id*1.3));
    d=(sdBox(r-vec3(0.0,hh-0.85,0.0),vec3(0.075,hh,0.075+0.05*uV0.y))-0.008)*0.5;
  } else if(uForm==5){     // FRACTURA: un bloque en lonchas que se separan en la ruptura
    float gap=0.015+0.16*uImpact+0.03*uKick, sl=0.26;
    float id=clamp(floor(p.y/sl+0.5),-3.0,3.0); vec3 r=p; r.y-=id*sl;
    r.xz=rot(id*0.12*tw())*r.xz; r.x+=id*gap*0.6*sin(id*2.3+uV0.z*6.0);
    d=sdBox(r,vec3(0.68,sl*0.5-gap*0.5,0.44))-0.012;
    d=max(d,sdBox(p,vec3(1.3,0.95,1.0)))*0.85;
  } else if(uForm==6){     // ESPINA: un cuerpo erizado
    vec3 n=normalize(p);
    float sp=pow(max(0.0,sin(n.x*7.0+ph)*sin(n.y*7.0)*sin(n.z*7.0-ph)),1.6);
    d=(length(p)-0.55-sp*(0.45+0.3*uBass+0.2*uChaos))*0.45;
  } else if(uForm==8){     // RED: una superficie mínima infinita, vista desde dentro
    float k=2.2+1.6*uDen;
    vec3 r=p+vec3(0.0,0.0,uPhase/k*2.0);
    d=(abs(gyr(r*k))/k-(0.05+0.05*uChaos+0.02*uBass))*0.6;
    return d;
  } else if(uForm==9){     // LÁMINAS: estratos de vidrio negro que se desplazan
    float sp=0.32, id=floor(p.y/sp+0.5); vec3 r=p; r.y-=id*sp;
    float hw=fract(sin(id*17.3+uV0.x*31.0)*43758.5);
    r.x+=0.6*sin(id*1.7+uPhase+uV0.y*6.0)+uImpact*0.3*sin(id*3.1);
    r.xz=rot(id*0.22*tw())*r.xz;
    d=sdBox(r,vec3(0.4+1.4*hw,0.025+0.02*uDen,4.0))-0.006;
    return d*0.8;
  } else if(uForm==10){    // FILOS: un bosque de cuchillas
    vec2 cell=vec2(0.5); vec2 id=floor(p.xz/cell+0.5); vec3 r=p; r.xz-=id*cell;
    float hh=fract(sin(dot(id,vec2(12.9,78.2))+uV0.x*40.0)*43758.5);
    r.xz=rot(hh*6.28+uPhase*(hh-0.5))*r.xz;
    float ht=0.3+1.2*hh*(0.85+0.15*sin(uPhase+hh*6.0));
    d=sdBox(r-vec3(0.0,ht-1.0,0.0),vec3(0.14,ht,0.012))-0.003;
    return d*0.4;
  } else {                 // MONOLITO: una losa y una grieta de luz
    vec3 r=p; r.xz=rot(0.3*sin(ph))*r.xz;
    d=sdBox(r,vec3(0.26,1.02,0.1))-0.015;
  }
  d+=0.018*(0.3+uBass+uChaos)*sin(p.x*9.0+ph*2.0)*sin(p.y*8.0-ph)*sin(p.z*10.0+ph*3.0);
  return d*sc;
}
vec3 nrm(vec3 p, float t){ vec2 e=vec2(max(0.00035,0.00018*t),-max(0.00035,0.00018*t));
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx)); }
// oclusión ambiental: cuánto se esconde la materia en sus propios pliegues
float occ(vec3 p, vec3 n){ float o=0.0, w=1.0; for(int i=1;i<=5;i++){ float h=0.02+0.06*float(i); o+=(h-map(p+n*h))*w; w*=0.7; } return clamp(1.0-1.6*o,0.0,1.0); }
// sombra suave de la luz principal
float shadow(vec3 ro, vec3 rd){ float r=1.0, t=0.02; for(int i=0;i<28;i++){ float h=map(ro+rd*t); r=min(r,10.0*h/t); t+=clamp(h,0.02,0.25); if(r<0.01||t>4.0) break; } return clamp(r,0.0,1.0); }
// aparejo de luces leído en una dirección (para la materia y para su reflejo en el suelo)
void rigLight(vec3 p, vec3 r, vec3 n, float fr, float bars, out float key, out float acc){
  key=0.0; acc=0.0;
  if(uRig==0){ key=exp(-pow((r.y-0.48-0.12*sin(uPhase))*15.0,2.0))*smoothstep(-0.6,0.5,r.x+0.2); acc=exp(-pow((r.x+0.55+0.1*cos(uPhase))*16.0,2.0))*smoothstep(-0.3,0.6,r.y+0.3); }
  else if(uRig==1){ float a=acos(clamp(dot(r,normalize(vec3(0.25,0.45,1.0))),-1.0,1.0)); key=exp(-pow((a-0.55)*13.0,2.0)); acc=exp(-pow((acos(clamp(dot(r,normalize(vec3(-0.8,-0.1,0.4))),-1.0,1.0))-0.3)*16.0,2.0)); }
  else if(uRig==2){ float sx=-1.3+2.6*fract(bars*0.5); key=exp(-pow((p.x-sx)*9.0,2.0))*0.9+exp(-pow((r.y-0.6)*10.0,2.0))*0.25; acc=exp(-pow((p.y-(fract(max(uMetalN,0.0)*0.618)*1.6-0.8))*14.0,2.0))*0.8; }
  else { key=pow(fr,1.2)*1.4*smoothstep(-0.2,0.6,dot(n,normalize(vec3(0.2,0.5,-1.0)))+0.4); acc=exp(-pow((r.x+0.5)*14.0,2.0))*0.5; }
}
vec3 shade(vec3 p, vec3 rd, float t, float bars, float lift, bool full){
  vec3 n=nrm(p,t), v=-rd, r=reflect(rd,n);
  float cosv=max(dot(n,v),0.0), fr=pow(1.0-cosv,4.0);
  float F0=uMat==2?0.45:0.04, F=F0+(1.0-F0)*pow(1.0-cosv,5.0);
  float ao=full?occ(p,n):0.8;
  vec3 Ld=normalize(vec3(0.6,0.7,0.4));
  float sh=full&&uMat!=3?mix(0.35,1.0,shadow(p+n*0.01,Ld)):1.0;
  float key, acc; rigLight(p,r,n,fr,bars,key,acc);
  key+=pow(fr,2.2)*0.35+exp(-pow((dot(r,normalize(vec3(-0.7,0.2,0.3)))-0.9)*9.0,2.0))*0.35;   // luz de filo que acompaña a la cámara
  if(uForm>=8) key+=0.55*exp(-t*0.55)*pow(max(dot(n,v),0.0),3.0)+0.3*pow(fr,1.5);           // en los campos, la cámara lleva su propia luz
  float spec=pow(max(dot(r,Ld),0.0),uMat==0?140.0:uMat==1?90.0:60.0)*sh;
  vec3 base;
  if(uMat==0)      base=INK*(key*(0.12+F*1.4)*1.15+spec*1.1+fr*0.03);
  else if(uMat==1) base=INK*(key*(0.18+F*1.1)+spec*0.8+fr*0.025);
  else if(uMat==2) base=mix(INK,uAcc,0.12)*(key*(0.35+0.7*F)*1.3+spec*1.3)+fr*0.02;
  else             base=INK*(pow(fr,1.3)*1.1*(0.5+key)+key*0.12);
  // en la RUPTURA la luz principal se vuelve masa de acento en los planos impares
  float hot=(bars>=8.0&&bars<12.0&&fract(uShotK*13.0)>0.45)?1.0:0.0;
  vec3 col=mix(base,base*uAcc*1.6,hot*0.85)*lift*ao;
  col+=mix(INK,uAcc,hot)*key*uKick*0.55*lift*ao;
  col+=uAcc*acc*(0.1+uMetal*2.2+uImpact*1.8)*(0.3+fr)*ao;
  float vein=exp(-abs(gyr(p*7.0+vec3(uPhase)))*16.0);
  col+=uAcc*vein*(uImpact*1.6+(bars>=8.0&&bars<12.0?0.08:0.0));
  if(uMat==1&&full){ float inside=clamp(-map(p-n*0.07)/0.07,0.0,1.0); col+=uAcc*(1.0-inside)*0.06*uEnergy*uEnergy*(1.0-fr); }
  return col+INK*0.003;
}
void main(){
  vec2 q=screenP(); vec2 sp=rot(uRot*0.3)*q;
  // PLANOS: la cámara corta en seco con el ritmo; casi nunca se ve el cuerpo entero
  float K=uShotK, push=uShotT*0.06;
  vec3 dir=normalize(vec3(cos(K*31.0),0.35*sin(K*17.0),sin(K*31.0)));
  vec3 ro, ta; float lens;
  bool field=uForm>=8;
  if(uShot==1){            // MACRO: la materia tan cerca que deja de ser un objeto
    // apunta a un punto real de la superficie: se busca desde fuera hacia el centro
    vec3 so=dir*2.6+vec3(0.0,(K-0.5)*0.6,0.0), sd=normalize(-so); float st=0.0;
    for(int j=0;j<48;j++){ float dd=map(so+sd*st); if(dd<0.002||st>4.0) break; st+=dd; }
    ta=field?dir:so+sd*min(st,3.0); ro=ta+normalize(dir+vec3(0.3*sin(K*9.0),0.25,0.0))*(field?0.8:0.95-push*2.0); lens=2.4+1.4*fract(K*7.0);
  } else if(uShot==2){     // RASANTE: desde el suelo, a contraluz
    ro=vec3(sin(K*12.0)*2.6,-0.86,cos(K*12.0)*2.6)*(1.0-push); ta=vec3(0.0,-0.25+0.3*fract(K*5.0),0.0); lens=2.2;
  } else if(uShot==3){     // CENITAL: desde arriba, la forma como signo
    ro=vec3(0.3*sin(K*7.0),3.2-push*3.0,0.25); ta=vec3(0.0); lens=1.9+0.8*fract(K*3.0);
  } else {                 // GENERAL
    float ca=uPhase+uV0.w*6.0, dist=(4.1+1.5*uV1.y)/(0.75+0.35*uZoom)-push*2.0;
    ro=vec3(sin(ca)*0.55,0.18+0.14*cos(ca)+0.3*(uV1.z-0.5),dist); ta=vec3(uOff*0.55,0.0); lens=1.5+0.6*uV1.w;
  }
  if(field&&uShot!=3){
    // dentro del campo: busca un hueco abierto y mira a lo largo de él
    ro=vec3(0.15*sin(K*5.0),0.1*cos(K*3.0),0.0);
    for(int j=0;j<10;j++){ if(map(ro)>0.16) break; ro+=vec3(0.13,0.07,0.11)*(1.0+float(j)*0.3); }
    ta=ro+dir; lens=1.05+0.6*fract(K*11.0);
  }
  if(uForm==9&&uShot!=3){ ro.y=(floor(ro.y/0.32)+0.5)*0.32; ta.y=ro.y+(K-0.5)*0.3; }
  for(int j=0;j<6;j++){ float dc=map(ro); if(dc>0.06) break; ro+=normalize(ro-ta+vec3(0.0,0.001,0.0))*0.12; }
  vec3 fw=normalize(ta-ro), rt=normalize(cross(fw,abs(fw.y)>0.95?vec3(0,0,1):vec3(0,1,0))), up=cross(rt,fw);
  vec3 rd=normalize(fw*lens+rt*sp.x+up*sp.y);
  // foco: el macro enfoca el filo que mira y desenfoca todo lo demás (lente larga = poca profundidad)
  float fd=uShot==1?length(ta-ro):uShot==3?length(ro)-0.6:field?1.1+0.8*fract(K*5.0):length(ro-ta)-0.4;
  float dofK=uShot==1?2.2:field?0.9:uShot==2?0.7:0.3;
  float t=0.0, d=1.0, minD=9.0;
  for(int i=0;i<128;i++){ d=map(ro+rd*t); minD=min(minD,d); if(d<0.0004*t+0.0002||t>9.0) break; t+=d*0.9; }
  float bars=uT/uBar;
  vec3 col=vec3(0.0);
  float lift=0.55+0.8*uEnergy;                // la SEÑAL en penumbra (visible en proyección), la RUPTURA a plena luz
  if(t<9.0) col=shade(ro+rd*t,rd,t,bars,lift,true);
  col+=uAcc*exp(-minD*9.0)*(t>=9.0?1.0:0.0)*(uRig==3?0.16+uImpact*0.3:0.02)*(0.5+uEnergy);
  if(uForm>=8) col=mix(col,uAcc*(0.004+0.045*uEnergy*uEnergy+0.1*uImpact),1.0-exp(-min(t,9.0)*0.22));   // bruma de profundidad: se lee el túnel
  // suelo negro pulido: refleja de verdad la materia, cada vez más difuso con la distancia
  if(rd.y<0.0&&uForm<8){ float tp=(-1.0-ro.y)/rd.y; if(tp>0.0&&(tp<t||t>=9.0)){
    vec3 pp=ro+rd*tp, rr=reflect(rd,vec3(0.0,1.0,0.0));
    float tr=0.02, dr=1.0; for(int i=0;i<56;i++){ dr=map(pp+rr*tr); if(dr<0.002||tr>5.0) break; tr+=dr; }
    float fade=exp(-length(pp.xz)*0.7);
    float Fr=0.03+0.5*pow(1.0-max(dot(-rd,vec3(0.0,1.0,0.0)),0.0),5.0);
    if(tr<5.0) col+=shade(pp+rr*tr,rr,tr,bars,lift,false)*Fr*fade*exp(-tr*0.9)*0.9;
    col+=INK*0.02*fade*(0.4+uEnergy)+uAcc*0.03*uMetal*fade; } }
  col*=compMask(q*0.8);
  col+=trazos(q,bars,t<9.0?1.0:0.0);
  float tt=min(t,9.0), coc=clamp(abs(tt-fd)/max(tt,0.35)*dofK,0.0,1.0);
  o=vec4(col*uW,coc*uW);
}`;

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
uniform sampler2D uScene, uBloom, uSting; uniform vec2 uOut; uniform float uBloomAmt, uFlash, uStingA, uFade, uGrain, uScan, uCA, uFrame, uTone, uVig, uDof; uniform vec3 uFlashC;
out vec4 o;
float hh(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv=gl_FragCoord.xy/uOut, dc=uv-0.5; float ca=uCA*dot(dc,dc);
  vec2 px=1.0/vec2(textureSize(uScene,0));
  vec2 op=1.0/uOut;
  // supermuestreo: si la escena es mayor que la pantalla, se reduce con 4 muestras
  vec3 c=texture(uScene,uv).rgb;
  if(px.x<op.x*0.9) c=0.25*(texture(uScene,uv+op*vec2(-0.25,-0.25)).rgb+texture(uScene,uv+op*vec2(0.25,-0.25)).rgb+texture(uScene,uv+op*vec2(-0.25,0.25)).rgb+texture(uScene,uv+op*vec2(0.25,0.25)).rgb);
  // FXAA: suaviza los bordes en diagonal sin perder definición
  vec2 sp2=max(px,op);
  vec3 rNW=texture(uScene,uv+vec2(-1.0,-1.0)*sp2).rgb, rNE=texture(uScene,uv+vec2(1.0,-1.0)*sp2).rgb, rSW=texture(uScene,uv+vec2(-1.0,1.0)*sp2).rgb, rSE=texture(uScene,uv+vec2(1.0,1.0)*sp2).rgb;
  vec3 LW=vec3(0.299,0.587,0.114);
  float lNW=dot(1.0-exp(-rNW),LW), lNE=dot(1.0-exp(-rNE),LW), lSW=dot(1.0-exp(-rSW),LW), lSE=dot(1.0-exp(-rSE),LW), lM=dot(1.0-exp(-c),LW);
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))), lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  if(lMax-lMin>max(0.02,lMax*0.1)){
    vec2 dr=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
    float red=max((lNW+lNE+lSW+lSE)*0.03125,1.0/128.0), rcp=1.0/(min(abs(dr.x),abs(dr.y))+red);
    dr=clamp(dr*rcp,-8.0,8.0)*sp2;
    vec3 rA=0.5*(texture(uScene,uv+dr*(1.0/3.0-0.5)).rgb+texture(uScene,uv+dr*(2.0/3.0-0.5)).rgb);
    vec3 rB=rA*0.5+0.25*(texture(uScene,uv-dr*0.5).rgb+texture(uScene,uv+dr*0.5).rgb);
    float lB=dot(1.0-exp(-rB),LW);
    c=(lB<lMin||lB>lMax)?rA:rB;
  }
  // aberración cromática muy leve en los bordes del cuadro
  c.r=mix(c.r,texture(uScene,uv-dc*ca).r,0.5); c.b=mix(c.b,texture(uScene,uv+dc*ca).b,0.5);
  vec3 nb=(texture(uScene,uv+vec2(sp2.x,0)).rgb+texture(uScene,uv-vec2(sp2.x,0)).rgb+texture(uScene,uv+vec2(0,sp2.y)).rgb+texture(uScene,uv-vec2(0,sp2.y)).rgb)*0.25;
  c=max(c+(c-nb)*0.22,0.0);   // enfoque fino: define bordes y reflejos sin halos
  // profundidad de campo: disco de bokeh (espiral áurea); lo desenfocado no invade lo enfocado
  float coc=texture(uScene,uv).a;
  if(uDof>0.0&&coc>0.03){
    vec3 acc=vec3(0.0); float ws=0.0; float R=coc*uDof;
    for(int i=0;i<28;i++){ float fi=float(i); float a=fi*2.39996; float r=sqrt((fi+0.5)/28.0)*R;
      vec2 o=vec2(cos(a),sin(a))*r*vec2(uOut.y/uOut.x,1.0);
      vec4 sm=texture(uScene,uv+o); float w=smoothstep(r/max(uDof,1e-4)*0.8,r/max(uDof,1e-4)*0.8+0.15,sm.a)+0.04;
      w*=1.0+2.0*smoothstep(0.6,1.6,dot(sm.rgb,vec3(0.3,0.59,0.11)));   // los brillos pesan más: bokeh
      acc+=sm.rgb*w; ws+=w; }
    c=mix(c,acc/max(ws,1e-4),smoothstep(0.05,0.3,coc));
  }
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
    this.scale = 1.0; this.frame = 0;
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
    this.progs[id] = this.prog(FS_VERT, HEAD + FRAG + SP[id]);
    return this.progs[id];
  };
  // compila todo de antemano (evita el tirón la primera vez que sale una especie)
  E.warm = function () { this.species('objeto'); this.species('contra'); };
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
    scale = Math.max(0.5, Math.min(1.5, scale || this.scale));
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
  function shotOf(P, e) { const s = window.SEMILLA.shotAt(P, e.u / P.bar); return [s.type, s.K, s.since]; }
  // dónde y cuánto existe el contrapunto en este instante (sale de la partitura)
  function contraOf(P, e) {
    const v = P.vis.v, golden = v[5] < 0.5 ? 0.382 : 0.618, horiz = v[6] < 0.3 ? 1 : 0;
    const bars = e.u / P.bar;
    let grow = Math.min(1, Math.max(0, (bars - 2.5) / 5.5));           // nace en la SEÑAL, crece en la TENSIÓN
    if (bars >= 12) grow *= Math.max(0, 1 - (bars - 12) / 3.6);        // se retira en el ECO
    const cut = bars >= 8 && bars < 12 ? Math.min(1, e.impact * 1.4 + 0.35) : 0;
    const on = v[4] < 0.35 ? 1 : 0;   // solo algunas piezas lo llevan
    return [golden + (v[7] - 0.5) * 0.03, horiz, on * grow * grow * (0.55 + 0.45 * e.energy), cut];
  }
  // slots: [{ P, e, w }]  ·  o: { bloom, flash, flashColor, fade, grain, scan, sting (canvas), stingA }
  E.draw = function (slots, o = {}) {
    const gl = this.gl, S = this.scene;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb); gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);   // alfa = desenfoque (0 = foco)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (const s of slots) {
      if (!s || s.w < 0.002) continue;
      const pr = this.species('objeto');
      gl.useProgram(pr.p);
      gl.uniform2f(pr.u.uRes, S.w, S.h);
      setU(gl, pr.u, s.P, s.e, s.w, { uDrift: o.drift || 0, uBar: s.P.bar });
      gl.uniform1i(pr.u.uForm, s.P.sp.form); gl.uniform1i(pr.u.uMat, s.P.vis.mat); gl.uniform1i(pr.u.uRig, s.P.vis.rig);
      const sh = shotOf(s.P, s.e); gl.uniform1i(pr.u.uShot, sh[0]); gl.uniform1f(pr.u.uShotK, sh[1]); gl.uniform1f(pr.u.uShotT, sh[2]);
      const st = s.P.stroke, c1 = hex(st.c1), c2 = hex(st.c2);
      gl.uniform1i(pr.u.uStroke, st.style); gl.uniform3f(pr.u.uSC1, c1[0], c1[1], c1[2]); gl.uniform3f(pr.u.uSC2, c2[0], c2[1], c2[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    gl.uniform1f(F.u.uTone, o.tone ?? 0); gl.uniform1f(F.u.uVig, o.vig ?? 0.6); gl.uniform1f(F.u.uDof, o.dof ?? 0.02);
    gl.uniform1f(F.u.uFrame, this.frame++);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  };

  window.SemillaEngine = Engine;
})();
