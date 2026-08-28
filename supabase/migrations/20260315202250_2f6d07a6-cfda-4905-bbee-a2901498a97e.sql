
-- Make the update policy more restrictive: only allow updating unsubmitted responses
DROP POLICY "Anyone can update responses via token" ON public.satisfaction_responses;
CREATE POLICY "Anyone can update unsubmitted responses"
  ON public.satisfaction_responses FOR UPDATE
  TO anon, authenticated
  USING (submitted_at IS NULL);

-- Make the insert policy more restrictive: only insert if token exists
DROP POLICY "Anyone can insert responses via token" ON public.satisfaction_responses;
CREATE POLICY "Anyone can submit responses"
  ON public.satisfaction_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (token IS NOT NULL AND rating IS NOT NULL);
