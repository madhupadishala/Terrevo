begin;
-- Synthetic fixture for separate-connection races in a disposable CI database.
do $$begin
 if current_database()<>'terrevo_concurrency_ci' then raise exception 'Concurrency fixture requires terrevo_concurrency_ci';end if;
end;$$;
do $$
declare v_tenant uuid:='f4000000-0000-4000-8000-000000000001';
 v_rep uuid:='f4000000-0000-4000-8000-000000000002';
 v_mgr uuid:='f4000000-0000-4000-8000-000000000003';
 v_other uuid:='f4000000-0000-4000-8000-000000000004';
 v_org uuid:='f4000000-0000-4000-8000-000000000005';
 v_terr uuid:='f4000000-0000-4000-8000-000000000006';
 v_div uuid:='f4000000-0000-4000-8000-000000000018';
 v_zone uuid:='f4000000-0000-4000-8000-000000000019';
 v_region uuid:='f4000000-0000-4000-8000-000000000020';
 v_area uuid:='f4000000-0000-4000-8000-000000000021';
 v_emp uuid:='f4000000-0000-4000-8000-000000000007';
 v_mgr_emp uuid:='f4000000-0000-4000-8000-000000000008';
 v_doctor uuid:='f4000000-0000-4000-8000-000000000009';
 v_plan uuid:='f4000000-0000-4000-8000-000000000010';
 v_day uuid:='f4000000-0000-4000-8000-000000000011';
 v_exec uuid:='f4000000-0000-4000-8000-000000000012';
 v_op uuid:='f4000000-0000-4000-8000-000000000013';
 v_call uuid;v_repeat uuid;v_visit uuid;v_stop uuid;v_snapshot jsonb;
 v_date date:=(clock_timestamp() at time zone 'UTC')::date;
 v_start_op uuid:='f4000000-0000-4000-8000-000000000022';
 v_checkin_op uuid:='f4000000-0000-4000-8000-000000000023';
 v_checkout_op uuid:='f4000000-0000-4000-8000-000000000024';
 v_submit_op uuid:='f4000000-0000-4000-8000-000000000025';
begin
 insert into auth.users(id,email)values(v_rep,'ci-representative@example.invalid'),(v_mgr,'ci-manager@example.invalid'),(v_other,'ci-unassigned@example.invalid');
 insert into public.tenants(id,name,slug)values(v_tenant,'CI Planned Concurrency','ci-planned-concurrency');
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
end;$$;
commit;
