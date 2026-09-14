import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildSkeleton,defaultMarkers,segmentsFor,capturePose,applyPose,samplePose,solveIK,makeClip,moveBoneWorld} from '../src/rig.js';
import {computeWeights} from '../src/weights.js';

test('skin weights are finite, normalized and follow the nearest anatomical segment',()=>{
 const points=defaultMarkers(),segments=segmentsFor(points);
 const pos=new Float32Array([.19,.3,0,-.19,.3,0,0,1.84,0,.63,1.14,0]);
 const {indices,weights}=computeWeights(pos,segments);
 for(let i=0;i<4;i++){let sum=0;for(let j=0;j<4;j++){const w=weights[i*4+j];assert.ok(Number.isFinite(w)&&w>=0&&w<=1);assert.ok(indices[i*4+j]<19);sum+=w;}assert.ok(Math.abs(sum-1)<1e-6);}
 assert.equal(indices[0],12);assert.equal(indices[4],16);assert.equal(indices[8],4);assert.equal(indices[12],6);
});
test('binding preserves rest geometry and rotating an arm deforms its vertices',()=>{
 const points=defaultMarkers(),skeleton=buildSkeleton(points),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([.64,1.13,0,.75,1,0],3));
 const {indices,weights}=computeWeights(geo.attributes.position.array,segmentsFor(points));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshBasicMaterial());mesh.add(skeleton.bones[0]);mesh.bind(skeleton);mesh.updateMatrixWorld(true);skeleton.update();
 const v=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,0),rest=v.clone();mesh.applyBoneTransform(0,v);assert.ok(v.distanceTo(rest)<1e-5);
 skeleton.bones[5].rotation.z=.8;mesh.updateMatrixWorld(true);skeleton.update();v.copy(rest);mesh.applyBoneTransform(0,v);assert.ok(v.distanceTo(rest)>.15);
});
test('IK converges toward a reachable hand target without stretching bones',()=>{
 const skeleton=buildSkeleton(defaultMarkers()),before=skeleton.bones.map(b=>b.position.length());
 const target=new THREE.Vector3(.45,1.18,.25);solveIK(skeleton,7,target,50);
 assert.ok(skeleton.bones[7].getWorldPosition(new THREE.Vector3()).distanceTo(target)<.015);
 skeleton.bones.forEach((b,i)=>assert.ok(Math.abs(b.position.length()-before[i])<1e-9));
});
test('animation interpolates quaternion rotations and exports ordered boundary keys',()=>{
 const skeleton=buildSkeleton(defaultMarkers()),a=capturePose(skeleton);skeleton.bones[5].rotation.z=Math.PI/2;const b=capturePose(skeleton);
 const keys=[{time:2,pose:b},{time:1,pose:a}];const mid=samplePose(keys,1.5);applyPose(skeleton,mid);assert.ok(Math.abs(skeleton.bones[5].rotation.z-Math.PI/4)<1e-6);
 const clip=makeClip(keys,3);assert.equal(clip.tracks.length,38);assert.deepEqual([...clip.tracks[0].times],[0,1,2,3]);assert.equal(clip.duration,3);
});

test('knee controls move ancestors and successors with pelvis influence, preserving lengths and foot support',()=>{
 for(const index of [12,16]){
 const skeleton=buildSkeleton(defaultMarkers()),root=skeleton.bones[0],before=capturePose(skeleton);
 const foot=skeleton.bones[index+1].getWorldPosition(new THREE.Vector3());
 const target=skeleton.bones[index].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(.06,-.04,.2));
 moveBoneWorld(skeleton,index,target);
 assert.ok(root.position.distanceTo(new THREE.Vector3(...before[0].p))>.01);
 assert.ok(root.position.distanceTo(new THREE.Vector3(...before[0].p))<.13);
 for(const i of [index-1,index])assert.ok(skeleton.bones[i].quaternion.angleTo(new THREE.Quaternion(...before[i].q))>.02);
 assert.ok(skeleton.bones[index+1].getWorldPosition(new THREE.Vector3()).distanceTo(foot)<.005);
 skeleton.bones.forEach((b,i)=>{if(i)assert.ok(Math.abs(b.position.length()-new THREE.Vector3(...before[i].p).length())<1e-8);});
 }
});
test('elbow controls rotate shoulder and torso while keeping the hand near its starting position',()=>{
 const skeleton=buildSkeleton(defaultMarkers()),before=capturePose(skeleton),hand=skeleton.bones[7].getWorldPosition(new THREE.Vector3());
 moveBoneWorld(skeleton,6,skeleton.bones[6].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.08,.2)));
 assert.ok(skeleton.bones[5].quaternion.angleTo(new THREE.Quaternion(...before[5].q))>.01);
 assert.ok(skeleton.bones[2].quaternion.angleTo(new THREE.Quaternion(...before[2].q))>.01);
 assert.ok(skeleton.bones[7].getWorldPosition(new THREE.Vector3()).distanceTo(hand)<.005);
});

test('proximal controls bend the selected chain without rotating the pelvis or opposite leg',()=>{
 for(const index of [1,11,15]){
 const skeleton=buildSkeleton(defaultMarkers()),group=new THREE.Group();group.position.set(2,0,-1);group.rotation.y=.7;group.add(skeleton.bones[0]);group.updateMatrixWorld(true);
 const before=capturePose(skeleton),opposite=index===15?12:16,foot=skeleton.bones[opposite].getWorldPosition(new THREE.Vector3());
 const child=skeleton.bones[index].children[0],old=child.getWorldPosition(new THREE.Vector3());
 moveBoneWorld(skeleton,index,skeleton.bones[index].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,0,.2)));
 assert.deepEqual(capturePose(skeleton)[0],before[0]);
 assert.ok(child.getWorldPosition(new THREE.Vector3()).distanceTo(old)>.02);
 assert.ok(skeleton.bones[opposite].getWorldPosition(new THREE.Vector3()).distanceTo(foot)<1e-8);
 skeleton.bones.forEach((bone,i)=>assert.deepEqual(bone.position.toArray(),before[i].p));
 }
});
