begin;

-- Restore Sprint 9 checkout without distribution snapshotting.
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
  select employee.user_id into v_owner from public.tour_executions execution
  join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
  where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'visit does not belong to active user'; end if;
  select stop.* into v_stop from public.tour_plan_stops stop where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id;
  if v_stop.stop_type='doctor' then
    select call.* into v_call from public.doctor_calls call where call.tenant_id=p_tenant_id and call.visit_id=p_visit_id;
    if v_call.id is null then raise exception 'doctor call details required before checkout'; end if;
  end if;
  update public.field_visits set status='CHECKED_OUT',checkout_operation_id=p_operation_id,checkout_at=v_checkout_at,
    checkout_latitude=p_latitude,checkout_longitude=p_longitude,checkout_accuracy_meters=p_accuracy_meters
    where tenant_id=p_tenant_id and id=p_visit_id;
  if v_stop.stop_type='doctor' then
    select doctor.* into v_doctor from public.doctors doctor where doctor.tenant_id=p_tenant_id and doctor.id=v_stop.doctor_id;
    insert into public.dcrs(tenant_id,visit_id,execution_id,doctor_id,doctor_code,doctor_name,call_outcome,remarks,next_action,call_started_at,call_ended_at,gps_verification,gps_exception_status)
    values(p_tenant_id,p_visit_id,v_visit.execution_id,v_doctor.id,v_doctor.code,v_doctor.name,v_call.call_outcome,v_call.remarks,v_call.next_action,v_visit.checkin_at,v_checkout_at,v_visit.verification,v_visit.exception_status)
    returning id into v_dcr_id;
    insert into public.dcr_products(tenant_id,dcr_id,sequence_no,product_id,product_code,product_name,detail_notes)
    select p_tenant_id,v_dcr_id,detail.sequence_no,product.id,product.code,product.name,detail.detail_notes
    from public.doctor_call_products detail join public.products product on product.tenant_id=detail.tenant_id and product.id=detail.product_id
    where detail.tenant_id=p_tenant_id and detail.doctor_call_id=v_call.id order by detail.sequence_no;
  end if;
end;
$$;

drop function if exists public.admin_distribute_visit_inventory(uuid,uuid,uuid,uuid,jsonb);
drop function if exists public.admin_return_inventory(uuid,uuid,uuid,text,uuid,integer);
drop function if exists public.admin_issue_inventory(uuid,uuid,uuid,uuid,text,uuid,integer);
drop table if exists public.dcr_distributions;
drop table if exists public.visit_distributions;
drop table if exists public.inventory_ledger;
drop table if exists public.inventory_operations;
drop table if exists public.inventory_balances;
drop function if exists public.inventory_item_division(uuid,text,uuid,boolean);
drop function if exists public.employee_division(uuid,uuid);
drop function if exists public.user_has_permission(uuid,uuid,text,uuid);

delete from public.role_permissions where permission_key in(
  'INVENTORY_VIEW_OWN','INVENTORY_VIEW_TEAM','INVENTORY_MANAGE'
);

commit;
