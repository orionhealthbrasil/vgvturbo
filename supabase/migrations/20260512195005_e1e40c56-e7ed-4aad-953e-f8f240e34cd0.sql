ALTER TABLE public.instagram_comments
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_text text,
  ADD COLUMN IF NOT EXISTS replied_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS ig_reply_id text;

CREATE INDEX IF NOT EXISTS idx_instagram_comments_pending
  ON public.instagram_comments (organization_id, received_at DESC)
  WHERE replied_at IS NULL;