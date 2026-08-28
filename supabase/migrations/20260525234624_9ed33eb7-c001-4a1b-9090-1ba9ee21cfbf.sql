CREATE INDEX IF NOT EXISTS contacts_org_pipeline_updated_idx
  ON public.contacts (organization_id, pipeline_id, is_archived, updated_at DESC);