begin;

alter table public.tour_executions
  drop constraint if exists tour_executions_status_check;

alter table public.tour_executions
  add constraint tour_executions_status_check
  check(status in('ACTIVE','SUBMITTED'));

alter table public.tour_executions
  add column submitted_at timestamptz,
  add column submit_operation_id uuid,
  add column worked_minutes integer check(worked_minutes is null or worked_minutes>=0),
  add column short_day_reason text;

create unique index tour_executions_submit_operation_unique
on public.tour_executions(tenant_id,employee_id,submit_operation_id)
where submit_operation_id is not null;

create or replace function public.admin_submit_tour_execution(
  p_tenant_id uuid,p_user_id uuid,p_operation_id uuid,p_short_day_reason text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_execution public.tour_executions%rowtype;
  v_existing public.tour_executions%rowtype;
  v_worked integer;
begin
  select execution.* into v_existing
    from public.tour_executions execution
    join public.employees employee
      on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id
     and employee.user_id=p_user_id
     and execution.submit_operation_id=p_operation_id;

  if v_existing.id is not null then
    if v_existing.status<>'SUBMITTED' then raise exception 'invalid prior submit operation'; end if;
    if coalesce(v_existing.short_day_reason,'')<>coalesce(nullif(trim(p_short_day_reason),''),'') then
      raise exception 'idempotency key reused with different submit payload';
    end if;
    return v_existing.id;
  end if;

  select execution.* into v_execution
    from public.tour_executions execution
    join public.employees employee
      on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id
     and execution.status='ACTIVE'
     and employee.user_id=p_user_id
     and employee.status='active'
   for update of execution;

  if v_execution.id is null then raise exception 'active tour not found'; end if;

  if exists(
    select 1 from public.field_visits visit
     where visit.tenant_id=p_tenant_id
       and visit.execution_id=v_execution.id
       and visit.status='CHECKED_IN'
  ) then raise exception 'open visit must be checked out before submitting tour'; end if;

  if exists(
    select 1 from public.field_visits visit
     where visit.tenant_id=p_tenant_id
       and visit.execution_id=v_execution.id
       and visit.exception_status in('PENDING','REJECTED')
  ) then raise exception 'GPS exceptions must be resolved before submitting tour'; end if;

  if exists(
    select 1
      from public.field_visits visit
      join public.tour_plan_stops stop
        on stop.tenant_id=visit.tenant_id and stop.id=visit.plan_stop_id
     where visit.tenant_id=p_tenant_id
       and visit.execution_id=v_execution.id
       and visit.status='CHECKED_OUT'
       and stop.stop_type='doctor'
       and not exists(
         select 1 from public.dcrs dcr
          where dcr.tenant_id=visit.tenant_id and dcr.visit_id=visit.id
       )
  ) then raise exception 'doctor visit DCR missing'; end if;

  v_worked:=greatest(
    0,
    floor(extract(epoch from(clock_timestamp()-v_execution.started_at))/60)::integer
  );

  if v_worked<v_execution.required_minutes
     and nullif(trim(p_short_day_reason),'') is null then
    raise exception 'short day reason required';
  end if;

  update public.tour_executions set
    status='SUBMITTED',
    submitted_at=clock_timestamp(),
    submit_operation_id=p_operation_id,
    worked_minutes=v_worked,
    short_day_reason=case
      when v_worked<required_minutes then nullif(trim(p_short_day_reason),'')
      else null
    end
   where tenant_id=p_tenant_id and id=v_execution.id;

  return v_execution.id;
end;
$$;

revoke all on function public.admin_submit_tour_execution(uuid,uuid,uuid,text) from public;
grant execute on function public.admin_submit_tour_execution(uuid,uuid,uuid,text) to service_role;

commit;
