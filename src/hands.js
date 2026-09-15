import * as THREE from 'three';
const V=(v)=>new THREE.Vector3(...v),clamp=THREE.MathUtils.clamp;
export const HAND_BONES=30;
export const FINGER_CURL=1.5;
export function handFrame(points,side,config=0){
 const c=typeof config==='number'?{roll:config}:config,wrist=side==='L'?7:10,origin=points[wrist].clone(),forward=origin.clone().sub(points[wrist-1]).normalize();
 let normal=new THREE.Vector3(0,0,-1).addScaledVector(forward,forward.z);
 if(normal.lengthSq()<.01)normal=new THREE.Vector3(0,1,0).addScaledVector(forward,-forward.y);
 normal.normalize();let across=forward.clone().cross(normal).normalize();
 const yaw=c.yaw||0,pitch=c.pitch||0;
 forward.multiplyScalar(Math.cos(pitch)*Math.cos(yaw)).addScaledVector(across,Math.cos(pitch)*Math.sin(yaw)).addScaledVector(normal,Math.sin(pitch)).normalize();
 normal.addScaledVector(forward,-normal.dot(forward)).normalize().applyAxisAngle(forward,c.roll||0);across=forward.clone().cross(normal).normalize();
 return {wrist,origin,forward,normal,across};
}
export function estimateHands(points,geometries){
 const result={},quantile=(a,t,fallback)=>a.length?a.sort((a,b)=>a-b)[Math.floor((a.length-1)*t)]:fallback;
 for(const side of ['L','R']){
  let f=handFrame(points,side);const cloud=[];
  for(const g of geometries){const p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
   for(let i=0;i<p.count;i++){let weight=0;for(let j=0;j<4;j++){const id=si.getComponent(i,j);if(id===f.wrist||(id>=19&&(id<34)===(side==='L')))weight+=sw.getComponent(i,j);}if(weight<.45)continue;
    const d=new THREE.Vector3().fromBufferAttribute(p,i).sub(f.origin);if(d.length()<.45&&d.dot(f.forward)>-.10)cloud.push(d);
   }
  }
  // Follow the centers of proximal/distal slices. A wide open hand can
  // have its largest PCA axis across the fingers rather than along them.
  const order=cloud.slice().sort((a,b)=>a.dot(f.forward)-b.dot(f.forward));
  const center=(lo,hi)=>{const values=order.slice(Math.floor(order.length*lo),Math.max(1,Math.floor(order.length*hi)));return values.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/Math.max(1,values.length));};
  let direction=center(.75,.95).sub(center(.05,.25));if(direction.lengthSq()<1e-8)direction=f.forward.clone();else direction.normalize();
  const yaw=clamp(Math.atan2(direction.dot(f.across),direction.dot(f.forward)),-1.1,1.1),pitch=clamp(Math.asin(clamp(direction.dot(f.normal),-1,1)),-1.1,1.1);
  f=handFrame(points,side,{yaw,pitch});
  const samples=cloud.map(p=>({along:p.dot(f.forward),x:p.dot(f.across),z:p.dot(f.normal)}));
  const start=clamp(quantile(samples.map(p=>p.along),.04,0),-.12,.12),length=clamp(quantile(samples.map(p=>p.along),.98,.19)-start,.08,.35);
  const palm=samples.filter(p=>p.along>start+length*.2&&p.along<start+length*.65);
  const mx=quantile(palm.map(p=>p.x),.5,0),mz=quantile(palm.map(p=>p.z),.5,0);
  let xx=0,zz=0,xz=0;for(const p of palm){xx+=(p.x-mx)**2;zz+=(p.z-mz)**2;xz+=(p.x-mx)*(p.z-mz);}
  const roll=.5*Math.atan2(2*xz,xx-zz),project=p=>p.x*Math.cos(roll)+p.z*Math.sin(roll);
  const distal=samples.filter(p=>p.along>start+length*.7),shift=quantile(distal.map(project),.5,mx);
  const lo=quantile(palm.map(project),.04,-.05),hi=quantile(palm.map(project),.96,.05);
  // The little finger is also short, so distal reach cannot identify a thumb.
  // Prefer the side protruding out of the palm plane near its proximal half.
  const protrusion=sign=>quantile(samples.filter(p=>p.along>start-length*.1&&p.along<start+length*.65&&(project(p)-shift)*sign>(hi-lo)*.2).map(p=>p.z*Math.cos(roll)-p.x*Math.sin(roll)),.85,0);
  const difference=protrusion(1)-protrusion(-1),thumbSide=Math.abs(difference)>(hi-lo)*.08?Math.sign(difference):(side==='L'?-1:1);
  const fingerWidth=quantile(distal.map(project),.97,hi)-quantile(distal.map(project),.03,lo);
  const width=clamp(fingerWidth*1.15,.04,.16);
  result[side]={length,width,roll:-roll,yaw,pitch,start,palm:.42,thumbStart:-.12,thumbLength:.4,shift,depth:quantile(palm.map(p=>p.z*Math.cos(roll)-p.x*Math.sin(roll)),.5,0),thumbSide};
 }
 return result;
}
export function handDefinitions(points,config){
 const definitions=[];
 for(const side of ['L','R']){
  const c=config[side],f=handFrame(points,side,c),thumbSide=c.thumbSide||(side==='L'?-1:1),sign=-thumbSide;f.origin.addScaledVector(f.forward,c.start||0).addScaledVector(f.across,c.shift||0).addScaledVector(f.normal,c.depth||0);
  for(let finger=0;finger<5;finger++){
   const thumb=finger===0,root=f.origin.clone().addScaledVector(f.forward,c.length*(thumb?(c.thumbStart??.28):c.palm)).addScaledVector(f.across,sign*c.width*(thumb?-.40:((finger-1)/3-.5)*.72)).addScaledVector(f.normal,thumb?c.width*.15:0);
   const direction=thumb?f.forward.clone().multiplyScalar(.85).addScaledVector(f.across,-sign*.30).addScaledVector(f.normal,.45).normalize():f.forward.clone();
   const length=c.length*(thumb?(c.thumbLength??.60):(1-c.palm)*[0,.92,1,.94,.76][finger]);
   const fingerName=['thumb','index','middle','ring','little'][finger];let previous=f.wrist,at=root;
   for(let joint=0;joint<3;joint++){
    const end=at.clone().addScaledVector(direction,length*[.45,.32,.23][joint]);
    const index=19+definitions.length;
    definitions.push({name:`${fingerName}${joint+1}${side}`,side,thumbSide,finger,joint,index,parent:previous,a:at.toArray(),b:end.toArray(),axis:direction.clone().cross(f.normal).normalize().multiplyScalar(thumb?-1:1).toArray(),normal:f.normal.toArray(),angle:thumb?[.65,1.05,.80][joint]:[FINGER_CURL,1.5,.9][joint]});previous=index;at=end;
   }
  }
 }
 return definitions;
}
export function withHands(skeleton,points,config){
 const definitions=handDefinitions(points,config),bones=[...skeleton.bones];
 for(const d of definitions){const bone=new THREE.Bone();bone.name=d.name;const parent=d.parent<19?points[d.parent]:V(definitions[d.parent-19].a);bone.position.copy(V(d.a).sub(parent));bone.userData.restPosition=bone.position.toArray();bones[d.parent].add(bone);bones.push(bone);}
 bones[0].updateMatrixWorld(true);const result=new THREE.Skeleton(bones);result.handDefinitions=definitions;
 // Solve opposition against the curled index finger in the bind frame. Store
 // local rotations so later arm/body poses cannot change the fist shape.
 const closed={};
 for(const side of ['L','R']){
  setGrip(result,side,1);
  const chain=definitions.filter(d=>d.side===side&&d.finger===0),index=definitions.find(d=>d.side===side&&d.finger===1&&d.joint===1),f=handFrame(points,side,config[side]);
  const target=bones[index.index].getWorldPosition(new THREE.Vector3()).addScaledVector(f.normal,-config[side].width*.10).addScaledVector(f.across,chain[0].thumbSide*config[side].width*.10);
  const last=chain.at(-1),tipLocal=V(last.b).sub(V(last.a));
  for(let iteration=0;iteration<24;iteration++)for(const d of chain.slice().reverse()){
   const bone=bones[d.index],at=bone.getWorldPosition(new THREE.Vector3()),tip=bones[last.index].localToWorld(tipLocal.clone()),from=tip.sub(at),to=target.clone().sub(at);
   if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)continue;
   const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();from.normalize().applyQuaternion(parent);to.normalize().applyQuaternion(parent);
   const delta=new THREE.Quaternion().setFromUnitVectors(from,to);bone.quaternion.premultiply(delta).normalize();bones[0].updateMatrixWorld(true);
  }
  closed[side]=chain.map(d=>bones[d.index].quaternion.clone());
 }
 result.handClosedThumb=closed;for(const d of definitions)bones[d.index].quaternion.identity();bones[0].updateMatrixWorld(true);return result;
}
export function setGrip(skeleton,side,value){
 const grip=clamp(value,0,1);
 for(const d of skeleton.handDefinitions||[]){if(d.side!==side)continue;const t=d.finger===0?THREE.MathUtils.smoothstep(grip,.15,1):grip;
  const bone=skeleton.bones[d.index];if(d.finger===0&&skeleton.handClosedThumb){bone.quaternion.identity().slerp(skeleton.handClosedThumb[side][d.joint],t);continue;}if(t===0){bone.quaternion.identity();continue;}bone.quaternion.setFromAxisAngle(V(d.axis),d.angle*t);
  if(d.finger===0&&d.joint===0)bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V(d.normal),d.thumbSide*.7*t));
 }
 skeleton.bones[0].updateMatrixWorld(true);
}
export function getGrip(skeleton,side){
 const d=skeleton.handDefinitions?.find(d=>d.side===side&&d.finger===2&&d.joint===0);if(!d)return 0;
 const q=skeleton.bones[d.index].quaternion;return clamp(2*Math.atan2(Math.hypot(q.x,q.y,q.z),Math.abs(q.w))/d.angle,0,1);
}
function distanceSquared(p,a,b){const v=V(b).sub(V(a)),t=clamp(p.clone().sub(V(a)).dot(v)/v.lengthSq(),0,1);return p.distanceToSquared(V(a).addScaledVector(v,t));}
// Redistribute wrist weights; release forearm influence only on distal hand
// vertices already predominantly assigned to the wrist, inside a finger envelope.
export function handWeights(geometry,points,config){
 const defs=handDefinitions(points,config),indices=new Uint16Array(geometry.attributes.skinIndex.array),weights=new Float32Array(geometry.attributes.skinWeight.array),pos=geometry.attributes.position;
 for(let i=0;i<pos.count;i++){
  if(![0,1,2,3].some(j=>weights[i*4+j]>0&&(indices[i*4+j]===7||indices[i*4+j]===10||indices[i*4+j]>=19)))continue;
  const p=new THREE.Vector3().fromBufferAttribute(pos,i),scores=new Map();
  for(let j=0;j<4;j++){let id=indices[i*4+j];if(id>=19)id=id<34?7:10;scores.set(id,(scores.get(id)||0)+weights[i*4+j]);}
  for(const side of ['L','R']){
   const f=handFrame(points,side,config[side]),base=scores.get(f.wrist)||0;if(base<1e-6)continue;
   const c=config[side],local=defs.filter(d=>d.side===side);
   const fingerScores=[];
   for(let finger=0;finger<5;finger++){
    const chain=local.filter(d=>d.finger===finger),dist=Math.min(...chain.map(d=>distanceSquared(p,d.a,d.b)));
    fingerScores.push({chain,dist});
   }
   fingerScores.sort((a,b)=>a.dist-b.dist);const selected=fingerScores[0];
   const root=V(selected.chain[0].a),direction=V(selected.chain.at(-1).b).sub(root).normalize();
   const pastRoot=p.clone().sub(root).dot(direction);
   const gate=THREE.MathUtils.smoothstep(pastRoot,-c.length*.065,c.length*.045)*(1-THREE.MathUtils.smoothstep(c.length*.5,c.length,Math.sqrt(selected.dist)));
   const inherited=base>.45&&selected.dist<(c.width*.5)**2?(scores.get(f.wrist-1)||0)*gate:0;
   scores.set(f.wrist-1,(scores.get(f.wrist-1)||0)-inherited);const amount=base*gate+inherited;scores.set(f.wrist,base*(1-gate));
   const distances=selected.chain.map(d=>distanceSquared(p,d.a,d.b)),nearest=Math.min(...distances),falloff=(c.length*.045)**2;
   const values=distances.map(d=>Math.exp(-(d-nearest)/falloff)),sum=values.reduce((a,b)=>a+b,0);
   selected.chain.forEach((d,j)=>scores.set(d.index,(scores.get(d.index)||0)+amount*values[j]/sum));
  }
  const best=[...scores].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((a,b)=>a+b[1],0);
  for(let j=0;j<4;j++){indices[i*4+j]=best[j]?.[0]||0;weights[i*4+j]=(best[j]?.[1]||0)/sum;}
 }
 return {indices,weights};
}
export function extendHandPose(pose,bindPose){return [...pose.slice(0,19),...bindPose.slice(19).map(p=>structuredClone(p))];}
export function validHandConfig(c){return c===null||c===undefined||['L','R'].every(side=>{const v=c[side];return v&&Number.isFinite(v.length)&&v.length>=.05&&v.length<=.4&&Number.isFinite(v.width)&&v.width>=.02&&v.width<=.25&&Number.isFinite(v.roll)&&Math.abs(v.roll)<=Math.PI*2&&Number.isFinite(v.palm)&&v.palm>=.15&&v.palm<=.7&&(v.thumbStart===undefined||(Number.isFinite(v.thumbStart)&&v.thumbStart>=-.5&&v.thumbStart<=.7))&&(v.thumbLength===undefined||(Number.isFinite(v.thumbLength)&&v.thumbLength>=.1&&v.thumbLength<=1))&&['yaw','pitch'].every(k=>v[k]===undefined||(Number.isFinite(v[k])&&Math.abs(v[k])<=1.5))&&(v.thumbSide===undefined||[-1,1].includes(v.thumbSide))&&['shift','depth','start'].every(k=>v[k]===undefined||(Number.isFinite(v[k])&&Math.abs(v[k])<=.2));});}
