ALTER TABLE public.organizations ADD COLUMN sla_excluded_tag_ids UUID[] DEFAULT '{}';
COMMENT ON COLUMN public.organizations.sla_excluded_tag_ids IS 'Tag IDs to exclude from SLA monitoring';