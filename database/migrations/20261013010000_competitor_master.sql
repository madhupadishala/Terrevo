-- S03: controlled tenant competitor master for RCPA and admin governance.
create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  division_id uuid not null references public.organization_units(id),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,49}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  manufacturer text null check (manufacturer is null or length(btrim(manufacturer)) between 1 and 160),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,code),
  unique (tenant_id,id)
);
create index competitors_tenant_division_idx on public.competitors(tenant_id,division_id,status);
alter table public.competitors enable row level security;
alter table public.competitors force row level security;
revoke all on public.competitors from public,anon,authenticated;
grant select on public.competitors to authenticated;
grant all on public.competitors to service_role;
create policy competitors_tenant_read on public.competitors for select to authenticated
using (
  exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=competitors.tenant_id
      and tm.user_id=auth.uid()
      and tm.status='active'
  )
);
-- Writes remain server-only. The master service requires MASTER_MANAGE before service-role insertion.
