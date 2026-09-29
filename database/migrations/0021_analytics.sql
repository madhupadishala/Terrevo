begin;

create or replace function public.manager_analytics(p_tenant_id uuid,p_days integer default 7)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_tz text;
  v_end date;
  v_start date;
  v_allowed boolean;
begin
  if p_days is null or p_days<1 or p_days>90 then
    raise exception 'analytics days must be between 1 and 90';
  end if;

  select tenant.time_zone into v_tz
    from public.tenants tenant
   where tenant.id=p_tenant_id and tenant.status='active';
  if v_tz is null then raise exception 'tenant not found'; end if;

  select exists(
    select 1
      from public.tenant_memberships membership
      join public.user_role_assignments assignment
        on assignment.tenant_id=membership.tenant_id
       and assignment.user_id=membership.user_id
       and assignment.status='active'
      join public.role_permissions permission
        on permission.role_key=assignment.role_key
       and permission.permission_key='MANAGER_DASHBOARD_VIEW'
     where membership.tenant_id=p_tenant_id
       and membership.user_id=auth.uid()
       and membership.status='active'
  ) into v_allowed;
  if not v_allowed then raise exception 'manager analytics access denied'; end if;

  v_end:=(v_now at time zone v_tz)::date;
  v_start:=v_end-(p_days-1);

  return (
    with
    scoped_employees as (
      select employee.id,employee.org_unit_id
        from public.employees employee
       where employee.tenant_id=p_tenant_id
         and employee.status='active'
         and public.has_permission(p_tenant_id,'TOUR_VIEW_TEAM',employee.org_unit_id)
    ),
    executions as (
      select execution.*
        from public.tour_executions execution
        join scoped_employees employee on employee.id=execution.employee_id
       where execution.tenant_id=p_tenant_id
         and execution.work_date between v_start and v_end
    ),
    planned_stops as (
      select stop.id
        from executions execution
        join public.tour_plan_stops stop
          on stop.tenant_id=execution.tenant_id
         and stop.tour_plan_day_id=execution.tour_plan_day_id
    ),
    completed_visits as (
      select visit.id,visit.execution_id,visit.plan_stop_id,stop.stop_type
        from public.field_visits visit
        join executions execution on execution.id=visit.execution_id
        join public.tour_plan_stops stop
          on stop.tenant_id=visit.tenant_id and stop.id=visit.plan_stop_id
       where visit.tenant_id=p_tenant_id and visit.status='CHECKED_OUT'
    ),
    scoped_dcrs as (
      select dcr.*
        from public.dcrs dcr
        join executions execution on execution.id=dcr.execution_id
       where dcr.tenant_id=p_tenant_id
    ),
    scoped_orders as (
      select order_row.id
        from public.sales_orders order_row
        join completed_visits visit on visit.id=order_row.visit_id
       where order_row.tenant_id=p_tenant_id and order_row.status='BOOKED'
    ),
    scoped_order_lines as (
      select line.*
        from public.sales_order_lines line
        join scoped_orders order_row on order_row.id=line.sales_order_id
       where line.tenant_id=p_tenant_id
    ),
    scoped_rcpa_reports as (
      select report.id
        from public.rcpa_reports report
        join completed_visits visit on visit.id=report.visit_id
       where report.tenant_id=p_tenant_id
    ),
    scoped_rcpa_lines as (
      select line.*
        from public.rcpa_lines line
        join scoped_rcpa_reports report on report.id=line.rcpa_report_id
       where line.tenant_id=p_tenant_id
    ),
    scoped_leaves as (
      select request.*
        from public.leave_requests request
        join public.employees employee
          on employee.tenant_id=request.tenant_id and employee.id=request.employee_id
       where request.tenant_id=p_tenant_id
         and request.status='APPROVED'
         and request.end_date>=v_start and request.start_date<=v_end
         and public.has_permission(p_tenant_id,'LEAVE_VIEW_TEAM',employee.org_unit_id)
    ),
    scoped_expenses as (
      select claim.*
        from public.expense_claims claim
        join public.employees employee
          on employee.tenant_id=claim.tenant_id and employee.id=claim.employee_id
       where claim.tenant_id=p_tenant_id
         and claim.work_date between v_start and v_end
         and claim.status in('SUBMITTED','APPROVED')
         and public.has_permission(p_tenant_id,'EXPENSE_VIEW_TEAM',employee.org_unit_id)
    ),
    expense_totals as (
      select claim.currency_code,count(*)::integer claim_count,sum(claim.total_amount)::numeric(14,2) total_amount
        from scoped_expenses claim
       group by claim.currency_code
       order by claim.currency_code
    ),
    metrics as (
      select
        (select count(*)::integer from scoped_employees) team_members,
        (select count(*)::integer from executions where status='SUBMITTED') submitted_tours,
        (select count(*)::integer from executions where status='SUBMITTED' and worked_minutes<required_minutes) short_days,
        (select coalesce(sum(worked_minutes),0)::integer from executions where status='SUBMITTED') total_worked_minutes,
        (select coalesce(round(avg(worked_minutes)::numeric,1),0) from executions where status='SUBMITTED') average_worked_minutes,
        (select count(*)::integer from planned_stops) planned_stop_count,
        (select count(*)::integer from completed_visits) completed_visit_count,
        (select count(*)::integer from completed_visits where stop_type='doctor') doctor_calls,
        (select count(distinct doctor_id)::integer from scoped_dcrs) unique_doctors,
        (select count(*)::integer from completed_visits where stop_type='chemist') chemist_calls,
        (select count(*)::integer from completed_visits where stop_type='stockist') stockist_calls,
        (select count(*)::integer from scoped_orders) order_count,
        (select coalesce(sum(quantity),0)::integer from scoped_order_lines) order_units,
        (select count(*)::integer from scoped_rcpa_reports) rcpa_reports,
        (select coalesce(sum(prescription_count),0)::integer from scoped_rcpa_lines) rcpa_prescriptions,
        (select coalesce(sum(stock_quantity),0)::integer from scoped_rcpa_lines) rcpa_stock,
        (select coalesce(sum(sales_quantity),0)::integer from scoped_rcpa_lines) rcpa_sales,
        (select count(*)::integer from executions where status='SUBMITTED' and worked_minutes>=required_minutes) present_days,
        (select coalesce(sum(least(end_date,v_end)-greatest(start_date,v_start)+1),0)::integer from scoped_leaves where leave_type='FULL_DAY') full_leave_days,
        (select count(*)::integer from scoped_leaves where leave_type='HALF_DAY') half_leave_days
    )
    select jsonb_build_object(
      'generatedAt',v_now,
      'localDate',v_end,
      'period',jsonb_build_object('days',p_days,'startDate',v_start,'endDate',v_end),
      'teamMembers',metrics.team_members,
      'tours',jsonb_build_object(
        'submitted',metrics.submitted_tours,
        'shortDays',metrics.short_days,
        'totalWorkedMinutes',metrics.total_worked_minutes,
        'averageWorkedMinutes',metrics.average_worked_minutes
      ),
      'coverage',jsonb_build_object(
        'plannedStops',metrics.planned_stop_count,
        'completedVisits',metrics.completed_visit_count,
        'coveragePercent',case when metrics.planned_stop_count=0 then 0 else round((metrics.completed_visit_count*100.0/metrics.planned_stop_count)::numeric,1) end,
        'doctorCalls',metrics.doctor_calls,
        'uniqueDoctorsCovered',metrics.unique_doctors,
        'chemistCalls',metrics.chemist_calls,
        'stockistCalls',metrics.stockist_calls,
        'callsPerSubmittedTour',case when metrics.submitted_tours=0 then 0 else round((metrics.completed_visit_count::numeric/metrics.submitted_tours),1) end
      ),
      'orders',jsonb_build_object('count',metrics.order_count,'units',metrics.order_units),
      'rcpa',jsonb_build_object(
        'reports',metrics.rcpa_reports,
        'prescriptionCount',metrics.rcpa_prescriptions,
        'stockQuantity',metrics.rcpa_stock,
        'salesQuantity',metrics.rcpa_sales
      ),
      'attendance',jsonb_build_object(
        'presentDays',metrics.present_days,
        'shortDays',metrics.short_days,
        'approvedFullDayLeaveDays',metrics.full_leave_days,
        'approvedHalfDayLeaveDays',metrics.half_leave_days
      ),
      'expenses',coalesce((
        select jsonb_agg(jsonb_build_object(
          'currencyCode',expense.currency_code,
          'claimCount',expense.claim_count,
          'totalAmount',expense.total_amount
        ) order by expense.currency_code)
        from expense_totals expense
      ),'[]'::jsonb)
    )
    from metrics
  );
end;
$$;

revoke all on function public.manager_analytics(uuid,integer) from public;
grant execute on function public.manager_analytics(uuid,integer) to authenticated;

commit;
