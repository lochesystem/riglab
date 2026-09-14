import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paintInfluences} from '../src/paint.js';
test('painting introduces selected bone while preserving four normalized influences',()=>{
 const r=paintInfluences([1,2,3,4],[.4,.3,.2,.1],5,.25,2);
 assert.equal(r.indices.length,4);assert.equal(r.weights[0],.25);assert.equal(r.indices[0],5);assert.ok(Math.abs(r.weights.reduce((a,b)=>a+b)-1)<1e-8);assert.ok(Math.abs(r.weights[1]/r.weights[2]-4/3)<1e-8);
});
test('removing a sole influence transfers weight to parent without invalid numbers',()=>{
 const r=paintInfluences([5,0,0,0],[1,0,0,0],5,-1,2);assert.equal(r.indices[0],2);assert.equal(r.weights[0],1);
 for(let a=-2;a<2;a+=.07){const p=paintInfluences([5,2,0,0],[.7,.3,0,0],5,a,2);assert.ok(p.weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));assert.ok(Math.abs(p.weights.reduce((x,y)=>x+y)-1)<1e-8);}
});

test('repeated removal reaches zero and reduces actual arm deformation',async()=>{
 const THREE=await import('three');
 const root=new THREE.Bone(),arm=new THREE.Bone();root.add(arm);arm.position.y=1;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,1,0],3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0],4));
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());mesh.add(root);mesh.bind(new THREE.Skeleton([root,arm]));arm.rotation.z=Math.PI/2;mesh.updateMatrixWorld(true);
 const before=mesh.getVertexPosition(0,new THREE.Vector3());let r={indices:[1,0,0,0],weights:[1,0,0,0]};
 for(let i=0;i<40;i++)r=paintInfluences(r.indices,r.weights,1,-.03,0);
 assert.equal(r.weights[r.indices.indexOf(1)]||0,0);
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(r.indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(r.weights,4));
 const rest=new THREE.Vector3(1,1,0),after=mesh.getVertexPosition(0,new THREE.Vector3());assert.ok(before.distanceTo(rest)>1);assert.ok(after.distanceTo(rest)<1e-6);
 geometry.dispose();mesh.material.dispose();mesh.skeleton.dispose();
});
