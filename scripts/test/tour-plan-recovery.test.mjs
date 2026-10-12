import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverOrCreatePlan} from '../staging/tour-plan-recovery.mjs';
const body={weekStart:'2026-10-12',days:[{date:'2026-10-12',territoryId:'territory',stops:[{sequence:1,type:'doctor',targetId:'doctor'}]}]};
const plan={id:'11111111-1111-4111-8111-111111111111',status:'DRAFT',...body};
test('lost plan-create response is reconciled and checkpointed without a second POST',async()=>{
 const state={steps:{}};let persisted=0,posts=0,committed=false;
 const check=async(name,method,path,options)=>{
  assert.equal(options.cache,false);
  if(method==='POST'){posts++;committed=true;throw Error('response lost');}
  return path==='/v1/tour-plans'?{plans:committed?[plan]:[]}:{plan};
 };
 const persist=async()=>{persisted++;};
 await assert.rejects(recoverOrCreatePlan(check,state,persist,body),/response lost/);
 assert.equal(await recoverOrCreatePlan(check,state,persist,body),plan);
 assert.equal(state.steps['plan-create'].body.plan.id,plan.id);
 assert.equal(posts,1);assert.equal(persisted,1);
 assert.equal(await recoverOrCreatePlan(()=>{throw Error('unexpected request');},state,persist,body),plan);
});
test('recovery fails closed on different content, status or ambiguous plans',async()=>{
 for(const existing of [{...plan,days:[]},{...plan,status:'APPROVED'},{...plan,days:[{...body.days[0],territoryId:'other'}]},{...plan,days:[{...body.days[0],stops:[{...body.days[0].stops[0],targetId:'other'}]}]}]){
  const state={steps:{}};
  await assert.rejects(recoverOrCreatePlan(async(name,method,path)=>{assert.equal(method,'GET');return path==='/v1/tour-plans'?{plans:[existing]}:{plan:existing};},state,()=>{throw Error('must not checkpoint');},body));
  assert.deepEqual(state.steps,{});
 }
 await assert.rejects(recoverOrCreatePlan(async()=>({plans:[plan,plan]}),{steps:{}},async()=>{},body),/Ambiguous/);
});
test('absent weekly plan is created once and validated before checkpoint',async()=>{
 let writes=0,persisted=0;
 const state={steps:{}};
 assert.equal(await recoverOrCreatePlan(async(name,method,path,options)=>{
  if(method==='GET')return {plans:[]};
  writes++;assert.deepEqual(options.body,body);return {plan};
 },state,async()=>{persisted++;},body),plan);
 assert.equal(writes,1);assert.equal(persisted,1);
});
