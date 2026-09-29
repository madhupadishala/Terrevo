create table public.security_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  occurred_at timestamptz not null default now(),
  row_before jsonb,
  row_after jsonb,
  transaction_id bigint not null default txid_current()
);

create index security_audit_events_tenant_time_idx
  on public.security_audit_events (tenant_id, occurred_at desc);
create index security_audit_events_table_record_idx
  on public.security_audit_events (table_name, record_id, occurred_at desc);

alter table public.security_audit_events enable row level security;
revoke all on table public.security_audit_events from anon, authenticated;
grant select on table public.security_audit_events to service_role;

create or replace function public.capture_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  before_row jsonb;
  after_row jsonb;
  tenant_text text;
  record_text text;
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
  else
    before_row := to_jsonb(old);
  end if;

  tenant_text := coalesce(after_row ->> 'tenant_id', before_row ->> 'tenant_id');
  record_text := coalesce(after_row ->> 'id', before_row ->> 'id');

  insert into public.security_audit_events (
    tenant_id,
    actor_user_id,
    table_name,
    record_id,
    operation,
    row_before,
    row_after
  )
  values (
    case
      when tenant_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then tenant_text::uuid
      else null
    end,
    auth.uid(),
    tg_table_name,
    record_text,
    tg_op,
    before_row,
    after_row
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.capture_security_audit_event() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenant_memberships',
    'role_definitions',
    'role_permissions',
    'organization_units',
    'user_org_assignments',
    'user_role_assignments',
    'tour_plans',
    'tour_plan_days',
    'tour_plan_stops',
    'tour_executions',
    'field_visits',
    'doctor_calls',
    'inventory_ledger',
    'visit_distributions',
    'daily_timesheets',
    'weekly_timesheets',
    'trade_calls',
    'rcpa_reports',
    'sales_orders',
    'leave_requests',
    'expense_claims',
    'joint_work_assignments'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists terrevo_security_audit on public.%I', table_name);
      execute format(
        'create trigger terrevo_security_audit after insert or update or delete on public.%I for each row execute function public.capture_security_audit_event()',
        table_name
      );
    end if;
  end loop;
end
$$;
