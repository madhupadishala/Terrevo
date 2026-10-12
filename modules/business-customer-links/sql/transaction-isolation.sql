-- Disposable/staging qualification: transactionally create fixtures, validate RLS and roll back all changes.
-- Requires migrated Terrevo schema and privileged test runner; never run against production.
begin;
insert into public.tenants(id,name,slug) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','R04B Transaction Test','r04b-rollback-only');
insert into auth.users(id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.tenant_memberships(tenant_id,user_id,status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active');
-- The caller must see active master records at both ends of every link before
-- the independent approval and legacy north/south grant predicates are tested.
insert into public.organization_units(id,tenant_id,type,code,name) values
('a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','company','C','Synthetic Company');
insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
('a1000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','division','D','Synthetic Division'),
('a1000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000002','zone','Z','Synthetic Zone'),
('a1000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000003','region','R','Synthetic Region'),
('a1000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000004','area','A','Synthetic Area'),
('a1000000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000005','territory','T','Synthetic Territory');
insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MR','a1000000-0000-4000-8000-000000000006');
insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,status) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','D1','Synthetic Doctor','Test','a1000000-0000-4000-8000-000000000006','active');
insert into public.chemists(id,tenant_id,code,name,territory_id,status) values
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CH1','Synthetic North','a1000000-0000-4000-8000-000000000006','active'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CH2','Synthetic South','a1000000-0000-4000-8000-000000000006','active'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CH3','Synthetic Pending','a1000000-0000-4000-8000-000000000006','active');
insert into public.business_customer_link_grants(tenant_id,user_id,territory_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','north');
insert into public.business_customer_links(tenant_id,source_id,target_id,territory_id,relation,approval,evidence_id,verified_at) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','north','linked','APPROVED','proof-north',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','south','linked','APPROVED','proof-south',now()),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','ffffffff-ffff-4fff-8fff-ffffffffffff','north','linked','PENDING','proof-pending',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $test$
declare n integer;
begin
 select count(*) into n from public.business_customer_links;
 if n<>1 then raise exception 'Expected exactly 1 approved north row, got %',n;end if;
 select count(*) into n from public.business_customer_link_grants;
 if n<>1 then raise exception 'Expected exactly 1 own grant, got %',n;end if;
end $test$;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
do $test$
declare n integer;
begin
 select count(*) into n from public.business_customer_links;
 if n<>0 then raise exception 'Cross-user row leak: %',n;end if;
end $test$;
rollback;
