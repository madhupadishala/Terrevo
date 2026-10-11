import test from 'node:test';
import assert from 'node:assert/strict';
import {findRunTenant} from '../staging/platform-tenant-recovery.mjs';

test('lost tenant-create response is reconciled on a fresh scan without a second creation', async()=>{
  let stored=null, creates=0;
  const call=async(_name,path,options)=>{
    assert.equal(options.cache,false);
    const offset=Number(new URL(path,'https://staging.invalid').searchParams.get('offset'));
    return {tenants:offset===0?Array.from({length:100},(_,i)=>({slug:`other-${i}`})):stored?[stored]:[]};
  };
  const attempt=async()=>{
    const existing=await findRunTenant(call,'test-gov');
    if(existing)return existing;
    creates++;stored={id:'committed-id',slug:'test-gov'};throw Error('Response lost');
  };
  await assert.rejects(attempt(),/Response lost/);
  assert.equal((await attempt()).id,'committed-id');assert.equal(creates,1);
});

test('tenant reconciliation refuses incomplete or malformed lists before creation',async()=>{
  let pages=0;
  await assert.rejects(findRunTenant(async()=>{pages++;return {tenants:Array.from({length:100},()=>({slug:'other'}))};},'missing'),/Bounded/);
  assert.equal(pages,100);
  await assert.rejects(findRunTenant(async()=>({tenants:null}),'missing'),/Invalid/);
  await assert.rejects(findRunTenant(async()=>({tenants:[{slug:'same'},{slug:'same'}]}),'same'),/Ambiguous/);
});
