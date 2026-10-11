-- R04-B: tenant-isolated approved customer relationships. No seed data.
create table public.business_customer_links (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 source_id uuid not null,
 target_id uuid not null,
 territory_id text not null check (length(territory_id) between 1 and 120),
 relation text not null check (length(relation) between 1 and 200),
 approval text not null check (approval in ('PENDING','APPROVED','REJECTED')),
 evidence_id text not null check (length(evidence_id) between 1 and 300),
 verified_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique (tenant_id,source_id,target_id,relation,evidence_id)
);
create index business_customer_links_scope_idx on public.business_customer_links (tenant_id,source_id,territory_id);
-- Server-provisioned grants; employees cannot manage their own access.
create table public.business_customer_link_grants (
 tenant_id uuid not null references public.tenants(id),
 user_id uuid not null references auth.users(id),
 territory_id text not null,
 primary key (tenant_id,user_id,territory_id)
);
create index business_customer_link_grants_user_idx on public.business_customer_link_grants (user_id,tenant_id);
alter table public.business_customer_links enable row level security;
alter table public.business_customer_links force row level security;
alter table public.business_customer_link_grants enable row level security;
alter table public.business_customer_link_grants force row level security;
revoke all on public.business_customer_links from public,anon,authenticated;
revoke all on public.business_customer_link_grants from public,anon,authenticated;
grant select on public.business_customer_links to authenticated;
grant select on public.business_customer_link_grants to authenticated;
grant all on public.business_customer_links to service_role;
grant all on public.business_customer_link_grants to service_role;
create policy business_customer_grants_read on public.business_customer_link_grants for select to authenticated
 using (user_id=auth.uid() and exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_id=business_customer_link_grants.tenant_id
    and tm.user_id=auth.uid() and tm.status='active'
 ));
create policy business_customer_links_read on public.business_customer_links for select to authenticated
 using (approval='APPROVED' and exists (
  select 1 from public.business_customer_link_grants g where g.tenant_id=business_customer_links.tenant_id
   and g.user_id=auth.uid() and g.territory_id=business_customer_links.territory_id
 ));
-- No INSERT/UPDATE/DELETE policies for authenticated users.
