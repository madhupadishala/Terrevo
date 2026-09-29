begin;
create table public.rcpa_reports(
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 visit_id uuid not null,chemist_id uuid not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,visit_id),
 foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
 foreign key(tenant_id,chemist_id) references public.chemists(tenant_id,id) on delete restrict
);
create table public.rcpa_lines(
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null,rcpa_report_id uuid not null,sequence_no integer not null check(sequence_no>0),
 product_id uuid,competitor_brand text,prescription_count integer not null default 0 check(prescription_count>=0),
 stock_quantity integer not null default 0 check(stock_quantity>=0),sales_quantity integer not null default 0 check(sales_quantity>=0),
 unique(tenant_id,rcpa_report_id,sequence_no),
 foreign key(tenant_id,rcpa_report_id) references public.rcpa_reports(tenant_id,id) on delete cascade,
 foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete restrict,
 check((product_id is not null)<>(competitor_brand is not null)),
 check(prescription_count+stock_quantity+sales_quantity>0)
);
create unique index rcpa_product_unique on public.rcpa_lines(tenant_id,rcpa_report_id,product_id) where product_id is not null;
create unique index rcpa_competitor_unique on public.rcpa_lines(tenant_id,rcpa_report_id,lower(competitor_brand)) where competitor_brand is not null;
create table public.rcpa_operations(
 id uuid primary key default extensions.gen_random_uuid(),tenant_id uuid not null,
 report_id uuid not null,actor_user_id uuid not null,operation_id uuid not null,request_hash bytea not null,created_at timestamptz not null default now(),
 unique(tenant_id,actor_user_id,operation_id),
 foreign key(tenant_id,report_id) references public.rcpa_reports(tenant_id,id) on delete cascade,
 foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);
create or replace function public.admin_save_rcpa(p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_visit public.field_visits%rowtype;v_stop public.tour_plan_stops%rowtype;v_owner uuid;v_employee_id uuid;v_division uuid;
 v_report_id uuid;v_hash bytea;v_old bytea;v_line jsonb;v_product uuid;
begin
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>50 then raise exception 'invalid RCPA lines';end if;
 v_hash:=extensions.digest(p_lines::text,'sha256');
 select operation.report_id,operation.request_hash into v_report_id,v_old from public.rcpa_operations operation
 where operation.tenant_id=p_tenant_id and operation.actor_user_id=p_user_id and operation.operation_id=p_operation_id;
 if found then if v_old is distinct from v_hash then raise exception 'idempotency key reused with different payload';end if;return v_report_id;end if;
 select visit.* into v_visit from public.field_visits visit where visit.tenant_id=p_tenant_id and visit.id=p_visit_id for update;
 if v_visit.id is null or v_visit.status<>'CHECKED_IN' then raise exception 'open chemist visit not found';end if;
 select employee.user_id,employee.id into v_owner,v_employee_id from public.tour_executions execution join public.employees employee
 on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
 where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id and execution.status='ACTIVE';
 if v_owner is distinct from p_user_id then raise exception 'chemist visit does not belong to active user';end if;
 select stop.* into v_stop from public.tour_plan_stops stop where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id and stop.stop_type='chemist';
 if v_stop.id is null then raise exception 'RCPA requires chemist visit';end if;
 v_division:=public.employee_division(p_tenant_id,v_employee_id);if v_division is null then raise exception 'employee division unavailable';end if;
 select report.id into v_report_id from public.rcpa_reports report where report.tenant_id=p_tenant_id and report.visit_id=p_visit_id;
 if v_report_id is null then insert into public.rcpa_reports(tenant_id,visit_id,chemist_id) values(p_tenant_id,p_visit_id,v_stop.chemist_id) returning id into v_report_id;
 else update public.rcpa_reports set updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=v_report_id;
 delete from public.rcpa_lines where tenant_id=p_tenant_id and rcpa_report_id=v_report_id;end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_product:=nullif(v_line->>'productId','')::uuid;
  if v_product is not null and not exists(select 1 from public.products product where product.tenant_id=p_tenant_id and product.id=v_product and product.division_id=v_division and product.status='active')
  then raise exception 'RCPA product outside employee division';end if;
  insert into public.rcpa_lines(tenant_id,rcpa_report_id,sequence_no,product_id,competitor_brand,prescription_count,stock_quantity,sales_quantity)
  values(p_tenant_id,v_report_id,(v_line->>'sequence')::integer,v_product,nullif(trim(v_line->>'competitorBrand'),''),
  coalesce((v_line->>'prescriptionCount')::integer,0),coalesce((v_line->>'stockQuantity')::integer,0),coalesce((v_line->>'salesQuantity')::integer,0));
 end loop;
 insert into public.rcpa_operations(tenant_id,report_id,actor_user_id,operation_id,request_hash) values(p_tenant_id,v_report_id,p_user_id,p_operation_id,v_hash);
 return v_report_id;
end;$$;
alter table public.rcpa_reports enable row level security;alter table public.rcpa_lines enable row level security;alter table public.rcpa_operations enable row level security;
revoke all on public.rcpa_reports from anon,authenticated;revoke all on public.rcpa_lines from anon,authenticated;revoke all on public.rcpa_operations from anon,authenticated;
grant select on public.rcpa_reports to authenticated;grant select on public.rcpa_lines to authenticated;
create policy rcpa_reports_visit_read on public.rcpa_reports for select to authenticated using(public.can_read_field_visit(tenant_id,visit_id));
create policy rcpa_lines_visit_read on public.rcpa_lines for select to authenticated using(exists(select 1 from public.rcpa_reports report where report.tenant_id=rcpa_lines.tenant_id and report.id=rcpa_lines.rcpa_report_id and public.can_read_field_visit(report.tenant_id,report.visit_id)));
revoke all on function public.admin_save_rcpa(uuid,uuid,uuid,uuid,jsonb) from public;grant execute on function public.admin_save_rcpa(uuid,uuid,uuid,uuid,jsonb) to service_role;
commit;