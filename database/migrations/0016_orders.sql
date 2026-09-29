begin;
create table public.sales_orders(
 id uuid primary key default extensions.gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 visit_id uuid not null,customer_type text not null check(customer_type in('chemist','stockist')),chemist_id uuid,stockist_id uuid,
 customer_code text not null,customer_name text not null,status text not null default 'BOOKED' check(status='BOOKED'),remarks text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,visit_id),
 foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
 foreign key(tenant_id,chemist_id) references public.chemists(tenant_id,id) on delete restrict,
 foreign key(tenant_id,stockist_id) references public.stockists(tenant_id,id) on delete restrict,
 check((customer_type='chemist' and chemist_id is not null and stockist_id is null) or(customer_type='stockist' and chemist_id is null and stockist_id is not null))
);
create table public.sales_order_lines(
 id uuid primary key default extensions.gen_random_uuid(),tenant_id uuid not null,sales_order_id uuid not null,sequence_no integer not null check(sequence_no>0),
 product_id uuid not null,product_code text not null,product_name text not null,quantity integer not null check(quantity>0),remarks text,
 unique(tenant_id,sales_order_id,sequence_no),unique(tenant_id,sales_order_id,product_id),
 foreign key(tenant_id,sales_order_id) references public.sales_orders(tenant_id,id) on delete cascade,
 foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete restrict
);
create table public.sales_order_operations(
 id uuid primary key default extensions.gen_random_uuid(),tenant_id uuid not null,sales_order_id uuid not null,actor_user_id uuid not null,
 operation_id uuid not null,request_hash bytea not null,created_at timestamptz not null default now(),unique(tenant_id,actor_user_id,operation_id),
 foreign key(tenant_id,sales_order_id) references public.sales_orders(tenant_id,id) on delete cascade,
 foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);
create or replace function public.admin_save_sales_order(p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,p_remarks text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_visit public.field_visits%rowtype;v_stop public.tour_plan_stops%rowtype;v_owner uuid;v_employee uuid;v_division uuid;v_order uuid;v_hash bytea;v_old bytea;v_line jsonb;v_product public.products%rowtype;v_code text;v_name text;
begin
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>50 then raise exception 'invalid order lines';end if;
 v_hash:=extensions.digest(jsonb_build_object('visitId',p_visit_id,'remarks',nullif(trim(p_remarks),''),'lines',p_lines)::text,'sha256');
 select operation.sales_order_id,operation.request_hash into v_order,v_old from public.sales_order_operations operation where operation.tenant_id=p_tenant_id and operation.actor_user_id=p_user_id and operation.operation_id=p_operation_id;
 if found then if v_old is distinct from v_hash then raise exception 'idempotency key reused with different payload';end if;return v_order;end if;
 select visit.* into v_visit from public.field_visits visit where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
 if v_visit.id is null or v_visit.status<>'CHECKED_IN' then raise exception 'open trade visit not found';end if;
 select employee.user_id,employee.id into v_owner,v_employee from public.tour_executions execution join public.employees employee on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
 if v_owner is distinct from p_user_id then raise exception 'visit does not belong to active user';end if;
 select stop.* into v_stop from public.tour_plan_stops stop where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id and stop.stop_type in('chemist','stockist');if v_stop.id is null then raise exception 'orders require chemist/stockist visit';end if;
 v_division:=public.employee_division(p_tenant_id,v_employee);
 select o.id into v_order from public.sales_orders o where o.tenant_id=p_tenant_id and o.visit_id=p_visit_id;
 if v_stop.stop_type='chemist' then select code,name into v_code,v_name from public.chemists where tenant_id=p_tenant_id and id=v_stop.chemist_id and status='active';
 else select code,name into v_code,v_name from public.stockists where tenant_id=p_tenant_id and id=v_stop.stockist_id and status='active';end if;
 if v_code is null then raise exception 'active customer not found';end if;
 if v_order is null then insert into public.sales_orders(tenant_id,visit_id,customer_type,chemist_id,stockist_id,customer_code,customer_name,remarks)
 values(p_tenant_id,p_visit_id,v_stop.stop_type,v_stop.chemist_id,v_stop.stockist_id,v_code,v_name,nullif(trim(p_remarks),'')) returning id into v_order;
 else update public.sales_orders set remarks=nullif(trim(p_remarks),''),updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_order;delete from public.sales_order_lines where tenant_id=p_tenant_id and sales_order_id=v_order;end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  select product.* into v_product from public.products product where product.tenant_id=p_tenant_id and product.id=(v_line->>'productId')::uuid and product.division_id=v_division and product.status='active';if v_product.id is null then raise exception 'order product outside employee division';end if;
  insert into public.sales_order_lines(tenant_id,sales_order_id,sequence_no,product_id,product_code,product_name,quantity,remarks)
  values(p_tenant_id,v_order,(v_line->>'sequence')::integer,v_product.id,v_product.code,v_product.name,(v_line->>'quantity')::integer,nullif(trim(v_line->>'remarks'),''));
 end loop;
 insert into public.sales_order_operations(tenant_id,sales_order_id,actor_user_id,operation_id,request_hash) values(p_tenant_id,v_order,p_user_id,p_operation_id,v_hash);return v_order;
end;$$;
alter table public.sales_orders enable row level security;alter table public.sales_order_lines enable row level security;alter table public.sales_order_operations enable row level security;
revoke all on public.sales_orders from anon,authenticated;revoke all on public.sales_order_lines from anon,authenticated;revoke all on public.sales_order_operations from anon,authenticated;grant select on public.sales_orders to authenticated;grant select on public.sales_order_lines to authenticated;
create policy sales_orders_visit_read on public.sales_orders for select to authenticated using(public.can_read_field_visit(tenant_id,visit_id));
create policy sales_order_lines_visit_read on public.sales_order_lines for select to authenticated using(exists(select 1 from public.sales_orders o where o.tenant_id=sales_order_lines.tenant_id and o.id=sales_order_lines.sales_order_id and public.can_read_field_visit(o.tenant_id,o.visit_id)));
revoke all on function public.admin_save_sales_order(uuid,uuid,uuid,uuid,text,jsonb) from public;grant execute on function public.admin_save_sales_order(uuid,uuid,uuid,uuid,text,jsonb) to service_role;
commit;