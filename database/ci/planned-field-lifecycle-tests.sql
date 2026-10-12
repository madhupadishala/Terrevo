begin;
-- Integration test runs against real PostgreSQL DDL and RPCs, not fake API responses.
-- Entire fixture is rolled back; it is not product or demo data.
do $$
declare v_tenant uuid:='f2000000-0000-4000-8000-000000000001';
 v_rep uuid:='f2000000-0000-4000-8000-000000000002';
 v_mgr uuid:='f2000000-0000-4000-8000-000000000003';
 v_other uuid:='f2000000-0000-4000-8000-000000000004';
 v_org uuid:='f2000000-0000-4000-8000-000000000005';
 v_terr uuid:='f2000000-0000-4000-8000-000000000006';
 v_div uuid:='f2000000-0000-4000-8000-000000000018';
 v_zone uuid:='f2000000-0000-4000-8000-000000000019';
 v_region uuid:='f2000000-0000-4000-8000-000000000020';
 v_area uuid:='f2000000-0000-4000-8000-000000000021';
 v_emp uuid:='f2000000-0000-4000-8000-000000000007';
 v_mgr_emp uuid:='f2000000-0000-4000-8000-000000000008';
 v_doctor uuid:='f2000000-0000-4000-8000-000000000009';
 v_plan uuid:='f2000000-0000-4000-8000-000000000010';
 v_day uuid:='f2000000-0000-4000-8000-000000000011';
 v_exec uuid:='f2000000-0000-4000-8000-000000000012';
 v_op uuid:='f2000000-0000-4000-8000-000000000013';
 v_call uuid;v_repeat uuid;v_visit uuid;v_stop uuid;v_snapshot jsonb;
 v_date date:=(clock_timestamp() at time zone 'UTC')::date;
 v_start_op uuid:='f2000000-0000-4000-8000-000000000022';
 v_checkin_op uuid:='f2000000-0000-4000-8000-000000000023';
 v_checkout_op uuid:='f2000000-0000-4000-8000-000000000024';
 v_submit_op uuid:='f2000000-0000-4000-8000-000000000025';
begin
 insert into auth.users(id,email)values(v_rep,'ci-representative@example.invalid'),(v_mgr,'ci-manager@example.invalid'),(v_other,'ci-unassigned@example.invalid');
 insert into public.tenants(id,name,slug)values(v_tenant,'CI Planned Lifecycle','ci-planned-lifecycle');
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
 update public.doctors set latitude=17.385,longitude=78.487 where tenant_id=v_tenant and id=v_doctor;

 -- Use the existing plan/approval functions, not substitute business records.
 select public.admin_save_tour_plan(v_tenant,v_rep,null,date_trunc('week',v_date)::date,
  jsonb_build_array(jsonb_build_object('date',v_date,'territoryId',v_terr,'stops',
   jsonb_build_array(jsonb_build_object('sequence',1,'type','doctor','targetId',v_doctor))))) into v_plan;
 perform public.admin_submit_tour_plan(v_tenant,v_rep,v_plan);
 perform public.admin_decide_tour_plan(v_tenant,v_mgr,v_plan,'APPROVE','CI review');
 select id into v_day from public.tour_plan_days where tenant_id=v_tenant and tour_plan_id=v_plan;
 select id into v_stop from public.tour_plan_stops where tenant_id=v_tenant and tour_plan_day_id=v_day;
 select public.admin_start_tour(v_tenant,v_rep,v_start_op,v_day,null,17.385,78.487,10,null,null,null) into v_exec;
 select public.admin_start_tour(v_tenant,v_rep,v_start_op,v_day,null,17.385,78.487,10,null,null,null) into v_repeat;
 if v_repeat<>v_exec or (select count(*) from public.tour_executions where tenant_id=v_tenant)<>1 then
  raise exception 'Identical start retry duplicated execution';end if;
 begin
  perform public.admin_start_tour(v_tenant,v_rep,v_start_op,v_day,null,18.385,78.487,10,null,null,null);
  raise exception 'Changed start retry accepted' using errcode='P0004';
 exception when unique_violation then
  if sqlerrm<>'idempotency key reused with different start payload' then raise;end if;
 end;
 if (select count(*) from public.tour_executions where tenant_id=v_tenant)<>1
   or (select start_latitude from public.tour_executions where id=v_exec) is distinct from 17.385::double precision then
  raise exception 'Rejected start retry changed persisted execution';end if;
 select public.admin_checkin_visit(v_tenant,v_rep,v_checkin_op,v_stop,17.385,78.487,10,null) into v_visit;
 select public.admin_checkin_visit(v_tenant,v_rep,v_checkin_op,v_stop,17.385,78.487,10,null) into v_repeat;
 if v_repeat<>v_visit or (select count(*) from public.field_visits where tenant_id=v_tenant)<>1 then
  raise exception 'Identical check-in retry duplicated visit';end if;
 begin
  perform public.admin_checkin_visit(v_tenant,v_rep,v_checkin_op,v_stop,17.385,78.487,20,null);
  raise exception 'Changed check-in retry accepted' using errcode='P0004';
 exception when unique_violation then
  if sqlerrm<>'idempotency key reused with different check-in payload' then raise;end if;
 end;
 if (select count(*) from public.field_visits where tenant_id=v_tenant)<>1
   or (select checkin_accuracy_meters from public.field_visits where id=v_visit) is distinct from 10::double precision then
  raise exception 'Rejected check-in retry changed persisted visit';end if;
 -- Revoked permissions cannot be recovered through an operation replay.
 update public.user_role_assignments set status='inactive' where tenant_id=v_tenant and user_id=v_rep;
 begin
  perform public.admin_start_tour(v_tenant,v_rep,v_start_op,v_day,null,17.385,78.487,10,null,null,null);
  raise exception 'Revoked start replay accepted' using errcode='P0004';
 exception when insufficient_privilege then null;end;
 begin
  perform public.admin_checkin_visit(v_tenant,v_rep,v_checkin_op,v_stop,17.385,78.487,10,null);
  raise exception 'Revoked check-in replay accepted' using errcode='P0004';
 exception when insufficient_privilege then null;end;
 update public.user_role_assignments set status='active' where tenant_id=v_tenant and user_id=v_rep;
 -- Invalid transitions must leave the field record unchanged.
 begin
  perform public.admin_submit_tour_execution(v_tenant,v_rep,v_submit_op,'CI short day');
  raise exception 'Open visit allowed tour submission' using errcode='P0004';
 exception when raise_exception then
  if sqlerrm<>'open visit must be checked out before submitting tour' then raise;end if;
 end;
 begin
  perform public.admin_checkout_visit(v_tenant,v_rep,v_visit,v_checkout_op,17.385,78.487,10);
  raise exception 'Checkout without doctor call allowed' using errcode='P0004';
 exception when raise_exception then
  if sqlerrm<>'doctor call details required before checkout' then raise;end if;
 end;
 if (select status from public.field_visits where tenant_id=v_tenant and id=v_visit)<>'CHECKED_IN'
  or exists(select 1 from public.dcrs where tenant_id=v_tenant) then
  raise exception 'Failed checkout left partial writes';end if;
 select public.admin_save_doctor_call(v_tenant,v_rep,v_visit,v_op,'Discussed','CI interaction',null,'[]') into v_call;
 perform public.admin_checkout_visit(v_tenant,v_rep,v_visit,v_checkout_op,17.385,78.487,10);
 perform public.admin_checkout_visit(v_tenant,v_rep,v_visit,v_checkout_op,17.385,78.487,10);
 if (select count(*) from public.dcrs where tenant_id=v_tenant and visit_id=v_visit)<>1 then
  raise exception 'Checkout retry lost or duplicated DCR';end if;
 select public.admin_submit_tour_execution(v_tenant,v_rep,v_submit_op,'CI short day') into v_repeat;
 if v_repeat<>v_exec then raise exception 'Submitted wrong execution';end if;
 perform public.admin_submit_tour_execution(v_tenant,v_rep,v_submit_op,'CI short day');
 if not exists(select 1 from public.tour_executions where tenant_id=v_tenant and id=v_exec and status='SUBMITTED') then
  raise exception 'Tour submission did not persist';end if;
 perform set_config('request.jwt.claim.sub',v_mgr::text,true);
 select public.manager_analytics(v_tenant,7) into v_snapshot;
 if (v_snapshot#>>'{coverage,plannedStops}')::integer<>1
  or (v_snapshot#>>'{coverage,completedVisits}')::integer<>1
  or (v_snapshot#>>'{coverage,doctorCalls}')::integer<>1
  or (v_snapshot#>>'{tours,submitted}')::integer<>1
  or (v_snapshot#>>'{coverage,coveragePercent}')::numeric<>100 then
  raise exception 'Manager metrics do not reconcile with planned lifecycle';end if;
end;$$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$begin
 if (select count(*) from public.dcrs where tenant_id='f2000000-0000-4000-8000-000000000001')<>1 then
  raise exception 'MR cannot read persisted DCR';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.dcrs where tenant_id='f2000000-0000-4000-8000-000000000001') then
  raise exception 'Outsider can read persisted DCR';end if;
end;$$;
reset role;
rollback;
