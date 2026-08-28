-- Allow super admins to view all contact_tags (same pattern as contacts table)
CREATE POLICY "Super admins can view all contact tags"
  ON contact_tags
  FOR SELECT
  USING (is_super_admin());
