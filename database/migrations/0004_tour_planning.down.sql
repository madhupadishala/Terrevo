begin;

drop function if exists public.admin_submit_tour_plan(uuid, uuid, uuid);
drop function if exists public.admin_save_tour_plan(uuid, uuid, uuid, date, jsonb);
drop table if exists public.tour_plan_stops;
drop table if exists public.tour_plan_days;
drop table if exists public.tour_plans;

commit;
