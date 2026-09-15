import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {computeWeights} from '../src/weights.js';
import {defaultMarkers,segmentsFor,buildSkeleton} from '../src/rig.js';
const at=(p,points=defaultMarkers())=>{const r=computeWeights(new Float32Array(p),segmentsFor(points)),w=Array(19).fill(0);r.indices.forEach((id,i)=>w[id]+=r.weights[i]);return w;};

test('trapezius, neck and ribcage resist humerus rotations while deltoid and shaft follow',()=>{
 for(const side of [-1,1]){
  const arm=side>0?5:8;
  assert.ok(at([side*.18,1.60,0])[arm]<.03);
  assert.ok(at([side*.23,1.39,0])[arm]<.10);
  assert.ok(at([side*.20,1.29,.1])[arm]<.03);
  const neck=at([side*.06,1.70,0]);assert.ok(neck[3]>.65);assert.ok(neck[arm]<.001);
  assert.ok(at([side*.34,1.53,0])[arm]>.9);
  assert.ok(at([side*.42,1.40,0])[arm]>.95);
 }
});
test('shoulder transition is normalized, symmetric, scale invariant and has no abrupt weight cliff',()=>{
 let previous;for(let x=.12;x<.45;x+=.001){const w=at([x,1.54,.025]);assert.ok(Math.abs(w.reduce((a,b)=>a+b)-1)<1e-6);assert.ok(w.every(v=>Number.isFinite(v)&&v>=0&&v<=1));if(previous)assert.ok(Math.abs(w[5]-previous[5])<.025);previous=w;
 const mirrored=at([-x,1.54,.025]);assert.ok(Math.abs(w[5]-mirrored[8])<1e-6);
 }
 const base=at([.23,1.39,0]);for(const scale of [.5,3]){const scaled=at([.23*scale,1.39*scale,0],defaultMarkers(2*scale));base.forEach((w,i)=>assert.ok(Math.abs(w-scaled[i])<1e-5));}
});
test('rotating the humerus leaves medial trapezius fixed and only slightly moves the axilla',()=>{
 const points=defaultMarkers(),skeleton=buildSkeleton(points),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([.18,1.6,0,.23,1.39,0,.42,1.40,0],3));
 const {indices,weights}=computeWeights(geometry.attributes.position.array,segmentsFor(points));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());mesh.add(skeleton.bones[0]);mesh.bind(skeleton);skeleton.bones[5].rotation.z=Math.PI/3;mesh.updateMatrixWorld(true);skeleton.update();
 const displacement=i=>{const rest=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i);return mesh.applyBoneTransform(i,rest.clone()).distanceTo(rest);};
 assert.ok(displacement(0)<.005);assert.ok(displacement(1)<.02);assert.ok(displacement(2)>.12);
});
test('arms in T pose and downward arms keep distal arm influences',()=>{
 const t=defaultMarkers(2,'T');assert.ok(at([.53,1.54,0],t)[5]>.90);
 const down=defaultMarkers();down[6].set(.31,1.21,0);down[7].set(.32,.9,0);
 const w=at([.31,1.26,0],down);assert.ok(w[5]+w[6]>.95);
});

// Use actual sleeve vertices, not just points on the bone axis: a narrow
// anatomical envelope previously transferred these surfaces to the torso.
test('demo sleeve surface follows the arm instead of being pinned to the torso',async()=>{
 const {createDemo}=await import('../src/demo.js');
 const position=createDemo().children[0].geometry.attributes.position;
 const {indices,weights}=computeWeights(position.array,segmentsFor(defaultMarkers()));
 const skeleton=buildSkeleton(defaultMarkers()),g=new THREE.BufferGeometry();
 g.setAttribute('position',position.clone());g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const mesh=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());mesh.add(skeleton.bones[0]);mesh.bind(skeleton);
 skeleton.bones[5].rotation.z=Math.PI/3;skeleton.bones[8].rotation.z=-Math.PI/3;mesh.updateMatrixWorld(true);skeleton.update();
 let checked=0;
 for(let i=0;i<position.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(position,i);
  if(Math.abs(p.x)<.36||p.y<1.20||p.y>1.43)continue;
  const arm=p.x>0?5:8;let armWeight=0;
  for(let j=0;j<4;j++)if(indices[i*4+j]>=arm&&indices[i*4+j]<=arm+2)armWeight+=weights[i*4+j];
  assert.ok(armWeight>.98,`sleeve ${p.toArray()}: arm weight ${armWeight}`);
  const expected=p.clone().applyMatrix4(skeleton.bones[arm].matrixWorld.clone().multiply(skeleton.boneInverses[arm]));
  assert.ok(mesh.applyBoneTransform(i,p.clone()).distanceTo(expected)<.005);checked++;
 }
 assert.ok(checked>100);
});
