begin;
-- Full field execution qualification on real PostgreSQL primitives.
-- Fixtures are transaction-scoped and rolled back.
do $field$
declare
 t uuid:='b3000000-0000-4000-8000-000000000001';
 mr uuid:='b3000000-0000-4000-8000-000000000002';
 mgr uuid:='b3000000-0000-4000-8000-000000000003';
 outsider uuid:='b3000000-0000-4000-8000-000000000004';
 company uuid:='b3000000-0000-4000-8000-000000000005';
 division uuid:='b3000000-0000-4000-8000-000000000006';
 zone uuid:='b3000000-0000-4000-8000-000000000007';
 region uuid:='b3000000-0000-4000-8000-000000000008';
 area uuid:='b3000000-0000-4000-8000-000000000009';
 territory uuid:='b3000000-0000-4000-8000-000000000010';
 mr_emp uuid:='b3000000-0000-4000-8000-000000000011';
 mgr_emp uuid:='b3000000-0000-4000-8000-000000000012';
 doctor uuid:='b3000000-0000-4000-8000-000000000013';
 start_op uuid:='b3000000-0000-4000-8000-000000000014';
 checkin_op uuid:='b3000000-0000-4000-8000-000000000015';
 call_op uuid:='b3000000-0000-4000-8000-000000000016';
 checkout_op uuid:='b3000000-0000-4000-8000-000000000017';
 submit_op uuid:='b3000000-0000-4000-8000-000000000018';
 v_plan uuid; v_day uuid; v_stop uuid; v_exec uuid; v_visit uuid; v_call uuid;
 monday date:=date_trunc('week',current_date)::date;
begin
 insert into auth.users(id,email) values
 (mr,'ci-field-mr@example.invalid'),(mgr,'ci-field-manager@example.invalid'),(outsider,'ci-field-outsider@example.invalid');
 insert into public.tenants(id,name,slug,time_zone) values(t,'CI Field Execution','ci-field-execution','UTC');
 insert into public.tenant_memberships(tenant_id,user_id) values(t,mr),(t,mgr);
 insert into public.organization_units(id,tenant_id,type,code,name) values(company,t,'company','CI_COMPANY','CI Company');
 insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 (division,t,company,'division','CI_DIV','CI Division'),
 (zone,t,division,'zone','CI_ZONE','CI Zone'),
 (region,t,zone,'region','CI_REGION','CI Region'),
 (area,t,region,'area','CI_AREA','CI Area'),
 (territory,t,area,'territory','CI_TERR','CI Territory');
 insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id) values
 (t,mr,'MR',territory),(t,mgr,'MANAGER',territory);
 insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id) values
 (mr_emp,t,mr,'CI_MR','CI Representative','MR',territory),
 (mgr_emp,t,mgr,'CI_MGR','CI Manager','Manager',territory);
 insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,latitude,longitude) values
 (doctor,t,'CI_DOC','CI Doctor','General Medicine',territory,17.385,78.4867);

 v_plan:=public.admin_save_tour_plan(t,mr,null,monday,
   jsonb_build_array(jsonb_build_object(
     'date',current_date::text,'territoryId',territory::text,'remarks','Approved daily plan',
     'stops',jsonb_build_array(jsonb_build_object('sequence',1,'type','doctor','targetId',doctor::text,'remarks','Priority'))
   )));
 perform public.admin_submit_tour_plan(t,mr,v_plan);
 perform public.admin_decide_tour_plan(t,mgr,v_plan,'APPROVE',null);
 select id into v_day from public.tour_plan_days where tenant_id=t and tour_plan_id=v_plan and plan_date=current_date;
 select id into v_stop from public.tour_plan_stops where tenant_id=t and tour_plan_day_id=v_day and doctor_id=doctor;

 v_exec:=public.admin_start_tour(t,mr,start_op,v_day,clock_timestamp(),17.385,78.4867,8.0,'ci-device','wifi','terrevo-ci');
 if not exists(select 1 from public.tour_executions e where e.tenant_id=t and e.id=v_exec and e.status='ACTIVE')
 then raise exception 'Start My Day failed'; end if;

 v_visit:=public.admin_checkin_visit(t,mr,checkin_op,v_stop,17.385,78.4867,8.0,null);
 if not exists(select 1 from public.field_visits fv where fv.tenant_id=t and fv.id=v_visit and fv.status='CHECKED_IN' and fv.verification='VERIFIED')
 then raise exception 'planned GPS check-in failed'; end if;

 begin
  perform public.admin_submit_tour_execution(t,mr,submit_op,'short');
  raise exception 'open visit allowed End My Day';
 exception when others then
  if sqlerrm='open visit allowed End My Day' then raise; end if;
 end;

 begin
  perform public.admin_checkout_visit(t,mr,v_visit,checkout_op,17.385,78.4867,8.0);
  raise exception 'doctor checkout without call allowed';
 exception when others then
  if sqlerrm='doctor checkout without call allowed' then raise; end if;
 end;

 v_call:=public.admin_save_doctor_call(t,mr,v_visit,call_op,'Detailed','CI discussion',null,'[]'::jsonb);
 if v_call is null then raise exception 'doctor call save failed'; end if;
 perform public.admin_checkout_visit(t,mr,v_visit,checkout_op,17.385,78.4867,8.0);

 if not exists(select 1 from public.dcrs d where d.tenant_id=t and d.visit_id=v_visit and d.status='SUBMITTED' and d.call_outcome='Detailed')
 then raise exception 'automatic DCR missing'; end if;

 perform public.admin_submit_tour_execution(t,mr,submit_op,'Controlled CI short day');
 if not exists(select 1 from public.tour_executions e where e.tenant_id=t and e.id=v_exec and e.status='SUBMITTED' and e.submitted_at is not null)
 then raise exception 'End My Day failed'; end if;

 perform set_config('request.jwt.claim.sub',mr::text,true);
 set local role authenticated;
 if (select count(*) from public.tour_executions e where e.tenant_id=t and e.id=v_exec)<>1
    or (select count(*) from public.dcrs d where d.tenant_id=t and d.visit_id=v_visit)<>1
 then raise exception 'MR cannot read own execution/DCR'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub',mgr::text,true);
 set local role authenticated;
 if (select count(*) from public.tour_executions e where e.tenant_id=t and e.id=v_exec)<>1
    or (select count(*) from public.field_visits fv where fv.tenant_id=t and fv.id=v_visit)<>1
    or (select count(*) from public.dcrs d where d.tenant_id=t and d.visit_id=v_visit)<>1
 then raise exception 'manager cannot read scoped team execution evidence'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub',outsider::text,true);
 set local role authenticated;
 if exists(select 1 from public.tour_executions e where e.tenant_id=t and e.id=v_exec)
    or exists(select 1 from public.field_visits fv where fv.tenant_id=t and fv.id=v_visit)
    or exists(select 1 from public.dcrs d where d.tenant_id=t and d.visit_id=v_visit)
 then raise exception 'outsider crossed field execution boundary'; end if;
 reset role;
end;$field$;
rollback;
