-- Disposable/staging qualification: transactionally create fixtures, validate RLS and roll back all changes.
-- Requires migrated Terrevo schema and privileged test runner; never run against production.
begin;
insert into public.tenants(id,name,slug) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','R04B Transaction Test','r04b-rollback-only');
insert into auth.users(id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.tenant_memberships(tenant_id,user_id,status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active');
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
