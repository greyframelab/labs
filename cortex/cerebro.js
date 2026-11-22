function genBrain(P){
const pos=[],att=[],nrm=[],lpos=[],latt=[],lnrm=[];
function hs(x,y,z){let a=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return a-Math.floor(a);}
function vn(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let fx=x-ix,fy=y-iy,fz=z-iz;
 fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);const L=(a,b,t)=>a+(b-a)*t;
 return L(L(L(hs(ix,iy,iz),hs(ix+1,iy,iz),fx),L(hs(ix,iy+1,iz),hs(ix+1,iy+1,iz),fx),fy),
          L(L(hs(ix,iy,iz+1),hs(ix+1,iy,iz+1),fx),L(hs(ix,iy+1,iz+1),hs(ix+1,iy+1,iz+1),fx),fy),fz);}
function sdE(p,c,r){const q=[(p[0]-c[0])/r[0],(p[1]-c[1])/r[1],(p[2]-c[2])/r[2]];const k0=Math.hypot(...q);
 const k1=Math.hypot(q[0]/r[0],q[1]/r[1],q[2]/r[2]);return k0*(k0-1)/k1;}
function smin(a,b,k){const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return b+(a-b)*h-k*h*(1-h);}
function shape(p){
  const sz=Math.max(0,Math.min(1,(p[2]+.1)/1.1)); const s=sz*sz*(3-2*sz);
  const a=[Math.abs(p[0]),p[1]*(1+.28*s),p[2]];
  let d=sdE(a,[.29,.04,0],[.44,.6,.95]);
  d=smin(d,sdE(a,[.43,-.25,.2],[.25,.22,.5]),.022);       // lóbulo temporal con cisura de Silvio
  const bz=Math.max(0,Math.min(1,(p[2]-.1)/.8)); d=Math.max(d,-(p[1]+.45-.17*bz*bz*(3-2*bz)));
  d=Math.max(d,.03-Math.abs(p[0]));
  return d;
}
function cereb(p){const a=[Math.abs(p[0]),p[1],p[2]];let d=sdE(a,[.19,-.38,-.62],[.25,.17,.24]);
  // tronco
  const q=[p[0],p[1]+.55,p[2]+.32]; const h=Math.max(0,Math.min(1,(-q[1]+.25)/.6)); const c=[0,.25-h*.6,0];
  d=smin(d,Math.hypot(q[0]-c[0],q[1]-c[1],(q[2]-c[2])*1.1)-.085*(1-.3*h),.05); return d;}
function gyri(p){
  let q=[p[0]*31,p[1]*31,p[2]*31]; q[0]=Math.abs(q[0])+3;
  const w=[vn(p[0]*3.1+3.1,p[1]*3.1+3.1,p[2]*3.1+3.1),vn(p[0]*3.1+7.7,p[1]*3.1+7.7,p[2]*3.1+7.7),vn(p[0]*3.1+1.9,p[1]*3.1+1.9,p[2]*3.1+1.9)];
  const w2=[vn(p[0]*9+11,p[1]*9+11,p[2]*9+11),vn(p[0]*9+4,p[1]*9+4,p[2]*9+4),vn(p[0]*9+9,p[1]*9+9,p[2]*9+9)];
  q=q.map((v,i)=>v+5*w[i]+1.8*w2[i]);
  const gy=Math.sin(q[0])*Math.cos(q[1])+Math.sin(q[1])*Math.cos(q[2])+Math.sin(q[2])*Math.cos(q[0]);
  return Math.min(1,Math.abs(gy)/1.3);
}
function grad(f,p){const e=.002;return norm([f([p[0]+e,p[1],p[2]])-f([p[0]-e,p[1],p[2]]),f([p[0],p[1]+e,p[2]])-f([p[0],p[1]-e,p[2]]),f([p[0],p[1],p[2]+e])-f([p[0],p[1],p[2]-e])]);}

function emit(p,arc,id,kind,n){pos.push(p[0],p[1],p[2],arc);att.push(id,kind);nrm.push(n[0],n[1],n[2]);}
// microneurona sobre la cresta: soma + dendritas cortas (la textura "hecha de neuronas")
function micro(o,n,id){
  const rs=.0045+rnd()*.003;
  for(let k=0;k<26;k++){const v=norm([rn(),rn(),rn()]);emit([o[0]+v[0]*rs,o[1]+v[1]*rs,o[2]+v[2]*rs],0,id,0,n);}
  const nb=3+Math.floor(rnd()*3);
  for(let b=0;b<nb;b++){
    let d=norm([n[0]*.6+rn(),n[1]*.6+rn(),n[2]*.6+rn()]),p=[...o],arc=0; const L=.012+rnd()*.025, st=.003;
    for(let s=0;s<L/st;s++){ d=norm([d[0]+rn()*.25,d[1]+rn()*.25,d[2]+rn()*.25]);
      const pp=p; p=[p[0]+d[0]*st,p[1]+d[1]*st,p[2]+d[2]*st];
      lpos.push(pp[0],pp[1],pp[2],arc,p[0],p[1],p[2],arc+st); latt.push(id,1,id,1); lnrm.push(...n,...n); arc+=st;
      if(rnd()<.5) emit(p,arc,id,1,n); }
  }
}
const NC=+(P.np||2600000); let made=0, nid=0;
while(made<NC){
  let p=[(rnd()*2-1)*.8,rnd()*1.3-.62,(rnd()*2-1)*1.05];
  const cb=cereb(p), d0=Math.min(shape(p),cb); if(Math.abs(d0)>.025) continue;
  const isC=cb<shape(p); const f=isC?cereb:shape; const n=grad(f,p); const d=f(p); p=[p[0]-n[0]*d,p[1]-n[1]*d,p[2]-n[2]*d];
  let g, k;
  if(isC){ const ph=Math.atan2(p[1]+.38,p[2]+.62); const st=Math.sin(ph*85+vn(p[0]*7,p[1]*7,p[2]*7)*5.);
    g=Math.pow(Math.abs(st),.6); if(p[1]<-.5 && Math.abs(p[0])<.11) g=.75; k=4; }
  else { g=gyri(p); k=3; }
  const keep=.05+.95*Math.pow(Math.max(0,Math.min(1,(g-.15)/.45)),1.6); if(rnd()>keep) continue;
  const off=(isC?.022:.05)*(Math.pow(g,.75)-1);
  p=[p[0]+n[0]*off,p[1]+n[1]*off,p[2]+n[2]*off];
  const cw=[p[0]*4.2+vn(p[0]*3,p[1]*3,p[2]*3)*1.6, p[1]*4.2+vn(p[0]*3+5,p[1]*3,p[2]*3)*1.6, p[2]*4.2+vn(p[0]*3,p[1]*3+9,p[2]*3)*1.6];
  const chunk=Math.floor(hs(Math.floor(cw[0]),Math.floor(cw[1]),Math.floor(cw[2]))*4000);
  emit(p,g,chunk,k,n); made++;
  if(!isC && g>.6 && rnd()<.0016){ micro(p,n,4000+nid++); }
}
for(let i=0;i<+(P.dust||260000);i++){ const v=norm([rn(),rn(),rn()]); const r=1.5+Math.pow(rnd(),.7)*5.5;
  emit([v[0]*r,v[1]*r*.7,v[2]*r],rnd(),rnd()*4000,5,v); }
const NB=+(P.nb||420);
for(let i=0;i<NB;i++){
  const v=norm([rn(),rn()*.6,rn()]); const r=2.6+Math.pow(rnd(),.8)*6.5; const c=[v[0]*r,v[1]*r,v[2]*r]; const id=9000+i;
  const rs=.05+rnd()*.05;
  for(let k=0;k<160;k++){const u=norm([rn(),rn(),rn()]);emit([c[0]+u[0]*rs,c[1]+u[1]*rs,c[2]+u[2]*rs],0,id,6,u);}
  const nb=5+Math.floor(rnd()*4);
  for(let b=0;b<nb;b++){ let d=norm([rn(),rn(),rn()]),p=[...c],arc=0; const L=(.5+rnd()*1.4);
    for(let st=0;st<L/.02;st++){ d=norm([d[0]+rn()*.12,d[1]+rn()*.12,d[2]+rn()*.12]); p=[p[0]+d[0]*.02,p[1]+d[1]*.02,p[2]+d[2]*.02]; arc+=.02;
      emit(p,arc,id,6,d); if(rnd()<.5) emit([p[0]+rn()*.004,p[1]+rn()*.004,p[2]+rn()*.004],arc,id,6,d);
      if(rnd()<.03){ const d2=norm([d[0]+rn(),d[1]+rn(),d[2]+rn()]); let q=[...p]; for(let s2=0;s2<20+rnd()*30;s2++){ q=[q[0]+d2[0]*.02,q[1]+d2[1]*.02,q[2]+d2[2]*.02]; emit(q,arc+s2*.02,id,6,d2);} }
    } }
}

return {pos,att,nrm,lpos,latt,lnrm};
}

// TRACTOGRAFÍA: haces de fibra blanca (cuerpo calloso, radiación de proyección y fascículos de asociación)
function genTractos(P){
  const pos=[], att=[]; let fid=0;
  const bez=(a,b,c,d,t)=>{const u=1-t;return [0,1,2].map(i=>u*u*u*a[i]+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);};
  const linea=(pts)=>{ let arc=0; for(let i=1;i<pts.length;i++){ const a=pts[i-1],b=pts[i]; const l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    pos.push(a[0],a[1],a[2],arc,b[0],b[1],b[2],arc+l); att.push(fid,0,fid,0); arc+=l; } fid++; };
  const N=+(P.nt||1400);
  for(let i=0;i<N;i++){ const ty=i%3, j=()=>rn()*.03; let pts=[];
    if(ty===0){ // cuerpo calloso: de un hemisferio al otro, en U por debajo de la corteza
      const z=(rnd()*2-1)*.62, xa=.3+rnd()*.18, y0=.28+rnd()*.18;
      const A=[-xa,y0,z],B=[-.12,y0-.28,z*.9],C=[.12,y0-.28,z*.9],D=[xa,y0,z];
      for(let k=0;k<=40;k++) pts.push(bez(A,B,C,D,k/40).map(v=>v+j()*.3));
    } else if(ty===1){ // radiación de proyección: del tronco a la corteza en abanico
      const sx=rnd()<.5?-1:1, az=(rnd()*2-1)*1.2, el=.3+rnd()*1.0;
      const D=[sx*(.18+.3*Math.cos(el)),.08+.45*Math.sin(el),.75*Math.sin(az)];
      const A=[sx*.03,-.42,-.28],B=[sx*.06,-.15,-.15],C=[D[0]*.6,D[1]*.55,D[2]*.6];
      for(let k=0;k<=40;k++) pts.push(bez(A,B,C,D,k/40).map(v=>v+j()*.3));
    } else { // fascículos de asociación: de delante a atrás dentro de cada hemisferio
      const sx=rnd()<.5?-1:1, x=sx*(.22+rnd()*.16), y=.05+rnd()*.3;
      const A=[x,y,.62+rnd()*.15],B=[x*1.25,y+.22,.2],C=[x*1.25,y+.2,-.25],D=[x,y-.05,-.66-rnd()*.1];
      for(let k=0;k<=46;k++) pts.push(bez(A,B,C,D,k/46).map(v=>v+j()*.3));
    }
    linea(pts);
  }
  return {pos,att};
}
