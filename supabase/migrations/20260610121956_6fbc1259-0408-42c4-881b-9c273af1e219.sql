
-- Fix 1: survey-logos bucket — restrict writes to org members based on path prefix
DROP POLICY IF EXISTS "Authenticated users can upload survey logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update survey logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete survey logos" ON storage.objects;

CREATE POLICY "Members can upload org survey logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'survey-logos'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members can update org survey logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'survey-logos'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members can delete org survey logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'survey-logos'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Fix 2: realtime.messages — default-deny Broadcast/Presence channels.
-- The app uses postgres_changes (not gated by realtime.messages RLS), so this
-- blocks unauthorized Broadcast/Presence subscriptions without breaking features.
DROP POLICY IF EXISTS "Default deny realtime" ON realtime.messages;
CREATE POLICY "Default deny realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (false);
