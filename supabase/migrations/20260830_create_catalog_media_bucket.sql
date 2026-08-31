-- The catalog-media RLS policies (20260613233200) were added assuming the
-- bucket already existed, but it was only ever created via the dashboard in
-- the source project — never replicated here. Uploads to the property
-- catalog have been failing with "Bucket not found" as a result.
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-media', 'catalog-media', true)
ON CONFLICT (id) DO NOTHING;
