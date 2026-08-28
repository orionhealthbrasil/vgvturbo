-- Public survey RPC: securely fetch survey data by response token
CREATE OR REPLACE FUNCTION public.get_public_satisfaction_survey(p_token text)
RETURNS TABLE (
  response_id uuid,
  response_submitted_at timestamp with time zone,
  survey_id uuid,
  survey_title text,
  survey_description text,
  survey_logo_url text,
  survey_primary_color text,
  survey_thank_you_message text,
  survey_questions jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.submitted_at,
    ss.id,
    ss.title,
    ss.description,
    ss.logo_url,
    ss.primary_color,
    ss.thank_you_message,
    COALESCE(ss.questions::jsonb, '[]'::jsonb)
  FROM public.satisfaction_responses sr
  JOIN public.satisfaction_surveys ss ON ss.id = sr.survey_id
  WHERE sr.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_satisfaction_survey(text) TO anon, authenticated;

-- Public survey RPC: securely submit answers by response token
CREATE OR REPLACE FUNCTION public.submit_public_satisfaction_survey(
  p_token text,
  p_rating integer,
  p_answers jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN false;
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN false;
  END IF;

  UPDATE public.satisfaction_responses
  SET
    rating = p_rating,
    answers = COALESCE(p_answers, '{}'::jsonb),
    submitted_at = now()
  WHERE token = p_token
    AND submitted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_satisfaction_survey(text, integer, jsonb) TO anon, authenticated;

-- Harden direct anonymous updates; public submissions now happen through RPC above
DROP POLICY IF EXISTS "Anyone can update unsubmitted responses" ON public.satisfaction_responses;