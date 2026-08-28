-- Add composite index for pipeline board queries
-- Without this, loading a pipeline with many contacts does a full org partition scan
-- Query pattern: WHERE pipeline_id = X AND funnel_stage = Y (pipeline kanban board grouping)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_pipeline_stage
  ON public.contacts (pipeline_id, funnel_stage)
  WHERE is_archived = false;
