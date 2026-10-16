begin;

alter table public.nca_records drop constraint if exists nca_records_duration_minutes_check;
alter table public.nca_records add constraint nca_records_duration_minutes_check check(duration_minutes between 30 and 600) not valid;
alter table public.nca_records drop constraint if exists nca_records_status_check;
alter table public.nca_records add constraint nca_records_status_check check(status in('DRAFT','SUBMITTED','APPROVED','REJECTED'));
alter table public.nca_records add column if not exists reviewed_by uuid;
alter table public.nca_records add column if not exists reviewed_at timestamptz;
alter table public.nca_records add column if not exists manager_comment text;
alter table public.nca_records drop constraint if exists nca_records_reviewed_by_fkey;
alter table public.nca_records add constraint nca_records_reviewed_by_fkey foreign key(tenant_id,reviewed_by)
 references public.tenant_memberships(tenant_id,user_id) on delete restrict;

create table if not exists public.nca_decisions(
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null,
 nca_id uuid not null,
 actor_user_id uuid not null,
 decision text not null check(decision in('APPROVE','REJECT')),
 comment text,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,nca_id) references public.nca_records(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_user_id) references public.tenant_memberships(tenant_id,user_id) on delete restrict
);
alter table public.nca_decisions enable row level security;
revoke all on public.nca_decisions from anon,authenticated;
grant select on public.nca_decisions to authenticated;
drop policy if exists nca_decisions_visible on public.nca_decisions;
create policy nca_decisions_visible on public.nca_decisions for select to authenticated
using(exists(select 1 from public.nca_records n where n.tenant_id=nca_decisions.tenant_id and n.id=nca_decisions.nca_id));

create or replace function public.admin_create_nca(
 p_tenant_id uuid,p_actor uuid,p_operation_id uuid,p_work_date date,p_territory_id uuid,
 p_phase text,p_category_code text,p_town_id uuid,p_reason text,p_remarks text,p_duration_minutes integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_employee public.employees%rowtype;
begin
 select e.* into v_employee from public.employees e
 join public.tenant_memberships m on m.tenant_id=e.tenant_id and m.user_id=e.user_id
 where e.tenant_id=p_tenant_id and e.user_id=p_actor and e.status='active' limit 1;
 if v_employee.id is null or not public.user_has_permission(p_tenant_id,p_actor,'TOUR_PLAN_OWN',p_territory_id)
 then raise exception 'NCA capture denied' using errcode='42501';end if;
 if not exists(select 1 from public.organization_units o where o.tenant_id=p_tenant_id and o.id=p_territory_id
   and o.type='territory' and o.status='active' and public.org_unit_in_scope(p_tenant_id,p_territory_id,v_employee.org_unit_id))
 then raise exception 'NCA territory outside employee scope' using errcode='42501';end if;
 select n.id into v_id from public.nca_records n where n.tenant_id=p_tenant_id and n.created_by=p_actor and n.operation_id=p_operation_id;
 if v_id is not null then return v_id;end if;
 if p_phase not in('PLAN','REPORT') or (p_phase='PLAN' and p_town_id is null)
   or p_duration_minutes not between 30 and 600 or length(trim(p_reason)) not between 1 and 500
   or length(coalesce(p_remarks,''))>2000 or (p_phase='REPORT' and length(trim(coalesce(p_remarks,'')))=0) or p_work_date is null
 then raise exception 'Invalid NCA fields' using errcode='22023';end if;
 if exists(select 1 from public.field_visits v join public.tour_executions e on e.tenant_id=v.tenant_id and e.id=v.execution_id
   where v.tenant_id=p_tenant_id and e.employee_id=v_employee.id and e.work_date=p_work_date and v.status='CHECKED_IN')
 then raise exception 'NCA cannot overlap active customer check-in' using errcode='23505';end if;
 if not exists(select 1 from public.nca_categories c where c.tenant_id=p_tenant_id and c.code=p_category_code and c.active)
 then raise exception 'NCA category is not approved' using errcode='22023';end if;
 if p_town_id is not null and not exists(select 1 from public.nca_towns t where t.tenant_id=p_tenant_id and t.id=p_town_id and t.territory_id=p_territory_id and t.active)
 then raise exception 'NCA town is not authorized' using errcode='22023';end if;
 insert into public.nca_records(tenant_id,created_by,operation_id,work_date,territory_id,phase,category_code,town_id,reason,remarks,duration_minutes)
 values(p_tenant_id,p_actor,p_operation_id,p_work_date,p_territory_id,p_phase,p_category_code,p_town_id,trim(p_reason),coalesce(p_remarks,''),p_duration_minutes)
 on conflict(tenant_id,created_by,operation_id) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.nca_records where tenant_id=p_tenant_id and created_by=p_actor and operation_id=p_operation_id;end if;
 return v_id;
end;$$;

create or replace function public.admin_decide_nca(p_tenant_id uuid,p_actor uuid,p_id uuid,p_decision text,p_comment text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.nca_records%rowtype;
begin
 select * into v from public.nca_records where tenant_id=p_tenant_id and id=p_id for update;
 if v.id is null or v.status<>'SUBMITTED' then raise exception 'submitted NCA not found';end if;
 if v.created_by=p_actor then raise exception 'self approval not allowed';end if;
 if not public.user_has_permission(p_tenant_id,p_actor,'TOUR_APPROVE',v.territory_id) then raise exception 'NCA approval denied' using errcode='42501';end if;
 if p_decision not in('APPROVE','REJECT') then raise exception 'invalid NCA decision';end if;
 if p_decision='REJECT' and nullif(trim(p_comment),'') is null then raise exception 'reject comment required';end if;
 update public.nca_records set status=case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
 reviewed_by=p_actor,reviewed_at=clock_timestamp(),manager_comment=nullif(trim(p_comment),'')
 where tenant_id=p_tenant_id and id=p_id;
 insert into public.nca_decisions(tenant_id,nca_id,actor_user_id,decision,comment)
 values(p_tenant_id,p_id,p_actor,p_decision,nullif(trim(p_comment),''));
end;$$;

revoke all on function public.admin_decide_nca(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_decide_nca(uuid,uuid,uuid,text,text) to service_role;

commit;