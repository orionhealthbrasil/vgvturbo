-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for chat-media bucket
CREATE POLICY "Users can view chat media from their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND user_belongs_to_org(auth.uid(), c.organization_id)
  )
);

CREATE POLICY "Users can upload chat media to their org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND user_belongs_to_org(auth.uid(), c.organization_id)
  )
);

CREATE POLICY "Users can delete chat media from their org"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND user_belongs_to_org(auth.uid(), c.organization_id)
  )
);