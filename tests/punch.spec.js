import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test('single punch and combo close rigged fists, export animation, play once and undo',async({page},testInfo)=>{
 await page.goto('/');await page.locator('#auto-rig').click();await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByText('Mãos · punhos',{exact:true}).click();await page.locator('#add-hands').click();
 await expect(page.locator('#asset-meta')).toContainText('49 juntas');
 const original=await page.evaluate(()=>window.riglabDiagnostics());
 await page.getByRole('tab',{name:'Animações',exact:true}).click();
 for(const kind of ['punch','combo']){
  await page.locator('#animation-kind').selectOption(kind);await page.locator(`#${kind}`).click();
  await expect(page.locator('#loop')).not.toHaveClass(/active/);
  const result=await page.evaluate(()=>window.riglabDiagnostics());
  expect(result.global).toEqual(original.global);expect(result.pose.length).toBe(49);
  for(const root of [19,34])expect(result.pose.slice(root,root+15).some((p,i)=>JSON.stringify(p.q)!==JSON.stringify(original.pose[root+i].q))).toBe(true);
  await page.locator('#play').click();await expect(page.locator('#play')).toHaveAttribute('aria-label','Reproduzir',{timeout:15000});
 }
 const dl=page.waitForEvent('download');await page.locator('#export').click();const file=testInfo.outputPath('punch-combo.glb');await(await dl).saveAs(file);
 const buffer=await fs.readFile(file),json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());expect(json.skins[0].joints.length).toBe(49);expect(json.animations[0].channels.length).toBe(100);
 await page.locator('#undo').click();expect(Number(await page.locator('#duration').inputValue())).toBeCloseTo(1.27,1);
});
