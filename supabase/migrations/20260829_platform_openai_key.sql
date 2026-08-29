-- Platform-wide OpenAI API key, used as the fallback for every organization
-- that doesn't (or shouldn't, under the VGVCash credit model) have its own
-- OpenAI key configured. Singleton table, super-admin only.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true,
  openai_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES auth.users(id),
  CONSTRAINT platform_settings_singleton CHECK (id)
);

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- No RLS policy is created — the table has zero direct access for
-- anon/authenticated. Only service_role (edge functions) and the
-- SECURITY DEFINER RPCs below can read or write it.
REVOKE ALL ON public.platform_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_openai_api_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  SELECT openai_api_key INTO k FROM public.platform_settings WHERE id = true;
  RETURN k;
END
$$;

CREATE OR REPLACE FUNCTION public.set_platform_openai_api_key(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  UPDATE public.platform_settings
  SET openai_api_key = NULLIF(btrim(p_key), ''), updated_at = now(), updated_by_user_id = auth.uid()
  WHERE id = true;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_openai_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_openai_api_key(text) TO authenticated;
