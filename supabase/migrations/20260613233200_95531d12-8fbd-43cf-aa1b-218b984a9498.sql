
-- Catalog media bucket: public read, member-only write scoped by org folder.
CREATE POLICY "Public can read catalog media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-media');

CREATE POLICY "Members can upload catalog media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-media'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members can update catalog media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members can delete catalog media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
