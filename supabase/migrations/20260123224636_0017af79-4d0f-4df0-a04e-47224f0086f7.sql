-- Create import_history table
CREATE TABLE public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  imported_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  total_contacts INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicates_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  tags_applied INTEGER NOT NULL DEFAULT 0,
  file_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view import history in their organization"
  ON public.import_history
  FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create import history in their organization"
  ON public.import_history
  FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update import history in their organization"
  ON public.import_history
  FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can delete import history"
  ON public.import_history
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = import_history.organization_id 
    AND om.role = 'owner'
  ));