begin;

alter table public.tenants add column time_zone text not null default 'UTC';

create or replace function public.validate_tenant_timezone()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.time_zone) then
    raise exception 'invalid tenant time zone';
  end if;
  return new;
end;
$$;

create trigger tenants_timezone_guard
before insert or update of time_zone on public.tenants
for each row execute function public.validate_tenant_timezone();

create table public.tour_executions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  tour_plan_id uuid not null,
  tour_plan_day_id uuid not null,
  territory_id uuid not null,
  work_date date not null,
  status text not null default 'ACTIVE' check(status in('ACTIVE')),
  operation_id uuid not null,
  started_at timestamptz not null default clock_timestamp(),
  device_started_at timestamptz,
  required_minutes integer not null default 480 check(required_minutes between 1 and 1440),
  start_latitude double precision not null check(start_latitude between -90 and 90),
  start_longitude double precision not null check(start_longitude between -180 and 180),
  start_accuracy_meters double precision not null check(start_accuracy_meters between 0 and 1000),
  device_id text,
  network_type text,
  app_version text,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,employee_id,work_date),
  unique(tenant_id,employee_id,operation_id),
  foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict,
  foreign key(tenant_id,tour_plan_id) references public.tour_plans(tenant_id,id) on delete restrict,
  foreign key(tenant_id,tour_plan_day_id) references public.tour_plan_days(tenant_id,id) on delete restrict,
  foreign key(tenant_id,territory_id) references public.organization_units(tenant_id,id) on delete restrict
);

create unique index tour_executions_one_active_employee_idx
on public.tour_executions(tenant_id,employee_id)
where status='ACTIVE';

create or replace function public.my_start_tour_options(p_tenant_id uuid)
returns table(
  plan_id uuid,
  plan_day_id uuid,
  work_date date,
  territory_id uuid
)
language sql
stable
security definer
set search_path=''
as $$
  select plan.id,day.id,day.plan_date,day.territory_id
    from public.tour_plans plan
    join public.tour_plan_days day
      on day.tenant_id=plan.tenant_id and day.tour_plan_id=plan.id
    join public.employees employee
      on employee.tenant_id=plan.tenant_id and employee.id=plan.employee_id
    join public.tenants tenant on tenant.id=plan.tenant_id
   where plan.tenant_id=p_tenant_id
     and employee.user_id=auth.uid()
     and employee.status='active'
     and plan.status='APPROVED'
     and day.plan_date=(clock_timestamp() at time zone tenant.time_zone)::date
     and not exists(
       select 1 from public.tour_executions execution
        where execution.tenant_id=plan.tenant_id
          and execution.employee_id=employee.id
          and execution.work_date=day.plan_date
     );
$$;

revoke all on function public.my_start_tour_options(uuid) from public;
grant execute on function public.my_start_tour_options(uuid) to authenticated;

create or replace function public.admin_start_tour(
  p_tenant_id uuid,
  p_user_id uuid,
  p_operation_id uuid,
  p_plan_day_id uuid,
  p_device_started_at timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_device_id text,
  p_network_type text,
  p_app_version text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_employee public.employees%rowtype;
  v_day public.tour_plan_days%rowtype;
  v_plan public.tour_plans%rowtype;
  v_tenant_timezone text;
  v_existing_id uuid;
  v_id uuid;
begin
  select employee.* into v_employee
    from public.employees employee
    join public.tenant_memberships membership
      on membership.tenant_id=employee.tenant_id
     and membership.user_id=employee.user_id
     and membership.status='active'
   where employee.tenant_id=p_tenant_id
     and employee.user_id=p_user_id
     and employee.status='active';
  if v_employee.id is null then raise exception 'active employee record not found'; end if;

  select execution.id into v_existing_id
    from public.tour_executions execution
   where execution.tenant_id=p_tenant_id
     and execution.employee_id=v_employee.id
     and execution.operation_id=p_operation_id;
  if v_existing_id is not null then return v_existing_id; end if;

  if exists(
    select 1 from public.tour_executions execution
     where execution.tenant_id=p_tenant_id
       and execution.employee_id=v_employee.id
       and execution.status='ACTIVE'
  ) then raise exception 'active tour already exists'; end if;

  select day.* into v_day
    from public.tour_plan_days day
   where day.tenant_id=p_tenant_id and day.id=p_plan_day_id;
  if v_day.id is null then raise exception 'tour plan day not found'; end if;

  select plan.* into v_plan
    from public.tour_plans plan
   where plan.tenant_id=p_tenant_id
     and plan.id=v_day.tour_plan_id
     and plan.employee_id=v_employee.id
     and plan.status='APPROVED';
  if v_plan.id is null then raise exception 'approved owned tour plan not found'; end if;

  select tenant.time_zone into v_tenant_timezone from public.tenants tenant where tenant.id=p_tenant_id;
  if v_day.plan_date<>(clock_timestamp() at time zone v_tenant_timezone)::date then
    raise exception 'tour can only start on its planned local date';
  end if;

  if p_accuracy_meters<0 or p_accuracy_meters>1000 then raise exception 'invalid GPS accuracy'; end if;

  insert into public.tour_executions(
    tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,
    operation_id,device_started_at,start_latitude,start_longitude,start_accuracy_meters,
    device_id,network_type,app_version
  ) values(
    p_tenant_id,v_employee.id,v_plan.id,v_day.id,v_day.territory_id,v_day.plan_date,
    p_operation_id,p_device_started_at,p_latitude,p_longitude,p_accuracy_meters,
    nullif(trim(p_device_id),''),nullif(trim(p_network_type),''),nullif(trim(p_app_version),'')
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_start_tour(uuid,uuid,uuid,uuid,timestamptz,double precision,double precision,double precision,text,text,text) from public;
grant execute on function public.admin_start_tour(uuid,uuid,uuid,uuid,timestamptz,double precision,double precision,double precision,text,text,text) to service_role;

alter table public.tour_executions enable row level security;
revoke all on public.tour_executions from anon,authenticated;
grant select on public.tour_executions to authenticated;

create policy tour_executions_owner_read on public.tour_executions
for select to authenticated
using(exists(
  select 1 from public.employees employee
   where employee.tenant_id=tour_executions.tenant_id
     and employee.id=tour_executions.employee_id
     and employee.user_id=auth.uid()
     and employee.status='active'
));

commit;
