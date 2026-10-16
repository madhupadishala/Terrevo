-- Platform control plane: deny-by-default grants and transactional audit.
-- No platform administrator is provisioned by this migration.
CREATE TABLE public.platform_admin_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  grant_note text NOT NULL DEFAULT ''
);

CREATE TABLE public.platform_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('TENANT_CREATED','TENANT_STATUS_CHANGED')),
  tenant_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_admin_audit_recent_idx ON public.platform_admin_audit(occurred_at DESC, id DESC);

ALTER TABLE public.platform_admin_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_admin_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_admin_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_admin_grants TO service_role;
GRANT SELECT ON public.platform_admin_audit TO service_role;

-- Only the backend service role may invoke privileged mutations.
CREATE FUNCTION public.platform_create_tenant(p_actor_user_id uuid, p_name text, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admin_grants
                 WHERE user_id = p_actor_user_id AND active = true) THEN
    RAISE EXCEPTION 'Platform permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 160
     OR p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{2,49}$' THEN
    RAISE EXCEPTION 'Invalid tenant input' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.tenants(id,name,slug,status)
  VALUES (v_tenant_id,trim(p_name),p_slug,'active');
  INSERT INTO public.platform_admin_audit(actor_user_id,action,tenant_id,details)
  VALUES (p_actor_user_id,'TENANT_CREATED',v_tenant_id,jsonb_build_object('slug',p_slug));
  RETURN jsonb_build_object('id',v_tenant_id,'name',trim(p_name),'slug',p_slug,'status','active');
END;
$$;

CREATE FUNCTION public.platform_set_tenant_status(
  p_actor_user_id uuid, p_tenant_id uuid, p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status text;
  v_tenant public.tenants%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admin_grants
                 WHERE user_id = p_actor_user_id AND active = true) THEN
    RAISE EXCEPTION 'Platform permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active','inactive') THEN
    RAISE EXCEPTION 'Invalid tenant status' USING ERRCODE = '22023';
  END IF;
  SELECT status::text INTO v_old_status FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.tenants SET status = p_status WHERE id = p_tenant_id RETURNING * INTO v_tenant;
  INSERT INTO public.platform_admin_audit(actor_user_id,action,tenant_id,details)
  VALUES (p_actor_user_id,'TENANT_STATUS_CHANGED',p_tenant_id,
          jsonb_build_object('previous_status',v_old_status,'new_status',p_status));
  RETURN jsonb_build_object('id',v_tenant.id,'name',v_tenant.name,
                            'slug',v_tenant.slug,'status',v_tenant.status);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_create_tenant(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_set_tenant_status(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_tenant(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_status(uuid,uuid,text) TO service_role;
