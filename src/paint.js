// Keep locked weights exact, preserve the selected weight, then normalize peers.
export function paintInfluences(indices,weights,joint,amount,fallback=0,locked=new Set()){
 const merged=new Map();for(let i=0;i<indices.length;i++)merged.set(indices[i],(merged.get(indices[i])||0)+weights[i]);
 const unchanged=()=>({indices:[...indices],weights:[...weights]});if(locked.has(joint))return unchanged();
 const fixed=[...merged].filter(([i,w])=>locked.has(i)&&w>0),fixedSum=fixed.reduce((n,[,w])=>n+w,0),budget=Math.max(0,1-fixedSum),current=merged.get(joint)||0;
 let target=Math.max(0,Math.min(budget,current+amount));
 if(fixed.length>=4)return unchanged();
 let rest=[...merged].filter(([i,w])=>i!==joint&&!locked.has(i)&&w>0).sort((a,b)=>b[1]-a[1]).slice(0,4-fixed.length-(target>0?1:0));
 if(!rest.length&&target<budget){
  const candidate=[fallback,...Array.from({length:19},(_,i)=>i)].find(i=>i!==joint&&!locked.has(i));
  if(candidate===undefined||fixed.length+(target>0?1:0)>=4)return unchanged();rest=[[candidate,1]];
 }
 const sum=rest.reduce((n,[,w])=>n+w,0),result=[...fixed,...(target>0?[[joint,target]]:[]),...rest.map(([i,w])=>[i,w/sum*(budget-target)])];
 while(result.length<4)result.push([0,0]);return {indices:result.map(v=>v[0]),weights:result.map(v=>v[1])};
}
export function paintTopology(positions,index){
 const count=positions.length/3,neighbors=Array.from({length:count},()=>new Set()),groups=new Map(),key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*100000)).join(',');
 for(let i=0;i<count;i++){const k=key(...positions.slice(i*3,i*3+3));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 const faces=index||Array.from({length:count},(_,i)=>i);
 for(let i=0;i+2<faces.length;i+=3){const tri=[faces[i],faces[i+1],faces[i+2]];for(const a of tri)for(const b of tri)if(a!==b)neighbors[a].add(b);}
 for(const group of groups.values()){const joined=new Set(group.flatMap(i=>[...neighbors[i]]));for(const i of group)neighbors[i]=new Set([...joined].filter(j=>j!==i));}
 // Only exact bilateral matches are mirrored: never guess across asymmetric garments.
 const mirror=Array.from({length:count},(_,i)=>groups.get(key(-positions[i*3],positions[i*3+1],positions[i*3+2]))||[]);
 return {neighbors,mirror};
}
