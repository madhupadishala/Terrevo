begin;

create table public.daily_timesheets(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  execution_id uuid not null,
  employee_id uuid not null,
  work_date date not null,
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  total_minutes integer not null check(total_minutes>=0),
  visit_minutes integer not null check(visit_minutes>=0),
  unclassified_minutes integer not null check(unclassified_minutes>=0),
  call_count integer not null check(call_count>=0),
  status text not null default 'GENERATED' check(status in('GENERATED','REVIEWED')),
  remarks text,
  reviewed_at timestamptz,
  review_operation_id uuid,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,execution_id),
  unique(tenant_id,employee_id,work_date),
  unique(tenant_id,employee_id,review_operation_id),
  foreign key(tenant_id,execution_id) references public.tour_executions(tenant_id,id) on delete restrict,
  foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict
);

create or replace function public.generate_daily_timesheet(p_tenant_id uuid,p_execution_id uuid)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_execution public.tour_executions%rowtype;
  v_visit_minutes integer;
  v_call_count integer;
begin
  select execution.* into v_execution
    from public.tour_executions execution
   where execution.tenant_id=p_tenant_id
     and execution.id=p_execution_id
     and execution.status='SUBMITTED';

  if v_execution.id is null then return; end if;

  select
    coalesce(sum(greatest(0,floor(extract(epoch from(visit.checkout_at-visit.checkin_at))/60)::integer)),0),
    count(*)::integer
  into v_visit_minutes,v_call_count
  from public.field_visits visit
  where visit.tenant_id=p_tenant_id
    and visit.execution_id=v_execution.id
    and visit.status='CHECKED_OUT'
    and visit.checkout_at is not null;

  insert into public.daily_timesheets(
    tenant_id,execution_id,employee_id,work_date,started_at,submitted_at,
    total_minutes,visit_minutes,unclassified_minutes,call_count
  ) values(
    p_tenant_id,v_execution.id,v_execution.employee_id,v_execution.work_date,
    v_execution.started_at,v_execution.submitted_at,
    coalesce(v_execution.worked_minutes,0),v_visit_minutes,
    greatest(0,coalesce(v_execution.worked_minutes,0)-v_visit_minutes),v_call_count
  )
  on conflict(tenant_id,execution_id) do nothing;
end;
$$;
revoke all on function public.generate_daily_timesheet(uuid,uuid) from public;

create or replace function public.daily_timesheet_on_execution_submit()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.status='SUBMITTED' and old.status is distinct from 'SUBMITTED' then
    perform public.generate_daily_timesheet(new.tenant_id,new.id);
  end if;
  return new;
end;
$$;

create trigger tour_execution_daily_timesheet_trigger
after update of status on public.tour_executions
for each row execute function public.daily_timesheet_on_execution_submit();

select public.generate_daily_timesheet(execution.tenant_id,execution.id)
from public.tour_executions execution
where execution.status='SUBMITTED';

create or replace function public.admin_review_daily_timesheet(
  p_tenant_id uuid,p_user_id uuid,p_timesheet_id uuid,p_operation_id uuid,p_remarks text
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_timesheet public.daily_timesheets%rowtype;
  v_owner uuid;
begin
  select timesheet.* into v_timesheet
    from public.daily_timesheets timesheet
   where timesheet.tenant_id=p_tenant_id and timesheet.id=p_timesheet_id
   for update;

  if v_timesheet.id is null then raise exception 'daily timesheet not found'; end if;

  select employee.user_id into v_owner
    from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.id=v_timesheet.employee_id;

  if v_owner is distinct from p_user_id then raise exception 'daily timesheet does not belong to user'; end if;

  if v_timesheet.status='REVIEWED' then
    if v_timesheet.review_operation_id=p_operation_id
       and coalesce(v_timesheet.remarks,'')=coalesce(nullif(trim(p_remarks),''),'') then return; end if;
    raise exception 'daily timesheet is already reviewed';
  end if;

  update public.daily_timesheets set
    status='REVIEWED',
    remarks=nullif(trim(p_remarks),''),
    reviewed_at=clock_timestamp(),
    review_operation_id=p_operation_id
  where tenant_id=p_tenant_id and id=p_timesheet_id;
end;
$$;
revoke all on function public.admin_review_daily_timesheet(uuid,uuid,uuid,uuid,text) from public;
grant execute on function public.admin_review_daily_timesheet(uuid,uuid,uuid,uuid,text) to service_role;

alter table public.daily_timesheets enable row level security;
revoke all on public.daily_timesheets from anon,authenticated;
grant select on public.daily_timesheets to authenticated;

create policy daily_timesheets_owner_or_team_read on public.daily_timesheets
for select to authenticated using(
  exists(
    select 1 from public.employees employee
     where employee.tenant_id=daily_timesheets.tenant_id
       and employee.id=daily_timesheets.employee_id
       and employee.user_id=auth.uid()
       and employee.status='active'
  )
  or exists(
    select 1 from public.tour_executions execution
     where execution.tenant_id=daily_timesheets.tenant_id
       and execution.id=daily_timesheets.execution_id
       and public.can_access_tour_plan(execution.tenant_id,execution.tour_plan_id,'TOUR_VIEW_TEAM')
  )
);

commit;
