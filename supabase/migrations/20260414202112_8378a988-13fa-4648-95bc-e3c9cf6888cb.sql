
-- Table for custom field definitions (schema/type info)
CREATE TABLE public.custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'boolean', 'select')),
  options JSONB DEFAULT '[]'::jsonb, -- for select type: ["opt1","opt2"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view custom field definitions"
  ON public.custom_field_definitions FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can manage custom field definitions"
  ON public.custom_field_definitions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = custom_field_definitions.organization_id
      AND om.role = 'owner'::org_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = custom_field_definitions.organization_id
      AND om.role = 'owner'::org_role
  ));

-- Add updated_at trigger
CREATE TRIGGER update_custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Also add a field_definition_id column to contact_custom_fields for typed reference
ALTER TABLE public.contact_custom_fields
  ADD COLUMN field_definition_id UUID REFERENCES public.custom_field_definitions(id) ON DELETE SET NULL;
