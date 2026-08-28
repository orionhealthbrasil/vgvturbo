-- Enable realtime for contacts table (for unread_count updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;