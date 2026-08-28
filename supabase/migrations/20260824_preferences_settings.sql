-- Preferences columns on organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS vendor_offline_auto_reactivate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_offline_reactivate_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS allow_vendor_assignment boolean NOT NULL DEFAULT true;

-- Track who set a member offline and when it auto-expires
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS offline_until timestamptz,
  ADD COLUMN IF NOT EXISTS offline_set_by_admin boolean NOT NULL DEFAULT false;
