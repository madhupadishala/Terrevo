-- S03 controlled master imports: server-only, atomic batch transaction.
create or replace function public.import_master_records(p_tenant_id uuid,p_kind text,p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare expected_count integer; inserted_count integer;
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'rows must be an array'; end if;
  expected_count:=jsonb_array_length(p_rows);
  if expected_count<1 or expected_count>200 then raise exception 'import batch must contain 1..200 rows'; end if;

  if p_kind='doctors' then
    insert into public.doctors(tenant_id,code,name,specialty,category,clinic,address,latitude,longitude,visit_frequency,territory_id)
    select p_tenant_id,upper(btrim(x.code)),btrim(x.name),btrim(x.specialty),nullif(btrim(x.category),''),
      nullif(btrim(x.clinic),''),nullif(btrim(x.address),''),x.latitude,x.longitude,coalesce(x.visit_frequency,1),x.territory_id
    from jsonb_to_recordset(p_rows) as x(code text,name text,specialty text,category text,clinic text,address text,latitude double precision,longitude double precision,visit_frequency smallint,territory_id uuid)
    join public.organization_units u on u.id=x.territory_id and u.tenant_id=p_tenant_id and u.type='territory' and u.status='active';
  elsif p_kind='chemists' then
    insert into public.chemists(tenant_id,code,name,address,latitude,longitude,territory_id)
    select p_tenant_id,upper(btrim(x.code)),btrim(x.name),nullif(btrim(x.address),''),x.latitude,x.longitude,x.territory_id
    from jsonb_to_recordset(p_rows) as x(code text,name text,address text,latitude double precision,longitude double precision,territory_id uuid)
    join public.organization_units u on u.id=x.territory_id and u.tenant_id=p_tenant_id and u.type='territory' and u.status='active';
  elsif p_kind='stockists' then
    insert into public.stockists(tenant_id,code,name,address,latitude,longitude,territory_id)
    select p_tenant_id,upper(btrim(x.code)),btrim(x.name),nullif(btrim(x.address),''),x.latitude,x.longitude,x.territory_id
    from jsonb_to_recordset(p_rows) as x(code text,name text,address text,latitude double precision,longitude double precision,territory_id uuid)
    join public.organization_units u on u.id=x.territory_id and u.tenant_id=p_tenant_id and u.type='territory' and u.status='active';
  elsif p_kind='products' then
    insert into public.products(tenant_id,code,name,generic_name,division_id)
    select p_tenant_id,upper(btrim(x.code)),btrim(x.name),nullif(btrim(x.generic_name),''),x.division_id
    from jsonb_to_recordset(p_rows) as x(code text,name text,generic_name text,division_id uuid)
    join public.organization_units u on u.id=x.division_id and u.tenant_id=p_tenant_id and u.type='division' and u.status='active';
  elsif p_kind='competitors' then
    insert into public.competitors(tenant_id,division_id,code,name,manufacturer)
    select p_tenant_id,x.division_id,upper(btrim(x.code)),btrim(x.name),nullif(btrim(x.manufacturer),'')
    from jsonb_to_recordset(p_rows) as x(code text,name text,manufacturer text,division_id uuid)
    join public.organization_units u on u.id=x.division_id and u.tenant_id=p_tenant_id and u.type='division' and u.status='active';
  elsif p_kind='gifts' then
    insert into public.gifts(tenant_id,code,name,division_id,category)
    select p_tenant_id,upper(btrim(x.code)),btrim(x.name),x.division_id,nullif(btrim(x.category),'')
    from jsonb_to_recordset(p_rows) as x(code text,name text,category text,division_id uuid)
    join public.organization_units u on u.id=x.division_id and u.tenant_id=p_tenant_id and u.type='division' and u.status='active';
  elsif p_kind='samples' then
    insert into public.samples(tenant_id,code,name,product_id,division_id,unit)
    select p_tenant_id,upper(btrim(x.code)),btrim(x.name),x.product_id,x.division_id,nullif(btrim(x.unit),'')
    from jsonb_to_recordset(p_rows) as x(code text,name text,product_id uuid,division_id uuid,unit text)
    join public.organization_units u on u.id=x.division_id and u.tenant_id=p_tenant_id and u.type='division' and u.status='active'
    join public.products p on p.id=x.product_id and p.tenant_id=p_tenant_id and p.division_id=x.division_id and p.status='active';
  elsif p_kind='employees' then
    insert into public.employees(tenant_id,user_id,code,name,designation,org_unit_id,reporting_manager_employee_id)
    select p_tenant_id,x.user_id,upper(btrim(x.code)),btrim(x.name),btrim(x.designation),x.org_unit_id,x.reporting_manager_employee_id
    from jsonb_to_recordset(p_rows) as x(user_id uuid,code text,name text,designation text,org_unit_id uuid,reporting_manager_employee_id uuid)
    join public.organization_units u on u.id=x.org_unit_id and u.tenant_id=p_tenant_id and u.status='active';
  else
    raise exception 'unsupported master kind';
  end if;
  get diagnostics inserted_count=row_count;
  if inserted_count<>expected_count then raise exception 'one or more rows have invalid tenant scope or references'; end if;
  return inserted_count;
end;
$$;
revoke all on function public.import_master_records(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.import_master_records(uuid,text,jsonb) to service_role;
