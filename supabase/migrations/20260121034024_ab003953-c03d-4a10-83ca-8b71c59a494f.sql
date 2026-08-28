-- Add conversation_history column to reviews table
ALTER TABLE public.reviews
ADD COLUMN conversation_history text;