DROP FUNCTION IF EXISTS public.platform_set_tenant_status(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.platform_create_tenant(uuid,text,text);
DROP TABLE IF EXISTS public.platform_admin_audit;
DROP TABLE IF EXISTS public.platform_admin_grants;
