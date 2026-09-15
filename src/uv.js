import * as THREE from 'three';
export const TEXTURE_SLOTS={map:'Cor',normalMap:'Normal',roughnessMap:'Rugosidade',metalnessMap:'Metallic',aoMap:'Oclusão',emissiveMap:'Emissão',alphaMap:'Transparência'};
export function textureEntries(asset){
 const entries=[];
 asset.children.forEach((mesh,meshIndex)=>{const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach((material,materialIndex)=>{for(const [slot,label] of Object.entries(TEXTURE_SLOTS))if(material[slot]?.image)entries.push({mesh,meshIndex,material,materialIndex,slot,texture:material[slot],label:`${mesh.name||'Malha '+(meshIndex+1)} · ${material.name||'Material '+(materialIndex+1)} · ${label}`});});});return entries;
}
export function uvLayout(entry){
 const {mesh,materialIndex,texture}=entry,g=mesh.geometry,uv=g.getAttribute(texture.channel?`uv${texture.channel}`:'uv');
 if(!uv)return {triangles:[],edges:[],overlaps:0,outside:false};
 if(texture.matrixAutoUpdate)texture.updateMatrix();const index=g.index,count=index?index.count:uv.count,triangles=[],seen=new Set(),faces=new Set(),edgeUses=new Map();let overlaps=0,outside=false;
 for(let i=0;i+2<count;i+=3){
  if(Array.isArray(mesh.material)&&!g.groups.some(group=>group.materialIndex===materialIndex&&i>=group.start&&i+2<group.start+group.count))continue;
  const triangle=[],vertices=[];for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j,p=new THREE.Vector2(uv.getX(k),uv.getY(k)).applyMatrix3(texture.matrix);if(texture.flipY)p.y=1-p.y;if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('O mapa UV contém coordenadas inválidas.');if(p.x<0||p.x>1||p.y<0||p.y>1)outside=true;triangle.push(p.toArray());const position=g.getAttribute('position');vertices.push([position.getX(k),position.getY(k),position.getZ(k),uv.getX(k),uv.getY(k)].map(v=>v.toFixed(6)).join(','));}
  const signature=triangle.map(p=>p.map(v=>v.toFixed(6)).join(',')).sort().join(';');if(seen.has(signature))overlaps++;else seen.add(signature);triangles.push(triangle);
  // Weld split normals by position + UV, while keeping actual UV seams apart.
  const face=vertices.slice().sort().join(';');if(faces.has(face))continue;faces.add(face);
  for(let j=0;j<3;j++){const next=(j+1)%3,key=[vertices[j],vertices[next]].sort().join(';'),edge=edgeUses.get(key);if(edge)edge.count++;else edgeUses.set(key,{count:1,points:[triangle[j],triangle[next]]});}
 }
 const drawn=new Set(),edges=[];
 for(const {count,points} of edgeUses.values()){if(count===2)continue;const key=points.map(p=>p.map(v=>v.toFixed(6)).join(',')).sort().join(';');if(!drawn.has(key)){drawn.add(key);edges.push(points);}}
 return {triangles,edges,overlaps,outside};
}
export function uvSVG(layout,width,height){
 const paths=layout.edges.map(t=>'M'+t.map(([u,v])=>`${(u*width).toFixed(3)},${(v*height).toFixed(3)}`).join('L')).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="tile"><rect width="${width}" height="${height}"/></clipPath></defs><path clip-path="url(#tile)" d="${paths}" fill="none" stroke="#ff4c90" stroke-width="1"/></svg>`;
}
