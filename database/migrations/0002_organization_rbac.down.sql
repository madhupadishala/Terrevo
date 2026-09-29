begin;

drop policy if exists user_role_assignments_read on public.user_role_assignments;
drop policy if exists user_org_assignments_read on public.user_org_assignments;
drop policy if exists organization_units_scoped_read on public.organization_units;

drop function if exists public.admin_assign_user_org(uuid, uuid, uuid, boolean);
drop function if exists public.has_permission(uuid, text, uuid);
drop function if exists public.org_unit_in_scope(uuid, uuid, uuid);
drop trigger if exists organization_units_parent_guard on public.organization_units;
drop function if exists public.validate_org_unit_parent();
drop table if exists public.user_role_assignments;
drop table if exists public.user_org_assignments;
drop table if exists public.organization_units;
drop table if exists public.role_permissions;
drop table if exists public.role_definitions;

commit;
