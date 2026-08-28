-- Fix profiles cross-tenant data leak
-- Pentest finding: "Users can view all profiles" policy (USING true) made org-scoped policy ineffective
-- Postgres grants SELECT if ANY policy matches, so the USING(true) overrode the org filter

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
-- The correct "Users can view same-org profiles" policy already exists and remains active
