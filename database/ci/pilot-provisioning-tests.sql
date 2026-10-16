begin;

do $$
declare
  v_actor uuid := '10000000-0000-4000-8000-000000000001';
  v_admin uuid := '10000000-0000-4000-8000-000000000002';
  v_mgr uuid := '10000000-0000-4000-8000-000000000003';
  v_mr uuid := '10000000-0000-4000-8000-000000000004';
  v_result jsonb;
  v_tenant uuid;
  v_territory uuid;
  v_manager_employee uuid;
  n integer;
begin
  insert into auth.users(id,email) values
    (v_actor,'pilot-actor@example.invalid'),
    (v_admin,'pilot-admin@example.invalid'),
    (v_mgr,'pilot-manager@example.invalid'),
    (v_mr,'pilot-mr@example.invalid');

  insert into public.platform_admin_grants(user_id,active,grant_note)
  values(v_actor,true,'CI pilot provisioning');

  select public.pilot_initialize_tenant(
    v_actor,'Pilot Pharma','pilot-pharma-ci',v_admin,v_mgr,v_mr,
    jsonb_build_object(
      'company',jsonb_build_object('code','PILOT_CO','name','Pilot Company'),
      'division',jsonb_build_object('code','PILOT_DIV','name','Pilot Division'),
      'zone',jsonb_build_object('code','PILOT_ZONE','name','Pilot Zone'),
      'region',jsonb_build_object('code','PILOT_REG','name','Pilot Region'),
      'area',jsonb_build_object('code','PILOT_AREA','name','Pilot Area'),
      'territory',jsonb_build_object('code','PILOT_TER','name','Pilot Territory')
    ),
    jsonb_build_object('employeeCode','PILOT_MGR_01','name','Pilot Manager'),
    jsonb_build_object('employeeCode','PILOT_MR_01','name','Pilot MR')
  ) into v_result;

  v_tenant := (v_result->>'tenantId')::uuid;
  v_territory := (v_result->>'territoryId')::uuid;
  v_manager_employee := (v_result->>'managerEmployeeId')::uuid;

  select count(*) into n from public.organization_units where tenant_id=v_tenant;
  if n<>6 then raise exception 'Expected 6 hierarchy nodes, got %',n;end if;

  select count(*) into n from public.tenant_memberships where tenant_id=v_tenant and status='active';
  if n<>3 then raise exception 'Expected 3 memberships, got %',n;end if;

  select count(*) into n from public.user_role_assignments where tenant_id=v_tenant and status='active';
  if n<>3 then raise exception 'Expected 3 active roles, got %',n;end if;

  select count(*) into n from public.employees
   where tenant_id=v_tenant and user_id=v_mr and org_unit_id=v_territory
     and reporting_manager_employee_id=v_manager_employee;
  if n<>1 then raise exception 'MR reporting tree was not created';end if;

  begin
    perform public.pilot_initialize_tenant(
      v_actor,'Broken Pilot','broken-pilot-ci',v_admin,v_mgr,v_mr,
      jsonb_build_object(
        'company',jsonb_build_object('code','BROKEN_CO','name','Broken Company'),
        'division',jsonb_build_object('code','BROKEN_DIV','name','Broken Division'),
        'zone',jsonb_build_object('code','BROKEN_ZONE','name','Broken Zone'),
        'region',jsonb_build_object('code','BROKEN_REG','name','Broken Region'),
        'area',jsonb_build_object('code','BROKEN_AREA','name','Broken Area'),
        'territory',jsonb_build_object('code','BROKEN_TER','name','Broken Territory')
      ),
      jsonb_build_object('employeeCode','BROKEN_MGR','name','Broken Manager'),
      jsonb_build_object('employeeCode','BROKEN_MR','name','Broken MR')
    );
    raise exception 'Expected active-membership preflight conflict';
  exception when unique_violation then
    null;
  end;

  select count(*) into n from public.tenants where slug='broken-pilot-ci';
  if n<>0 then raise exception 'Failed pilot initialization left orphan tenant';end if;
end$$;

rollback;
