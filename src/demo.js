import {handDefinitions,handFrame} from './hands.js';
import {defaultMarkers} from './rig.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// An original, unrigged procedural mannequin; it uses the same binding path as an imported model.
export function createDemo() {
  const parts=[];
  const colors={skin:'#b4bca3',cloth:'#3f6159',dark:'#273936',gold:'#c0ad7a',hair:'#d5d7c5',eye:'#263d34'};
  function part(g,p,s,color,quat) {
    if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');
    const m=new THREE.Matrix4().compose(new THREE.Vector3(...p),quat||new THREE.Quaternion(),new THREE.Vector3(...s));g.applyMatrix4(m);
    const c=new THREE.Color(color),arr=new Float32Array(g.attributes.position.count*3);for(let i=0;i<arr.length;i+=3)c.toArray(arr,i);
    g.setAttribute('color',new THREE.BufferAttribute(arr,3));parts.push(g);
  }
  const ico=(p,s,c,detail=0)=>part(new THREE.IcosahedronGeometry(1,detail),p,s,c);
  function limb(a,b,r1,r2,c){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av);part(new THREE.CylinderGeometry(r2,r1,dir.length(),6,3),av.add(bv).multiplyScalar(.5).toArray(),[1,1,1],c,new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));}
  ico([0,1.36,0],[.255,.3,.145],colors.cloth,1);
  ico([0,1.05,0],[.20,.15,.14],colors.dark,1);
  part(new THREE.CylinderGeometry(.19,.19,.065,8),[0,1.12,0],[1,1,.78],colors.gold);
  limb([0,1.57,0],[0,1.72,0],.075,.07,colors.skin);
  ico([0,1.8,.012],[.14,.18,.13],colors.skin,1);
  ico([0,1.93,-.022],[.15,.085,.137],colors.hair,1);
  ico([0,1.80,.139],[.035,.05,.033],colors.skin);
  for(const side of [-1,1]) {
    const s=v=>[v[0]*side,v[1],v[2]];
    ico(s([.139,1.83,0]),[.085,.04,.035],colors.skin);
    ico(s([.055,1.837,.122]),[.024,.012,.007],colors.eye);
    limb(s([.27,1.54,0]),s([.52,1.28,0]),.105,.072,colors.cloth);
    ico(s([.30,1.535,0]),[.14,.115,.16],colors.gold);
    limb(s([.52,1.28,0]),s([.72,1.02,0]),.077,.05,colors.skin);
    limb(s([.61,1.17,0]),s([.71,1.035,0]),.081,.065,colors.dark);
    const handSide=side>0?'L':'R',points=defaultMarkers(),f=handFrame(points,handSide),configuration={L:{length:.19,width:.085,palm:.38,roll:0},R:{length:.19,width:.085,palm:.38,roll:0}};
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.across,f.forward,f.normal));
    part(new THREE.IcosahedronGeometry(1,1),f.origin.clone().addScaledVector(f.forward,.035).toArray(),[.049,.05,.026],colors.skin,q);
    for(const d of handDefinitions(points,configuration).filter(d=>d.side===handSide)){const radius=d.finger===0?.013:.010;limb(d.a,d.b,radius,radius*.85,colors.skin);}

    limb(s([.165,.99,0]),s([.18,.56,.024]),.117,.082,colors.dark);
    ico(s([.18,.56,.054]),[.088,.098,.075],colors.gold);
    limb(s([.18,.54,.018]),s([.19,.13,0]),.09,.063,colors.cloth);
    limb(s([.187,.33,0]),s([.19,.12,0]),.088,.075,colors.dark);
    ico(s([.19,.078,.071]),[.10,.079,.168],colors.dark,1);
  }
  const g=mergeGeometries(parts);g.computeBoundingBox();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,flatShading:true}));
  mesh.name='Sentinela';const group=new THREE.Group();group.add(mesh);
  // This procedural mesh has known finger landmarks. Preserve that calibration
  // through the initial uniform normalization instead of estimating it again.
  const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),scale=2/(box.max.y-box.min.y),points=defaultMarkers(),config={};
  for(const side of ['L','R']){const f=handFrame(points,side),delta=f.origin.clone().sub(new THREE.Vector3(center.x,box.min.y,center.z)).multiplyScalar(scale).sub(f.origin);config[side]={length:.19*scale,width:.085*scale,palm:.38,roll:0,thumbStart:.28,thumbLength:.6,thumbSide:side==='L'?-1:1,start:delta.dot(f.forward),shift:delta.dot(f.across),depth:delta.dot(f.normal)};}
  group.userData.handConfig=config;return group;
}
