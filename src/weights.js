const smooth=(lo,hi,value)=>{const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t);};

// Compact distance weights plus an anatomical shoulder envelope. The medial
// trapezius/ribcage must not inherit the humerus simply because it is close.
export function computeWeights(positions,segments){
 const count=positions.length/3,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
 const find=name=>segments.findIndex(s=>s.name===name);
 const chest=find('chest'),spine=find('spine'),neck=find('neck'),head=find('head');
 const shoulders=['upperArmL','upperArmR'].map(find).filter(i=>i>=0);
 const anatomical=chest>=0&&spine>=0&&neck>=0&&head>=0;
 const scale=anatomical?Math.max(.01,Math.hypot(...segments[neck].a.map((v,i)=>v-segments[spine].a[i]))/.4):1;
 const shoulderData=anatomical?shoulders.map(index=>{
  const s=segments[index],center=segments[neck].a;
  const sx=s.a[0]-center[0],sz=s.a[2]-center[2],width=Math.max(.01,Math.hypot(sx,sz));
  const direction=s.b.map((v,i)=>v-s.a[i]),length=Math.max(.01,Math.hypot(...direction));
  const side=s.name.endsWith('L')?'L':'R';
  const chain=[index,find('forearm'+side),find('hand'+side)].filter(i=>i>=0);
  return {index,chain,s,center,width,out:[sx/width,sz/width],direction:direction.map(v=>v/length),length};
 }):[];
 for(let i=0;i<count;i++){
  const p=[positions[i*3],positions[i*3+1],positions[i*3+2]];
  const distances=segments.map(({a,b},index)=>{
   const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=dx*dx+dy*dy+dz*dz;
   const t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy+(p[2]-a[2])*dz)/len)):0;
   const d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2+(p[2]-a[2]-t*dz)**2;
   return {index,d};
  });
  const nearest=Math.min(...distances.map(v=>v.d));
  // Slightly wider blending at the shoulder joint avoids a rigid deltoid seam.
  let shoulderBlend=0;
  for(const {s,length} of shoulderData){const d=Math.hypot(...p.map((v,k)=>v-s.a[k]));shoulderBlend=Math.max(shoulderBlend,1-smooth(.2*length,.8*length,d));}
  const falloff=Math.max((.002+.0015*shoulderBlend)*scale*scale,nearest*.32);
  const scores=distances.map(({d})=>Math.exp(-(d-nearest)/falloff));
  let total=scores.reduce((a,b)=>a+b,0);for(let j=0;j<scores.length;j++)scores[j]/=total;
  for(const {chain,s,center,width,out,direction,length} of shoulderData){
   const lateral=((p[0]-center[0])*out[0]+(p[2]-center[2])*out[1])/width;
   const offset=p.map((v,k)=>v-s.a[k]);
   const along=offset.reduce((n,v,k)=>n+v*direction[k],0);
   const radius=Math.hypot(...offset.map((v,k)=>v-along*direction[k]));
   // Keep full freedom farther down the arm, including downward/A-pose arms.
   const shaft=1-smooth(length*.12,length*.30,radius);
   const distal=smooth(.25,.85,along/length)*shaft;
   // Below the shoulder, follow the arm's outward slope instead of a
   // vertical boundary: a flared vest must not become part of the arm.
   const below=smooth(.15,.65,(s.a[1]-p[1])/length);
   const atHeight=direction[1]<-.15?Math.max(0,Math.min(length,(p[1]-s.a[1])/direction[1])):0;
   const outward=direction[0]*out[0]+direction[2]*out[1];
   const armWidth=width+Math.max(0,outward*atHeight)*below;
   const lateralGate=smooth(.60,1.17,lateral*width/armWidth)**2;
   const gate=lateralGate+(1-lateralGate)*distal;
   let removed=0;for(const index of chain){const amount=scores[index]*(1-gate);scores[index]-=amount;removed+=amount;}
   if(removed>0){
    const spinePart=1-smooth(segments[spine].a[1],segments[chest].a[1],p[1]);
    const neckPart=.65*smooth(s.a[1],segments[head].a[1],p[1])*(1-smooth(.20,.80,lateral));
    scores[spine]+=removed*spinePart;
    scores[neck]+=removed*(1-spinePart)*neckPart;
    scores[chest]+=removed*(1-spinePart)*(1-neckPart);
   }
  }
  const best=scores.map((weight,index)=>({weight,index})).sort((a,b)=>b.weight-a.weight).slice(0,4);
  total=best.reduce((n,v)=>n+v.weight,0);
  best.forEach((v,j)=>{indices[i*4+j]=v.index;weights[i*4+j]=v.weight/total;});
 }
 return {indices,weights};
}
