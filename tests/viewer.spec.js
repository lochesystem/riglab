import {test,expect} from '@playwright/test';

test('GLB viewer loads exported clips, seeks, switches, rejects invalid files and leaves editor intact',async({page},testInfo)=>{
 test.setTimeout(150000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByRole('tab',{name:'Animações',exact:true}).click();await page.locator('#walk').click();await page.locator('#animation-kind').selectOption('jump');await page.locator('#jump').click();
 const before=await page.evaluate(()=>window.riglabDiagnostics());
 const download=page.waitForEvent('download');await page.locator('#export').click();const file=testInfo.outputPath('viewer.glb');await(await download).saveAs(file);
 await page.locator('#open-viewer').click();await page.locator('#viewer-file').setInputFiles(file);
 await expect(page.locator('#viewer-message')).toHaveText('GLB pronto para visualizar.',{timeout:20000});
 await expect(page.locator('#viewer-clip option')).toHaveText(['Walk','Jump']);await expect(page.locator('#viewer-stage canvas')).toBeVisible();
 await page.locator('#viewer-play').click();await expect.poll(async()=>Number(await page.locator('#viewer-time').inputValue())).toBeGreaterThan(.1);
 await page.locator('#viewer-play').click();const paused=await page.locator('#viewer-time').inputValue();await page.waitForTimeout(200);expect(await page.locator('#viewer-time').inputValue()).toBe(paused);
 await page.locator('#viewer-clip').selectOption({label:'Jump'});await page.locator('#viewer-loop').uncheck();await page.locator('#viewer-speed').selectOption('2');await page.locator('#viewer-play').click();await expect(page.locator('#viewer-play')).toHaveText('Reproduzir',{timeout:15000});await expect(page.locator('#viewer-time-label')).toHaveText('1.80 / 1.80 s');
 await page.locator('#viewer-time').focus();await page.locator('#viewer-time').press('Home');expect(Number(await page.locator('#viewer-time').inputValue())).toBe(0);
 await page.locator('#viewer-wire').check();await page.locator('#viewer-frame').click();await page.screenshot({path:testInfo.outputPath('glb-viewer.png')});
 await page.locator('#viewer-file').setInputFiles({name:'invalid.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('invalid')});await expect(page.locator('#viewer-message')).toContainText('Não foi possível abrir');await expect(page.locator('#viewer-clip option')).toHaveText(['Walk','Jump']);
 await page.locator('#viewer-close').click();const after=await page.evaluate(()=>window.riglabDiagnostics());expect(after.clips).toEqual(before.clips);expect(after.pose).toEqual(before.pose);expect(after.global).toEqual(before.global);
 await page.locator('#open-viewer').click();await expect(page.locator('#viewer-play')).toBeDisabled();await expect(page.locator('#viewer-stage canvas')).toHaveCount(1);await page.locator('#viewer-close').click();expect(errors).toEqual([]);
});
