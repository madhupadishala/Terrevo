begin;
drop policy if exists daily_timesheets_owner_or_team_read on public.daily_timesheets;
drop trigger if exists tour_execution_daily_timesheet_trigger on public.tour_executions;
drop function if exists public.daily_timesheet_on_execution_submit();
drop function if exists public.admin_review_daily_timesheet(uuid,uuid,uuid,uuid,text);
drop function if exists public.generate_daily_timesheet(uuid,uuid);
drop table if exists public.daily_timesheets;
commit;
