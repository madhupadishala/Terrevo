begin;
-- Restore the exact preceding functions; business records are preserved.
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

commit;
