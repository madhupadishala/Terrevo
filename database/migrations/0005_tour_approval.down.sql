begin;

drop function if exists public.admin_decide_tour_plan(uuid,uuid,uuid,text,text);
drop policy if exists tour_plan_decisions_owner_or_team_read on public.tour_plan_decisions;
drop table if exists public.tour_plan_decisions;
drop policy if exists tour_plan_stops_owner_or_team_read on public.tour_plan_stops;
drop policy if exists tour_plan_days_owner_or_team_read on public.tour_plan_days;
drop policy if exists tour_plans_owner_or_team_read on public.tour_plans;
drop function if exists public.can_access_tour_plan(uuid,uuid,text);
drop function if exists public.user_has_plan_permission(uuid,uuid,uuid,text);

alter table public.tour_plans drop constraint if exists tour_plans_reviewed_by_fk;
alter table public.tour_plans drop column if exists reviewed_by;
alter table public.tour_plans drop column if exists reviewed_at;
alter table public.tour_plans drop constraint if exists tour_plans_status_check;
alter table public.tour_plans add constraint tour_plans_status_check check(status in('DRAFT','SUBMITTED'));

create policy tour_plans_own_read on public.tour_plans for select to authenticated
using(exists(select 1 from public.employees e where e.tenant_id=tour_plans.tenant_id and e.id=tour_plans.employee_id and e.user_id=auth.uid() and e.status='active'));
create policy tour_plan_days_own_read on public.tour_plan_days for select to authenticated
using(exists(select 1 from public.tour_plans p join public.employees e on e.tenant_id=p.tenant_id and e.id=p.employee_id where p.tenant_id=tour_plan_days.tenant_id and p.id=tour_plan_days.tour_plan_id and e.user_id=auth.uid() and e.status='active'));
create policy tour_plan_stops_own_read on public.tour_plan_stops for select to authenticated
using(exists(select 1 from public.tour_plan_days d join public.tour_plans p on p.tenant_id=d.tenant_id and p.id=d.tour_plan_id join public.employees e on e.tenant_id=p.tenant_id and e.id=p.employee_id where d.tenant_id=tour_plan_stops.tenant_id and d.id=tour_plan_stops.tour_plan_day_id and e.user_id=auth.uid() and e.status='active'));

commit;
