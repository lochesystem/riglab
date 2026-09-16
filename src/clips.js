// Clips own their keyframes. The editor uses a detached working copy so edits,
// undo and switching never mutate another animation through shared arrays.
export function uniqueClipName(clips,name,exceptId){
 const base=String(name||'Animação').trim().slice(0,80)||'Animação';
 const used=new Set(clips.filter(c=>c.id!==exceptId).map(c=>c.name));
 let result=base,n=2;while(used.has(result))result=`${base.slice(0,70)} ${n++}`;return result;
}
export function newClip(clips,name,data={}){
 if(clips.length>=64)throw new Error('Limite de 64 animações por projeto.');
 const clip={id:crypto.randomUUID(),name:uniqueClipName(clips,name),keys:[],duration:3,time:0,loop:true,...structuredClone(data)};
 clips.push(clip);return clip;
}
export function validateClips(s,pose,global){
 if(!Array.isArray(s.clips)||!s.clips.length||s.clips.length>64)throw new Error('Biblioteca de animações inválida.');
 const ids=new Set(),names=new Set();let total=0;
 for(const c of s.clips){
  if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||names.has(c.name)||!Number.isFinite(c.duration)||c.duration<.4||c.duration>30||!Number.isFinite(c.time)||c.time<0||c.time>c.duration||typeof c.loop!=='boolean'||!global(c.global)||(c.pose!=null&&!pose(c.pose))||!Array.isArray(c.keys)||c.keys.length>1000||!c.keys.every(k=>Number.isFinite(k.time)&&k.time>=0&&k.time<=c.duration&&pose(k.pose)&&global(k.global)))throw new Error('Clipe de animação inválido.');
  ids.add(c.id);names.add(c.name);total+=c.keys.length;
 }
 if(total>64000||!ids.has(s.activeClipId))throw new Error('Clipe ativo inválido.');
}
