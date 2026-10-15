begin;

drop policy if exists tour_executions_owner_or_team_read on public.tour_executions;

create policy tour_executions_owner_read
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
);

commit;
