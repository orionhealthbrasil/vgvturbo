-- Create kanban_pipelines table for multiple funnels
CREATE TABLE public.kanban_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kanban_pipelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kanban_pipelines
CREATE POLICY "Users can view pipelines in their organization"
ON public.kanban_pipelines FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create pipelines in their organization"
ON public.kanban_pipelines FOR INSERT
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update pipelines in their organization"
ON public.kanban_pipelines FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete pipelines"
ON public.kanban_pipelines FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
  AND om.organization_id = kanban_pipelines.organization_id
  AND om.role IN ('owner', 'admin')
));

-- Add pipeline_id to kanban_columns
ALTER TABLE public.kanban_columns
ADD COLUMN pipeline_id UUID REFERENCES public.kanban_pipelines(id) ON DELETE CASCADE;

-- Add pipeline_id to contacts
ALTER TABLE public.contacts
ADD COLUMN pipeline_id UUID REFERENCES public.kanban_pipelines(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_kanban_columns_pipeline_id ON public.kanban_columns(pipeline_id);
CREATE INDEX idx_contacts_pipeline_id ON public.contacts(pipeline_id);
CREATE INDEX idx_kanban_pipelines_organization_id ON public.kanban_pipelines(organization_id);