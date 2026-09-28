begin;

create table public.tour_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, employee_id, week_start),
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete restrict
);

create table public.tour_plan_days (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  tour_plan_id uuid not null,
  plan_date date not null,
  territory_id uuid not null,
  remarks text,
  unique (tenant_id, id),
  unique (tenant_id, tour_plan_id, plan_date),
  foreign key (tenant_id, tour_plan_id)
    references public.tour_plans(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, territory_id)
    references public.organization_units(tenant_id, id)
    on delete restrict
);

create table public.tour_plan_stops (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  tour_plan_day_id uuid not null,
  sequence_no integer not null check (sequence_no > 0),
  stop_type text not null check (stop_type in ('doctor', 'chemist', 'stockist')),
  doctor_id uuid,
  chemist_id uuid,
  stockist_id uuid,
  remarks text,
  unique (tenant_id, id),
  unique (tenant_id, tour_plan_day_id, sequence_no),
  foreign key (tenant_id, tour_plan_day_id)
    references public.tour_plan_days(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, doctor_id)
    references public.doctors(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, chemist_id)
    references public.chemists(tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, stockist_id)
    references public.stockists(tenant_id, id)
    on delete restrict,
  check (
    (stop_type = 'doctor' and doctor_id is not null and chemist_id is null and stockist_id is null)
    or (stop_type = 'chemist' and doctor_id is null and chemist_id is not null and stockist_id is null)
    or (stop_type = 'stockist' and doctor_id is null and chemist_id is null and stockist_id is not null)
  )
);

create unique index tour_plan_stop_doctor_unique
  on public.tour_plan_stops (tenant_id, tour_plan_day_id, doctor_id)
  where doctor_id is not null;

create unique index tour_plan_stop_chemist_unique
  on public.tour_plan_stops (tenant_id, tour_plan_day_id, chemist_id)
  where chemist_id is not null;

create unique index tour_plan_stop_stockist_unique
  on public.tour_plan_stops (tenant_id, tour_plan_day_id, stockist_id)
  where stockist_id is not null;

create or replace function public.admin_save_tour_plan(
  p_tenant_id uuid,
  p_user_id uuid,
  p_plan_id uuid,
  p_week_start date,
  p_days jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_plan_id uuid;
  v_day jsonb;
  v_day_id uuid;
  v_stop jsonb;
  v_plan_date date;
  v_territory_id uuid;
  v_target_id uuid;
  v_stop_type text;
begin
  select employee.*
    into v_employee
    from public.employees employee
    join public.tenant_memberships membership
      on membership.tenant_id = employee.tenant_id
     and membership.user_id = employee.user_id
     and membership.status = 'active'
   where employee.tenant_id = p_tenant_id
     and employee.user_id = p_user_id
     and employee.status = 'active';

  if v_employee.id is null then
    raise exception 'active employee record not found';
  end if;

  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be Monday';
  end if;

  if p_week_start < date_trunc('week', current_date)::date then
    raise exception 'past tour plans cannot be created';
  end if;

  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) < 1 or jsonb_array_length(p_days) > 7 then
    raise exception 'days must contain 1 to 7 entries';
  end if;

  if p_plan_id is null then
    insert into public.tour_plans (tenant_id, employee_id, week_start)
    values (p_tenant_id, v_employee.id, p_week_start)
    returning id into v_plan_id;
  else
    select plan.id
      into v_plan_id
      from public.tour_plans plan
     where plan.tenant_id = p_tenant_id
       and plan.id = p_plan_id
       and plan.employee_id = v_employee.id
       and plan.status = 'DRAFT'
     for update;

    if v_plan_id is null then
      raise exception 'editable tour plan not found';
    end if;

    update public.tour_plans
       set week_start = p_week_start,
           updated_at = now()
     where id = v_plan_id;

    delete from public.tour_plan_days
     where tenant_id = p_tenant_id
       and tour_plan_id = v_plan_id;
  end if;

  for v_day in select value from jsonb_array_elements(p_days)
  loop
    v_plan_date := (v_day->>'date')::date;
    v_territory_id := (v_day->>'territoryId')::uuid;

    if v_plan_date < p_week_start or v_plan_date > p_week_start + 6 then
      raise exception 'plan date outside week';
    end if;

    if not exists (
      select 1 from public.organization_units unit
       where unit.tenant_id = p_tenant_id
         and unit.id = v_territory_id
         and unit.type = 'territory'
         and unit.status = 'active'
         and public.org_unit_in_scope(p_tenant_id, v_territory_id, v_employee.org_unit_id)
    ) then
      raise exception 'territory outside employee scope';
    end if;

    insert into public.tour_plan_days (
      tenant_id, tour_plan_id, plan_date, territory_id, remarks
    )
    values (
      p_tenant_id, v_plan_id, v_plan_date, v_territory_id, nullif(v_day->>'remarks', '')
    )
    returning id into v_day_id;

    for v_stop in select value from jsonb_array_elements(coalesce(v_day->'stops', '[]'::jsonb))
    loop
      v_stop_type := v_stop->>'type';
      v_target_id := (v_stop->>'targetId')::uuid;

      if v_stop_type = 'doctor' then
        if not exists (
          select 1 from public.doctors item
           where item.tenant_id = p_tenant_id
             and item.id = v_target_id
             and item.territory_id = v_territory_id
             and item.status = 'active'
        ) then raise exception 'doctor not active in plan territory'; end if;

        insert into public.tour_plan_stops (
          tenant_id, tour_plan_day_id, sequence_no, stop_type, doctor_id, remarks
        ) values (
          p_tenant_id, v_day_id, (v_stop->>'sequence')::integer, v_stop_type, v_target_id, nullif(v_stop->>'remarks', '')
        );
      elsif v_stop_type = 'chemist' then
        if not exists (
          select 1 from public.chemists item
           where item.tenant_id = p_tenant_id
             and item.id = v_target_id
             and item.territory_id = v_territory_id
             and item.status = 'active'
        ) then raise exception 'chemist not active in plan territory'; end if;

        insert into public.tour_plan_stops (
          tenant_id, tour_plan_day_id, sequence_no, stop_type, chemist_id, remarks
        ) values (
          p_tenant_id, v_day_id, (v_stop->>'sequence')::integer, v_stop_type, v_target_id, nullif(v_stop->>'remarks', '')
        );
      elsif v_stop_type = 'stockist' then
        if not exists (
          select 1 from public.stockists item
           where item.tenant_id = p_tenant_id
             and item.id = v_target_id
             and item.territory_id = v_territory_id
             and item.status = 'active'
        ) then raise exception 'stockist not active in plan territory'; end if;

        insert into public.tour_plan_stops (
          tenant_id, tour_plan_day_id, sequence_no, stop_type, stockist_id, remarks
        ) values (
          p_tenant_id, v_day_id, (v_stop->>'sequence')::integer, v_stop_type, v_target_id, nullif(v_stop->>'remarks', '')
        );
      else
        raise exception 'invalid stop type';
      end if;
    end loop;
  end loop;

  update public.tour_plans set updated_at = now() where id = v_plan_id;
  return v_plan_id;
end;
$$;

create or replace function public.admin_submit_tour_plan(
  p_tenant_id uuid,
  p_user_id uuid,
  p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  select employee.id
    into v_employee_id
    from public.employees employee
    join public.tenant_memberships membership
      on membership.tenant_id = employee.tenant_id
     and membership.user_id = employee.user_id
     and membership.status = 'active'
   where employee.tenant_id = p_tenant_id
     and employee.user_id = p_user_id
     and employee.status = 'active';

  if v_employee_id is null then raise exception 'active employee record not found'; end if;

  if not exists (
    select 1
      from public.tour_plan_days day
      join public.tour_plan_stops stop
        on stop.tenant_id = day.tenant_id
       and stop.tour_plan_day_id = day.id
     where day.tenant_id = p_tenant_id
       and day.tour_plan_id = p_plan_id
  ) then
    raise exception 'tour plan requires at least one stop';
  end if;

  update public.tour_plans
     set status = 'SUBMITTED',
         submitted_at = now(),
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_plan_id
     and employee_id = v_employee_id
     and status = 'DRAFT';

  if not found then raise exception 'draft tour plan not found'; end if;
end;
$$;

alter table public.tour_plans enable row level security;
alter table public.tour_plan_days enable row level security;
alter table public.tour_plan_stops enable row level security;

revoke all on public.tour_plans from anon, authenticated;
revoke all on public.tour_plan_days from anon, authenticated;
revoke all on public.tour_plan_stops from anon, authenticated;
grant select on public.tour_plans to authenticated;
grant select on public.tour_plan_days to authenticated;
grant select on public.tour_plan_stops to authenticated;

revoke all on function public.admin_save_tour_plan(uuid, uuid, uuid, date, jsonb) from public;
revoke all on function public.admin_submit_tour_plan(uuid, uuid, uuid) from public;
grant execute on function public.admin_save_tour_plan(uuid, uuid, uuid, date, jsonb) to service_role;
grant execute on function public.admin_submit_tour_plan(uuid, uuid, uuid) to service_role;

create policy tour_plans_own_read on public.tour_plans
for select to authenticated
using (
  exists (
    select 1 from public.employees employee
     where employee.tenant_id = tour_plans.tenant_id
       and employee.id = tour_plans.employee_id
       and employee.user_id = auth.uid()
       and employee.status = 'active'
  )
);

create policy tour_plan_days_own_read on public.tour_plan_days
for select to authenticated
using (
  exists (
    select 1
      from public.tour_plans plan
      join public.employees employee
        on employee.tenant_id = plan.tenant_id
       and employee.id = plan.employee_id
     where plan.tenant_id = tour_plan_days.tenant_id
       and plan.id = tour_plan_days.tour_plan_id
       and employee.user_id = auth.uid()
       and employee.status = 'active'
  )
);

create policy tour_plan_stops_own_read on public.tour_plan_stops
for select to authenticated
using (
  exists (
    select 1
      from public.tour_plan_days day
      join public.tour_plans plan
        on plan.tenant_id = day.tenant_id
       and plan.id = day.tour_plan_id
      join public.employees employee
        on employee.tenant_id = plan.tenant_id
       and employee.id = plan.employee_id
     where day.tenant_id = tour_plan_stops.tenant_id
       and day.id = tour_plan_stops.tour_plan_day_id
       and employee.user_id = auth.uid()
       and employee.status = 'active'
  )
);

commit;
