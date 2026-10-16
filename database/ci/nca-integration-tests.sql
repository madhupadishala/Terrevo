begin;
-- Isolated test tenant, staff, controlled taxonomy and NCA transactions.
-- Everything is rolled back; no real business data is seeded or changed.
do $nca$
declare
 t uuid:='e1000000-0000-4000-8000-000000000001';
 mr uuid:='e1000000-0000-4000-8000-000000000002';
 admin_id uuid:='e1000000-0000-4000-8000-000000000003';
 outsider uuid:='e1000000-0000-4000-8000-000000000004';
 company uuid:='e1000000-0000-4000-8000-000000000005';
 division uuid:='e1000000-0000-4000-8000-000000000006';
 zone uuid:='e1000000-0000-4000-8000-000000000007';
 region uuid:='e1000000-0000-4000-8000-000000000008';
 area uuid:='e1000000-0000-4000-8000-000000000009';
 territory uuid:='e1000000-0000-4000-8000-000000000010';
 operation uuid:='e1000000-0000-4000-8000-000000000011';
 town uuid;
 record_id uuid;
 repeated_id uuid;
begin
 insert into auth.users(id,email)values
 (mr,'ci-nca-mr@example.invalid'),(admin_id,'ci-nca-admin@example.invalid'),
 (outsider,'ci-nca-outsider@example.invalid');
 insert into public.tenants(id,name,slug)values(t,'CI NCA Integration','ci-nca-integration');
 insert into public.tenant_memberships(tenant_id,user_id) values(t,mr),(t,admin_id);
 insert into public.organization_units(id,tenant_id,type,code,name)
 values(company,t,'company','NCA_COMPANY','NCA Company');
 insert into public.organization_units(id,tenant_id,parent_id,type,code,name)values
 (division,t,company,'division','NCA_DIVISION','NCA Division'),
 (zone,t,division,'zone','NCA_ZONE','NCA Zone'),
 (region,t,zone,'region','NCA_REGION','NCA Region'),
 (area,t,region,'area','NCA_AREA','NCA Area'),
 (territory,t,area,'territory','NCA_TERRITORY','NCA Territory');
 insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id)
 values(t,mr,'MR',territory),(t,admin_id,'TENANT_ADMIN',null);
 insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id)
 values('e1000000-0000-4000-8000-000000000012',t,mr,'NCA_MR','CI Representative','MR',territory),
       ('e1000000-0000-4000-8000-000000000013',t,admin_id,'NCA_ADMIN','CI Administrator','Tenant Admin',company);

 begin
  perform public.admin_configure_nca_category(t,mr,'NCA_QA','Unauthorised creation');
  raise exception 'MR configured category without master permission';
 exception when insufficient_privilege then null;
 end;
 perform public.admin_configure_nca_category(t,admin_id,'NCA_QA','Controlled CI category');
 perform public.admin_configure_nca_town(t,admin_id,territory,'Controlled CI town');
 select id into town from public.nca_towns where tenant_id=t and territory_id=territory and name='Controlled CI town';
 if town is null then raise exception 'Admin-controlled town was not persisted'; end if;

 begin
  perform public.admin_create_nca(t,mr,operation,current_date,territory,'PLAN','NCA_UNKNOWN',town,
    'Qualified plan','',30);
  raise exception 'Unapproved category was accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.admin_create_nca(t,mr,operation,current_date,territory,'REPORT','NCA_QA',null,
    'Report needs remarks','',30);
  raise exception 'NCA REPORT without remarks was accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.admin_create_nca(t,outsider,operation,current_date,territory,'PLAN','NCA_QA',town,
    'Cross-tenant visitor','',30);
  raise exception 'Cross-tenant NCA create was accepted';
 exception when insufficient_privilege then null;
 end;
 record_id:=public.admin_create_nca(t,mr,operation,current_date,territory,'PLAN','NCA_QA',town,
   'Qualified plan','Verified controlled test',30);
 repeated_id:=public.admin_create_nca(t,mr,operation,current_date,territory,'PLAN','NCA_QA',town,
   'Qualified plan','Verified controlled test',30);
 if record_id<>repeated_id
    or (select count(*) from public.nca_records where tenant_id=t and created_by=mr and operation_id=operation)<>1
 then raise exception 'NCA idempotent persistence failed';end if;
 if not exists(select 1 from public.nca_records where tenant_id=t and id=record_id and status='DRAFT' and town_id=town)
 then raise exception 'NCA draft not saved with controlled town';end if;
 perform public.admin_submit_nca(t,mr,record_id);
 if not exists(select 1 from public.nca_records where tenant_id=t and id=record_id
     and status='SUBMITTED' and submitted_at is not null)
 then raise exception 'NCA submission and audit timestamp absent'; end if;
 begin
  perform public.admin_submit_nca(t,mr,record_id);
  raise exception 'Second NCA submission accepted';
 exception when unique_violation then null;
 end;
end;$nca$;

-- Simulated Supabase JWT with the actual authenticated PostgreSQL role.
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $nca$
begin
 if (select count(*) from public.nca_records where tenant_id='e1000000-0000-4000-8000-000000000001')<>1
 then raise exception 'Owner cannot read own NCA record';end if;
end;$nca$;
reset role;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $nca$
begin
 if exists(select 1 from public.nca_records where tenant_id='e1000000-0000-4000-8000-000000000001')
 then raise exception 'Outsider can see another tenant NCA';end if;
end;$nca$;
reset role;
rollback;
