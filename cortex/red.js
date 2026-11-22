function genRed(P){
const path=z=>[Math.sin(z*.13)*1.2+Math.sin(z*.31)*.4, Math.cos(z*.11)*.8+Math.sin(z*.23)*.25, z];
const pos=[], att=[], lpos=[], latt=[];
function emit(x,y,z,arc,id,kind){pos.push(x,y,z,arc);att.push(id,kind);}
function grow(o,dir,len,rad,depth,arc0,id,dens,kind){
  let p=[...o], d=norm(dir), arc=arc0, steps=Math.max(2,Math.floor(len/0.018));
  for(let s=0;s<steps;s++){
    const f=s/steps, r=rad*(1-0.75*f);
    d=norm([d[0]+rn()*.075,d[1]+rn()*.075,d[2]+rn()*.075]);
    const st=0.018; const pp=p; p=[p[0]+d[0]*st,p[1]+d[1]*st,p[2]+d[2]*st];
    lpos.push(pp[0],pp[1],pp[2],arc, p[0],p[1],p[2],arc+st); latt.push(id,kind,id,kind); arc+=st;
    const n=Math.max(1,Math.round(dens*(0.25+r*90)));
    for(let k=0;k<n;k++){ // volumen del tubo: puntos sobre la superficie del cilindro
      const a=rnd()*6.2832, b=rn()*r;
      emit(p[0]+Math.cos(a)*r+b*.2,p[1]+Math.sin(a)*r+b*.2,p[2]+rn()*r,arc,id,kind);
    }
    if(kind===2 && Math.floor(arc/0.09)!==Math.floor((arc-st)/0.09)){ // nodo de Ranvier: el impulso salta de uno a otro
      for(let k=0;k<5;k++) emit(p[0]+rn()*.006,p[1]+rn()*.006,p[2]+rn()*.006,Math.floor(arc/0.09)*0.09,id,5);
    }
    if(depth>0 && rnd()<0.03+0.012*depth){
      const nd=norm([d[0]+rn()*.75,d[1]+rn()*.75,d[2]+rn()*.75]);
      grow(p,nd,len*(1-f)*(0.5+rnd()*0.5),r*0.75,depth-1,arc,id,dens,kind);
    }
  }
  // botón sináptico al final de cada rama + nube de neurotransmisor que sale al llegar el impulso
  for(let k=0;k<16;k++){ const v=norm([rn(),rn(),rn()]); emit(p[0]+v[0]*.007,p[1]+v[1]*.007,p[2]+v[2]*.007,arc,id,3); }
  for(let k=0;k<18;k++){ const v=norm([rn(),rn(),rn()]); emit(p[0]+v[0]*.002,p[1]+v[1]*.002,p[2]+v[2]*.002,arc,id,4); }
}
const NN=+(P.n||1300), ZL=+(P.zl||40), neurons=[];
const HEROES=[[3.9,.9,.42],[8.2,-2.2,.5],[13.1,2.6,.4],[19.4,-.6,.55],[25,1.8,.45]];
for(let i=0;i<NN+HEROES.length;i++){
  const hero=i>=NN; const hz=hero?HEROES[i-NN]:null;
  const z=hero?hz[0]:rnd()*ZL-4, c=path(z), ang=hero?hz[1]:rnd()*6.2832, rr=hero?hz[2]:0.42+Math.pow(rnd(),1.3)*3.4;
  const s=[c[0]+Math.cos(ang)*rr, c[1]+Math.sin(ang)*rr*.8, z];
  neurons.push(s); const id=hero?-(i-NN+1):i+rnd()*.5, sc=hero?1.25:0.7+rnd()*0.7;
  // soma: cáscara densa en gota
  const up=norm([rn()*.3,1,rn()*.3]); const rs=(0.035+rnd()*0.03)*sc;
  for(let k=0;k<(hero?1600:500)*sc;k++){ let v=norm([rn(),rn(),rn()]); const e=1+.35*Math.max(0,v[0]*up[0]+v[1]*up[1]+v[2]*up[2]);
    const rr2=rs*(0.92+rnd()*.08); emit(s[0]+v[0]*rr2*e,s[1]+v[1]*rr2*e*1.1,s[2]+v[2]*rr2*e,0,id,0); }
  // apical
  grow(s,up,(0.8+rnd()*0.8)*sc,0.012*sc,4,0,id,1.0,1);
  // basales
  const nb=4+Math.floor(rnd()*4);
  for(let b=0;b<nb;b++) grow(s,norm([rn(),rn()-.6,rn()]),(0.3+rnd()*0.35)*sc,0.008*sc,3,0,id,0.9,1);
  // axón largo y fino
  grow(s,norm([rn(),-.5+rn()*.4,rn()]),(1.5+rnd()*2.5),0.003,2,0,id,0.6,2);
}

return {pos,att,lpos,latt,path};
}
