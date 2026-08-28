import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_url: string | null;
  category: string | null;
  tags: string[] | null;
  status: "draft" | "published";
  published_at: string | null;
  author_name: string;
  reading_minutes: number;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  ai_prompt: any;
  cover_prompt: string | null;
  cta_text: string | null;
  cta_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Public: list published posts
export function usePublishedPosts(category?: string) {
  return useQuery({
    queryKey: ["blog-posts-published", category ?? "all"],
    queryFn: async (): Promise<BlogPost[]> => {
      let q = supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (category) q = q.eq("category", category);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BlogPost[];
    },
  });
}

// Public: fetch a published post by slug
export function usePublishedPost(slug: string | undefined) {
  return useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async (): Promise<BlogPost | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as BlogPost | null;
    },
    enabled: !!slug,
  });
}

// Admin: list all posts
export function useAllPosts() {
  return useQuery({
    queryKey: ["blog-posts-all"],
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BlogPost[];
    },
  });
}

export function useUpsertPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Partial<BlogPost> & { id?: string }) => {
      const payload: any = { ...post, updated_at: new Date().toISOString() };
      if (post.id) {
        const { data, error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", post.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data: user } = await supabase.auth.getUser();
      payload.created_by = user.user?.id;
      const { data, error } = await supabase
        .from("blog_posts")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-posts-all"] });
      qc.invalidateQueries({ queryKey: ["blog-posts-published"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-posts-all"] });
      qc.invalidateQueries({ queryKey: ["blog-posts-published"] });
    },
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
