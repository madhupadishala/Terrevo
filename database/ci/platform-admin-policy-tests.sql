BEGIN;
DO $$
DECLARE
  v_actor uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '22222222-2222-4222-8222-222222222222';
  v_created jsonb;
  v_updated jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.platform_admin_grants) THEN
    RAISE EXCEPTION 'Platform role must have no initial assignments';
  END IF;
  IF has_table_privilege('authenticated','public.platform_admin_grants','SELECT') THEN
    RAISE EXCEPTION 'Authenticated users must not read platform grants';
  END IF;
  IF has_table_privilege('authenticated','public.platform_admin_audit','SELECT') THEN
    RAISE EXCEPTION 'Authenticated users must not read platform audit';
  END IF;
  IF has_function_privilege('authenticated','public.platform_create_tenant(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users must not invoke create RPC';
  END IF;
  IF has_function_privilege('authenticated','public.platform_set_tenant_status(uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users must not invoke status RPC';
  END IF;
  BEGIN
    PERFORM public.platform_create_tenant(v_other, 'Unauthorized Tenant', 'unauthorized-platform-tenant');
    RAISE EXCEPTION 'Unassigned identity bypassed platform permission';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  INSERT INTO auth.users(id,email) VALUES (v_actor,'ci-platform@example.invalid');
  INSERT INTO public.platform_admin_grants(user_id,active,grant_note)
  VALUES (v_actor,true,'CI only');
  SELECT public.platform_create_tenant(v_actor,'CI Test Tenant','ci-platform-tenant') INTO v_created;
  IF v_created->>'slug' <> 'ci-platform-tenant' THEN
    RAISE EXCEPTION 'Platform tenant create returned unexpected result';
  END IF;
  SELECT public.platform_set_tenant_status(v_actor,(v_created->>'id')::uuid,'inactive') INTO v_updated;
  IF v_updated->>'status' <> 'inactive' THEN
    RAISE EXCEPTION 'Tenant status did not update';
  END IF;
  IF (SELECT COUNT(*) FROM public.platform_admin_audit
      WHERE actor_user_id=v_actor AND tenant_id=(v_created->>'id')::uuid) <> 2 THEN
    RAISE EXCEPTION 'Platform mutations must leave two audit events';
  END IF;
  UPDATE public.platform_admin_grants SET active=false WHERE user_id=v_actor;
  BEGIN
    PERFORM public.platform_set_tenant_status(v_actor,(v_created->>'id')::uuid,'active');
    RAISE EXCEPTION 'Revoked platform administrator bypassed grant';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;
ROLLBACK;
