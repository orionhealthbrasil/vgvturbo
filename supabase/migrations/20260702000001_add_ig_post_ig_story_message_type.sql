-- Add ig_post and ig_story to messages message_type check constraint
ALTER TABLE messages DROP CONSTRAINT messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'text'::text, 'image'::text, 'audio'::text, 'video'::text,
    'document'::text, 'sticker'::text, 'contact'::text, 'contacts'::text,
    'ig_reel'::text, 'ig_post'::text, 'ig_story'::text, 'location'::text
  ]));
