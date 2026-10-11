begin;
-- Safe CI data only. Never run this setup against a hosted/project database.
do $$begin
 if current_database()<>'terrevo_ci' then raise exception 'Recovery fixture requires terrevo_ci';end if;
end;$$;
insert into auth.users(id,email) values
 ('f3000000-0000-4000-8000-000000000001','ci-recovery@example.invalid');
insert into public.tenants(id,name,slug) values
 ('f3000000-0000-4000-8000-000000000002','Synthetic CI Recovery Fixture','ci-recovery-fixture');
insert into public.tenant_memberships(tenant_id,user_id) values
 ('f3000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000001');
insert into public.organization_units(id,tenant_id,type,code,name) values
 ('f3000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000002',
  'company','CIRECOVERY','Synthetic Recovery Company');
commit;
