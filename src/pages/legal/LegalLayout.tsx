import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ReactNode } from "react";

interface LegalLayoutProps {
  title: string;
  description: string;
  updatedAt: string;
  children: ReactNode;
}

export const LegalLayout = ({ title, description, updatedAt, children }: LegalLayoutProps) => {
  return (
    <>
      <Helmet>
        <title>{title} | VGV Turbo</title>
        <meta name="description" content={description} />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="text-xl font-semibold">
              VGV Turbo
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>
              <Link to="/terms" className="hover:text-foreground">Termos</Link>
              <Link to="/data-deletion" className="hover:text-foreground">Exclusão de dados</Link>
            </nav>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-10">Última atualização: {updatedAt}</p>
          <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 leading-relaxed">
            {children}
          </article>
        </main>
        <footer className="border-t border-border mt-16">
          <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} VGV Turbo. Todos os direitos reservados.
          </div>
        </footer>
      </div>
    </>
  );
};
