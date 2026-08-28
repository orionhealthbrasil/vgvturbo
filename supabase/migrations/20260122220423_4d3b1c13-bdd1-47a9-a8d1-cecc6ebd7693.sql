-- Add business hours fields to organizations table
ALTER TABLE public.organizations
ADD COLUMN business_hours_start TIME DEFAULT '08:00:00',
ADD COLUMN business_hours_end TIME DEFAULT '18:00:00',
ADD COLUMN lunch_break_start TIME DEFAULT '12:00:00',
ADD COLUMN lunch_break_end TIME DEFAULT '13:00:00',
ADD COLUMN lunch_break_enabled BOOLEAN DEFAULT false,
ADD COLUMN working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5];

-- working_days: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
COMMENT ON COLUMN public.organizations.working_days IS 'Array of weekday numbers (0=Sunday to 6=Saturday) when the business is open';