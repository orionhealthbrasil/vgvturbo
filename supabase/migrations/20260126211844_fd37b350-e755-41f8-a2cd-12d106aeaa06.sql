-- Remove the old funnel_stage constraint that only allows fixed values
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_funnel_stage_check;

-- The funnel_stage column will now accept any text value, 
-- allowing dynamic stages defined in the funnel_stages table