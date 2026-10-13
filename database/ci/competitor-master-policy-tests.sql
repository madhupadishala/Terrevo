begin;
insert into auth.users(id) values
 ('c1000000-0000-4000-8000-000000000001'),
 ('c1000000-0000-4000-8000-000000000002');
insert into public.tenants(id,name,slug) values
 ('c1000000-0000-4000-8000-000000000010','Competitor Tenant A','competitor-a'),
 ('c1000000-0000-4000-8000-000000000020','Competitor Tenant B','competitor-b');
insert into public.tenant_memberships(tenant_id,user_id) values
 ('c1000000-0000-4000-8000-000000000010','c1000000-0000-4000-8000-000000000001'),
 ('c1000000-0000-4000-8000-000000000020','c1000000-0000-4000-8000-000000000002');
insert into public.organization_units(id,tenant_id,type,code,name) values
 ('c1000000-0000-4000-8000-000000000011','c1000000-0000-4000-8000-000000000010','company','CA','Company A'),
 ('c1000000-0000-4000-8000-000000000021','c1000000-0000-4000-8000-000000000020','company','CB','Company B');
insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 ('c1000000-0000-4000-8000-000000000012','c1000000-0000-4000-8000-000000000010','c1000000-0000-4000-8000-000000000011','division','DA','Division A'),
 ('c1000000-0000-4000-8000-000000000022','c1000000-0000-4000-8000-000000000020','c1000000-0000-4000-8000-000000000021','division','DB','Division B');
insert into public.competitors(id,tenant_id,division_id,code,name,manufacturer) values
 ('c1000000-0000-4000-8000-000000000013','c1000000-0000-4000-8000-000000000010','c1000000-0000-4000-8000-000000000012','COMP-A','Competitor A','Maker A'),
 ('c1000000-0000-4000-8000-000000000023','c1000000-0000-4000-8000-000000000020','c1000000-0000-4000-8000-000000000022','COMP-B','Competitor B','Maker B');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
do $$begin
 if (select count(*) from public.competitors)<>1 then raise exception 'Competitor tenant isolation failed'; end if;
 if (select code from public.competitors limit 1)<>'COMP-A' then raise exception 'Foreign competitor exposed'; end if;
 begin
   insert into public.competitors(tenant_id,division_id,code,name)
   values('c1000000-0000-4000-8000-000000000010','c1000000-0000-4000-8000-000000000012','ILLEGAL','Denied write');
   raise exception 'Authenticated competitor insert unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end;$$;
reset role;
rollback;
