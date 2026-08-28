-- Allow WhatsApp contact card messages (vCard) to be stored
DO $$
BEGIN
  -- Drop existing constraint if present
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_message_type_check'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_message_type_check;
  END IF;

  -- Recreate with expanded allowed types
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_message_type_check
    CHECK (
      message_type IN (
        'text',
        'image',
        'audio',
        'video',
        'document',
        'sticker',
        'contact',
        'contacts'
      )
    );
END $$;