begin;
do $$begin
 if current_database()<>'terrevo_ci' then raise exception 'Recovery cleanup requires terrevo_ci';end if;
end;$$;
delete from public.organization_units where id='f3000000-0000-4000-8000-000000000003'
 and tenant_id='f3000000-0000-4000-8000-000000000002';
delete from public.tenants where id='f3000000-0000-4000-8000-000000000002' and slug='ci-recovery-fixture';
delete from auth.users where id='f3000000-0000-4000-8000-000000000001' and email='ci-recovery@example.invalid';
commit;
