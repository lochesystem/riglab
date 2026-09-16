import * as THREE from 'three';
import {JOINTS} from './rig.js';

// Estimate travel from the backward velocity of low, supporting feet.
// Reads clip data only, so previewing never modifies the rig or exported clip.
export function estimateTravelSpeed(keys,duration){
 if(keys.length<3||!(duration>0))return 0;
 const frames=[...keys].sort((a,b)=>a.time-b.time).map(k=>{
  const world=[];for(let i=0;i<19;i++){const p=k.pose[i];if(!p)return null;const m=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(p.p),new THREE.Quaternion().fromArray(p.q),new THREE.Vector3(1,1,1));world[i]=JOINTS[i][2]<0?m:world[JOINTS[i][2]].clone().multiply(m);}
  return {time:k.time,feet:[13,17].map(i=>new THREE.Vector3().setFromMatrixPosition(world[i]))};
 });
 if(frames.some(f=>!f))return 0;
 const low=[0,1].map(i=>Math.min(...frames.map(f=>f.feet[i].y))),velocities=[];
 for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i],dt=b.time-a.time;if(dt<=0)continue;for(let side=0;side<2;side++){const speed=(a.feet[side].z-b.feet[side].z)/dt;if(a.feet[side].y<low[side]+.045&&b.feet[side].y<low[side]+.045&&speed>.04)velocities.push(speed);}}
 if(velocities.length<4)return 0;velocities.sort((a,b)=>a-b);return Math.min(8,velocities[Math.floor(velocities.length/2)]);
}
export const wrapScenery=(z,distance,span=56)=>((z-distance+span/2)%span+span)%span-span/2;
export function createScenery(scene){
 const root=new THREE.Group();root.name='PreviewScenery';root.visible=false;scene.add(root);
 const chunks=[],trees=[];let distance=0,mode='studio';
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
 const grass=material('#52653b'),soil=material('#9b8059'),stone=material('#778078'),bark=material('#5a4332'),leaves=[material('#35523c'),material('#496749'),material('#60794b')];
 const box=new THREE.BoxGeometry(1,1,1),rock=new THREE.IcosahedronGeometry(1,0),trunk=new THREE.CylinderGeometry(.09,.16,1,5),canopy=new THREE.ConeGeometry(1,2,6);
 function mesh(group,geometry,mat,x,y,z,sx=1,sy=sx,sz=sx){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=true;m.castShadow=true;group.add(m);return m;}
 let seed=43;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<7;i++){
  const g=new THREE.Group();root.add(g);chunks.push(g);
  mesh(g,box,grass,0,-.1,0,40,.16,8).castShadow=false;
  mesh(g,box,soil,0,-.018,0,2.7,.012,8).castShadow=false;
  for(let j=0;j<18;j++){
   const side=j%2?1:-1,z=random()*7.8-3.9;
   mesh(g,rock,stone,side*(1.55+random()*3),.05,z,.07+random()*.17,.07+random()*.1,.1+random()*.2);
  }
  for(let j=0;j<10;j++){
   const tree=new THREE.Group();g.add(tree);trees.push(tree);tree.position.set((j%2?1:-1)*(2.4+random()*9),0,random()*8-4);const h=2.4+random()*2.5;
   mesh(tree,trunk,bark,0,h*.32,0,1,h*.64,1);
   mesh(tree,canopy,leaves[j%3],0,h*.65,0,.65+random()*.4,h*.48,.65+random()*.4);
   mesh(tree,canopy,leaves[(j+1)%3],0,h*.9,0,.5,h*.32,.5);
  }
 }
 function place(){chunks.forEach((g,i)=>g.position.z=wrapScenery((i-3)*8,distance));}
 return {root,get distance(){return distance;},get mode(){return mode;},setMode(value){mode=value;root.visible=value!=='studio';trees.forEach(t=>t.visible=value==='forest');place();},reset(value=0){distance=Number.isFinite(value)?value:0;place();},update(delta,speed,model){if(!root.visible)return;distance=(distance+Math.max(0,delta)*Math.max(0,speed))%56;root.position.set(model.position.x,0,model.position.z);const forward=new THREE.Vector3(0,0,1).applyQuaternion(model.quaternion);root.rotation.y=Math.atan2(forward.x,forward.z);place();}};
}
