import * as THREE from 'three';
import {buildSkeleton,capturePose,applyPose} from './rig.js';

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
  const skeleton=buildSkeleton(points),bones=skeleton.bones,rest=capturePose(skeleton);
  const duration=Math.round(30*1.2/speed)/30,frames=Math.round(duration*30),keys=[];
  const lengths=[11,15].map(i=>points[i].distanceTo(points[i+1])+points[i+1].distanceTo(points[i+2]));
  const length=Math.min(...lengths);
  if(length<.05)throw new Error('Ajuste as articulações das pernas antes de gerar a caminhada.');
  const halfStep=stride*length*.5,axisX=new THREE.Vector3(1,0,0);
  function aim(index,child,worldDirection){
    const inv=bones[index].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bones[index].quaternion.setFromUnitVectors(new THREE.Vector3(...rest[child].p).normalize(),worldDirection.clone().normalize().applyQuaternion(inv));
    bones[0].updateMatrixWorld(true);
  }
  function leg(index,target,pitch){
    const hip=bones[index].getWorldPosition(new THREE.Vector3()),a=new THREE.Vector3(...rest[index+1].p).length(),b=new THREE.Vector3(...rest[index+2].p).length();
    const dir=target.clone().sub(hip),distance=THREE.MathUtils.clamp(dir.length(),Math.abs(a-b)+.0001,a+b-.0001);dir.normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,a*a-along*along));
    const pole=new THREE.Vector3(0,0,1).addScaledVector(dir,-dir.z).normalize();
    const knee=hip.clone().addScaledVector(dir,along).addScaledVector(pole,bend);
    aim(index,index+1,knee.clone().sub(hip));aim(index+1,index+2,target.clone().sub(knee));
    bones[index+2].quaternion.copy(bones[index+2].parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(axisX,pitch));
    bones[0].updateMatrixWorld(true);
  }
  for(let frame=0;frame<frames;frame++) {
    const phase=frame/frames,theta=TAU*phase;applyPose(skeleton,rest);
    // Weight shifts toward the supporting side; shoulders counter the pelvis.
    bones[0].position.y-=length*(.027+.009*Math.cos(theta*2-.4));
    bones[0].position.x+=length*.028*Math.sin(theta-.3);
    bones[0].rotation.set(.025,-.045*Math.cos(theta),.024*Math.sin(theta-.3));
    bones[1].rotation.set(.01,.025*Math.cos(theta-.15),-.016*Math.sin(theta-.3));
    bones[2].rotation.set(.006*Math.sin(theta*2-.3),.065*Math.cos(theta-.22),-.012*Math.sin(theta-.45));
    bones[4].rotation.set(-.025-.006*Math.sin(theta*2-.6),-.03*Math.cos(theta-.3),.004*Math.sin(theta));
    bones[0].updateMatrixWorld(true);
    const targets=[11,15].map((index,side)=>{
      const motion=footTrajectory(phase+side*.5,length,halfStep),foot=points[index+2].clone();
      const toe=points[index+3].clone().sub(points[index+2]),rolled=toe.clone().applyAxisAngle(axisX,motion.pitch);
      foot.z+=motion.z+toe.z-rolled.z;
      foot.y+=motion.lift+Math.max(0,toe.y-rolled.y);
      return {index,foot,pitch:motion.pitch};
    });
    // Adapt the pelvis height to both actual leg lengths rather than keeping a
    // permanently crouched pose. Leaves a small margin before knee lockout.
    let rootY=bones[0].position.y;
    targets.forEach(({index,foot},side)=>{
      const hip=bones[index].getWorldPosition(new THREE.Vector3());
      const horizontal=(foot.x-hip.x)**2+(foot.z-hip.z)**2;
      const vertical=Math.sqrt(Math.max(0,(lengths[side]*.995)**2-horizontal));
      rootY=Math.min(rootY,foot.y+vertical-(hip.y-bones[0].position.y));
    });
    bones[0].position.y=rootY;bones[0].updateMatrixWorld(true);
    targets.forEach(({index,foot,pitch})=>leg(index,foot,pitch));
    for(const [arm,sign,offset] of [[5,1,0],[8,-1,Math.PI]]) {
      const swing=stride*.85*Math.cos(theta+offset-.22);
      const down=new THREE.Vector3(sign*.10,-1,0).normalize().applyAxisAngle(axisX,swing);
      aim(arm,arm+1,down);
      // Forearms and hands lag the shoulder instead of moving as rigid sticks.
      const flex=.17+.09*(1-Math.cos(theta+offset-.55));
      const forearm=down.clone().applyAxisAngle(axisX,-flex);
      aim(arm+1,arm+2,forearm);
      bones[arm+2].rotation.x=.045*Math.sin(theta+offset-.7);
      bones[arm+2].rotation.z=sign*.035;
    }
    keys.push({time:frame/30,pose:capturePose(skeleton)});
  }
  keys.push({time:duration,pose:structuredClone(keys[0].pose)});
  skeleton.dispose();return {keys,duration};
}
