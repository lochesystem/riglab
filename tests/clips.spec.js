import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test('four independent clips survive editing, duplication, recovery, project and named GLB export',async({page},testInfo)=>{
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByRole('tab',{name:'Animações',exact:true}).click();
 for(const [kind,button] of [['walk','walk'],['run','run'],['jump','jump'],['combo','combo']]){await page.locator('#animation-kind').selectOption(kind);await page.locator(`#${button}`).click();}
 const library=await page.evaluate(()=>window.riglabDiagnostics().clips);expect(library.map(c=>c.name)).toEqual(['Walk','Run','Jump','PunchCombo']);
 await page.locator('#clip-select').selectOption({label:'Walk'});
 const walk=await page.evaluate(()=>window.riglabDiagnostics().pose);
 await page.locator('#duration').fill('2');await page.locator('#duration').press('Tab');
 await page.locator('#clip-duplicate').click();await page.locator('#clip-name').fill('Walk slow');await page.locator('#clip-name').press('Tab');
 await page.locator('#duration').fill('4');await page.locator('#duration').press('Tab');
 await page.locator('#clip-select').selectOption({label:'Walk'});expect(Number(await page.locator('#duration').inputValue())).toBe(2);expect(await page.evaluate(()=>window.riglabDiagnostics().pose)).toEqual(walk);
 await page.locator('#clip-select').selectOption({label:'Walk slow'});await page.locator('#clip-delete').click();await page.locator('#undo').click();await expect(page.locator('#clip-select option')).toHaveCount(5);
 await page.locator('#clip-select').selectOption({label:'Walk slow'});await page.locator('#clip-delete').click();
 // Enabling hands after authoring must adapt every clip, including inactive ones.
 await page.getByRole('tab',{name:'Pose',exact:true}).click();await page.getByText('Mãos · punhos',{exact:true}).click();await page.locator('#add-hands').click();await expect(page.locator('#asset-meta')).toContainText('49 juntas');
 await expect(page.locator('#status')).toHaveText('● Salvo neste navegador',{timeout:20000});
 const saveEvent=page.waitForEvent('download');await page.locator('#save-project').click();const file=testInfo.outputPath('library.riglab');await(await saveEvent).saveAs(file);
 const saved=JSON.parse(await fs.readFile(file,'utf8'));expect(saved.version).toBe(3);expect(saved.state.clips).toHaveLength(4);expect(saved.state.clips.every(c=>c.keys.every(k=>k.pose.length===49))).toBe(true);
 await expect(page.locator('#open-project')).toBeEnabled();await page.reload();await page.locator('#restore-recovery').click();await page.waitForFunction(()=>window.riglabDiagnostics().clips.length===4);
 await page.locator('#project-file').setInputFiles(file);await expect(page.locator('#open-project')).toBeEnabled();await page.getByRole('tab',{name:'Animações',exact:true}).click();
 await page.locator('#clip-select').selectOption({label:'Jump'});await expect(page.locator('#loop')).not.toHaveClass(/active/);
 const dl=page.waitForEvent('download');await page.locator('#export').click();const glb=testInfo.outputPath('library.glb');await(await dl).saveAs(glb);
 const buffer=await fs.readFile(glb),json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());expect(json.animations.map(a=>a.name)).toEqual(['Walk','Run','Jump','PunchCombo']);expect(json.skins[0].joints.length).toBe(49);expect(json.animations.every(a=>a.channels.length===100)).toBe(true);
 // Older projects are migrated into a single clip without losing their keys.
 const legacy=structuredClone(saved);legacy.version=2;delete legacy.state.clips;delete legacy.state.activeClipId;const old=testInfo.outputPath('legacy.riglab');await fs.writeFile(old,JSON.stringify(legacy));await page.locator('#project-file').setInputFiles(old);await page.waitForFunction(()=>window.riglabDiagnostics().clips.length===1);expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(legacy.state.keys.length);
 expect(errors).toEqual([]);
});
