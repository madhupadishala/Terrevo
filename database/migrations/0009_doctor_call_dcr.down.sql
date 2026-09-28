begin;

-- Restore Sprint 8 checkout behavior before removing DCR/call tables.
create or replace function public.admin_checkout_visit(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,
  p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision
)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_visit public.field_visits%rowtype; v_owner uuid;
begin
  select visit.* into v_visit from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
  if v_visit.id is null then raise exception 'visit not found'; end if;
  if v_visit.status='CHECKED_OUT' then
    if v_visit.checkout_operation_id=p_operation_id then return; end if;
    raise exception 'visit already checked out';
  end if;
  select employee.user_id into v_owner
    from public.tour_executions execution
    join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
  if v_owner is distinct from p_user_id then raise exception 'visit does not belong to active user'; end if;
  update public.field_visits set status='CHECKED_OUT',checkout_operation_id=p_operation_id,checkout_at=clock_timestamp(),
    checkout_latitude=p_latitude,checkout_longitude=p_longitude,checkout_accuracy_meters=p_accuracy_meters
   where tenant_id=p_tenant_id and id=p_visit_id;
end;
$$;

drop function if exists public.admin_save_doctor_call(uuid,uuid,uuid,uuid,text,text,text,jsonb);
drop table if exists public.dcr_products;
drop table if exists public.dcrs;
drop table if exists public.doctor_call_operations;
drop table if exists public.doctor_call_products;
drop table if exists public.doctor_calls;
drop function if exists public.can_read_field_visit(uuid,uuid);

commit;
