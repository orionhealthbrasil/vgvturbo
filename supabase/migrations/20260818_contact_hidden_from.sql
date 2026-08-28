-- Table to track which organization members have a contact hidden from their view
CREATE TABLE IF NOT EXISTS contact_hidden_from (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, user_id)
);

ALTER TABLE contact_hidden_from ENABLE ROW LEVEL SECURITY;

-- Only org members can read visibility rules for their org's contacts
CREATE POLICY "Members can view hidden_from rules in their org"
  ON contact_hidden_from FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_hidden_from.contact_id
        AND user_belongs_to_org(auth.uid(), c.organization_id)
    )
  );

-- Only owners/admins can manage visibility rules
CREATE POLICY "Owners and admins can insert hidden_from rules"
  ON contact_hidden_from FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contact_hidden_from.contact_id
        AND om.user_id = auth.uid()
        AND (om.role = 'owner' OR om.member_role = 'admin')
    )
  );

CREATE POLICY "Owners and admins can delete hidden_from rules"
  ON contact_hidden_from FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contact_hidden_from.contact_id
        AND om.user_id = auth.uid()
        AND (om.role = 'owner' OR om.member_role = 'admin')
    )
  );

-- SECURITY DEFINER function to check visibility without causing RLS recursion.
-- Direct subquery on contact_hidden_from inside contacts RLS causes infinite recursion
-- because contact_hidden_from's own RLS policy queries contacts.
CREATE OR REPLACE FUNCTION is_contact_hidden_from(p_contact_id uuid, p_user_id uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM contact_hidden_from
    WHERE contact_id = p_contact_id AND user_id = p_user_id
  );
$$;
GRANT EXECUTE ON FUNCTION is_contact_hidden_from(uuid, uuid) TO authenticated;

-- Update the contacts SELECT policy to exclude hidden contacts using the SECURITY DEFINER function
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON contacts;

CREATE POLICY "Users can view contacts in their organization"
  ON contacts FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id)
    AND NOT is_contact_hidden_from(id, auth.uid())
  );

-- Super admins always see all (keep existing pattern)
-- "Super admins can view all contacts" policy already exists and takes precedence via OR
-- Nothing to change for super admins
