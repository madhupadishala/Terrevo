begin;

create table public.role_definitions (
  key text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive'))
);

create table public.role_permissions (
  role_key text not null references public.role_definitions(key) on delete cascade,
  permission_key text not null,
  primary key (role_key, permission_key)
);

insert into public.role_definitions (key, name) values
  ('TENANT_ADMIN', 'Tenant Administrator'),
  ('MANAGER', 'Manager'),
  ('MR', 'Medical Representative');

insert into public.role_permissions (role_key, permission_key) values
  ('TENANT_ADMIN', 'ORG_VIEW'),
  ('TENANT_ADMIN', 'ORG_MANAGE'),
  ('TENANT_ADMIN', 'RBAC_VIEW'),
  ('TENANT_ADMIN', 'RBAC_MANAGE'),
  ('TENANT_ADMIN', 'MASTER_VIEW'),
  ('TENANT_ADMIN', 'MASTER_MANAGE'),
  ('TENANT_ADMIN', 'TOUR_PLAN_OWN'),
  ('TENANT_ADMIN', 'TOUR_VIEW_TEAM'),
  ('TENANT_ADMIN', 'TOUR_APPROVE'),
  ('MANAGER', 'ORG_VIEW'),
  ('MANAGER', 'RBAC_VIEW'),
  ('MANAGER', 'MASTER_VIEW'),
  ('MANAGER', 'TOUR_VIEW_TEAM'),
  ('MANAGER', 'TOUR_APPROVE'),
  ('MR', 'ORG_VIEW'),
  ('MR', 'MASTER_VIEW'),
  ('MR', 'TOUR_PLAN_OWN');

create table public.organization_units (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid,
  type text not null check (type in ('company', 'division', 'zone', 'region', 'area', 'territory')),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name text not null check (length(trim(name)) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, parent_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

create table public.user_org_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  org_unit_id uuid not null,
  is_primary boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, user_id)
    references public.tenant_memberships(tenant_id, user_id)
    on delete cascade,
  foreign key (tenant_id, org_unit_id)
    references public.organization_units(tenant_id, id)
    on delete cascade,
  unique (tenant_id, user_id, org_unit_id)
);

create unique index user_org_primary_active_idx
  on public.user_org_assignments (tenant_id, user_id)
  where is_primary and status = 'active';

create table public.user_role_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  role_key text not null references public.role_definitions(key),
  scope_org_unit_id uuid,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, user_id)
    references public.tenant_memberships(tenant_id, user_id)
    on delete cascade,
  foreign key (tenant_id, scope_org_unit_id)
    references public.organization_units(tenant_id, id)
    on delete cascade,
  check (
    (role_key = 'TENANT_ADMIN' and scope_org_unit_id is null)
    or
    (role_key <> 'TENANT_ADMIN' and scope_org_unit_id is not null)
  )
);

create unique index user_role_assignment_unique_idx
  on public.user_role_assignments (
    tenant_id,
    user_id,
    role_key,
    coalesce(scope_org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'active';

create or replace function public.validate_org_unit_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_type text;
  expected_parent text;
begin
  if new.type = 'company' then
    if new.parent_id is not null then
      raise exception 'company cannot have a parent';
    end if;
    return new;
  end if;

  if new.parent_id is null then
    raise exception '% requires a parent', new.type;
  end if;

  expected_parent := case new.type
    when 'division' then 'company'
    when 'zone' then 'division'
    when 'region' then 'zone'
    when 'area' then 'region'
    when 'territory' then 'area'
  end;

  select unit.type
    into parent_type
    from public.organization_units unit
   where unit.tenant_id = new.tenant_id
     and unit.id = new.parent_id;

  if parent_type is distinct from expected_parent then
    raise exception '% must be under %', new.type, expected_parent;
  end if;

  return new;
end;
$$;

create trigger organization_units_parent_guard
before insert or update of parent_id, type, tenant_id
on public.organization_units
for each row execute function public.validate_org_unit_parent();

create or replace function public.org_unit_in_scope(
  p_tenant_id uuid,
  p_target_unit_id uuid,
  p_scope_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestry as (
    select unit.id, unit.parent_id
      from public.organization_units unit
     where unit.tenant_id = p_tenant_id
       and unit.id = p_target_unit_id
       and unit.status = 'active'
    union all
    select parent.id, parent.parent_id
      from public.organization_units parent
      join ancestry child on child.parent_id = parent.id
     where parent.tenant_id = p_tenant_id
       and parent.status = 'active'
  )
  select exists(select 1 from ancestry where id = p_scope_unit_id);
$$;

create or replace function public.has_permission(
  p_tenant_id uuid,
  p_permission text,
  p_target_unit_id uuid default null
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
       and permission.permission_key = p_permission
     where membership.tenant_id = p_tenant_id
       and membership.user_id = auth.uid()
       and membership.status = 'active'
       and (
         assignment.scope_org_unit_id is null
         or (
           p_target_unit_id is not null
           and public.org_unit_in_scope(
             p_tenant_id,
             p_target_unit_id,
             assignment.scope_org_unit_id
           )
         )
       )
  );
$$;

create or replace function public.admin_assign_user_org(
  p_tenant_id uuid,
  p_user_id uuid,
  p_org_unit_id uuid,
  p_is_primary boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_is_primary then
    update public.user_org_assignments
       set is_primary = false
     where tenant_id = p_tenant_id
       and user_id = p_user_id
       and status = 'active'
       and is_primary;
  end if;

  insert into public.user_org_assignments (
    tenant_id, user_id, org_unit_id, is_primary, status
  )
  values (
    p_tenant_id, p_user_id, p_org_unit_id, p_is_primary, 'active'
  )
  on conflict (tenant_id, user_id, org_unit_id)
  do update set
    is_primary = excluded.is_primary,
    status = 'active';
end;
$$;

alter table public.role_definitions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_units enable row level security;
alter table public.user_org_assignments enable row level security;
alter table public.user_role_assignments enable row level security;

revoke all on public.role_definitions from anon, authenticated;
revoke all on public.role_permissions from anon, authenticated;
revoke all on public.organization_units from anon, authenticated;
revoke all on public.user_org_assignments from anon, authenticated;
revoke all on public.user_role_assignments from anon, authenticated;

grant select on public.role_definitions to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.organization_units to authenticated;
grant select on public.user_org_assignments to authenticated;
grant select on public.user_role_assignments to authenticated;

revoke all on function public.org_unit_in_scope(uuid, uuid, uuid) from public;
revoke all on function public.has_permission(uuid, text, uuid) from public;
revoke all on function public.admin_assign_user_org(uuid, uuid, uuid, boolean) from public;
grant execute on function public.has_permission(uuid, text, uuid) to authenticated;
grant execute on function public.admin_assign_user_org(uuid, uuid, uuid, boolean) to service_role;

create policy role_definitions_read
  on public.role_definitions for select to authenticated
  using (status = 'active');

create policy role_permissions_read
  on public.role_permissions for select to authenticated
  using (true);

create policy organization_units_scoped_read
  on public.organization_units for select to authenticated
  using (public.has_permission(tenant_id, 'ORG_VIEW', id));

create policy user_org_assignments_read
  on public.user_org_assignments for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(tenant_id, 'ORG_VIEW', org_unit_id)
  );

create policy user_role_assignments_read
  on public.user_role_assignments for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(tenant_id, 'RBAC_VIEW', scope_org_unit_id)
  );

comment on function public.has_permission(uuid, text, uuid) is
  'Checks authenticated-user RBAC inside one tenant and optional organization scope.';

commit;
