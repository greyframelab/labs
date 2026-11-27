// ======================================================================
// VØID_LOOM · MURMULLO — imagen.js
// PALIMPSESTO: una losa de obsidiana flotando en el vacío. El mundo escribe en ella.
// Cada edición es una incisión de la MATRIZ (5×7) en la fila de su idioma; los bots
// graban a rejilla exacta; un borrado lima la piedra; una página nueva se enciende por
// dentro; una guerra de ediciones la agrieta. En el ECO, un pulido barre la losa y lo
// viejo queda debajo, apenas legible.
// ======================================================================
const SLAB=[16,9], ROWS=64, HW=4096, HH=2304, EW=1024, EH=576;
const GLSL_HEAD=`#version 300 es
precision highp float;`;
const VS_FULL=GLSL_HEAD+`
in vec2 p; out vec2 uv; void main(){ uv=p*.5+.5; gl_Position=vec4(p,0,1); }`;
const FS_DECAY=GLSL_HEAD+`
in vec2 uv; out vec4 o; uniform sampler2D T; uniform float dt; uniform vec3 pol;
void main(){ vec4 s=textureLod(T,uv,0.);
  float band=pol.z*smoothstep(pol.y,0.,abs(uv.x-pol.x));
  float g=s.r*exp(-dt/7.)*(1.-band*min(1.,dt*4.));
  float b=s.g*exp(-dt/.3);
  o=vec4(g,b,0,1); }`;
// pulido de la altura sin leerla: un quad que multiplica (blending), la banda barre la losa
const FS_POLISH=GLSL_HEAD+`
in vec2 uv; out vec4 o; uniform float dt; uniform vec3 pol;
void main(){ float band=pol.z*smoothstep(pol.y,0.,abs(uv.x-pol.x)); o=vec4(1.-band*min(1.,dt*.9)); }`;
// sello instanciado: a0=(u,v,anchoMundo,altoMundo) a1=(tipo,semilla,profundidad,emisión) a2=(giro,brillo,0,0)
const VS_STAMP=GLSL_HEAD+`
in vec2 c; in vec4 a0; in vec4 a1; in vec2 a2; out vec2 q; flat out vec4 k1; flat out vec2 k2;
uniform vec2 slab;
void main(){ q=c; k1=a1; k2=a2;
  vec2 l=(c-.5)*a0.zw; float cs=cos(a2.x), sn=sin(a2.x); l=vec2(cs*l.x-sn*l.y, sn*l.x+cs*l.y);
  vec2 u=a0.xy+l/slab; gl_Position=vec4(u*2.-1.,0,1); }`;
const FS_STAMP=GLSL_HEAD+`
in vec2 q; flat in vec4 k1; flat in vec2 k2; out vec4 o; uniform int modo;
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float sdBox(vec2 p, vec2 b, float r){ vec2 d=abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
void main(){
  int tipo=int(k1.x+.5); float sd=k1.y;
  if(modo==0){ // lo nuevo se escribe encima: lo de debajo se aplana (multiplica)
    if(tipo==3) discard;
    float e=smoothstep(.5,.44,max(abs(q.x-.5),abs(q.y-.5)));
    o=vec4(mix(1.,tipo==2?.1:.3,e)); return; }
  float hgt=0., inc=0., core=-1.;
  if(tipo==3){ // grieta: trazo quebrado, profundo
    float x1=q.x*9.+sd, x2=q.x*41.+sd*3., x3=q.x*160.+sd*5.;
    float y=.5+(mix(h1(vec2(floor(x1),sd)),h1(vec2(floor(x1)+1.,sd)),fract(x1))-.5)*.42
              +(mix(h1(vec2(floor(x2),sd+7.)),h1(vec2(floor(x2)+1.,sd+7.)),fract(x2))-.5)*.14
              +(mix(h1(vec2(floor(x3),sd+2.)),h1(vec2(floor(x3)+1.,sd+2.)),fract(x3))-.5)*.03;
    float d=abs(q.y-y); float w=.032*(1.-pow(abs(q.x-.5)*2.,4.))+.003;
    inc=smoothstep(w,w*.4,d); core=smoothstep(w*1.8,0.,d)*(.75+.25*h1(vec2(floor(q.x*300.),sd))); float lab=smoothstep(w*2.6,w,d)*(1.-inc);
    hgt=-1.6*inc+.12*lab;                     // labio levantado: la piedra se abre
  } else if(tipo==2){ // borrado: no talla, lima: relieve leve granuloso
    hgt=.04*(h1(floor(q*vec2(30.,18.))+sd)*.6+.4); inc=0.;
  } else { // glifo de la MATRIZ: 5×7 celdas talladas con pared recta y fondo plano
    vec2 g=q*vec2(5.,7.); vec2 ci=floor(g); vec2 f=fract(g)-.5;
    float sdB=tipo==1?floor(sd*8.)/8.:sd;     // los bots repiten sus pocos glifos
    float on=step(tipo==1?.5:.56,h1(ci+sdB*91.7));
    // celdas vecinas encendidas se unen (trazo continuo, no puntos)
    float onR=step(tipo==1?.5:.56,h1(ci+vec2(1,0)+sdB*91.7))*step(ci.x,3.5);
    float onU=step(tipo==1?.5:.56,h1(ci+vec2(0,1)+sdB*91.7))*step(ci.y,5.5);
    float d=sdBox(f,vec2(.34),.02);
    if(onR>.5) d=min(d,sdBox(f-vec2(.5,0),vec2(.5,.34),.0));
    if(onU>.5) d=min(d,sdBox(f-vec2(0,.5),vec2(.34,.5),.0));
    inc=on*smoothstep(.02,-.02,d);
    hgt=-k1.z*inc;
  }
  if(modo==1){ o=vec4(hgt); return; }
  float emi=core>=0.?core:inc; o=vec4(k1.w*emi, k2.y*emi, 0, 0); }`;
const FS_SCENE=GLSL_HEAD+`
in vec2 uv; out vec4 o;
uniform sampler2D H, E; uniform vec2 res, texel, slab; uniform vec3 cp, cf, cr, cu; uniform float fov, foco, apert, tiempo, pulso, rake, tira, depthK, ruptura, polvo;
uniform vec3 acento; uniform vec3 bar0, barD; uniform float barL, barW; uniform vec3 rakeL; uniform vec3 pool;
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+1.),f.x),f.y); }
float LOD=0.;
float Hh(vec2 u){ return textureLod(H,u,LOD).r; }
float tira_(vec3 p, vec3 r, float rough){ // reflejo de una barra de luz (área) sobre la laca
  if(r.y<=.001) return 0.; float t=(bar0.y-p.y)/r.y; vec3 q=p+r*t;
  vec2 dq=q.xz-bar0.xz; vec2 bd=normalize(barD.xz); float along=dot(dq,bd); float d=abs(dot(dq,vec2(-bd.y,bd.x)));
  float w=barW*(1.+rough*30.)+t*rough*.6; float L=barL*(1.+rough*2.);
  return exp(-d*d/(w*w))*smoothstep(L,L*.7,abs(along))/(1.+rough*18.); }
// la luz de la barra vista en el aire: polvo suspendido en su haz (muy tenue)
float haz(vec3 ro, vec3 rd, float tmax){
  vec2 bd=normalize(barD.xz); vec3 n=vec3(-bd.y,0,bd.x); float acc=0.;
  for(int i=0;i<10;i++){ float t=(float(i)+h1(gl_FragCoord.xy+float(i)))*min(tmax,18.)/10.; vec3 p=ro+rd*t;
    if(p.y<0.||p.y>bar0.y) continue; vec3 q=p-bar0; float lat=abs(dot(q,n)); float al=abs(dot(q.xz,bd));
    float cone=exp(-lat*lat/(.08+(-q.y)*.25))*smoothstep(barL,barL*.6,al)*smoothstep(0.,bar0.y,-q.y+.2);
    acc+=cone*(.6+.4*vn(p.xz*3.+p.y*2.+tiempo*.05)); }
  return acc/10.; }
void main(){
  vec2 p=(uv*2.-1.)*vec2(res.x/res.y,1.);
  vec3 rd=normalize(cf+p.x*cr*fov+p.y*cu*fov); vec3 ro=cp;
  // superficie sin bordes: un territorio escrito que se pierde en la oscuridad
  float tn=rd.y<-1e-4?-ro.y/rd.y:-1.;
  vec3 col=vec3(0); float dist=60.;
  { float tp=-ro.y/min(rd.y,-1e-4); vec2 u0=(ro.xz+rd.xz*tp)/slab+.5; vec2 px=1./texel;
    LOD=clamp(log2(max(length(dFdx(u0)*px),length(dFdy(u0)*px))),0.,9.); }
  if(tn>0.){
    dist=tn; vec3 P=ro+rd*tn; vec3 n; float rough=.1, alb=.012, groove=0., edge=0., em=0.;
    {
      vec2 u=P.xz/slab+.5; vec2 tx=texel*exp2(LOD);
      float h=Hh(u); u+=rd.xz/max(.12,-rd.y)*h*depthK/slab*.5; h=Hh(u);   // parallax corto
      float hx=Hh(u+vec2(tx.x,0))-Hh(u-vec2(tx.x,0)), hz=Hh(u+vec2(0,tx.y))-Hh(u-vec2(0,tx.y));
      vec2 grad=vec2(hx,hz)/(2.*tx*slab)*depthK;
      groove=smoothstep(-.08,-.6,h);
      // laca: ondulación de pulido muy lenta; dentro, poro de piedra
      vec2 mp=P.xz*vec2(60.); vec2 mg=vec2(vn(mp)-vn(mp+vec2(3.1,0)),vn(mp)-vn(mp+vec2(0,2.7)));
      vec2 wp=P.xz*1.3; vec2 wg=vec2(vn(wp)-vn(wp+vec2(.7,0)),vn(wp)-vn(wp+vec2(0,.7)));
      n=normalize(vec3(-grad.x,1.,-grad.y)+vec3(mg.x,0,mg.y)*(.004+groove*.22)/(1.+LOD)+vec3(wg.x,0,wg.y)*.006);
      rough=mix(.05,.55,groove); alb=mix(.006,.07,groove);
      vec4 e=texture(E,u); em=e.r*(.5+2.6*e.g)*(.15+.85*groove);
    }
    vec3 V=-rd; float nv=max(dot(n,V),0.); float F=.04+.96*pow(1.-nv,5.);
    vec3 r=reflect(rd,n);
    float ti=tira_(P,r,rough)*tira*(.6+.4*pulso);
    vec3 spec=vec3(.92,.95,1.)*ti*F*9.;
    float env=smoothstep(.05,.95,r.y)*(.5+.5*smoothstep(-.6,.6,dot(r.xz,normalize(barD.xz+vec2(1e-4)))));
    spec+=vec3(.75,.8,.9)*env*F*(.22/(1.+rough*25.))*tira;
    vec3 L=normalize(rakeL); float nl=max(dot(n,L),0.); vec3 Hv=normalize(L+V);
    float sp=pow(max(dot(n,Hv),0.),2./(rough*rough+1e-3))*(1./(rough*8.+.2));
    vec3 rk=vec3(.62,.68,.78)*rake*(nl*alb*14.+sp*F*1.6);
    vec3 Em=acento*em*(1.+ruptura*1.5);
    // el fuego también ilumina la pared de su propia incisión (rebote cálido)
    vec2 dp=P.xz-pool.xy; float lit=exp(-dot(dp,dp)/(pool.z*pool.z));
    col=(spec+rk)*lit+Em*(.35+.65*lit);
    col*=mix(1.,.5,groove*(1.-min(1.,em)));
  }
  col*=exp(-max(0.,dist-6.)*.12);
  col+=vec3(.7,.75,.85)*haz(ro,rd,dist)*polvo*tira;
  col=clamp(col,0.,48.); if(any(isnan(col))||any(isinf(col))) col=vec3(0);
  float coc=clamp(abs(dist-foco)/max(dist,.1)*apert,0.,1.);
  o=vec4(col,coc); }`;
const FS_BRIGHT=GLSL_HEAD+`
in vec2 uv; out vec4 o; uniform sampler2D T; uniform vec2 texel;
void main(){ vec3 c=vec3(0); for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) c+=min(texture(T,uv+vec2(i,j)*texel*1.5).rgb,vec3(32.)); c/=9.;
  float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(.55,1.6,l),1); }`;
const FS_BLUR=GLSL_HEAD+`
in vec2 uv; out vec4 o; uniform sampler2D T; uniform vec2 dir;
void main(){ vec3 c=texture(T,uv).rgb*.227; float w[4]=float[4](.194,.121,.054,.016);
  for(int i=0;i<4;i++){ vec2 d=dir*float(i+1)*1.4; c+=(texture(T,uv+d).rgb+texture(T,uv-d).rgb)*w[i]; } o=vec4(c,1); }`;
const FS_FINAL=GLSL_HEAD+`
in vec2 uv; out vec4 o; uniform sampler2D T, B; uniform vec2 res, texel; uniform float tiempo, grano, expo, fade, dof;
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec4 c0=texture(T,uv); float coc=c0.a*dof;
  vec3 acc=c0.rgb; float wsum=1.;
  if(coc>.02){ float R=coc*res.y*.018; for(int i=0;i<28;i++){ float a=float(i)*2.39996; float rr=sqrt(float(i)+.5)/sqrt(28.)*R;
      vec2 o2=vec2(cos(a),sin(a))*rr*texel; vec4 s=texture(T,uv+o2); float w=smoothstep(0.,.6,s.a*dof)+.1; acc+=s.rgb*w; wsum+=w; } }
  vec3 c=acc/wsum;
  c+=texture(B,uv).rgb*.55;
  c*=expo;
  c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);        // ACES
  vec2 q=uv-.5; c*=1.-dot(q,q)*.9;
  float g=(h1(uv*res+fract(tiempo*13.)*91.)-.5)*grano; c+=g*(.4+c*.6);
  c*=fade;
  o=vec4(pow(max(c,0.),vec3(1./2.2)),1); }`;

class Imagen{
  constructor(canvas,opts){
    this.cv=canvas; const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:!!opts.render,alpha:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL2 no disponible'); this.gl=gl;
    if(!gl.getExtension('EXT_color_buffer_float')) throw new Error('sin EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.P={}; for(const [k,fs,vs] of [['decay',FS_DECAY],['polish',FS_POLISH],['stamp',FS_STAMP,VS_STAMP],['scene',FS_SCENE],['bright',FS_BRIGHT],['blur',FS_BLUR],['final',FS_FINAL]]) this.P[k]=this.prog(vs||VS_FULL,fs);
    const quad=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,quad); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW); this.quad=quad;
    // VAO de sellos (instanciado)
    this.vaoS=gl.createVertexArray(); gl.bindVertexArray(this.vaoS);
    const cb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,cb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
    const ps=this.P.stamp; let loc=gl.getAttribLocation(ps,'c'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    this.ib=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.ib); this.MAXI=8192; this.idata=new Float32Array(this.MAXI*10); gl.bufferData(gl.ARRAY_BUFFER,this.idata.byteLength,gl.DYNAMIC_DRAW);
    for(const [n,sz,off] of [['a0',4,0],['a1',4,16],['a2',2,32]]){ loc=gl.getAttribLocation(ps,n); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,sz,gl.FLOAT,false,40,off); gl.vertexAttribDivisor(loc,1); }
    gl.bindVertexArray(null);
    this.vaoF=gl.createVertexArray(); gl.bindVertexArray(this.vaoF); gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    for(const k of Object.keys(this.P)){ if(k==='stamp') continue; const l=gl.getAttribLocation(this.P[k],'p'); if(l>=0){ gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0); } }
    gl.bindVertexArray(null);
    // ALTURA en alta (solo se escribe por blending: sellos y pulido) · EMISIÓN en baja (respira y se apaga)
    this.Hm=this.rt(HW,HH,true,true,gl.R16F,gl.RED);
    this.Em=[this.rt(EW,EH,true),this.rt(EW,EH,true)]; this.cur=0;
    for(const m of [this.Hm,...this.Em]){ gl.bindFramebuffer(gl.FRAMEBUFFER,m.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindTexture(gl.TEXTURE_2D,this.Hm.t); gl.generateMipmap(gl.TEXTURE_2D);
    this.pend=[]; this.nf=0; this.q=opts.q||1; this.resize(opts.w||canvas.clientWidth||1280,opts.h||canvas.clientHeight||720);
  }
  prog(vs,fs){ const gl=this.gl; const mk=(t,s)=>{ const sh=gl.createShader(t); gl.shaderSource(sh,s); gl.compileShader(sh); if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)+'\n'+s.slice(0,200)); return sh; };
    const p=gl.createProgram(); gl.attachShader(p,mk(gl.VERTEX_SHADER,vs)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('Link: '+gl.getProgramInfoLog(p)); p.u={}; return p; }
  U(p,n){ return p.u[n]!==undefined?p.u[n]:(p.u[n]=this.gl.getUniformLocation(p,n)); }
  rt(w,h,lin,mip,ifmt,fmt){ const gl=this.gl, t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,ifmt||gl.RGBA16F,w,h,0,fmt||gl.RGBA,gl.HALF_FLOAT,null);
    const f=lin?gl.LINEAR:gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:f); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);
    const wr=mip||w===EW?gl.REPEAT:gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wr); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wr);
    const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0); return {t,fb,w,h}; }
  resize(w,h){ this.W=w; this.H=h; this.cv.width=w; this.cv.height=h; const s=this.q; const sw=Math.round(w*s), sh=Math.round(h*s);
    for(const r of [this.scene,this.b1,this.b2]) if(r){ this.gl.deleteTexture(r.t); this.gl.deleteFramebuffer(r.fb); }
    this.scene=this.rt(sw,sh,true); this.b1=this.rt(sw>>2,sh>>2,true); this.b2=this.rt(sw>>2,sh>>2,true); }
  calidad(q){ if(Math.abs(q-this.q)<.01) return; this.q=q; this.resize(this.W,this.H); }
  // ---- escritura
  sella(list){ for(const s of list) this.pend.push(s); }
  _flushStamps(){
    const gl=this.gl; if(!this.pend.length) return; const ps=this.P.stamp;
    gl.useProgram(ps); gl.uniform2f(this.U(ps,'slab'),SLAB[0],SLAB[1]); gl.bindVertexArray(this.vaoS); gl.enable(gl.BLEND);
    while(this.pend.length){ const n=Math.min(this.MAXI,this.pend.length); const d=this.idata;
      for(let i=0;i<n;i++){ const s=this.pend[i], o=i*10; d[o]=s.u; d[o+1]=s.v; d[o+2]=s.w; d[o+3]=s.h; d[o+4]=s.tipo; d[o+5]=s.seed; d[o+6]=s.prof; d[o+7]=s.emis; d[o+8]=s.giro||0; d[o+9]=s.brillo||0; }
      gl.bindBuffer(gl.ARRAY_BUFFER,this.ib); gl.bufferSubData(gl.ARRAY_BUFFER,0,d.subarray(0,n*10));
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.Hm.fb); gl.viewport(0,0,HW,HH);
      gl.blendFunc(gl.DST_COLOR,gl.ZERO); gl.uniform1i(this.U(ps,'modo'),0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n);
      gl.blendFunc(gl.ONE,gl.ONE); gl.uniform1i(this.U(ps,'modo'),1); gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.Em[this.cur].fb); gl.viewport(0,0,EW,EH);
      gl.uniform1i(this.U(ps,'modo'),2); gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n);
      this.pend.splice(0,n); }
    gl.disable(gl.BLEND); gl.bindVertexArray(null); this.sucio=true;
  }
  _decay(dt,pol){ const gl=this.gl, a=this.Em[this.cur], b=this.Em[1-this.cur], p=this.P.decay;
    gl.bindFramebuffer(gl.FRAMEBUFFER,b.fb); gl.viewport(0,0,EW,EH); gl.useProgram(p); gl.bindVertexArray(this.vaoF);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,a.t); gl.uniform1i(this.U(p,'T'),0); gl.uniform1f(this.U(p,'dt'),dt); gl.uniform3f(this.U(p,'pol'),pol[0],pol[1],pol[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); this.cur=1-this.cur; }
  pule(dt,pol){ if(!pol||pol[2]<=0) return; const gl=this.gl, p=this.P.polish;
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.Hm.fb); gl.viewport(0,0,HW,HH); gl.useProgram(p); gl.bindVertexArray(this.vaoF);
    gl.enable(gl.BLEND); gl.blendFunc(gl.DST_COLOR,gl.ZERO); gl.uniform1f(this.U(p,'dt'),dt); gl.uniform3f(this.U(p,'pol'),pol[0],pol[1],pol[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); gl.disable(gl.BLEND); this.sucio=true; }
  avanza(dt,pol){ dt=Math.min(dt,.25); this._decay(dt,pol||[0,0,0]); this.pule(dt,pol); this._flushStamps(); }
  // mip de la altura: solo cuando ha cambiado y como mucho cada 3 frames (lo lejano no necesita más)
  _mip(force){ this.nf++; if(!this.sucio || (!force && this.nf%3)) return; const gl=this.gl; gl.bindTexture(gl.TEXTURE_2D,this.Hm.t); gl.generateMipmap(gl.TEXTURE_2D); this.sucio=false; }
  // ---- dibujo
  pass(p,target,setup){ const gl=this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.fb:null); gl.viewport(0,0,target?target.w:this.W,target?target.h:this.H); gl.useProgram(p); gl.bindVertexArray(this.vaoF); setup(p); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); }
  tex(p,n,t,unit){ const gl=this.gl; gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,t); gl.uniform1i(this.U(p,n),unit); }
  dibuja(C){
    const gl=this.gl, U=(p,n)=>this.U(p,n); this._mip(C.render);
    this.pass(this.P.scene,this.scene,p=>{ this.tex(p,'H',this.Hm.t,0); this.tex(p,'E',this.Em[this.cur].t,1);
      gl.uniform2f(U(p,'res'),this.scene.w,this.scene.h); gl.uniform2f(U(p,'texel'),1/HW,1/HH); gl.uniform2f(U(p,'slab'),SLAB[0],SLAB[1]);
      const cam=C.cam; gl.uniform3fv(U(p,'cp'),cam.p); gl.uniform3fv(U(p,'cf'),cam.f); gl.uniform3fv(U(p,'cr'),cam.r); gl.uniform3fv(U(p,'cu'),cam.u);
      gl.uniform1f(U(p,'fov'),cam.fov); gl.uniform1f(U(p,'foco'),cam.foco); gl.uniform1f(U(p,'apert'),cam.apert);
      gl.uniform1f(U(p,'tiempo'),C.t); gl.uniform1f(U(p,'pulso'),C.pulso); gl.uniform1f(U(p,'rake'),C.rake); gl.uniform1f(U(p,'tira'),C.tira); gl.uniform1f(U(p,'depthK'),.009); gl.uniform1f(U(p,'ruptura'),C.ruptura); gl.uniform1f(U(p,'polvo'),C.polvo||0);
      gl.uniform3fv(U(p,'acento'),C.acento); gl.uniform3fv(U(p,'bar0'),C.bar0); gl.uniform3fv(U(p,'barD'),C.barD); gl.uniform1f(U(p,'barL'),C.barL); gl.uniform1f(U(p,'barW'),C.barW); gl.uniform3fv(U(p,'rakeL'),C.rakeL); gl.uniform3fv(U(p,'pool'),C.pool); });
    this.pass(this.P.bright,this.b1,p=>{ this.tex(p,'T',this.scene.t,0); gl.uniform2f(U(p,'texel'),1/this.scene.w,1/this.scene.h); });
    for(let i=0;i<2;i++){
      this.pass(this.P.blur,this.b2,p=>{ this.tex(p,'T',this.b1.t,0); gl.uniform2f(U(p,'dir'),1/this.b1.w,0); });
      this.pass(this.P.blur,this.b1,p=>{ this.tex(p,'T',this.b2.t,0); gl.uniform2f(U(p,'dir'),0,1/this.b1.h); }); }
    this.pass(this.P.final,null,p=>{ this.tex(p,'T',this.scene.t,0); this.tex(p,'B',this.b1.t,1);
      gl.uniform2f(U(p,'res'),this.W,this.H); gl.uniform2f(U(p,'texel'),1/this.scene.w,1/this.scene.h); gl.uniform1f(U(p,'tiempo'),C.t);
      gl.uniform1f(U(p,'grano'),.006); gl.uniform1f(U(p,'expo'),C.expo); gl.uniform1f(U(p,'fade'),C.fade); gl.uniform1f(U(p,'dof'),C.dof); });
  }
}
// ---- dónde escribe cada idioma: cada wiki tiene su fila y su cursor, como un renglón
class Escritura{
  constructor(seed){ this.cur={}; this.seed=seed; this.r=rng(seed*17+1); this.ultimo={u:.5,v:.5}; this.ultGrande={u:.5,v:.5,t:0}; }
  fila(wiki){ if(!this.cur[wiki]){ const h=hashStr(wiki); this.cur[wiki]={row:h%ROWS, x:(h>>>8)%1000/1000*.9+.05, salto:7+(h>>>4)%11}; } return this.cur[wiki]; }
  sello(e,suena){
    const c=this.fila(e.wiki), r=this.r; const rowH=SLAB[1]/ROWS;
    const big=Math.abs(e.delta);
    const chars=e.kind==='log'?1:Math.max(1,Math.min(9,Math.round(Math.log10(big+1)*1.6)));
    const gh=rowH*(e.bot?.62:.78), gw=gh*5/7, gap=gw*.32;
    const out=[];
    if(c.x+chars*(gw+gap)/SLAB[0]>.985){ c.x=.015; c.row=(c.row+c.salto)%ROWS; }
    const v=(c.row+.5)/ROWS, jit=e.bot?0:(r()-.5)*.08;
    for(let i=0;i<chars;i++){
      const u=c.x+(gw*.5)/SLAB[0];
      const tipo=e.kind==='del'?2: e.bot?1: 0;
      const emis=e.kind==='new'?1.5: suena?.9: e.kind==='log'?0: e.bot?.08:.22;
      out.push({u, v:v+(e.bot?0:(r()-.5)*.0012), w:gw*(e.kind==='del'?1.25:1), h:gh, tipo, seed:r(), prof:e.kind==='log'?.35:(e.bot?.6:.9+Math.min(.5,big/20000)), emis, giro:jit*.15, brillo:suena?1:.15});
      c.x+=(gw+gap)/SLAB[0];
    }
    c.x+=gap*2/SLAB[0];
    this.ultimo={u:out[0].u,v};
    if(!e.bot && big>1500) this.ultGrande={u:out[0].u,v,t:e.t};
    return out;
  }
  grieta(e){ // la grieta nace en el renglón de la guerra de ediciones, pero cruza el cuerpo de la losa
    const r=this.r; const f=e?this.fila(e.wiki):null;
    const u=.36+(f?f.x:r())*.28, v=.3+(f?(f.row+.5)/ROWS:r())*.4;
    const ang=(r()-.5)*.7, ram=ang+(r()<.5?1:-1)*(.6+r()*.5);
    return [{u,v,w:SLAB[0]*1.05,h:1.0,tipo:3,seed:r()*100,prof:1,emis:2.2,giro:ang,brillo:1.4},
            {u:u+Math.cos(ram)*.08,v:v+Math.sin(ram)*.12,w:SLAB[0]*(.3+r()*.25),h:.7,tipo:3,seed:r()*100,prof:1,emis:1.8,giro:ram,brillo:1.2}]; }
}
if(typeof window!=='undefined'){ window.Imagen=Imagen; window.Escritura=Escritura; window.SLAB=SLAB; window.ROWS=ROWS; }
