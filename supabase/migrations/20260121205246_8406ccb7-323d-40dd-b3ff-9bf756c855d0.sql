-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_tags junction table
CREATE TABLE public.contact_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

-- Enable RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for tags
CREATE POLICY "Users can view tags in their organization"
ON public.tags FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create tags in their organization"
ON public.tags FOR INSERT
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update tags in their organization"
ON public.tags FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete tags in their organization"
ON public.tags FOR DELETE
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Enable RLS on contact_tags
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_tags (based on contact's organization)
CREATE POLICY "Users can view contact tags in their organization"
ON public.contact_tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contacts c
  WHERE c.id = contact_id AND user_belongs_to_org(auth.uid(), c.organization_id)
));

CREATE POLICY "Users can create contact tags in their organization"
ON public.contact_tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.contacts c
  WHERE c.id = contact_id AND user_belongs_to_org(auth.uid(), c.organization_id)
));

CREATE POLICY "Users can delete contact tags in their organization"
ON public.contact_tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.contacts c
  WHERE c.id = contact_id AND user_belongs_to_org(auth.uid(), c.organization_id)
));