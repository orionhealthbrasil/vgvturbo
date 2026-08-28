-- Create storage bucket for internal chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-chat-media', 'internal-chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for internal-chat-media bucket
-- Users can view files from conversations they participate in
CREATE POLICY "Users can view internal chat files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'internal-chat-media' AND
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.user_id = auth.uid()
    AND p.conversation_id::text = (storage.foldername(name))[1]
  )
);

-- Users can upload files to conversations they participate in
CREATE POLICY "Users can upload internal chat files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'internal-chat-media' AND
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.user_id = auth.uid()
    AND p.conversation_id::text = (storage.foldername(name))[1]
  )
);

-- Users can delete their own uploaded files
CREATE POLICY "Users can delete their own internal chat files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'internal-chat-media' AND
  auth.uid()::text = (storage.foldername(name))[2]
);