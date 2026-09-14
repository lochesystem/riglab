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
 await page.locator('#wave').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(5);
 await page.locator('#play').click();await page.waitForTimeout(500);expect((await page.evaluate(()=>window.riglabDiagnostics())).time).toBeGreaterThan(.1);await page.locator('#play').click();
 await page.screenshot({path:testInfo.outputPath('02-animation-editor.png')});
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const glbPath=testInfo.outputPath('character.glb');await download.saveAs(glbPath);
 const buffer=await fs.readFile(glbPath);expect(buffer.readUInt32LE(0)).toBe(0x46546c67);const len=buffer.readUInt32LE(12);const json=JSON.parse(buffer.subarray(20,20+len).toString());expect(json.skins.length).toBeGreaterThan(0);expect(json.skins[0].joints.length).toBe(19);expect(json.animations[0].channels.length).toBe(38);expect(json.meshes[0].primitives[0].attributes.WEIGHTS_0).toBeDefined();
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
 await page.locator('#wave').click();await page.locator('#walk-speed').selectOption('1.5');await page.locator('#walk-stride').selectOption('0.4');await page.locator('#walk').click();
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
 await page.locator('#idle').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(481);await expect(page.locator('#duration')).toHaveValue('16');
 await page.locator('#skeleton-toggle').click();await page.locator('#viewport').screenshot({path:testInfo.outputPath('idle.png')});
 const idleRuler=await page.locator('#ruler').boundingBox();
 for(const [seconds,label] of [[2.6,'look-left'],[7.7,'hand-on-hip'],[12.5,'look-up'],[15.8,'return']]){
 await page.mouse.click(idleRuler.x+idleRuler.width*(.008+.98*seconds/16),idleRuler.y+12);await page.locator('#viewport').screenshot({path:testInfo.outputPath(`idle-${label}.png`)});
 }

 await page.locator('#run').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(25);await expect(page.locator('#duration')).toHaveValue('0.8');
 await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(481);await page.locator('#redo').click();
 const ruler=await page.locator('#ruler').boundingBox();
 for(const [phase,label] of [[0,'contact'],[.18,'down'],[.43,'flight'],[.65,'passing']]){
 await page.mouse.click(ruler.x+ruler.width*(.008+.98*phase),ruler.y+12);await page.locator('#viewport').screenshot({path:testInfo.outputPath(`run-${label}.png`)});
 }
 // Orbit to inspect knee bend, foot arcs and lean in profile as well.
 const view=await page.locator('#viewport').boundingBox();await page.mouse.move(view.x+view.width*.65,view.y+view.height*.65);await page.mouse.down();await page.mouse.move(view.x+view.width*.65+160,view.y+view.height*.65,{steps:12});await page.mouse.up();await page.waitForTimeout(300);await page.locator('#viewport').screenshot({path:testInfo.outputPath('run-profile.png')});
 await page.locator('#play').click();await page.waitForTimeout(1100);await page.locator('#play').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).time).toBeLessThan(.8);
 const expPromise=page.waitForEvent('download');await page.locator('#export').click();const exp=await expPromise;const expPath=testInfo.outputPath('running.glb');await exp.saveAs(expPath);const buffer=await fs.readFile(expPath);const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());expect(json.animations[0].channels.length).toBe(38);
 const savePromise=page.waitForEvent('download');await page.locator('#save-project').click();const save=await savePromise;const saved=testInfo.outputPath('running.riglab');await save.saveAs(saved);await page.locator('#demo').click();await page.locator('#project-file').setInputFiles(saved);await page.waitForFunction(()=>window.riglabDiagnostics().keyframes===25);expect(errors).toEqual([]);
});
