import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync}from 'node:child_process';
test('fixture generation preserves IDs and SQL across reruns, including optional MR2 and unscoped identities',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terrevo-fixture-test-'));const manifestPath=path.join(dir,'identity.json');
 try{const roles=['MR','MANAGER','TENANT_ADMIN','FOREIGN_MR','MR2','UNSCOPED'];const users=roles.map((role,i)=>({role,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));fs.writeFileSync(manifestPath,JSON.stringify({runId:'test-only',users}),{mode:0o600});const script=path.resolve(import.meta.dirname,'../staging/seed-qualification-fixture.mjs');const first=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});const fixture=JSON.parse(fs.readFileSync(manifestPath)).fixture;const second=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});assert.equal(first,second);assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath)).fixture,fixture);assert.ok(fixture.mr2Employee);assert.ok(first.includes('QUALMR2'));assert.ok(first.includes(users.find(u=>u.role==='UNSCOPED').id));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('all membership identities are checked for run, role and canonical email before any insert',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terrevo-fixture-guards-'));const manifestPath=path.join(dir,'identity.json');
 try{
  const roles=['MR','MANAGER','TENANT_ADMIN','FOREIGN_MR','MR2','UNSCOPED'];const users=roles.map((role,i)=>({role,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
  const script=path.resolve(import.meta.dirname,'../staging/seed-qualification-fixture.mjs');
  fs.writeFileSync(manifestPath,JSON.stringify({runId:'guard-test',users}),{mode:0o600});
  const sql=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});const guard=sql.slice(0,sql.indexOf('insert into'));
  for(const u of users)assert.ok(guard.includes(`('${u.id}'::uuid,'${u.role}','guard-test-${u.role.toLowerCase()}@example.invalid')`));
  assert.ok(guard.includes("u.raw_app_meta_data->>'qualification_run'='guard-test'"));assert.ok(guard.includes("u.raw_app_meta_data->>'qualification_role'=expected.role"));assert.ok(guard.includes('u.email=expected.email'));
  for(const invalid of [[...users,{...users[4]}],users.map(u=>u.role==='UNSCOPED'?{...u,id:'invalid'}:u)]){
   fs.writeFileSync(manifestPath,JSON.stringify({runId:'guard-test',users:invalid}),{mode:0o600});assert.throws(()=>execFileSync(process.execPath,[script,manifestPath],{stdio:'pipe'}),/Command failed/);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
