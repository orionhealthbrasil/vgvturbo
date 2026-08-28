-- Add weekend-specific business hours columns
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS weekend_hours_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS weekend_hours_start time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS weekend_hours_end time DEFAULT '13:00:00';