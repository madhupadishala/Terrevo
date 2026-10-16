begin;
drop trigger if exists dcr_clm_snapshot on public.dcrs;
drop function if exists public.snapshot_dcr_clm_sessions();
drop table if exists public.dcr_clm_sessions;
commit;