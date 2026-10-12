do $$begin
 if current_database()<>'terrevo_restore_ci' then raise exception 'Recovery assertions require terrevo_restore_ci';end if;
 if not exists(select 1 from auth.users where id='f3000000-0000-4000-8000-000000000001'
   and email='ci-recovery@example.invalid') then raise exception 'Auth fixture was not restored';end if;
 if not exists(select 1 from public.tenants where id='f3000000-0000-4000-8000-000000000002'
   and slug='ci-recovery-fixture') then raise exception 'Tenant fixture was not restored';end if;
 if not exists(select 1 from public.tenant_memberships where tenant_id='f3000000-0000-4000-8000-000000000002'
   and user_id='f3000000-0000-4000-8000-000000000001') then raise exception 'Membership fixture was not restored';end if;
 if not exists(select 1 from public.organization_units where id='f3000000-0000-4000-8000-000000000003'
   and tenant_id='f3000000-0000-4000-8000-000000000002' and code='CIRECOVERY') then
  raise exception 'Organization fixture was not restored';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then
  raise exception 'Restored public table lost RLS';end if;
end;$$;
