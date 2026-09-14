import * as THREE from 'three';
import {capturePose,applyPose} from './rig.js';
import {createMotionRig} from './motion.js';

const TAU=Math.PI*2;
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};

// Stance and swing share endpoint velocity and acceleration. A mild backswing
// before lift-off is intentional: it avoids an abrupt change of foot direction.
export function footTrajectory(phase,length,halfStep){
  const t=((phase%1)+1)%1,stance=t<.6,u=stance?t/.6:(t-.6)/.4;
  const tangent=-2*halfStep*.4/.6;
  const z=stance?halfStep*(1-2*u):-halfStep+tangent*u+(2*halfStep-tangent)*smooth(u);
  const lift=stance?0:length*.095*Math.sin(Math.PI*u)**3;
  const pitch=stance?-.12*(1-smooth(t/.12))+.22*smooth((t-.43)/.17):.22-.34*smooth(u);
  return {z,lift,pitch};
}

// Analytic legs, continuous foot paths and phased upper-body motion. Generates
// ordinary editable poses; no runtime controller is needed after export.
export function generateWalk(points,{speed=1,stride=.28}={}) {
  speed=THREE.MathUtils.clamp(Number(speed)||1,.5,2);
  stride=THREE.MathUtils.clamp(Number(stride)||.28,.1,.45);
  const {skeleton,bones,rest,length,feet,footTarget,arm}=createMotionRig(points);
  const duration=Math.round(30*1.2/speed)/30,frames=Math.round(duration*30),keys=[];
  const halfStep=stride*length*.5;
  // Walking has a slightly wider support track than running, independent of
  // the spread in the bind pose. The hip width and bone lengths stay intact.
  const halfTrack=THREE.MathUtils.clamp(Math.abs(points[11].x-points[15].x)*.22,length*.065,length*.105);
  for(let frame=0;frame<frames;frame++) {
    const phase=frame/frames,theta=TAU*phase;applyPose(skeleton,rest);
    // Lower at double support, rise over the supporting leg. The small lateral
    // shift follows support, while pelvis and chest counter-rotate.
    const support=Math.sin(theta);
    bones[0].position.y-=length*(.008+.006*Math.cos(theta*2));
    bones[0].position.x+=length*.018*support;
    bones[0].rotation.set(.055,-.035*Math.cos(theta),-.014*support);
    bones[1].rotation.set(.006,.012*Math.cos(theta),.009*support);
    bones[2].rotation.set(.004*Math.sin(theta*2),.060*Math.cos(theta-.10),.007*support);
    bones[3].rotation.x=-.018;
    bones[4].rotation.set(-.043-.004*Math.sin(theta*2),-.018*Math.cos(theta-.10),-.002*support);
    feet([11,15].map((index,side)=>{
      const motion=footTrajectory(phase+side*.5,length,halfStep);
      const target=footTarget(index,motion.z,motion.lift,motion.pitch),sign=side===0?1:-1;
      target.position.x=points[0].x+sign*halfTrack;
      target.kneePole=new THREE.Vector3(-sign*.06,0,1);
      return target;
    }));
    const shoulderFrame=bones[2].getWorldQuaternion(new THREE.Quaternion());
    for(const [index,sign,offset] of [[5,1,0],[8,-1,Math.PI]]) {
      const swing=stride*.85*Math.cos(theta+offset-.12);
      const flex=.20+.06*(1-Math.cos(theta+offset-.35));
      arm(index,sign,swing,flex,.030*Math.sin(theta+offset-.45),.075,shoulderFrame);
    }
    keys.push({time:frame/30,pose:capturePose(skeleton)});
  }
  keys.push({time:duration,pose:structuredClone(keys[0].pose)});
  skeleton.dispose();return {keys,duration};
}
