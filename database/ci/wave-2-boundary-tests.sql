begin;

-- Wave 2 qualification fixture.
insert into auth.users(id,email) values
  ('81000000-0000-4000-8000-000000000001','wave2@example.com'),
  ('81000000-0000-4000-8000-000000000002','wave2-manager@example.com')
on conflict do nothing;

insert into public.tenants(id,name,slug,status,time_zone,geofence_radius_meters,max_gps_accuracy_meters) values
  ('82000000-0000-4000-8000-000000000001','Wave Two','wave-two','active','Asia/Kolkata',100,50);

insert into public.tenant_memberships(tenant_id,user_id,status) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','active'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','active');

insert into public.organization_units(id,tenant_id,parent_id,type,code,name,status) values
  ('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',null,'company','W2CO','Wave 2 Company','active'),
  ('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','division','W2DIV','Wave 2 Division','active'),
  ('83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','zone','W2ZONE','Wave 2 Zone','active'),
  ('83000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','region','W2REG','Wave 2 Region','active'),
  ('83000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000004','area','W2AREA','Wave 2 Area','active'),
  ('83000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000005','territory','W2TER','Wave 2 Territory','active');

insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id,status) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','MR','83000000-0000-4000-8000-000000000006','active'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','MANAGER','83000000-0000-4000-8000-000000000005','active');

insert into public.user_org_assignments(tenant_id,user_id,org_unit_id,is_primary,status) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000006',true,'active'),
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000005',true,'active');

insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,status) values
  ('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','W2MR','Wave Two MR','MR','83000000-0000-4000-8000-000000000006','active'),
  ('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','W2MGR','Wave Two Manager','Manager','83000000-0000-4000-8000-000000000005','active');

insert into public.doctors(id,tenant_id,code,name,specialty,latitude,longitude,territory_id,status) values
  ('85000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','W2DR','Wave Two Doctor','General',17.4000,78.4800,'83000000-0000-4000-8000-000000000006','active');

insert into public.products(id,tenant_id,code,name,generic_name,division_id,status) values
  ('85000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','W2PR','Wave Two Product','Generic','83000000-0000-4000-8000-000000000002','active');

insert into public.samples(id,tenant_id,code,name,product_id,division_id,unit,status) values
  ('85000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','W2SM','Wave Two Sample','85000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','strip','active');

insert into public.tour_plans(id,tenant_id,employee_id,week_start,status,submitted_at,reviewed_at,reviewed_by) values
  ('86000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','2026-09-28','APPROVED',now(),now(),'81000000-0000-4000-8000-000000000002');

insert into public.tour_plan_days(id,tenant_id,tour_plan_id,plan_date,territory_id) values
  ('86000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','2026-10-01','83000000-0000-4000-8000-000000000006');

insert into public.tour_plan_stops(id,tenant_id,tour_plan_day_id,sequence_no,stop_type,doctor_id) values
  ('86000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002',1,'doctor','85000000-0000-4000-8000-000000000001');

insert into public.tour_executions(
  id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,
  started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters
) values(
  '87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000006',
  '2026-10-01','ACTIVE','87000000-0000-4000-8000-000000000002',
  now(),480,17.4000,78.4800,10
);

insert into public.field_visits(
  id,tenant_id,execution_id,plan_stop_id,territory_id,status,checkin_operation_id,
  checkin_latitude,checkin_longitude,checkin_accuracy_meters,target_latitude,target_longitude,
  distance_meters,geofence_radius_meters,verification,exception_reason,exception_status
) values(
  '88000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000006','CHECKED_IN','88000000-0000-4000-8000-000000000002',
  17.5000,78.5800,10,17.4000,78.4800,15000,100,'OUTSIDE_GEOFENCE','field exception','PENDING'
);

-- Sprint 6/8/9/10: client roles must never directly mutate governed tables.
do $$
begin
  if has_table_privilege('authenticated','public.tour_executions','INSERT') then
    raise exception 'TRV-EXEC security failed: authenticated can insert executions';
  end if;
  if has_table_privilege('authenticated','public.field_visits','UPDATE') then
    raise exception 'TRV-VIS security failed: authenticated can update visits';
  end if;
  if has_table_privilege('authenticated','public.doctor_calls','INSERT') then
    raise exception 'TRV-DCR security failed: authenticated can insert doctor calls';
  end if;
  if has_table_privilege('authenticated','public.inventory_balances','UPDATE') then
    raise exception 'TRV-INV security failed: authenticated can update balances';
  end if;
end
$$;

-- Sprint 6: a second ACTIVE execution for the same employee is prohibited.
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

-- Sprint 8: self-review of a GPS exception is prohibited.
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

-- Sprint 10: issue stock once, prove idempotent replay, reject payload mismatch, then reject over-return.
select public.admin_issue_inventory(
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  '89000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  'sample',
  '85000000-0000-4000-8000-000000000003',
  10
);

select public.admin_issue_inventory(
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  '89000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  'sample',
  '85000000-0000-4000-8000-000000000003',
  10
);

do $$
declare v_count integer; v_balance integer;
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
  if v_balance<>10 then raise exception 'TRV-INV-001/007 failed: expected balance 10, got %',v_balance; end if;
end
$$;

do $$
begin
  begin
    perform public.admin_issue_inventory(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000002',
      '89000000-0000-4000-8000-000000000001',
      '84000000-0000-4000-8000-000000000001',
      'sample',
      '85000000-0000-4000-8000-000000000003',
      11
    );
    raise exception 'TRV-INV-007 failed: mismatched idempotency replay succeeded';
  exception
    when others then
      if position('idempotency key reused with different inventory payload' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

do $$
begin
  begin
    perform public.admin_return_inventory(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001',
      '89000000-0000-4000-8000-000000000002',
      'sample',
      '85000000-0000-4000-8000-000000000003',
      11
    );
    raise exception 'TRV-INV-008 failed: over-return succeeded';
  exception
    when others then
      if position('insufficient inventory balance' in sqlerrm)=0 then raise; end if;
  end;
end
$$;

rollback;
