import {readFile,writeFile,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

// Synthetic identities and coordinates qualify software, never physical presence.
// Successful mutations are checkpointed privately so interruption cannot create
// a second plan. Credentials and API response bodies never enter public evidence.
const [identityPath,statePath,evidencePath]=process.argv.slice(2);
if(!identityPath||!statePath||!evidencePath)throw new Error('identity, private state and sanitized evidence paths required');
for(const path of [identityPath,statePath]){
  try {if((await stat(path)).mode&0o077)throw new Error('Private input/state must have mode 0600');}
  catch(error){if(error.code!=='ENOENT'||path===identityPath)throw error;}
}
const identity=JSON.parse(await readFile(identityPath,'utf8'));
const origin='https://eirlubfbjexjilvskqxq.supabase.co/functions/v1/terrevo-staging-api';
let state;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;state={runId:identity.runId,steps:{},operations:{},checks:[]};}
assert.equal(state.runId,identity.runId);
const sessions={};const f=identity.fixture;
const persist=async()=>writeFile(statePath,JSON.stringify(state),{mode:0o600});
async function check(name,method,path,{role='MR',body,status=200,tenant=f.tenant,cache=true}={}){
  if(cache&&state.steps[name])return state.steps[name].body;
  const start=performance.now();
  const headers={'content-type':'application/json','x-tenant-id':tenant};
  if(role)headers.authorization='Bearer '+sessions[role].accessToken;
  const response=await fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
  const result=response.status===204?null:await response.json();
  const evidence={name,method,path,status:response.status,expected:status,passed:(Array.isArray(status)?status:[status]).includes(response.status),elapsedMs:Math.round(performance.now()-start),requestId:response.headers.get('x-request-id'),executedAt:new Date().toISOString()};
  state.checks.push(evidence);await persist();console.log(JSON.stringify(evidence));
  assert.ok((Array.isArray(status)?status:[status]).includes(response.status),`${name}: unexpected ${response.status}: ${result?.error??'response rejected'}`);
  if(cache){state.steps[name]={body:result};await persist();}
  return result;
}
function op(name){state.operations[name]??=randomUUID();return state.operations[name];}
for(const user of identity.users){
  const result=await check('login-'+user.role,'POST','/v1/auth/login',{role:null,body:{email:user.email,password:identity.password},cache:false});
  assert.equal(result.user.id,user.id);assert.ok(result.accessToken&&result.refreshToken);sessions[user.role]=result;
}
await check('anonymous-denied','GET','/v1/me',{role:null,status:401});
const target=await check('trusted-staging-target','GET','/v1/qualification/target');assert.equal(target.projectRef,'eirlubfbjexjilvskqxq');
await check('foreign-tenant-denied','GET','/v1/tour-plans',{role:'FOREIGN_MR',status:403});
await check('mr-admin-denied','PUT','/v1/field-settings',{body:{geofenceRadiusMeters:100,maxGpsAccuracyMeters:50},status:403});
await check('admin-field-settings','PUT','/v1/field-settings',{role:'TENANT_ADMIN',body:{geofenceRadiusMeters:100,maxGpsAccuracyMeters:50}});
await check('tenant-admin-platform-denied','GET','/v1/platform/tenants',{role:'TENANT_ADMIN',status:403});
const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
state.workDate??=localDate;assert.equal(state.workDate,localDate,'Resume on the same tenant work date');
const monday=new Date(state.workDate+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
const plan=(await check('plan-create','POST','/v1/tour-plans',{status:201,body:{weekStart:monday.toISOString().slice(0,10),days:[{date:state.workDate,territoryId:f.territory,stops:[{sequence:1,type:'doctor',targetId:f.doctor}]}]}})).plan;
await check('plan-submit','POST',`/v1/tour-plans/${plan.id}/submit`,{status:204});
await check('plan-approve','POST',`/v1/tour-approvals/${plan.id}/decision`,{role:'MANAGER',status:204,body:{decision:'APPROVE'}});
const options=(await check('approved-start-options','GET','/v1/tour-executions/start-options')).options;
const option=options.find(x=>x.workDate===state.workDate)||options[0];assert.ok(option,'Approved day must be startable');
const location={latitude:17.385,longitude:78.487,accuracyMeters:10};
const startBody={operationId:op('start'),planDayId:option.planDayId,...location,deviceId:'synthetic-qualification',networkType:'test',appVersion:identity.runId};
const execution=(await check('tour-start','POST','/v1/tour-executions/start',{status:201,body:startBody})).execution;
const replay=(await check('tour-start-retry','POST','/v1/tour-executions/start',{status:201,body:startBody})).execution;assert.equal(replay.id,execution.id);
await check('tour-start-conflicting-retry','POST','/v1/tour-executions/start',{status:409,body:{...startBody,latitude:17.386}});
const progress=(await check('persisted-progress','GET','/v1/tour-executions/progress')).progress;
assert.equal(progress.executionId,execution.id);assert.equal(progress.plannedCount,1);
const inBody={operationId:op('checkin'),planStopId:progress.stops[0].planStopId,...location};
await check('poor-gps-denied','POST','/v1/visits/check-in',{status:[400,409],body:{...inBody,operationId:op('poor-gps'),accuracyMeters:500}});
const visit=(await check('visit-checkin','POST','/v1/visits/check-in',{status:201,body:inBody})).visit;
assert.equal((await check('visit-checkin-retry','POST','/v1/visits/check-in',{status:201,body:inBody})).visit.id,visit.id);
await check('premature-checkout-denied','POST',`/v1/visits/${visit.id}/check-out`,{status:400,body:{operationId:op('early-checkout'),...location}});
const callBody={operationId:op('doctorcall'),callOutcome:'Synthetic software qualification',remarks:'No clinical interaction occurred',products:[{sequence:1,productId:f.product}]};
const call=(await check('doctorcall-save','PUT',`/v1/visits/${visit.id}/doctor-call`,{body:callBody})).doctorCall;
assert.equal((await check('doctorcall-retry','PUT',`/v1/visits/${visit.id}/doctor-call`,{body:callBody})).doctorCall.id,call.id);
const outBody={operationId:op('checkout'),...location};
const closed=(await check('visit-checkout','POST',`/v1/visits/${visit.id}/check-out`,{body:outBody})).visit;assert.equal(closed.status,'CHECKED_OUT');
assert.equal((await check('visit-checkout-retry','POST',`/v1/visits/${visit.id}/check-out`,{body:outBody})).visit.id,visit.id);
const unplannedBody={operationId:op('unplanned'),executionId:execution.id,territoryId:f.territory,customerType:'doctor',customerId:f.unplannedDoctor,reason:'Synthetic qualification',remarks:'No clinical interaction occurred',durationMinutes:1,...location};
const unplanned=(await check('unplanned-create','POST','/v1/unplanned-calls',{status:201,body:unplannedBody})).call;
assert.equal((await check('unplanned-retry','POST','/v1/unplanned-calls',{status:201,body:unplannedBody})).call.id,unplanned.id);
await check('unplanned-self-review-denied','POST',`/v1/unplanned-approvals/${unplanned.id}/decision`,{status:[403,409],body:{decision:'APPROVE'}});
assert.equal((await check('unplanned-manager-review','POST',`/v1/unplanned-approvals/${unplanned.id}/decision`,{role:'MANAGER',body:{decision:'APPROVE'}})).call.status,'APPROVED');
await check('nca-category-admin','POST','/v1/nca/categories',{role:'TENANT_ADMIN',status:201,body:{code:'QUAL_TEST',label:'Synthetic qualification only'}});
const nca=(await check('nca-report','POST','/v1/nca',{status:201,body:{operationId:op('nca'),workDate:state.workDate,territoryId:f.territory,phase:'REPORT',categoryCode:'QUAL_TEST',reason:'Synthetic test',remarks:'Software test only',durationMinutes:1}})).record;
assert.equal((await check('nca-submit','POST',`/v1/nca/${nca.id}/submit`)).record.status,'SUBMITTED');
const submitBody={operationId:op('submit'),shortDayReason:'Synthetic engineering qualification run: no real field day'};
const submitted=(await check('tour-submit','POST','/v1/tour-executions/submit',{body:submitBody})).execution;assert.equal(submitted.status,'SUBMITTED');
assert.equal((await check('tour-submit-retry','POST','/v1/tour-executions/submit',{body:submitBody})).execution.id,execution.id);
const claim=(await check('expense-save','PUT',`/v1/executions/${execution.id}/expense`,{body:{operationId:op('expense'),currencyCode:'INR',lines:[{sequence:1,category:'OTHER',amount:1,remarks:'Synthetic fixture; no reimbursement'}]}})).claim;
await check('expense-submit','POST',`/v1/expenses/${claim.id}/submit`,{body:{operationId:op('expense-submit')}});
await check('expense-approve','POST',`/v1/expense-approvals/${claim.id}/decision`,{role:'MANAGER',status:204,body:{decision:'APPROVE'}});
const tomorrow=new Date(state.workDate+'T00:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
const leave=(await check('leave-request','POST','/v1/leaves',{status:201,body:{operationId:op('leave'),leaveType:'FULL_DAY',startDate:tomorrow.toISOString().slice(0,10),endDate:tomorrow.toISOString().slice(0,10),reason:'Synthetic qualification only'}})).leave;
await check('leave-approve','POST',`/v1/leave-approvals/${leave.id}/decision`,{role:'MANAGER',status:204,body:{decision:'APPROVE'}});
await check('manager-command','GET','/v1/manager/command-center',{role:'MANAGER'});
const analytics=(await check('manager-analytics','GET','/v1/manager/analytics?days=7',{role:'MANAGER'})).analytics;
assert.equal(analytics.tours.submitted,1);assert.equal(analytics.coverage.completedVisits,1);assert.equal(analytics.coverage.doctorCalls,1);
await check('foreign-report-denied','GET','/v1/manager/analytics?days=7',{role:'FOREIGN_MR',status:403});
await check('foreign-dcr-denied','GET','/v1/dcrs',{role:'FOREIGN_MR',status:403});
const links=await check('authorized-customer-links','GET',`/v1/business/customer-links/${f.doctor}`);assert.ok(JSON.stringify(links).includes(f.chemist));
const refreshed=await check('refresh-session','POST','/v1/auth/refresh',{role:null,body:{refreshToken:sessions.MR.refreshToken},cache:false});assert.equal(refreshed.user.id,sessions.MR.user.id);sessions.MR=refreshed;
const own=(await check('durable-unplanned-after-refresh','GET','/v1/unplanned-calls/own',{cache:false})).calls;assert.ok(own.some(x=>x.id===unplanned.id&&x.status==='APPROVED'));
const dcrs=(await check('durable-dcr-after-refresh','GET','/v1/dcrs',{cache:false})).dcrs;assert.equal(dcrs.length,1);
for(const [role,session]of Object.entries(sessions))await check('logout-'+role,'POST','/v1/auth/logout',{role,status:204,cache:false});
await check('revoked-refresh-denied','POST','/v1/auth/refresh',{role:null,body:{refreshToken:sessions.MR.refreshToken},status:401,cache:false});
const evidence={runId:identity.runId,projectRef:'eirlubfbjexjilvskqxq',synthetic:true,workDate:state.workDate,checks:state.checks,records:{tenantId:f.tenant,planId:plan.id,executionId:execution.id,visitId:visit.id,doctorCallId:call.id,unplannedId:unplanned.id,ncaId:nca.id,expenseId:claim.id,leaveId:leave.id},reconciledAnalytics:analytics,completedAt:new Date().toISOString()};
await writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({qualified:true,checks:state.checks.length,evidencePath}));
