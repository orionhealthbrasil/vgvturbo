-- Add is_pinned flag to contacts for always-on-top conversations
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Index for fast filtering of pinned contacts
CREATE INDEX IF NOT EXISTS contacts_is_pinned_idx ON contacts (organization_id, is_pinned) WHERE is_pinned = true;
