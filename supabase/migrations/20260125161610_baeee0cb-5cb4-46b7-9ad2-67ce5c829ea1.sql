-- Create user_stickers table to store saved stickers
CREATE TABLE public.user_stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  name TEXT,
  sticker_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_stickers ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage their own stickers
CREATE POLICY "Users can view their own stickers"
  ON public.user_stickers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stickers"
  ON public.user_stickers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stickers"
  ON public.user_stickers FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for stickers
INSERT INTO storage.buckets (id, name, public)
VALUES ('stickers', 'stickers', true);

-- Storage policies for stickers bucket
CREATE POLICY "Users can upload their own stickers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stickers' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view stickers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stickers');

CREATE POLICY "Users can delete their own stickers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stickers' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );