begin;
create table public.manager_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_user_id uuid not null references auth.users(id),
  as_of timestamptz not null,
  filter jsonb not null check (jsonb_typeof(filter)='object'),
  source_ids text[] not null,
  row_count integer not null check (row_count>=0),
  csv_text text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index manager_report_snapshots_scope_idx on public.manager_report_snapshots(tenant_id,actor_user_id,created_at desc);
alter table public.manager_report_snapshots enable row level security;
alter table public.manager_report_snapshots force row level security;
revoke all on public.manager_report_snapshots from public,anon,authenticated;
grant select,insert on public.manager_report_snapshots to service_role;
create or replace function public.prevent_manager_report_snapshot_mutation() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  raise exception 'manager report snapshots are immutable';
end $$;
create trigger manager_report_snapshots_immutable
before update or delete on public.manager_report_snapshots
for each row execute function public.prevent_manager_report_snapshot_mutation();
revoke all on function public.prevent_manager_report_snapshot_mutation() from public,anon,authenticated;
grant execute on function public.prevent_manager_report_snapshot_mutation() to service_role;
commit;
