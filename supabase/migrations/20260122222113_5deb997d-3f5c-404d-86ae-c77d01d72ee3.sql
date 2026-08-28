-- Create organization_holidays table for storing holidays
CREATE TABLE public.organization_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT true,
  custom_hours_start TIME,
  custom_hours_end TIME,
  return_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_holidays ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view holidays in their organization" 
ON public.organization_holidays 
FOR SELECT 
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can create holidays" 
ON public.organization_holidays 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_holidays.organization_id 
    AND om.role = 'owner'
  )
);

CREATE POLICY "Owners can update holidays" 
ON public.organization_holidays 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_holidays.organization_id 
    AND om.role = 'owner'
  )
);

CREATE POLICY "Owners can delete holidays" 
ON public.organization_holidays 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_holidays.organization_id 
    AND om.role = 'owner'
  )
);

-- Add lunch_break_days column to organizations
ALTER TABLE public.organizations
ADD COLUMN lunch_break_days INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5];