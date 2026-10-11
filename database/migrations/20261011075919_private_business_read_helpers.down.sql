begin;
-- Restore original bodies and grants without restoring anonymous execution.
do $rollback$
declare f record;
begin
 for f in select p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) args,
  pg_catalog.pg_get_functiondef(p.oid) definition
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='terrevo_security'
 loop
  execute replace(f.definition,'FUNCTION terrevo_security.'||f.proname||'(',
    'FUNCTION public.'||f.proname||'(');
  execute format('revoke all on function public.%I(%s) from public, anon',f.proname,f.args);
  execute format('grant execute on function public.%I(%s) to authenticated, service_role',f.proname,f.args);
  execute format('drop function terrevo_security.%I(%s)',f.proname,f.args);
 end loop;
end;$rollback$;
drop schema terrevo_security;
commit;
