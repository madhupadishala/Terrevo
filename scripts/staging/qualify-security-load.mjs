import {readFile,writeFile,stat}from 'node:fs/promises';
import assert from 'node:assert/strict';
const [identityPath,evidencePath]=process.argv.slice(2);
if(!identityPath||!evidencePath||(await stat(identityPath)).mode&0o077)throw Error('Private mode-0600 identity manifest and evidence output required');
const m=JSON.parse(await readFile(identityPath,'utf8'));
const provider='https://eirlubfbjexjilvskqxq.supabase.co';
const api=provider+'/functions/v1/terrevo-staging-api';
const sessions={};const checks=[];
async function request(origin,path,{role='MR',method='GET',body,expected=200,tenant=m.fixture.tenant}={}){
 const start=performance.now();const headers={'content-type':'application/json',apikey:m.anonKey.trim(),'x-tenant-id':tenant};
 if(role)headers.authorization='Bearer '+sessions[role].accessToken;
 const res=await fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
 const data=res.status===204?null:await res.json();
 checks.push({path,method,role,status:res.status,elapsedMs:Math.round(performance.now()-start),requestId:res.headers.get('x-request-id')});
 assert.ok((Array.isArray(expected)?expected:[expected]).includes(res.status),`${path}: unexpected status ${res.status}`);return data;
}
try{
 for(const u of m.users){sessions[u.role]=await request(api,'/v1/auth/login',{role:null,method:'POST',body:{email:u.email,password:m.password}});assert.equal(sessions[u.role].user.id,u.id);}
 const disabled=await fetch(provider+'/functions/v1/terrevo-qualification-auth',{method:'POST',headers:{authorization:'Bearer '+m.anonKey.trim()},redirect:'error'});assert.equal(disabled.status,410);
 const own=await request(provider,`/rest/v1/doctors?select=id&tenant_id=eq.${m.fixture.tenant}`);assert.equal(own.length,2);
 for(const table of ['doctors','chemists','tour_plans','tour_executions','field_visits','dcrs','unplanned_calls','nca_records','leave_requests','expense_claims','business_customer_links','business_customer_link_grants']){
  const rows=await request(provider,`/rest/v1/${table}?select=*&tenant_id=eq.${m.fixture.tenant}`,{role:'FOREIGN_MR'});assert.deepEqual(rows,[],`${table} cross-tenant leak`);
 }
 for(const [method,body]of [['POST',{}],['PATCH',{name:'unauthorized change'}],['DELETE',undefined]]){
  const error=await request(provider,`/rest/v1/doctors?id=eq.${m.fixture.doctor}`,{method,body,expected:[401,403]});assert.equal(error.code,'42501');
 }
 for(const table of ['business_customer_links','business_customer_link_grants','security_audit_events','platform_admin_grants']){
  const error=await request(provider,`/rest/v1/${table}`,{method:'POST',body:{},expected:[401,403]});assert.equal(error.code,'42501');
 }
 const rpcCases={admin_start_tour:{},admin_checkin_visit:{},
  user_has_permission:{p_tenant_id:m.fixture.tenant,p_user_id:m.users.find(u=>u.role==='MR').id,p_permission:'MASTER_VIEW',p_target_org_unit_id:m.fixture.territory},
  employee_division:{p_tenant_id:m.fixture.tenant,p_employee_id:m.fixture.mrEmployee}};
 for(const [name,body]of Object.entries(rpcCases)){
  const result=await request(provider,'/rest/v1/rpc/'+name,{method:'POST',body,expected:[401,403,404]});assert.ok(['42501','PGRST202'].includes(result.code));
 }
 await request(api,'/v1/manager/analytics?days=0',{role:'MANAGER',expected:400});
 await request(api,'/v1/manager/analytics?days=91',{role:'MANAGER',expected:400});
 await request(api,'/v1/manager/analytics?days=7',{role:'MR',expected:[400,403]});
 // Predeclared small-pilot engineering budgets, not a claim of fleet capacity.
 // Four simultaneous authenticated clients, sixty read requests, no new writes.
 const budgets={requests:60,concurrency:4,p95Ms:3000,p99Ms:5000,unexpectedErrors:0};
 const samples=[];let next=0;const wallStart=performance.now();
 const paths=['/v1/manager/analytics?days=7','/v1/manager/command-center','/v1/unplanned-calls/own','/v1/dcrs'];
 await Promise.all(Array.from({length:budgets.concurrency},async()=>{while(next<budgets.requests){const i=next++;const start=performance.now();await request(api,paths[i%4],{role:i%4<2?'MANAGER':'MR'});samples.push(Math.round(performance.now()-start));}}));
 samples.sort((a,b)=>a-b);const percentile=p=>samples[Math.ceil(samples.length*p)-1];
 const measured={count:samples.length,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:samples.at(-1),elapsedMs:Math.round(performance.now()-wallStart),unexpectedErrors:0};
 assert.ok(measured.p95Ms<=budgets.p95Ms&&measured.p99Ms<=budgets.p99Ms,'Small-pilot engineering latency budget exceeded');
 await writeFile(evidencePath,JSON.stringify({projectRef:'eirlubfbjexjilvskqxq',runId:m.runId,synthetic:true,completedAt:new Date().toISOString(),budgets,measured,checks},null,2)+'\n');console.log(JSON.stringify({qualified:true,checks:checks.length,measured,evidencePath}));
}finally{
 for(const [role]of Object.entries(sessions)){await request(api,'/v1/auth/logout',{role,method:'POST',expected:204}).catch(()=>console.error('Session cleanup failed for '+role));}
}
