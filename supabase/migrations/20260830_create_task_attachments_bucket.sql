-- useTaskAttachments.ts uploads to a 'task-attachments' bucket that never
-- existed in this project (bucket + RLS policies were both missing — this
-- one wasn't even synced partially like catalog-media was). Uploading a
-- task attachment has been failing with "Bucket not found".
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {organization_id}/{task_id}/{uuid}-{filename}
CREATE POLICY "Public can read task attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Members can upload task attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Members can delete task attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
