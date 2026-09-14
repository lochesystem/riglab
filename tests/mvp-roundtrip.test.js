import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {defaultMarkers,buildSkeleton,segmentsFor,capturePose,makeClip} from '../src/rig.js';
import {computeWeights} from '../src/weights.js';
import {paintInfluences} from '../src/paint.js';
// Browser FileReader equivalent for exporter tests without a renderer.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result=`data:${blob.type};base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.();});}};
for(const [label,width,pose] of [['standard',1,'A'],['broad',1.4,'A'],['slender',.7,'T']])test(`MVP ${label}: painted weights, skeleton and clip survive real GLB round trip`,async()=>{
 const points=defaultMarkers(2,pose,width),skeleton=buildSkeleton(points),positions=[];
 for(const p of points)for(const dx of [-.035,.035])for(const dy of [-.025,.025])positions.push(p.x+dx,p.y+dy,p.z+.03);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const data=computeWeights(new Float32Array(positions),segmentsFor(points));
 const i=20,r=paintInfluences(Array.from(data.indices.slice(i*4,i*4+4)),Array.from(data.weights.slice(i*4,i*4+4)),5,-.7,2);
 data.indices.set(r.indices,i*4);data.weights.set(r.weights,i*4);
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial()),group=new THREE.Group();group.add(mesh,skeleton.bones[0]);mesh.bind(skeleton);
 const rest=capturePose(skeleton);skeleton.bones[5].rotation.z=.6;const rotated=capturePose(skeleton);skeleton.bones[5].rotation.z=0;
 const clip=makeClip([{time:0,pose:rest},{time:1,pose:rotated}],1),bytes=await new GLTFExporter().parseAsync(group,{binary:true,animations:[clip]});
 const gltf=await new GLTFLoader().parseAsync(bytes,'');let loaded;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)loaded=o;});
 assert.equal(loaded.skeleton.bones.length,19);assert.deepEqual(Array.from(loaded.geometry.attributes.skinIndex.array),Array.from(data.indices));
 Array.from(loaded.geometry.attributes.skinWeight.array).forEach((v,j)=>assert.ok(Math.abs(v-data.weights[j])<1e-6));
 const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();mixer.update(.5);gltf.scene.updateMatrixWorld(true);
 const v=loaded.getVertexPosition(i,new THREE.Vector3());assert.ok(v.toArray().every(Number.isFinite));assert.equal(gltf.animations.length,1);
 mesh.geometry.dispose();mesh.material.dispose();skeleton.dispose();loaded.geometry.dispose();loaded.material.dispose();loaded.skeleton.dispose();
});
