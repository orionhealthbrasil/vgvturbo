
-- Efficient function to get the last message for each contact using DISTINCT ON
CREATE OR REPLACE FUNCTION public.get_last_messages_for_contacts(p_contact_ids uuid[])
RETURNS TABLE(
  contact_id uuid,
  content text,
  message_type text,
  direction text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.contact_id)
    m.contact_id,
    m.content,
    m.message_type,
    m.direction,
    m.created_at
  FROM messages m
  WHERE m.contact_id = ANY(p_contact_ids)
  ORDER BY m.contact_id, m.created_at DESC;
$$;
