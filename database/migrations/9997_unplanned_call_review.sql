begin;
-- Unplanned customer calls are separately accountable; never inserted as a planned stop,
-- a field_visits row, a DCR or an approved call without manager review.
create table public.unplanned_calls (
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 actor_user_id uuid not null,
 operation_id uuid not null,
 execution_id uuid not null,
 work_date date not null,
 territory_id uuid not null,
 customer_type text not null check(customer_type in ('doctor','chemist','stockist')),
 customer_id uuid not null,
 reason text not null check(length(trim(reason)) between 1 and 500),
 remarks text not null check(length(trim(remarks)) between 1 and 2000),
 duration_minutes integer not null check(duration_minutes between 1 and 1440),
 latitude numeric not null check(latitude between -90 and 90),
 longitude numeric not null check(longitude between -180 and 180),
 accuracy_meters numeric not null check(accuracy_meters between 0 and 1000),
 status text not null default 'SUBMITTED' check(status in('SUBMITTED','APPROVED','REJECTED')),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid,
 reviewed_at timestamptz,
 manager_comment text check(manager_comment is null or length(trim(manager_comment)) between 1 and 1000),
 unique(tenant_id,id),unique(tenant_id,actor_user_id,operation_id),
 foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict,
 foreign key(tenant_id,execution_id) references public.tour_executions(tenant_id,id) on delete restrict,
 foreign key(tenant_id,territory_id) references public.organization_units(tenant_id,id) on delete restrict,
 foreign key(tenant_id,reviewed_by) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);
create index unplanned_calls_actor_date on public.unplanned_calls(tenant_id,actor_user_id,work_date desc);
create index unplanned_calls_review_queue on public.unplanned_calls(tenant_id,status,territory_id);
create table public.unplanned_call_decisions (
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null,
 unplanned_call_id uuid not null,
 actor_user_id uuid not null,
 decision text not null check(decision in('APPROVE','REJECT')),
 comment text,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,unplanned_call_id) references public.unplanned_calls(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);

create or replace function public.admin_submit_unplanned_call(
 p_tenant_id uuid,p_user_id uuid,p_operation_id uuid,p_execution_id uuid,p_territory_id uuid,
 p_customer_type text,p_customer_id uuid,p_reason text,p_remarks text,p_duration integer,
 p_latitude numeric,p_longitude numeric,p_accuracy numeric
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_emp public.employees%rowtype;v_exec public.tour_executions%rowtype;
 v_id uuid;v_prior public.unplanned_calls%rowtype;v_target_ok boolean:=false;
begin
 select e.* into v_emp from public.employees e
   join public.tenant_memberships m on m.tenant_id=e.tenant_id and m.user_id=e.user_id
   where e.tenant_id=p_tenant_id and e.user_id=p_user_id and e.status='active' limit 1;
 if v_emp.id is null or not public.user_has_permission(p_tenant_id,p_user_id,'TOUR_PLAN_OWN',p_territory_id)
 then raise exception 'Unplanned call authorization denied' using errcode='42501'; end if;
 select * into v_exec from public.tour_executions
   where tenant_id=p_tenant_id and id=p_execution_id and employee_id=v_emp.id
     and territory_id=p_territory_id and status='ACTIVE' for update;
 if v_exec.id is null then raise exception 'Active assigned tour required' using errcode='23505'; end if;
 if not public.org_unit_in_scope(p_tenant_id,p_territory_id,v_emp.org_unit_id) then
   raise exception 'Territory outside assigned scope' using errcode='42501'; end if;
 if exists(select 1 from public.field_visits v where v.tenant_id=p_tenant_id
       and v.execution_id=p_execution_id and v.status='CHECKED_IN') then
   raise exception 'Close the active planned visit before submitting an unplanned call' using errcode='23505'; end if;
 if p_customer_type='doctor' then
   select exists(select 1 from public.doctors d where d.tenant_id=p_tenant_id and d.id=p_customer_id and d.status='active' and d.territory_id=p_territory_id) into v_target_ok;
 elsif p_customer_type='chemist' then
   select exists(select 1 from public.chemists d where d.tenant_id=p_tenant_id and d.id=p_customer_id and d.status='active' and d.territory_id=p_territory_id) into v_target_ok;
 elsif p_customer_type='stockist' then
   select exists(select 1 from public.stockists d where d.tenant_id=p_tenant_id and d.id=p_customer_id and d.status='active' and d.territory_id=p_territory_id) into v_target_ok;
 else raise exception 'Unsupported customer type' using errcode='22023';
 end if;
 if not v_target_ok then raise exception 'Customer not active in assigned territory' using errcode='22023'; end if;
 if p_operation_id is null or p_duration not between 1 and 1440 or
    length(trim(coalesce(p_reason,''))) not between 1 and 500 or
    length(trim(coalesce(p_remarks,''))) not between 1 and 2000 or
    p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or
    p_accuracy not between 0 and 1000 then
   raise exception 'Invalid unplanned-call fields or GPS evidence' using errcode='22023'; end if;
 select * into v_prior from public.unplanned_calls
   where tenant_id=p_tenant_id and actor_user_id=p_user_id and operation_id=p_operation_id;
 if v_prior.id is not null then
   if v_prior.execution_id<>p_execution_id or v_prior.territory_id<>p_territory_id or
      v_prior.customer_type<>p_customer_type or v_prior.customer_id<>p_customer_id or
      v_prior.reason<>trim(p_reason) or v_prior.remarks<>trim(p_remarks) or
      v_prior.duration_minutes<>p_duration or v_prior.latitude<>p_latitude or
      v_prior.longitude<>p_longitude or v_prior.accuracy_meters<>p_accuracy then
     raise exception 'Idempotency key reused for another call' using errcode='23505';
   end if;
   return v_prior.id;
 end if;
 insert into public.unplanned_calls(tenant_id,actor_user_id,operation_id,execution_id,
   work_date,territory_id,customer_type,customer_id,reason,remarks,duration_minutes,
   latitude,longitude,accuracy_meters)
 values(p_tenant_id,p_user_id,p_operation_id,p_execution_id,v_exec.work_date,
   p_territory_id,p_customer_type,p_customer_id,trim(p_reason),trim(p_remarks),p_duration,
   p_latitude,p_longitude,p_accuracy)
 returning id into v_id;
 return v_id;
end;$$;

create or replace function public.admin_decide_unplanned_call(
 p_tenant_id uuid,p_actor uuid,p_call_id uuid,p_decision text,p_comment text
) returns void language plpgsql security definer set search_path='' as $$
declare v_call public.unplanned_calls%rowtype;
begin
 select * into v_call from public.unplanned_calls
   where tenant_id=p_tenant_id and id=p_call_id for update;
 if v_call.id is null then raise exception 'Unplanned call not found' using errcode='P0002'; end if;
 if v_call.status<>'SUBMITTED' then raise exception 'Unplanned call already reviewed' using errcode='23505'; end if;
 if p_actor=v_call.actor_user_id or not public.user_has_permission(p_tenant_id,p_actor,'TOUR_APPROVE',v_call.territory_id)
 then raise exception 'Unplanned call review denied' using errcode='42501'; end if;
 if p_decision not in ('APPROVE','REJECT') or
    (p_decision='REJECT' and length(trim(coalesce(p_comment,'')))=0) or
    length(trim(coalesce(p_comment,'')))>1000
 then raise exception 'Invalid manager decision or comment' using errcode='22023'; end if;
 update public.unplanned_calls set
   status=case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
   reviewed_by=p_actor,reviewed_at=now(),manager_comment=nullif(trim(coalesce(p_comment,'')),'')
 where id=p_call_id and tenant_id=p_tenant_id;
 insert into public.unplanned_call_decisions(tenant_id,unplanned_call_id,actor_user_id,decision,comment)
 values(p_tenant_id,p_call_id,p_actor,p_decision,nullif(trim(coalesce(p_comment,'')),''));
end;$$;

alter table public.unplanned_calls enable row level security;
alter table public.unplanned_call_decisions enable row level security;
revoke all on public.unplanned_calls,public.unplanned_call_decisions from anon,authenticated;
grant select on public.unplanned_calls,public.unplanned_call_decisions to authenticated;
create policy unplanned_own_or_manager on public.unplanned_calls
 for select to authenticated using(
  actor_user_id=auth.uid() or public.has_permission(tenant_id,'TOUR_APPROVE',territory_id)
 );
create policy unplanned_decisions_visible on public.unplanned_call_decisions
 for select to authenticated using(exists(
  select 1 from public.unplanned_calls c where c.tenant_id=unplanned_call_decisions.tenant_id
    and c.id=unplanned_call_decisions.unplanned_call_id
 ));
revoke execute on function public.admin_submit_unplanned_call(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,integer,numeric,numeric,numeric) from public,anon,authenticated;
revoke execute on function public.admin_decide_unplanned_call(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_submit_unplanned_call(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,integer,numeric,numeric,numeric) to service_role;
grant execute on function public.admin_decide_unplanned_call(uuid,uuid,uuid,text,text) to service_role;
commit;
