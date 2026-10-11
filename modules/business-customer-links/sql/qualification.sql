-- Run after forward migration in disposable PostgreSQL test database.
begin;
do $verify$
begin
 if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='business_customer_links' and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'Customer relationship RLS missing';end if;
 if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='business_customer_link_grants' and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'Territory grant RLS missing';end if;
 if has_table_privilege('anon','public.business_customer_links','SELECT')
 or has_table_privilege('authenticated','public.business_customer_links','INSERT')
 or has_table_privilege('authenticated','public.business_customer_links','UPDATE')
 or has_table_privilege('authenticated','public.business_customer_links','DELETE')
 or has_table_privilege('authenticated','public.business_customer_link_grants','INSERT')
 or has_table_privilege('authenticated','public.business_customer_link_grants','UPDATE')
 or has_table_privilege('authenticated','public.business_customer_link_grants','DELETE')
 then raise exception 'Business relationship access too permissive';end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_customer_links' and policyname='business_customer_links_read')
 or not exists(select 1 from pg_policies where schemaname='public' and tablename='business_customer_link_grants' and policyname='business_customer_grants_read')
 then raise exception 'Missing read policies';end if;
end;
$verify$;
-- An unauthenticated database role cannot select.
set local role anon;
do $verify$
begin
 begin
  perform count(*) from public.business_customer_links;
  raise exception 'Anonymous relationship SELECT unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end;
$verify$;
rollback;
