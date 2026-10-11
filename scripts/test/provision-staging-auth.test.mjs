import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthProvisioner} from '../staging/provision-auth.mjs';
const nonce='a-private-test-nonce';
const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce));
const config={projectRef:'eirlubfbjexjilvskqxq',nonceHash:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''),expiresAt:100,runId:'test',identities:[{role:'MR',email:'test@example.invalid'}]};
const env={url:'https://eirlubfbjexjilvskqxq.supabase.co',serverKey:'server-only-test-key'};
const request=()=>new Request('https://staging.invalid',{method:'POST',headers:{'x-qualification-nonce':nonce},body:JSON.stringify({password:'a-long-password-for-the-authorized-test'})});
test('provisioning denies foreign/production project, expiry, wrong nonce and bad input before provider calls',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('must not call');};
 for(const [cfg,e,req,time] of [[{...config,projectRef:'dfqsnkmmumvjwmvtnlcs'},env,request(),0],[config,{...env,url:'https://production.invalid'},request(),0],[config,env,request(),100],[config,env,new Request('https://staging.invalid',{method:'POST',body:'{}'}),0],[config,env,new Request('https://staging.invalid',{method:'POST',headers:{'x-qualification-nonce':nonce},body:'{}'}),0]]){
  assert.equal((await createAuthProvisioner(cfg,e,fetcher,()=>time)(req)).status,403);
 }assert.equal(calls,0);
});
test('supported Auth create uses only fixed identities and never returns credentials',async()=>{
 const response=await createAuthProvisioner(config,env,async(url,options)=>{
  assert.equal(options.redirect,'error');
  if(!options.method){assert.ok(url.includes('/auth/v1/admin/users?page='));return Response.json({users:[]});}
  assert.equal(url,env.url+'/auth/v1/admin/users');
  const body=JSON.parse(options.body);assert.equal(body.email,config.identities[0].email);assert.equal(body.email_confirm,true);
  return Response.json({id:'authorized-auth-id',access_token:'must-not-return'});
 },()=>0)(request());
 assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes(env.serverKey));assert.ok(!text.includes('password'));assert.ok(!text.includes('must-not-return'));
});
test('password rotation requires fixed identity ownership and refuses unrelated users',async()=>{
 const identity={...config.identities[0],id:'fixed-id'};
 for(const metadata of [{qualification_run:'another',qualification_role:'MR'}, {qualification_run:'test',qualification_role:'MANAGER'}]){
  let calls=0;
  const response=await createAuthProvisioner({...config,identities:[identity]},env,async()=>{calls++;return Response.json({id:identity.id,email:identity.email,app_metadata:metadata});},()=>0)(request());
  assert.equal(response.status,403);assert.equal(calls,1);
 }
 let calls=0;
 const response=await createAuthProvisioner({...config,identities:[identity]},env,async(url,init)=>{
  calls++;assert.equal(url,env.url+'/auth/v1/admin/users/fixed-id');
  assert.ok(init.signal);assert.equal(init.redirect,'error');
  if(calls===1)return Response.json({id:identity.id,email:identity.email,app_metadata:{qualification_run:'test',qualification_role:'MR'}});
  assert.equal(init.method,'PUT');const update=JSON.parse(init.body);assert.equal(update.password,'a-long-password-for-the-authorized-test');assert.deepEqual(update.app_metadata,{qualification_run:'test',qualification_role:'MR'});return Response.json({id:identity.id});
 },()=>0)(request());assert.equal(response.status,200);assert.equal(calls,2);
});
test('fresh handler reconciles an owned identity after response loss without duplicate creation',async()=>{
 let stored=null,creates=0;
 const fetcher=async(url,init)=>{
  if(!init.method){assert.equal(new URL(url).searchParams.get('filter'),config.identities[0].email);return Response.json({users:stored?[stored]:[]});}
  const body=JSON.parse(init.body);
  if(init.method==='POST'){creates++;stored={id:'durable-id',email:body.email,app_metadata:body.app_metadata};throw Error('Create committed but response lost');}
  else assert.equal(init.method,'PUT');
  return Response.json(stored);
 };
 const lost=await createAuthProvisioner(config,env,fetcher,()=>0)(request());assert.equal(lost.status,502);
 const retried=await createAuthProvisioner(config,env,fetcher,()=>0)(request());assert.equal(retried.status,200);assert.equal((await retried.json()).users[0].id,'durable-id');
 assert.equal(creates,1);
});
test('provider failures preserve partial created IDs and do not masquerade as ownership denial',async()=>{
 const identities=[config.identities[0],{role:'MANAGER',email:'manager@example.invalid',id:'fixed-manager'}];
 for(const failure of ['timeout','http']){
  const response=await createAuthProvisioner({...config,identities},env,async(url,init)=>{
   if(url.endsWith('/fixed-manager')){if(failure==='timeout')throw Error('private transport detail');return Response.json({error:'private detail'},{status:500});}
   if(!init.method)return Response.json({users:[]});return Response.json({id:'first-created-id'});
  },()=>0)(request());assert.equal(response.status,502);const body=await response.json();assert.equal(body.created[0].id,'first-created-id');assert.equal(JSON.stringify(body).includes('private'),false);
 }
});
test('reconciliation cannot rotate an email belonging to a different run',async()=>{
 let writes=0;
 const response=await createAuthProvisioner(config,env,async(_url,init)=>{if(init.method)writes++;return Response.json({users:[{id:'foreign-id',email:config.identities[0].email,app_metadata:{qualification_run:'another-run',qualification_role:'MR'}}]});},()=>0)(request());assert.equal(response.status,403);assert.equal(writes,0);
});
