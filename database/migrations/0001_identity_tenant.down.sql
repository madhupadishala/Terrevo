begin;

drop policy if exists tenant_read_for_active_member on public.tenants;
drop policy if exists tenant_membership_read_own on public.tenant_memberships;

drop table if exists public.tenant_memberships;
drop table if exists public.tenants;

commit;
