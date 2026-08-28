ALTER TABLE public.instagram_instances ALTER COLUMN page_id DROP NOT NULL;
ALTER TABLE public.instagram_instances ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'facebook_login';
ALTER TABLE public.instagram_instances ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.instagram_instances ADD CONSTRAINT instagram_instances_auth_type_check CHECK (auth_type IN ('facebook_login','instagram_login'));