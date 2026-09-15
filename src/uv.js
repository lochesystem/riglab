import * as THREE from 'three';
export const TEXTURE_SLOTS={map:'Cor',normalMap:'Normal',roughnessMap:'Rugosidade',metalnessMap:'Metallic',aoMap:'Oclusão',emissiveMap:'Emissão',alphaMap:'Transparência'};
export function textureEntries(asset){
 const entries=[];
 asset.children.forEach((mesh,meshIndex)=>{const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach((material,materialIndex)=>{for(const [slot,label] of Object.entries(TEXTURE_SLOTS))if(material[slot]?.image)entries.push({mesh,meshIndex,material,materialIndex,slot,texture:material[slot],label:`${mesh.name||'Malha '+(meshIndex+1)} · ${material.name||'Material '+(materialIndex+1)} · ${label}`});});});return entries;
}
export function uvLayout(entry){
 const {mesh,materialIndex,texture}=entry,g=mesh.geometry,uv=g.getAttribute(texture.channel?`uv${texture.channel}`:'uv');
 if(!uv)return {triangles:[],overlaps:0,outside:false};
 if(texture.matrixAutoUpdate)texture.updateMatrix();const index=g.index,count=index?index.count:uv.count,triangles=[],seen=new Set();let overlaps=0,outside=false;
 for(let i=0;i+2<count;i+=3){
  if(Array.isArray(mesh.material)&&!g.groups.some(group=>group.materialIndex===materialIndex&&i>=group.start&&i+2<group.start+group.count))continue;
  const triangle=[];for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j,p=new THREE.Vector2(uv.getX(k),uv.getY(k)).applyMatrix3(texture.matrix);if(texture.flipY)p.y=1-p.y;if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('O mapa UV contém coordenadas inválidas.');if(p.x<0||p.x>1||p.y<0||p.y>1)outside=true;triangle.push(p.toArray());}
  const signature=triangle.map(p=>p.map(v=>v.toFixed(6)).join(',')).sort().join(';');if(seen.has(signature))overlaps++;else seen.add(signature);triangles.push(triangle);
 }
 return {triangles,overlaps,outside};
}
export function uvSVG(layout,width,height){
 const paths=layout.triangles.map(t=>'M'+t.map(([u,v])=>`${(u*width).toFixed(3)},${(v*height).toFixed(3)}`).join('L')+'Z').join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="tile"><rect width="${width}" height="${height}"/></clipPath></defs><path clip-path="url(#tile)" d="${paths}" fill="none" stroke="#ff4c90" stroke-width="1"/></svg>`;
}
