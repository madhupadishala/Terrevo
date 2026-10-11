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
  assert.equal(url,env.url+'/auth/v1/admin/users');assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body);assert.equal(body.email,config.identities[0].email);assert.equal(body.email_confirm,true);
  return Response.json({id:'authorized-auth-id',access_token:'must-not-return'});
 },()=>0)(request());
 assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes(env.serverKey));assert.ok(!text.includes('password'));assert.ok(!text.includes('must-not-return'));
});
