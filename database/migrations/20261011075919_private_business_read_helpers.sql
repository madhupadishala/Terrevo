begin;
-- Keep the documented RPC signatures; place elevated implementations outside
-- the exposed PostgREST schema. auth.uid() and tenant checks remain unchanged.
create schema terrevo_security;
revoke all on schema terrevo_security from public, anon;
grant usage on schema terrevo_security to authenticated, service_role;
do $migration$
declare f record; signature text; definition text; arguments text; elevated text;
begin
 for f in
  select p.*,pg_catalog.pg_get_function_arguments(p.oid) args,
    pg_catalog.pg_get_function_identity_arguments(p.oid) identity_args,
    pg_catalog.pg_get_function_result(p.oid) result,
    pg_catalog.pg_get_functiondef(p.oid) definition
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.proname in(
    'can_access_tour_plan','can_read_field_visit','employee_division',
    'has_master_access','has_permission','inventory_item_division',
    'manager_analytics','manager_command_center','my_active_tour_progress',
    'my_attendance','my_start_tour_options','org_unit_in_scope',
    'user_has_permission','user_has_plan_permission')
 loop
  signature:=format('public.%I(%s)',f.proname,f.identity_args);
  elevated:=format('terrevo_security.%I(%s)',f.proname,f.identity_args);
  definition:=replace(f.definition,'FUNCTION public.'||f.proname||'(',
    'FUNCTION terrevo_security.'||f.proname||'(');
  execute definition;
  execute format('revoke all on function %s from public, anon, authenticated',elevated);
  execute format('grant execute on function %s to authenticated, service_role',elevated);
  select string_agg('$'||i::text,',' order by i) into arguments
   from generate_series(1,f.pronargs)i;
  execute format('create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as %L',
    f.proname,f.args,f.result,
    case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
    format('select %s terrevo_security.%I(%s);',case when f.proretset then '*' else '' end,f.proname,coalesce(arguments,'')));
  -- These are internal actor-parameterized checks, never application RPCs.
  if f.proname in('employee_division','inventory_item_division','user_has_permission','user_has_plan_permission') then
   execute format('revoke execute on function %s from authenticated',signature);
   execute format('revoke execute on function %s from authenticated',elevated);
  end if;
 end loop;
end;$migration$;
commit;
