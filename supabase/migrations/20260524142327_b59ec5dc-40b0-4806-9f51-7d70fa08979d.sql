
-- Re-grant SELECT on whatsapp_meta_instances.access_token to authenticated.
-- Row-level SELECT is already restricted to is_org_admin_or_owner(), which is
-- the correct authorization layer for this column. The column-level REVOKE we
-- added previously additionally blocked admins themselves.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='whatsapp_meta_instances' AND column_name='access_token'
  ) THEN
    EXECUTE 'GRANT SELECT (access_token) ON public.whatsapp_meta_instances TO authenticated';
  END IF;
END$$;
