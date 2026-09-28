begin;
drop function if exists public.admin_start_tour(uuid,uuid,uuid,uuid,timestamptz,double precision,double precision,double precision,text,text,text);
drop function if exists public.my_start_tour_options(uuid);
drop table if exists public.tour_executions;
drop trigger if exists tenants_timezone_guard on public.tenants;
drop function if exists public.validate_tenant_timezone();
alter table public.tenants drop column if exists time_zone;
commit;
