begin;
-- Integration test runs against real PostgreSQL DDL and RPCs, not fake API responses.
-- Entire fixture is rolled back; it is not product or demo data.
do $$
declare v_tenant uuid:='f0000000-0000-4000-8000-000000000001';
 v_rep uuid:='f0000000-0000-4000-8000-000000000002';
 v_mgr uuid:='f0000000-0000-4000-8000-000000000003';
 v_other uuid:='f0000000-0000-4000-8000-000000000004';
 v_org uuid:='f0000000-0000-4000-8000-000000000005';
 v_terr uuid:='f0000000-0000-4000-8000-000000000006';
 v_div uuid:='f0000000-0000-4000-8000-000000000018';
 v_zone uuid:='f0000000-0000-4000-8000-000000000019';
 v_region uuid:='f0000000-0000-4000-8000-000000000020';
 v_area uuid:='f0000000-0000-4000-8000-000000000021';
 v_emp uuid:='f0000000-0000-4000-8000-000000000007';
 v_mgr_emp uuid:='f0000000-0000-4000-8000-000000000008';
 v_doctor uuid:='f0000000-0000-4000-8000-000000000009';
 v_plan uuid:='f0000000-0000-4000-8000-000000000010';
 v_day uuid:='f0000000-0000-4000-8000-000000000011';
 v_exec uuid:='f0000000-0000-4000-8000-000000000012';
 v_op uuid:='f0000000-0000-4000-8000-000000000013';
 v_call uuid;v_repeat uuid;
begin
 insert into auth.users(id,email)values(v_rep,'ci-representative@example.invalid'),(v_mgr,'ci-manager@example.invalid'),(v_other,'ci-unassigned@example.invalid');
 insert into public.tenants(id,name,slug)values(v_tenant,'CI Unplanned Activity','ci-unplanned-calls');
 insert into public.tenant_memberships(tenant_id,user_id)values(v_tenant,v_rep),(v_tenant,v_mgr);
 insert into public.organization_units(id,tenant_id,type,code,name)values(v_org,v_tenant,'company','CICOMPANY','CI Company');
 insert into public.organization_units(id,tenant_id,parent_id,type,code,name)values
 (v_div,v_tenant,v_org,'division','CIDIV','CI Division'),
 (v_zone,v_tenant,v_div,'zone','CIZONE','CI Zone'),
 (v_region,v_tenant,v_zone,'region','CIREG','CI Region'),
 (v_area,v_tenant,v_region,'area','CIAREA','CI Area'),
 (v_terr,v_tenant,v_area,'territory','CITERRITORY','CI Territory');
 insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id)
 values(v_tenant,v_rep,'MR',v_terr),(v_tenant,v_mgr,'MANAGER',v_terr);
 insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id)
 values(v_mgr_emp,v_tenant,v_mgr,'CIMGR','CI Manager','Area Manager',v_terr),
       (v_emp,v_tenant,v_rep,'CIMR','CI Representative','MR',v_terr);
 insert into public.doctors(id,tenant_id,code,name,specialty,territory_id)
 values(v_doctor,v_tenant,'CIDOCTOR','CI Doctor','General Medicine',v_terr);
 insert into public.tour_plans(id,tenant_id,employee_id,week_start,status)
 values(v_plan,v_tenant,v_emp,date '2026-10-05','APPROVED');
 insert into public.tour_plan_days(id,tenant_id,tour_plan_id,plan_date,territory_id)
 values(v_day,v_tenant,v_plan,date '2026-10-11',v_terr);
 insert into public.tour_executions(id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,
 territory_id,work_date,operation_id,start_latitude,start_longitude,start_accuracy_meters)
 values(v_exec,v_tenant,v_emp,v_plan,v_day,v_terr,date '2026-10-11',
 'f0000000-0000-4000-8000-000000000014',17.385,78.487,10.0);
 select public.admin_submit_unplanned_call(v_tenant,v_rep,v_op,v_exec,v_terr,'doctor',v_doctor,
 'Urgent visit','Actual discussion',30,17.385,78.487,11.0) into v_call;
 if not exists(select 1 from public.unplanned_calls where tenant_id=v_tenant and id=v_call
 and actor_user_id=v_rep and status='SUBMITTED' and work_date=date '2026-10-11') then
   raise exception 'Unplanned call was not persisted under correct owner and tour';end if;
 select public.admin_submit_unplanned_call(v_tenant,v_rep,v_op,v_exec,v_terr,'doctor',v_doctor,
 'Urgent visit','Actual discussion',30,17.385,78.487,11.0) into v_repeat;
 if v_repeat<>v_call or (select count(*) from public.unplanned_calls where tenant_id=v_tenant)<>1 then
   raise exception 'Unplanned operation replay duplicated a call';end if;
 begin
  perform public.admin_submit_unplanned_call(v_tenant,v_other,'f0000000-0000-4000-8000-000000000015',v_exec,v_terr,
     'doctor',v_doctor,'Unauthorized','Bad call',30,17.385,78.487,11.0);
  raise exception 'Unauthorized representative bypassed RPC';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.admin_submit_unplanned_call('f0000000-0000-4000-8000-000000000016',v_rep,
     'f0000000-0000-4000-8000-000000000017',v_exec,v_terr,'doctor',v_doctor,
     'Wrong tenant','Wrong tenant attempt',30,17.385,78.487,11.0);
  raise exception 'Cross tenant operation bypassed RPC';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.admin_decide_unplanned_call(v_tenant,v_rep,v_call,'APPROVE','Self review');
  raise exception 'Representative self-approved an unplanned call';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.admin_decide_unplanned_call(v_tenant,v_mgr,v_call,'REJECT',null);
  raise exception 'Rejection without comment accepted';
 exception when invalid_parameter_value then null;
 end;
 perform public.admin_decide_unplanned_call(v_tenant,v_mgr,v_call,'APPROVE','Verified by manager');
 if not exists(select 1 from public.unplanned_calls where tenant_id=v_tenant and id=v_call
     and status='APPROVED' and reviewed_by=v_mgr and reviewed_at is not null)
  or (select count(*) from public.unplanned_call_decisions where tenant_id=v_tenant and unplanned_call_id=v_call)<>1
 then raise exception 'Manager decision was not persisted with audit evidence'; end if;
 begin
  perform public.admin_decide_unplanned_call(v_tenant,v_mgr,v_call,'REJECT','Second decision');
  raise exception 'Approved unplanned call was reviewed twice';
 exception when unique_violation then null;
 end;
end;$;

-- Exercise actual RLS under the authenticated role and simulated Supabase JWT claim.
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $
begin
 if (select count(*) from public.unplanned_calls where tenant_id='f0000000-0000-4000-8000-000000000001')<>1
 then raise exception 'Representative cannot read their own persisted unplanned call';end if;
end;$;
reset role;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $
begin
 if (select count(*) from public.unplanned_calls where tenant_id='f0000000-0000-4000-8000-000000000001')<>1
 then raise exception 'Authorized manager cannot read the reviewed team call';end if;
 if (select count(*) from public.unplanned_call_decisions where tenant_id='f0000000-0000-4000-8000-000000000001')<>1
 then raise exception 'Authorized manager cannot read call decision evidence';end if;
end;$;
reset role;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $
begin
 if exists(select 1 from public.unplanned_calls where tenant_id='f0000000-0000-4000-8000-000000000001')
   or exists(select 1 from public.unplanned_call_decisions where tenant_id='f0000000-0000-4000-8000-000000000001')
 then raise exception 'Unaffiliated actor bypassed tenant isolation';end if;
end;$;
reset role;
rollback;
