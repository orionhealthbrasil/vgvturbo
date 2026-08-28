-- Remove redundant direct INSERT policy on satisfaction_responses.
-- Public survey submissions go through the submit_public_satisfaction_survey()
-- SECURITY DEFINER RPC (validates token against existing records).
-- Direct INSERT allows fake responses to be crafted with any token string.
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.satisfaction_responses;
