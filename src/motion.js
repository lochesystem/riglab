import * as THREE from 'three';
import {buildSkeleton,capturePose,applyPose} from './rig.js';
const TAU=Math.PI*2,X=new THREE.Vector3(1,0,0);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const finite=(value,fallback,min,max)=>THREE.MathUtils.clamp(Number.isFinite(Number(value))?Number(value):fallback,min,max);

// Shared constraints for authored procedural motion: forward knee pole, rigid
// bone lengths, world-space feet and analytic IK (no frame-to-frame drift).
function createMotionRig(points){
 const skeleton=buildSkeleton(points),bones=skeleton.bones,rest=capturePose(skeleton);
 const lengths=[11,15].map(i=>points[i].distanceTo(points[i+1])+points[i+1].distanceTo(points[i+2]));
 const length=Math.min(...lengths);
 if(!Number.isFinite(length)||length<.05)throw new Error('Ajuste o comprimento das pernas antes de gerar a animação.');
 function aim(index,child,direction){
  if(direction.lengthSq()<1e-10)return;
  const inv=bones[index].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bones[index].quaternion.setFromUnitVectors(new THREE.Vector3(...rest[child].p).normalize(),direction.clone().normalize().applyQuaternion(inv));
  bones[0].updateMatrixWorld(true);
 }
 function feet(targets){
  bones[0].updateMatrixWorld(true);let rootY=bones[0].position.y;
  targets.forEach(({index,position},side)=>{
   const hip=bones[index].getWorldPosition(new THREE.Vector3()),horizontal=(position.x-hip.x)**2+(position.z-hip.z)**2;
   rootY=Math.min(rootY,position.y+Math.sqrt(Math.max(0,(lengths[side]*.998)**2-horizontal))-(hip.y-bones[0].position.y));
  });
  bones[0].position.y=rootY;bones[0].updateMatrixWorld(true);
  for(const {index,position,pitch=0} of targets){
   const hip=bones[index].getWorldPosition(new THREE.Vector3()),a=new THREE.Vector3(...rest[index+1].p).length(),b=new THREE.Vector3(...rest[index+2].p).length();
   const direction=position.clone().sub(hip),distance=THREE.MathUtils.clamp(direction.length(),Math.abs(a-b)+1e-5,a+b-1e-5);direction.normalize();
   const along=(a*a-b*b+distance*distance)/(2*distance),radius=Math.sqrt(Math.max(0,a*a-along*along));
   const pole=new THREE.Vector3(0,0,1).addScaledVector(direction,-direction.z).normalize();
   const knee=hip.clone().addScaledVector(direction,along).addScaledVector(pole,radius);
   aim(index,index+1,knee.sub(hip));
   aim(index+1,index+2,position.clone().sub(bones[index+1].getWorldPosition(new THREE.Vector3())));
   bones[index+2].quaternion.copy(bones[index+2].parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(X,pitch));
   bones[0].updateMatrixWorld(true);
  }
 }
 function footTarget(index,z,lift,pitch){
  const toe=points[index+3].clone().sub(points[index+2]),rolled=toe.clone().applyAxisAngle(X,pitch),position=points[index+2].clone();
  position.z+=z+toe.z-rolled.z;position.y+=lift+Math.max(0,toe.y-rolled.y);
  return {index,position,pitch};
 }
 function arm(index,sign,swing,flex,wrist=0,spread=.12){
  const direction=new THREE.Vector3(sign*spread,-1,0).normalize().applyAxisAngle(X,swing);
  aim(index,index+1,direction);aim(index+1,index+2,direction.clone().applyAxisAngle(X,-flex));
  bones[index+2].rotation.set(wrist,0,sign*.035);
 }
 function handOnHip(index,sign,weight){
  if(weight<=0)return;
  bones[0].updateMatrixWorld(true);
  const shoulder=bones[index],elbow=bones[index+1],hand=bones[index+2];
  const initialShoulder=shoulder.quaternion.clone(),initialElbow=elbow.quaternion.clone();
  const hipIndex=sign>0?11:15;
  const target=bones[0].localToWorld(new THREE.Vector3(points[hipIndex].x-points[0].x+sign*length*.17,length*.14,length*.025));
  const origin=shoulder.getWorldPosition(new THREE.Vector3()),direction=target.clone().sub(origin);
  const a=elbow.position.length(),b=hand.position.length(),d=THREE.MathUtils.clamp(direction.length(),Math.abs(a-b)+1e-5,a+b-1e-5);direction.normalize();
  const along=(a*a-b*b+d*d)/(2*d),radius=Math.sqrt(Math.max(0,a*a-along*along));
  const pole=new THREE.Vector3(sign,0,-.25);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const elbowPoint=origin.clone().addScaledVector(direction,along).addScaledVector(pole,radius);
  aim(index,index+1,elbowPoint.sub(origin));
  aim(index+1,index+2,target.sub(elbow.getWorldPosition(new THREE.Vector3())));
  const goalShoulder=shoulder.quaternion.clone(),goalElbow=elbow.quaternion.clone();
  shoulder.quaternion.copy(initialShoulder).slerp(goalShoulder,weight);
  elbow.quaternion.copy(initialElbow).slerp(goalElbow,weight);
  hand.rotation.x=THREE.MathUtils.lerp(hand.rotation.x,-.12,weight);
  hand.rotation.z=THREE.MathUtils.lerp(hand.rotation.z,-sign*.25,weight);
  bones[0].updateMatrixWorld(true);
 }
 return {skeleton,bones,rest,length,feet,footTarget,arm,handOnHip};
}
function bake(rig,duration,name,poseAt){
 const frames=Math.max(12,Math.round(duration*30)),keys=[];duration=frames/30;
 for(let frame=0;frame<frames;frame++){applyPose(rig.skeleton,rig.rest);poseAt(frame/frames);rig.bones[0].updateMatrixWorld(true);keys.push({time:frame/30,pose:capturePose(rig.skeleton)});}
 keys.push({time:duration,pose:structuredClone(keys[0].pose)});rig.skeleton.dispose();return {keys,duration,name};
}

// Authored gestures have independent ease-in, hold and release windows. They
// are deliberately separated by quiet time rather than repeated every breath.
export function idleGesture(time,start,peak,release,end){
 return smooth((time-start)/(peak-start))*(1-smooth((time-release)/(end-release)));
}
export function generateIdle(points,{intensity=1,speed=1}={}){
 intensity=finite(intensity,1,.4,1.5);speed=finite(speed,1,.6,1.5);
 const rig=createMotionRig(points),{bones:b,length:L,feet,footTarget,arm,handOnHip}=rig;
 return bake(rig,16/speed,'Idle — espera',phase=>{
  const seconds=phase*16,t=TAU*phase,breath=Math.sin(4*t),sway=Math.sin(t-.35);
  const left=idleGesture(seconds,1.4,2.3,3.0,4.1),right=idleGesture(seconds,6.7,7.7,8.4,9.5);
  const up=idleGesture(seconds,11.3,12.3,12.9,14.2);
  const restHand=idleGesture(seconds,4.1,5.5,9.6,11.1);
  const support=idleGesture(seconds,3.7,5.1,9.7,11.7);
  const knees=idleGesture(seconds,10.7,11.5,11.7,12.8);
  const gaze=(.42*left-.38*right)*intensity;
  const torsoGaze=(.065*idleGesture(seconds,1.7,2.6,3.0,4.3)-.06*idleGesture(seconds,7,8,8.4,9.7))*intensity;
  b[0].position.x+=L*intensity*(.010*sway+.040*support);
  b[0].position.y+=L*(-.021+.0045*intensity*breath-.020*intensity*knees);
  b[0].position.z+=L*.004*intensity*Math.sin(t+.4);
  b[0].rotation.set(.014,-.008*intensity*Math.sin(t),intensity*(.009*sway+.015*support));
  b[1].rotation.set(-.009*intensity*breath,torsoGaze*.3,-.006*intensity*sway);
  b[2].rotation.set(-.011*intensity*Math.sin(4*t-.2),torsoGaze,-.012*intensity*support-.005*intensity*Math.sin(t-.55));
  b[3].rotation.set(.005*intensity*Math.sin(4*t-.4)-.045*intensity*up,gaze*.20,0);
  b[4].rotation.set(-.012+.007*intensity*Math.sin(4*t-.6)-.24*intensity*up,gaze*.80,.012*intensity*left-.010*intensity*right);
  feet([footTarget(11,0,0,0),footTarget(15,0,0,0)]);
  for(const [index,sign,offset] of [[5,1,0],[8,-1,.35]]){
   const swing=-.035+.024*intensity*Math.sin(2*t-.65+offset)-.04*intensity*knees;
   arm(index,sign,swing,.16+.035*intensity*Math.sin(4*t-.5+offset),.025*intensity*Math.sin(2*t-.9+offset));
  }
  handOnHip(5,1,restHand);
 });
}

// Contact lasts less than half a cycle: phases .36-.5 and .86-1 are
// unsupported. Hermite swing matches stance velocity at both boundaries.
export function runFootTrajectory(phase,length,stride=.55){
 const t=((phase%1)+1)%1,contact=.36,halfStep=stride*length*.5;
 const stance=t<contact,u=stance?t/contact:(t-contact)/(1-contact),tangent=-2*halfStep*(1-contact)/contact;
 const z=stance?halfStep*(1-2*u):-halfStep+tangent*u+(2*halfStep-tangent)*smooth(u);
 // Early recovery lifts the heel behind the body before the knee drives forward.
 const arc=stance?0:Math.sin(Math.PI*u)**2*(1+.8*Math.sin(TAU*u));
 const lift=length*.30*arc;
 const pitch=stance?-.08*(1-smooth(t/.09))+.32*smooth((t-.2)/.16):.32-.40*smooth(u);
 return {z,lift,pitch,stance};
}
export function generateRun(points,{speed=1,stride=.55,intensity=1}={}){
 speed=finite(speed,1,.7,1.4);stride=finite(stride,.55,.35,.72);intensity=finite(intensity,1,.4,1.5);
 const rig=createMotionRig(points),{bones:b,length:L,feet,footTarget,arm}=rig;
 return bake(rig,.8/speed,'Running',phase=>{
  const t=TAU*phase;
  b[0].position.y+=L*(-.045-.073*Math.cos(2*t-.72*Math.PI));
  b[0].position.x+=L*.019*intensity*Math.sin(t-.15);
  b[0].rotation.set(.11+.035*intensity,-.08*intensity*Math.cos(t),.025*intensity*Math.sin(t-.25));
  b[1].rotation.set(.025,.035*intensity*Math.cos(t-.12),-.015*intensity*Math.sin(t-.25));
  b[2].rotation.set(.018*intensity*Math.sin(2*t-.6),.105*intensity*Math.cos(t-.2),-.018*intensity*Math.sin(t-.4));
  b[3].rotation.x=-.04;
  b[4].rotation.set(-.10-.035*intensity-.014*Math.sin(2*t-.85),-.03*intensity*Math.cos(t-.35),.008*intensity*Math.sin(t-.55));
  feet([11,15].map((index,side)=>{const m=runFootTrajectory(phase+side*.5,L,stride);return footTarget(index,m.z,m.lift,m.pitch);}));
  for(const [index,sign,offset] of [[5,1,0],[8,-1,Math.PI]]){
   const swing=(.40+.13*intensity)*Math.cos(t+offset-.18);
   const flex=1.25+.17*Math.cos(t+offset-.5);
   arm(index,sign,swing,flex,.06*intensity*Math.sin(t+offset-.65),.10);
  }
 });
}
