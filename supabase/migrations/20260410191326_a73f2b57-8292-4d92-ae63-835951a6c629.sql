
-- Create instagram_instances table
CREATE TABLE public.instagram_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  account_name TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.instagram_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view instagram instances"
ON public.instagram_instances
FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can create instagram instances"
ON public.instagram_instances
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = instagram_instances.organization_id
    AND om.role = 'owner'::org_role
));

CREATE POLICY "Owners can update instagram instances"
ON public.instagram_instances
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = instagram_instances.organization_id
    AND om.role = 'owner'::org_role
));

CREATE POLICY "Owners can delete instagram instances"
ON public.instagram_instances
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = instagram_instances.organization_id
    AND om.role = 'owner'::org_role
));

-- Add channel column to contacts
ALTER TABLE public.contacts
ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp';

-- Add channel column to messages  
ALTER TABLE public.messages
ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp';

-- Index for fast lookups by channel
CREATE INDEX idx_contacts_channel ON public.contacts(channel);
CREATE INDEX idx_messages_channel ON public.messages(channel);

-- Index for instagram webhook routing (find org by page_id)
CREATE INDEX idx_instagram_instances_page_id ON public.instagram_instances(page_id);

-- Update trigger for instagram_instances
CREATE TRIGGER update_instagram_instances_updated_at
BEFORE UPDATE ON public.instagram_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
