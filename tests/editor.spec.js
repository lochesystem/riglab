import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';


test('demo rig, pose, IK, keyframes, save/reopen and real GLB skin/animation export',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.riglabDiagnostics?.().vertices>0);
 await expect(page.locator('canvas')).toBeVisible();await page.screenshot({path:testInfo.outputPath('01-rig-editor.png')});
 await page.getByRole('button',{name:'Gerar auto-rig'}).click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await expect(page.locator('#view-state')).toHaveText('EDIÇÃO DE ANIMAÇÃO');
 const before=await page.evaluate(()=>window.riglabDiagnostics().pose);
 await page.locator('#joint-select').selectOption('5');await page.locator('#axis-z').fill('35');await page.locator('#axis-z').press('Tab');
 const rotated=await page.evaluate(()=>window.riglabDiagnostics().pose);expect(rotated[5].q).not.toEqual(before[5].q);
 await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics().pose))[5].q).toEqual(before[5].q);
 await page.locator('#redo').click();expect((await page.evaluate(()=>window.riglabDiagnostics().pose))[5].q).toEqual(rotated[5].q);
 await page.locator('#neutral').click();await page.locator('#ik-mode').click();await page.locator('#joint-select').selectOption('7');await page.locator('#axis-z').fill('0.2');await page.locator('#axis-z').press('Tab');
 expect((await page.evaluate(()=>window.riglabDiagnostics().joint))[2]).toBeGreaterThan(.15);
 await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.locator('#wave').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(5);
 await page.locator('#play').click();await expect.poll(async()=> (await page.evaluate(()=>window.riglabDiagnostics())).time,{timeout:10000}).toBeGreaterThan(.1);await page.locator('#play').click();
 await page.screenshot({path:testInfo.outputPath('02-animation-editor.png')});
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const glbPath=testInfo.outputPath('character.glb');await download.saveAs(glbPath);
 const buffer=await fs.readFile(glbPath);expect(buffer.readUInt32LE(0)).toBe(0x46546c67);const len=buffer.readUInt32LE(12);const json=JSON.parse(buffer.subarray(20,20+len).toString());expect(json.skins.length).toBeGreaterThan(0);expect(json.skins[0].joints.length).toBe(19);expect(json.animations[0].channels.length).toBe(40);expect(json.meshes[0].primitives[0].attributes.WEIGHTS_0).toBeDefined();
 const savePromise=page.waitForEvent('download');await page.locator('#save-project').click();const save=await savePromise;const projectPath=testInfo.outputPath('saved.riglab');await save.saveAs(projectPath);
 await page.locator('#demo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).rigged).toBe(false);
 await page.locator('#project-file').setInputFiles(projectPath);await page.waitForFunction(()=>window.riglabDiagnostics().rigged&&window.riglabDiagnostics().keyframes===5);expect((await page.evaluate(()=>window.riglabDiagnostics())).bones).toBe(19);
 // Verify exported file is loadable by the actual glTF loader, with a playable clip.
 const summary=await page.evaluate(async(bytes)=>{const THREE=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer,'');const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();mixer.update(.5);gltf.scene.updateMatrixWorld(true);let skins=0;gltf.scene.traverse(o=>{if(o.isSkinnedMesh){skins++;o.skeleton.update();}});return {skins,clips:gltf.animations.length};},Array.from(buffer));expect(summary.skins).toBeGreaterThan(0);expect(summary.clips).toBe(1);
 // Edited markers cannot silently reuse obsolete weights; undo unlocks the clip.
 await page.locator('#edit-rig').click();await page.locator('#joint-select').selectOption('5');await page.locator('#axis-x').fill('0.4');await page.locator('#axis-x').press('Tab');await expect(page.locator('[data-stage=animate]')).toBeDisabled();
 await page.locator('#undo').click();await expect(page.locator('[data-stage=animate]')).toBeEnabled();await page.locator('[data-stage=animate]').click();
 // Timeline mutations persist and undo restores the previous key count.
 await page.locator('#rewind').click();await page.locator('#delete-key').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(4);await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(5);
 await page.locator('#copy-key').click();const ruler=await page.locator('#ruler').boundingBox();await page.mouse.click(ruler.x+ruler.width*.14,ruler.y+12);await page.locator('#paste-key').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(6);
 const key=page.locator('.key').nth(1),bounds=await key.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(ruler.x+ruler.width*.19,bounds.y+bounds.height/2,{steps:5});await page.mouse.up();expect((await page.evaluate(()=>window.riglabDiagnostics())).time).toBeGreaterThan(.5);
 expect(errors).toEqual([]);
});

test('GLB import, reference viewer and malformed input feedback',async({page},testInfo)=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.riglabDiagnostics?.());
 await page.locator('[data-reference="1"]').click();await expect(page.locator('dialog')).toBeVisible();await page.locator('#close-reference').click();
 // A self-contained unrigged GLB produced from the same three.js exporter.
 const data=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js');const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.BoxGeometry(.4,2,.25),new THREE.MeshStandardMaterial({color:0x669988})));const buffer=await new GLTFExporter().parseAsync(scene,{binary:true});return Array.from(new Uint8Array(buffer));});
 const glbPath=testInfo.outputPath('input.glb');await fs.writeFile(glbPath,Buffer.from(data));await page.locator('#model-file').setInputFiles(glbPath);await page.waitForFunction(()=>window.riglabDiagnostics().name==='input');await expect(page.locator('#import-panel')).toBeVisible();await page.locator('#start-rig').click();await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.locator('#project-file').setInputFiles({name:'broken.riglab',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});await expect(page.locator('#toast')).toContainText('Formato de projeto inválido');expect((await page.evaluate(()=>window.riglabDiagnostics())).rigged).toBe(true);
});

test('walking generator creates editable looping keys, supports undo and project reload',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.locator('#wave').click();await page.getByRole('tab',{name:'Animações',exact:true}).click();await page.locator('#animation-kind').selectOption('walk');await page.locator('#walk-speed').selectOption('1.5');await page.locator('#walk-stride').selectOption('0.4');await page.locator('#walk').click();
 expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(25);await expect(page.locator('#duration')).toHaveValue('0.8');
 await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(5);await page.locator('#redo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(25);
 await page.locator('#play').click();await page.waitForTimeout(1000);await page.locator('#play').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).time).toBeLessThan(.8);
 await page.locator('#skeleton-toggle').click();await page.screenshot({path:testInfo.outputPath('walking.png')});
 const savePromise=page.waitForEvent('download');await page.locator('#save-project').click();const save=await savePromise;const saved=testInfo.outputPath('walking.riglab');await save.saveAs(saved);await page.locator('#demo').click();await page.locator('#project-file').setInputFiles(saved);await page.waitForFunction(()=>window.riglabDiagnostics().keyframes===25);await expect(page.locator('#duration')).toHaveValue('0.8');expect(errors).toEqual([]);
});

test('move mode preserves selection and knee movement propagates through the body',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.locator('#joint-select').selectOption('12');await page.locator('#ik-mode').click();await expect(page.locator('#joint-select')).toHaveValue('12');await expect(page.locator('#axis-z')).toBeEnabled();
 const before=await page.evaluate(()=>window.riglabDiagnostics().pose);
 await page.locator('#axis-z').fill('0.22');await page.locator('#axis-z').press('Tab');
 const after=await page.evaluate(()=>window.riglabDiagnostics().pose);
 expect(after[0].p).not.toEqual(before[0].p);expect(after[11].q).not.toEqual(before[11].q);expect(after[12].q).not.toEqual(before[12].q);
 for(let i=1;i<after.length;i++)expect(after[i].p).toEqual(before[i].p);
 await page.locator('#undo').click();expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(before);
 await page.locator('#redo').click();expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(after);
});

test('idle and running generate, preview, export and restore editable motion',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByRole('tab',{name:'Animações',exact:true}).click();await page.locator('#animation-kind').selectOption('idle');await page.locator('#idle').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(481);await expect(page.locator('#duration')).toHaveValue('16');
 await page.locator('#skeleton-toggle').click();await page.locator('#viewport').screenshot({path:testInfo.outputPath('idle.png')});
 const idleRuler=await page.locator('#ruler').boundingBox();
 for(const [seconds,label] of [[2.6,'look-left'],[7.7,'hand-on-hip'],[12.5,'look-up'],[15.8,'return']]){
 await page.mouse.click(idleRuler.x+idleRuler.width*(.008+.98*seconds/16),idleRuler.y+12);await page.locator('#viewport').screenshot({path:testInfo.outputPath(`idle-${label}.png`)});
 }

 await page.getByRole('tab',{name:'Animações',exact:true}).click();await page.locator('#animation-kind').selectOption('run');await page.locator('#run').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(25);await expect(page.locator('#duration')).toHaveValue('0.8');
 await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(481);await page.locator('#redo').click();
 const ruler=await page.locator('#ruler').boundingBox();
 for(const [phase,label] of [[0,'contact'],[.18,'down'],[.43,'flight'],[.65,'passing']]){
 await page.mouse.click(ruler.x+ruler.width*(.008+.98*phase),ruler.y+12);await page.locator('#viewport').screenshot({path:testInfo.outputPath(`run-${label}.png`)});
 }
 // Orbit to inspect knee bend, foot arcs and lean in profile as well.
 const view=await page.locator('#viewport').boundingBox();await page.mouse.move(view.x+view.width*.65,view.y+view.height*.65);await page.mouse.down();await page.mouse.move(view.x+view.width*.65+160,view.y+view.height*.65,{steps:12});await page.mouse.up();await page.waitForTimeout(300);await page.locator('#viewport').screenshot({path:testInfo.outputPath('run-profile.png')});
 await page.locator('#play').click();await page.waitForTimeout(1100);await page.locator('#play').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).time).toBeLessThan(.8);
 const expPromise=page.waitForEvent('download');await page.locator('#export').click();const exp=await expPromise;const expPath=testInfo.outputPath('running.glb');await exp.saveAs(expPath);const buffer=await fs.readFile(expPath);const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());expect(json.animations[0].channels.length).toBe(40);
 const savePromise=page.waitForEvent('download');await page.locator('#save-project').click();const save=await savePromise;const saved=testInfo.outputPath('running.riglab');await save.saveAs(saved);await page.locator('#demo').click();await page.locator('#project-file').setInputFiles(saved);await page.waitForFunction(()=>window.riglabDiagnostics().keyframes===25);expect(errors).toEqual([]);
});

test('MVP recovery restores clip after reload and malformed weights keep the current project',async({page},testInfo)=>{
 await page.goto('/');await page.locator('#auto-rig').click();await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.locator('#wave').click();
 await expect(page.locator('#status')).toHaveText('● Salvo neste navegador',{timeout:20000});
 await page.reload();await expect(page.locator('#recovery-banner')).toBeVisible();await page.locator('#restore-recovery').click();
 await expect(page.locator('#key-count')).toHaveText('5 poses');await expect(page.locator('#recovery-banner')).toBeHidden();
 const savePromise=page.waitForEvent('download');await page.locator('#save-project').click();const saved=await savePromise;const path=testInfo.outputPath('recovered.riglab');await saved.saveAs(path);const project=JSON.parse(await fs.readFile(path,'utf8'));
 const before=await page.evaluate(()=>window.riglabDiagnostics().pose);project.weights[0].weights[0]=-1;
 await page.locator('#project-file').setInputFiles({name:'invalid-weights.riglab',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await expect(page.locator('#toast')).toContainText('Pesos inválidos');expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(before);await expect(page.locator('#key-count')).toHaveText('5 poses');
});

test('MVP playhead drag scrubs without moving keyframes',async({page})=>{
 await page.goto('/');await page.locator('#auto-rig').click();await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.locator('#wave').click();
 const keys=await page.locator('.key').evaluateAll(nodes=>nodes.map(n=>n.style.left)),handle=await page.locator('#playhead-handle').boundingBox(),ruler=await page.locator('#ruler').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(ruler.x+ruler.width*.7,handle.y+handle.height/2,{steps:12});
 expect(Number(await page.locator('#playhead-handle').getAttribute('aria-valuenow'))).toBeGreaterThan(2);await page.mouse.up();
 expect(await page.locator('.key').evaluateAll(nodes=>nodes.map(n=>n.style.left))).toEqual(keys);
});

test('global placement is separate from anatomy and survives keys, undo and project reload',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.locator('#ik-mode').click();
 const before=await page.evaluate(()=>window.riglabDiagnostics().pose);
 for(const index of ['11','1']){
  await page.locator('#joint-select').selectOption(index);await page.locator('#axis-z').fill('0.2');await page.locator('#axis-z').press('Tab');
  const after=await page.evaluate(()=>window.riglabDiagnostics().pose);expect(after[0]).toEqual(before[0]);expect(after[Number(index)].q).not.toEqual(before[Number(index)].q);await page.locator('#undo').click();
 }
 await page.locator('#global-control').click();await page.locator('#add-key').click();await page.locator('#playhead-handle').press('End');
 await page.locator('#axis-x').fill('0.6');await page.locator('#axis-x').press('Tab');
 let d=await page.evaluate(()=>window.riglabDiagnostics());expect(d.pose).toEqual(before);expect(d.global.p[0]).toBeCloseTo(.6);
 await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).global.p[0]).toBe(0);await page.locator('#redo').click();await page.locator('#add-key').click();
 await page.locator('#playhead-handle').press('Home');expect((await page.evaluate(()=>window.riglabDiagnostics())).global.p[0]).toBe(0);
 await page.locator('#playhead-handle').press('End');expect((await page.evaluate(()=>window.riglabDiagnostics())).global.p[0]).toBeCloseTo(.6);
 const saving=page.waitForEvent('download');await page.locator('#save-project').click();const file=testInfo.outputPath('global.riglab');await(await saving).saveAs(file);await page.locator('#demo').click();await page.locator('#project-file').setInputFiles(file);await page.waitForFunction(()=>window.riglabDiagnostics().rigged);d=await page.evaluate(()=>window.riglabDiagnostics());expect(d.global.p[0]).toBeCloseTo(.6);expect(d.pose).toEqual(before);
 const exporting=page.waitForEvent('download');await page.locator('#export').click();const glb=testInfo.outputPath('global.glb');await(await exporting).saveAs(glb);const bytes=await fs.readFile(glb);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const root=json.nodes.findIndex(n=>n.name==='RigLab_Character');expect(root).toBeGreaterThanOrEqual(0);expect(json.skins[0].joints).toHaveLength(19);expect(json.animations[0].channels.some(c=>c.target.node===root&&c.target.path==='translation')).toBe(true);expect(errors).toEqual([]);
});

test('JPEG imports remain pixel-identical through repeated project saves and GLB export',async({page},testInfo)=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.riglabDiagnostics?.());
 const source=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){ctx.fillStyle=`rgb(${x*4},${y*4},${(x*y*17)%256})`;ctx.fillRect(x,y,1,1);}
  const tex=new THREE.CanvasTexture(canvas);tex.userData.mimeType='image/jpeg';const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,2,.25),new THREE.MeshStandardMaterial({map:tex}));
  return Array.from(new Uint8Array(await new GLTFExporter().parseAsync(mesh,{binary:true})));
 });
 const pixels=bytes=>page.evaluate(async data=>{
  const raw=new Uint8Array(data),view=new DataView(raw.buffer),n=view.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(raw.slice(20,20+n))),im=doc.images[0],bv=doc.bufferViews[im.bufferView],start=28+n+(bv.byteOffset||0);
  const bitmap=await createImageBitmap(new Blob([raw.slice(start,start+bv.byteLength)],{type:im.mimeType}));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return {mime:im.mimeType,data:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data)};
 },Array.from(bytes));
 const original=await pixels(source);expect(original.mime).toBe('image/jpeg');
 await page.locator('#model-file').setInputFiles({name:'texture.glb',mimeType:'model/gltf-binary',buffer:Buffer.from(source)});await page.waitForFunction(()=>window.riglabDiagnostics().name==='texture');
 await page.locator('#start-rig').click();await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 for(let cycle=0;cycle<3;cycle++){
  const pending=page.waitForEvent('download');await page.locator('#save-project').click();const file=testInfo.outputPath(`round-${cycle}.riglab`);await(await pending).saveAs(file);const project=JSON.parse(await fs.readFile(file,'utf8'));
  const saved=await pixels(Buffer.from(project.asset,'base64'));expect(saved.mime).toBe('image/png');expect(saved.data).toEqual(original.data);
  await page.locator('#project-file').setInputFiles(file);await page.waitForFunction(()=>!document.querySelector('#busy').classList.contains('hidden')||window.riglabDiagnostics().rigged);await expect(page.locator('#busy')).toBeHidden();
 }
 const pending=page.waitForEvent('download');await page.locator('#export').click();const file=testInfo.outputPath('texture.glb');await(await pending).saveAs(file);expect((await pixels(await fs.readFile(file))).data).toEqual(original.data);
});

test('precise idle time and small pointer jitter do not retime keys',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);await page.getByRole('tab',{name:'Animações',exact:true}).click();await page.locator('#animation-kind').selectOption('idle');await page.locator('#idle').click();
 await page.locator('#current-time').fill('7');await page.locator('#current-time').press('Tab');expect((await page.evaluate(()=>window.riglabDiagnostics())).time).toBe(7);
 await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.locator('#wave').click();const before=await page.evaluate(()=>window.riglabDiagnostics().keyframes);const key=page.locator('.key').nth(1),label=await key.getAttribute('aria-label'),box=await key.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+2,box.y+box.height/2);await page.mouse.up();
 expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(before);expect(await page.locator('.key').nth(1).getAttribute('aria-label')).toBe(label);
});


test('inspector tabs keep transforms visible and stop painting when leaving weights',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await page.goto('/');await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByRole('tab',{name:'Animações',exact:true}).click();await expect(page.locator('#walk')).toBeVisible();await expect(page.locator('#paint-toggle')).toBeHidden();
 await page.locator('#animation-kind').selectOption('run');await expect(page.locator('#run')).toBeVisible();await expect(page.locator('#walk')).toBeHidden();
 await page.getByRole('tab',{name:'Pesos',exact:true}).click();await page.locator('#paint-toggle').click();await expect(page.locator('#paint-toggle')).toHaveAttribute('aria-pressed','true');
 await page.getByText('Espelhamento e proteção',{exact:true}).click();await expect(page.locator('#paint-visible')).toBeVisible();
 const bounds=await page.locator('#axis-z').boundingBox();expect(bounds.y+bounds.height).toBeLessThan(720);
 await page.getByRole('tab',{name:'Pose',exact:true}).click();await expect(page.locator('#paint-toggle')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#neutral')).toBeVisible();
 const size=await page.locator('.right-panel').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));expect(size.scroll).toBeLessThanOrEqual(size.height+1);
 await page.getByRole('tab',{name:'Pose',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Animações',exact:true})).toHaveAttribute('aria-selected','true');
});

test('optional fists preserve legacy keys, undo skin changes and survive recovery/project/GLB export',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#auto-rig').click();await expect(page.locator('#view-state')).toHaveText('EDIÇÃO DE ANIMAÇÃO');
 await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.locator('#wave').click();
 const legacyPose=await page.evaluate(()=>window.riglabDiagnostics().pose);
 const save=async name=>{const event=page.waitForEvent('download');await page.locator('#save-project').click();const file=await event,path=testInfo.outputPath(name);await file.saveAs(path);return {path,data:JSON.parse(await fs.readFile(path,'utf8'))};};
 const legacy=await save('legacy.riglab');expect(legacy.data.version).toBe(1);
 await page.getByText('Mãos · punhos',{exact:true}).click();await page.locator('#add-hands').click();await expect(page.locator('#asset-meta')).toContainText('49 juntas');
 expect((await page.evaluate(()=>window.riglabDiagnostics().pose)).slice(0,19)).toEqual(legacyPose);await expect(page.locator('#key-count')).toHaveText('5 poses');
 await page.locator('#undo').click();await expect(page.locator('#asset-meta')).toContainText('19 juntas');const undone=await save('undone.riglab');expect(undone.data.weights).toEqual(legacy.data.weights);
 await page.locator('#redo').click();await expect(page.locator('#asset-meta')).toContainText('49 juntas');
 const before=await page.evaluate(()=>window.riglabDiagnostics().pose);await page.locator('#grip-L').focus();await page.locator('#grip-L').press('End');await page.locator('#grip-L').press('Tab');await expect(page.locator('#grip-L-value')).toHaveText('100%');await expect(page.locator('#grip-R-value')).toHaveText('0%');
 const fist=await page.evaluate(()=>window.riglabDiagnostics().pose);expect(fist.slice(0,19)).toEqual(before.slice(0,19));expect(fist.slice(34)).toEqual(before.slice(34));expect(fist.slice(19,34)).not.toEqual(before.slice(19,34));await page.locator('#add-key').click();
 const saved=await save('hands.riglab');expect(saved.data.version).toBe(2);expect(saved.data.state.pose.length).toBe(49);expect(saved.data.state.keys.every(k=>k.pose.length===49)).toBe(true);
 await expect(page.locator('#status')).toHaveText('● Salvo neste navegador',{timeout:20000});await page.reload();await page.locator('#restore-recovery').click();await expect(page.locator('#asset-meta')).toContainText('49 juntas');expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(saved.data.state.pose);
 await page.locator('#demo').click();await page.locator('#project-file').setInputFiles(saved.path);await expect(page.locator('#asset-meta')).toContainText('49 juntas');expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(saved.data.state.pose);
 const exported=page.waitForEvent('download');await page.locator('#export').click();const glb=await exported,path=testInfo.outputPath('hands.glb');await glb.saveAs(path);const bytes=await fs.readFile(path),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());expect(json.skins[0].joints.length).toBe(49);expect(json.animations[0].channels.length).toBe(100);
 await page.locator('#project-file').setInputFiles(legacy.path);await expect(page.locator('#asset-meta')).toContainText('19 juntas');expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(legacy.data.state.pose);expect(errors).toEqual([]);
});
