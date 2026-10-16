begin;
do $$
declare v_table text; v_fn text;
begin
 foreach v_table in array array['unplanned_calls','unplanned_call_decisions'] loop
  if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v_table and c.relrowsecurity)
  then raise exception 'RLS missing for %',v_table; end if;
  if pg_catalog.has_table_privilege('anon','public.'||v_table,'SELECT') or
     pg_catalog.has_table_privilege('authenticated','public.'||v_table,'INSERT') or
     pg_catalog.has_table_privilege('authenticated','public.'||v_table,'UPDATE') or
     pg_catalog.has_table_privilege('authenticated','public.'||v_table,'DELETE')
  then raise exception 'Unexpected direct access to unplanned %',v_table; end if;
 end loop;
 foreach v_fn in array array[
  'public.admin_submit_unplanned_call(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,integer,numeric,numeric,numeric)',
  'public.admin_decide_unplanned_call(uuid,uuid,uuid,text,text)'
 ] loop
  if pg_catalog.has_function_privilege('anon',v_fn,'EXECUTE') or
     pg_catalog.has_function_privilege('authenticated',v_fn,'EXECUTE') or
     not pg_catalog.has_function_privilege('service_role',v_fn,'EXECUTE')
  then raise exception 'Unplanned-call RPC grants unsafe for %',v_fn; end if;
 end loop;
 if exists(select 1 from public.unplanned_calls)then
  raise exception 'No fabricated field calls may be seeded';
 end if;
end;$$;
rollback;
