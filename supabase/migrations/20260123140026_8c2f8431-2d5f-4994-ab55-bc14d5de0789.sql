-- Enable full replica identity for contacts table so realtime sends old values
-- This is needed for the notification sound logic to detect unread_count changes
ALTER TABLE public.contacts REPLICA IDENTITY FULL;