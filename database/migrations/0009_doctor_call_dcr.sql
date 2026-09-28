begin;

create table public.doctor_calls(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null,
  doctor_id uuid not null,
  call_outcome text not null check(length(trim(call_outcome)) between 1 and 120),
  remarks text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,visit_id),
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
  foreign key(tenant_id,doctor_id) references public.doctors(tenant_id,id) on delete restrict
);

create table public.doctor_call_products(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  doctor_call_id uuid not null,
  sequence_no integer not null check(sequence_no>0),
  product_id uuid not null,
  detail_notes text,
  unique(tenant_id,doctor_call_id,sequence_no),
  unique(tenant_id,doctor_call_id,product_id),
  foreign key(tenant_id,doctor_call_id) references public.doctor_calls(tenant_id,id) on delete cascade,
  foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete restrict
);

create table public.doctor_call_operations(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  visit_id uuid not null,
  doctor_call_id uuid not null,
  operation_id uuid not null,
  request_hash bytea not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,visit_id,operation_id),
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
  foreign key(tenant_id,doctor_call_id) references public.doctor_calls(tenant_id,id) on delete cascade
);

create table public.dcrs(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null,
  execution_id uuid not null,
  doctor_id uuid not null,
  doctor_code text not null,
  doctor_name text not null,
  status text not null default 'SUBMITTED' check(status='SUBMITTED'),
  call_outcome text not null,
  remarks text,
  next_action text,
  call_started_at timestamptz not null,
  call_ended_at timestamptz not null,
  submitted_at timestamptz not null default clock_timestamp(),
  gps_verification text not null,
  gps_exception_status text not null,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  unique(tenant_id,visit_id),
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
  foreign key(tenant_id,execution_id) references public.tour_executions(tenant_id,id) on delete restrict,
  foreign key(tenant_id,doctor_id) references public.doctors(tenant_id,id) on delete restrict
);

create table public.dcr_products(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  dcr_id uuid not null,
  sequence_no integer not null check(sequence_no>0),
  product_id uuid not null,
  product_code text not null,
  product_name text not null,
  detail_notes text,
  unique(tenant_id,dcr_id,sequence_no),
  unique(tenant_id,dcr_id,product_id),
  foreign key(tenant_id,dcr_id) references public.dcrs(tenant_id,id) on delete cascade,
  foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete restrict
);

create or replace function public.can_read_field_visit(p_tenant_id uuid,p_visit_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
      from public.field_visits visit
      join public.tour_executions execution
        on execution.tenant_id=visit.tenant_id and execution.id=visit.execution_id
      join public.employees employee
        on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
     where visit.tenant_id=p_tenant_id and visit.id=p_visit_id
       and (
         (employee.user_id=auth.uid() and employee.status='active')
         or public.can_access_tour_plan(execution.tenant_id,execution.tour_plan_id,'TOUR_VIEW_TEAM')
       )
  );
$$;
revoke all on function public.can_read_field_visit(uuid,uuid) from public;
grant execute on function public.can_read_field_visit(uuid,uuid) to authenticated;

create or replace function public.admin_save_doctor_call(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,
  p_call_outcome text,p_remarks text,p_next_action text,p_products jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.field_visits%rowtype;
  v_stop public.tour_plan_stops%rowtype;
  v_owner uuid;
  v_call_id uuid;
  v_existing_hash bytea;
  v_request_hash bytea;
  v_division_id uuid;
  v_product jsonb;
  v_product_id uuid;
begin
  if nullif(trim(p_call_outcome),'') is null or length(trim(p_call_outcome))>120 then
    raise exception 'invalid call outcome';
  end if;
  if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)>20 then
    raise exception 'invalid product details';
  end if;

  v_request_hash:=extensions.digest(
    jsonb_build_object(
      'callOutcome',trim(p_call_outcome),
      'remarks',nullif(trim(p_remarks),''),
      'nextAction',nullif(trim(p_next_action),''),
      'products',p_products
    )::text,
    'sha256'
  );

  select visit.* into v_visit
    from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id
   for update;
  if v_visit.id is null then raise exception 'visit not found'; end if;
  if v_visit.status<>'CHECKED_IN' then raise exception 'doctor call is locked after checkout'; end if;

  select operation.doctor_call_id,operation.request_hash into v_call_id,v_existing_hash
    from public.doctor_call_operations operation
   where operation.tenant_id=p_tenant_id
     and operation.visit_id=p_visit_id
     and operation.operation_id=p_operation_id;
  if v_call_id is not null then
    if v_existing_hash is distinct from v_request_hash then
      raise exception 'idempotency key reused with different payload';
    end if;
    return v_call_id;
  end if;

  select employee.user_id into v_owner
    from public.tour_executions execution
    join public.employees employee
      on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id
     and execution.id=v_visit.execution_id
     and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'doctor visit does not belong to active user'; end if;

  select stop.* into v_stop
    from public.tour_plan_stops stop
   where stop.tenant_id=p_tenant_id
     and stop.id=v_visit.plan_stop_id
     and stop.stop_type='doctor';
  if v_stop.id is null or v_stop.doctor_id is null then raise exception 'visit is not a doctor call'; end if;

  with recursive ancestry as(
    select unit.id,unit.parent_id,unit.type
      from public.organization_units unit
     where unit.tenant_id=p_tenant_id and unit.id=v_visit.territory_id
    union all
    select parent.id,parent.parent_id,parent.type
      from public.organization_units parent
      join ancestry child on child.parent_id=parent.id
     where parent.tenant_id=p_tenant_id
  )
  select id into v_division_id from ancestry where type='division' limit 1;
  if v_division_id is null then raise exception 'doctor territory has no division'; end if;

  select call.id into v_call_id
    from public.doctor_calls call
   where call.tenant_id=p_tenant_id and call.visit_id=p_visit_id;

  if v_call_id is null then
    insert into public.doctor_calls(
      tenant_id,visit_id,doctor_id,call_outcome,remarks,next_action
    ) values(
      p_tenant_id,p_visit_id,v_stop.doctor_id,trim(p_call_outcome),
      nullif(trim(p_remarks),''),nullif(trim(p_next_action),'')
    ) returning id into v_call_id;
  else
    update public.doctor_calls set
      call_outcome=trim(p_call_outcome),
      remarks=nullif(trim(p_remarks),''),
      next_action=nullif(trim(p_next_action),''),
      updated_at=clock_timestamp()
    where tenant_id=p_tenant_id and id=v_call_id;

    delete from public.doctor_call_products
     where tenant_id=p_tenant_id and doctor_call_id=v_call_id;
  end if;

  for v_product in select value from jsonb_array_elements(p_products)
  loop
    v_product_id:=(v_product->>'productId')::uuid;
    if not exists(
      select 1 from public.products product
       where product.tenant_id=p_tenant_id
         and product.id=v_product_id
         and product.division_id=v_division_id
         and product.status='active'
    ) then raise exception 'product is not active in doctor division'; end if;

    insert into public.doctor_call_products(
      tenant_id,doctor_call_id,sequence_no,product_id,detail_notes
    ) values(
      p_tenant_id,v_call_id,(v_product->>'sequence')::integer,v_product_id,
      nullif(trim(v_product->>'detailNotes'),'')
    );
  end loop;

  insert into public.doctor_call_operations(
    tenant_id,visit_id,doctor_call_id,operation_id,request_hash
  ) values(p_tenant_id,p_visit_id,v_call_id,p_operation_id,v_request_hash);

  return v_call_id;
end;
$$;

-- Sprint 9 strengthens checkout: a doctor visit requires call data and creates the DCR in the same transaction.
create or replace function public.admin_checkout_visit(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,
  p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision
)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.field_visits%rowtype;
  v_owner uuid;
  v_stop public.tour_plan_stops%rowtype;
  v_call public.doctor_calls%rowtype;
  v_doctor public.doctors%rowtype;
  v_dcr_id uuid;
  v_checkout_at timestamptz:=clock_timestamp();
begin
  select visit.* into v_visit
    from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id
   for update;
  if v_visit.id is null then raise exception 'visit not found'; end if;

  if v_visit.status='CHECKED_OUT' then
    if v_visit.checkout_operation_id=p_operation_id
       and v_visit.checkout_latitude=p_latitude
       and v_visit.checkout_longitude=p_longitude
       and v_visit.checkout_accuracy_meters=p_accuracy_meters then
      return;
    end if;
    raise exception 'visit already checked out or idempotency payload differs';
  end if;

  select employee.user_id into v_owner
    from public.tour_executions execution
    join public.employees employee
      on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id
     and execution.id=v_visit.execution_id
     and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'visit does not belong to active user'; end if;

  select stop.* into v_stop
    from public.tour_plan_stops stop
   where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id;

  if v_stop.stop_type='doctor' then
    select call.* into v_call
      from public.doctor_calls call
     where call.tenant_id=p_tenant_id and call.visit_id=p_visit_id;
    if v_call.id is null then raise exception 'doctor call details required before checkout'; end if;
  end if;

  update public.field_visits set
    status='CHECKED_OUT',checkout_operation_id=p_operation_id,checkout_at=v_checkout_at,
    checkout_latitude=p_latitude,checkout_longitude=p_longitude,checkout_accuracy_meters=p_accuracy_meters
   where tenant_id=p_tenant_id and id=p_visit_id;

  if v_stop.stop_type='doctor' then
    select doctor.* into v_doctor
      from public.doctors doctor
     where doctor.tenant_id=p_tenant_id and doctor.id=v_stop.doctor_id;

    insert into public.dcrs(
      tenant_id,visit_id,execution_id,doctor_id,doctor_code,doctor_name,
      call_outcome,remarks,next_action,call_started_at,call_ended_at,
      gps_verification,gps_exception_status
    ) values(
      p_tenant_id,p_visit_id,v_visit.execution_id,v_doctor.id,v_doctor.code,v_doctor.name,
      v_call.call_outcome,v_call.remarks,v_call.next_action,v_visit.checkin_at,v_checkout_at,
      v_visit.verification,v_visit.exception_status
    )
    returning id into v_dcr_id;

    insert into public.dcr_products(
      tenant_id,dcr_id,sequence_no,product_id,product_code,product_name,detail_notes
    )
    select p_tenant_id,v_dcr_id,detail.sequence_no,product.id,product.code,product.name,detail.detail_notes
      from public.doctor_call_products detail
      join public.products product
        on product.tenant_id=detail.tenant_id and product.id=detail.product_id
     where detail.tenant_id=p_tenant_id and detail.doctor_call_id=v_call.id
     order by detail.sequence_no;
  end if;
end;
$$;

alter table public.doctor_calls enable row level security;
alter table public.doctor_call_products enable row level security;
alter table public.doctor_call_operations enable row level security;
alter table public.dcrs enable row level security;
alter table public.dcr_products enable row level security;

revoke all on public.doctor_calls from anon,authenticated;
revoke all on public.doctor_call_products from anon,authenticated;
revoke all on public.doctor_call_operations from anon,authenticated;
revoke all on public.dcrs from anon,authenticated;
revoke all on public.dcr_products from anon,authenticated;

grant select on public.doctor_calls to authenticated;
grant select on public.doctor_call_products to authenticated;
grant select on public.dcrs to authenticated;
grant select on public.dcr_products to authenticated;

create policy doctor_calls_visit_read on public.doctor_calls
for select to authenticated using(public.can_read_field_visit(tenant_id,visit_id));

create policy doctor_call_products_visit_read on public.doctor_call_products
for select to authenticated using(exists(
  select 1 from public.doctor_calls call
   where call.tenant_id=doctor_call_products.tenant_id
     and call.id=doctor_call_products.doctor_call_id
     and public.can_read_field_visit(call.tenant_id,call.visit_id)
));

create policy dcrs_visit_read on public.dcrs
for select to authenticated using(public.can_read_field_visit(tenant_id,visit_id));

create policy dcr_products_visit_read on public.dcr_products
for select to authenticated using(exists(
  select 1 from public.dcrs dcr
   where dcr.tenant_id=dcr_products.tenant_id
     and dcr.id=dcr_products.dcr_id
     and public.can_read_field_visit(dcr.tenant_id,dcr.visit_id)
));

revoke all on function public.admin_save_doctor_call(uuid,uuid,uuid,uuid,text,text,text,jsonb) from public;
grant execute on function public.admin_save_doctor_call(uuid,uuid,uuid,uuid,text,text,text,jsonb) to service_role;

commit;
