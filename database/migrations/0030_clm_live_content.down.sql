begin;
drop function if exists public.admin_save_clm_detailing(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,jsonb);
drop table if exists public.clm_session_slides;
drop table if exists public.clm_detailing_sessions;
drop table if exists public.clm_slides;
drop table if exists public.clm_asset_products;
drop table if exists public.clm_assets;
commit;