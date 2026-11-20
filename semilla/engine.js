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
// uQ: calidad (1 alta, 0 ligera para ordenadores modestos)
// uComp: composición (solo, espejo, anillo, constelación) · uSurf: superficie
uniform int uMat, uRig, uStroke, uShot, uFam, uComp, uSurf; uniform float uQ; uniform float uBar, uShotK, uShotT; uniform vec3 uSC1, uSC2;
// LA PALABRA COMPILÁNDOSE: un atlas con las letras de la palabra (fila de arriba) y glifos de código (fila de abajo),
// como campo de distancias. Cada hueco de letra muestra glifos que cambian con el pulso y se fija en su letra en el ECO.
uniform sampler2D uWord; uniform vec4 uWH;   // semiancho, semialto, rango, fondo (mundo)
uniform vec4 uAt;                             // columnas del atlas, nº de glifos, ancho de celda (mundo), alto de celda (mundo)
uniform vec2 uWL; uniform vec2 uAim[8];       // nº de letras · paso; puntos de letra a los que apuntan los macros
float hh2(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uV0.z*17.0)*43758.5453); }
// qué muestra el hueco i ahora: su letra (fijada) o un glifo de código
float slotGlyph(float i, float bars){
  float lock=11.3+i*0.16;                                     // en el ECO se fija letra a letra, de izquierda a derecha
  if(bars>=lock&&bars<15.7) return -1.0;
  if(bars<1.4+i*0.09) return -1.0;                             // al nacer, la palabra se ve entera (justo después de decirla); luego se abstrae
  float rate=(bars>=8.0&&bars<12.0)?8.0:bars>=4.0?4.0:2.0;     // compila más deprisa con la tensión y en la ruptura
  float k=floor(uT/uBar*rate+hh2(vec2(i,3.1))*3.0);
  if(hh2(vec2(i,k))<0.18) return -2.0;                        // a veces el hueco parpadea vacío (dato que aún no llega)
  return floor(hh2(vec2(i*7.1,k))*uAt.y);
}
// distancia 2D a lo que muestra la palabra (positiva fuera)
float wordD(vec2 xy, float bars){
  float cw=uAt.z, n=uWL.x, W=n*cw*0.5;
  vec2 b=abs(xy)-vec2(W,uAt.w*0.5); float box=length(max(b,0.0));
  float i=clamp(floor((xy.x+W)/cw),0.0,n-1.0);
  vec2 lc=vec2((xy.x+W)/cw-i, 0.5-xy.y/uAt.w);              // coordenadas dentro de la celda (0–1)
  lc=clamp(lc,0.0,1.0);
  float g=slotGlyph(i,bars);
  if(g<-1.5) return max(box,0.0)+uWH.z;                      // hueco vacío
  vec2 cell=g<-0.5?vec2(i,0.0):vec2(g,1.0);
  vec2 uv=vec2((cell.x+lc.x)/uAt.x,(cell.y+lc.y)*0.5);
  float inner=(texture(uWord,uv).r-0.5)*2.0*uWH.z;
  return box>0.0?box+max(inner,0.0):inner;
}
vec2 bz(vec2 a,vec2 b,vec2 c,float t){ return mix(mix(a,b,t),mix(b,c,t),t); }
// TRAZOS: la palabra pinta luz sobre la materia negra; cada familia de sentido tiene su gesto.
// Unos trazos pasan por delante del objeto y otros por detrás (los tapa).
vec3 trazos(vec2 q, float bars, float hit){
  if(uStroke==0) return vec3(0.0);
  int N=uStroke==5?7:uStroke==4?6:uStroke==2?4:uStroke==1?5:uStroke==6?7:4;   // a medias: acompañan a la materia sin competir
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
    w=max(w*0.8,1.6/uRes.y); float best=9.0, bs=0.0; vec2 pr=a;
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
    float bristle=fbmL(vec2(bs*5.0+fi*3.0,best/max(w,1e-4)*1.2),0.25,2);
    float body=1.0-smoothstep(w*0.55*taper,w*taper+1.0/uRes.y,best);
    float dry=smoothstep(-0.15+0.7*bs,0.3+0.7*bs,bristle+0.2);   // pincel seco: el trazo se abre en cerdas
    dry=mix(1.0,dry,smoothstep(3.0,8.0,w*uRes.y));                   // en trazos finos, sin cerdas: si no, salen píxeles sueltos
    float press=0.55+0.45*fbmL(vec2(bs*5.0+fi*7.0,fi),0.3,2);  // la mano no aprieta igual
    float paint=body*(0.35+0.65*dry)*clamp(press,0.15,1.2);
    float core=1.0-smoothstep(0.0,w*0.32*taper+0.6/uRes.y,best);
    float halo=exp(-best/(w*2.2+0.0015))*0.035;
    float behind=step(0.45,h11(fi*11.3+uV1.w*7.0));   // algo más de la mitad pasan por detrás de la materia
    float occl=behind>0.5?1.0-hit:1.0;
    vec3 sc=mix(uSC1,uSC2,step(0.68,hA));
    float br=0.7*(0.4+0.5*uEnergy)*(1.0+uImpact*0.6+uKick*0.12)*(bars>=8.0&&bars<12.0?1.15:1.0);
    vec3 lightc=mix(sc,vec3(1.0,0.97,0.92),core*0.35*press);   // menos núcleo blanco: más pigmento que neón               // núcleo caliente de luz, borde de color
    acc+=(lightc*paint+sc*halo)*br*occl;
  }
  return acc*(1.0-wash);
}
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float gyr(vec3 p){ return dot(sin(p),cos(p.yzx)); }
vec3 twistY(vec3 p,float k){ float c=cos(k*p.y), s=sin(k*p.y); return vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z); }
float tw(){ return (uV1.x-0.5)*2.0*(0.5+uChaos); }
float bars0(){ return uT/uBar; }
float map(vec3 p){
  float ph=uPhase;
  if(uFam==7){ float k=uPhase*4.0; ph=(floor(k)+smoothstep(0.82,1.0,fract(k)))/4.0; }   // MÁQUINA: gira a pasos exactos
  if(uForm==11){ float straight=1.0-0.85*smoothstep(11.0,12.5,uT/uBar);   // en el ECO la palabra se endereza para leerse entera
    p.xz=rot((0.45*sin(ph*0.7)+(uV0.w-0.5)*0.7)*straight)*p.xz; p.xy=rot((0.08*sin(ph)+uRot*0.12)*straight)*p.xy; }
  else { p.xz=rot(ph+uV0.w*6.28)*p.xz; p.xy=rot(0.22*sin(ph)+uRot*0.25)*p.xy; }
  float sc=1.0+uKick*0.025+(uFam==10?0.05*uBass:0.0); p/=sc;
  float bars=uT/uBar, lip=1.0;
  if(uFam==6){ float id=floor(p.y/0.11+0.5); p.x+=0.09*sin(id*2.1+ph*(1.0+fract(id*0.37)))*(0.4+uEnergy); lip=0.55; }   // TIEMPO: estratos que se deslizan
  // CAOS: la materia se parte en bloques que se separan con la ruptura
  vec3 cid=vec3(0.0), cpo=p; float cz=2.4;
  if(uFam==9){ cid=floor(p*cz); vec3 hh=fract(sin(cid*vec3(12.9898,78.233,37.719)+uV0.x*9.0)*43758.5453);
    float ex=0.02+0.14*uChaos*smoothstep(4.0,8.0,bars)*(1.0-smoothstep(12.0,15.5,bars))+0.35*uImpact;
    p-=(hh-0.5)*ex; lip=0.5; }
  // COMPOSICIÓN: la misma forma, multiplicada de cuatro maneras (la variedad y la complejidad salen de aquí)
  float cs=1.0;
  if(uForm<8&&uComp==1){        // ESPEJO: plegada sobre sí misma, simetría de caleidoscopio
    for(int k=0;k<3;k++){ p=abs(p); p.xz=rot(0.55+uV1.y*0.9+0.08*sin(ph))*p.xz; p.xy=rot(0.35+uV1.z*0.7)*p.xy; p-=vec3(0.18,0.1,0.12)*(0.6+uChaos); }
    cs=0.72; p/=cs;
  } else if(uForm<8&&uComp==2){ // ANILLO: copias en corona, la cámara las ve girar
    float N=5.0+floor(uV1.x*5.0), sec=6.2832/N, a=atan(p.z,p.x)+ph*0.2;
    a=mod(a+sec*0.5,sec)-sec*0.5; float rr=length(p.xz); p.xz=rr*vec2(cos(a),sin(a)); p.x-=1.15;
    cs=0.42; p/=cs; p.xz=rot(ph*0.7)*p.xz;
  } else if(uForm<8&&uComp==3){ // CONSTELACIÓN: varias piezas a distinta escala y giro, suspendidas
    vec2 c=vec2(1.25,1.0); vec2 id=clamp(floor(p.xy/c+0.5),vec2(-1.0,-1.0),vec2(1.0,1.0)); p.xy-=id*c;
    float hc=fract(sin(dot(id,vec2(41.3,17.7))+uV0.y*9.0)*43758.5);
    p.z+=(hc-0.5)*1.4; p.xz=rot(hc*6.28+ph*(hc-0.5))*p.xz; p.yz=rot(hc*3.1)*p.yz;
    cs=0.3+0.18*hc; p/=cs;
  }
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
  } else if(uForm==11){    // PALABRA: la palabra compilándose en materia, en láminas de escaneo
    float eco=max(smoothstep(11.0,12.6,bars)*(1.0-smoothstep(15.2,15.9,bars)),1.0-smoothstep(1.4,2.6,bars));   // ordenada al nacer y en el ECO
    vec3 r=p; r.yz=rot((r.x*0.12*tw()+0.06*sin(ph))*(1.0-0.9*eco))*r.yz;
    // láminas: la letra se construye en cortes horizontales, como una impresora 3D o un escáner; cada lámina
    // va desplazada en profundidad (datos que aún no encajan) y todas se alinean en el ECO
    float sh=uAt.w/15.0, sid=floor(r.y/sh), li=floor((r.x+uWL.x*uAt.z*0.5)/uAt.z);
    float hs=hh2(vec2(sid,li+0.5));
    // DISPERSIÓN: en la tensión y la ruptura las láminas se separan (abstracción); en el ECO se recogen y la palabra se lee
    float scat=(0.04+0.24*smoothstep(1.0,7.5,bars)+0.3*uImpact+0.04*uKick)*(1.0-eco);
    r.z-=(hs-0.5)*scat; r.x+=(hh2(vec2(sid*1.7,li))-0.5)*scat*0.7*step(0.62,hs);   // algunas láminas se corren de lado (glitch)
    // ESTELA DE DATOS: en la tensión cada lámina se alarga hacia atrás como un flujo; en el ECO se recoge en una placa
    float trail=(0.15*smoothstep(1.5,4.0,bars)+0.9*smoothstep(4.0,7.5,bars)+0.4*uImpact)*(1.0-eco)*(0.25+hs);
    float d2=wordD(r.xy,bars); vec2 w=vec2(d2,abs(r.z+trail*0.5)-(uWH.w+trail*0.5));
    d=min(max(w.x,w.y),0.0)+length(max(w,0.0))-0.002;
    float g=(0.5-abs(fract(r.y/sh)-0.5))*sh-0.0035*(1.0-0.6*eco);   // ranura fina entre láminas
    d=max(d,-g)*0.6;
  } else {                 // MONOLITO: una losa y una grieta de luz
    vec3 r=p; r.xz=rot(0.3*sin(ph))*r.xz;
    d=sdBox(r,vec3(0.26,1.02,0.1))-0.015;
  }
  if(uFam!=8&&uForm!=11) d+=0.018*(0.3+uBass+uChaos)*sin(p.x*9.0+ph*2.0)*sin(p.y*8.0-ph)*sin(p.z*10.0+ph*3.0);
  // SUPERFICIE: talla fina sobre la piel (solo cerca de la superficie): ranuras, paneles o perforaciones
  if(uSurf==1&&uForm!=11){ float k=14.0+10.0*uV1.w; vec3 q=p*k; float g=min(0.5-abs(fract(q.y)-0.5),0.5-abs(fract(q.x+q.z*0.5)-0.5))/k-0.0025; d=max(d,min(-g,d+0.012)); }
  else if(uSurf==2&&uForm!=11){ float k=6.0+5.0*uV1.w; vec3 f=abs(fract(p*k)-0.5); float g=(0.5-max(f.x,max(f.y,f.z)))/k-0.003; d=max(d,min(-g,d+0.02)); }
  else if(uSurf==3&&uForm!=11){ float k=9.0+6.0*uV1.w; vec3 f=fract(p*k)-0.5; float hl=(length(f)-0.28)/k; d=max(d,min(-hl,d+0.03)); }
  d*=cs; if(uComp==3&&uForm<8) d*=0.7;
  if(uFam==1) d+=(0.008+0.006*uBass)*sin(length(p.xz)*17.0-uT*2.6)+0.022*sin(p.x*2.7+uT*0.9)*sin(p.z*2.1-uT*0.6);   // AGUA: la superficie es líquida
  if(uFam==10) d-=0.03*(0.5+0.5*sin(p.x*5.0+ph*2.0)*sin(p.y*6.0-ph)*sin(p.z*5.0+ph))*(0.4+uBass*0.8+uEnergy*0.5);   // VIDA: brota
  if(uFam==3){ // AMOR: un segundo cuerpo se acerca y se funde con el primero
    float k=smoothstep(0.5,9.0,bars)*(1.0-0.35*smoothstep(12.0,15.6,bars));
    vec3 c=vec3(cos(ph*0.8)*(2.1-1.6*k),0.25*sin(ph*1.3),sin(ph*0.8)*(1.2-0.9*k));
    d=smin(d,length(p-c)-(0.34+0.06*uBass),0.18+0.4*k);
  }
  if(uFam==2){ float cr=abs(gyr(p*5.5+vec3(0.0,uT*0.2,0.0)))/5.5-0.005; d=max(d,min(-cr,d+0.05)); }   // FUEGO: grietas
  if(uFam==7){ float g=(0.5-abs(fract(p.y*9.0)-0.5))/9.0-0.004; d=max(d,min(-g,d+0.035)); }        // MÁQUINA: ranuras exactas
  if(uFam==9){ vec3 f=abs(fract(cpo*cz)-0.5); float gap=0.012+0.05*uImpact+0.03*uChaos*smoothstep(4.0,8.0,bars)*(1.0-smoothstep(12.0,15.5,bars));
    float bd=(0.5-max(f.x,max(f.y,f.z)))/cz; d=max(d,gap-bd); }
  return d*sc*lip;
}
vec3 nrm(vec3 p, float t){ vec2 e=vec2(max(0.00035,0.00018*t),-max(0.00035,0.00018*t));
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx)+vec3(0.0,1e-6,0.0)); }
// oclusión ambiental: cuánto se esconde la materia en sus propios pliegues
float occ(vec3 p, vec3 n){ float o=0.0, w=1.0; for(int i=1;i<=3;i++){ float h=0.03+0.1*float(i); o+=(h-map(p+n*h))*w; w*=0.7; } return clamp(1.0-1.6*o,0.0,1.0); }
// sombra suave de la luz principal
float shadow(vec3 ro, vec3 rd){ float r=1.0, t=0.03; for(int i=0;i<16;i++){ float h=map(ro+rd*t); r=min(r,10.0*h/t); t+=clamp(h,0.04,0.35); if(r<0.01||t>4.0) break; } return clamp(r,0.0,1.0); }
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
  bool hq=full&&uQ>0.5;
  float ao=hq?occ(p,n):0.8;
  vec3 Ld=normalize(vec3(0.6,0.7,0.4));
  float sh=hq&&uMat!=3?mix(0.35,1.0,shadow(p+n*0.01,Ld)):1.0;
  float key, acc; rigLight(p,r,n,fr,bars,key,acc);
  key+=pow(fr,2.2)*0.35+exp(-pow((dot(r,normalize(vec3(-0.7,0.2,0.3)))-0.9)*9.0,2.0))*0.35;   // luz de filo que acompaña a la cámara
  if(uForm==11){ float eco=max(smoothstep(11.5,12.8,bars)*(1.0-smoothstep(15.0,15.8,bars)),1.0-smoothstep(1.4,2.6,bars)); key+=0.4*pow(fr,1.4)+0.12+0.9*eco*(0.4+pow(fr,0.8));   // la palabra siempre tiene un filo de luz que la dibuja
    float sx=(bars-11.3)/0.16*uAt.z-uWL.x*uAt.z*0.5;   // la letra que se acaba de fijar se enciende un instante
    key+=0.55*exp(-pow((p.x-sx)/(uAt.z*0.7),2.0))*step(11.2,bars)*(1.0-step(13.2,bars)); }
  if(uForm>=8&&uForm<=10) key+=0.55*exp(-t*0.55)*pow(max(dot(n,v),0.0),3.0)+0.3*pow(fr,1.5);           // en los campos, la cámara lleva su propia luz
  float spec=pow(max(dot(r,Ld),0.0),uMat==0?140.0:uMat==1?90.0:60.0)*sh;
  vec3 base;
  if(uMat==0)      base=INK*(key*(0.12+F*1.4)*1.15+spec*1.1+fr*0.03);
  else if(uMat==1) base=INK*(key*(0.18+F*1.1)+spec*0.8+fr*0.025);
  else if(uMat==2) base=mix(INK,uAcc,0.12)*(key*(0.14+0.7*F)*1.2+spec*1.2)+fr*0.02;
  else             base=INK*(pow(fr,1.3)*1.1*(0.5+key)+key*0.12);
  // en la RUPTURA la luz principal se vuelve masa de acento en los planos impares
  float hot=(bars>=8.0&&bars<12.0&&fract(uShotK*13.0)>0.45)?(uFam==2?0.25:1.0):0.0;   // en FUEGO el color ya está en las venas: no se inunda
  vec3 col=mix(base,base*uAcc*1.6,hot*0.6)*lift*ao;
  col+=mix(INK,uAcc,hot)*key*uKick*0.55*lift*ao;
  col+=uAcc*acc*(0.1+uMetal*2.2+uImpact*1.8)*(0.3+fr)*ao;
  float vein=exp(-abs(gyr(p*7.0+vec3(uPhase)))*16.0);
  col+=uAcc*vein*(uImpact*1.6+(bars>=8.0&&bars<12.0?0.08:0.0));
  if(uMat==1&&full){ float inside=clamp(-map(p-n*0.07)/0.07,0.0,1.0); col+=uAcc*(1.0-inside)*0.06*uEnergy*uEnergy*(1.0-fr); }
  if(uFam==2){ float cr=exp(-abs(gyr(p*5.5+vec3(0.0,uT*0.2,0.0)))*26.0);   // FUEGO: venas incandescentes dentro de las grietas
    col+=mix(uAcc,vec3(1.0,0.82,0.55),cr*cr*0.6)*cr*(0.18+1.1*uEnergy+2.2*uImpact)*(0.85+0.15*sin(uT*19.0+p.y*11.0)); }
  if(uFam==6){ float s=fract(p.y/0.11+0.5); col*=0.7+0.3*step(0.5,fract((p.y/0.11+0.5)*0.5)); col+=uAcc*exp(-min(s,1.0-s)*70.0)*(0.04+0.25*uEnergy*uEnergy)*lift; }
  if(uFam==7){ float sy=mod(bars*0.5,1.0)*2.4-1.2; col+=uAcc*exp(-abs(p.y-sy)*38.0)*(0.25+0.8*uEnergy)*(0.4+fr); }   // MÁQUINA: una lectura que barre
  if(uFam==1) col+=INK*pow(fr,3.0)*0.1*lift;
  // PALABRA: juntas de luz entre láminas, como un circuito encendido por dentro (laten con el bombo)
  if(uForm==11){ float sh=uAt.w/15.0, sy=fract(p.y/sh); float seam=exp(-min(sy,1.0-sy)*sh/0.0012);
    float on=0.25+1.4*uKick+1.6*uImpact+0.6*uEnergy;
    col+=mix(uAcc,vec3(1.0,0.97,0.92),0.2)*seam*on*0.22; }
  return col+INK*0.003;
}
void main(){
  vec2 q=screenP(); vec2 sp=rot(uRot*0.3*(uForm==11?1.0-smoothstep(11.0,12.5,uT/uBar):1.0))*q;   // la palabra del ECO, a nivel
  // PLANOS: la cámara corta en seco con el ritmo; casi nunca se ve el cuerpo entero
  float K=uShotK, push=uShotT*0.06;
  vec3 dir=normalize(vec3(cos(K*31.0),0.35*sin(K*17.0),sin(K*31.0)));
  if(uForm==11) dir=normalize(vec3(dir.x*0.8,dir.y,abs(dir.z)+0.45));   // la palabra se mira de frente: detrás solo hay su estela
  vec3 ro, ta; float lens;
  bool field=uForm>=8&&uForm<=10;
  if(uFam==2) sp+=vec2(0.0025*sin(q.y*55.0+uT*8.0)*(0.3+uEnergy),0.0);   // FUEGO: el aire tiembla de calor
  if(uFam==9&&bars0()>=8.0&&bars0()<12.0) sp+=(vec2(h11(floor(uT*24.0)),h11(floor(uT*24.0)+7.0))-0.5)*0.012*uImpact;
  if(uShot==1){            // MACRO: la materia tan cerca que deja de ser un objeto
    // apunta a un punto real de la superficie: se busca desde fuera hacia el centro
    int ai=int(fract(K*7.3)*8.0); vec2 ap=uAim[0]; for(int j=1;j<8;j++) if(j==ai) ap=uAim[j];
    vec3 aim=uForm==11?vec3(ap,0.0):vec3(0.0);
    vec3 so=aim+dir*2.6+vec3(0.0,(K-0.5)*0.6,0.0), sd=normalize(aim-so); float st=0.0;
    for(int j=0;j<32;j++){ float dd=map(so+sd*st); if(dd<0.002||st>4.0) break; st+=dd; }
    ta=field?dir:uForm==11?aim:so+sd*min(st,3.0); ro=ta+normalize(dir+vec3(0.3*sin(K*9.0),0.25,0.0))*(field?0.8:uForm==11?1.35-push*1.5:(uComp>0?1.7:1.05)-push*2.0); lens=2.4+1.4*fract(K*7.0);   // las composiciones se ven mejor con algo de aire
  } else if(uShot==2){     // RASANTE: desde el suelo, a contraluz
    ro=vec3(sin(K*12.0)*2.6,-0.86,cos(K*12.0)*2.6)*(1.0-push); ta=vec3(0.0,-0.25+0.3*fract(K*5.0),0.0); lens=2.2;
  } else if(uShot==3){     // CENITAL: desde arriba, la forma como signo
    ro=vec3(0.3*sin(K*7.0),3.2-push*3.0,0.25); ta=vec3(0.0); lens=1.9+0.8*fract(K*3.0);
  } else {                 // GENERAL
    float ca=uPhase+uV0.w*6.0, dist=(4.1+1.5*uV1.y)/(0.75+0.35*uZoom)-push*2.0;
    ro=vec3(sin(ca)*0.55,0.18+0.14*cos(ca)+0.3*(uV1.z-0.5),dist); ta=vec3(uOff*0.55,0.0); lens=1.5+0.6*uV1.w;
    if(uForm==11){ ro=vec3(sin(ca)*0.4,0.1+0.1*cos(ca),max(dist,uWH.x*2.6/min(uRes.x/uRes.y,1.8))+0.6-push*1.5); ta=vec3(0.0); lens=1.7; }
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
  float dofK=uShot==1?1.4:field?0.8:uShot==2?0.6:0.3;   // desenfoque contenido: que se lea la materia
  float t=0.0, d=1.0, minD=9.0;
  int maxI=uQ>0.5?100:64;
  // ANTIALIAS DE SILUETA: se guarda dónde el rayo pasó más cerca de la materia, en tamaño de píxel
  float pxA=1.0/(uRes.y*lens), minR=9.0, tMin=0.0;
  for(int i=0;i<128;i++){ if(i>=maxI) break; d=map(ro+rd*t); minD=min(minD,d);
    float ratio=d/(t*pxA*1.2+1e-5); if(ratio<minR&&t>0.05){ minR=ratio; tMin=t; }
    if(d<0.0004*t+0.0002||t>9.0) break; t+=d*(uQ>0.5?0.9:1.0); }
  float bars=uT/uBar;
  vec3 col=vec3(0.0);
  float lift=field?0.9+0.55*uEnergy:0.62+0.7*uEnergy;   // la SEÑAL en penumbra (visible en proyección), la RUPTURA a plena luz
  if(uFam==4&&h11(floor(uT*13.0)+uV0.x*99.0)<0.07+0.1*uEnergy) lift*=0.2;   // MIEDO: la luz falla
  // la materia que llena el cuadro (muy cerca) se oscurece: el negro domina y nada se quema
  float cov=t>=9.0?clamp(1.0-minR,0.0,1.0):0.0;   // el rayo rozó un borde sin tocarlo: cobertura parcial
  if(t<9.0) col=shade(ro+rd*t,rd,t,bars,lift,true)*(field?mix(0.45,1.0,smoothstep(0.15,1.3,t)):mix(0.5,1.0,smoothstep(0.25,2.6,t)));
  if(cov>0.0&&!field) col=mix(col,shade(ro+rd*tMin,rd,tMin,bars,lift,false)*mix(0.5,1.0,smoothstep(0.25,2.6,tMin)),cov);   // bordes suaves, sin dientes de sierra   // la materia pegada a la lente se hunde en negro, no en gris
  col+=uAcc*exp(-minD*9.0)*(t>=9.0?1.0:0.0)*(uRig==3?0.16+uImpact*0.3:0.02)*(0.5+uEnergy);
  if(field) col=mix(col,uAcc*(0.004+0.045*uEnergy*uEnergy+0.1*uImpact),1.0-exp(-min(t,9.0)*0.22));   // bruma de profundidad: se lee el túnel
  // suelo negro pulido: refleja de verdad la materia, cada vez más difuso con la distancia
  if(rd.y<0.0&&!field&&uQ>0.5){ float tp=(-1.0-ro.y)/rd.y; if(tp>0.0&&(tp<t||t>=9.0)){
    vec3 pp=ro+rd*tp, rr=reflect(rd,vec3(0.0,1.0,0.0));
    float tr=0.02, dr=1.0; for(int i=0;i<32;i++){ dr=map(pp+rr*tr); if(dr<0.002||tr>5.0) break; tr+=dr; }
    float fade=exp(-length(pp.xz)*0.7);
    float Fr=0.03+0.5*pow(1.0-max(dot(-rd,vec3(0.0,1.0,0.0)),0.0),5.0);
    if(tr<5.0) col+=shade(pp+rr*tr,rr,tr,bars,lift,false)*Fr*fade*exp(-tr*0.9)*0.9;
    col+=INK*0.02*fade*(0.4+uEnergy)+uAcc*0.03*uMetal*fade; } }
  // LUZ: haces volumétricos que atraviesan los huecos de la materia
  if(uFam==5){ vec3 L=normalize(vec3(0.45,0.85,0.25)), a1=normalize(cross(L,vec3(0.0,0.0,1.0))), a2=cross(L,a1);
    float bm=0.0, tm=min(t,7.0), jt=h11(dot(q,vec2(91.7,47.3))+uT);
    int nb=uQ>0.5?12:6;
    for(int i=0;i<22;i++){ if(i>=nb) break; float tt=(float(i)+jt)*tm/float(nb); vec3 pp=ro+rd*tt;
      float sl=smoothstep(0.55,1.0,sin(dot(pp,a1)*5.0+uV0.y*6.0)*sin(dot(pp,a2)*3.0+uPhase*0.5));
      if(sl>0.0) bm+=sl*step(0.0,map(pp+L*0.35))*step(0.0,map(pp+L*0.8)); }
    col+=mix(uAcc,vec3(1.0,0.97,0.92),0.35)*bm/float(nb)*tm*0.32*(0.35+uEnergy+uImpact); }
  col*=compMask(q*0.8);
  // MIEDO: la oscuridad se cierra sobre la forma y solo se abre en el ECO
  if(uFam==4){ float cl=mix(1.5,0.5,smoothstep(0.0,11.0,bars)); cl=mix(cl,1.3,smoothstep(12.0,15.0,bars)); col*=1.0-smoothstep(cl-0.55,cl,length(q)); }
  col+=trazos(q,bars,t<9.0?1.0:0.0);
  float tt=min(t,9.0), coc=clamp(abs(tt-fd)/max(tt,0.35)*dofK,0.0,1.0);
  if(any(isnan(col))||any(isinf(col))) col=vec3(0.0);
  { float L=dot(col,vec3(0.3,0.59,0.11)); col*=min(1.0,1.9/(L+1e-4)); }   // techo de luz: ninguna zona se quema (el blanco nunca satura)
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
uniform sampler2D uScene, uBloom, uSting, uBloom2, uGhostT; uniform vec2 uOut; uniform vec3 uAccP; uniform float uStreak, uGlitch, uGSeed, uGhost; uniform float uBloomAmt, uFlash, uStingA, uFade, uGrain, uScan, uCA, uFrame, uTone, uVig, uDof; uniform vec3 uFlashC;
out vec4 o;
float hh(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv=gl_FragCoord.xy/uOut, dc=uv-0.5;
  // GLITCH DE CORTE: unas bandas horizontales se desplazan 2–4 frames en cada corte y en el impacto
  float gsplit=0.0;
  if(uGlitch>0.001){
    float bands=mix(10.0,46.0,hh(vec2(uGSeed,1.0))), b=floor(uv.y*bands);
    float hb=hh(vec2(b,uGSeed*7.0));
    if(hb<0.3*uGlitch){ uv.x+=(hh(vec2(b,uGSeed))-0.5)*0.045*uGlitch; gsplit=uGlitch; }
  }
  float ca=uCA*dot(dc,dc)+gsplit*0.004;
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
  if(lMax-lMin>max(0.012,lMax*0.06)){
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
  c=max(c+(c-nb)*0.1,0.0);   // enfoque fino y suave (más fuerte marcaba los dientes de sierra)
  // profundidad de campo: disco de bokeh (espiral áurea); lo desenfocado no invade lo enfocado
  float coc=texture(uScene,uv).a;
  if(uDof>0.0&&coc>0.03){
    vec3 acc=vec3(0.0); float ws=0.0; float R=coc*uDof;
    for(int i=0;i<16;i++){ float fi=float(i); float a=fi*2.39996; float r=sqrt((fi+0.5)/16.0)*R;
      vec2 o=vec2(cos(a),sin(a))*r*vec2(uOut.y/uOut.x,1.0);
      vec4 sm=texture(uScene,uv+o); float w=smoothstep(r/max(uDof,1e-4)*0.8,r/max(uDof,1e-4)*0.8+0.15,sm.a)+0.04;
      w*=1.0+2.0*smoothstep(0.6,1.6,dot(sm.rgb,vec3(0.3,0.59,0.11)));   // los brillos pesan más: bokeh
      acc+=sm.rgb*w; ws+=w; }
    c=mix(c,acc/max(ws,1e-4),smoothstep(0.05,0.3,coc));
  }
  c+=texture(uBloom,uv).rgb*uBloomAmt;
  if(gsplit>0.0){ vec3 c0=texture(uScene,uv).rgb; c.r+=texture(uScene,uv+vec2(0.005*gsplit,0.0)).r-c0.r; c.b+=texture(uScene,uv-vec2(0.005*gsplit,0.0)).b-c0.b; c=max(c,0.0); }
  // DESTELLO ANAMÓRFICO: los brillos fuertes sueltan una línea horizontal finísima del acento
  if(uStreak>0.0){
    vec3 st=vec3(0.0);
    for(int i=-6;i<=6;i++){ float fi=float(i); vec3 sm=texture(uBloom2,uv+vec2(fi*0.032,0.0)).rgb; st+=max(sm-0.35,0.0)*exp(-abs(fi)*0.44)*2.0; }
    c+=mix(uAccP,vec3(1.0),0.25)*dot(st,vec3(0.3,0.59,0.11))*uStreak*0.09;
  }
  // ECO DE PLANO: el plano anterior se queda un instante como un fantasma sobre el nuevo
  if(uGhost>0.001){ vec3 gh=texture(uGhostT,(uv-0.5)/(1.0+0.03*(1.0-uGhost))+0.5).rgb; c=max(c,gh*uGhost)+gh*uGhost*0.12; }
  c+=uFlashC*uFlash*0.22;
  c*=uFade;
  if(uTone<0.5) c=0.96*(1.0-exp(-c*1.05));   // hombro suave: los brillos conservan detalle
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
    this.par = gl.getExtension('KHR_parallel_shader_compile');
    this.progs = {};
    this.scale = 1.0; this.frame = 0;
    this.post = { down: this.prog(FS_VERT, DOWN, 'down'), up: this.prog(FS_VERT, UP, 'up'), fin: this.prog(FS_VERT, FINAL, 'final') };
    for (const k in this.post) this.finish(this.post[k]);
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
  // PROGRAMAS: se compilan en segundo plano si la GPU lo permite (KHR_parallel_shader_compile) y se terminan al estar listos.
  // Cada FORMA tiene su propio programa, pequeño: en Windows (Direct3D) un shader con todas las formas a la vez
  // tarda mucho en compilar o directamente no enlaza.
  E.prog = function (vs, fs, name = '') {
    const gl = this.gl, mk = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const p = gl.createProgram(), v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    const rec = { p, u: null, v, f, fs, name, ready: false };
    if (!this.par) this.finish(rec);   // sin compilación en paralelo: se termina ya (bloquea)
    return rec;
  };
  // ¿terminó de compilar? (si terminó, comprueba errores y lee los uniformes)
  E.done = function (rec) {
    if (rec.ready) return true;
    if (this.par && !this.gl.getProgramParameter(rec.p, this.par.COMPLETION_STATUS_KHR)) return false;
    this.finish(rec); return true;
  };
  E.finish = function (rec) {
    const gl = this.gl, p = rec.p;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = (gl.getShaderInfoLog(rec.f) || '') + ' ' + (gl.getProgramInfoLog(p) || '');
      console.error('[SEMILLA_GPU_FALLO]', rec.name, log);
      if (!gl.getShaderParameter(rec.f, gl.COMPILE_STATUS)) console.error(rec.fs.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
      const err = new Error('GPU · ' + rec.name + ' · ' + (log.trim() || 'el shader no enlaza en esta tarjeta gráfica')); err.gpu = true; throw err;
    }
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    rec.u = u; rec.ready = true;
  };
  const FORMS = 12;
  // id: 'contra' o 'objeto:<forma>'. Devuelve el programa solo si está listo (si no, lo encarga y devuelve null)
  E.species = function (id) {
    let rec = this.progs[id];
    if (!rec) {
      if (id === 'contra') rec = this.prog(FS_VERT, HEAD + FRAG + CONTRA, id);
      else { const form = +id.split(':')[1] || 0; rec = this.prog(FS_VERT, HEAD.replace('\n', `\n#define uForm ${form}\n`) + FRAG + SP.objeto, id); }
      this.progs[id] = rec;
    }
    return this.done(rec) ? rec : null;
  };
  // prepara todas las formas; onStep(hechas, total) para la pantalla de carga. Resuelve cuando están todas listas.
  E.warm = function (onStep) {
    const ids = ['contra', ...Array.from({ length: FORMS }, (_, i) => 'objeto:' + i)];
    return new Promise((res, rej) => {
      let i = 0;
      const step = () => {
        try {
          if (this.par) { ids.forEach((id) => this.species(id)); }      // en paralelo: se encargan todas a la vez
          else if (i < ids.length) this.species(ids[i++]);             // sin paralelo: una por vuelta, para que la pantalla respire
          const ok = ids.filter((id) => this.progs[id] && this.done(this.progs[id])).length;
          onStep && onStep(ok, ids.length);
          if (ok === ids.length) res(); else setTimeout(step, 16);
        } catch (e) { rej(e); }
      };
      step();
    });
  };
  // LA PALABRA COMO MATERIA: las letras se dibujan en un lienzo y se convierten en un campo de distancias
  // (transformada de distancia exacta, Felzenszwalb) que el shader extruye en 3D.
  function edt1(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (let q = 1; q < n; q++) {
      let s; do { const r = v[k]; s = (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r); } while (s <= z[k] && --k >= 0);
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
  }
  function edt(grid, w, h) {
    const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]); }
    return grid;
  }
  // tipografía de la palabra: la MATRIZ de la máquina (5×7 celdas, ver score.js). Cada celda es un píxel de materia.
  // la transformada de distancia corre en un Worker: al nacer una palabra la imagen no se para ni un frame
  const EDT_SRC = edt1.toString() + '\n' + edt.toString() + `
    onmessage = (m) => { const { key, a, w, h, RANGE } = m.data, N = w * h, out = new Float64Array(N), inn = new Float64Array(N);
      for (let i = 0; i < N; i++) { const on = a[i] > 127; out[i] = on ? 0 : 1e20; inn[i] = on ? 1e20 : 0; }
      edt(out, w, h); edt(inn, w, h); const px = new Uint8Array(N);
      for (let i = 0; i < N; i++) { const sd = out[i] > 0 ? out[i] - 0.5 : -(inn[i] - 0.5); px[i] = Math.max(0, Math.min(255, Math.round((0.5 + sd / (2 * RANGE)) * 255))); }
      postMessage({ key, px }, [px.buffer]); };`;
  let edtWorker = null;
  try { edtWorker = new Worker(URL.createObjectURL(new Blob([EDT_SRC], { type: 'text/javascript' }))); } catch (e) { edtWorker = null; }
  // ATLAS de la palabra: fila 0 = sus letras, fila 1 = glifos de código. Tipografía de la consola (JetBrains Mono).
  const GLYPHS = '/\\<>=+*#{}[]01;%$&@~|';
  const WFS = 150, WRANGE = 30;
  let fontReady = null;
  const fontLoad = () => fontReady || (fontReady = (document.fonts && document.fonts.load ? document.fonts.load(`600 ${WFS}px "JetBrains Mono"`).catch(() => {}) : Promise.resolve()));
  // prepara una palabra (devuelve su ficha si ya está lista; si no, la encarga y devuelve null)
  E.word = function (word) {
    const gl = this.gl, key = String(word || '').toUpperCase().replace(/[^A-ZÑ0-9ÁÉÍÓÚÜ]/g, '') || '·';
    this.words = this.words || new Map();
    const got = this.words.get(key);
    if (got) return got.ready ? got : null;
    const rec = { ready: false, tex: null };
    this.words.set(key, rec);
    if (this.words.size > 4) { const old = this.words.keys().next().value; const o = this.words.get(old); if (o && o.tex) gl.deleteTexture(o.tex); this.words.delete(old); }
    fontLoad().then(() => this.wordBuild(key, rec));
    return null;
  };
  E.wordBuild = function (key, rec) {
    const gl = this.gl, n = Math.max(1, key.length), G = GLYPHS.length;
    const font = `600 ${WFS}px "JetBrains Mono", ui-monospace, monospace`;
    const m = document.createElement('canvas').getContext('2d'); m.font = font;
    const adv = m.measureText('M').width, cw = Math.ceil(adv * 1.55), ch = Math.ceil(WFS * 1.3), cols = Math.max(n, G);
    const w = cols * cw, h = ch * 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.font = font; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < n; i++) x.fillText(key[i], (i + 0.5) * cw, ch * 0.5 + WFS * 0.04);
    for (let g = 0; g < G; g++) x.fillText(GLYPHS[g], (g + 0.5) * cw, ch * 1.5 + WFS * 0.04);
    const rgba = x.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = rgba[i * 4 + 3];
    const wpp = Math.min(0.62 / ch, 3.6 / (n * cw));   // altura fija; las palabras largas se encogen para caber
    const aim = new Float32Array(16);   // los macros apuntan al centro de una letra, nunca a un hueco
    for (let k = 0; k < 8; k++) { const i = Math.floor(((k + 0.5) / 8) * n); aim[k * 2] = ((i + 0.5) - n / 2) * cw * wpp; aim[k * 2 + 1] = ((k % 3) - 1) * WFS * 0.18 * wpp; }
    Object.assign(rec, { w, h, info: [n * cw * wpp / 2, ch * wpp / 2, WRANGE * wpp, ch * wpp], at: [cols, G, cw * wpp, ch * wpp], aim, L: [n, cw * wpp] });
    const upload = (px) => {
      rec.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, rec.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, px); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      this.texParams(gl.LINEAR); gl.activeTexture(gl.TEXTURE0); rec.ready = true;
    };
    if (edtWorker) {
      const onm = (m) => { if (m.data.key !== key) return; edtWorker.removeEventListener('message', onm); upload(m.data.px); };
      const keep = a.slice();   // copia por si el Worker no responde (algunas apps bloquean Workers de blob)
      edtWorker.addEventListener('message', onm); edtWorker.postMessage({ key, a, w, h, RANGE: WRANGE }, [a.buffer]);
      setTimeout(() => { if (!rec.ready) { edtWorker.removeEventListener('message', onm); local(keep); } }, 1500);
    } else local(a);
    function local(a) {
      const N = w * h, out = new Float64Array(N), inn = new Float64Array(N);
      for (let i = 0; i < N; i++) { const on = a[i] > 127; out[i] = on ? 0 : 1e20; inn[i] = on ? 1e20 : 0; }
      edt(out, w, h); edt(inn, w, h); const px = new Uint8Array(N);
      for (let i = 0; i < N; i++) { const sd = out[i] > 0 ? out[i] - 0.5 : -(inn[i] - 0.5); px[i] = Math.max(0, Math.min(255, Math.round((0.5 + sd / (2 * WRANGE)) * 255))); }
      upload(px);
    }
    return null;
  };
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
    this.scene = this.fbo(sw, sh); this.free(this.ghostF); this.ghostF = this.fbo(sw, sh);
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
  const u1i = (gl, l, v) => l && gl.uniform1i(l, v);
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
    // CORTES: al cambiar de plano se guarda el último frame (para el eco) y se dispara el glitch; en el impacto, también
    { const top = slots.filter((x) => x && x.w > 0.5).pop(), nowT = o.now ?? performance.now() / 1000, fx = (this.fx = this.fx || { at: -9, gat: -9 });
      if (top) {
        const sh = window.SEMILLA.shotAt(top.P, top.e.u / top.P.bar), key = top.P.code + ':' + sh.i;
        if (fx.key && key !== fx.key && o.fx !== false) {
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.ghostF.fb);
          gl.blitFramebuffer(0, 0, S.w, S.h, 0, 0, S.w, S.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
          fx.at = nowT; fx.gat = nowT; fx.seed = Math.random() * 100;
        }
        fx.key = key; fx.acc = top.P.accent;
        if (top.e.impactDt < 0.05 && top.e.impact > 0.5 && nowT - fx.gat > 0.3) { fx.gat = nowT; fx.seed = Math.random() * 100; }
      }
      const ga = nowT - fx.gat, ea = nowT - fx.at;
      fx.glitch = o.fx === false ? 0 : ga < 0.085 ? 1 - ga / 0.085 : 0;
      fx.ghost = o.fx === false ? 0 : ea < 0.7 ? 0.55 * Math.pow(1 - ea / 0.7, 2) : 0;
    }
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb); gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);   // alfa = desenfoque (0 = foco)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (const s of slots) {
      if (!s || s.w < 0.002) continue;
      const pr = this.species('objeto:' + s.P.sp.form);
      if (!pr) continue;   // aún compilando esta forma: no se dibuja (nunca bloquea la imagen)
      gl.useProgram(pr.p);
      gl.uniform2f(pr.u.uRes, S.w, S.h);
      setU(gl, pr.u, s.P, s.e, s.w, { uDrift: o.drift || 0, uBar: s.P.bar });
      gl.uniform1i(pr.u.uMat, s.P.vis.mat); gl.uniform1i(pr.u.uRig, s.P.vis.rig);
      u1i(gl, pr.u.uFam, s.P.vis.fam || 0); u1i(gl, pr.u.uComp, s.P.vis.comp || 0); u1i(gl, pr.u.uSurf, s.P.vis.surf || 0); pr.u.uQ && gl.uniform1f(pr.u.uQ, this.quality ?? 1);
      if (!this.blankTex) { this.blankTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.blankTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255])); this.texParams(gl.LINEAR); gl.activeTexture(gl.TEXTURE0); }
      let wtex = this.blankTex;
      if (s.P.sp.form === 11) {
        const wr = this.word(s.P.word || s.P.code);
        if (wr) { // la mayoría, teselas finas casi planas; algunas piezas, vóxeles en 3D
          const wi = wr.info, deep = s.P.vis.v[2] < 0.35; wtex = wr.tex;
          pr.u.uWH && gl.uniform4f(pr.u.uWH, wi[0], wi[1], wi[2], deep ? wi[3] * 0.16 : wi[3] * 0.035);   // bloque 3D o lámina
          pr.u.uAt && gl.uniform4f(pr.u.uAt, wr.at[0], wr.at[1], wr.at[2], wr.at[3]);
          const ua = pr.u['uAim[0]'] || pr.u.uAim; ua && gl.uniform2fv(ua, wr.aim); pr.u.uWL && gl.uniform2f(pr.u.uWL, wr.L[0], wr.L[1]);
        } else pr.u.uWH && gl.uniform4f(pr.u.uWH, 0.01, 0.01, 0.001, 0.001);   // aún calculándose (unos ms): no hay letra todavía
      }
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, wtex); pr.u.uWord && gl.uniform1i(pr.u.uWord, 3); gl.activeTexture(gl.TEXTURE0);
      const sh = shotOf(s.P, s.e); gl.uniform1i(pr.u.uShot, sh[0]); gl.uniform1f(pr.u.uShotK, sh[1]); gl.uniform1f(pr.u.uShotT, sh[2]);
      const st = s.P.stroke, c1 = hex(st.c1), c2 = hex(st.c2);
      gl.uniform1i(pr.u.uStroke, st.style); gl.uniform3f(pr.u.uSC1, c1[0], c1[1], c1[2]); gl.uniform3f(pr.u.uSC2, c2[0], c2[1], c2[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const c = contraOf(s.P, s.e);
      if (c[2] > 0.002) {
        const cp = this.species('contra');
        if (cp) { gl.useProgram(cp.p);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform2f(cp.u.uRes, S.w, S.h); setU(gl, cp.u, s.P, s.e, s.w, { uDrift: o.drift || 0 });
        gl.uniform4f(cp.u.uC, c[0], c[1], c[2], c[3]); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.blendFunc(gl.ONE, gl.ONE); }
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
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.chain[Math.min(2, this.chain.length - 1)].tex); gl.uniform1i(F.u.uBloom2, 4);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.ghostF.tex); gl.uniform1i(F.u.uGhostT, 5);
    { const fx = this.fx || {}, a = hex(fx.acc || '#F2F0EA');
      gl.uniform3f(F.u.uAccP, a[0], a[1], a[2]); gl.uniform1f(F.u.uStreak, (o.streak ?? 1) * ((this.quality ?? 1) > 0.5 ? 1 : 0));
      gl.uniform1f(F.u.uGlitch, fx.glitch || 0); gl.uniform1f(F.u.uGSeed, fx.seed || 0); gl.uniform1f(F.u.uGhost, fx.ghost || 0); }
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
    gl.uniform1f(F.u.uTone, o.tone ?? 0); gl.uniform1f(F.u.uVig, o.vig ?? 0.6); gl.uniform1f(F.u.uDof, (this.quality ?? 1) > 0.5 ? (o.dof ?? 0.013) : 0);   // desenfoque contenido: más definición
    gl.uniform1f(F.u.uFrame, this.frame++);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  };

  // RITMO: en un ordenador modesto la imagen nunca va a saltos. Si no llega a 60 fps, por este orden: se quita el
  // supermuestreo, se pasa a calidad ligera (sin sombras ni desenfoque, más nítida), se fija a 30 fps exactos (cada dos
  // refrescos) y, lo último, se baja la resolución hasta el 75 %. Los cambios de resolución esperan a un corte de plano.
  function Pacer(eng, o = {}) {
    this.eng = eng; this.half = false; this.flip = false; this.t0 = 0; this.n = 0; this.fps = 60; this.slow = 0; this.fast = 0;
    this.pending = null; this.max = o.max ?? 1.5; this.waited = 0;
  }
  // ¿se dibuja en este refresco?
  Pacer.prototype.tick = function () { if (!this.half) return true; this.flip = !this.flip; return this.flip; };
  // tras dibujar: mide y decide
  Pacer.prototype.done = function (ts) {
    if (!this.t0) this.t0 = ts; this.n++;
    const span = (ts - this.t0) / 1000; if (span < 1.2) return;
    this.fps = this.n / span; this.t0 = ts; this.n = 0;
    const target = this.half ? 30 : 60, e = this.eng, q = e.quality ?? 1;
    if (this.fps < target * 0.9) { this.slow++; this.fast = 0; } else if (this.fps > target * 0.97) { this.fast++; this.slow = 0; } else { this.slow = this.fast = 0; }
    if (this.slow >= 1) {
      this.slow = 0;
      if (e.scale > 1.0) this.pending = 1;                     // primero se quita el supermuestreo
      else if (q > 0.5) e.quality = 0;                          // luego la calidad ligera (sin sombras ni desenfoque: más nítido)
      else if (!this.half) this.half = true;                    // luego 30 fps exactos
      else if (e.scale > 0.75) this.pending = +(e.scale - 0.1).toFixed(2);   // la resolución, lo último
    }
    if (this.fast >= 4) {   // va sobrado: recupera calidad y definición poco a poco
      this.fast = 0;
      if (q < 0.5) e.quality = 1;
      else if (e.scale < (this.half ? 1.0 : this.max)) this.pending = +Math.min(this.max, e.scale + 0.1).toFixed(2);
    }
  };
  // aplica un cambio de resolución pendiente cuando hay un corte (o si lleva demasiado esperando)
  Pacer.prototype.cut = function (boundary, dt = 0.016) {
    if (this.pending == null) { this.waited = 0; return; }
    this.waited += dt;
    if (boundary || this.waited > 12) { this.eng.resize(this.eng.size[0], this.eng.size[1], this.pending); this.pending = null; this.waited = 0; }
  };
  Engine.Pacer = Pacer;
  window.SemillaEngine = Engine;
})();
