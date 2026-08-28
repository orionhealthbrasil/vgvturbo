-- 1) pipeline_saved_views: per-user filter presets for the Pipeline page
CREATE TABLE IF NOT EXISTS public.pipeline_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_saved_views_user_org
  ON public.pipeline_saved_views (user_id, organization_id);

ALTER TABLE public.pipeline_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pipeline views"
ON public.pipeline_saved_views FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pipeline views"
ON public.pipeline_saved_views FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update their own pipeline views"
ON public.pipeline_saved_views FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pipeline views"
ON public.pipeline_saved_views FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_pipeline_saved_views_updated
BEFORE UPDATE ON public.pipeline_saved_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default per (user_id, organization_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_saved_views_one_default
  ON public.pipeline_saved_views (user_id, organization_id)
  WHERE is_default = true;

-- 2) role_permissions: add organization_id for per-org overrides
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL;

-- Drop old unique constraint on (role, permission) if it exists, recreate considering organization
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_role_permission_key'
  ) THEN
    ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_role_permission_key;
  END IF;
END $$;

-- Unique per (role, permission, organization_id) — null org = global default
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique_global
  ON public.role_permissions (role, permission)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique_org
  ON public.role_permissions (role, permission, organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_permissions_org
  ON public.role_permissions (organization_id);

-- RLS: anyone in the org may read; only owner of that org may write
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Anyone can view role permissions') THEN
    DROP POLICY "Anyone can view role permissions" ON public.role_permissions;
  END IF;
END $$;

CREATE POLICY "Members can view role permissions"
ON public.role_permissions FOR SELECT
USING (
  organization_id IS NULL
  OR user_belongs_to_org(auth.uid(), organization_id)
);

CREATE POLICY "Owners can insert role permissions for their org"
ON public.role_permissions FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = role_permissions.organization_id
      AND om.role = 'owner'::org_role
  )
);

CREATE POLICY "Owners can update role permissions for their org"
ON public.role_permissions FOR UPDATE
USING (
  organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = role_permissions.organization_id
      AND om.role = 'owner'::org_role
  )
);

CREATE POLICY "Owners can delete role permissions for their org"
ON public.role_permissions FOR DELETE
USING (
  organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = role_permissions.organization_id
      AND om.role = 'owner'::org_role
  )
);

-- 3) Seed defaults for the new permissions (only when the (role, permission, NULL) row is missing)
INSERT INTO public.role_permissions (role, permission, can_view, can_edit, organization_id)
SELECT v.role::member_role, v.permission, v.can_view, v.can_edit, NULL
FROM (VALUES
  -- contacts
  ('admin','contacts',true,true),
  ('analyst','contacts',true,true),
  ('viewer','contacts',true,false),
  -- pipeline (view + edit)
  ('admin','pipeline',true,true),
  ('analyst','pipeline',true,false),
  ('viewer','pipeline',false,false),
  ('admin','pipeline_edit',true,true),
  ('analyst','pipeline_edit',false,false),
  ('viewer','pipeline_edit',false,false),
  -- broadcast
  ('admin','broadcast',true,true),
  ('analyst','broadcast',false,false),
  ('viewer','broadcast',false,false),
  -- support
  ('admin','support',true,true),
  ('analyst','support',true,false),
  ('viewer','support',false,false),
  -- internal_chat
  ('admin','internal_chat',true,true),
  ('analyst','internal_chat',true,true),
  ('viewer','internal_chat',true,true),
  -- squad_ai
  ('admin','squad_ai',true,true),
  ('analyst','squad_ai',false,false),
  ('viewer','squad_ai',false,false),
  -- connection
  ('admin','connection',true,true),
  ('analyst','connection',true,false),
  ('viewer','connection',false,false)
) AS v(role, permission, can_view, can_edit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = v.role::member_role
    AND rp.permission = v.permission
    AND rp.organization_id IS NULL
);