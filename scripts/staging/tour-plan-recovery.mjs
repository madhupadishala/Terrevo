import assert from 'node:assert/strict';

// Read through the authenticated own-plan endpoints; never replace an existing
// weekly plan whose content differs from the synthetic qualification fixture.
export async function recoverOrCreatePlan(check,state,persist,body){
 if(state.steps['plan-create'])return state.steps['plan-create'].body.plan;
 const {plans}=await check('plan-reconcile-list','GET','/v1/tour-plans',{cache:false});
 assert.ok(Array.isArray(plans),'Invalid own-plan list');
 const matches=plans.filter(plan=>plan.weekStart===body.weekStart);
 assert.ok(matches.length<=1,'Ambiguous weekly plan');
 let result;
 if(matches.length){
  assert.match(matches[0].id,/^[0-9a-f-]{36}$/i);
  result=await check('plan-reconcile-detail','GET',`/v1/tour-plans/${matches[0].id}`,{cache:false});
  assert.equal(result.plan?.id,matches[0].id);
 }else{
  result=await check('plan-create','POST','/v1/tour-plans',{status:201,body,cache:false});
 }
 const plan=result.plan;
 assert.equal(plan?.weekStart,body.weekStart,'Weekly plan differs from qualification fixture');
 assert.equal(plan.status,'DRAFT','Uncheckpointed plan is not a draft; operator reconciliation required');
 const normalize=days=>days.map(day=>({date:day.date,territoryId:day.territoryId,remarks:day.remarks??null,stops:day.stops.map(stop=>({sequence:stop.sequence,type:stop.type,targetId:stop.targetId,remarks:stop.remarks??null}))}));
 assert.deepEqual(normalize(plan.days),normalize(body.days),'Weekly plan differs from qualification fixture');
 state.steps['plan-create']={body:result};await persist();
 return plan;
}
