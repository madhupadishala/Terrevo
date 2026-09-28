begin;

delete from public.role_permissions
where role_key = 'MANAGER' and permission_key = 'MASTER_MANAGE';

drop trigger if exists employees_manager_guard on public.employees;
drop function if exists public.validate_employee_manager();
drop table if exists public.gifts;
drop table if exists public.samples;
drop table if exists public.stockists;
drop table if exists public.chemists;
drop table if exists public.products;
drop table if exists public.doctors;
drop table if exists public.employees;
drop function if exists public.has_master_access(uuid, uuid);

commit;
