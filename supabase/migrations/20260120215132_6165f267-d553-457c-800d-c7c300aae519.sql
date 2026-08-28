-- Create salespeople table
CREATE TABLE public.salespeople (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on salespeople
ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;

-- Allow public read access to salespeople (anyone can see the list)
CREATE POLICY "Anyone can view salespeople" 
ON public.salespeople 
FOR SELECT 
USING (true);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salesperson_id UUID NOT NULL REFERENCES public.salespeople(id) ON DELETE CASCADE,
  response_time_minutes INTEGER NOT NULL,
  defect_type TEXT NOT NULL CHECK (defect_type IN ('Long Delay', 'No Response', 'Rude/Tone', 'Incorrect Info', 'Other')),
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews
CREATE POLICY "Anyone can view reviews" 
ON public.reviews 
FOR SELECT 
USING (true);

-- Allow public insert access to reviews
CREATE POLICY "Anyone can create reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (true);

-- Insert sample salespeople
INSERT INTO public.salespeople (name) VALUES 
  ('John Smith'),
  ('Maria Garcia'),
  ('Ahmed Hassan'),
  ('Sarah Johnson'),
  ('Carlos Mendez');

-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', true);

-- Storage policies for evidence bucket
CREATE POLICY "Anyone can view evidence" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'evidence');

CREATE POLICY "Anyone can upload evidence" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'evidence');