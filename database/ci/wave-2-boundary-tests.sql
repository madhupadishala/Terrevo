begin;

-- Wave 2 qualification: two isolated tenants prove authorized reads work while cross-tenant reads remain invisible.
insert into auth.users(id,email) values
  ('81000000-0000-4000-8000-000000000001','wave2-a-mr@example.com'),
  ('81000000-0000-4000-8000-000000000002','wave2-a-manager@example.com'),
  ('81000000-0000-4000-8000-000000000003','wave2-b-mr@example.com'),
  ('81000000-0000-4000-8000-000000000004','wave2-b-manager@example.com')
on conflict do nothing;

insert into public.tenants(id,name,slug,status,time_zone,geofence_radius_meters,max_gps_accuracy_meters) values
  ('82000000-0000-4000-8000-000000000001','Wave Two A','wave-two-a','active','Asia/Kolkata',100,50),
  ('82000000-0000-4000-8000-000000000002','Wave Two B','wave-two-b','active','Asia/Kolkata',100,50);

insert into public.tenant_memberships(tenant_id,user_id,status) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','active'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','active'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','active'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004','active');

-- Mirror the full organization hierarchy in both tenants so scope checks are realistic.
insert into public.organization_units(id,tenant_id,parent_id,type,code,name,status) values
  ('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',null,'company','A_CO','A Company','active'),
  ('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','division','A_DIV','A Division','active'),
  ('83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','zone','A_ZONE','A Zone','active'),
  ('83000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','region','A_REG','A Region','active'),
  ('83000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000004','area','A_AREA','A Area','active'),
  ('83000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000005','territory','A_TER','A Territory','active'),
  ('93000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002',null,'company','B_CO','B Company','active'),
  ('93000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','division','B_DIV','B Division','active'),
  ('93000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','zone','B_ZONE','B Zone','active'),
  ('93000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','region','B_REG','B Region','active'),
  ('93000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000004','area','B_AREA','B Area','active'),
  ('93000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000005','territory','B_TER','B Territory','active');

insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id,status) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','MR','83000000-0000-4000-8000-000000000006','active'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','MANAGER','83000000-0000-4000-8000-000000000005','active'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','MR','93000000-0000-4000-8000-000000000006','active'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004','MANAGER','93000000-0000-4000-8000-000000000005','active');

insert into public.user_org_assignments(tenant_id,user_id,org_unit_id,is_primary,status) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000006',true,'active'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000005',true,'active'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000006',true,'active'),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004','93000000-0000-4000-8000-000000000005',true,'active');

insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,status) values
  ('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','A_MR','A MR','MR','83000000-0000-4000-8000-000000000006','active'),
  ('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','A_MGR','A Manager','Manager','83000000-0000-4000-8000-000000000005','active'),
  ('94000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','B_MR','B MR','MR','93000000-0000-4000-8000-000000000006','active'),
  ('94000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004','B_MGR','B Manager','Manager','93000000-0000-4000-8000-000000000005','active');

insert into public.doctors(id,tenant_id,code,name,specialty,latitude,longitude,territory_id,status) values
  ('85000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','A_DR','A Doctor','General',17.4000,78.4800,'83000000-0000-4000-8000-000000000006','active'),
  ('95000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','B_DR','B Doctor','General',17.4100,78.4900,'93000000-0000-4000-8000-000000000006','active');

insert into public.products(id,tenant_id,code,name,generic_name,division_id,status) values
  ('85000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','A_PR','A Product','Generic A','83000000-0000-4000-8000-000000000002','active'),
  ('95000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','B_PR','B Product','Generic B','93000000-0000-4000-8000-000000000002','active');

insert into public.samples(id,tenant_id,code,name,product_id,division_id,unit,status) values
  ('85000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','A_SM','A Sample','85000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','strip','active'),
  ('95000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000002','B_SM','B Sample','95000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','strip','active');

insert into public.tour_plans(id,tenant_id,employee_id,week_start,status,submitted_at,reviewed_at,reviewed_by) values
  ('86000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','2026-09-28','APPROVED',now(),now(),'81000000-0000-4000-8000-000000000002'),
  ('96000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000001','2026-09-28','APPROVED',now(),now(),'81000000-0000-4000-8000-000000000004');

insert into public.tour_plan_days(id,tenant_id,tour_plan_id,plan_date,territory_id) values
  ('86000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','2026-10-01','83000000-0000-4000-8000-000000000006'),
  ('96000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','2026-10-01','93000000-0000-4000-8000-000000000006');

insert into public.tour_plan_stops(id,tenant_id,tour_plan_day_id,sequence_no,stop_type,doctor_id) values
  ('86000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002',1,'doctor','85000000-0000-4000-8000-000000000001'),
  ('96000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000002',1,'doctor','95000000-0000-4000-8000-000000000001');

insert into public.tour_executions(
  id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,
  started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters
) values
  ('87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000006','2026-10-01','ACTIVE','87000000-0000-4000-8000-000000000002',now(),480,17.4000,78.4800,10),
  ('97000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000006','2026-10-01','ACTIVE','97000000-0000-4000-8000-000000000002',now(),480,17.4100,78.4900,10);

insert into public.field_visits(
  id,tenant_id,execution_id,plan_stop_id,territory_id,status,checkin_operation_id,
  checkin_latitude,checkin_longitude,checkin_accuracy_meters,target_latitude,target_longitude,
  distance_meters,geofence_radius_meters,verification,exception_reason,exception_status
) values
  ('88000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000006','CHECKED_IN','88000000-0000-4000-8000-000000000002',17.5000,78.5800,10,17.4000,78.4800,15000,100,'OUTSIDE_GEOFENCE','field exception','PENDING'),
  ('98000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000006','CHECKED_IN','98000000-0000-4000-8000-000000000002',17.5100,78.5900,10,17.4100,78.4900,15000,100,'OUTSIDE_GEOFENCE','field exception','PENDING');

-- Seed inventory through the governed service entrypoint for each tenant.
select public.admin_issue_inventory('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','89000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','sample','85000000-0000-4000-8000-000000000003',10);
select public.admin_issue_inventory('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004','99000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','sample','95000000-0000-4000-8000-000000000003',7);

-- Client role may read governed projections only. It must not receive direct writes on any Wave 2 state table.
do $$
declare
  v_table text;
  v_privilege text;
begin
  foreach v_table in array array[
    'tour_executions','field_visits','doctor_calls','doctor_call_products','dcrs','dcr_products',
    'inventory_balances','inventory_operations','inventory_ledger','visit_distributions','dcr_distributions'
  ]
  loop
    foreach v_privilege in array array['INSERT','UPDATE','DELETE']
    loop
      if has_table_privilege('authenticated','public.'||v_table,v_privilege) then
        raise exception 'Wave 2 security failed: authenticated has % on %',v_privilege,v_table;
      end if;
    end loop;
  end loop;
end
$$;

-- Service-only mutation entrypoints must not be executable by the client role.
do $$
begin
  if has_function_privilege('authenticated','public.admin_start_tour(uuid,uuid,uuid,uuid,timestamptz,double precision,double precision,double precision,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_checkin_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_checkout_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_review_visit_exception(uuid,uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_save_doctor_call(uuid,uuid,uuid,uuid,text,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_issue_inventory(uuid,uuid,uuid,uuid,text,uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_return_inventory(uuid,uuid,uuid,text,uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_distribute_visit_inventory(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
  then
    raise exception 'Wave 2 security failed: authenticated can execute a service-only mutation entrypoint';
  end if;
end
$$;

-- Tenant A MR must see its own execution/visit/inventory and must see zero Tenant B rows.
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$
declare
  own_count integer;
  cross_count integer;
begin
  select count(*) into own_count from public.tour_executions where tenant_id='82000000-0000-4000-8000-000000000001';
  if own_count<>1 then raise exception 'TRV-EXEC tenant scope failed: own execution not visible'; end if;
  select count(*) into cross_count from public.tour_executions where tenant_id='82000000-0000-4000-8000-000000000002';
  if cross_count<>0 then raise exception 'TRV-EXEC tenant scope failed: cross-tenant execution visible'; end if;

  select count(*) into own_count from public.field_visits where tenant_id='82000000-0000-4000-8000-000000000001';
  if own_count<>1 then raise exception 'TRV-VIS tenant scope failed: own visit not visible'; end if;
  select count(*) into cross_count from public.field_visits where tenant_id='82000000-0000-4000-8000-000000000002';
  if cross_count<>0 then raise exception 'TRV-VIS tenant scope failed: cross-tenant visit visible'; end if;

  select count(*) into own_count from public.inventory_balances where tenant_id='82000000-0000-4000-8000-000000000001';
  if own_count<>1 then raise exception 'TRV-INV tenant scope failed: own inventory not visible'; end if;
  select count(*) into cross_count from public.inventory_balances where tenant_id='82000000-0000-4000-8000-000000000002';
  if cross_count<>0 then raise exception 'TRV-INV tenant scope failed: cross-tenant inventory visible'; end if;
end
$$;
reset role;

-- Cross-tenant write abuse: service-role entrypoints must reject mixed tenant identifiers
-- and must not mutate Tenant B state.

-- Inventory issue: Tenant A manager cannot target a Tenant B employee/sample.
do $
declare
  v_b_balance_before integer;
  v_b_ledger_before integer;
  v_b_balance_after integer;
  v_b_ledger_after integer;
begin
  select quantity into v_b_balance_before
    from public.inventory_balances
   where tenant_id='82000000-0000-4000-8000-000000000002'
     and employee_id='94000000-0000-4000-8000-000000000001'
     and sample_id='95000000-0000-4000-8000-000000000003';

  select count(*) into v_b_ledger_before
    from public.inventory_ledger
   where tenant_id='82000000-0000-4000-8000-000000000002';

  begin
    perform public.admin_issue_inventory(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000002',
      '89000000-0000-4000-8000-000000000010',
      '94000000-0000-4000-8000-000000000001',
      'sample',
      '95000000-0000-4000-8000-000000000003',
      1
    );
    raise exception 'TRV-INV tenant escape failed: cross-tenant issue succeeded';
  exception
    when others then
      if position('active employee not found' in sqlerrm)=0 then raise; end if;
  end;

  select quantity into v_b_balance_after
    from public.inventory_balances
   where tenant_id='82000000-0000-4000-8000-000000000002'
     and employee_id='94000000-0000-4000-8000-000000000001'
     and sample_id='95000000-0000-4000-8000-000000000003';

  select count(*) into v_b_ledger_after
    from public.inventory_ledger
   where tenant_id='82000000-0000-4000-8000-000000000002';

  if v_b_balance_after is distinct from v_b_balance_before or v_b_ledger_after<>v_b_ledger_before then
    raise exception 'TRV-INV tenant escape failed: Tenant B inventory changed after rejected cross-tenant issue';
  end if;
end
$;

-- GPS exception review: Tenant A manager cannot review a Tenant B visit.
do $
declare
  v_before text;
  v_after text;
begin
  select exception_status into v_before
    from public.field_visits
   where tenant_id='82000000-0000-4000-8000-000000000002'
     and id='98000000-0000-4000-8000-000000000001';

  begin
    perform public.admin_review_visit_exception(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000002',
      '98000000-0000-4000-8000-000000000001',
      'APPROVE',
      null
    );
    raise exception 'TRV-VIS tenant escape failed: cross-tenant review succeeded';
  exception
    when others then
      if position('pending GPS exception not found' in sqlerrm)=0 then raise; end if;
  end;

  select exception_status into v_after
    from public.field_visits
   where tenant_id='82000000-0000-4000-8000-000000000002'
     and id='98000000-0000-4000-8000-000000000001';

  if v_after is distinct from v_before or v_after is distinct from 'PENDING' then
    raise exception 'TRV-VIS tenant escape failed: Tenant B visit changed after rejected cross-tenant review';
  end if;
end
$;

-- Inventory return: Tenant A MR cannot return a Tenant B sample.
do $
declare
  v_b_balance_before integer;
  v_b_ledger_before integer;
  v_b_balance_after integer;
  v_b_ledger_after integer;
begin
  select quantity into v_b_balance_before
    from public.inventory_balances
   where tenant_id='82000000-0000-4000-8000-000000000002'
     and employee_id='94000000-0000-4000-8000-000000000001'
     and sample_id='95000000-0000-4000-8000-000000000003';

  select count(*) into v_b_ledger_before
    from public.inventory_ledger
   where tenant_id='82000000-0000-4000-8000-000000000002';

  begin
    perform public.admin_return_inventory(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001',
      '89000000-0000-4000-8000-000000000011',
      'sample',
      '95000000-0000-4000-8000-000000000003',
      1
    );
    raise exception 'TRV-INV tenant escape failed: cross-tenant return succeeded';
  exception
    when others then
      if position('insufficient inventory balance' in sqlerrm)=0 then raise; end if;
  end;

  select quantity into v_b_balance_after
    from public.inventory_balances
   where tenant_id='82000000-0000-4000-8000-000000000002'
     and employee_id='94000000-0000-4000-8000-000000000001'
     and sample_id='95000000-0000-4000-8000-000000000003';

  select count(*) into v_b_ledger_after
    from public.inventory_ledger
   where tenant_id='82000000-0000-4000-8000-000000000002';

  if v_b_balance_after is distinct from v_b_balance_before or v_b_ledger_after<>v_b_ledger_before then
    raise exception 'TRV-INV tenant escape failed: Tenant B inventory changed after rejected cross-tenant return';
  end if;
end
$;

-- Sprint 6: second ACTIVE execution for the same employee is prohibited.
do $$
begin
  begin
    insert into public.tour_executions(
      tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,
      started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters
    ) values(
      '82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',
      '86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002',
      '83000000-0000-4000-8000-000000000006','2026-10-02','ACTIVE',
      '87000000-0000-4000-8000-000000000003',now(),480,17.4,78.48,10
    );
    raise exception 'TRV-EXEC-003 failed: second ACTIVE execution unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end
$$;

-- Sprint 8: owner cannot self-review their GPS exception.
do $$
begin
  begin
    perform public.admin_review_visit_exception(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001',
      '88000000-0000-4000-8000-000000000001',
      'APPROVE',
      null
    );
    raise exception 'TRV-VIS-008 failed: self review unexpectedly succeeded';
  exception
    when others then
      if position('self review is not allowed' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

-- Sprint 10: idempotent replay produces one ledger event and unchanged balance.
select public.admin_issue_inventory('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','89000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','sample','85000000-0000-4000-8000-000000000003',10);

do $$
declare
  v_count integer;
  v_balance integer;
begin
  select count(*) into v_count from public.inventory_ledger
   where tenant_id='82000000-0000-4000-8000-000000000001'
     and employee_id='84000000-0000-4000-8000-000000000001'
     and sample_id='85000000-0000-4000-8000-000000000003'
     and event_type='ISSUE';
  if v_count<>1 then raise exception 'TRV-INV-007 failed: replay created % issue ledger rows',v_count; end if;

  select quantity into v_balance from public.inventory_balances
   where tenant_id='82000000-0000-4000-8000-000000000001'
     and employee_id='84000000-0000-4000-8000-000000000001'
     and sample_id='85000000-0000-4000-8000-000000000003';
  if v_balance is distinct from 10 then raise exception 'TRV-INV-001/007 failed: expected balance 10, got %',v_balance; end if;
end
$$;

-- Same operation UUID with different payload must fail.
do $$
begin
  begin
    perform public.admin_issue_inventory(
      '82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002',
      '89000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001',
      'sample','85000000-0000-4000-8000-000000000003',11
    );
    raise exception 'TRV-INV-007 failed: mismatched idempotency replay succeeded';
  exception
    when others then
      if position('idempotency key reused with different inventory payload' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

-- Returning more than available balance must fail and balance remains non-negative.
do $$
begin
  begin
    perform public.admin_return_inventory(
      '82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',
      '89000000-0000-4000-8000-000000000002','sample','85000000-0000-4000-8000-000000000003',11
    );
    raise exception 'TRV-INV-008 failed: over-return succeeded';
  exception
    when others then
      if position('insufficient inventory balance' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

do $$
begin
  if exists(select 1 from public.inventory_balances where quantity<0) then
    raise exception 'TRV-INV-001/008 failed: negative balance exists';
  end if;
end
$$;

rollback;
