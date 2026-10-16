begin;

create or replace function public.pilot_initialize_tenant(
  p_actor_user_id uuid,
  p_tenant_name text,
  p_tenant_slug text,
  p_tenant_admin_user_id uuid,
  p_manager_user_id uuid,
  p_mr_user_id uuid,
  p_hierarchy jsonb,
  p_manager jsonb,
  p_mr jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := extensions.gen_random_uuid();
  v_company_id uuid := extensions.gen_random_uuid();
  v_division_id uuid := extensions.gen_random_uuid();
  v_zone_id uuid := extensions.gen_random_uuid();
  v_region_id uuid := extensions.gen_random_uuid();
  v_area_id uuid := extensions.gen_random_uuid();
  v_territory_id uuid := extensions.gen_random_uuid();
  v_manager_employee_id uuid := extensions.gen_random_uuid();
  v_mr_employee_id uuid := extensions.gen_random_uuid();
  v_manager_code text := upper(trim(p_manager->>'employeeCode'));
  v_manager_name text := trim(p_manager->>'name');
  v_mr_code text := upper(trim(p_mr->>'employeeCode'));
  v_mr_name text := trim(p_mr->>'name');
begin
  if not exists (
    select 1 from public.platform_admin_grants
    where user_id=p_actor_user_id and active=true
  ) then
    raise exception 'Platform permission denied' using errcode='42501';
  end if;

  if p_tenant_name is null or length(trim(p_tenant_name)) not between 2 and 160
     or p_tenant_slug is null or p_tenant_slug !~ '^[a-z0-9][a-z0-9-]{2,49}$' then
    raise exception 'Invalid pilot tenant identity' using errcode='22023';
  end if;

  if p_tenant_admin_user_id is null or p_manager_user_id is null or p_mr_user_id is null
     or p_tenant_admin_user_id=p_manager_user_id or p_tenant_admin_user_id=p_mr_user_id
     or p_manager_user_id=p_mr_user_id then
    raise exception 'Pilot users must be three distinct Auth identities' using errcode='22023';
  end if;

  if exists (
    select 1 from public.tenant_memberships
    where user_id in (p_tenant_admin_user_id,p_manager_user_id,p_mr_user_id)
      and status='active'
  ) then
    raise exception 'Pilot user already has an active tenant membership' using errcode='23505';
  end if;

  if v_manager_code !~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'
     or v_mr_code !~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'
     or length(v_manager_name) not between 2 and 160
     or length(v_mr_name) not between 2 and 160 then
    raise exception 'Invalid pilot employee identity' using errcode='22023';
  end if;

  insert into public.tenants(id,name,slug,status)
  values(v_tenant_id,trim(p_tenant_name),p_tenant_slug,'active');

  insert into public.organization_units(id,tenant_id,parent_id,type,code,name,status) values
    (v_company_id,v_tenant_id,null,'company',upper(trim(p_hierarchy->'company'->>'code')),trim(p_hierarchy->'company'->>'name'),'active'),
    (v_division_id,v_tenant_id,v_company_id,'division',upper(trim(p_hierarchy->'division'->>'code')),trim(p_hierarchy->'division'->>'name'),'active'),
    (v_zone_id,v_tenant_id,v_division_id,'zone',upper(trim(p_hierarchy->'zone'->>'code')),trim(p_hierarchy->'zone'->>'name'),'active'),
    (v_region_id,v_tenant_id,v_zone_id,'region',upper(trim(p_hierarchy->'region'->>'code')),trim(p_hierarchy->'region'->>'name'),'active'),
    (v_area_id,v_tenant_id,v_region_id,'area',upper(trim(p_hierarchy->'area'->>'code')),trim(p_hierarchy->'area'->>'name'),'active'),
    (v_territory_id,v_tenant_id,v_area_id,'territory',upper(trim(p_hierarchy->'territory'->>'code')),trim(p_hierarchy->'territory'->>'name'),'active');

  insert into public.tenant_memberships(tenant_id,user_id,status) values
    (v_tenant_id,p_tenant_admin_user_id,'active'),
    (v_tenant_id,p_manager_user_id,'active'),
    (v_tenant_id,p_mr_user_id,'active');

  insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id,status) values
    (v_tenant_id,p_tenant_admin_user_id,'TENANT_ADMIN',null,'active'),
    (v_tenant_id,p_manager_user_id,'MANAGER',v_territory_id,'active'),
    (v_tenant_id,p_mr_user_id,'MR',v_territory_id,'active');

  insert into public.user_org_assignments(tenant_id,user_id,org_unit_id,is_primary,status) values
    (v_tenant_id,p_manager_user_id,v_territory_id,true,'active'),
    (v_tenant_id,p_mr_user_id,v_territory_id,true,'active');

  insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,reporting_manager_employee_id,status)
  values(v_manager_employee_id,v_tenant_id,p_manager_user_id,v_manager_code,v_manager_name,'Manager',v_territory_id,null,'active');

  insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,reporting_manager_employee_id,status)
  values(v_mr_employee_id,v_tenant_id,p_mr_user_id,v_mr_code,v_mr_name,'Medical Representative',v_territory_id,v_manager_employee_id,'active');

  insert into public.platform_admin_audit(actor_user_id,action,tenant_id,details)
  values(p_actor_user_id,'TENANT_CREATED',v_tenant_id,
    jsonb_build_object('slug',p_tenant_slug,'source','pilot_initialize_tenant'));

  return jsonb_build_object(
    'tenantId',v_tenant_id,
    'companyId',v_company_id,
    'divisionId',v_division_id,
    'zoneId',v_zone_id,
    'regionId',v_region_id,
    'areaId',v_area_id,
    'territoryId',v_territory_id,
    'managerEmployeeId',v_manager_employee_id,
    'mrEmployeeId',v_mr_employee_id
  );
end;
$$;

revoke all on function public.pilot_initialize_tenant(uuid,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pilot_initialize_tenant(uuid,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;

commit;
