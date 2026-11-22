// ======================================================================
// VØID_LOOM · CÓRTEX — imagen.js
// El cerebro hecho de neuronas, la red por dentro, la tractografía y el montaje de cámara.
// Todo es función del tiempo y de los eventos de la partitura (render(t) puro).
// ======================================================================
let gl,W,H,cv;
function setupGL(){
  cv=document.getElementById('c');
  const q=+(P.q||1);
  W=OFF?+(P.w||1280):Math.round(innerWidth*Math.min(devicePixelRatio,1.5)*(q>=2?1:.85)); H=OFF?+(P.h||720):Math.round(innerHeight*Math.min(devicePixelRatio,1.5)*(q>=2?1:.85));
  cv.width=W; cv.height=H;
  gl=cv.getContext('webgl2',{preserveDrawingBuffer:OFF,antialias:false}); gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_float_blend');
}
function prog(v,f){const mk=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;};
 const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,v));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function vao(pr,arrs){const v=gl.createVertexArray();gl.bindVertexArray(v);for(const [nm,data,sz] of arrs){const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,data instanceof Float32Array?data:new Float32Array(data),gl.STATIC_DRAW);const l=gl.getAttribLocation(pr,nm);if(l<0)continue;gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,sz,gl.FLOAT,false,0,0);}return v;}

// ---- la red por dentro: materia fría, neón solo al disparar.
// Conducción saltatoria en el axón (el impulso salta de nodo en nodo), destellos en las sinapsis y neurotransmisor que se dispersa.
const R_VS2=`#version 300 es
precision highp float;
in vec4 a; in vec2 b;
uniform mat4 VP; uniform float T, focus, ap, RY, spread, lk, ki, kick, rs;
out float vI; out float vA; out float vN; out float vH;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  float id=b.x, kind=b.y;
  float per=3.5+5.*hh(id*1.7); float lt=mod(T+hh(id)*per,per);
  float act=step(hh(id*3.1+floor((T+hh(id)*per)/per)),spread*.3);
  if(hh(id*3.1+ki*7.13)<spread){ lt=lk; act=1.; }               // disparo sincronizado con el último evento
  float F=lt*1.4;
  if(kind==2.||kind==5.) F=floor(lt*1.4/.09)*.09;               // saltatoria
  vec3 p=a.xyz;
  float dt=F-a.w;
  if(kind==4.){ vec3 dir=normalize(vec3(hh(float(gl_VertexID)*.37),hh(float(gl_VertexID)*.71),hh(float(gl_VertexID)*1.13))-.5);
    p+=dir*max(dt,0.)*.09*act; }                                   // neurotransmisor que se abre
  vec4 cp=VP*vec4(p,1.); gl_Position=cp; float dep=cp.w;
  float wave=exp(-pow((a.w-F)*(kind==2.?14.:8.),2.))*act*(kind==2.?4.5:4.);
  float soma=(kind==0.)?exp(-lt*2.4)*act*.7:0.;
  float trail=act*smoothstep(F,F-.5,a.w)*step(a.w,F)*exp(-lt*.8)*.9;
  float node=(kind==5.)?exp(-pow(dt*25.,2.))*act*5.+.25:0.;
  float bouton=(kind==3.)?act*step(0.,dt)*exp(-dt*5.)*4.+.12:0.;
  float nt=(kind==4.)?act*step(0.,dt)*exp(-dt*3.)*2.2:0.;
  float fire=(kind<3.?wave+soma+trail:0.)+node+bouton+nt;
  float base=(kind==0.?.05:kind>=3.?0.:.05)*(1.+kick*1.5);
  float I=base+fire;
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY;
  gl_PointSize=min(max(1.6,coc+1.),90.);
  float energy=(1.6*1.6)/(gl_PointSize*gl_PointSize)*(kind==0.?1.:(.25+.75*smoothstep(1.,7.,coc)));
  float fog=exp(-max(dep-.5,0.)*.26-max(dep-2.2,0.)*.55)*smoothstep(.06,.35,dep);
  vI=I*energy*fog*rs; vA=gl_PointSize; vN=clamp(fire/(base+fire+1e-4),0.,1.); vH=kind==0.||kind==4.?0.:smoothstep(2.,4.,fire);
}`;
const R_FS2=`#version 300 es
precision highp float;
in float vI; in float vA; in float vN; in float vH; uniform vec3 neon; out vec4 o;
void main(){ vec2 q=gl_PointCoord*2.-1.; float r=length(q);
  float disk = vA>4. ? smoothstep(1.,.86,r)*(.85+.15*r) : exp(-r*r*3.);
  o=vec4(mix(mix(vec3(.82,.86,.95),neon,vN),vec3(1.,.98,.95),vH*.8)*vI*disk,1.); }`;
const R_LVS2=`#version 300 es
precision highp float;
in vec4 a; in vec2 b;
uniform mat4 VP; uniform float T, focus, ap, RY, spread, lk, ki;
out float vI; out float vN;
float hh(float n){return fract(sin(n*12.9898)*43758.5453);}
void main(){
  vec4 cp=VP*vec4(a.xyz,1.); gl_Position=cp; float dep=cp.w; float id=b.x, kind=b.y;
  float per=3.5+5.*hh(id*1.7); float lt=mod(T+hh(id)*per,per);
  float act=step(hh(id*3.1+floor((T+hh(id)*per)/per)),spread*.3);
  if(hh(id*3.1+ki*7.13)<spread){ lt=lk; act=1.; }
  float F=kind==2.?floor(lt*1.4/.09)*.09:lt*1.4;
  float wave=exp(-pow((a.w-F)*(kind==2.?12.:7.),2.))*act*3.;
  float trail=act*smoothstep(F,F-.5,a.w)*step(a.w,F)*exp(-lt*.8)*.9;
  float fire=wave+trail;
  float coc=ap*abs(dep-focus)/max(dep,.05)*RY;
  float fog=exp(-max(dep-.5,0.)*.26-max(dep-2.2,0.)*.55)*smoothstep(.06,.35,dep);
  vI=(.06+fire)*fog*exp(-coc*.3)*1.1; vN=clamp(fire*3.,0.,1.);
}`;
const R_LFS2=`#version 300 es
precision highp float; in float vI; in float vN; uniform vec3 neon; out vec4 o; void main(){ o=vec4(mix(vec3(.82,.86,.95),neon,vN)*vI,1.); }`;
const PVS=`#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

let G={};
function mkTex(){ const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,W,H,0,gl.RGBA,gl.HALF_FLOAT,null);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v); return t; }
function mkFB(tex){ const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,G.rb); return f; }
function buildScene(){
  const q=+(P.q||1);
  const bp={np:String(P.np||(q>=2?2600000:1500000)),dust:String(q>=2?200000:120000),nb:String(q>=2?420:300)};
  const B=genBrain(bp);
  seed=11*9301+49297; const Rr=genRed({n:String(P.nn||(q>=2?900:600))});
  seed=23*9301+49297; const Tr=genTractos({nt:String(q>=2?2200:1400)});
  G.path=Rr.path;
  G.surf=[]; { const n=B.pos.length/4; for(let i=0;i<n && G.surf.length<4000;i+=97){ if(B.att[i*2+1]===3 && B.pos[i*4+3]>.7 && B.pos[i*4+1]>-.3 && (B.nrm[i*3]*.5+B.nrm[i*3+1]*.8+B.nrm[i*3+2]*.35)>.55) G.surf.push([B.pos[i*4],B.pos[i*4+1],B.pos[i*4+2],B.nrm[i*3],B.nrm[i*3+1],B.nrm[i*3+2]]); } }
  // superficie también para regiones laterales/bajas (temporal, occipital, cerebelo): sin filtro de luz
  G.surfAll=[]; { const n=B.pos.length/4; for(let i=0;i<n && G.surfAll.length<6000;i+=61){ const k=B.att[i*2+1]; if((k===3||k===4) && B.pos[i*4+3]>.6) G.surfAll.push([B.pos[i*4],B.pos[i*4+1],B.pos[i*4+2],B.nrm[i*3],B.nrm[i*3+1],B.nrm[i*3+2]]); } }
  G.A=prog(B_VS,B_FS); G.L=prog(B_LVS,B_LFS); G.Ri=prog(R_VS2,R_FS2); G.RL=prog(R_LVS2,R_LFS2); G.PP=prog(PVS,B_PFS); G.TT=prog(T_VS,T_FS); G.KK=prog(PVS,K_FS);
  G.vaA=vao(G.A,[['a',B.pos,4],['b',B.att,2],['nr',B.nrm,3]]); G.nA=B.pos.length/4;
  G.vaL=vao(G.L,[['a',B.lpos,4],['b',B.latt,2],['nr',B.lnrm,3]]); G.nL=B.lpos.length/4;
  G.vaRi=vao(G.Ri,[['a',Rr.pos,4],['b',Rr.att,2]]); G.nRi=Rr.pos.length/4;
  G.vaRL=vao(G.RL,[['a',Rr.lpos,4],['b',Rr.latt,2]]); G.nRL=Rr.lpos.length/4;
  G.vaT=vao(G.TT,[['a',Tr.pos,4],['b',Tr.att,2]]); G.nT=Tr.pos.length/4;
  G.vaQ=vao(G.PP,[['p',[-1,-1,3,-1,-1,3],2]]); G.vaQ2=vao(G.KK,[['p',[-1,-1,3,-1,-1,3],2]]);
  G.rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,G.rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,W,H);
  G.stex=mkTex(); G.sfb=mkFB(G.stex); G.tex=[mkTex(),mkTex(),G.stex]; G.fb=[mkFB(G.tex[0]),mkFB(G.tex[1])]; G.cur=0;
  G.U={}; for(const k of ['A','L','Ri','RL','PP','TT','KK']){ const pr=G[k]; G.U[k]=n=>{const key=k+n; return (G.U[key]??=gl.getUniformLocation(pr,n));}; }
  // las regiones necesitan la superficie para encuadrar
  REG_SURF=REG.map(R=>[-1,1].map(sx=>{ const c=[R[0]*sx,R[1],R[2]]; const src=G.surfAll;
    return src.map((p,i)=>[i,Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])]).sort((a,b)=>a[1]-b[1]).slice(0,40).map(x=>x[0]); }));
  G.surf=G.surfAll.length?G.surf:G.surf;
}
function mul(a,b){const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o;}
function camMat(eye,tgt,roll,fovDeg){
  const f=norm(sub(tgt,eye)); const r=norm(cross(f,[Math.sin(roll),Math.cos(roll),0])); const u=cross(r,f);
  const fov=fovDeg*Math.PI/180, asp=W/H, near=.02, far=60, ft=1/Math.tan(fov/2);
  const view=[r[0],u[0],-f[0],0, r[1],u[1],-f[1],0, r[2],u[2],-f[2],0, -dot(r,eye),-dot(u,eye),dot(f,eye),1];
  const proj=[ft/asp,0,0,0, 0,ft,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0];
  return new Float32Array(mul(proj,view));
}
const sph=(r,az,el)=>[r*Math.cos(el)*Math.sin(az), r*Math.sin(el), r*Math.cos(el)*Math.cos(az)];
function surfPt(S){ const L=(S.reg!=null&&REG_SURF)?REG_SURF[S.reg][S.sx>0?1:0]:null; const src=L?G.surfAll:G.surf; const i=L?L[Math.floor(S.s*L.length)%L.length]:(S.si||0)%src.length; return src[i]; }
// cada tipo de plano es una función pura del progreso u∈[0,1]
function camara(S,u,t){
  const s=S.s, side=(s<.5?-1:1);
  switch(S.type){
    case 'orbit':  { const dir=s<.5?1:-1, az=s*6.28+dir*ease(u)*1.3, e=sph(3.3-.6*ease(u),az,-.05+.35*H1(s*91)+.15*u); return {eye:e,tgt:[0,-.05,0],fov:36,focus:Math.hypot(...e),ap:.006,scene:'out'}; }
    case 'sueno':  { const az=s*6.28+u*1.6; const e=sph(3.6,az,.12+.1*Math.sin(u*6)); return {eye:e,tgt:[0,-.05,0],fov:34,focus:3.6,ap:.005,scene:'out'}; }
    case 'lateral':{ const z=lerp(1.1,-.7,u)*side; return {eye:[2.55*side*-1,.18+.1*s,z],tgt:[0,-.08,z*.25],fov:38,focus:2.6,ap:.007,scene:'out'}; }
    case 'top':    { const az=s*6.28+u*.5; return {eye:[Math.sin(az)*.9,2.7-.3*u,Math.cos(az)*.9],tgt:[0,0,0],fov:34,focus:2.6,ap:.007,scene:'out',roll:az*.2}; }
    case 'low':    { const az=(s<.5?1.9:4.4)+u*.25; const e=sph(2.5,az,-.12); return {eye:[e[0],-.32,e[2]],tgt:[0,-.25,-.25],fov:36,focus:2.45,ap:.008,scene:'out'}; }
    case 'crane':  { const az=s*6.28; const k=ease(u); const e=sph(2.9,az+k*.5,lerp(-.35,.55,k)); return {eye:e,tgt:[0,lerp(-.25,.05,k),0],fov:36,focus:2.9,ap:.006,scene:'out'}; }
    case 'slide':  { const az=s*6.28; const k=ease(u); const c=sph(2.35,az,.12), t2=norm(cross(c,[0,1,0])); const e=[c[0]+t2[0]*lerp(-1.1,1.1,k),c[1],c[2]+t2[2]*lerp(-1.1,1.1,k)]; return {eye:e,tgt:[t2[0]*lerp(-.3,.3,k),-.05,t2[2]*lerp(-.3,.3,k)],fov:40,focus:Math.hypot(...e)-.1,ap:.008,scene:'out'}; }
    case 'pull':   { const az=s*6.28; const k=ease(u); return {eye:sph(lerp(1.6,3.4,k),az,.22),tgt:[0,-.02,0],fov:lerp(30,38,k),focus:lerp(1.5,3.3,k),ap:.008,scene:'out',roll:lerp(.15,0,k)*(s<.5?1:-1)}; }
    case 'macro': case 'trace': {
      const P0=surfPt(S), n=[P0[3],P0[4],P0[5]];
      const tan=norm(cross(n,[0,1,0])), bit=cross(tan,n), k=S.type==='trace'?lerp(-.22,.22,u):lerp(-.14,.14,ease(u));
      const tg=[P0[0]+tan[0]*k,P0[1]+tan[1]*k,P0[2]+tan[2]*k];
      const d=(S.type==='trace'?.8:.62)-.08*u; const e=[tg[0]+n[0]*d+bit[0]*.22+tan[0]*.12,tg[1]+n[1]*d+bit[1]*.22+tan[1]*.12,tg[2]+n[2]*d+bit[2]*.22+tan[2]*.12];
      return {eye:e,tgt:tg,fov:S.type==='trace'?34:30,focus:Math.hypot(...sub(e,tg)),ap:.013,scene:'out'}; }
    case 'region': { const R=REG[S.reg??0], c=[R[0]*(S.sx||1),R[1],R[2]]; const n=norm([c[0]*1.6,c[1]*.8+.3,c[2]]); const k=ease(u), d=2.5-.3*k;
      const tn=norm(cross(n,[0,1,0])), e=[n[0]*d+tn[0]*(s-.5)*.6,n[1]*d,n[2]*d+tn[2]*(s-.5)*.6], tg=[c[0]*.55,c[1]*.55,c[2]*.55];
      return {eye:e,tgt:tg,fov:36,focus:Math.hypot(...sub(e,c)),ap:.008,scene:'out'}; }
    case 'burst':  { const az=s*6.28; return {eye:sph(3.3+u*.3,az,.15),tgt:[0,-.05,0],fov:38,focus:3.4,ap:.006,scene:'out'}; }
    case 'tract':  { const az=s*6.28+u*.6; const e=sph(2.2-.3*u,az,.25); return {eye:e,tgt:[0,0,0],fov:38,focus:Math.hypot(...e),ap:.007,scene:'out',roll:(s-.5)*.3}; }
    case 'dive':   { const az=s*6.28; const k=ease(u); return {eye:sph(lerp(3.1,.35,k),az,.15),tgt:[0,0,0],fov:lerp(38,70,k),focus:lerp(3,.5,k),ap:.006,scene:'out'}; }
    case 'in':     { const z=(S.z||0)*.5+u*.55; const e=G.path(z+2); const tg=G.path(z+3.4);
      const off=(S.side||0)>.5?[.12,.05,0]:[-.1,-.06,0]; return {eye:[e[0]+off[0],e[1]+off[1],e[2]],tgt:tg,fov:64,focus:1.0+.2*Math.sin(u*3),ap:.018,scene:'in',roll:S.roll||0}; }
    case 'recompose': { const k=clamp(u,0,1); const az=s*6.28+k*.6; return {eye:sph(lerp(2.6,3.9,ease(k)),az,.2),tgt:[0,-.05,0],fov:36,focus:lerp(2.6,3.9,ease(k)),ap:.006,scene:'out'}; }
    default: return {eye:[0,0,3],tgt:[0,0,0],fov:36,focus:3,ap:.006,scene:'black'};
  }
}
function shotAt(t){ let r=null; for(const S of TL.shots){ if(S.t0<=t+1e-6) r=S; else break; } return r||TL.shots[0]||{t0:0,type:'sueno',s:.3,dur:60}; }

// estado visual en el instante t
function estado(t){
  const S=shotAt(t), u=clamp((t-S.t0)/(S.dur||1),0,1);
  const C=camara(S,u,t);
  const auto=ST.mode==='auto', B=auto?barAt(t):null, IS=instAt(t), acto=auto?B.acto:IS.acto;
  if(!auto && C.scene==='out' && INST.camAz){ const ca=Math.cos(INST.camAz), sa=Math.sin(INST.camAz), rot=v=>[v[0]*ca+v[2]*sa,v[1],-v[0]*sa+v[2]*ca]; C.eye=rot(C.eye); C.tgt=rot(C.tgt); }
  // el último evento que pulsa: el bombo (o, en el instrumento, cualquier golpe)
  let lk=null,ki=0; const src=auto?TL.kicks:TL.hits.concat(TL.kicks);
  for(let i=0;i<src.length;i++){ const e=src[i]; if(e.t<=t && (!lk||e.t>lk.t)){lk=e;ki=i;} }
  const kenv=lk?Math.exp(-(t-lk.t)*9)*Math.min(lk.v,1):0;
  const shake=kenv*(acto==='RUPTURA'?.02:(acto==='TENSION'||acto==='PULSO')?.01:.004);
  const sh=[(H1(ki*3.1)-.5)*shake,(H1(ki*5.7)-.5)*shake,(H1(ki*7.9)-.5)*shake];
  C.eye=C.eye.map((v,i)=>v+sh[i]); C.fov-=kenv*(acto==='RUPTURA'?2.5:1);
  // ondas: las 8 más recientes (+ las sostenidas por la voz)
  const W8=[],A8=[];
  for(const h of TL.holds){ if(h.t>t || W8.length>=8) continue; const R=REG[h.reg]; const held=h.t1==null||h.t1>t; const tt=held?t-h.t:(h.t1-h.t)+(t-h.t1);
    const Rr=held?Math.min(tt*.9,.34)+.02*Math.sin(t*6):Math.min((h.t1-h.t)*.9,.34)+(t-h.t1)*1.2; if(Rr>1.8) continue;
    W8.push(R[0]*h.sx,R[1],R[2],Rr); A8.push(held?.9:.8); }
  for(let i=TL.waves.length-1;i>=0&&W8.length<32;i--){ const w=TL.waves[i]; if(w.t>t) continue; const R=(t-w.t)*.95; if(R>1.8) break; W8.push(...w.c,R); A8.push(w.amp??1); }
  while(W8.length<32){ W8.push(0,0,0,-1); A8.push(0); }
  // estallido
  let burst=0; const imp=lastBefore(TL.impacts,t);
  if(auto){ if(acto==='RUPTURA'&&imp) burst=.2*sstep(0,.25,t-imp.t)+.05*kenv;
    if(acto==='ECO'){ let e0=B.t0; for(let i=TL.bars.indexOf(B);i>=0&&TL.bars[i].acto==='ECO';i--) e0=TL.bars[i].t0; burst=.22*(1-ease(clamp((t-e0)/2.6,0,1))); } }
  else if(imp){ const rh=imp.t+ (IS.tempo?IS.tempo.beat*12:6); if(t<rh) burst=.2*sstep(0,.25,t-imp.t)+.05*kenv; else burst=.22*(1-ease(clamp((t-rh)/2.6,0,1))); }
  // tractografía: el cerebro se vuelve translúcido
  let tract=0; for(const T of TL.tract){ if(t>=T.t-.4 && t<T.t1+.8) tract=Math.max(tract,sstep(T.t-.4,T.t,t)*(1-sstep(T.t1,T.t1+.8,t))); }
  if(S.type==='tract') tract=Math.max(tract,1);
  // glitch y onda de choque: solo golpes muy fuertes y la ruptura
  let gli=0; for(const g of TL.glitch) if(t>=g.t&&t<g.t+.45) gli=Math.max(gli,Math.exp(-(t-g.t)*5));
  if((S.type==='in')&&acto==='RUPTURA') gli=Math.max(gli,.35*Math.exp(-(t-S.t0)*18));
  if(imp && t-imp.t<.5) gli=Math.max(gli,1-(t-imp.t)*2);
  let shock=[.5,.5,0,0]; if(imp && t-imp.t<.8) shock=[.5,.5,(t-imp.t)*1.1,1-(t-imp.t)/.8];
  for(const g of TL.glitch) if(t>=g.t&&t<g.t+.6) shock=[.5+(H1(g.t)-.5)*.3,.5,(t-g.t)*1.3,.7*(1-(t-g.t)/.6)];
  const sp=espectro(t);
  // persistencia (fosfeno): más larga con la voz y en la ruptura; 0 justo en el corte
  let persist=acto==='RUPTURA'?.55:sp.voz?.66:.45; if(t-S.t0<1/50) persist=0; if(C.scene==='in') persist*=.85;
  return {S,u,C,kenv,ki,lk,W8,A8,burst,gli,shock,dp:S.type==='black'?1:0,dark:sp.dark,sp,spread:clamp(.15+.55*sp.be,0,.85),tract,persist,acto};
}

let RS=1,RSi=1;
const NIV=[{sc:1,half:false,pts:1},{sc:.8,half:false,pts:1},{sc:.8,half:true,pts:1},{sc:.8,half:true,pts:.65},{sc:.6,half:true,pts:.65},{sc:.6,half:true,pts:.45}];
const Q={lvl:0,cur:0,n:0,t0:0,slow:0,fast:0,flip:false,shot:null,base:[0,0]};
function pacer(ts){
  Q.n++; if(!Q.t0){Q.t0=ts;return;} const span=(ts-Q.t0)/1000; if(span<2) return;
  const fps=Q.n/span; Q.t0=ts; Q.n=0; const target=NIV[Q.cur].half?30:60;
  if(fps<target*.9){Q.slow++;Q.fast=0;} else if(fps>target*.97){Q.fast++;Q.slow=0;} else Q.slow=Q.fast=0;
  if(Q.slow>=2){Q.slow=0;Q.lvl=Math.min(Q.lvl+1,NIV.length-1);}
  if(Q.fast>=4&&Q.lvl>0){Q.fast=0;Q.lvl--;}
}
function aplicarCalidad(){
  if(Q.lvl===Q.cur) return; Q.cur=Q.lvl; const N=NIV[Q.cur];
  W=Math.round(Q.base[0]*N.sc); H=Math.round(Q.base[1]*N.sc); cv.width=W; cv.height=H;
  for(const tx of G.tex){ gl.bindTexture(gl.TEXTURE_2D,tx); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,W,H,0,gl.RGBA,gl.HALF_FLOAT,null); }
  gl.bindRenderbuffer(gl.RENDERBUFFER,G.rb); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,W,H);
}
function render(t){
  const PF=NIV[Q.cur].pts;
  RS=clamp(W*H/(1600*900),.12,2.5)/PF; RSi=clamp(Math.pow(W*H/(1280*720),.7),.2,2.5)/PF;
  const E=estado(t), C=E.C, U=G.U;
  const cur=G.cur, prev=1-cur;
  gl.bindFramebuffer(gl.FRAMEBUFFER,G.sfb); gl.viewport(0,0,W,H); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const VP=camMat(C.eye,C.tgt,C.roll||0,C.fov);
  const W8=new Float32Array(E.W8), A8=new Float32Array(E.A8);
  if(C.scene==='out'){
    const cortexA=1-.72*E.tract;
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    gl.useProgram(G.A); gl.bindVertexArray(G.vaA); const u=U.A;
    gl.uniformMatrix4fv(u('VP'),false,VP); gl.uniform3fv(u('cam'),C.eye); gl.uniform1f(u('T'),t); gl.uniform1f(u('focus'),C.focus);
    gl.uniform1f(u('RY'),H); gl.uniform1f(u('burst'),E.burst); gl.uniform1f(u('kick'),E.kenv); gl.uniform1f(u('dark'),E.dark); gl.uniform1f(u('fireAmt'),1);
    gl.uniform4fv(u('wv[0]'),W8); gl.uniform1fv(u('wa[0]'),A8); gl.uniform3fv(u('neon'),NEON); gl.uniform1f(u('rs'),RS);
    gl.uniform1f(u('oreja'),ST.mode==='auto'?0:(instAt(t).oreja||0)); gl.uniform1f(u('cortexA'),cortexA);
    if(E.tract<.5){ gl.disable(gl.BLEND); gl.colorMask(false,false,false,false); gl.uniform1f(u('inset'),C.focus<1.2?.06:.03); gl.uniform1f(u('ap'),0); gl.drawArrays(gl.POINTS,0,Math.floor(G.nA*PF)); }
    gl.colorMask(true,true,true,true); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
    if(E.tract>=.5) gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(u('inset'),0); gl.uniform1f(u('ap'),C.ap); gl.drawArrays(gl.POINTS,0,Math.floor(G.nA*PF));
    gl.useProgram(G.L); gl.bindVertexArray(G.vaL); const l=U.L;
    gl.uniformMatrix4fv(l('VP'),false,VP); gl.uniform1f(l('burst'),E.burst); gl.uniform1f(l('fireAmt'),1); gl.uniform1f(l('dark'),E.dark);
    gl.uniform4fv(l('wv[0]'),W8); gl.uniform1fv(l('wa[0]'),A8); gl.uniform3fv(l('neon'),NEON); gl.uniform1f(l('lr'),clamp(W*H/(1600*900),.15,2)); gl.drawArrays(gl.LINES,0,G.nL);
    if(E.tract>.01){ gl.disable(gl.DEPTH_TEST); gl.useProgram(G.TT); gl.bindVertexArray(G.vaT); const k=U.TT;
      gl.uniformMatrix4fv(k('VP'),false,VP); gl.uniform1f(k('T'),t); gl.uniform1f(k('tract'),E.tract); gl.uniform1f(k('focus'),C.focus); gl.uniform1f(k('ap'),C.ap); gl.uniform1f(k('RY'),H);
      gl.uniform4fv(k('wv[0]'),W8); gl.uniform1fv(k('wa[0]'),A8); gl.uniform3fv(k('neon'),NEON); gl.uniform1f(k('lr'),clamp(W*H/(1600*900),.15,2)); gl.drawArrays(gl.LINES,0,G.nT); }
  } else if(C.scene==='in'){
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE);
    const lkT=E.lk?t-E.lk.t:9;
    for(const [pk,va,n,mode] of [['Ri',G.vaRi,G.nRi,gl.POINTS],['RL',G.vaRL,G.nRL,gl.LINES]]){
      gl.useProgram(G[pk]); gl.bindVertexArray(va); const u=U[pk];
      gl.uniformMatrix4fv(u('VP'),false,VP); gl.uniform1f(u('T'),t); gl.uniform1f(u('focus'),C.focus); gl.uniform1f(u('ap'),C.ap); gl.uniform1f(u('RY'),H);
      gl.uniform1f(u('spread'),E.spread); gl.uniform1f(u('lk'),lkT); gl.uniform1f(u('ki'),E.ki); gl.uniform1f(u('kick'),E.kenv); gl.uniform3fv(u('neon'),NEON); if(pk==='Ri') gl.uniform1f(u('rs'),RSi);
      gl.drawArrays(mode,0,mode===gl.POINTS?Math.floor(n*PF):n);
    }
  }
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
  // PERSISTENCIA (fosfeno): la huella del fotograma anterior se apaga; en los cortes, 0
  gl.bindFramebuffer(gl.FRAMEBUFFER,G.fb[cur]); gl.useProgram(G.KK); gl.bindVertexArray(G.vaQ2); { const k=U.KK;
    gl.uniform2f(k('R'),W,H); gl.uniform1f(k('k'),E.persist); gl.uniform1i(k('S'),0); gl.uniform1i(k('Tp'),1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,G.stex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,G.tex[prev]); gl.drawArrays(gl.TRIANGLES,0,3); gl.activeTexture(gl.TEXTURE0); }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H);
  gl.useProgram(G.PP); gl.bindVertexArray(G.vaQ); const p=U.PP;
  gl.uniform2f(p('R'),W,H); gl.uniform1f(p('glitch'),E.gli); gl.uniform1f(p('T'),t); gl.uniform1i(p('S'),0); gl.uniform3fv(p('neon'),NEON);
  gl.uniform1f(p('streak'),C.scene==='in'?.3:1); gl.uniform1f(p('sort'),E.gli*.7); gl.uniform1f(p('dpulse'),Math.max(E.dp,E.dark*.6)); gl.uniform4fv(p('shock'),E.shock);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,G.tex[cur]); gl.drawArrays(gl.TRIANGLES,0,3);
  G.cur=prev;
  return E;
}
