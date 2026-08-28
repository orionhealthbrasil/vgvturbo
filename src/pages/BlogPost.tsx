import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Calendar, Clock, Loader2 } from "lucide-react";
import { VGVTurboIcon } from "@/components/brand/VGVTurboLogo";
import { usePublishedPost } from "@/hooks/useBlogPosts";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = usePublishedPost(slug);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const url = `https://vgvturbo.com.br/blog/${post.slug}`;
  const ogImage = post.og_image_url || post.cover_url || "https://vgvturbo.com.br/og-image.png";
  const description = post.meta_description || post.excerpt || "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-white">
      <Helmet>
        <title>{post.meta_title || post.title} — Blog VGV Turbo</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.meta_title || post.title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.meta_title || post.title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        {post.published_at && (
          <meta property="article:published_time" content={post.published_at} />
        )}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description,
            image: ogImage,
            datePublished: post.published_at,
            dateModified: post.updated_at,
            author: { "@type": "Organization", name: post.author_name },
            publisher: {
              "@type": "Organization",
              name: "VGV Turbo",
              logo: { "@type": "ImageObject", url: "https://vgvturbo.com.br/favicon.png" },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
          })}
        </script>
      </Helmet>

      {/* Ambient bg */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-sky-500/10 blur-3xl" />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/5 bg-[#05070d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <VGVTurboIcon className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">VGV Turbo</span>
          </Link>
          <Link
            to="/blog"
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-orange-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Todos os posts
          </Link>
        </div>
      </nav>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-12 md:py-20">
        {post.category && (
          <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-300">
            {post.category}
          </span>
        )}

        <h1 className="mt-6 text-4xl font-bold leading-tight md:text-5xl">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="mt-6 text-xl leading-relaxed text-slate-400">{post.excerpt}</p>
        )}

        <div className="mt-8 flex items-center gap-6 border-y border-white/10 py-4 text-sm text-slate-500">
          <span>Por {post.author_name}</span>
          {date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {date}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {post.reading_minutes} min de leitura
          </span>
        </div>

        {post.cover_url && (
          <img
            src={post.cover_url}
            alt={post.title}
            className="mt-10 w-full rounded-2xl border border-white/10"
          />
        )}

        <div
          className="prose prose-invert prose-emerald mt-12 max-w-none
            prose-headings:text-white prose-headings:font-bold
            prose-h2:mt-12 prose-h2:text-3xl
            prose-h3:mt-8 prose-h3:text-2xl
            prose-p:text-slate-300 prose-p:leading-relaxed
            prose-a:text-orange-300 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white
            prose-code:text-orange-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
            prose-blockquote:border-orange-400 prose-blockquote:text-slate-400
            prose-ul:text-slate-300 prose-ol:text-slate-300
            prose-li:marker:text-orange-400
            prose-img:rounded-xl prose-img:border prose-img:border-white/10"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content_md}</ReactMarkdown>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2 border-t border-white/10 pt-8">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/10 to-sky-500/10 p-8 text-center">
          <h3 className="text-2xl font-bold">Quer uma operação de IA assim na sua empresa?</h3>
          <p className="mt-3 text-slate-400">
            A VGV Turbo monta tudo sob medida e entrega rodando.
          </p>
          <a
            href={post.cta_url || "https://wa.me/5579991658966?text=Ol%C3%A1!%20Quero%20conhecer%20o%20VGV%20Turbo"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-[#05070d] transition hover:bg-orange-400"
          >
            {post.cta_text || "Falar com a VGV Turbo no WhatsApp"}
          </a>
        </div>
      </article>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} VGV Turbo
      </footer>
    </div>
  );
}
