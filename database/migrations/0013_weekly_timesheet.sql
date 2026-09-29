begin;

insert into public.role_permissions(role_key,permission_key) values
  ('TENANT_ADMIN','TIMESHEET_VIEW_TEAM'),
  ('TENANT_ADMIN','TIMESHEET_APPROVE'),
  ('MANAGER','TIMESHEET_VIEW_TEAM'),
  ('MANAGER','TIMESHEET_APPROVE')
on conflict do nothing;

create table public.weekly_timesheets(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  week_start date not null check(extract(isodow from week_start)=1),
  status text not null default 'DRAFT' check(status in('DRAFT','SUBMITTED','APPROVED','RETURNED')),
  daily_count integer not null default 0 check(daily_count>=0),
  total_minutes integer not null default 0 check(total_minutes>=0),
  visit_minutes integer not null default 0 check(visit_minutes>=0),
  unclassified_minutes integer not null default 0 check(unclassified_minutes>=0),
  call_count integer not null default 0 check(call_count>=0),
  submission_comment text,
  submitted_at timestamptz,
  submit_operation_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,employee_id,week_start),
  unique(tenant_id,employee_id,submit_operation_id),
  foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict,
  foreign key(tenant_id,reviewed_by) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);

create table public.weekly_timesheet_days(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  weekly_timesheet_id uuid not null,
  daily_timesheet_id uuid not null,
  unique(tenant_id,weekly_timesheet_id,daily_timesheet_id),
  unique(tenant_id,daily_timesheet_id),
  foreign key(tenant_id,weekly_timesheet_id) references public.weekly_timesheets(tenant_id,id) on delete cascade,
  foreign key(tenant_id,daily_timesheet_id) references public.daily_timesheets(tenant_id,id) on delete restrict
);

create table public.weekly_timesheet_decisions(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  weekly_timesheet_id uuid not null,
  actor_user_id uuid not null,
  decision text not null check(decision in('APPROVE','RETURN')),
  from_status text not null,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now(),
  foreign key(tenant_id,weekly_timesheet_id) references public.weekly_timesheets(tenant_id,id) on delete restrict,
  foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);

create or replace function public.admin_generate_weekly_timesheet(
  p_tenant_id uuid,p_user_id uuid,p_week_start date
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_employee public.employees%rowtype;
  v_weekly public.weekly_timesheets%rowtype;
  v_daily_count integer;
  v_total integer;
  v_visit integer;
  v_unclassified integer;
  v_calls integer;
begin
  if extract(isodow from p_week_start)<>1 then raise exception 'week start must be Monday'; end if;

  select employee.* into v_employee from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.user_id=p_user_id and employee.status='active';
  if v_employee.id is null then raise exception 'active employee not found'; end if;

  select weekly.* into v_weekly
    from public.weekly_timesheets weekly
   where weekly.tenant_id=p_tenant_id
     and weekly.employee_id=v_employee.id
     and weekly.week_start=p_week_start
   for update;

  if v_weekly.id is not null and v_weekly.status not in('DRAFT','RETURNED') then
    raise exception 'weekly timesheet is not editable';
  end if;

  select count(*)::integer,
         coalesce(sum(total_minutes),0)::integer,
         coalesce(sum(visit_minutes),0)::integer,
         coalesce(sum(unclassified_minutes),0)::integer,
         coalesce(sum(call_count),0)::integer
    into v_daily_count,v_total,v_visit,v_unclassified,v_calls
    from public.daily_timesheets daily
   where daily.tenant_id=p_tenant_id
     and daily.employee_id=v_employee.id
     and daily.work_date between p_week_start and p_week_start+6
     and daily.status='REVIEWED';

  if v_daily_count=0 then raise exception 'no reviewed daily timesheets exist for week'; end if;

  if v_weekly.id is null then
    insert into public.weekly_timesheets(
      tenant_id,employee_id,week_start,daily_count,total_minutes,visit_minutes,unclassified_minutes,call_count
    ) values(
      p_tenant_id,v_employee.id,p_week_start,v_daily_count,v_total,v_visit,v_unclassified,v_calls
    ) returning * into v_weekly;
  else
    update public.weekly_timesheets set
      status='DRAFT',
      daily_count=v_daily_count,total_minutes=v_total,visit_minutes=v_visit,
      unclassified_minutes=v_unclassified,call_count=v_calls,
      submission_comment=null,submitted_at=null,submit_operation_id=null,
      reviewed_by=null,reviewed_at=null,review_comment=null,updated_at=clock_timestamp()
     where tenant_id=p_tenant_id and id=v_weekly.id
     returning * into v_weekly;

    delete from public.weekly_timesheet_days
     where tenant_id=p_tenant_id and weekly_timesheet_id=v_weekly.id;
  end if;

  insert into public.weekly_timesheet_days(tenant_id,weekly_timesheet_id,daily_timesheet_id)
  select p_tenant_id,v_weekly.id,daily.id
    from public.daily_timesheets daily
   where daily.tenant_id=p_tenant_id
     and daily.employee_id=v_employee.id
     and daily.work_date between p_week_start and p_week_start+6
     and daily.status='REVIEWED'
   order by daily.work_date;

  return v_weekly.id;
end;
$$;

create or replace function public.admin_submit_weekly_timesheet(
  p_tenant_id uuid,p_user_id uuid,p_timesheet_id uuid,p_operation_id uuid,p_comment text
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_weekly public.weekly_timesheets%rowtype; v_owner uuid;
begin
  select weekly.* into v_weekly from public.weekly_timesheets weekly
   where weekly.tenant_id=p_tenant_id and weekly.id=p_timesheet_id for update;
  if v_weekly.id is null then raise exception 'weekly timesheet not found'; end if;

  select employee.user_id into v_owner from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.id=v_weekly.employee_id;
  if v_owner is distinct from p_user_id then raise exception 'weekly timesheet does not belong to user'; end if;

  if v_weekly.status='SUBMITTED' and v_weekly.submit_operation_id=p_operation_id then
    if coalesce(v_weekly.submission_comment,'')=coalesce(nullif(trim(p_comment),''),'') then return; end if;
    raise exception 'idempotency key reused with different payload';
  end if;
  if v_weekly.status not in('DRAFT','RETURNED') then raise exception 'weekly timesheet cannot be submitted'; end if;

  update public.weekly_timesheets set
    status='SUBMITTED',submitted_at=clock_timestamp(),submit_operation_id=p_operation_id,
    submission_comment=nullif(trim(p_comment),''),updated_at=clock_timestamp()
   where tenant_id=p_tenant_id and id=p_timesheet_id;
end;
$$;

create or replace function public.admin_decide_weekly_timesheet(
  p_tenant_id uuid,p_actor_user_id uuid,p_timesheet_id uuid,p_decision text,p_comment text
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_weekly public.weekly_timesheets%rowtype;
  v_employee public.employees%rowtype;
  v_to text;
begin
  select weekly.* into v_weekly from public.weekly_timesheets weekly
   where weekly.tenant_id=p_tenant_id and weekly.id=p_timesheet_id for update;
  if v_weekly.id is null or v_weekly.status<>'SUBMITTED' then raise exception 'submitted weekly timesheet not found'; end if;

  select employee.* into v_employee from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.id=v_weekly.employee_id;
  if v_employee.user_id=p_actor_user_id then raise exception 'self approval is not allowed'; end if;

  if not public.user_has_permission(p_tenant_id,p_actor_user_id,'TIMESHEET_APPROVE',v_employee.org_unit_id) then
    raise exception 'timesheet approval permission denied';
  end if;

  if p_decision='APPROVE' then v_to:='APPROVED';
  elsif p_decision='RETURN' then
    v_to:='RETURNED';
    if nullif(trim(p_comment),'') is null then raise exception 'return comment required'; end if;
  else raise exception 'invalid timesheet decision';
  end if;

  update public.weekly_timesheets set
    status=v_to,reviewed_by=p_actor_user_id,reviewed_at=clock_timestamp(),
    review_comment=nullif(trim(p_comment),''),updated_at=clock_timestamp()
   where tenant_id=p_tenant_id and id=p_timesheet_id;

  insert into public.weekly_timesheet_decisions(
    tenant_id,weekly_timesheet_id,actor_user_id,decision,from_status,to_status,comment
  ) values(p_tenant_id,p_timesheet_id,p_actor_user_id,p_decision,'SUBMITTED',v_to,nullif(trim(p_comment),''));
end;
$$;

revoke all on function public.admin_generate_weekly_timesheet(uuid,uuid,date) from public;
revoke all on function public.admin_submit_weekly_timesheet(uuid,uuid,uuid,uuid,text) from public;
revoke all on function public.admin_decide_weekly_timesheet(uuid,uuid,uuid,text,text) from public;
grant execute on function public.admin_generate_weekly_timesheet(uuid,uuid,date) to service_role;
grant execute on function public.admin_submit_weekly_timesheet(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.admin_decide_weekly_timesheet(uuid,uuid,uuid,text,text) to service_role;

alter table public.weekly_timesheets enable row level security;
alter table public.weekly_timesheet_days enable row level security;
alter table public.weekly_timesheet_decisions enable row level security;
revoke all on public.weekly_timesheets from anon,authenticated;
revoke all on public.weekly_timesheet_days from anon,authenticated;
revoke all on public.weekly_timesheet_decisions from anon,authenticated;
grant select on public.weekly_timesheets to authenticated;
grant select on public.weekly_timesheet_days to authenticated;
grant select on public.weekly_timesheet_decisions to authenticated;

create policy weekly_timesheets_owner_or_team_read on public.weekly_timesheets
for select to authenticated using(
  exists(
    select 1 from public.employees employee
     where employee.tenant_id=weekly_timesheets.tenant_id
       and employee.id=weekly_timesheets.employee_id
       and (
         (employee.user_id=auth.uid() and employee.status='active')
         or public.has_permission(weekly_timesheets.tenant_id,'TIMESHEET_VIEW_TEAM',employee.org_unit_id)
       )
  )
);

create policy weekly_timesheet_days_visible on public.weekly_timesheet_days
for select to authenticated using(exists(
  select 1 from public.weekly_timesheets weekly
   where weekly.tenant_id=weekly_timesheet_days.tenant_id
     and weekly.id=weekly_timesheet_days.weekly_timesheet_id
));

create policy weekly_timesheet_decisions_visible on public.weekly_timesheet_decisions
for select to authenticated using(exists(
  select 1 from public.weekly_timesheets weekly
   where weekly.tenant_id=weekly_timesheet_decisions.tenant_id
     and weekly.id=weekly_timesheet_decisions.weekly_timesheet_id
));

commit;
