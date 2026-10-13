revoke all on function public.import_master_records(uuid,text,jsonb) from public,anon,authenticated,service_role;
drop function if exists public.import_master_records(uuid,text,jsonb);
