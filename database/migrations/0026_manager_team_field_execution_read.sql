begin;

-- Managers could hold TOUR_VIEW_TEAM yet remain unable to read team field
-- execution because the field_visits policy joins through tour_executions,
-- whose RLS previously allowed owners only. Extend execution visibility to
-- the same scoped plan permission already used for plans and visits.
drop policy if exists tour_executions_owner_read on public.tour_executions;
drop policy if exists tour_executions_owner_or_team_read on public.tour_executions;

create policy tour_executions_owner_or_team_read
on public.tour_executions
for select
to authenticated
using (
  exists (
    select 1
      from public.employees employee
     where employee.tenant_id = tour_executions.tenant_id
       and employee.id = tour_executions.employee_id
       and employee.user_id = auth.uid()
       and employee.status = 'active'
  )
  or public.can_access_tour_plan(
    tour_executions.tenant_id,
    tour_executions.tour_plan_id,
    'TOUR_VIEW_TEAM'
  )
);

commit;
