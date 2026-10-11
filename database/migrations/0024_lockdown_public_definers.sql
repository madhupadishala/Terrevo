begin;
-- Revocation is enforced after baseline migrations and before new business migrations.
-- Service-role RPCs remain callable only from trusted API code.
-- Read-only/RLS helper functions retain authenticated execution explicitly.
do $hardening$
declare f record; v_signature text;
begin
 for f in
   select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prosecdef
 loop
   v_signature:=format('%I.%I(%s)',f.nspname,f.proname,f.args);
   execute format('revoke execute on function %s from public, anon, authenticated',v_signature);
   execute format('grant execute on function %s to service_role',v_signature);
   if f.proname in (
      'can_access_tour_plan','can_read_field_visit','employee_division',
      'has_master_access','has_permission','inventory_item_division',
      'manager_analytics','manager_command_center','my_active_tour_progress',
      'my_attendance','my_start_tour_options','org_unit_in_scope',
      'user_has_permission','user_has_plan_permission'
   ) then
      execute format('grant execute on function %s to authenticated',v_signature);
   end if;
 end loop;
end;$hardening$;
commit;
