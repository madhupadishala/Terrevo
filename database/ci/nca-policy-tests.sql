begin;
do $$
declare v_table text; v_signature text;
begin
  foreach v_table in array array['nca_categories','nca_towns','nca_records'] loop
    if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity) then
      raise exception 'NCA row-level security missing for %',v_table;
    end if;
    if pg_catalog.has_table_privilege('authenticated','public.'||v_table,'INSERT') or
       pg_catalog.has_table_privilege('authenticated','public.'||v_table,'UPDATE') or
       pg_catalog.has_table_privilege('authenticated','public.'||v_table,'DELETE') or
       pg_catalog.has_table_privilege('anon','public.'||v_table,'SELECT') then
      raise exception 'Direct NCA table privileges too broad for %',v_table;
    end if;
  end loop;
  foreach v_signature in array array[
    'public.admin_create_nca(uuid,uuid,uuid,date,uuid,text,text,uuid,text,text,integer)',
    'public.admin_submit_nca(uuid,uuid,uuid)',
    'public.admin_configure_nca_category(uuid,uuid,text,text)',
    'public.admin_configure_nca_town(uuid,uuid,uuid,text)'
  ] loop
    if pg_catalog.has_function_privilege('anon',v_signature,'EXECUTE') or
       pg_catalog.has_function_privilege('authenticated',v_signature,'EXECUTE') or
       not pg_catalog.has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception 'NCA RPC authorization violated for %',v_signature;
    end if;
  end loop;
  if exists(select 1 from public.nca_categories) or exists(select 1 from public.nca_towns)
  then raise exception 'No unapproved NCA taxonomy may be seeded';end if;
end;$$;
rollback;
