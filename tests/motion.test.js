import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaultMarkers,buildSkeleton,applyPose,makeClip} from '../src/rig.js';
import {generateIdle,generateRun,runFootTrajectory} from '../src/motion.js';

for(const [name,generate] of [['idle',generateIdle],['running',generateRun]])test(`${name}: finite normalized rotations, fixed lengths, closed exportable loops on A/T poses`,()=>{
 for(const type of ['A','T'])for(const intensity of [.6,1.4]){
 const points=defaultMarkers(2,type),result=generate(points,{intensity,speed:1.25}),skeleton=buildSkeleton(points);
 assert.deepEqual(result.keys[0].pose,result.keys.at(-1).pose);
 assert.equal(makeClip(result.keys,result.duration).tracks.length,38);
 for(let f=0;f<result.keys.length;f++){
  const key=result.keys[f];applyPose(skeleton,key.pose);
  key.pose.forEach((p,i)=>{
   assert.ok([...p.q,...p.p].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...p.q)-1)<1e-6);
   if(i)assert.deepEqual(p.p,result.keys[0].pose[i].p);
   if(f)assert.ok(new THREE.Quaternion(...p.q).angleTo(new THREE.Quaternion(...result.keys[f-1].pose[i].q))<.85,`${name} joint ${i} snaps at frame ${f}`);
  });
  for(const toe of [14,18])assert.ok(skeleton.bones[toe].getWorldPosition(new THREE.Vector3()).y>=points[toe].y-1e-5);
 }
 }
});
test('idle keeps both feet planted while breathing and moving torso/head',()=>{
 const points=defaultMarkers(),skeleton=buildSkeleton(points),{keys}=generateIdle(points);
 for(const key of keys){applyPose(skeleton,key.pose);for(const foot of [13,17])assert.ok(skeleton.bones[foot].getWorldPosition(new THREE.Vector3()).distanceTo(points[foot])<1e-5);}
 for(const index of [0,1,2,4,5,8])assert.ok(keys.some(k=>new THREE.Quaternion(...k.pose[index].q).angleTo(new THREE.Quaternion(...keys[0].pose[index].q))>.005));
});
test('running includes alternating contacts and actual unsupported frames',()=>{
 const points=defaultMarkers(),skeleton=buildSkeleton(points),{keys}=generateRun(points);let flight=0,left=0,right=0;
 for(const key of keys){applyPose(skeleton,key.pose);const l=skeleton.bones[14].getWorldPosition(new THREE.Vector3()).y-points[14].y,r=skeleton.bones[18].getWorldPosition(new THREE.Vector3()).y-points[18].y;if(l>.015&&r>.015)flight++;if(l<.002&&r>.03)left++;if(r<.002&&l>.03)right++;}
 assert.ok(flight>0);assert.ok(left>0);assert.ok(right>0);
});
test('running foot velocity matches across contact and loop boundaries',()=>{
 const h=1e-5;for(const t of [.36,1]){const a=runFootTrajectory(t-h,.85),b=runFootTrajectory(t,.85),c=runFootTrajectory(t+h,.85);for(const k of ['z','lift','pitch'])assert.ok(Math.abs((b[k]-a[k])/h-(c[k]-b[k])/h)<.005);}
});

test('waiting idle looks around, rests a hand on the hip and returns without a loop snap',()=>{
 const points=defaultMarkers(),rig=buildSkeleton(points),{keys,duration}=generateIdle(points);assert.equal(duration,16);
 const poseAt=time=>{applyPose(rig,keys[Math.round(time*30)].pose);return rig;};
 const headAngles=keys.map(k=>new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...k.pose[4].q)));
 assert.ok(Math.max(...headAngles.map(e=>e.y))>.3);assert.ok(Math.min(...headAngles.map(e=>e.y))<-.27);assert.ok(Math.min(...headAngles.map(e=>e.x))<-.22);
 poseAt(0);const initialHand=rig.bones[7].getWorldPosition(new THREE.Vector3());
 poseAt(7);const hip=rig.bones[0].getWorldPosition(new THREE.Vector3()),hand=rig.bones[7].getWorldPosition(new THREE.Vector3());assert.ok(hand.y>initialHand.y+.12);assert.ok(hand.distanceTo(hip)<.40);assert.ok(rig.bones[6].getWorldPosition(new THREE.Vector3()).x>hand.x+.1);
 poseAt(15.9);assert.ok(rig.bones[7].getWorldPosition(new THREE.Vector3()).distanceTo(initialHand)<.02);
 for(let i=0;i<19;i++)assert.ok(new THREE.Quaternion(...keys.at(-2).pose[i].q).angleTo(new THREE.Quaternion(...keys[0].pose[i].q))<.02);
});

test('run stays in a forward plane with compact hips, folded recovery and opposing arms',()=>{
 for(const type of ['A','T'])for(const width of [.7,1.3]){
  const points=defaultMarkers(2,type,width),rig=buildSkeleton(points),{keys}=generateRun(points),xs=keys.map(k=>k.pose[0].p[0]);
  assert.ok(Math.max(...xs)-Math.min(...xs)<.012,'pelvis should not sway like a dance');
  for(const k of keys){applyPose(rig,k.pose);for(const [arm,forearm,hand] of [[5,6,7],[8,9,10]]){
   const a=rig.bones[arm].getWorldPosition(new THREE.Vector3()),b=rig.bones[forearm].getWorldPosition(new THREE.Vector3()),c=rig.bones[hand].getWorldPosition(new THREE.Vector3());
   const flex=b.clone().sub(a).angleTo(c.clone().sub(b));assert.ok(flex>1.3&&flex<1.7,'elbows should stay near 90 degrees');
  }}
  applyPose(rig,keys[0].pose);const foot=rig.bones[13].getWorldPosition(new THREE.Vector3()),hip=rig.bones[11].getWorldPosition(new THREE.Vector3()),elbow=rig.bones[6].getWorldPosition(new THREE.Vector3()),shoulder=rig.bones[5].getWorldPosition(new THREE.Vector3());
  assert.ok((foot.z-hip.z)*(elbow.z-shoulder.z)<0,'same-side arm and leg should oppose');rig.dispose();
 }
 const samples=Array.from({length:1001},(_,i)=>runFootTrajectory(i/1000,1));
 assert.ok(Math.max(...samples.map(m=>m.lift))>.45,'heel needs a clear recovery arc');assert.ok(Math.max(...samples.map(m=>Math.abs(m.z)))<.4,'avoid excessive backswing that collapses root height');
 for(const t of [.51,.54,.72,.75,.87,.88,.9]){const h=1e-6,a=runFootTrajectory(t-h,1),b=runFootTrajectory(t,1),c=runFootTrajectory(t+h,1);for(const key of ['z','lift','pitch'])assert.ok(Math.abs((b[key]-a[key])/h-(c[key]-b[key])/h)<.005,`${key} should stay smooth at ${t}`);}
});
