begin;

create table public.trade_calls(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null,
  call_type text not null check(call_type in('chemist','stockist')),
  outcome text not null check(length(trim(outcome)) between 1 and 120),
  remarks text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,visit_id),
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict
);

create table public.trade_call_operations(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  trade_call_id uuid not null,
  actor_user_id uuid not null,
  operation_id uuid not null,
  request_hash bytea not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,actor_user_id,operation_id),
  foreign key(tenant_id,trade_call_id) references public.trade_calls(tenant_id,id) on delete cascade,
  foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);

create or replace function public.admin_save_trade_call(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,
  p_outcome text,p_remarks text,p_next_action text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.field_visits%rowtype;
  v_stop public.tour_plan_stops%rowtype;
  v_owner uuid; v_call_id uuid;
  v_hash bytea; v_existing_hash bytea;
begin
  if nullif(trim(p_outcome),'') is null or length(trim(p_outcome))>120 then raise exception 'invalid trade outcome'; end if;

  v_hash:=extensions.digest(jsonb_build_object(
    'visitId',p_visit_id,'outcome',trim(p_outcome),
    'remarks',nullif(trim(p_remarks),''),'nextAction',nullif(trim(p_next_action),'')
  )::text,'sha256');

  select operation.trade_call_id,operation.request_hash into v_call_id,v_existing_hash
    from public.trade_call_operations operation
   where operation.tenant_id=p_tenant_id and operation.actor_user_id=p_user_id
     and operation.operation_id=p_operation_id;
  if v_call_id is not null then
    if v_existing_hash is distinct from v_hash then raise exception 'idempotency key reused with different payload'; end if;
    return v_call_id;
  end if;

  select visit.* into v_visit from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
  if v_visit.id is null or v_visit.status<>'CHECKED_IN' then raise exception 'open visit not found'; end if;

  select employee.user_id into v_owner
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'trade visit does not belong to active user'; end if;

  select stop.* into v_stop from public.tour_plan_stops stop
   where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id
     and stop.stop_type in('chemist','stockist');
  if v_stop.id is null then raise exception 'visit is not a chemist/stockist call'; end if;

  select call.id into v_call_id from public.trade_calls call
   where call.tenant_id=p_tenant_id and call.visit_id=p_visit_id;

  if v_call_id is null then
    insert into public.trade_calls(tenant_id,visit_id,call_type,outcome,remarks,next_action)
    values(p_tenant_id,p_visit_id,v_stop.stop_type,trim(p_outcome),nullif(trim(p_remarks),''),nullif(trim(p_next_action),''))
    returning id into v_call_id;
  else
    update public.trade_calls set
      outcome=trim(p_outcome),remarks=nullif(trim(p_remarks),''),
      next_action=nullif(trim(p_next_action),''),updated_at=clock_timestamp()
     where tenant_id=p_tenant_id and id=v_call_id;
  end if;

  insert into public.trade_call_operations(tenant_id,trade_call_id,actor_user_id,operation_id,request_hash)
  values(p_tenant_id,v_call_id,p_user_id,p_operation_id,v_hash);

  return v_call_id;
end;
$$;

create or replace function public.require_trade_call_before_checkout()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_stop_type text;
begin
  if old.status='CHECKED_IN' and new.status='CHECKED_OUT' then
    select stop.stop_type into v_stop_type
      from public.tour_plan_stops stop
     where stop.tenant_id=new.tenant_id and stop.id=new.plan_stop_id;

    if v_stop_type in('chemist','stockist') and not exists(
      select 1 from public.trade_calls call
       where call.tenant_id=new.tenant_id and call.visit_id=new.id
    ) then
      raise exception 'chemist/stockist call details required before checkout';
    end if;
  end if;
  return new;
end;
$$;

create trigger field_visits_trade_call_guard
before update of status on public.field_visits
for each row execute function public.require_trade_call_before_checkout();

alter table public.trade_calls enable row level security;
alter table public.trade_call_operations enable row level security;
revoke all on public.trade_calls from anon,authenticated;
revoke all on public.trade_call_operations from anon,authenticated;
grant select on public.trade_calls to authenticated;

create policy trade_calls_visit_read on public.trade_calls
for select to authenticated using(public.can_read_field_visit(tenant_id,visit_id));

revoke all on function public.admin_save_trade_call(uuid,uuid,uuid,uuid,text,text,text) from public;
grant execute on function public.admin_save_trade_call(uuid,uuid,uuid,uuid,text,text,text) to service_role;

commit;
