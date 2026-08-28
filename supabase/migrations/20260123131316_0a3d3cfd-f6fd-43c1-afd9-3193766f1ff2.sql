-- Add profile picture URL column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN profile_picture_url TEXT;