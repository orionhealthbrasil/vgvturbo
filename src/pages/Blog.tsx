import { Link } from "react-router-dom";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Loader2 } from "lucide-react";
import { VGVTurboIcon } from "@/components/brand/VGVTurboLogo";
import { PostCard } from "@/components/blog/PostCard";
import { usePublishedPosts } from "@/hooks/useBlogPosts";

const CATEGORIES = [
  "Todos",
  "Vendas no WhatsApp",
  "IA para PMEs",
  "Atendimento",
  "Automação",
  "Cases",
];

export default function Blog() {
  const [category, setCategory] = useState<string>("Todos");
  const { data: posts = [], isLoading } = usePublishedPosts(
    category === "Todos" ? undefined : category
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-white">
      <Helmet>
        <title>Blog VGV Turbo — IA, vendas e atendimento no WhatsApp</title>
        <meta
          name="description"
          content="Insights sobre IA aplicada a vendas, atendimento e automação no WhatsApp para imobiliárias e corretores."
        />
        <link rel="canonical" href="https://vgvturbo.com.br/blog" />
        <meta property="og:title" content="Blog VGV Turbo — IA, vendas e atendimento no WhatsApp" />
        <meta
          property="og:description"
          content="Insights sobre IA aplicada a vendas, atendimento e automação no WhatsApp."
        />
        <meta property="og:image" content="https://vgvturbo.com.br/og-image.png" />
        <meta property="og:url" content="https://vgvturbo.com.br/blog" />
      </Helmet>

      {/* Background ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(25 60% 50% / 0.06) 1px, transparent 1px), linear-gradient(to bottom, hsl(25 60% 50% / 0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-sky-500/10 blur-3xl" />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/5 bg-[#05070d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <VGVTurboIcon className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">VGV Turbo</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-orange-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:py-24">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1.5 text-xs font-medium text-orange-300">
            Blog VGV Turbo
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
            Insights sobre{" "}
            <span className="bg-gradient-to-r from-orange-300 to-sky-300 bg-clip-text text-transparent">
              IA, vendas e atendimento
            </span>{" "}
            no WhatsApp
          </h1>
          <p className="mt-6 text-lg text-slate-400">
            Como clínicas, consultorias e negócios estão usando IA para atender,
            vender e agendar com mais previsibilidade.
          </p>
        </header>

        {/* Categories */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                category === cat
                  ? "border-orange-400/60 bg-orange-400/15 text-orange-200"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts */}
        <section className="mt-16">
          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <p className="text-slate-400">
                Nenhum post publicado{" "}
                {category !== "Todos" ? `em "${category}"` : ""} ainda.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} VGV Turbo · Todos os direitos reservados
      </footer>
    </div>
  );
}
