import test from 'node:test';
import assert from 'node:assert/strict';
import {newClip,uniqueClipName,validateClips} from '../src/clips.js';
test('clips duplicate independently and keep unique names',()=>{
 const clips=[],a=newClip(clips,'Walk',{keys:[{time:0,pose:[{p:[0,0,0],q:[0,0,0,1]}]}]});
 const {id,name,...data}=a,b=newClip(clips,name,data);b.keys[0].pose[0].p[0]=4;
 assert.equal(a.keys[0].pose[0].p[0],0);assert.notEqual(a.id,b.id);assert.equal(b.name,'Walk 2');assert.equal(uniqueClipName(clips,'Walk',a.id),'Walk');
});
test('library validates inactive clips, identities and duration before loading',()=>{
 const clips=[],c=newClip(clips,'Walk'),s={clips,activeClipId:c.id};const pose=p=>Array.isArray(p),global=()=>true;
 validateClips(s,pose,global);const bad=structuredClone(s);bad.clips.push({...structuredClone(c),id:'other',name:'Run',keys:[{time:4,pose:[]}]});assert.throws(()=>validateClips(bad,pose,global));
 assert.throws(()=>validateClips({...s,activeClipId:'missing'},pose,global));
 assert.throws(()=>validateClips({...s,clips:[c,c]},pose,global));
});
