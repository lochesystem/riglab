import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaultMarkers,buildSkeleton,applyPose} from '../src/rig.js';
import {generateWalk,footTrajectory} from '../src/walk.js';
test('walk loops exactly, alternates planted feet and preserves bone lengths in A/T rigs',()=>{
 for(const restType of ['A','T']){
 const points=defaultMarkers(2,restType),{keys,duration}=generateWalk(points),skeleton=buildSkeleton(points);
 assert.deepEqual(keys[0].pose,keys.at(-1).pose);assert.equal(keys.at(-1).time,duration);
 for(const k of keys){applyPose(skeleton,k.pose);skeleton.bones.forEach((b,i)=>{assert.ok(b.quaternion.toArray().every(Number.isFinite));if(i)assert.ok(Math.abs(b.position.length()-new THREE.Vector3(...keys[0].pose[i].p).length())<1e-8);});for(const foot of [13,17]){const p=skeleton.bones[foot].getWorldPosition(new THREE.Vector3());assert.ok(p.y>=points[foot].y-1e-6,`foot below floor ${p.y}`);}}
 applyPose(skeleton,keys[0].pose);assert.ok(skeleton.bones[13].getWorldPosition(new THREE.Vector3()).z>skeleton.bones[17].getWorldPosition(new THREE.Vector3()).z);
 applyPose(skeleton,keys[Math.floor((keys.length-1)/2)].pose);assert.ok(skeleton.bones[13].getWorldPosition(new THREE.Vector3()).z<skeleton.bones[17].getWorldPosition(new THREE.Vector3()).z);
 }
});
test('speed changes cadence; stride changes foot travel',()=>{
 const points=defaultMarkers(),slow=generateWalk(points,{speed:.75}),fast=generateWalk(points,{speed:1.5});assert.ok(slow.duration>fast.duration);
 const skeleton=buildSkeleton(points);const reach=stride=>{applyPose(skeleton,generateWalk(points,{stride}).keys[0].pose);return skeleton.bones[13].getWorldPosition(new THREE.Vector3()).z;};assert.ok(reach(.4)>reach(.18));
});

test('organic gait moves torso and elbows while keeping the toes above their rest plane',()=>{
 const points=defaultMarkers(),skeleton=buildSkeleton(points),{keys}=generateWalk(points,{stride:.4});
 for(const index of [0,1,2,4,6,9])assert.ok(keys.some(k=>new THREE.Quaternion(...k.pose[index].q).angleTo(new THREE.Quaternion(...keys[0].pose[index].q))>.015));
 for(const k of keys){applyPose(skeleton,k.pose);for(const toe of [14,18])assert.ok(skeleton.bones[toe].getWorldPosition(new THREE.Vector3()).y>=points[toe].y-1e-5);}
});

test('foot velocity stays continuous at toe-off and loop contact',()=>{
 const h=1e-5;
 for(const t of [.6,1]){
 const a=footTrajectory(t-h,.85,.12),b=footTrajectory(t,.85,.12),c=footTrajectory(t+h,.85,.12);
 for(const field of ['z','lift','pitch'])assert.ok(Math.abs((b[field]-a[field])/h-(c[field]-b[field])/h)<.002,field+' velocity jump');
 }
});
