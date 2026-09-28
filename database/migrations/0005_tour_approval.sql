begin;

alter table public.tour_plans
  drop constraint if exists tour_plans_status_check;

alter table public.tour_plans
  add constraint tour_plans_status_check
  check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','RETURNED'));

alter table public.tour_plans
  add column reviewed_at timestamptz,
  add column reviewed_by uuid,
  add constraint tour_plans_reviewed_by_fk
    foreign key (tenant_id, reviewed_by)
    references public.tenant_memberships(tenant_id, user_id)
    on delete restrict;

create table public.tour_plan_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  tour_plan_id uuid not null,
  actor_user_id uuid not null,
  decision text not null check (decision in ('APPROVE','REJECT','RETURN')),
  from_status text not null,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, tour_plan_id)
    references public.tour_plans(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, actor_user_id)
    references public.tenant_memberships(tenant_id, user_id)
    on delete restrict
);

create index tour_plan_decisions_plan_idx
  on public.tour_plan_decisions(tenant_id, tour_plan_id, created_at);

create or replace function public.user_has_plan_permission(
  p_tenant_id uuid,
  p_user_id uuid,
  p_plan_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
      from public.tenant_memberships membership
      join public.user_role_assignments assignment
        on assignment.tenant_id=membership.tenant_id
       and assignment.user_id=membership.user_id
       and assignment.status='active'
      join public.role_permissions permission
        on permission.role_key=assignment.role_key
       and permission.permission_key=p_permission
     where membership.tenant_id=p_tenant_id
       and membership.user_id=p_user_id
       and membership.status='active'
       and exists (
         select 1 from public.tour_plans plan
          where plan.tenant_id=p_tenant_id and plan.id=p_plan_id
       )
       and (
         assignment.scope_org_unit_id is null
         or not exists (
           select 1
             from public.tour_plan_days day
            where day.tenant_id=p_tenant_id
              and day.tour_plan_id=p_plan_id
              and not public.org_unit_in_scope(
                p_tenant_id, day.territory_id, assignment.scope_org_unit_id
              )
         )
       )
  );
$$;

create or replace function public.can_access_tour_plan(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.user_has_plan_permission(
    p_tenant_id, auth.uid(), p_plan_id, p_permission
  );
$$;

revoke all on function public.user_has_plan_permission(uuid,uuid,uuid,text) from public;
revoke all on function public.can_access_tour_plan(uuid,uuid,text) from public;
grant execute on function public.can_access_tour_plan(uuid,uuid,text) to authenticated;

drop policy if exists tour_plans_own_read on public.tour_plans;
drop policy if exists tour_plan_days_own_read on public.tour_plan_days;
drop policy if exists tour_plan_stops_own_read on public.tour_plan_stops;

create policy tour_plans_owner_or_team_read on public.tour_plans
for select to authenticated
using (
  exists (
    select 1 from public.employees employee
     where employee.tenant_id=tour_plans.tenant_id
       and employee.id=tour_plans.employee_id
       and employee.user_id=auth.uid()
       and employee.status='active'
  )
  or public.can_access_tour_plan(tenant_id,id,'TOUR_VIEW_TEAM')
);

create policy tour_plan_days_owner_or_team_read on public.tour_plan_days
for select to authenticated
using (
  exists (
    select 1
      from public.tour_plans plan
      join public.employees employee
        on employee.tenant_id=plan.tenant_id
       and employee.id=plan.employee_id
     where plan.tenant_id=tour_plan_days.tenant_id
       and plan.id=tour_plan_days.tour_plan_id
       and employee.user_id=auth.uid()
       and employee.status='active'
  )
  or public.can_access_tour_plan(tenant_id,tour_plan_id,'TOUR_VIEW_TEAM')
);

create policy tour_plan_stops_owner_or_team_read on public.tour_plan_stops
for select to authenticated
using (
  exists (
    select 1
      from public.tour_plan_days day
      join public.tour_plans plan
        on plan.tenant_id=day.tenant_id
       and plan.id=day.tour_plan_id
      join public.employees employee
        on employee.tenant_id=plan.tenant_id
       and employee.id=plan.employee_id
     where day.tenant_id=tour_plan_stops.tenant_id
       and day.id=tour_plan_stops.tour_plan_day_id
       and employee.user_id=auth.uid()
       and employee.status='active'
  )
  or exists (
    select 1 from public.tour_plan_days day
     where day.tenant_id=tour_plan_stops.tenant_id
       and day.id=tour_plan_stops.tour_plan_day_id
       and public.can_access_tour_plan(day.tenant_id,day.tour_plan_id,'TOUR_VIEW_TEAM')
  )
);

alter table public.tour_plan_decisions enable row level security;
revoke all on public.tour_plan_decisions from anon,authenticated;
grant select on public.tour_plan_decisions to authenticated;

create policy tour_plan_decisions_owner_or_team_read on public.tour_plan_decisions
for select to authenticated
using (
  exists (
    select 1
      from public.tour_plans plan
      join public.employees employee
        on employee.tenant_id=plan.tenant_id and employee.id=plan.employee_id
     where plan.tenant_id=tour_plan_decisions.tenant_id
       and plan.id=tour_plan_decisions.tour_plan_id
       and employee.user_id=auth.uid()
  )
  or public.can_access_tour_plan(tenant_id,tour_plan_id,'TOUR_VIEW_TEAM')
);

create or replace function public.admin_decide_tour_plan(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_decision text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_plan public.tour_plans%rowtype;
  v_owner_user_id uuid;
  v_to_status text;
begin
  select plan.* into v_plan
    from public.tour_plans plan
   where plan.tenant_id=p_tenant_id
     and plan.id=p_plan_id
   for update;

  if v_plan.id is null or v_plan.status <> 'SUBMITTED' then
    raise exception 'submitted tour plan not found';
  end if;

  select employee.user_id into v_owner_user_id
    from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.id=v_plan.employee_id;

  if v_owner_user_id = p_actor_user_id then
    raise exception 'self approval is not allowed';
  end if;

  if not public.user_has_plan_permission(
    p_tenant_id,p_actor_user_id,p_plan_id,'TOUR_APPROVE'
  ) then
    raise exception 'tour approval permission denied';
  end if;

  if p_decision='APPROVE' then
    v_to_status:='APPROVED';
  elsif p_decision='REJECT' then
    v_to_status:='REJECTED';
    if nullif(trim(p_comment),'') is null then raise exception 'reject comment required'; end if;
  elsif p_decision='RETURN' then
    v_to_status:='RETURNED';
    if nullif(trim(p_comment),'') is null then raise exception 'return comment required'; end if;
  else
    raise exception 'invalid tour decision';
  end if;

  update public.tour_plans
     set status=v_to_status,
         reviewed_at=now(),
         reviewed_by=p_actor_user_id,
         updated_at=now()
   where tenant_id=p_tenant_id and id=p_plan_id;

  insert into public.tour_plan_decisions(
    tenant_id,tour_plan_id,actor_user_id,decision,from_status,to_status,comment
  ) values (
    p_tenant_id,p_plan_id,p_actor_user_id,p_decision,'SUBMITTED',v_to_status,nullif(trim(p_comment),'')
  );
end;
$$;

revoke all on function public.admin_decide_tour_plan(uuid,uuid,uuid,text,text) from public;
grant execute on function public.admin_decide_tour_plan(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.admin_save_tour_plan(
  p_tenant_id uuid,p_user_id uuid,p_plan_id uuid,p_week_start date,p_days jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_employee public.employees%rowtype;
  v_plan_id uuid; v_day jsonb; v_day_id uuid; v_stop jsonb;
  v_plan_date date; v_territory_id uuid; v_target_id uuid; v_stop_type text;
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
  if extract(isodow from p_week_start)<>1 then raise exception 'week_start must be Monday'; end if;
  if p_week_start < date_trunc('week',current_date)::date then raise exception 'past tour plans cannot be created'; end if;
  if jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)<1 or jsonb_array_length(p_days)>7 then
    raise exception 'days must contain 1 to 7 entries';
  end if;

  if p_plan_id is null then
    insert into public.tour_plans(tenant_id,employee_id,week_start)
    values(p_tenant_id,v_employee.id,p_week_start) returning id into v_plan_id;
  else
    select plan.id into v_plan_id from public.tour_plans plan
     where plan.tenant_id=p_tenant_id and plan.id=p_plan_id
       and plan.employee_id=v_employee.id and plan.status in ('DRAFT','RETURNED')
     for update;
    if v_plan_id is null then raise exception 'editable tour plan not found'; end if;
    update public.tour_plans set week_start=p_week_start,updated_at=now()
     where tenant_id=p_tenant_id and id=v_plan_id;
    delete from public.tour_plan_days where tenant_id=p_tenant_id and tour_plan_id=v_plan_id;
  end if;

  for v_day in select value from jsonb_array_elements(p_days) loop
    v_plan_date:=(v_day->>'date')::date;
    v_territory_id:=(v_day->>'territoryId')::uuid;
    if v_plan_date<p_week_start or v_plan_date>p_week_start+6 then raise exception 'plan date outside week'; end if;
    if not exists(
      select 1 from public.organization_units unit
       where unit.tenant_id=p_tenant_id and unit.id=v_territory_id
         and unit.type='territory' and unit.status='active'
         and public.org_unit_in_scope(p_tenant_id,v_territory_id,v_employee.org_unit_id)
    ) then raise exception 'territory outside employee scope'; end if;

    insert into public.tour_plan_days(tenant_id,tour_plan_id,plan_date,territory_id,remarks)
    values(p_tenant_id,v_plan_id,v_plan_date,v_territory_id,nullif(v_day->>'remarks',''))
    returning id into v_day_id;

    for v_stop in select value from jsonb_array_elements(coalesce(v_day->'stops','[]'::jsonb)) loop
      v_stop_type:=v_stop->>'type'; v_target_id:=(v_stop->>'targetId')::uuid;
      if v_stop_type='doctor' then
        if not exists(select 1 from public.doctors x where x.tenant_id=p_tenant_id and x.id=v_target_id and x.territory_id=v_territory_id and x.status='active') then raise exception 'doctor not active in plan territory'; end if;
        insert into public.tour_plan_stops(tenant_id,tour_plan_day_id,sequence_no,stop_type,doctor_id,remarks)
        values(p_tenant_id,v_day_id,(v_stop->>'sequence')::integer,v_stop_type,v_target_id,nullif(v_stop->>'remarks',''));
      elsif v_stop_type='chemist' then
        if not exists(select 1 from public.chemists x where x.tenant_id=p_tenant_id and x.id=v_target_id and x.territory_id=v_territory_id and x.status='active') then raise exception 'chemist not active in plan territory'; end if;
        insert into public.tour_plan_stops(tenant_id,tour_plan_day_id,sequence_no,stop_type,chemist_id,remarks)
        values(p_tenant_id,v_day_id,(v_stop->>'sequence')::integer,v_stop_type,v_target_id,nullif(v_stop->>'remarks',''));
      elsif v_stop_type='stockist' then
        if not exists(select 1 from public.stockists x where x.tenant_id=p_tenant_id and x.id=v_target_id and x.territory_id=v_territory_id and x.status='active') then raise exception 'stockist not active in plan territory'; end if;
        insert into public.tour_plan_stops(tenant_id,tour_plan_day_id,sequence_no,stop_type,stockist_id,remarks)
        values(p_tenant_id,v_day_id,(v_stop->>'sequence')::integer,v_stop_type,v_target_id,nullif(v_stop->>'remarks',''));
      else raise exception 'invalid stop type';
      end if;
    end loop;
  end loop;
  update public.tour_plans set updated_at=now() where tenant_id=p_tenant_id and id=v_plan_id;
  return v_plan_id;
end;
$$;

create or replace function public.admin_submit_tour_plan(
  p_tenant_id uuid,p_user_id uuid,p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_employee_id uuid;
begin
  select employee.id into v_employee_id
    from public.employees employee
    join public.tenant_memberships membership
      on membership.tenant_id=employee.tenant_id
     and membership.user_id=employee.user_id and membership.status='active'
   where employee.tenant_id=p_tenant_id and employee.user_id=p_user_id and employee.status='active';
  if v_employee_id is null then raise exception 'active employee record not found'; end if;
  if not exists(
    select 1 from public.tour_plan_days day
    join public.tour_plan_stops stop on stop.tenant_id=day.tenant_id and stop.tour_plan_day_id=day.id
    where day.tenant_id=p_tenant_id and day.tour_plan_id=p_plan_id
  ) then raise exception 'tour plan requires at least one stop'; end if;
  update public.tour_plans
     set status='SUBMITTED',submitted_at=now(),reviewed_at=null,reviewed_by=null,updated_at=now()
   where tenant_id=p_tenant_id and id=p_plan_id and employee_id=v_employee_id
     and status in ('DRAFT','RETURNED');
  if not found then raise exception 'submittable tour plan not found'; end if;
end;
$$;

commit;
