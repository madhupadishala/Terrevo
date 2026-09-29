begin;

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

comment on function public.my_active_tour_progress(uuid) is null;

commit;
