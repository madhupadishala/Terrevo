begin;

-- Wave 1 qualification fixtures: two isolated tenants and one authenticated user in each.
insert into auth.users(id,email) values
  ('10000000-0000-4000-8000-000000000001','wave1-a@example.com'),
  ('10000000-0000-4000-8000-000000000002','wave1-b@example.com')
on conflict do nothing;

insert into public.tenants(id,name,slug,status) values
  ('20000000-0000-4000-8000-000000000001','Wave One A','wave-one-a','active'),
  ('20000000-0000-4000-8000-000000000002','Wave One B','wave-one-b','active');

insert into public.tenant_memberships(tenant_id,user_id,status) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','active'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','active');

-- Minimal valid organization trees for each tenant.
insert into public.organization_units(id,tenant_id,parent_id,type,code,name,status) values
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',null,'company','A_CO','A Company','active'),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','division','A_DIV','A Division','active'),
  ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','zone','A_ZONE','A Zone','active'),
  ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','region','A_REG','A Region','active'),
  ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','area','A_AREA','A Area','active'),
  ('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005','territory','A_TER','A Territory','active'),
  ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',null,'company','B_CO','B Company','active'),
  ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','division','B_DIV','B Division','active'),
  ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','zone','B_ZONE','B Zone','active'),
  ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','region','B_REG','B Region','active'),
  ('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004','area','B_AREA','B Area','active'),
  ('40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000005','territory','B_TER','B Territory','active');

insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id,status) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','TENANT_ADMIN',null,'active'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','TENANT_ADMIN',null,'active');

insert into public.user_org_assignments(tenant_id,user_id,org_unit_id,is_primary,status) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006',true,'active'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000006',true,'active');

insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,status) values
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','EMP_A','Employee A','MR','30000000-0000-4000-8000-000000000006','active'),
  ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','EMP_B','Employee B','MR','40000000-0000-4000-8000-000000000006','active');

insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,status) values
  ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','DR_A','Doctor A','General','30000000-0000-4000-8000-000000000006','active'),
  ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','DR_B','Doctor B','General','40000000-0000-4000-8000-000000000006','active');

insert into public.tour_plans(id,tenant_id,employee_id,week_start,status,submitted_at) values
  ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','2026-10-05','SUBMITTED',now()),
  ('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','2026-10-05','SUBMITTED',now());

-- Privilege checks: authenticated application users are read-only on protected Wave 1 tables.
do $$
begin
  if has_table_privilege('authenticated','public.tenants','INSERT') then
    raise exception 'TRV-TENANT-004 failed: authenticated can insert tenants';
  end if;
  if has_table_privilege('authenticated','public.tenant_memberships','UPDATE') then
    raise exception 'TRV-TENANT-004 failed: authenticated can update memberships';
  end if;
  if has_table_privilege('authenticated','public.organization_units','INSERT') then
    raise exception 'TRV-RBAC-005 failed: authenticated can directly insert organization units';
  end if;
  if has_table_privilege('authenticated','public.doctors','INSERT') then
    raise exception 'TRV-MST-007 failed: authenticated can directly insert doctors';
  end if;
end
$$;

-- Exercise RLS as tenant A's authenticated user.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

do $$
declare
  tenant_count integer;
  org_cross integer;
  doctor_cross integer;
  plan_cross integer;
begin
  select count(*) into tenant_count from public.tenants;
  if tenant_count <> 1 then
    raise exception 'TRV-TENANT-003 failed: expected 1 visible tenant, got %', tenant_count;
  end if;

  select count(*) into org_cross
    from public.organization_units
   where tenant_id='20000000-0000-4000-8000-000000000002';
  if org_cross <> 0 then
    raise exception 'TRV-ORG-004/RBAC-004 failed: cross-tenant organization rows visible';
  end if;

  select count(*) into doctor_cross
    from public.doctors
   where tenant_id='20000000-0000-4000-8000-000000000002';
  if doctor_cross <> 0 then
    raise exception 'TRV-MST-006 failed: cross-tenant master rows visible';
  end if;

  select count(*) into plan_cross
    from public.tour_plans
   where tenant_id='20000000-0000-4000-8000-000000000002';
  if plan_cross <> 0 then
    raise exception 'TRV-TOURPLAN security failed: cross-tenant tour plan visible';
  end if;
end
$$;

reset role;

-- Sprint 5: owner must never be able to approve own submitted plan.
do $$
begin
  begin
    perform public.admin_decide_tour_plan(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      'APPROVE',
      null
    );
    raise exception 'TRV-APR-005 failed: self approval unexpectedly succeeded';
  exception
    when others then
      if position('self approval is not allowed' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end
$$;

rollback;
