begin;
insert into public.role_permissions(role_key,permission_key) values
('TENANT_ADMIN','LEAVE_VIEW_TEAM'),('TENANT_ADMIN','LEAVE_APPROVE'),('MANAGER','LEAVE_VIEW_TEAM'),('MANAGER','LEAVE_APPROVE') on conflict do nothing;
create table public.leave_requests(
 id uuid primary key default extensions.gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,employee_id uuid not null,
 leave_type text not null check(leave_type in('FULL_DAY','HALF_DAY')),start_date date not null,end_date date not null,reason text not null,status text not null default 'SUBMITTED' check(status in('SUBMITTED','APPROVED','REJECTED')),
 operation_id uuid not null,reviewed_by uuid,reviewed_at timestamptz,manager_comment text,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,employee_id,operation_id),
 foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict,
 foreign key(tenant_id,reviewed_by) references public.tenant_memberships(tenant_id,user_id) on delete restrict,
 check(end_date>=start_date),check(end_date-start_date<=30),check(leave_type<>'HALF_DAY' or start_date=end_date)
);
create table public.leave_decisions(
 id uuid primary key default extensions.gen_random_uuid(),tenant_id uuid not null,leave_request_id uuid not null,actor_user_id uuid not null,decision text not null check(decision in('APPROVE','REJECT')),comment text,created_at timestamptz not null default now(),
 foreign key(tenant_id,leave_request_id) references public.leave_requests(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);
create or replace function public.admin_submit_leave(p_tenant_id uuid,p_user_id uuid,p_operation_id uuid,p_leave_type text,p_start date,p_end date,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_employee public.employees%rowtype;v_id uuid;
begin
 select employee.* into v_employee from public.employees employee where employee.tenant_id=p_tenant_id and employee.user_id=p_user_id and employee.status='active';if v_employee.id is null then raise exception 'active employee not found';end if;
 select request.id into v_id from public.leave_requests request where request.tenant_id=p_tenant_id and request.employee_id=v_employee.id and request.operation_id=p_operation_id;
 if v_id is not null then return v_id;end if;
 if p_end<p_start or p_end-p_start>30 or(p_leave_type='HALF_DAY' and p_start<>p_end)then raise exception 'invalid leave range';end if;
 if exists(select 1 from public.leave_requests request where request.tenant_id=p_tenant_id and request.employee_id=v_employee.id and request.status in('SUBMITTED','APPROVED') and daterange(request.start_date,request.end_date,'[]')&&daterange(p_start,p_end,'[]'))then raise exception 'overlapping leave request';end if;
 insert into public.leave_requests(tenant_id,employee_id,leave_type,start_date,end_date,reason,operation_id)values(p_tenant_id,v_employee.id,p_leave_type,p_start,p_end,trim(p_reason),p_operation_id)returning id into v_id;return v_id;
end;$$;
create or replace function public.admin_decide_leave(p_tenant_id uuid,p_actor uuid,p_leave_id uuid,p_decision text,p_comment text)
returns void language plpgsql security definer set search_path='' as $$
declare v_leave public.leave_requests%rowtype;v_employee public.employees%rowtype;
begin
 select request.* into v_leave from public.leave_requests request where request.tenant_id=p_tenant_id and request.id=p_leave_id for update;if v_leave.id is null or v_leave.status<>'SUBMITTED' then raise exception 'submitted leave not found';end if;
 select employee.* into v_employee from public.employees employee where employee.tenant_id=p_tenant_id and employee.id=v_leave.employee_id;
 if v_employee.user_id=p_actor then raise exception 'self approval not allowed';end if;
 if not public.user_has_permission(p_tenant_id,p_actor,'LEAVE_APPROVE',v_employee.org_unit_id)then raise exception 'leave approval denied';end if;
 if p_decision not in('APPROVE','REJECT')then raise exception 'invalid leave decision';end if;if p_decision='REJECT' and nullif(trim(p_comment),'')is null then raise exception 'reject comment required';end if;
 if p_decision='APPROVE' and v_leave.leave_type='FULL_DAY' and exists(select 1 from public.tour_executions execution where execution.tenant_id=p_tenant_id and execution.employee_id=v_leave.employee_id and execution.work_date between v_leave.start_date and v_leave.end_date)then raise exception 'full-day leave conflicts with existing tour execution';end if;
 update public.leave_requests set status=case when p_decision='APPROVE'then'APPROVED'else'REJECTED'end,reviewed_by=p_actor,reviewed_at=clock_timestamp(),manager_comment=nullif(trim(p_comment),'')where tenant_id=p_tenant_id and id=p_leave_id;
 insert into public.leave_decisions(tenant_id,leave_request_id,actor_user_id,decision,comment)values(p_tenant_id,p_leave_id,p_actor,p_decision,nullif(trim(p_comment),''));
end;$$;
create or replace function public.block_tour_on_full_day_leave()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.leave_requests request where request.tenant_id=new.tenant_id and request.employee_id=new.employee_id and request.status='APPROVED' and request.leave_type='FULL_DAY' and new.work_date between request.start_date and request.end_date)then raise exception 'approved full-day leave blocks tour start';end if;return new;
end;$$;
create trigger tour_execution_leave_guard before insert on public.tour_executions for each row execute function public.block_tour_on_full_day_leave();
create or replace function public.my_attendance(p_tenant_id uuid)returns table(work_date date,status text,worked_minutes integer,required_minutes integer,short_day_reason text,leave_request_id uuid)
language sql stable security definer set search_path='' as $$
 with me as(select id from public.employees where tenant_id=p_tenant_id and user_id=auth.uid() and status='active'),
 work as(select e.work_date,case when e.status='ACTIVE'then'WORKING' when e.worked_minutes>=e.required_minutes then'PRESENT' else'SHORT_DAY'end status,e.worked_minutes,e.required_minutes,e.short_day_reason,null::uuid leave_request_id from public.tour_executions e join me on me.id=e.employee_id where e.tenant_id=p_tenant_id),
 leave_days as(select day::date work_date,case when l.leave_type='FULL_DAY'then'LEAVE'else'HALF_DAY_LEAVE'end status,null::integer,null::integer,null::text,l.id from public.leave_requests l join me on me.id=l.employee_id cross join lateral generate_series(l.start_date,l.end_date,'1 day')day where l.tenant_id=p_tenant_id and l.status='APPROVED')
 select * from work union all select ld.* from leave_days ld where not exists(select 1 from work w where w.work_date=ld.work_date) order by work_date desc;
$$;
revoke all on function public.admin_submit_leave(uuid,uuid,uuid,text,date,date,text) from public;revoke all on function public.admin_decide_leave(uuid,uuid,uuid,text,text) from public;revoke all on function public.my_attendance(uuid) from public;
grant execute on function public.admin_submit_leave(uuid,uuid,uuid,text,date,date,text) to service_role;grant execute on function public.admin_decide_leave(uuid,uuid,uuid,text,text) to service_role;grant execute on function public.my_attendance(uuid) to authenticated;
alter table public.leave_requests enable row level security;alter table public.leave_decisions enable row level security;revoke all on public.leave_requests from anon,authenticated;revoke all on public.leave_decisions from anon,authenticated;grant select on public.leave_requests to authenticated;grant select on public.leave_decisions to authenticated;
create policy leave_owner_or_team on public.leave_requests for select to authenticated using(exists(select 1 from public.employees employee where employee.tenant_id=leave_requests.tenant_id and employee.id=leave_requests.employee_id and(employee.user_id=auth.uid() or public.has_permission(leave_requests.tenant_id,'LEAVE_VIEW_TEAM',employee.org_unit_id))));
create policy leave_decisions_visible on public.leave_decisions for select to authenticated using(exists(select 1 from public.leave_requests request where request.tenant_id=leave_decisions.tenant_id and request.id=leave_decisions.leave_request_id));
commit;