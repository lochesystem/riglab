import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {defaultMarkers,buildSkeleton,capturePose,applyPose,makeClip} from '../src/rig.js';
import {handDefinitions,withHands,setGrip,handWeights,extendHandPose,validHandConfig} from '../src/hands.js';
const config={L:{length:.2,width:.09,palm:.38,roll:0},R:{length:.2,width:.09,palm:.38,roll:0}};
function fixture(){
 const points=defaultMarkers(),defs=handDefinitions(points,config),g=new THREE.BufferGeometry(),positions=[],indices=[],weights=[];
 // Include the complete cylinder surface of each phalanx, not only bone centers.
 for(const d of defs)for(const t of [.15,.5,.85])for(const z of [-.008,.008]){
  const p=new THREE.Vector3(...d.a).lerp(new THREE.Vector3(...d.b),t);p.z+=z;positions.push(...p.toArray());indices.push(d.side==='L'?7:10,0,0,0);weights.push(1,0,0,0);
 }
 for(const p of [[0,1.4,0],[.4,1.4,0]]){positions.push(...p);indices.push(2,5,0,0);weights.push(.25,.75,0,0);}
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const data=handWeights(g,points,config);g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));
 const skeleton=withHands(buildSkeleton(points),points,config),mesh=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial()),group=new THREE.Group();group.add(mesh,skeleton.bones[0]);mesh.bind(skeleton);return {points,skeleton,mesh,group};
}
test('hand skin stays normalized, preserves rest vertices and leaves torso/arm weights untouched',()=>{
 const {skeleton,mesh}=fixture(),g=mesh.geometry;mesh.updateMatrixWorld(true);skeleton.update();
 for(let i=0;i<g.attributes.position.count;i++){let sum=0;for(let j=0;j<4;j++)sum+=g.attributes.skinWeight.getComponent(i,j);assert.ok(Math.abs(sum-1)<1e-6);const rest=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i);assert.ok(mesh.getVertexPosition(i,new THREE.Vector3()).distanceTo(rest)<1e-6);}
 assert.deepEqual(Array.from(g.attributes.skinIndex.array.slice(-8)),[2,5,0,0,2,5,0,0]);assert.deepEqual(Array.from(g.attributes.skinWeight.array.slice(-8)),[.25,.75,0,0,.25,.75,0,0]);
});
test('left/right grip is independent, curls fingertips toward palm and preserves body pose',()=>{
 const {skeleton,mesh,points}=fixture(),before=capturePose(skeleton);setGrip(skeleton,'L',1);const after=capturePose(skeleton);assert.deepEqual(after.slice(0,19),before.slice(0,19));assert.deepEqual(after.slice(34),before.slice(34));
 mesh.updateMatrixWorld(true);skeleton.update();let changed=0;
 for(let i=0;i<90;i++){const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i),moved=mesh.getVertexPosition(i,new THREE.Vector3());assert.ok(moved.toArray().every(Number.isFinite));if(moved.distanceTo(p)>.02)changed++;}assert.ok(changed>40);
 for(const d of skeleton.handDefinitions.filter(d=>d.side==='L'&&d.joint===2&&d.finger>0)){const p=skeleton.bones[d.index].localToWorld(new THREE.Vector3(...d.b).sub(new THREE.Vector3(...d.a)));assert.ok(p.distanceTo(points[7])<new THREE.Vector3(...d.b).distanceTo(points[7]));}
 const thumb=skeleton.handDefinitions.find(d=>d.side==='L'&&d.finger===0&&d.joint===2),tip=skeleton.bones[thumb.index].localToWorld(new THREE.Vector3(...thumb.b).sub(new THREE.Vector3(...thumb.a))),index=skeleton.bones[23].getWorldPosition(new THREE.Vector3());assert.ok(tip.distanceTo(index)<.025,'thumb must oppose the curled index finger');
 setGrip(skeleton,'L',0);assert.deepEqual(capturePose(skeleton),before);
});
test('legacy poses extend without changing body keys; malformed calibration is rejected',()=>{
 const {skeleton}=fixture(),legacy=capturePose(buildSkeleton(defaultMarkers())),rest=capturePose(skeleton),extended=extendHandPose(legacy,rest);assert.equal(extended.length,49);assert.deepEqual(extended.slice(0,19),legacy);assert.ok(validHandConfig(config));assert.equal(validHandConfig({...config,L:{...config.L,length:NaN}}),false);setGrip(skeleton,'L',1);applyPose(skeleton,legacy);assert.deepEqual(capturePose(skeleton),rest);
});
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result=`data:${blob.type};base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.();});}};
test('fist keys survive real GLB export/import and animate the finger geometry',async()=>{
 const {skeleton,mesh,group}=fixture(),rest=capturePose(skeleton);setGrip(skeleton,'L',1);setGrip(skeleton,'R',.5);const fist=capturePose(skeleton);applyPose(skeleton,rest);
 const clip=makeClip([{time:0,pose:rest},{time:1,pose:fist}],1,skeleton.bones.map(b=>[b.name]));assert.equal(clip.tracks.length,98);
 const bytes=await new GLTFExporter().parseAsync(group,{binary:true,animations:[clip]}),gltf=await new GLTFLoader().parseAsync(bytes,'');let loaded;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)loaded=o;});assert.equal(loaded.skeleton.bones.length,49);
 const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();mixer.setTime(.75);gltf.scene.updateMatrixWorld(true);loaded.skeleton.update();let moved=0;
 for(let i=0;i<180;i++){const p=loaded.getVertexPosition(i,new THREE.Vector3()),before=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);assert.ok(p.toArray().every(Number.isFinite));if(p.distanceTo(before)>.01)moved++;}assert.ok(moved>60);
});

test('distal finger vertices shared with the forearm actually bend when closing',()=>{
 const points=defaultMarkers(),d=handDefinitions(points,config).find(d=>d.side==='L'&&d.finger===0&&d.joint===2),p=new THREE.Vector3(...d.a).lerp(new THREE.Vector3(...d.b),.5),g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p.toArray(),3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([6,7,0,0],4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([.5,.5,0,0],4));const w=handWeights(g,points,config);let fingers=0;for(let i=0;i<4;i++)if(w.indices[i]>=19)fingers+=w.weights[i];assert.ok(fingers>.95);assert.ok(w.weights.every(Number.isFinite));
 const invalid=structuredClone(config);invalid.L.thumbLength=0;assert.equal(validHandConfig(invalid),false);
});
