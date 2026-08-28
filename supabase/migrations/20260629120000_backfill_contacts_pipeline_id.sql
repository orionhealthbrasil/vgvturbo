-- Backfill contacts.pipeline_id for rows left null by the "avançar etapa" button,
-- which historically updated funnel_stage without ever setting pipeline_id.
-- Contacts with pipeline_id IS NULL are invisible in every Kanban view, since
-- usePipelineContacts filters with `.eq('pipeline_id', pipelineId)`.

-- Step 1: match by funnel_stage slug -> funnel_stages.pipeline_id (same org)
UPDATE contacts c
SET pipeline_id = fs.pipeline_id
FROM funnel_stages fs
WHERE c.pipeline_id IS NULL
  AND fs.organization_id = c.organization_id
  AND fs.slug = c.funnel_stage;

-- Step 2: anything still null (funnel_stage slug didn't match any stage)
-- falls back to the organization's default pipeline.
UPDATE contacts c
SET pipeline_id = kp.id
FROM kanban_pipelines kp
WHERE c.pipeline_id IS NULL
  AND kp.organization_id = c.organization_id
  AND kp.is_default = true;
