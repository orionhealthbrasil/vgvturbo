
-- Create user pipeline preferences table
CREATE TABLE IF NOT EXISTS public.user_pipeline_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_pipeline_id UUID NOT NULL REFERENCES public.kanban_pipelines(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.user_pipeline_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preference
CREATE POLICY "Users can view their own pipeline preference"
  ON public.user_pipeline_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preference
CREATE POLICY "Users can insert their own pipeline preference"
  ON public.user_pipeline_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preference
CREATE POLICY "Users can update their own pipeline preference"
  ON public.user_pipeline_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preference
CREATE POLICY "Users can delete their own pipeline preference"
  ON public.user_pipeline_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp update trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_pipeline_preferences_updated_at
BEFORE UPDATE ON public.user_pipeline_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
