ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_messages_media_slug ON messages (media_slug) WHERE media_slug IS NOT NULL;
