-- Table for storing user quick messages / shortcuts
CREATE TABLE public.quick_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  shortcut TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_shortcut UNIQUE (user_id, shortcut)
);

-- Enable RLS
ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own quick messages
CREATE POLICY "Users can view their own quick messages"
ON public.quick_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own quick messages
CREATE POLICY "Users can create their own quick messages"
ON public.quick_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own quick messages
CREATE POLICY "Users can update their own quick messages"
ON public.quick_messages
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own quick messages
CREATE POLICY "Users can delete their own quick messages"
ON public.quick_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_quick_messages_updated_at
  BEFORE UPDATE ON public.quick_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for quick message media
INSERT INTO storage.buckets (id, name, public) VALUES ('quick-messages', 'quick-messages', true);

-- Storage policies for quick messages bucket
CREATE POLICY "Users can upload their own quick message media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'quick-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own quick message media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'quick-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own quick message media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'quick-messages' AND auth.uid()::text = (storage.foldername(name))[1]);