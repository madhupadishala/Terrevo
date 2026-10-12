import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const manifest={runId:'test-run',users:[{role:'MR',id:'mr'},{role:'MANAGER',id:'manager'},{role:'UNSCOPED',id:'admin'}],fixture:{tenant:'test-tenant'},password:'synthetic-not-a-secret'};
function fixture(run){
 const dir=mkdtempSync(join(tmpdir(),'terrevo-qualifier-test-'));
 try{const input=join(dir,'identity.json');writeFileSync(input,JSON.stringify(manifest),{mode:0o600});return run(dir,input);}finally{rmSync(dir,{recursive:true,force:true});}
}
test('curl qualifier saves evidence and exits nonzero on errors or exceeded latency budgets',()=>fixture((dir,input)=>{
 for(const mode of ['pass','error','slow']){
  const evidence=join(dir,mode+'.json');
  const script=new URL('../staging/qualify-curl-load.mjs',import.meta.url).href;
  const result=spawnSync(process.execPath,['--input-type=module','--eval',`
   import cp from 'node:child_process';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {promisify}from 'node:util';
   const mode=${JSON.stringify(mode)};
   globalThis.fetch=async()=>({status:200,json:async()=>({accessToken:'synthetic-token'})});
   if(mode==='slow'){let clock=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>clock+=6000}});}
   cp.execFile=(command,args,options,callback)=>{
    if(command!=='curl')throw Error('Unexpected command');
    fs.writeFileSync(args[args.indexOf('--dump-header')+1],'server-timing: test');
    callback(null,JSON.stringify({http_code:mode==='error'?500:200}), '');
   };cp.execFile[promisify.custom]=(...args)=>new Promise((resolve,reject)=>cp.execFile(...args,(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr})));syncBuiltinESMExports();
   process.argv=['node',${JSON.stringify(script)},${JSON.stringify(input)},${JSON.stringify(evidence)}];
   await import(${JSON.stringify(script)});
  `],{encoding:'utf8',timeout:15000});
  const recorded=JSON.parse(readFileSync(evidence,'utf8'));
  assert.equal(recorded.qualified,mode==='pass');assert.equal(recorded.measured.count,60);
  assert.equal(result.status,mode==='pass'?0:1,result.stderr);
  if(mode!=='pass')assert.match(result.stderr,/Load qualification failed/);
 }
}));
test('interrupted governance checkpoint preserves the last complete private state',()=>fixture((dir,input)=>{
 const statePath=join(dir,'state.json'),evidence=join(dir,'evidence.json');
 const original={runId:manifest.runId,steps:{'previous-safe-step':{}},checks:[]};
 writeFileSync(statePath,JSON.stringify(original),{mode:0o600});
 const script=new URL('../staging/qualify-platform-governance.mjs',import.meta.url).href;
 const result=spawnSync(process.execPath,['--input-type=module','--eval',`
  import fs from 'node:fs';import {syncBuiltinESMExports}from 'node:module';
  const originalWrite=fs.promises.writeFile;
  fs.promises.writeFile=async(path,data,options)=>{
   if(String(path).endsWith('.tmp')){await originalWrite(path,'{',options);throw Error('simulated interrupted write');}
   throw Error('unsafe direct state overwrite');
  };syncBuiltinESMExports();
  globalThis.fetch=async()=>({status:200,json:async()=>({user:{id:'admin'},accessToken:'synthetic-token'}),headers:new Headers()});
  process.argv=['node',${JSON.stringify(script)},${JSON.stringify(input)},${JSON.stringify(statePath)},${JSON.stringify(evidence)}];
  await import(${JSON.stringify(script)});
 `],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,1);assert.match(result.stderr,/simulated interrupted write/);
 assert.deepEqual(JSON.parse(readFileSync(statePath,'utf8')),original);
 assert.equal(statSync(statePath).mode&0o777,0o600);
}));
