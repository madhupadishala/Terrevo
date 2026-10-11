import test from"node:test";import assert from"node:assert/strict";import{createJointWorkService,JointWorkInputError}from"../../../modules/joint-work/src/index.ts";const t="11111111-1111-4111-8111-111111111111",a="22222222-2222-4222-8222-222222222222",e="33333333-3333-4333-8333-333333333333",o="44444444-4444-4444-8444-444444444444";
const rb:any={authorize:async()=>{},accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}};
test("target cannot equal participant",async()=>{const s=createJointWorkService({}as any,rb);await assert.rejects(s.schedule(t,a,"x",{operationId:o,targetEmployeeId:e,participantEmployeeId:e,workDate:"2026-10-01"}),JointWorkInputError)});
test("join validates coordinates",async()=>{const s=createJointWorkService({}as any,rb);await assert.rejects(s.join(t,a,"x",e,{operationId:o,latitude:91,longitude:78,accuracyMeters:10}),JointWorkInputError)});
test("self-scoped joint work list forwards authenticated user",async()=>{let received:any[]=[];const s=createJointWorkService({listVisible:async()=>[],listSelf:async(t,u,token)=>{received=[t,u,token];return[]}}as any,rb);assert.deepEqual(await s.listSelf(t,a,"token"),[]);assert.deepEqual(received,[t,a,"token"])});

test('joint-work reads use the installed composite tenant-target foreign key',async()=>{
 const {createSupabaseAdapter}=await import('../src/supabase-adapter.ts');let reads=0;
 const adapter=createSupabaseAdapter({url:'https://example.supabase.co',anonKey:'public-test',serviceRoleKey:'server-test'},async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('tenant_id'),'eq.'+t);
  if(url.pathname.endsWith('/employees'))return Response.json([{id:e}]);
  assert.equal(url.searchParams.get('select'),'*,employees!joint_work_assignments_tenant_id_target_employee_id_fkey(org_unit_id)');
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer user-test');reads++;
  return Response.json([{id:o,target_employee_id:e,participant_employee_id:a,employees:{org_unit_id:t},work_date:'2026-10-11',status:'PLANNED',execution_id:null,joined_at:null,left_at:null}]);
 });
 assert.equal((await adapter.jointWork.listVisible(t,'user-test'))[0].targetOrgUnitId,t);
 assert.equal((await adapter.jointWork.listSelf(t,a,'user-test'))[0].targetOrgUnitId,t);
 assert.equal((await adapter.jointWork.getVisible(t,o,'user-test'))?.targetOrgUnitId,t);assert.equal(reads,3);
});
