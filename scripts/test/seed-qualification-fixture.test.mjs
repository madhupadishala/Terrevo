import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync}from 'node:child_process';
test('fixture generation preserves IDs and SQL across reruns, including optional MR2 and unscoped identities',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terrevo-fixture-test-'));const manifestPath=path.join(dir,'identity.json');
 try{const roles=['MR','MANAGER','TENANT_ADMIN','FOREIGN_MR','MR2','UNSCOPED'];const users=roles.map((role,i)=>({role,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));fs.writeFileSync(manifestPath,JSON.stringify({runId:'test-only',users}),{mode:0o600});const script=path.resolve(import.meta.dirname,'../staging/seed-qualification-fixture.mjs');const first=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});const fixture=JSON.parse(fs.readFileSync(manifestPath)).fixture;const second=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});assert.equal(first,second);assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath)).fixture,fixture);assert.ok(fixture.mr2Employee);assert.ok(first.includes('QUALMR2'));assert.ok(first.includes(users.find(u=>u.role==='UNSCOPED').id));assert.ok(first.includes("('"+fixture.foreignEmployee+"','"+fixture.foreignTenant+"'"));assert.ok(first.includes("('"+fixture.foreignProduct+"','"+fixture.foreignTenant+"'"));assert.ok(first.includes("('"+fixture.sample+"','"+fixture.tenant+"'"));assert.ok(first.includes(fixture.clmAsset));assert.ok(first.includes(fixture.expensePolicy));assert.ok(first.includes('Synthetic Qualification Product Detail'));assert.ok(first.includes('travel-policy'));assert.ok(!first.includes("('"+fixture.foreignDoctor+"','"+fixture.tenant+"'"));}finally{fs.rmSync(dir,{recursive:true,force:true});}
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
test('a saved older fixture gains stable tenant-specific master IDs without changing existing IDs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terrevo-fixture-upgrade-'));const manifestPath=path.join(dir,'identity.json');
 try{
  const roles=['MR','MANAGER','TENANT_ADMIN','FOREIGN_MR'];
  const users=roles.map((role,i)=>({role,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
  const script=path.resolve(import.meta.dirname,'../staging/seed-qualification-fixture.mjs');
  fs.writeFileSync(manifestPath,JSON.stringify({runId:'fixture-upgrade',users}),{mode:0o600});
  execFileSync(process.execPath,[script,manifestPath]);
  const old=JSON.parse(fs.readFileSync(manifestPath));
  for(const key of ['stockist','sample','gift','foreignEmployee','foreignDoctor','foreignChemist','foreignStockist','foreignProduct','clmAsset','expensePolicy'])delete old.fixture[key];
  fs.writeFileSync(manifestPath,JSON.stringify(old),{mode:0o600});
  const first=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});
  const next=JSON.parse(fs.readFileSync(manifestPath));
  for(const [key,id]of Object.entries(old.fixture))assert.equal(next.fixture[key],id);
  assert.equal(execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'}),first);
  assert.notEqual(next.fixture.foreignProduct,next.fixture.product);assert.ok(next.fixture.clmAsset);assert.ok(next.fixture.expensePolicy);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('a partially persisted core fixture is repaired without losing existing IDs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'terrevo-fixture-partial-'));const manifestPath=path.join(dir,'identity.json');
 try{
  const roles=['MR','MANAGER','TENANT_ADMIN','FOREIGN_MR'];const users=roles.map((role,i)=>({role,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
  const preservedTenant='11111111-1111-4111-8111-111111111111';
  fs.writeFileSync(manifestPath,JSON.stringify({runId:'partial-core',users,fixture:{tenant:preservedTenant}}),{mode:0o600});
  const script=path.resolve(import.meta.dirname,'../staging/seed-qualification-fixture.mjs');
  const first=execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'});const repaired=JSON.parse(fs.readFileSync(manifestPath)).fixture;
  assert.equal(repaired.tenant,preservedTenant);for(const key of ['foreignTenant','company','division','zone','region','area','territory','mrEmployee','managerEmployee','doctor','chemist','product'])assert.match(repaired[key],/^[0-9a-f-]{36}$/i);
  assert.equal(execFileSync(process.execPath,[script,manifestPath],{encoding:'utf8'}),first);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
