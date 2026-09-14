// Four normalized influences, preserving the chosen weight and proportional peers.
export function paintInfluences(indices,weights,joint,amount,fallback=0){
 const peers=new Map();let current=0;
 for(let i=0;i<indices.length;i++){if(indices[i]===joint)current+=weights[i];else peers.set(indices[i],(peers.get(indices[i])||0)+weights[i]);}
 const target=Math.max(0,Math.min(1,current+amount));
 let rest=[...peers].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,target>0?3:4);
 if(!rest.length&&target<1)rest=[[fallback===joint?(joint===0?1:0):fallback,1]];
 const sum=rest.reduce((n,[,w])=>n+w,0),result=target>0?[[joint,target]]:[];
 result.push(...rest.map(([i,w])=>[i,w/sum*(1-target)]));
 while(result.length<4)result.push([0,0]);
 return {indices:result.map(v=>v[0]),weights:result.map(v=>v[1])};
}
