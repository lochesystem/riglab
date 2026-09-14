import * as THREE from 'three';

export const JOINTS = [
  ['hips','Quadril',-1,[0,.51,0]], ['spine','Coluna',0,[0,.62,0]], ['chest','Peito',1,[0,.73,0]],
  ['neck','Pescoço',2,[0,.82,0]], ['head','Cabeça',3,[0,.88,0]],
  ['upperArmL','Braço E',2,[.15,.77,0]], ['forearmL','Cotovelo E',5,[.26,.64,0]], ['handL','Mão E',6,[.36,.51,0]],
  ['upperArmR','Braço D',2,[-.15,.77,0]], ['forearmR','Cotovelo D',8,[-.26,.64,0]], ['handR','Mão D',9,[-.36,.51,0]],
  ['thighL','Coxa E',0,[.085,.49,0]], ['shinL','Joelho E',11,[.09,.28,.012]], ['footL','Pé E',12,[.095,.065,0]], ['toeL','Ponta do pé E',13,[.095,.035,.09]],
  ['thighR','Coxa D',0,[-.085,.49,0]], ['shinR','Joelho D',15,[-.09,.28,.012]], ['footR','Pé D',16,[-.095,.065,0]], ['toeR','Ponta do pé D',17,[-.095,.035,.09]],
];
export const IK_CHAINS = {handL:[6,5],handR:[9,8],footL:[12,11],footR:[16,15]};
export function defaultMarkers(height=2, pose='A', width=1) {
  return JOINTS.map(([name,,,p])=>{
    const v=new THREE.Vector3(p[0]*height*width,p[1]*height,p[2]*height);
    if(pose==='T' && /Arm|forearm|hand/.test(name)) {v.y=.77*height; if(name.startsWith('forearm')) v.x=Math.sign(v.x)*.32*height*width; if(name.startsWith('hand')) v.x=Math.sign(v.x)*.48*height*width;}
    return v;
  });
}
export function buildSkeleton(points) {
  const bones=JOINTS.map(([name])=>{const b=new THREE.Bone();b.name=name;return b;});
  JOINTS.forEach((j,i)=>{const parent=j[2];bones[i].position.copy(points[i]);if(parent>=0){bones[i].position.sub(points[parent]);bones[parent].add(bones[i]);}});
  bones[0].updateMatrixWorld(true);
  return new THREE.Skeleton(bones);
}
export function segmentsFor(points) {
  return JOINTS.map(([name,,,],i)=>{
    const child=JOINTS.findIndex(j=>j[2]===i);
    let end=child>=0?points[child].clone():points[i].clone().add(new THREE.Vector3(0,.11,0));
    if(name==='hips')end=points[1].clone();
    if(name==='chest')end=points[3].clone();
    if(name.startsWith('hand'))end=points[i].clone().add(new THREE.Vector3(name.endsWith('L')?.1:-.1,-.1,0));
    if(name.startsWith('toe'))end=points[i].clone().add(new THREE.Vector3(0,0,.08));
    return {name,a:points[i].toArray(),b:end.toArray()};
  });
}
export function capturePose(skeleton) {return skeleton.bones.map(b=>({q:b.quaternion.toArray(),p:b.position.toArray()}));}
export function applyPose(skeleton,pose) {skeleton.bones.forEach((b,i)=>{b.quaternion.fromArray(pose[i].q);b.position.fromArray(pose[i].p);});skeleton.bones[0].updateMatrixWorld(true);}
export function samplePose(keys,time) {
  if(!keys.length)return null;
  const sorted=[...keys].sort((a,b)=>a.time-b.time);
  if(time<=sorted[0].time)return structuredClone(sorted[0].pose);
  if(time>=sorted.at(-1).time)return structuredClone(sorted.at(-1).pose);
  const right=sorted.findIndex(k=>k.time>=time),a=sorted[right-1],b=sorted[right];
  const t=(time-a.time)/(b.time-a.time);
  const q=new THREE.Quaternion(),r=new THREE.Quaternion();
  return a.pose.map((v,i)=>({q:q.fromArray(v.q).slerp(r.fromArray(b.pose[i].q),t).toArray(),p:v.p.map((n,j)=>THREE.MathUtils.lerp(n,b.pose[i].p[j],t))}));
}
export function makeClip(keys,duration=3) {
  if(!keys.length)return null;
  const ordered=[...keys].sort((a,b)=>a.time-b.time);
  if(ordered[0].time>0)ordered.unshift({...ordered[0],time:0});
  if(ordered.at(-1).time<duration)ordered.push({...ordered.at(-1),time:duration});
  return new THREE.AnimationClip('RigLab_Action',duration,JOINTS.flatMap(([name],i)=>[
    new THREE.QuaternionKeyframeTrack(`${name}.quaternion`,ordered.map(k=>k.time),ordered.flatMap(k=>k.pose[i].q)),
    new THREE.VectorKeyframeTrack(`${name}.position`,ordered.map(k=>k.time),ordered.flatMap(k=>k.pose[i].p)),
  ]));
}
export function solveIK(skeleton,endIndex,target,iterations=18) {
  const bones=skeleton.bones,chain=IK_CHAINS[bones[endIndex].name];if(!chain)return;
  const end=new THREE.Vector3(),pivot=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),worldQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
  for(let it=0;it<iterations;it++) {
    for(const idx of chain) {
      const joint=bones[idx];joint.getWorldPosition(pivot);bones[endIndex].getWorldPosition(end);
      a.copy(end).sub(pivot);b.copy(target).sub(pivot);if(a.lengthSq()<1e-10||b.lengthSq()<1e-10)continue;
      joint.parent.getWorldQuaternion(worldQ).invert();a.normalize().applyQuaternion(worldQ);b.normalize().applyQuaternion(worldQ);
      delta.setFromUnitVectors(a,b);joint.quaternion.premultiply(delta).normalize();bones[0].updateMatrixWorld(true);
    }
    bones[endIndex].getWorldPosition(end);if(end.distanceTo(target)<.002)break;
  }
}

// Rotate a joint towards a world-space child target without changing length.
function aimChild(root,joint,child,target){
 const pivot=joint.getWorldPosition(new THREE.Vector3());
 const from=child.getWorldPosition(new THREE.Vector3()).sub(pivot);
 const to=target.clone().sub(pivot);
 if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;
 const inverse=joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 from.normalize().applyQuaternion(inverse);to.normalize().applyQuaternion(inverse);
 joint.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from,to)).normalize();
 root.updateMatrixWorld(true);
}

// Project the requested knee/elbow onto the reachable circle for its two bones.
// This keeps both segment lengths and the endpoint, whenever it is reachable.
function solveMiddle(skeleton,middleIndex,requested,endTarget){
 const middle=skeleton.bones[middleIndex],upper=middle.parent,end=middle.children.find(b=>b.isBone),root=skeleton.bones[0];
 const pivot=upper.getWorldPosition(new THREE.Vector3()),endRotation=end.getWorldQuaternion(new THREE.Quaternion());
 const a=middle.position.length(),b=end.position.length();if(a<1e-5||b<1e-5)return;
 const direction=endTarget.clone().sub(pivot);
 if(direction.lengthSq()<1e-10)return;
 const distance=THREE.MathUtils.clamp(direction.length(),Math.abs(a-b)+1e-5,a+b-1e-5);direction.normalize();
 const reachableEnd=pivot.clone().addScaledVector(direction,distance);
 const along=(a*a-b*b+distance*distance)/(2*distance),radius=Math.sqrt(Math.max(0,a*a-along*along));
 const pole=requested.clone().sub(pivot);pole.addScaledVector(direction,-pole.dot(direction));
 if(pole.lengthSq()<1e-8){pole.copy(middle.getWorldPosition(new THREE.Vector3()).sub(pivot));pole.addScaledVector(direction,-pole.dot(direction));}
 if(pole.lengthSq()<1e-8){pole.set(0,0,1);pole.addScaledVector(direction,-pole.dot(direction));}
 if(pole.lengthSq()<1e-8){pole.set(1,0,0);pole.addScaledVector(direction,-pole.dot(direction));}
 const knee=pivot.clone().addScaledVector(direction,along).addScaledVector(pole.normalize(),radius);
 aimChild(root,upper,middle,knee);aimChild(root,middle,end,reachableEnd);
 end.quaternion.copy(end.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(endRotation);root.updateMatrixWorld(true);
}

export function moveBoneWorld(skeleton,index,target){
 const bones=skeleton.bones,bone=bones[index],root=bones[0];
 if(IK_CHAINS[bone.name]){solveIK(skeleton,index,target);return;}
 if([6,9,12,16].includes(index)){
   const isKnee=index===12||index===16,child=bone.children.find(b=>b.isBone);
   const endpoint=child.getWorldPosition(new THREE.Vector3()),delta=target.clone().sub(bone.getWorldPosition(new THREE.Vector3()));
   // Use the pose at gesture start as the reference (the editor handles this),
   // so repeatedly dragging toward an unreachable target never accumulates drift.
   if(isKnee){
     const other=index===12?16:12,otherKnee=bones[other].getWorldPosition(new THREE.Vector3()),otherFoot=bones[other+1].getWorldPosition(new THREE.Vector3());
     const shift=delta.clone().multiplyScalar(.22).clampLength(0,.12);
     shift.y-=Math.min(.06,Math.hypot(delta.x,delta.z)*.16);
     const pelvis=root.getWorldPosition(new THREE.Vector3()).add(shift);
     root.position.copy(root.parent?root.parent.worldToLocal(pelvis):pelvis);root.updateMatrixWorld(true);
     solveMiddle(skeleton,index,target,endpoint);solveMiddle(skeleton,other,otherKnee,otherFoot);
   }else{
     // A little chest rotation follows the elbow; the shoulder supplies the rest.
     bones[2].rotation.y+=THREE.MathUtils.clamp(delta.z*(index===6?-.16:.16),-.08,.08);
     bones[2].rotation.z+=THREE.MathUtils.clamp(delta.y*(index===6?.12:-.12),-.05,.05);
     root.updateMatrixWorld(true);solveMiddle(skeleton,index,target,endpoint);
   }
   return;
 }
 if(index!==0&&bone.parent?.isBone){
   // Interior controls propagate through their parent by rotation. Descendants
   // follow naturally; this does not stretch the offset from the parent.
   aimChild(root,bone.parent,bone,target);return;
 }
 bone.parent?.updateWorldMatrix(true,false);
 bone.position.copy(bone.parent?bone.parent.worldToLocal(target.clone()):target);root.updateMatrixWorld(true);
}
