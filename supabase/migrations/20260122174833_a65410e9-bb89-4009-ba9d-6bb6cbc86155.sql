-- Ensure profiles.user_id is unique so joins return a single profile per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Add FK from messages.sent_by_user_id -> profiles.user_id (safe for NULLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_sent_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sent_by_user_id_fkey
      FOREIGN KEY (sent_by_user_id)
      REFERENCES public.profiles (user_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful index for join performance
CREATE INDEX IF NOT EXISTS idx_messages_sent_by_user_id
  ON public.messages (sent_by_user_id);
