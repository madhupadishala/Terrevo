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
  if to_regclass('public.security_audit_events') is not null
     and to_regclass('public.security_audit_events_archived_0023') is null then
    alter table public.security_audit_events rename to security_audit_events_archived_0023;
  end if;
end
$audit$;
