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

test('walk keeps narrow noncrossing tracks, forward knees and continuous supported steps across rigs',()=>{
 for(const width of [.75,1,1.35])for(const stride of [.18,.4]){
 const points=defaultMarkers(2,'A',width),skeleton=buildSkeleton(points),{keys}=generateWalk(points,{stride});
 const L=points[11].distanceTo(points[12])+points[12].distanceTo(points[13]);
 let previous=null,doubleSupport=0,singleSupport=0;
 for(const k of keys){
  applyPose(skeleton,k.pose);const pos=i=>skeleton.bones[i].getWorldPosition(new THREE.Vector3());let grounded=0;
  for(const [hip,sign] of [[11,1],[15,-1]]){
   const foot=pos(hip+2),knee=pos(hip+1),top=pos(hip),toe=pos(hip+3);
   assert.ok(sign*(foot.x-points[0].x)>L*.04,'foot crossed center');
   assert.ok(Math.abs(foot.x-points[0].x)<L*.11,'stance inherited bind spread');
   assert.ok(sign*(knee.x-top.x)<L*.025,'knee opened laterally');
   assert.ok(knee.z>Math.min(top.z,foot.z)-1e-5,'knee folded backwards');
   const clearance=Math.min(foot.y-points[hip+2].y,toe.y-points[hip+3].y);
   assert.ok(clearance>-1e-5,'foot penetrated floor');if(clearance<1e-5)grounded++;
  }
  assert.ok(grounded>=1,'walking must not have a flight phase');
  if(grounded===2)doubleSupport++;else singleSupport++;
  if(previous)for(const i of [0,1,2,5,6,8,9,11,12,15,16])assert.ok(new THREE.Quaternion(...k.pose[i].q).angleTo(new THREE.Quaternion(...previous.pose[i].q))<.5,'joint snapped between frames');
  previous=k;
 }
 assert.ok(doubleSupport>0&&singleSupport>0);
 applyPose(skeleton,keys[0].pose);
 const yaw=i=>new THREE.Euler().setFromQuaternion(skeleton.bones[i].getWorldQuaternion(new THREE.Quaternion()),'YXZ').y;
 assert.ok(yaw(0)*yaw(2)<0,'pelvis and chest must counter-rotate');
 assert.ok(skeleton.bones[7].getWorldPosition(new THREE.Vector3()).z<skeleton.bones[10].getWorldPosition(new THREE.Vector3()).z,'arms must oppose legs');
 }
});

test('walk knee extension has no abrupt acceleration at support transitions or loop seam',()=>{
 const limits=new Map([[.18,.07],[.28,.085],[.4,.12]]);
 for(const [stride,limit] of limits){
  const {keys}=generateWalk(defaultMarkers(),{stride}),cycle=keys.slice(0,-1);
  for(let frame=0;frame<cycle.length;frame++)for(const bone of [11,12,15,16]){
   const q=offset=>new THREE.Quaternion(...cycle[(frame+offset+cycle.length)%cycle.length].pose[bone].q);
   const acceleration=2*q(0).angleTo(q(-1).slerp(q(1),.5));
   assert.ok(acceleration<limit,`stride ${stride}, bone ${bone}, frame ${frame}: ${acceleration}`);
  }
 }
});

test('flat-foot crossing preserves ankle velocity after heel/toe contact correction',()=>{
 const points=defaultMarkers(),L=.85,toe=points[14].clone().sub(points[13]),X=new THREE.Vector3(1,0,0);
 let low=.6,high=1;
 for(let i=0;i<50;i++){const t=(low+high)/2;if(footTrajectory(t,L,.12).pitch>0)low=t;else high=t;}
 const crossing=(low+high)/2,h=1e-5;
 const height=t=>{const m=footTrajectory(t,L,.12),rolled=toe.clone().applyAxisAngle(X,m.pitch);return m.lift+Math.max(0,toe.y-rolled.y);};
 const a=height(crossing-h),b=height(crossing),c=height(crossing+h);
 assert.ok(Math.abs((c-b)/h-(b-a)/h)<.003,'contact correction introduced a vertical kick');
});
