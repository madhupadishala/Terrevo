begin;
insert into public.role_permissions(role_key,permission_key)values
('TENANT_ADMIN','MANAGER_DASHBOARD_VIEW'),('MANAGER','MANAGER_DASHBOARD_VIEW')
on conflict do nothing;

create or replace function public.manager_command_center(p_tenant_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_tz text;
  v_date date;
  v_allowed boolean;
begin
  select tenant.time_zone into v_tz from public.tenants tenant
   where tenant.id=p_tenant_id and tenant.status='active';
  if v_tz is null then raise exception 'tenant not found';end if;
  v_date:=(v_now at time zone v_tz)::date;

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
  if not v_allowed then raise exception 'manager command center access denied';end if;

  return jsonb_build_object(
    'serverNow',v_now,
    'localDate',v_date,
    'teamMembers',(
      select count(*) from public.employees employee
       where employee.tenant_id=p_tenant_id and employee.status='active'
         and public.has_permission(p_tenant_id,'TOUR_VIEW_TEAM',employee.org_unit_id)
    ),
    'activeTours',(
      select count(*) from public.tour_executions execution
      join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
      where execution.tenant_id=p_tenant_id and execution.status='ACTIVE'
        and public.has_permission(p_tenant_id,'TOUR_VIEW_TEAM',employee.org_unit_id)
    ),
    'submittedToursToday',(
      select count(*) from public.tour_executions execution
      join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
      where execution.tenant_id=p_tenant_id and execution.status='SUBMITTED' and execution.work_date=v_date
        and public.has_permission(p_tenant_id,'TOUR_VIEW_TEAM',employee.org_unit_id)
    ),
    'shortDaysToday',(
      select count(*) from public.tour_executions execution
      join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
      where execution.tenant_id=p_tenant_id and execution.status='SUBMITTED' and execution.work_date=v_date
        and execution.worked_minutes<execution.required_minutes
        and public.has_permission(p_tenant_id,'TOUR_VIEW_TEAM',employee.org_unit_id)
    ),
    'activeJointWork',(
      select count(*) from public.joint_work_assignments joint
      join public.employees employee on employee.tenant_id=joint.tenant_id and employee.id=joint.target_employee_id
      where joint.tenant_id=p_tenant_id and joint.status='ACTIVE' and joint.joined_at is not null and joint.left_at is null
        and public.has_permission(p_tenant_id,'JOINT_WORK_VIEW_TEAM',employee.org_unit_id)
    ),
    'pending',jsonb_build_object(
      'tourApprovals',(
        select count(*) from public.tour_plans plan
         where plan.tenant_id=p_tenant_id and plan.status='SUBMITTED'
           and public.can_access_tour_plan(p_tenant_id,plan.id,'TOUR_APPROVE')
      ),
      'gpsExceptions',(
        select count(*) from public.field_visits visit
        join public.tour_executions execution on execution.tenant_id=visit.tenant_id and execution.id=visit.execution_id
        where visit.tenant_id=p_tenant_id and visit.exception_status='PENDING'
          and public.can_access_tour_plan(p_tenant_id,execution.tour_plan_id,'TOUR_APPROVE')
      ),
      'weeklyTimesheets',(
        select count(*) from public.weekly_timesheets weekly
        join public.employees employee on employee.tenant_id=weekly.tenant_id and employee.id=weekly.employee_id
        where weekly.tenant_id=p_tenant_id and weekly.status='SUBMITTED'
          and public.has_permission(p_tenant_id,'TIMESHEET_APPROVE',employee.org_unit_id)
      ),
      'leaves',(
        select count(*) from public.leave_requests request
        join public.employees employee on employee.tenant_id=request.tenant_id and employee.id=request.employee_id
        where request.tenant_id=p_tenant_id and request.status='SUBMITTED'
          and public.has_permission(p_tenant_id,'LEAVE_APPROVE',employee.org_unit_id)
      ),
      'expenses',(
        select count(*) from public.expense_claims claim
        join public.employees employee on employee.tenant_id=claim.tenant_id and employee.id=claim.employee_id
        where claim.tenant_id=p_tenant_id and claim.status='SUBMITTED'
          and public.has_permission(p_tenant_id,'EXPENSE_APPROVE',employee.org_unit_id)
      )
    ),
    'queues',jsonb_build_object(
      'tourApprovals',coalesce((
        select jsonb_agg(jsonb_build_object('id',q.id,'employeeId',q.employee_id,'weekStart',q.week_start) order by q.submitted_at)
        from(
          select plan.id,plan.employee_id,plan.week_start,plan.submitted_at
          from public.tour_plans plan
          where plan.tenant_id=p_tenant_id and plan.status='SUBMITTED'
            and public.can_access_tour_plan(p_tenant_id,plan.id,'TOUR_APPROVE')
          order by plan.submitted_at nulls last limit 50
        )q
      ),'[]'::jsonb),
      'gpsExceptions',coalesce((
        select jsonb_agg(jsonb_build_object('id',q.id,'employeeId',q.employee_id,'workDate',q.work_date) order by q.checkin_at)
        from(
          select visit.id,execution.employee_id,execution.work_date,visit.checkin_at
          from public.field_visits visit
          join public.tour_executions execution on execution.tenant_id=visit.tenant_id and execution.id=visit.execution_id
          where visit.tenant_id=p_tenant_id and visit.exception_status='PENDING'
            and public.can_access_tour_plan(p_tenant_id,execution.tour_plan_id,'TOUR_APPROVE')
          order by visit.checkin_at limit 50
        )q
      ),'[]'::jsonb),
      'weeklyTimesheets',coalesce((
        select jsonb_agg(jsonb_build_object('id',q.id,'employeeId',q.employee_id,'weekStart',q.week_start) order by q.submitted_at)
        from(
          select weekly.id,weekly.employee_id,weekly.week_start,weekly.submitted_at
          from public.weekly_timesheets weekly
          join public.employees employee on employee.tenant_id=weekly.tenant_id and employee.id=weekly.employee_id
          where weekly.tenant_id=p_tenant_id and weekly.status='SUBMITTED'
            and public.has_permission(p_tenant_id,'TIMESHEET_APPROVE',employee.org_unit_id)
          order by weekly.submitted_at limit 50
        )q
      ),'[]'::jsonb),
      'leaves',coalesce((
        select jsonb_agg(jsonb_build_object('id',q.id,'employeeId',q.employee_id,'startDate',q.start_date,'endDate',q.end_date) order by q.created_at)
        from(
          select request.id,request.employee_id,request.start_date,request.end_date,request.created_at
          from public.leave_requests request
          join public.employees employee on employee.tenant_id=request.tenant_id and employee.id=request.employee_id
          where request.tenant_id=p_tenant_id and request.status='SUBMITTED'
            and public.has_permission(p_tenant_id,'LEAVE_APPROVE',employee.org_unit_id)
          order by request.created_at limit 50
        )q
      ),'[]'::jsonb),
      'expenses',coalesce((
        select jsonb_agg(jsonb_build_object('id',q.id,'employeeId',q.employee_id,'workDate',q.work_date,'totalAmount',q.total_amount,'currencyCode',q.currency_code) order by q.submitted_at)
        from(
          select claim.id,claim.employee_id,claim.work_date,claim.total_amount,claim.currency_code,claim.submitted_at
          from public.expense_claims claim
          join public.employees employee on employee.tenant_id=claim.tenant_id and employee.id=claim.employee_id
          where claim.tenant_id=p_tenant_id and claim.status='SUBMITTED'
            and public.has_permission(p_tenant_id,'EXPENSE_APPROVE',employee.org_unit_id)
          order by claim.submitted_at limit 50
        )q
      ),'[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.manager_command_center(uuid) from public;
grant execute on function public.manager_command_center(uuid) to authenticated;
commit;
