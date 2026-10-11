begin;
do $$
declare n integer;
begin
 select count(*) into n from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace ns on ns.oid=p.pronamespace
 where ns.nspname='public' and p.prosecdef
   and pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE');
 if n<>0 then raise exception 'Public SECURITY DEFINER functions callable anonymously: %',n;end if;
 select count(*) into n from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace ns on ns.oid=p.pronamespace
 where ns.nspname='public' and p.prosecdef and p.proname like 'admin_%'
   and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE');
 if n<>0 then raise exception 'Administrative mutation RPCs callable by authenticated clients: %',n;end if;
 if not pg_catalog.has_function_privilege('authenticated','public.has_permission(uuid,text,uuid)','EXECUTE')
   or not pg_catalog.has_function_privilege('authenticated','public.my_start_tour_options(uuid)','EXECUTE')
   or not pg_catalog.has_function_privilege('authenticated','public.manager_command_center(uuid)','EXECUTE') then
    raise exception 'Authenticated business-read permissions were lost';
 end if;
 if not pg_catalog.has_function_privilege('service_role','public.admin_save_tour_plan(uuid,uuid,uuid,date,jsonb)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role','public.admin_checkin_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision,text)','EXECUTE') then
    raise exception 'Service-role mutation RPC permissions were lost';
 end if;
end;$$;
rollback;
