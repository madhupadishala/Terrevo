begin;

create extension if not exists pgcrypto with schema extensions;

create table public.tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_memberships_user_active_idx
  on public.tenant_memberships (user_id, status, tenant_id);

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;

revoke all on public.tenants from anon;
revoke all on public.tenant_memberships from anon;
revoke all on public.tenants from authenticated;
revoke all on public.tenant_memberships from authenticated;

grant select on public.tenants to authenticated;
grant select on public.tenant_memberships to authenticated;

create policy tenant_membership_read_own
  on public.tenant_memberships
  for select
  to authenticated
  using (user_id = auth.uid() and status = 'active');

create policy tenant_read_for_active_member
  on public.tenants
  for select
  to authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.tenant_memberships membership
      where membership.tenant_id = tenants.id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    )
  );

comment on table public.tenants is
  'Terrevo customer tenants. Normal authenticated users have read-only access through active membership.';

comment on table public.tenant_memberships is
  'Maps Supabase Auth users to Terrevo tenants. Role/organization scope is intentionally deferred to Sprint 2.';

commit;
