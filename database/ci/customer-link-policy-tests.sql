begin;
insert into auth.users(id) values('f5000000-0000-4000-8000-000000000002');
insert into public.tenants(id,name,slug)values('f5000000-0000-4000-8000-000000000001','Synthetic counterpart authorization','ci-counterpart-authorization');
insert into public.tenant_memberships(tenant_id,user_id)values('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000002');
insert into public.organization_units(id,tenant_id,type,code,name)values('f5000000-0000-4000-8000-000000000003','f5000000-0000-4000-8000-000000000001','company','C','Synthetic Company');
insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 ('f5000000-0000-4000-8000-000000000004','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000003','division','D','Synthetic Division'),
 ('f5000000-0000-4000-8000-000000000005','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000004','zone','Z','Synthetic Zone'),
 ('f5000000-0000-4000-8000-000000000006','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000005','region','R','Synthetic Region'),
 ('f5000000-0000-4000-8000-000000000007','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000006','area','A','Synthetic Area'),
 ('f5000000-0000-4000-8000-000000000008','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000007','territory','T1','Authorized Territory'),
 ('f5000000-0000-4000-8000-000000000009','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000007','territory','T2','Denied Territory');
insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id)values('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000002','MR','f5000000-0000-4000-8000-000000000008');
insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,status)values
 ('f5000000-0000-4000-8000-000000000011','f5000000-0000-4000-8000-000000000001','D1','Authorized Doctor','Test','f5000000-0000-4000-8000-000000000008','active'),
 ('f5000000-0000-4000-8000-000000000012','f5000000-0000-4000-8000-000000000001','D2','Denied Doctor','Test','f5000000-0000-4000-8000-000000000009','active');
insert into public.chemists(id,tenant_id,code,name,territory_id,status)values
 ('f5000000-0000-4000-8000-000000000013','f5000000-0000-4000-8000-000000000001','CH1','Authorized Chemist','f5000000-0000-4000-8000-000000000008','active'),
 ('f5000000-0000-4000-8000-000000000014','f5000000-0000-4000-8000-000000000001','CH2','Inactive Chemist','f5000000-0000-4000-8000-000000000008','inactive');
insert into public.business_customer_link_grants(tenant_id,user_id,territory_id)values('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000002','f5000000-0000-4000-8000-000000000008');
insert into public.business_customer_links(tenant_id,source_id,target_id,territory_id,relation,approval,evidence_id,verified_at)values
 ('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000011','f5000000-0000-4000-8000-000000000013','f5000000-0000-4000-8000-000000000008','Test','APPROVED','allowed',now()),
 ('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000011','f5000000-0000-4000-8000-000000000012','f5000000-0000-4000-8000-000000000008','Test','APPROVED','denied-target',now()),
 ('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000012','f5000000-0000-4000-8000-000000000013','f5000000-0000-4000-8000-000000000008','Test','APPROVED','denied-source',now()),
 ('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000011','f5000000-0000-4000-8000-000000000014','f5000000-0000-4000-8000-000000000008','Test','APPROVED','inactive-target',now()),
 ('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000011','f5000000-0000-4000-8000-000000000013','f5000000-0000-4000-8000-000000000008','Test','PENDING','pending',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','f5000000-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*) from public.business_customer_links)<>1
  or (select evidence_id from public.business_customer_links)<>'allowed' then
  raise exception 'Unauthorized source/counterpart or unapproved evidence exposed';
 end if;
end;$$;
select set_config('request.jwt.claim.sub','f5000000-0000-4000-8000-000000000099',true);
do $$begin if exists(select 1 from public.business_customer_links)then raise exception 'Foreign user relationship leak';end if;end;$$;
reset role;
insert into auth.users(id)values('f5000000-0000-4000-8000-000000000088');
insert into public.business_customer_link_grants(tenant_id,user_id,territory_id)values('f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000088','test-cleanup');
delete from auth.users where id='f5000000-0000-4000-8000-000000000088';
do $$begin if exists(select 1 from public.business_customer_link_grants where user_id='f5000000-0000-4000-8000-000000000088')then raise exception 'Deleted identity retained dependent grants';end if;end;$$;
rollback;
