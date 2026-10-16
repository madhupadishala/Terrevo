begin;
revoke all on function public.pilot_initialize_tenant(uuid,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
drop function if exists public.pilot_initialize_tenant(uuid,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb);
commit;
