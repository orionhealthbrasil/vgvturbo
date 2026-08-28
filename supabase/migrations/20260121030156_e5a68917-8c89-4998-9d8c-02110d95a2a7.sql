-- Drop the existing check constraint and recreate with 'Good Service' included
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_defect_type_check;

ALTER TABLE public.reviews ADD CONSTRAINT reviews_defect_type_check 
  CHECK (defect_type IN ('Good Service', 'Long Delay', 'No Response', 'Rude/Tone', 'Incorrect Info', 'Other'));