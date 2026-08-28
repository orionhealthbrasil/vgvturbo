-- Create table to store WhatsApp instance settings per organization
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Only owners and admins can view instance settings
CREATE POLICY "Owners and admins can view WhatsApp settings"
ON public.whatsapp_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = whatsapp_instances.organization_id
    AND om.role IN ('owner', 'admin')
  )
);

-- Only owners and admins can insert instance settings
CREATE POLICY "Owners and admins can create WhatsApp settings"
ON public.whatsapp_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = whatsapp_instances.organization_id
    AND om.role IN ('owner', 'admin')
  )
);

-- Only owners and admins can update instance settings
CREATE POLICY "Owners and admins can update WhatsApp settings"
ON public.whatsapp_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = whatsapp_instances.organization_id
    AND om.role IN ('owner', 'admin')
  )
);

-- Only owners can delete instance settings
CREATE POLICY "Owners can delete WhatsApp settings"
ON public.whatsapp_instances
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = whatsapp_instances.organization_id
    AND om.role = 'owner'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();