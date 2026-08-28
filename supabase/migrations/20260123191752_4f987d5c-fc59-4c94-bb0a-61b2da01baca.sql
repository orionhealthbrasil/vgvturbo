-- Create a table to store custom fields for contacts
CREATE TABLE public.contact_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure unique field names per contact
  UNIQUE(contact_id, field_name)
);

-- Enable RLS
ALTER TABLE public.contact_custom_fields ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view custom fields in their organization" 
ON public.contact_custom_fields 
FOR SELECT 
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create custom fields in their organization" 
ON public.contact_custom_fields 
FOR INSERT 
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update custom fields in their organization" 
ON public.contact_custom_fields 
FOR UPDATE 
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete custom fields in their organization" 
ON public.contact_custom_fields 
FOR DELETE 
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Create index for faster lookups
CREATE INDEX idx_contact_custom_fields_contact_id ON public.contact_custom_fields(contact_id);
CREATE INDEX idx_contact_custom_fields_field_name ON public.contact_custom_fields(field_name);
CREATE INDEX idx_contact_custom_fields_org_id ON public.contact_custom_fields(organization_id);

-- Create trigger for updated_at
CREATE TRIGGER update_contact_custom_fields_updated_at
BEFORE UPDATE ON public.contact_custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();