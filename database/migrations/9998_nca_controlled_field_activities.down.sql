begin;
drop function if exists public.admin_submit_nca(uuid,uuid,uuid);
drop function if exists public.admin_create_nca(uuid,uuid,uuid,date,uuid,text,text,uuid,text,text,integer);
drop function if exists public.admin_configure_nca_town(uuid,uuid,uuid,text);
drop function if exists public.admin_configure_nca_category(uuid,uuid,text,text);
drop table if exists public.nca_records;
drop table if exists public.nca_towns;
drop table if exists public.nca_categories;
commit;
