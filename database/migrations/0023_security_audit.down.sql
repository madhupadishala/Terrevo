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
    end if;
  end loop;
end
$$;

drop function if exists public.capture_security_audit_event();

do $audit$
begin
  if to_regclass('public.security_audit_events') is not null then
    if to_regclass('public.security_audit_events_archived_0023') is null then
      alter table public.security_audit_events rename to security_audit_events_archived_0023;
    else
      if exists (
        select 1
        from public.security_audit_events source_event
        join public.security_audit_events_archived_0023 archived_event
          on archived_event.id = source_event.id
        where (
          archived_event.tenant_id,
          archived_event.actor_user_id,
          archived_event.table_name,
          archived_event.record_id,
          archived_event.operation,
          archived_event.occurred_at,
          archived_event.row_before,
          archived_event.row_after,
          archived_event.transaction_id
        ) is distinct from (
          source_event.tenant_id,
          source_event.actor_user_id,
          source_event.table_name,
          source_event.record_id,
          source_event.operation,
          source_event.occurred_at,
          source_event.row_before,
          source_event.row_after,
          source_event.transaction_id
        )
      ) then
        raise exception
          'Rollback blocked: security_audit_events contains rows that conflict with archived audit evidence.';
      end if;

      insert into public.security_audit_events_archived_0023 (
        id,
        tenant_id,
        actor_user_id,
        table_name,
        record_id,
        operation,
        occurred_at,
        row_before,
        row_after,
        transaction_id
      )
      select
        id,
        tenant_id,
        actor_user_id,
        table_name,
        record_id,
        operation,
        occurred_at,
        row_before,
        row_after,
        transaction_id
      from public.security_audit_events
      on conflict (id) do nothing;

      drop table public.security_audit_events;
    end if;
  end if;
end
$audit$;
