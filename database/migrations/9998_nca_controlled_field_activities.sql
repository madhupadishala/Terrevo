begin;

-- Controlled, tenant-specific NCA taxonomy. No placeholder categories/towns are seeded.
create table public.nca_categories(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check(code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  label text not null check(length(trim(label)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(tenant_id,id), unique(tenant_id,code)
);
create table public.nca_towns(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  territory_id uuid not null,
  name text not null check(length(trim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(tenant_id,id), unique(tenant_id,territory_id,id),
  unique(tenant_id,territory_id,name),
  foreign key(tenant_id,territory_id) references public.organization_units(tenant_id,id) on delete restrict
);
create table public.nca_records(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null,
  operation_id uuid not null,
  work_date date not null,
  territory_id uuid not null,
  phase text not null check(phase in('PLAN','REPORT')),
  category_code text not null,
  town_id uuid,
  reason text not null check(length(trim(reason)) between 1 and 500),
  remarks text not null default '' check(length(remarks)<=2000),
  duration_minutes integer not null check(duration_minutes between 1 and 1440),
  status text not null default 'DRAFT' check(status in('DRAFT','SUBMITTED')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique(tenant_id,id), unique(tenant_id,created_by,operation_id),
  foreign key(tenant_id,created_by) references public.tenant_memberships(tenant_id,user_id) on delete restrict,
  foreign key(tenant_id,territory_id) references public.organization_units(tenant_id,id) on delete restrict,
  foreign key(tenant_id,category_code) references public.nca_categories(tenant_id,code) on delete restrict,
  foreign key(tenant_id,territory_id,town_id) references public.nca_towns(tenant_id,territory_id,id) on delete restrict,
  check(phase <> 'PLAN' or town_id is not null),
  check(phase <> 'REPORT' or length(trim(remarks))>0)
);
create index nca_records_own_idx on public.nca_records(tenant_id,created_by,work_date desc);

create or replace function public.admin_configure_nca_category(
  p_tenant_id uuid,p_actor uuid,p_code text,p_label text
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.user_has_permission(p_tenant_id,p_actor,'MASTER_MANAGE',null) then
    raise exception 'NCA category configuration denied' using errcode='42501';
  end if;
  if p_code is null or p_code !~ '^[A-Z][A-Z0-9_]{1,39}$' or length(trim(p_label)) not between 1 and 120 then
    raise exception 'Invalid NCA category' using errcode='22023';
  end if;
  insert into public.nca_categories(tenant_id,code,label) values(p_tenant_id,p_code,trim(p_label))
  on conflict(tenant_id,code) do update set label=excluded.label,active=true;
end;$$;

create or replace function public.admin_configure_nca_town(
  p_tenant_id uuid,p_actor uuid,p_territory_id uuid,p_name text
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.user_has_permission(p_tenant_id,p_actor,'MASTER_MANAGE',null) then
    raise exception 'NCA town configuration denied' using errcode='42501';
  end if;
  if length(trim(p_name)) not between 1 and 120 or not exists(
     select 1 from public.organization_units o where o.tenant_id=p_tenant_id
     and o.id=p_territory_id and o.type='territory' and o.status='active'
  ) then raise exception 'Invalid NCA town or territory' using errcode='22023'; end if;
  insert into public.nca_towns(tenant_id,territory_id,name) values(p_tenant_id,p_territory_id,trim(p_name))
  on conflict(tenant_id,territory_id,name) do update set active=true;
end;$$;

create or replace function public.admin_create_nca(
 p_tenant_id uuid,p_actor uuid,p_operation_id uuid,p_work_date date,p_territory_id uuid,
 p_phase text,p_category_code text,p_town_id uuid,p_reason text,p_remarks text,p_duration_minutes integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_employee public.employees%rowtype;
begin
  -- The API supplies p_actor only after authenticating the bearer. The direct RPC
  -- is executable by service_role exclusively; tenant membership is checked again.
  select e.* into v_employee from public.employees e
    join public.tenant_memberships m on m.tenant_id=e.tenant_id and m.user_id=e.user_id
    where e.tenant_id=p_tenant_id and e.user_id=p_actor and e.status='active'
    limit 1;
  if v_employee.id is null or not public.user_has_permission(p_tenant_id,p_actor,'TOUR_PLAN_OWN',p_territory_id) then
    raise exception 'NCA capture denied' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.organization_units o where o.tenant_id=p_tenant_id
      and o.id=p_territory_id and o.type='territory' and o.status='active'
      and public.org_unit_in_scope(p_tenant_id,p_territory_id,v_employee.org_unit_id)
  ) then raise exception 'NCA territory outside employee scope' using errcode='42501'; end if;
  select n.id into v_id from public.nca_records n
    where n.tenant_id=p_tenant_id and n.created_by=p_actor and n.operation_id=p_operation_id;
  if v_id is not null then return v_id; end if;
  if p_phase not in ('PLAN','REPORT') or (p_phase='PLAN' and p_town_id is null) or
     p_duration_minutes not between 1 and 1440 or length(trim(p_reason)) not between 1 and 500 or
     length(coalesce(p_remarks,''))>2000 or
     (p_phase='REPORT' and length(trim(coalesce(p_remarks,'')))=0) or p_work_date is null
  then raise exception 'Invalid NCA fields' using errcode='22023'; end if;
  if not exists(select 1 from public.nca_categories c where c.tenant_id=p_tenant_id and c.code=p_category_code and c.active)
    then raise exception 'NCA category is not approved' using errcode='22023'; end if;
  if p_town_id is not null and not exists(
    select 1 from public.nca_towns t where t.tenant_id=p_tenant_id and t.id=p_town_id
      and t.territory_id=p_territory_id and t.active
  ) then raise exception 'NCA town is not authorized' using errcode='22023'; end if;
  insert into public.nca_records(tenant_id,created_by,operation_id,work_date,territory_id,phase,
      category_code,town_id,reason,remarks,duration_minutes)
  values(p_tenant_id,p_actor,p_operation_id,p_work_date,p_territory_id,p_phase,
      p_category_code,p_town_id,trim(p_reason),coalesce(p_remarks,''),p_duration_minutes)
  on conflict(tenant_id,created_by,operation_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.nca_records where tenant_id=p_tenant_id and created_by=p_actor and operation_id=p_operation_id;
  end if;
  return v_id;
end;$$;

create or replace function public.admin_submit_nca(
  p_tenant_id uuid,p_actor uuid,p_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_row public.nca_records%rowtype;
begin
  select * into v_row from public.nca_records
   where tenant_id=p_tenant_id and id=p_id and created_by=p_actor for update;
  if v_row.id is null then raise exception 'NCA record not found' using errcode='P0002'; end if;
  if v_row.status<>'DRAFT' then raise exception 'Only draft NCA may be submitted' using errcode='23505'; end if;
  if not public.user_has_permission(p_tenant_id,p_actor,'TOUR_PLAN_OWN',v_row.territory_id)
  then raise exception 'NCA submission denied' using errcode='42501'; end if;
  update public.nca_records set status='SUBMITTED',submitted_at=now() where id=p_id and tenant_id=p_tenant_id;
end;$$;

revoke all on public.nca_categories,public.nca_towns,public.nca_records from anon,authenticated;
grant select on public.nca_categories,public.nca_towns,public.nca_records to authenticated;

alter table public.nca_categories enable row level security;
alter table public.nca_towns enable row level security;
alter table public.nca_records enable row level security;
create policy nca_categories_visible on public.nca_categories for select to authenticated using(
  exists(select 1 from public.tenant_memberships m where m.tenant_id=nca_categories.tenant_id and m.user_id=auth.uid())
);
create policy nca_towns_visible on public.nca_towns for select to authenticated using(
  public.has_permission(tenant_id,'TOUR_PLAN_OWN',territory_id)
  or public.has_permission(tenant_id,'MASTER_MANAGE',null)
);
create policy nca_records_visible on public.nca_records for select to authenticated using(
  created_by=auth.uid() or public.has_permission(tenant_id,'TOUR_VIEW_TEAM',territory_id)
);

revoke execute on function public.admin_configure_nca_category(uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.admin_configure_nca_town(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.admin_create_nca(uuid,uuid,uuid,date,uuid,text,text,uuid,text,text,integer) from public,anon,authenticated;
revoke execute on function public.admin_submit_nca(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_configure_nca_category(uuid,uuid,text,text) to service_role;
grant execute on function public.admin_configure_nca_town(uuid,uuid,uuid,text) to service_role;
grant execute on function public.admin_create_nca(uuid,uuid,uuid,date,uuid,text,text,uuid,text,text,integer) to service_role;
grant execute on function public.admin_submit_nca(uuid,uuid,uuid) to service_role;
commit;
