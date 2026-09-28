begin;

insert into public.role_permissions (role_key, permission_key)
values ('MANAGER', 'MASTER_MANAGE')
on conflict do nothing;

create or replace function public.has_master_access(
  p_tenant_id uuid,
  p_target_org_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tenant_memberships membership
      join public.user_role_assignments assignment
        on assignment.tenant_id = membership.tenant_id
       and assignment.user_id = membership.user_id
       and assignment.status = 'active'
      join public.role_permissions permission
        on permission.role_key = assignment.role_key
       and permission.permission_key = 'MASTER_VIEW'
     where membership.tenant_id = p_tenant_id
       and membership.user_id = auth.uid()
       and membership.status = 'active'
       and (
         assignment.scope_org_unit_id is null
         or public.org_unit_in_scope(p_tenant_id, p_target_org_unit_id, assignment.scope_org_unit_id)
         or public.org_unit_in_scope(p_tenant_id, assignment.scope_org_unit_id, p_target_org_unit_id)
       )
  );
$$;

revoke all on function public.has_master_access(uuid, uuid) from public;
grant execute on function public.has_master_access(uuid, uuid) to authenticated;

create table public.employees (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid,
  code text not null,
  name text not null,
  designation text not null,
  org_unit_id uuid not null,
  reporting_manager_employee_id uuid,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  unique (tenant_id, user_id),
  foreign key (tenant_id, user_id)
    references public.tenant_memberships(tenant_id, user_id)
    on delete set null,
  foreign key (tenant_id, org_unit_id)
    references public.organization_units(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, reporting_manager_employee_id)
    references public.employees(tenant_id, id)
    on delete set null
);

create or replace function public.validate_employee_manager()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  manager_org_unit_id uuid;
begin
  if new.reporting_manager_employee_id is null then
    return new;
  end if;

  select employee.org_unit_id
    into manager_org_unit_id
    from public.employees employee
   where employee.tenant_id = new.tenant_id
     and employee.id = new.reporting_manager_employee_id
     and employee.status = 'active';

  if manager_org_unit_id is null
     or not public.org_unit_in_scope(new.tenant_id, new.org_unit_id, manager_org_unit_id) then
    raise exception 'reporting manager must be on the same organization branch';
  end if;

  return new;
end;
$$;

create trigger employees_manager_guard
before insert or update of reporting_manager_employee_id, org_unit_id, tenant_id
on public.employees
for each row execute function public.validate_employee_manager();

create table public.doctors (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  specialty text not null,
  category text,
  clinic text,
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  visit_frequency smallint not null default 1 check (visit_frequency between 1 and 31),
  territory_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, territory_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  generic_name text,
  division_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, division_id),
  unique (tenant_id, code),
  foreign key (tenant_id, division_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

create table public.chemists (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  territory_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, territory_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

create table public.stockists (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  territory_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, territory_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

create table public.samples (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  product_id uuid not null,
  division_id uuid not null,
  unit text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, product_id, division_id)
    references public.products(tenant_id, id, division_id)
    on delete restrict
);

create table public.gifts (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  division_id uuid not null,
  category text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, division_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

alter table public.employees enable row level security;
alter table public.doctors enable row level security;
alter table public.products enable row level security;
alter table public.chemists enable row level security;
alter table public.stockists enable row level security;
alter table public.samples enable row level security;
alter table public.gifts enable row level security;

revoke all on public.employees from anon, authenticated;
revoke all on public.doctors from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.chemists from anon, authenticated;
revoke all on public.stockists from anon, authenticated;
revoke all on public.samples from anon, authenticated;
revoke all on public.gifts from anon, authenticated;

grant select on public.employees to authenticated;
grant select on public.doctors to authenticated;
grant select on public.products to authenticated;
grant select on public.chemists to authenticated;
grant select on public.stockists to authenticated;
grant select on public.samples to authenticated;
grant select on public.gifts to authenticated;

create policy employees_scoped_read on public.employees
for select to authenticated using (public.has_master_access(tenant_id, org_unit_id));

create policy doctors_scoped_read on public.doctors
for select to authenticated using (public.has_master_access(tenant_id, territory_id));

create policy products_scoped_read on public.products
for select to authenticated using (public.has_master_access(tenant_id, division_id));

create policy chemists_scoped_read on public.chemists
for select to authenticated using (public.has_master_access(tenant_id, territory_id));

create policy stockists_scoped_read on public.stockists
for select to authenticated using (public.has_master_access(tenant_id, territory_id));

create policy samples_scoped_read on public.samples
for select to authenticated using (public.has_master_access(tenant_id, division_id));

create policy gifts_scoped_read on public.gifts
for select to authenticated using (public.has_master_access(tenant_id, division_id));

commit;
