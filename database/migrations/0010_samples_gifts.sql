begin;

insert into public.role_permissions(role_key,permission_key) values
  ('TENANT_ADMIN','INVENTORY_VIEW_OWN'),
  ('TENANT_ADMIN','INVENTORY_VIEW_TEAM'),
  ('TENANT_ADMIN','INVENTORY_MANAGE'),
  ('MANAGER','INVENTORY_VIEW_TEAM'),
  ('MANAGER','INVENTORY_MANAGE'),
  ('MR','INVENTORY_VIEW_OWN')
on conflict do nothing;

create or replace function public.user_has_permission(
  p_tenant_id uuid,p_user_id uuid,p_permission text,p_target_org_unit_id uuid default null
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
      from public.tenant_memberships membership
      join public.user_role_assignments assignment
        on assignment.tenant_id=membership.tenant_id
       and assignment.user_id=membership.user_id
       and assignment.status='active'
      join public.role_permissions permission
        on permission.role_key=assignment.role_key
       and permission.permission_key=p_permission
     where membership.tenant_id=p_tenant_id
       and membership.user_id=p_user_id
       and membership.status='active'
       and (
         assignment.scope_org_unit_id is null
         or (
           p_target_org_unit_id is not null
           and public.org_unit_in_scope(p_tenant_id,p_target_org_unit_id,assignment.scope_org_unit_id)
         )
       )
  );
$$;
revoke all on function public.user_has_permission(uuid,uuid,text,uuid) from public;
grant execute on function public.user_has_permission(uuid,uuid,text,uuid) to service_role;

create or replace function public.employee_division(p_tenant_id uuid,p_employee_id uuid)
returns uuid
language sql stable security definer set search_path=''
as $$
  with recursive ancestry as(
    select unit.id,unit.parent_id,unit.type
      from public.employees employee
      join public.organization_units unit
        on unit.tenant_id=employee.tenant_id and unit.id=employee.org_unit_id
     where employee.tenant_id=p_tenant_id and employee.id=p_employee_id
    union all
    select parent.id,parent.parent_id,parent.type
      from public.organization_units parent
      join ancestry child on child.parent_id=parent.id
     where parent.tenant_id=p_tenant_id
  )
  select id from ancestry where type='division' limit 1;
$$;
revoke all on function public.employee_division(uuid,uuid) from public;

create or replace function public.inventory_item_division(
  p_tenant_id uuid,p_item_type text,p_item_id uuid,p_require_active boolean default true
)
returns uuid
language plpgsql stable security definer set search_path=''
as $$
declare v_division uuid;
begin
  if p_item_type='sample' then
    select item.division_id into v_division from public.samples item
     where item.tenant_id=p_tenant_id and item.id=p_item_id
       and (not p_require_active or item.status='active');
  elsif p_item_type='gift' then
    select item.division_id into v_division from public.gifts item
     where item.tenant_id=p_tenant_id and item.id=p_item_id
       and (not p_require_active or item.status='active');
  else
    raise exception 'invalid inventory item type';
  end if;
  return v_division;
end;
$$;
revoke all on function public.inventory_item_division(uuid,text,uuid,boolean) from public;

create table public.inventory_balances(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  item_type text not null check(item_type in('sample','gift')),
  sample_id uuid,
  gift_id uuid,
  quantity integer not null default 0 check(quantity>=0),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict,
  foreign key(tenant_id,sample_id) references public.samples(tenant_id,id) on delete restrict,
  foreign key(tenant_id,gift_id) references public.gifts(tenant_id,id) on delete restrict,
  check(
    (item_type='sample' and sample_id is not null and gift_id is null)
    or (item_type='gift' and sample_id is null and gift_id is not null)
  )
);
create unique index inventory_balance_sample_unique
  on public.inventory_balances(tenant_id,employee_id,sample_id) where sample_id is not null;
create unique index inventory_balance_gift_unique
  on public.inventory_balances(tenant_id,employee_id,gift_id) where gift_id is not null;

create table public.inventory_operations(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  actor_user_id uuid not null,
  visit_id uuid,
  operation_id uuid not null,
  operation_type text not null check(operation_type in('ISSUE','RETURN','DISTRIBUTE')),
  request_hash bytea not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,actor_user_id,operation_id),
  foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict,
  foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict,
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
  check(
    (operation_type='DISTRIBUTE' and visit_id is not null)
    or (operation_type in('ISSUE','RETURN') and visit_id is null)
  )
);

create table public.inventory_ledger(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  operation_record_id uuid not null,
  employee_id uuid not null,
  event_type text not null check(event_type in('ISSUE','RETURN','DISTRIBUTE')),
  sample_id uuid,
  gift_id uuid,
  quantity_delta integer not null check(quantity_delta<>0),
  balance_after integer not null check(balance_after>=0),
  created_at timestamptz not null default now(),
  foreign key(tenant_id,operation_record_id) references public.inventory_operations(tenant_id,id) on delete restrict,
  foreign key(tenant_id,employee_id) references public.employees(tenant_id,id) on delete restrict,
  foreign key(tenant_id,sample_id) references public.samples(tenant_id,id) on delete restrict,
  foreign key(tenant_id,gift_id) references public.gifts(tenant_id,id) on delete restrict,
  check((sample_id is not null and gift_id is null) or (sample_id is null and gift_id is not null))
);

create table public.visit_distributions(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  operation_record_id uuid not null,
  visit_id uuid not null,
  sample_id uuid,
  gift_id uuid,
  quantity integer not null check(quantity>0),
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,operation_record_id,sample_id),
  unique(tenant_id,operation_record_id,gift_id),
  foreign key(tenant_id,operation_record_id) references public.inventory_operations(tenant_id,id) on delete restrict,
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
  foreign key(tenant_id,sample_id) references public.samples(tenant_id,id) on delete restrict,
  foreign key(tenant_id,gift_id) references public.gifts(tenant_id,id) on delete restrict,
  check((sample_id is not null and gift_id is null) or (sample_id is null and gift_id is not null))
);

create table public.dcr_distributions(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  dcr_id uuid not null,
  item_type text not null check(item_type in('sample','gift')),
  sample_id uuid,
  gift_id uuid,
  item_code text not null,
  item_name text not null,
  quantity integer not null check(quantity>0),
  unique(tenant_id,id),
  unique(tenant_id,dcr_id,sample_id),
  unique(tenant_id,dcr_id,gift_id),
  foreign key(tenant_id,dcr_id) references public.dcrs(tenant_id,id) on delete cascade,
  foreign key(tenant_id,sample_id) references public.samples(tenant_id,id) on delete restrict,
  foreign key(tenant_id,gift_id) references public.gifts(tenant_id,id) on delete restrict,
  check(
    (item_type='sample' and sample_id is not null and gift_id is null)
    or (item_type='gift' and sample_id is null and gift_id is not null)
  )
);

create or replace function public.admin_issue_inventory(
  p_tenant_id uuid,p_actor_user_id uuid,p_operation_id uuid,p_employee_id uuid,
  p_item_type text,p_item_id uuid,p_quantity integer
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_employee public.employees%rowtype;
  v_employee_division uuid;
  v_item_division uuid;
  v_hash bytea; v_existing_hash bytea;
  v_operation_record_id uuid;
  v_balance_id uuid; v_balance integer;
begin
  if p_quantity<1 or p_quantity>100000 then raise exception 'invalid inventory quantity'; end if;

  select employee.* into v_employee from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.id=p_employee_id and employee.status='active'
   for update;
  if v_employee.id is null then raise exception 'active employee not found'; end if;

  v_hash:=extensions.digest(jsonb_build_object(
    'type','ISSUE','employeeId',p_employee_id,'itemType',p_item_type,'itemId',p_item_id,'quantity',p_quantity
  )::text,'sha256');

  select operation.request_hash into v_existing_hash from public.inventory_operations operation
   where operation.tenant_id=p_tenant_id and operation.actor_user_id=p_actor_user_id
     and operation.operation_id=p_operation_id;
  if found then
    if v_existing_hash is distinct from v_hash then raise exception 'idempotency key reused with different inventory payload'; end if;
    return;
  end if;

  if not public.user_has_permission(p_tenant_id,p_actor_user_id,'INVENTORY_MANAGE',v_employee.org_unit_id) then
    raise exception 'inventory manage permission denied';
  end if;

  v_employee_division:=public.employee_division(p_tenant_id,p_employee_id);
  v_item_division:=public.inventory_item_division(p_tenant_id,p_item_type,p_item_id,true);
  if v_employee_division is null or v_item_division is null or v_employee_division<>v_item_division then
    raise exception 'inventory item is not active in employee division';
  end if;

  insert into public.inventory_operations(
    tenant_id,employee_id,actor_user_id,operation_id,operation_type,request_hash
  ) values(p_tenant_id,p_employee_id,p_actor_user_id,p_operation_id,'ISSUE',v_hash)
  returning id into v_operation_record_id;

  if p_item_type='sample' then
    select balance.id,balance.quantity into v_balance_id,v_balance
      from public.inventory_balances balance
     where balance.tenant_id=p_tenant_id and balance.employee_id=p_employee_id and balance.sample_id=p_item_id
     for update;
    if v_balance_id is null then
      insert into public.inventory_balances(tenant_id,employee_id,item_type,sample_id,quantity)
      values(p_tenant_id,p_employee_id,'sample',p_item_id,p_quantity)
      returning id,quantity into v_balance_id,v_balance;
    else
      update public.inventory_balances set quantity=quantity+p_quantity,updated_at=clock_timestamp()
       where tenant_id=p_tenant_id and id=v_balance_id returning quantity into v_balance;
    end if;
    insert into public.inventory_ledger(
      tenant_id,operation_record_id,employee_id,event_type,sample_id,quantity_delta,balance_after
    ) values(p_tenant_id,v_operation_record_id,p_employee_id,'ISSUE',p_item_id,p_quantity,v_balance);
  elsif p_item_type='gift' then
    select balance.id,balance.quantity into v_balance_id,v_balance
      from public.inventory_balances balance
     where balance.tenant_id=p_tenant_id and balance.employee_id=p_employee_id and balance.gift_id=p_item_id
     for update;
    if v_balance_id is null then
      insert into public.inventory_balances(tenant_id,employee_id,item_type,gift_id,quantity)
      values(p_tenant_id,p_employee_id,'gift',p_item_id,p_quantity)
      returning id,quantity into v_balance_id,v_balance;
    else
      update public.inventory_balances set quantity=quantity+p_quantity,updated_at=clock_timestamp()
       where tenant_id=p_tenant_id and id=v_balance_id returning quantity into v_balance;
    end if;
    insert into public.inventory_ledger(
      tenant_id,operation_record_id,employee_id,event_type,gift_id,quantity_delta,balance_after
    ) values(p_tenant_id,v_operation_record_id,p_employee_id,'ISSUE',p_item_id,p_quantity,v_balance);
  else
    raise exception 'invalid inventory item type';
  end if;
end;
$$;

create or replace function public.admin_return_inventory(
  p_tenant_id uuid,p_user_id uuid,p_operation_id uuid,p_item_type text,p_item_id uuid,p_quantity integer
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_employee public.employees%rowtype;
  v_hash bytea; v_existing_hash bytea;
  v_operation_record_id uuid;
  v_balance_id uuid; v_balance integer;
begin
  if p_quantity<1 or p_quantity>100000 then raise exception 'invalid inventory quantity'; end if;
  select employee.* into v_employee from public.employees employee
   where employee.tenant_id=p_tenant_id and employee.user_id=p_user_id and employee.status='active'
   for update;
  if v_employee.id is null then raise exception 'active employee not found'; end if;

  v_hash:=extensions.digest(jsonb_build_object(
    'type','RETURN','itemType',p_item_type,'itemId',p_item_id,'quantity',p_quantity
  )::text,'sha256');
  select operation.request_hash into v_existing_hash from public.inventory_operations operation
   where operation.tenant_id=p_tenant_id and operation.actor_user_id=p_user_id
     and operation.operation_id=p_operation_id;
  if found then
    if v_existing_hash is distinct from v_hash then raise exception 'idempotency key reused with different inventory payload'; end if;
    return;
  end if;

  if p_item_type='sample' then
    select balance.id,balance.quantity into v_balance_id,v_balance
      from public.inventory_balances balance
     where balance.tenant_id=p_tenant_id and balance.employee_id=v_employee.id and balance.sample_id=p_item_id
     for update;
  elsif p_item_type='gift' then
    select balance.id,balance.quantity into v_balance_id,v_balance
      from public.inventory_balances balance
     where balance.tenant_id=p_tenant_id and balance.employee_id=v_employee.id and balance.gift_id=p_item_id
     for update;
  else raise exception 'invalid inventory item type';
  end if;

  if v_balance_id is null or v_balance<p_quantity then raise exception 'insufficient inventory balance'; end if;

  insert into public.inventory_operations(
    tenant_id,employee_id,actor_user_id,operation_id,operation_type,request_hash
  ) values(p_tenant_id,v_employee.id,p_user_id,p_operation_id,'RETURN',v_hash)
  returning id into v_operation_record_id;

  update public.inventory_balances set quantity=quantity-p_quantity,updated_at=clock_timestamp()
   where tenant_id=p_tenant_id and id=v_balance_id returning quantity into v_balance;

  if p_item_type='sample' then
    insert into public.inventory_ledger(
      tenant_id,operation_record_id,employee_id,event_type,sample_id,quantity_delta,balance_after
    ) values(p_tenant_id,v_operation_record_id,v_employee.id,'RETURN',p_item_id,-p_quantity,v_balance);
  else
    insert into public.inventory_ledger(
      tenant_id,operation_record_id,employee_id,event_type,gift_id,quantity_delta,balance_after
    ) values(p_tenant_id,v_operation_record_id,v_employee.id,'RETURN',p_item_id,-p_quantity,v_balance);
  end if;
end;
$$;

create or replace function public.admin_distribute_visit_inventory(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,p_items jsonb
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.field_visits%rowtype;
  v_stop public.tour_plan_stops%rowtype;
  v_employee public.employees%rowtype;
  v_employee_division uuid;
  v_hash bytea; v_existing_hash bytea;
  v_operation_record_id uuid;
  v_item jsonb; v_item_type text; v_item_id uuid; v_quantity integer; v_item_division uuid;
  v_balance_id uuid; v_balance integer;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then
    raise exception 'distribution requires 1 to 20 items';
  end if;

  select visit.* into v_visit from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
  if v_visit.id is null or v_visit.status<>'CHECKED_IN' then raise exception 'open visit not found'; end if;

  select employee.* into v_employee
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id
     and execution.status='ACTIVE' and employee.user_id=p_user_id and employee.status='active'
   for update of employee;
  if v_employee.id is null then raise exception 'visit does not belong to active employee'; end if;

  select stop.* into v_stop from public.tour_plan_stops stop
   where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id and stop.stop_type='doctor';
  if v_stop.id is null then raise exception 'samples/gifts may be distributed only during doctor visits'; end if;

  v_hash:=extensions.digest(jsonb_build_object(
    'type','DISTRIBUTE','visitId',p_visit_id,'items',p_items
  )::text,'sha256');
  select operation.request_hash into v_existing_hash from public.inventory_operations operation
   where operation.tenant_id=p_tenant_id and operation.actor_user_id=p_user_id
     and operation.operation_id=p_operation_id;
  if found then
    if v_existing_hash is distinct from v_hash then raise exception 'idempotency key reused with different inventory payload'; end if;
    return;
  end if;

  v_employee_division:=public.employee_division(p_tenant_id,v_employee.id);
  if v_employee_division is null then raise exception 'employee division unavailable'; end if;

  insert into public.inventory_operations(
    tenant_id,employee_id,actor_user_id,visit_id,operation_id,operation_type,request_hash
  ) values(p_tenant_id,v_employee.id,p_user_id,p_visit_id,p_operation_id,'DISTRIBUTE',v_hash)
  returning id into v_operation_record_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_type:=v_item->>'itemType';
    v_item_id:=(v_item->>'itemId')::uuid;
    v_quantity:=(v_item->>'quantity')::integer;
    if v_quantity<1 or v_quantity>100000 then raise exception 'invalid distribution quantity'; end if;

    v_item_division:=public.inventory_item_division(p_tenant_id,v_item_type,v_item_id,true);
    if v_item_division is null or v_item_division<>v_employee_division then
      raise exception 'sample/gift is not active in employee division';
    end if;

    v_balance_id:=null; v_balance:=null;
    if v_item_type='sample' then
      select balance.id,balance.quantity into v_balance_id,v_balance from public.inventory_balances balance
       where balance.tenant_id=p_tenant_id and balance.employee_id=v_employee.id and balance.sample_id=v_item_id
       for update;
    elsif v_item_type='gift' then
      select balance.id,balance.quantity into v_balance_id,v_balance from public.inventory_balances balance
       where balance.tenant_id=p_tenant_id and balance.employee_id=v_employee.id and balance.gift_id=v_item_id
       for update;
    else raise exception 'invalid inventory item type';
    end if;

    if v_balance_id is null or v_balance<v_quantity then raise exception 'insufficient inventory balance'; end if;

    update public.inventory_balances set quantity=quantity-v_quantity,updated_at=clock_timestamp()
     where tenant_id=p_tenant_id and id=v_balance_id returning quantity into v_balance;

    if v_item_type='sample' then
      insert into public.inventory_ledger(
        tenant_id,operation_record_id,employee_id,event_type,sample_id,quantity_delta,balance_after
      ) values(p_tenant_id,v_operation_record_id,v_employee.id,'DISTRIBUTE',v_item_id,-v_quantity,v_balance);
      insert into public.visit_distributions(
        tenant_id,operation_record_id,visit_id,sample_id,quantity
      ) values(p_tenant_id,v_operation_record_id,p_visit_id,v_item_id,v_quantity);
    else
      insert into public.inventory_ledger(
        tenant_id,operation_record_id,employee_id,event_type,gift_id,quantity_delta,balance_after
      ) values(p_tenant_id,v_operation_record_id,v_employee.id,'DISTRIBUTE',v_item_id,-v_quantity,v_balance);
      insert into public.visit_distributions(
        tenant_id,operation_record_id,visit_id,gift_id,quantity
      ) values(p_tenant_id,v_operation_record_id,p_visit_id,v_item_id,v_quantity);
    end if;
  end loop;
end;
$$;

-- Extend Sprint 9 checkout to snapshot distributions into the immutable DCR.
create or replace function public.admin_checkout_visit(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,
  p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.field_visits%rowtype; v_owner uuid; v_stop public.tour_plan_stops%rowtype;
  v_call public.doctor_calls%rowtype; v_doctor public.doctors%rowtype;
  v_dcr_id uuid; v_checkout_at timestamptz:=clock_timestamp();
begin
  select visit.* into v_visit from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
  if v_visit.id is null then raise exception 'visit not found'; end if;
  if v_visit.status='CHECKED_OUT' then
    if v_visit.checkout_operation_id=p_operation_id
       and v_visit.checkout_latitude=p_latitude
       and v_visit.checkout_longitude=p_longitude
       and v_visit.checkout_accuracy_meters=p_accuracy_meters then return; end if;
    raise exception 'visit already checked out or idempotency payload differs';
  end if;
  select employee.user_id into v_owner
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'visit does not belong to active user'; end if;

  select stop.* into v_stop from public.tour_plan_stops stop
   where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id;
  if v_stop.stop_type='doctor' then
    select call.* into v_call from public.doctor_calls call
     where call.tenant_id=p_tenant_id and call.visit_id=p_visit_id;
    if v_call.id is null then raise exception 'doctor call details required before checkout'; end if;
  end if;

  update public.field_visits set
    status='CHECKED_OUT',checkout_operation_id=p_operation_id,checkout_at=v_checkout_at,
    checkout_latitude=p_latitude,checkout_longitude=p_longitude,checkout_accuracy_meters=p_accuracy_meters
   where tenant_id=p_tenant_id and id=p_visit_id;

  if v_stop.stop_type='doctor' then
    select doctor.* into v_doctor from public.doctors doctor
     where doctor.tenant_id=p_tenant_id and doctor.id=v_stop.doctor_id;

    insert into public.dcrs(
      tenant_id,visit_id,execution_id,doctor_id,doctor_code,doctor_name,
      call_outcome,remarks,next_action,call_started_at,call_ended_at,gps_verification,gps_exception_status
    ) values(
      p_tenant_id,p_visit_id,v_visit.execution_id,v_doctor.id,v_doctor.code,v_doctor.name,
      v_call.call_outcome,v_call.remarks,v_call.next_action,v_visit.checkin_at,v_checkout_at,
      v_visit.verification,v_visit.exception_status
    ) returning id into v_dcr_id;

    insert into public.dcr_products(
      tenant_id,dcr_id,sequence_no,product_id,product_code,product_name,detail_notes
    )
    select p_tenant_id,v_dcr_id,detail.sequence_no,product.id,product.code,product.name,detail.detail_notes
      from public.doctor_call_products detail
      join public.products product on product.tenant_id=detail.tenant_id and product.id=detail.product_id
     where detail.tenant_id=p_tenant_id and detail.doctor_call_id=v_call.id
     order by detail.sequence_no;

    insert into public.dcr_distributions(
      tenant_id,dcr_id,item_type,sample_id,gift_id,item_code,item_name,quantity
    )
    select p_tenant_id,v_dcr_id,
      case when distribution.sample_id is not null then 'sample' else 'gift' end,
      distribution.sample_id,distribution.gift_id,
      coalesce(sample.code,gift.code),coalesce(sample.name,gift.name),sum(distribution.quantity)::integer
      from public.visit_distributions distribution
      left join public.samples sample
        on sample.tenant_id=distribution.tenant_id and sample.id=distribution.sample_id
      left join public.gifts gift
        on gift.tenant_id=distribution.tenant_id and gift.id=distribution.gift_id
     where distribution.tenant_id=p_tenant_id and distribution.visit_id=p_visit_id
     group by distribution.sample_id,distribution.gift_id,sample.code,sample.name,gift.code,gift.name;
  end if;
end;
$$;

alter table public.inventory_balances enable row level security;
alter table public.inventory_operations enable row level security;
alter table public.inventory_ledger enable row level security;
alter table public.visit_distributions enable row level security;
alter table public.dcr_distributions enable row level security;

revoke all on public.inventory_balances from anon,authenticated;
revoke all on public.inventory_operations from anon,authenticated;
revoke all on public.inventory_ledger from anon,authenticated;
revoke all on public.visit_distributions from anon,authenticated;
revoke all on public.dcr_distributions from anon,authenticated;

grant select on public.inventory_balances to authenticated;
grant select on public.visit_distributions to authenticated;
grant select on public.dcr_distributions to authenticated;

create policy inventory_balances_owner_or_team_read on public.inventory_balances
for select to authenticated using(exists(
  select 1 from public.employees employee
   where employee.tenant_id=inventory_balances.tenant_id
     and employee.id=inventory_balances.employee_id
     and (
       employee.user_id=auth.uid()
       or public.has_permission(inventory_balances.tenant_id,'INVENTORY_VIEW_TEAM',employee.org_unit_id)
     )
));

create policy visit_distributions_visit_read on public.visit_distributions
for select to authenticated using(public.can_read_field_visit(tenant_id,visit_id));

create policy dcr_distributions_visit_read on public.dcr_distributions
for select to authenticated using(exists(
  select 1 from public.dcrs dcr
   where dcr.tenant_id=dcr_distributions.tenant_id
     and dcr.id=dcr_distributions.dcr_id
     and public.can_read_field_visit(dcr.tenant_id,dcr.visit_id)
));

revoke all on function public.admin_issue_inventory(uuid,uuid,uuid,uuid,text,uuid,integer) from public;
revoke all on function public.admin_return_inventory(uuid,uuid,uuid,text,uuid,integer) from public;
revoke all on function public.admin_distribute_visit_inventory(uuid,uuid,uuid,uuid,jsonb) from public;
grant execute on function public.admin_issue_inventory(uuid,uuid,uuid,uuid,text,uuid,integer) to service_role;
grant execute on function public.admin_return_inventory(uuid,uuid,uuid,text,uuid,integer) to service_role;
grant execute on function public.admin_distribute_visit_inventory(uuid,uuid,uuid,uuid,jsonb) to service_role;

commit;
