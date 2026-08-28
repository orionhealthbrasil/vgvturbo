
-- Create storage bucket for survey logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('survey-logos', 'survey-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to survey-logos
CREATE POLICY "Authenticated users can upload survey logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'survey-logos');

-- Allow public read access
CREATE POLICY "Public can read survey logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'survey-logos');

-- Allow authenticated users to update/delete their uploads
CREATE POLICY "Authenticated users can update survey logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'survey-logos');

CREATE POLICY "Authenticated users can delete survey logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'survey-logos');
