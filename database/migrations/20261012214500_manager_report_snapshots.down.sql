begin;
drop trigger if exists manager_report_snapshots_immutable on public.manager_report_snapshots;
drop function if exists public.prevent_manager_report_snapshot_mutation();
drop table if exists public.manager_report_snapshots;
commit;
