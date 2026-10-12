import {test,expect} from '@playwright/test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';

let script:string;
test.beforeAll(async()=>{
 const result=await build({configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},esbuild:{jsx:'automatic'},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/review-regressions.tsx',import.meta.url)),name:'ReviewRegressions',formats:['iife']}}});
 const output=Array.isArray(result)?result[0].output:'output' in result?result.output:[];
 const chunk=output.find(item=>item.type==='chunk');
 if(!chunk||chunk.type!=='chunk')throw Error('Missing regression harness');
 script=chunk.code;
});
test.beforeEach(async({page})=>{
 await page.goto('about:blank');await page.setContent('<div id="root"></div>');await page.addScriptTag({content:script});
});
test('report context switch resets filters and CSV intent in the first committed render',async({page})=>{
 await page.evaluate(()=> (window as any).reviewHarness.report('a'));
 await page.getByLabel('Territory',{exact:true}).selectOption('east');
 await page.getByLabel('Team member').selectOption('u');
 await page.getByLabel('Work date from').fill('2026-10-10');
 // Parent layout effect exports before a child's passive useEffect can reset.
 await page.evaluate(()=>(window as any).reviewHarness.report('b',true));
 await expect(page.getByLabel('Territory',{exact:true})).toHaveValue('');
 expect(await page.evaluate(()=>(window as any).reviewHarness.intents)).toEqual([{tenantId:'b',contextKey:'b',asOf:'2026-10-11T10:00:00Z',filter:{from:'',to:'',territoryId:'',ownerUserId:''},sourceIds:['source-b']}]);
});
test('receipt review disables after success, deduplicates clicks and resets with context',async({page})=>{
 await page.evaluate(()=>(window as any).reviewHarness.workforce());
 await page.getByRole('button',{name:'Inspect evidence'}).click();
 await expect(page.getByText('Receipt: CONFLICTING MANIFESTS')).toBeVisible();
 await page.getByRole('button',{name:'Request receipt review'}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
 await expect(page.getByRole('button',{name:'Request receipt review'})).toBeDisabled();
 expect(await page.evaluate(()=>(window as any).reviewHarness.intents)).toEqual([{tenantId:'a',contextKey:'session',claimId:'claim',receiptId:'first'}]);
 await page.evaluate(()=>(window as any).reviewHarness.workforce('next'));
 await page.getByRole('button',{name:'Inspect evidence'}).click();
 await expect(page.getByRole('button',{name:'Request receipt review'})).toBeEnabled();
});
test('synchronous receipt intent failure remains retryable',async({page})=>{
 page.on('pageerror',()=>{});
 await page.evaluate(()=>(window as any).reviewHarness.workforce('session',true));
 await page.getByRole('button',{name:'Inspect evidence'}).click();
 await page.getByRole('button',{name:'Request receipt review'}).click();
 await expect(page.getByRole('button',{name:'Request receipt review'})).toBeEnabled();
 await page.evaluate(()=>(window as any).reviewHarness.workforce('session',false));
 await page.getByRole('button',{name:'Request receipt review'}).click();
 await expect(page.getByRole('button',{name:'Request receipt review'})).toBeDisabled();
 expect(await page.evaluate(()=>(window as any).reviewHarness.intents.length)).toBe(1);
});
