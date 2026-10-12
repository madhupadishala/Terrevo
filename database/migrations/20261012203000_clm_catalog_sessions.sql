begin;

create table public.clm_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  title text not null check (length(trim(title)) between 1 and 160),
  category text not null check (length(trim(category)) between 1 and 80),
  version text not null check (length(trim(version)) between 1 and 40),
  status text not null check (status in ('APPROVED','DRAFT','WITHDRAWN','EXPIRED')),
  product_ids uuid[] not null check (cardinality(product_ids) between 1 and 50),
  slides jsonb not null check (jsonb_typeof(slides)='array' and jsonb_array_length(slides) between 1 and 100),
  effective_from date,
  expires_at date,
  provenance_id text not null check (length(trim(provenance_id)) between 1 and 300),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or effective_from is null or expires_at>=effective_from),
  check ((status='APPROVED' and approved_by is not null and approved_at is not null) or status<>'APPROVED'),
  unique (tenant_id,title,version)
);
create index clm_assets_scope_idx on public.clm_assets(tenant_id,status,effective_from,expires_at);

create table public.clm_detailing_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_user_id uuid not null references auth.users(id),
  asset_id uuid not null references public.clm_assets(id),
  visit_id uuid not null references public.field_visits(id),
  operation_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  slide_visits jsonb not null check (jsonb_typeof(slide_visits)='array'),
  provenance_id text not null,
  created_at timestamptz not null default now(),
  check (ended_at>=started_at),
  unique (tenant_id,actor_user_id,operation_id)
);
create index clm_detailing_sessions_scope_idx on public.clm_detailing_sessions(tenant_id,actor_user_id,created_at desc);

alter table public.clm_assets enable row level security;
alter table public.clm_assets force row level security;
alter table public.clm_detailing_sessions enable row level security;
alter table public.clm_detailing_sessions force row level security;

revoke all on public.clm_assets from public,anon,authenticated;
revoke all on public.clm_detailing_sessions from public,anon,authenticated;
grant select on public.clm_assets to authenticated;
grant select on public.clm_detailing_sessions to authenticated;
grant all on public.clm_assets to service_role;
grant all on public.clm_detailing_sessions to service_role;

create policy clm_assets_read on public.clm_assets for select to authenticated
using (
  status='APPROVED'
  and exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=clm_assets.tenant_id and tm.user_id=auth.uid() and tm.status='active'
  )
);

create policy clm_sessions_read_own on public.clm_detailing_sessions for select to authenticated
using (
  actor_user_id=auth.uid()
  and exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=clm_detailing_sessions.tenant_id and tm.user_id=auth.uid() and tm.status='active'
  )
);

commit;
