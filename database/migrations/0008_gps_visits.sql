begin;

alter table public.tenants
  add column geofence_radius_meters integer not null default 100
    check(geofence_radius_meters in(50,100,200)),
  add column max_gps_accuracy_meters double precision not null default 50
    check(max_gps_accuracy_meters between 5 and 500);

create or replace function public.geo_distance_meters(
  p_lat1 double precision,p_lon1 double precision,p_lat2 double precision,p_lon2 double precision
)
returns double precision
language sql immutable parallel safe
as $$
  select 6371000 * 2 * asin(least(1.0, sqrt(
    power(sin(radians(p_lat2-p_lat1)/2),2) +
    cos(radians(p_lat1))*cos(radians(p_lat2))*power(sin(radians(p_lon2-p_lon1)/2),2)
  )));
$$;

create table public.field_visits(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  execution_id uuid not null,
  plan_stop_id uuid not null,
  territory_id uuid not null,
  status text not null default 'CHECKED_IN' check(status in('CHECKED_IN','CHECKED_OUT')),
  checkin_operation_id uuid not null,
  checkout_operation_id uuid,
  checkin_at timestamptz not null default clock_timestamp(),
  checkout_at timestamptz,
  checkin_latitude double precision not null check(checkin_latitude between -90 and 90),
  checkin_longitude double precision not null check(checkin_longitude between -180 and 180),
  checkin_accuracy_meters double precision not null check(checkin_accuracy_meters between 0 and 1000),
  checkout_latitude double precision check(checkout_latitude between -90 and 90),
  checkout_longitude double precision check(checkout_longitude between -180 and 180),
  checkout_accuracy_meters double precision check(checkout_accuracy_meters between 0 and 1000),
  target_latitude double precision,
  target_longitude double precision,
  distance_meters double precision,
  geofence_radius_meters integer not null,
  verification text not null check(verification in('VERIFIED','OUTSIDE_GEOFENCE','LOW_ACCURACY','NO_TARGET_COORDINATES')),
  exception_reason text,
  exception_status text not null check(exception_status in('NOT_REQUIRED','PENDING','APPROVED','REJECTED')),
  exception_reviewed_by uuid,
  exception_reviewed_at timestamptz,
  exception_review_comment text,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,execution_id,plan_stop_id),
  unique(tenant_id,execution_id,checkin_operation_id),
  foreign key(tenant_id,execution_id) references public.tour_executions(tenant_id,id) on delete restrict,
  foreign key(tenant_id,plan_stop_id) references public.tour_plan_stops(tenant_id,id) on delete restrict,
  foreign key(tenant_id,territory_id) references public.organization_units(tenant_id,id) on delete restrict,
  foreign key(tenant_id,exception_reviewed_by) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);

create unique index field_visits_one_open_per_execution
on public.field_visits(tenant_id,execution_id) where status='CHECKED_IN';

create unique index field_visits_checkout_operation_unique
on public.field_visits(tenant_id,execution_id,checkout_operation_id)
where checkout_operation_id is not null;

create or replace function public.admin_checkin_visit(
  p_tenant_id uuid,p_user_id uuid,p_operation_id uuid,p_plan_stop_id uuid,
  p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision,
  p_exception_reason text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_execution public.tour_executions%rowtype;
  v_stop public.tour_plan_stops%rowtype;
  v_radius integer; v_max_accuracy double precision;
  v_target_lat double precision; v_target_lon double precision;
  v_distance double precision; v_verification text; v_exception_status text; v_id uuid;
begin
  select execution.* into v_execution
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.status='ACTIVE'
     and employee.user_id=p_user_id and employee.status='active';
  if v_execution.id is null then raise exception 'active tour not found'; end if;

  select visit.id into v_id from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.execution_id=v_execution.id
     and visit.checkin_operation_id=p_operation_id;
  if v_id is not null then return v_id; end if;

  if exists(select 1 from public.field_visits visit where visit.tenant_id=p_tenant_id and visit.execution_id=v_execution.id and visit.status='CHECKED_IN') then
    raise exception 'another visit is already checked in';
  end if;

  select stop.* into v_stop from public.tour_plan_stops stop
   where stop.tenant_id=p_tenant_id and stop.id=p_plan_stop_id
     and stop.tour_plan_day_id=v_execution.tour_plan_day_id;
  if v_stop.id is null then raise exception 'planned stop not found for active tour'; end if;

  select tenant.geofence_radius_meters,tenant.max_gps_accuracy_meters
    into v_radius,v_max_accuracy from public.tenants tenant where tenant.id=p_tenant_id;

  if v_stop.stop_type='doctor' then
    select latitude,longitude into v_target_lat,v_target_lon from public.doctors where tenant_id=p_tenant_id and id=v_stop.doctor_id and status='active';
  elsif v_stop.stop_type='chemist' then
    select latitude,longitude into v_target_lat,v_target_lon from public.chemists where tenant_id=p_tenant_id and id=v_stop.chemist_id and status='active';
  elsif v_stop.stop_type='stockist' then
    select latitude,longitude into v_target_lat,v_target_lon from public.stockists where tenant_id=p_tenant_id and id=v_stop.stockist_id and status='active';
  end if;

  if v_target_lat is null or v_target_lon is null then
    v_verification:='NO_TARGET_COORDINATES'; v_distance:=null;
  else
    v_distance:=public.geo_distance_meters(p_latitude,p_longitude,v_target_lat,v_target_lon);
    if p_accuracy_meters>v_max_accuracy then v_verification:='LOW_ACCURACY';
    elsif v_distance>v_radius then v_verification:='OUTSIDE_GEOFENCE';
    else v_verification:='VERIFIED'; end if;
  end if;

  if v_verification='VERIFIED' then
    v_exception_status:='NOT_REQUIRED';
  else
    if nullif(trim(p_exception_reason),'') is null then raise exception 'GPS exception reason required'; end if;
    v_exception_status:='PENDING';
  end if;

  insert into public.field_visits(
    tenant_id,execution_id,plan_stop_id,territory_id,checkin_operation_id,
    checkin_latitude,checkin_longitude,checkin_accuracy_meters,target_latitude,target_longitude,
    distance_meters,geofence_radius_meters,verification,exception_reason,exception_status
  ) values(
    p_tenant_id,v_execution.id,v_stop.id,v_execution.territory_id,p_operation_id,
    p_latitude,p_longitude,p_accuracy_meters,v_target_lat,v_target_lon,
    v_distance,v_radius,v_verification,nullif(trim(p_exception_reason),''),v_exception_status
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_checkout_visit(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,
  p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_visit public.field_visits%rowtype; v_owner uuid;
begin
  select visit.* into v_visit from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
  if v_visit.id is null then raise exception 'visit not found'; end if;

  if v_visit.status='CHECKED_OUT' then
    if v_visit.checkout_operation_id=p_operation_id then return; end if;
    raise exception 'visit already checked out';
  end if;

  select employee.user_id into v_owner
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'visit does not belong to active user'; end if;

  update public.field_visits set
    status='CHECKED_OUT',checkout_operation_id=p_operation_id,checkout_at=clock_timestamp(),
    checkout_latitude=p_latitude,checkout_longitude=p_longitude,checkout_accuracy_meters=p_accuracy_meters
   where tenant_id=p_tenant_id and id=p_visit_id;
end;
$$;

create or replace function public.admin_review_visit_exception(
  p_tenant_id uuid,p_actor_user_id uuid,p_visit_id uuid,p_decision text,p_comment text
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_visit public.field_visits%rowtype; v_plan_id uuid; v_owner uuid;
begin
  select visit.* into v_visit from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
  if v_visit.id is null or v_visit.exception_status<>'PENDING' then raise exception 'pending GPS exception not found'; end if;

  select execution.tour_plan_id,employee.user_id into v_plan_id,v_owner
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id;

  if v_owner=p_actor_user_id then raise exception 'self review is not allowed'; end if;
  if not public.user_has_plan_permission(p_tenant_id,p_actor_user_id,v_plan_id,'TOUR_APPROVE') then
    raise exception 'GPS exception review permission denied';
  end if;
  if p_decision not in('APPROVE','REJECT') then raise exception 'invalid GPS exception decision'; end if;
  if p_decision='REJECT' and nullif(trim(p_comment),'') is null then raise exception 'reject comment required'; end if;

  update public.field_visits set
    exception_status=case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
    exception_reviewed_by=p_actor_user_id,exception_reviewed_at=clock_timestamp(),
    exception_review_comment=nullif(trim(p_comment),'')
   where tenant_id=p_tenant_id and id=p_visit_id;
end;
$$;

alter table public.field_visits enable row level security;
revoke all on public.field_visits from anon,authenticated;
grant select on public.field_visits to authenticated;

create policy field_visits_owner_or_team_read on public.field_visits
for select to authenticated using(
  exists(
    select 1 from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
    where execution.tenant_id=field_visits.tenant_id and execution.id=field_visits.execution_id
      and employee.user_id=auth.uid() and employee.status='active'
  )
  or exists(
    select 1 from public.tour_executions execution
    where execution.tenant_id=field_visits.tenant_id and execution.id=field_visits.execution_id
      and public.can_access_tour_plan(execution.tenant_id,execution.tour_plan_id,'TOUR_VIEW_TEAM')
  )
);

revoke all on function public.admin_checkin_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision,text) from public;
revoke all on function public.admin_checkout_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision) from public;
revoke all on function public.admin_review_visit_exception(uuid,uuid,uuid,text,text) from public;
grant execute on function public.admin_checkin_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision,text) to service_role;
grant execute on function public.admin_checkout_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision) to service_role;
grant execute on function public.admin_review_visit_exception(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.my_active_tour_progress(p_tenant_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_execution public.tour_executions%rowtype; v_now timestamptz:=clock_timestamp();
  v_stops jsonb; v_planned integer; v_completed integer; v_in_progress integer; v_elapsed integer;
begin
  select execution.* into v_execution from public.tour_executions execution
  join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
  where execution.tenant_id=p_tenant_id and execution.status='ACTIVE'
    and employee.user_id=auth.uid() and employee.status='active'
  order by execution.started_at desc limit 1;
  if v_execution.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence',stop.sequence_no,'type',stop.stop_type,
    'targetId',coalesce(stop.doctor_id,stop.chemist_id,stop.stockist_id),
    'targetName',coalesce(doctor.name,chemist.name,stockist.name,'Unknown'),
    'status',case when visit.status='CHECKED_OUT' then 'COMPLETED' when visit.status='CHECKED_IN' then 'IN_PROGRESS' else 'PENDING' end
  ) order by stop.sequence_no),'[]'::jsonb),
  count(*)::integer,
  count(*) filter(where visit.status='CHECKED_OUT')::integer,
  count(*) filter(where visit.status='CHECKED_IN')::integer
  into v_stops,v_planned,v_completed,v_in_progress
  from public.tour_plan_stops stop
  left join public.doctors doctor on doctor.tenant_id=stop.tenant_id and doctor.id=stop.doctor_id
  left join public.chemists chemist on chemist.tenant_id=stop.tenant_id and chemist.id=stop.chemist_id
  left join public.stockists stockist on stockist.tenant_id=stop.tenant_id and stockist.id=stop.stockist_id
  left join public.field_visits visit on visit.tenant_id=stop.tenant_id and visit.execution_id=v_execution.id and visit.plan_stop_id=stop.id
  where stop.tenant_id=p_tenant_id and stop.tour_plan_day_id=v_execution.tour_plan_day_id;

  v_elapsed:=greatest(0,floor(extract(epoch from(v_now-v_execution.started_at))/60)::integer);
  return jsonb_build_object(
    'executionId',v_execution.id,'workDate',v_execution.work_date,'territoryId',v_execution.territory_id,
    'startedAt',v_execution.started_at,'serverNow',v_now,'requiredMinutes',v_execution.required_minutes,
    'elapsedMinutes',v_elapsed,'remainingMinutes',greatest(0,v_execution.required_minutes-v_elapsed),
    'plannedCount',coalesce(v_planned,0),'completedCount',coalesce(v_completed,0),
    'inProgressCount',coalesce(v_in_progress,0),
    'pendingCount',coalesce(v_planned,0)-coalesce(v_completed,0)-coalesce(v_in_progress,0),
    'stops',v_stops
  );
end;
$$;

commit;
