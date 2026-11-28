// ======================================================================
// VØID_LOOM · MENSAJERO — escena.js (motor de imagen, el mismo en consola, salida y render)
// La antena DSN de 70 m (modelo real de NASA 3D Resources) apunta donde apunta la de verdad.
// A oscuras es una silueta negra que tapa las estrellas. En el cielo, la nave es un punto de luz.
// Cada paquete de su señal baja por el eje como una onda plana que REVELA la antena en puntos de luz.
// En la RUPTURA, los fotones escriben el nombre de la nave en el cielo y caen al foco.
// ======================================================================
import * as THREE from './vendor/three.js';

export async function crear(opts){
  const W0=opts.w, H0=opts.h, ACC=new THREE.Color(opts.acento||'#e9eef7');
  const R=new THREE.WebGLRenderer({canvas:opts.canvas,antialias:false,preserveDrawingBuffer:!!opts.render,powerPreference:'high-performance'});
  R.setPixelRatio(1); R.setSize(W0,H0,false);
  const S=new THREE.Scene(); const cam=new THREE.PerspectiveCamera(40,W0/H0,.3,6000);
  let W=W0, H=H0;

  // ---------------------------------------------------------- cielo
  const cielo=new THREE.Mesh(new THREE.SphereGeometry(4000,64,32),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:`varying vec3 d; void main(){ d=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader:`varying vec3 d;
    float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
    float vn(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+1.),f.x),f.y),f.z); }
    void main(){ vec3 n=normalize(d); vec3 col=vec3(0);
      for(int k=0;k<2;k++){ float sc=k==0?220.:480.; vec3 c=floor(n*sc); vec3 f=fract(n*sc)-.5; float r=h(c+float(k)*17.);
        float b=pow(r,k==0?140.:110.)*(k==0?2.6:1.1); float s=exp(-dot(f,f)*(k==0?90.:140.)); col+=vec3(.85,.9,1.)*b*s; }
      vec3 g=normalize(vec3(.32,.62,-.71)); float band=exp(-pow(dot(n,g),2.)*14.); float dust=vn(n*7.)*.6+vn(n*17.)*.4;
      col+=vec3(.55,.6,.72)*band*(.012+.05*dust*dust*dust)*smoothstep(-.05,.2,n.y);
      float az=atan(n.z,n.x); float sierra=.012+.03*vn(vec3(az*2.2,3.,0.))+.012*vn(vec3(az*9.,7.,0.))+.004*vn(vec3(az*40.,1.,0.));
      col+=vec3(.36,.42,.55)*exp(-max(n.y-sierra,0.)*9.)*.045;
      col*=smoothstep(sierra-.0015,sierra+.0015,n.y); gl_FragColor=vec4(col,1.); }`}));
  cielo.renderOrder=-10; S.add(cielo);

  // ---------------------------------------------------------- el modelo
  // DOS MODELOS REALES DE NASA: la de 70 m (DSS14, DSS43, DSS63) y la de 34 m (el resto). Se ve la que se escucha.
  const negro=new THREE.MeshBasicMaterial({color:0x010101,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const calidad=opts.calidad??1;
  const DENS={panel:24,celosia:70,cuadripode:70,receptor:40,estructura:9,baranda:40,hormigon:6};
  const GID={fijo:0,azimut:1,elevacion:2};
  let sem=12345; const rnd=()=>{ sem=(sem*16807)%2147483647; return sem/2147483647; };
  async function construye(url){
  const buf=await (await fetch(url)).arrayBuffer();
  const hl=new DataView(buf).getUint32(0,true); const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl))); const base=4+hl;
  const G={fijo:new THREE.Group(),azimut:new THREE.Group(),elevacion:new THREE.Group()};
  S.add(G.fijo); S.add(G.azimut); G.azimut.add(G.elevacion); G.elevacion.position.set(...head.ejeElevacion);
  const P=[], N=[], K=[]; let fy=0;
  for(const p of head.piezas){
    let o=base+p.pos; const pos=new Float32Array(buf,o,p.nv*3); o+=p.nv*12; const nor=new Float32Array(buf,o,p.nv*3); o+=p.nv*12; const idx=new Uint32Array(buf,o,p.ni);
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(new THREE.BufferAttribute(idx,1));
    G[p.grupo].add(new THREE.Mesh(g,negro));
    if(p.nombre==='quad'){ g.computeBoundingBox(); fy=g.boundingBox.max.y; }
    const d=(DENS[p.mat]||8)*calidad, mid=['panel','celosia','cuadripode','receptor','estructura','baranda','hormigon'].indexOf(p.mat);
    let acc=rnd();
    for(let t=0;t<p.ni;t+=3){ const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3;
      const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2], vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
      const cx=uy*vz-uz*vy, cy=uz*vx-ux*vz, cz=ux*vy-uy*vx; const area=.5*Math.hypot(cx,cy,cz);
      acc+=area*d; let n=Math.floor(acc); acc-=n; n=Math.min(n,400);
      for(let k=0;k<n;k++){ let r1=rnd(), r2=rnd(); if(r1+r2>1){ r1=1-r1; r2=1-r2; }
        P.push(pos[a]+ux*r1+vx*r2, pos[a+1]+uy*r1+vy*r2, pos[a+2]+uz*r1+vz*r2); N.push(nor[a],nor[a+1],nor[a+2]); K.push(GID[p.grupo],mid,rnd()); } }
  }
  const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); pg.setAttribute('nrm',new THREE.Float32BufferAttribute(N,3)); pg.setAttribute('k',new THREE.Float32BufferAttribute(K,3));
  const d=head.diametro||70;
  return {G,pg,fy,d,cy:d===34?6.9:14,eleY:head.ejeElevacion[1]};
  }
  const MOD={70:await construye(opts.modelo||'modelo/dsn70.bin'),34:await construye(opts.modelo34||'modelo/dsn34.bin')};
  let A=MOD[70], G=A.G, fy=A.fy;

  // ---------------------------------------------------------- uniforms comunes
  const U={T:{value:0},Mfijo:{value:new THREE.Matrix4()},Maz:{value:new THREE.Matrix4()},Mel:{value:new THREE.Matrix4()},
    eje:{value:new THREE.Vector3()},foco:{value:new THREE.Vector3()},golpes:{value:new Float32Array(8).fill(-99)},acc:{value:ACC},px:{value:H0/720},sen:{value:1},camP:{value:new THREE.Vector3()},
    celdas:{value:null},nCeldas:{value:0},tNombre:{value:-99},anchoNombre:{value:1}};

  // ---------------------------------------------------------- la antena en puntos, revelada por la onda
  const pm=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 nrm; attribute vec3 k; uniform mat4 Mfijo,Maz,Mel; uniform vec3 eje,foco,camP,acc; uniform float T,golpes[8],px,sen; varying vec3 vC;
    void main(){ mat4 M=k.x<.5?Mfijo:(k.x<1.5?Maz:Mel); vec4 wp=M*vec4(position,1.); vec3 wn=normalize(mat3(M)*nrm);
      float s=dot(wp.xyz-foco,eje); float lum=0., blanco=0.; bool mid0=k.y<.5;
      for(int i=0;i<8;i++){ float th=golpes[i]; float age=T-th; if(age<-1.2||age>4.) continue;
        float sf=-60.*(age+.25); float x=(s-sf)/3.6; float frente=exp(-x*x);
        float estela=s>sf?exp(-(s-sf)/22.)*exp(-max(age+.25,0.)*.9)*.55+.12*exp(-max(age+.25,0.)*.45):0.;
        float dist=length(wp.xyz-foco); float foc=age>0.?exp(-dist/3.5)*exp(-age*4.)*.15:0.;
        lum+=frente*(mid0?.42:.62)+estela+foc; blanco+=frente; }
      float mid=k.y; float junta=1.;
      if(mid<.5){ float r=length(position.xz); float an=atan(position.z,position.x); float ring=abs(fract(r/2.9)-.5); float rad=abs(fract(an/6.2832*(24.+floor(r/2.9)*6.))-.5);
        junta=.35+2.2*smoothstep(.4,.5,max(ring,rad)); }
      float g=mid<.5?.3:mid<1.5?.75:mid<2.5?.45:mid<3.5?.3:mid<4.5?.12:mid<5.5?.3:mid<6.5?.1:.22;
      float vivo=(mid<.5?.016:mid<1.5?.02:mid>5.5?.002:.008)*sen;
      lum=lum*g*junta*sen+vivo*(mid<.5?junta*.6:1.);
      vec3 V=normalize(camP-wp.xyz); lum*=.55+.45*abs(dot(wn,V)); if(k.x<.5) lum*=.28;
      vec4 mv=viewMatrix*wp; gl_Position=projectionMatrix*mv;
      float dz=-mv.z; gl_PointSize=clamp(px*(1.6+k.z*1.2)*(60./dz),1.,4.)*(1.+blanco*.4); lum*=smoothstep(5.,30.,dz);
      float bruma=1.-exp(-dz/420.); vC=mix(mix(vec3(1.,.97,.92),acc,.35),vec3(.55,.64,.82),bruma)*lum*(1.-bruma*.55); if(lum<.002) gl_Position=vec4(9.,9.,9.,1.); }`,
    fragmentShader:`varying vec3 vC; void main(){ vec2 q=gl_PointCoord-.5; float a=1.-smoothstep(.15,.5,length(q)); gl_FragColor=vec4(vC*a,1.); }`});
  for(const m of Object.values(MOD)){ m.nube=new THREE.Points(m.pg,pm); m.nube.frustumCulled=false; S.add(m.nube); }
  // la antena que se escucha: 70 m o 34 m (solo una visible)
  function usa(d){ const m=MOD[d===34?34:70]; if(m===A&&m.nube.visible) return;
    for(const x of Object.values(MOD)){ const v=x===m; x.G.fijo.visible=v; x.G.azimut.visible=v; x.nube.visible=v; }
    A=m; G=m.G; fy=m.fy; }
  usa(70);

  // ---------------------------------------------------------- la nave, sus fotones y su nombre
  const NF=2400; const fg=new THREE.BufferGeometry(); { const a=new Float32Array(NF*3), kk=[], ii=[]; for(let i=0;i<NF;i++){ kk.push(rnd(),rnd(),rnd()); ii.push(i); } fg.setAttribute('position',new THREE.BufferAttribute(a,3)); fg.setAttribute('k',new THREE.Float32BufferAttribute(kk,3)); fg.setAttribute('ix',new THREE.Float32BufferAttribute(ii,1)); }
  const fm=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 k; attribute float ix; uniform vec3 eje,foco; uniform float T,golpes[8],px,sen,nCeldas,tNombre,anchoNombre; uniform sampler2D celdas; varying float vL;
    void main(){ vec3 lado=normalize(cross(eje,vec3(0,1,0))), arr=cross(lado,eje);
      float L=900.; vL=0.; vec3 p=foco+eje*L; float tam=1.;
      float tn=T-tNombre;
      // EL NOMBRE: en la RUPTURA, los fotones se ordenan en las letras de la nave (MATRIZ 5×7) en el cielo y luego caen
      if(nCeldas>0. && tn>-.05 && tn<3.2 && ix<nCeldas*4.){
        float ci=mod(ix,nCeldas); vec4 c=texture2D(celdas,vec2((ci+.5)/nCeldas,.5));
        float cel=9.*anchoNombre; vec3 Cn=foco+eje*520.;
        vec3 j=(lado*(k.y-.5)+arr*(k.z-.5))*cel*.55;
        vec3 sitio=Cn+lado*(c.x*cel)+arr*(-c.y*cel)+j;
        vec3 disperso=Cn+(lado*(k.x-.5)+arr*(k.y-.5))*600.+eje*(k.z-.5)*200.;
        float junta=smoothstep(0.,.55,tn);
        p=mix(disperso,sitio,junta);
        float cae=smoothstep(1.5,3.1,tn); float e=cae*cae*cae; p=mix(p,foco,e);
        vL=(1.-cae*.5)*smoothstep(0.,.2,tn)*1.4; tam=1.6;
      } else {
        int g=int(k.x*8.); float th=golpes[g]; float u=1.-((th-.25)-T)/2.4+(k.y-.5)*.06;
        if(u>0.&&u<1.&&ix<1100.){ float e=u*u*u; p=foco+eje*L*(1.-e); vL=(.4+.6*u)*sen; }
        else if(k.z<.35&&ix<1100.){ float uu=fract(k.y+T*.18); p=foco+eje*L*(1.-uu*uu*uu); vL=.18*sen*uu; }
        p+=(lado*(k.y-.5)+arr*(k.z-.5))*(.6+(1.-vL)*1.);
      }
      vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(clamp(px*3.*(120./-mv.z),1.,5.)+px*2.)*tam;
      if(vL<.01) gl_Position=vec4(9.,9.,9.,1.); }`,
    fragmentShader:`uniform vec3 acc; varying float vL; void main(){ vec2 q=gl_PointCoord-.5; float a=1.-smoothstep(0.,.5,length(q)); gl_FragColor=vec4(mix(vec3(.85,.9,1.),acc,.5)*vL*a*2.2,1.); }`});
  const fotones=new THREE.Points(fg,fm); fotones.frustumCulled=false; S.add(fotones);
  const nm=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform vec3 eje,foco; uniform float px; void main(){ vec4 mv=viewMatrix*vec4(foco+eje*2400.,1.); gl_Position=projectionMatrix*mv; gl_PointSize=px*26.; }`,
    fragmentShader:`uniform float T,sen,golpes[8]; uniform vec3 acc; void main(){ vec2 q=gl_PointCoord-.5; float r=length(q); float pul=0.; for(int i=0;i<8;i++){ float a=T-(golpes[i]-2.65); if(a>0.&&a<.6) pul+=exp(-a*5.); }
      float core=exp(-r*r*900.)*1.8+exp(-r*r*120.)*.35*(1.+pul*2.); gl_FragColor=vec4(mix(vec3(.9,.94,1.),acc,.4)*core*(.5+.5*sen),1.); }`});
  const nave=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3)),nm); nave.frustumCulled=false; S.add(nave);

  // nombre → celdas encendidas de la MATRIZ (textura de posiciones)
  let nombreActual='';
  function ponNombre(nombre){
    nombre=(nombre||'').toUpperCase().slice(0,16); const vert=cam.aspect<1; if(nombre+vert===nombreActual) return; nombreActual=nombre+vert;
    // en vertical (Reel), una palabra por línea
    const lineas=vert?nombre.split(' ').filter(Boolean):[nombre]; const nl=lineas.length; let n=1; const cel=[];
    lineas.forEach((L,li)=>{ n=Math.max(n,L.length); for(let i=0;i<L.length;i++){ const g=(typeof glifoM!=='undefined')?glifoM(L[i]):0; for(let r=0;r<7;r++) for(let c=0;c<5;c++) if(Math.floor(g/2**(34-(r*5+c)))%2) cel.push((i*6+c)-(L.length*6-1)/2, r-3+(li-(nl-1)/2)*9); } });
    const m=Math.max(1,cel.length/2), data=new Float32Array(m*4); for(let i=0;i<cel.length/2;i++){ data[i*4]=cel[i*2]; data[i*4+1]=cel[i*2+1]; }
    if(U.celdas.value) U.celdas.value.dispose();
    const t=new THREE.DataTexture(data,m,1,THREE.RGBAFormat,THREE.FloatType); t.needsUpdate=true; U.celdas.value=t; U.nCeldas.value=cel.length/2; U.anchoNombre.value=Math.min(1,8/Math.max(1,n))*(vert?Math.min(1,cam.aspect/1.778*1.25):1); }

  // ---------------------------------------------------------- posproceso propio: profundidad de campo, bloom, ACES, grano
  let rt,b1,b2,accA,accB,ultPlano='';
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2)); const oc=new THREE.OrthographicCamera(-1,1,1,-1,0,1); const qs=new THREE.Scene(); qs.add(quad);
  const VQ=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  const Mb=new THREE.ShaderMaterial({uniforms:{t:{value:null},px:{value:new THREE.Vector2()}},vertexShader:VQ,fragmentShader:`uniform sampler2D t; uniform vec2 px; varying vec2 vUv; void main(){ vec3 c=vec3(0); for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) c+=min(texture2D(t,vUv+vec2(i,j)*px*2.).rgb,vec3(20.)); c/=9.; float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(.9,2.6,l),1.); }`});
  const Mbl=new THREE.ShaderMaterial({uniforms:{t:{value:null},dir:{value:new THREE.Vector2()}},vertexShader:VQ,fragmentShader:`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c=texture2D(t,vUv).rgb*.227; float w[4]; w[0]=.194; w[1]=.121; w[2]=.054; w[3]=.016; for(int i=0;i<4;i++){ vec2 d=dir*float(i+1)*1.7; c+=(texture2D(t,vUv+d).rgb+texture2D(t,vUv-d).rgb)*w[i]; } gl_FragColor=vec4(c,1.); }`});
  const Mf=new THREE.ShaderMaterial({uniforms:{t:{value:null},dep:{value:null},bl:{value:null},res:{value:new THREE.Vector2()},near:{value:cam.near},far:{value:cam.far},foco:{value:50},apert:{value:1},tt:{value:0},expo:{value:1}},vertexShader:VQ,
    fragmentShader:`uniform sampler2D t,dep,bl; uniform vec2 res; uniform float near,far,foco,apert,tt,expo; varying vec2 vUv;
    float lin(float d){ float z=d*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
    float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){ float z=lin(texture2D(dep,vUv).r); float coc=clamp(abs(z-foco)/max(z,.1)*apert,0.,1.);
      vec3 acc=texture2D(t,vUv).rgb; float ws=1.;
      if(coc>.02){ float Rr=coc*res.y*.02; for(int i=0;i<24;i++){ float a=float(i)*2.39996; float rr=sqrt(float(i)+.5)/sqrt(24.)*Rr; vec2 o=vec2(cos(a),sin(a))*rr/res; vec3 s=texture2D(t,vUv+o).rgb; float zs=lin(texture2D(dep,vUv+o).r); float cs=clamp(abs(zs-foco)/max(zs,.1)*apert,0.,1.); float w=smoothstep(0.,.5,cs)+.08; acc+=s*w; ws+=w; } }
      vec3 c=acc/ws+texture2D(bl,vUv).rgb*.28; c*=expo; c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);
      vec2 q=vUv-.5; c*=1.-dot(q,q)*.7; c+=(h1(vUv*res+fract(tt*13.)*91.)-.5)*.005*(.3+c);
      gl_FragColor=vec4(pow(max(c,0.),vec3(1./2.2)),1.); }`});
  const Macc=new THREE.ShaderMaterial({uniforms:{cur:{value:null},prev:{value:null},decay:{value:.9}},vertexShader:VQ,fragmentShader:`uniform sampler2D cur,prev; uniform float decay; varying vec2 vUv; void main(){ vec3 c=texture2D(cur,vUv).rgb, p=texture2D(prev,vUv).rgb*decay; gl_FragColor=vec4(max(c,p),1.); }`});
  function pase(m,target){ quad.material=m; R.setRenderTarget(target); R.render(qs,oc); }
  function resize(w,h){ W=w; H=h; R.setSize(w,h,false); cam.aspect=w/h; U.px.value=h/720;
    [rt,b1,b2,accA,accB].forEach(x=>x&&x.dispose());
    rt=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType}); rt.depthTexture=new THREE.DepthTexture(w,h); rt.depthTexture.type=THREE.FloatType;
    b1=new THREE.WebGLRenderTarget(w>>2,h>>2,{type:THREE.HalfFloatType}); b2=b1.clone();
    accA=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType}); accB=accA.clone(); ultPlano='';
    Mb.uniforms.px.value.set(1/w,1/h); Mf.uniforms.res.value.set(w,h); Mf.uniforms.t.value=rt.texture; Mf.uniforms.dep.value=rt.depthTexture; Mf.uniforms.bl.value=b1.texture; }
  resize(W0,H0);

  // ---------------------------------------------------------- apuntar (con giro suave, como la real) y planos
  const az={v:opts.az??105}, el={v:opts.el??51};
  function apunta(a,e){ G.elevacion.rotation.x=-(Math.PI/2-e*Math.PI/180); G.azimut.rotation.y=-a*Math.PI/180; S.updateMatrixWorld(true); }
  const eje=()=>new THREE.Vector3(0,1,0).applyQuaternion(G.elevacion.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const centro=()=>G.elevacion.localToWorld(new THREE.Vector3(0,A.cy,0));
  const focoW=()=>G.elevacion.localToWorld(new THREE.Vector3(0,fy-3.5,0));
  const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const PLANOS={
    // GIRO: cámara fija en el mundo (no sigue a la antena): al cambiar de escucha se ve la antena girar hasta su posición real
    GIRO:(tl)=>{ const c=centro(); cam.fov=34-tl*.25; cam.position.set(-170+tl*1.2,9,150); cam.lookAt(c.x,c.y+4,c.z); return cam.position.distanceTo(c); },
    HEROE:(tl)=>{ const c=centro(), a=eje(); const h=V3(a.x,0,a.z).normalize(), lado=V3(h.z,0,-h.x); cam.fov=58; cam.position.copy(c).addScaledVector(h,22-tl*.5).addScaledVector(lado,-58+tl*.8); cam.position.y=1.6; cam.lookAt(c.x,c.y+4,c.z); return cam.position.distanceTo(c); },
    // BAJO: a ras de suelo junto al pedestal; la antena encima, desbordando el encuadre
    BAJO:(tl)=>{ const c=centro(), a=eje(); const h=V3(a.x,0,a.z).normalize(), lado=V3(h.z,0,-h.x); cam.fov=70; cam.position.copy(V3(0,0,0)).addScaledVector(h,34+tl*.3).addScaledVector(lado,30); cam.position.y=1.4; cam.lookAt(c.clone().addScaledVector(h,10).add(V3(0,10+tl*.4,0))); return cam.position.distanceTo(c); },
    // PERFIL: teleobjetivo desde lejos; el canto del cuenco cruza la Vía Láctea
    PERFIL:(tl)=>{ const c=centro(), a=eje(); const h=V3(a.x,0,a.z).normalize(), lado=V3(h.z,0,-h.x); cam.fov=13-tl*.08; cam.position.copy(c).addScaledVector(lado,-380).addScaledVector(h,-90); cam.position.y=3; cam.lookAt(c.x,c.y+10,c.z); return cam.position.distanceTo(c); },
    CIELO:(tl)=>{ const c=centro(), a=eje(), f=focoW(); const lado=new THREE.Vector3().crossVectors(a,V3(0,1,0)).normalize(); cam.fov=58-tl*.4; cam.position.copy(c).addScaledVector(a,-4).addScaledVector(lado,9); cam.lookAt(f.clone().addScaledVector(a,140).addScaledVector(lado,-14)); return 300; },
    // NOMBRE: junto al borde del cuenco, mirando al punto del cielo donde la nave escribe su nombre
    NOMBRE:(tl)=>{ const c=centro(), a=eje(), f=focoW(); const lado=new THREE.Vector3().crossVectors(a,V3(0,1,0)).normalize(); const up=new THREE.Vector3().crossVectors(lado,a); const tg=f.clone().addScaledVector(a,520); cam.fov=50-tl*.5; cam.position.copy(c).addScaledVector(lado,44).addScaledVector(up,-26).addScaledVector(a,-8+tl*1.5); cam.lookAt(tg.clone().addScaledVector(up,-70)); return cam.position.distanceTo(tg); },
    CUENCO:(tl)=>{ const c=centro(), a=eje(); const lado=new THREE.Vector3().crossVectors(a,V3(0,1,0)).normalize(); cam.fov=36-tl*.3; cam.position.copy(c).addScaledVector(a,92-tl*1.1).addScaledVector(lado,24); cam.lookAt(c.clone().addScaledVector(a,8)); return cam.position.distanceTo(c)-6; },
    NOCHE:(tl)=>{ const c=centro(), a=eje(); const h=V3(a.x,0,a.z).normalize(), lado=V3(h.z,0,-h.x); cam.fov=26-tl*.1; cam.position.copy(c).addScaledVector(lado,-300+tl*2).addScaledVector(h,-50); cam.position.y=6; cam.lookAt(c.x,c.y*.7,c.z); return cam.position.distanceTo(c); },
  };
  function dibuja(st,dt){
    // la antena gira a su posición real a la velocidad de una antena de 70 m (≈0,25°/s)
    const vel=(dt??1/30)*.25*(st.giroRapido?100:1);
    const da=((st.az-az.v+540)%360)-180; az.v+=Math.sign(da)*Math.min(Math.abs(da),vel); const de=st.el-el.v; el.v+=Math.sign(de)*Math.min(Math.abs(de),vel);
    usa(st.diametro||70); apunta(az.v,el.v); ponNombre(st.nombre);
    const gl=(st.golpes||[]).concat(Array(8).fill(-99)).slice(0,8); U.golpes.value.set(gl);
    U.T.value=st.t; U.sen.value=st.sen; U.eje.value.copy(eje()); U.foco.value.copy(focoW()); U.tNombre.value=st.tNombre??-99;
    U.Mfijo.value.copy(G.fijo.matrixWorld); U.Maz.value.copy(G.azimut.matrixWorld); U.Mel.value.copy(G.elevacion.matrixWorld);
    let fd=PLANOS[st.plano](st.tl||0);
    // con la de 34 m los planos se acercan a su escala (menos el GIRO, donde se ve que es más pequeña, y el NOMBRE, que mira al cielo)
    if(A.d===34&&st.plano!=='GIRO'&&st.plano!=='NOMBRE'){ const k=.5, c=centro(), p0=cam.position.clone(), dir=new THREE.Vector3(); cam.getWorldDirection(dir);
      const T=p0.clone().addScaledVector(dir,p0.distanceTo(c)); const np=c.clone().add(p0.clone().sub(c).multiplyScalar(k)); if(p0.y<12) np.y=p0.y;
      cam.position.copy(np); cam.lookAt(c.clone().add(T.sub(c).multiplyScalar(k))); fd*=k; }
    if(st.optica&&st.plano!=='NOMBRE') cam.fov=Math.min(80,cam.fov*st.optica); cam.aspect=W/H; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); U.camP.value.copy(cam.position);
    R.setRenderTarget(rt); R.setClearColor(0x000000,1); R.clear(); R.render(S,cam);
    // larga exposición: max(actual, anterior·decaimiento); un corte de plano la reinicia
    const corte=st.plano!==ultPlano; ultPlano=st.plano;
    Macc.uniforms.cur.value=rt.texture; Macc.uniforms.prev.value=accA.texture; Macc.uniforms.decay.value=corte?0:Math.pow(.035,(dt??1/30));
    pase(Macc,accB); [accA,accB]=[accB,accA];
    Mf.uniforms.t.value=accA.texture;
    Mb.uniforms.t.value=accA.texture; pase(Mb,b1);
    for(let i=0;i<2;i++){ Mbl.uniforms.t.value=b1.texture; Mbl.uniforms.dir.value.set(1/b1.width,0); pase(Mbl,b2); Mbl.uniforms.t.value=b2.texture; Mbl.uniforms.dir.value.set(0,1/b1.height); pase(Mbl,b1); }
    Mf.uniforms.foco.value=fd; Mf.uniforms.apert.value=st.plano==='CIELO'||st.plano==='NOMBRE'?.12:.35; Mf.uniforms.tt.value=st.t; Mf.uniforms.expo.value=st.expo??1;
    pase(Mf,null);
  }
  return {dibuja,resize,canvas:R.domElement,setAz:(a,e)=>{ az.v=a; el.v=e; }};
}
