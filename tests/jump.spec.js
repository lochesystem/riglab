import {test,expect} from '@playwright/test';

test('jump generates editable keys, plays once, preserves global placement and can be undone',async({page},testInfo)=>{
 await page.goto('/');await page.locator('#auto-rig').click();
 await page.waitForFunction(()=>window.riglabDiagnostics().rigged);
 await page.getByRole('tab',{name:'Animações',exact:true}).click();
 await page.locator('#walk').click();
 const before=await page.evaluate(()=>window.riglabDiagnostics());
 await page.locator('#animation-kind').selectOption('jump');await page.locator('#jump').click();
 await expect(page.locator('#loop')).not.toHaveClass(/active/);
 expect(await page.evaluate(()=>window.riglabDiagnostics().global)).toEqual(before.global);
 await page.locator('#current-time').fill('0.88');await page.locator('#current-time').press('Tab');
 const air=await page.evaluate(()=>window.riglabDiagnostics());
 await page.locator('#rewind').click();
 const rest=await page.evaluate(()=>window.riglabDiagnostics());
 expect(air.pose[0].p[1]).toBeGreaterThan(rest.pose[0].p[1]+.15);
 await page.locator('#play').click();
 await expect.poll(()=>page.evaluate(()=>window.riglabDiagnostics().time),{timeout:15000}).toBe(1.8);
 await expect(page.locator('#play')).toHaveAttribute('aria-label','Reproduzir');
 await page.screenshot({path:testInfo.outputPath('jump-landed.png')});
 await page.locator('#undo').click();expect((await page.evaluate(()=>window.riglabDiagnostics())).keyframes).toBe(before.keyframes);
});
