
-- Tabela para armazenar comentários recebidos via webhook do Instagram
CREATE TABLE public.instagram_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ig_comment_id TEXT NOT NULL,
  ig_media_id TEXT,
  parent_comment_id TEXT,
  from_username TEXT,
  from_ig_user_id TEXT,
  text TEXT,
  permalink TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_instagram_comments_unique ON public.instagram_comments(organization_id, ig_comment_id);
CREATE INDEX idx_instagram_comments_received ON public.instagram_comments(organization_id, received_at DESC);

ALTER TABLE public.instagram_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org instagram comments" ON public.instagram_comments
  FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Tabela para rastrear posts publicados via OrionChat
CREATE TABLE public.instagram_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL,
  caption TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'IMAGE',
  permalink TEXT,
  published_by_user_id UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_instagram_posts_unique ON public.instagram_posts(organization_id, ig_media_id);
CREATE INDEX idx_instagram_posts_published ON public.instagram_posts(organization_id, published_at DESC);

ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org instagram posts" ON public.instagram_posts
  FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));
