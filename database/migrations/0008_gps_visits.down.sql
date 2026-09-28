begin;
-- Restore Sprint 7 projection before dropping visits.
create or replace function public.my_active_tour_progress(p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_execution public.tour_executions%rowtype; v_now timestamptz:=clock_timestamp(); v_stops jsonb; v_planned integer; v_elapsed integer;
begin
 select execution.* into v_execution from public.tour_executions execution
 join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
 where execution.tenant_id=p_tenant_id and execution.status='ACTIVE' and employee.user_id=auth.uid() and employee.status='active'
 order by execution.started_at desc limit 1;
 if v_execution.id is null then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('sequence',stop.sequence_no,'type',stop.stop_type,'targetId',coalesce(stop.doctor_id,stop.chemist_id,stop.stockist_id),'targetName',coalesce(doctor.name,chemist.name,stockist.name,'Unknown'),'status','PENDING') order by stop.sequence_no),'[]'::jsonb)
 into v_stops from public.tour_plan_stops stop
 left join public.doctors doctor on doctor.tenant_id=stop.tenant_id and doctor.id=stop.doctor_id
 left join public.chemists chemist on chemist.tenant_id=stop.tenant_id and chemist.id=stop.chemist_id
 left join public.stockists stockist on stockist.tenant_id=stop.tenant_id and stockist.id=stop.stockist_id
 where stop.tenant_id=p_tenant_id and stop.tour_plan_day_id=v_execution.tour_plan_day_id;
 v_planned:=jsonb_array_length(v_stops); v_elapsed:=greatest(0,floor(extract(epoch from(v_now-v_execution.started_at))/60)::integer);
 return jsonb_build_object('executionId',v_execution.id,'workDate',v_execution.work_date,'territoryId',v_execution.territory_id,'startedAt',v_execution.started_at,'serverNow',v_now,'requiredMinutes',v_execution.required_minutes,'elapsedMinutes',v_elapsed,'remainingMinutes',greatest(0,v_execution.required_minutes-v_elapsed),'plannedCount',v_planned,'completedCount',0,'pendingCount',v_planned,'stops',v_stops);
end; $$;

drop function if exists public.admin_review_visit_exception(uuid,uuid,uuid,text,text);
drop function if exists public.admin_checkout_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision);
drop function if exists public.admin_checkin_visit(uuid,uuid,uuid,uuid,double precision,double precision,double precision,text);
drop table if exists public.field_visits;
drop function if exists public.geo_distance_meters(double precision,double precision,double precision,double precision);
alter table public.tenants drop column if exists max_gps_accuracy_meters;
alter table public.tenants drop column if exists geofence_radius_meters;
commit;
