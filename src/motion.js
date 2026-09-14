import * as THREE from 'three';
import {buildSkeleton,capturePose,applyPose} from './rig.js';
const TAU=Math.PI*2,X=new THREE.Vector3(1,0,0);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const finite=(value,fallback,min,max)=>THREE.MathUtils.clamp(Number.isFinite(Number(value))?Number(value):fallback,min,max);

// Shared constraints for authored procedural motion: forward knee pole, rigid
// bone lengths, world-space feet and analytic IK (no frame-to-frame drift).
export function createMotionRig(points){
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
 function aimInPlane(index,child,direction,right){
  const frame=(down,side)=>{const up=down.clone().normalize().negate(),x=side.clone().addScaledVector(up,-side.dot(up)).normalize(),z=new THREE.Vector3().crossVectors(x,up).normalize();return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));};
  const reference=frame(new THREE.Vector3(...rest[child].p),X);
  const world=frame(direction,right).multiply(reference.invert());
  bones[index].quaternion.copy(bones[index].parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(world);bones[0].updateMatrixWorld(true);
 }
 function feet(targets){
  bones[0].updateMatrixWorld(true);let rootY=bones[0].position.y;
  targets.forEach(({index,position},side)=>{
   const hip=bones[index].getWorldPosition(new THREE.Vector3()),horizontal=(position.x-hip.x)**2+(position.z-hip.z)**2;
   rootY=Math.min(rootY,position.y+Math.sqrt(Math.max(0,(lengths[side]*.998)**2-horizontal))-(hip.y-bones[0].position.y));
  });
  bones[0].position.y=rootY;bones[0].updateMatrixWorld(true);
  for(const {index,position,pitch=0,kneePole} of targets){
   const hip=bones[index].getWorldPosition(new THREE.Vector3()),a=new THREE.Vector3(...rest[index+1].p).length(),b=new THREE.Vector3(...rest[index+2].p).length();
   const direction=position.clone().sub(hip),distance=THREE.MathUtils.clamp(direction.length(),Math.abs(a-b)+1e-5,a+b-1e-5);direction.normalize();
   const along=(a*a-b*b+distance*distance)/(2*distance),radius=Math.sqrt(Math.max(0,a*a-along*along));
   const pole=(kneePole||new THREE.Vector3(0,0,1)).clone();pole.addScaledVector(direction,-pole.dot(direction)).normalize();
   const knee=hip.clone().addScaledVector(direction,along).addScaledVector(pole,radius);
   const right=new THREE.Vector3().crossVectors(pole,direction).normalize();
   if(kneePole)aimInPlane(index,index+1,knee.sub(hip),right);else aim(index,index+1,knee.sub(hip));
   const shinDirection=position.clone().sub(bones[index+1].getWorldPosition(new THREE.Vector3()));
   if(kneePole)aimInPlane(index+1,index+2,shinDirection,right);else aim(index+1,index+2,shinDirection);
   bones[index+2].quaternion.copy(bones[index+2].parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(X,pitch));
   bones[0].updateMatrixWorld(true);
  }
 }
 function footTarget(index,z,lift,pitch){
  const toe=points[index+3].clone().sub(points[index+2]),rolled=toe.clone().applyAxisAngle(X,pitch),position=points[index+2].clone();
  position.z+=z+toe.z-rolled.z;position.y+=lift+Math.max(0,toe.y-rolled.y);
  return {index,position,pitch};
 }
 function arm(index,sign,swing,flex,wrist=0,spread=.12,frame=null){
  const direction=new THREE.Vector3(sign*spread,-1,0).normalize().applyAxisAngle(X,swing);
  const lower=direction.clone().applyAxisAngle(X,-flex);if(frame){direction.applyQuaternion(frame);lower.applyQuaternion(frame);}aim(index,index+1,direction);aim(index+1,index+2,lower);
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

// Contact -> toe-off -> heel recovery -> knee drive -> next contact.
// Explicit Hermite arcs bound the backswing instead of allowing an oversized
// tangent to pull the foot far behind the body and collapse the pelvis via IK.
function runCurve(t,nodes){
 let i=0;while(i<nodes.length-2&&t>nodes[i+1][0])i++;
 const [a,p,m]=nodes[i],[b,q,n]=nodes[i+1],span=b-a,u=(t-a)/span;
 return (2*u**3-3*u**2+1)*p+(u**3-2*u**2+u)*span*m+(-2*u**3+3*u**2)*q+(u**3-u**2)*span*n;
}
export function runFootTrajectory(phase,length,stride=.55){
 const t=((phase%1)+1)%1,contact=.36,halfStep=stride*length*.5,velocity=-2*halfStep/contact;
 const stance=t<contact;
 const z=stance?halfStep+velocity*t:runCurve(t,[[.36,-halfStep,velocity],[.51,-halfStep*1.20,0],[.72,halfStep*.10,halfStep*5],[.87,halfStep*1.20,0],[1,halfStep,velocity]]);
 const lift=stance?0:length*runCurve(t,[[.36,0,0],[.58,.50,0],[.74,.44,-1.4],[.88,.12,-1.3],[1,0,0]]);
 const pitch=stance?-.06*(1-smooth(t/.10))+.38*smooth((t-.22)/.14):runCurve(t,[[.36,.38,0],[.54,.65,0],[.75,.10,-2],[.9,-.06,0],[1,-.06,0]]);
 return {z,lift:Math.max(0,lift),pitch,stance};
}
export function generateRun(points,{speed=1,stride=.55,intensity=1}={}){
 speed=finite(speed,1,.7,1.4);stride=finite(stride,.55,.35,.72);intensity=finite(intensity,1,.4,1.5);
 const rig=createMotionRig(points),{bones:b,length:L,feet,footTarget,arm}=rig;
 return bake(rig,.8/speed,'Running',phase=>{
  const t=TAU*phase;
  // Compression follows contact; maximum height occurs during flight.
  b[0].position.y+=L*(-.025-.040*Math.cos(2*t-.56*Math.PI));
  b[0].position.x+=L*.005*intensity*Math.sin(t);
  b[0].rotation.set(.19+.025*intensity,-.055*intensity*Math.cos(t),-.018*intensity*Math.cos(t));
  b[1].rotation.set(.012,.020*intensity*Math.cos(t),.010*intensity*Math.cos(t));
  b[2].rotation.set(.006*Math.sin(2*t),.105*intensity*Math.cos(t-.10),.014*intensity*Math.cos(t-.10));
  b[3].rotation.x=-.04;
  b[4].rotation.set(-.16-.025*intensity-.006*Math.sin(2*t),-.015*intensity*Math.cos(t),0);
  const halfTrack=THREE.MathUtils.clamp(Math.abs(points[11].x-points[15].x)*.17,L*.045,L*.075);
  feet([11,15].map((index,side)=>{
   const m=runFootTrajectory(phase+side*.5,L,stride),target=footTarget(index,m.z,m.lift,m.pitch),sign=side===0?1:-1;
   target.position.x=points[0].x+sign*halfTrack;
   target.kneePole=new THREE.Vector3(-sign*.12,0,1);
   return target;
  }));
  const shoulderFrame=b[2].getWorldQuaternion(new THREE.Quaternion());
  for(const [index,sign,offset] of [[5,1,0],[8,-1,Math.PI]]){
   // Humerus swings in the sagittal plane, opposite the ipsilateral leg.
   const swing=(.48+.10*intensity)*Math.cos(t+offset-.08);
   const flex=1.50+.10*Math.cos(t+offset-.25);
   arm(index,sign,swing,flex,.025*Math.sin(t+offset-.3),.065,shoulderFrame);
  }
 });
}
