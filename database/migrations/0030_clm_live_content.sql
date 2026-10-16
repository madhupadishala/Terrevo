begin;

create table public.clm_assets(
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 code text not null,
 title text not null,
 version text not null,
 category text not null,
 status text not null check(status in('DRAFT','APPROVED','EXPIRED','WITHDRAWN')),
 division_id uuid not null,
 effective_from date not null,
 expires_at date,
 created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,code),
 foreign key(tenant_id,division_id) references public.organization_units(tenant_id,id) on delete restrict,
 check(expires_at is null or expires_at>=effective_from)
);
create table public.clm_asset_products(
 tenant_id uuid not null,asset_id uuid not null,product_id uuid not null,
 primary key(tenant_id,asset_id,product_id),
 foreign key(tenant_id,asset_id) references public.clm_assets(tenant_id,id) on delete cascade,
 foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete restrict
);
create table public.clm_slides(
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null,asset_id uuid not null,sequence_no integer not null check(sequence_no between 1 and 500),
 title text not null,body text not null default '',
 unique(tenant_id,id),unique(tenant_id,asset_id,sequence_no),
 foreign key(tenant_id,asset_id) references public.clm_assets(tenant_id,id) on delete cascade
);
create table public.clm_detailing_sessions(
 id uuid primary key default extensions.gen_random_uuid(),
 tenant_id uuid not null,visit_id uuid not null,asset_id uuid not null,operation_id uuid not null,
 started_at timestamptz not null,ended_at timestamptz not null,
 reaction text not null check(reaction in('POSITIVE','NEUTRAL','NEGATIVE')),
 created_by uuid not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,operation_id),
 foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
 foreign key(tenant_id,asset_id) references public.clm_assets(tenant_id,id) on delete restrict,
 foreign key(tenant_id,created_by) references public.tenant_memberships(tenant_id,user_id) on delete restrict,
 check(ended_at>=started_at)
);
create table public.clm_session_slides(
 tenant_id uuid not null,session_id uuid not null,slide_id uuid not null,sequence_no integer not null,
 duration_ms integer not null check(duration_ms between 0 and 3600000),
 primary key(tenant_id,session_id,sequence_no),
 foreign key(tenant_id,session_id) references public.clm_detailing_sessions(tenant_id,id) on delete cascade,
 foreign key(tenant_id,slide_id) references public.clm_slides(tenant_id,id) on delete restrict
);

create or replace function public.admin_save_clm_detailing(
 p_tenant_id uuid,p_user_id uuid,p_operation_id uuid,p_visit_id uuid,p_asset_id uuid,
 p_started_at timestamptz,p_ended_at timestamptz,p_reaction text,p_slide_dwells jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_visit public.field_visits%rowtype;v_stop public.tour_plan_stops%rowtype;v_asset public.clm_assets%rowtype;v_row jsonb;v_seq int:=0;
begin
 select id into v_id from public.clm_detailing_sessions where tenant_id=p_tenant_id and operation_id=p_operation_id;
 if v_id is not null then return v_id;end if;
 if p_ended_at<p_started_at then raise exception 'invalid detailing duration';end if;
 if p_reaction not in('POSITIVE','NEUTRAL','NEGATIVE') then raise exception 'invalid doctor reaction';end if;
 select * into v_visit from public.field_visits where tenant_id=p_tenant_id and id=p_visit_id for update;
 if v_visit.id is null or v_visit.status<>'CHECKED_IN' then raise exception 'checked-in visit required';end if;
 select stop.* into v_stop from public.tour_plan_stops stop where stop.tenant_id=p_tenant_id and stop.id=v_visit.plan_stop_id;
 if v_stop.stop_type<>'doctor' then raise exception 'detailing requires doctor visit';end if;
 if not exists(select 1 from public.tour_executions e join public.employees emp on emp.tenant_id=e.tenant_id and emp.id=e.employee_id
   where e.tenant_id=p_tenant_id and e.id=v_visit.execution_id and e.status='ACTIVE' and emp.user_id=p_user_id) then raise exception 'visit ownership denied';end if;
 select * into v_asset from public.clm_assets where tenant_id=p_tenant_id and id=p_asset_id;
 if v_asset.id is null or v_asset.status<>'APPROVED' or v_asset.effective_from>current_date or (v_asset.expires_at is not null and v_asset.expires_at<current_date)
 then raise exception 'approved effective CLM asset required';end if;
 if not exists(select 1 from public.clm_asset_products ap where ap.tenant_id=p_tenant_id and ap.asset_id=p_asset_id)
 then raise exception 'CLM asset has no product mapping';end if;
 if jsonb_typeof(p_slide_dwells)<>'array' or jsonb_array_length(p_slide_dwells)<1 then raise exception 'slide evidence required';end if;
 insert into public.clm_detailing_sessions(tenant_id,visit_id,asset_id,operation_id,started_at,ended_at,reaction,created_by)
 values(p_tenant_id,p_visit_id,p_asset_id,p_operation_id,p_started_at,p_ended_at,p_reaction,p_user_id)returning id into v_id;
 for v_row in select * from jsonb_array_elements(p_slide_dwells) loop
   v_seq:=v_seq+1;
   if not exists(select 1 from public.clm_slides s where s.tenant_id=p_tenant_id and s.asset_id=p_asset_id and s.id=(v_row->>'slideId')::uuid)
   then raise exception 'slide is not part of selected asset';end if;
   insert into public.clm_session_slides(tenant_id,session_id,slide_id,sequence_no,duration_ms)
   values(p_tenant_id,v_id,(v_row->>'slideId')::uuid,v_seq,(v_row->>'durationMs')::integer);
 end loop;
 return v_id;
end;$$;

alter table public.clm_assets enable row level security;
alter table public.clm_asset_products enable row level security;
alter table public.clm_slides enable row level security;
alter table public.clm_detailing_sessions enable row level security;
alter table public.clm_session_slides enable row level security;

revoke all on public.clm_assets,public.clm_asset_products,public.clm_slides,public.clm_detailing_sessions,public.clm_session_slides from anon,authenticated;
grant select on public.clm_assets,public.clm_asset_products,public.clm_slides,public.clm_detailing_sessions,public.clm_session_slides to authenticated;

create policy clm_assets_scoped_read on public.clm_assets for select to authenticated
using(public.has_master_access(tenant_id,division_id));
create policy clm_asset_products_scoped_read on public.clm_asset_products for select to authenticated
using(exists(select 1 from public.clm_assets a where a.tenant_id=clm_asset_products.tenant_id and a.id=clm_asset_products.asset_id));
create policy clm_slides_scoped_read on public.clm_slides for select to authenticated
using(exists(select 1 from public.clm_assets a where a.tenant_id=clm_slides.tenant_id and a.id=clm_slides.asset_id));
create policy clm_sessions_scoped_read on public.clm_detailing_sessions for select to authenticated
using(exists(
 select 1 from public.field_visits v
 join public.tour_executions e on e.tenant_id=v.tenant_id and e.id=v.execution_id
 join public.employees emp on emp.tenant_id=e.tenant_id and emp.id=e.employee_id
 where v.tenant_id=clm_detailing_sessions.tenant_id and v.id=clm_detailing_sessions.visit_id
 and (emp.user_id=auth.uid() or public.has_permission(v.tenant_id,'TOUR_VIEW_TEAM',emp.org_unit_id))
));
create policy clm_session_slides_scoped_read on public.clm_session_slides for select to authenticated
using(exists(select 1 from public.clm_detailing_sessions s where s.tenant_id=clm_session_slides.tenant_id and s.id=clm_session_slides.session_id));

revoke all on function public.admin_save_clm_detailing(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_clm_detailing(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,jsonb) to service_role;

commit;