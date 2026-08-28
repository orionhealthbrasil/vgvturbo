import { Link } from "react-router-dom";
import { Calendar, Clock } from "lucide-react";
import type { BlogPost } from "@/hooks/useBlogPosts";

interface PostCardProps {
  post: BlogPost;
}

export function PostCard({ post }: PostCardProps) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm transition hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.06]"
    >
      <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
        {post.cover_url ? (
          <img
            src={post.cover_url}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-emerald-300/40">
            <span className="text-6xl font-bold">O</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        {post.category && (
          <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            {post.category}
          </span>
        )}

        <h3 className="text-xl font-bold text-white transition group-hover:text-emerald-300">
          {post.title}
        </h3>

        {post.excerpt && (
          <p className="line-clamp-3 text-sm text-slate-400">{post.excerpt}</p>
        )}

        <div className="mt-auto flex items-center gap-4 pt-2 text-xs text-slate-500">
          {date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {date}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {post.reading_minutes} min de leitura
          </span>
        </div>
      </div>
    </Link>
  );
}
