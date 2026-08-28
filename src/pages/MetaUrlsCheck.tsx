import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type CheckResult = {
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
  finalUrl?: string;
  contentType?: string | null;
};

const DEFAULTS = {
  privacy: "https://vgvturbo.com.br/privacy",
  terms: "https://vgvturbo.com.br/terms",
  dataDeletion: "https://vgvturbo.com.br/datadeletion",
};

export default function MetaUrlsCheck() {
  const { toast } = useToast();
  const [urls, setUrls] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, CheckResult> | null>(null);

  const labels: Record<keyof typeof DEFAULTS, string> = {
    privacy: "Política de Privacidade",
    terms: "Termos de Serviço",
    dataDeletion: "Exclusão de Dados",
  };

  const allOk = results
    ? Object.values(results).every((r) => r.ok)
    : false;

  const runCheck = async () => {
    setLoading(true);
    setResults(null);
    try {
      const list = Object.entries(urls);
      const { data, error } = await supabase.functions.invoke("check-meta-urls", {
        body: { urls: list.map(([, v]) => v.trim()) },
      });
      if (error) throw error;

      const map: Record<string, CheckResult> = {};
      list.forEach(([key], i) => {
        map[key] = (data as { results: CheckResult[] }).results[i];
      });
      setResults(map);

      if ((data as { allOk: boolean }).allOk) {
        toast({
          title: "Todas as URLs estão acessíveis",
          description: "Você pode enviar para a Meta com segurança.",
        });
      } else {
        toast({
          title: "Algumas URLs falharam",
          description: "Corrija antes de enviar à Meta.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Erro ao verificar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendToMeta = () => {
    if (!allOk) return;
    toast({
      title: "Pronto para enviar",
      description: "Cole as URLs no painel da Meta e clique em Salvar.",
    });
  };

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <Helmet>
        <title>Checagem de URLs Meta | VGV Turbo</title>
      </Helmet>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Checagem prévia — URLs da Meta</h1>
          <p className="text-sm text-muted-foreground">
            Verifica se Política, Termos e Exclusão respondem HTTP 200 antes de enviar ao painel Meta.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>URLs do app</CardTitle>
          <CardDescription>
            Devem ser HTTPS e públicas (sem login). A Meta rejeita qualquer status diferente de 200.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(urls) as Array<keyof typeof DEFAULTS>).map((key) => {
            const result = results?.[key];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={key}>{labels[key]}</Label>
                  {result && (
                    <Badge
                      variant={result.ok ? "default" : "destructive"}
                      className="gap-1"
                    >
                      {result.ok ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {result.ok
                        ? `HTTP ${result.status} OK`
                        : result.error ?? `HTTP ${result.status ?? "?"}`}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    value={urls[key]}
                    onChange={(e) =>
                      setUrls((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="https://..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(urls[key], "_blank")}
                    title="Abrir em nova aba"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                {result?.finalUrl && result.finalUrl !== result.url && (
                  <p className="text-xs text-muted-foreground">
                    Redirecionou para: <code>{result.finalUrl}</code>
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-4">
            <Button onClick={runCheck} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar URLs"
              )}
            </Button>
            <Button
              onClick={sendToMeta}
              disabled={!allOk || loading}
              variant={allOk ? "default" : "secondary"}
              className="flex-1"
            >
              {allOk ? "✓ Pronto para enviar à Meta" : "Salvar (bloqueado)"}
            </Button>
          </div>

          {results && !allOk && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">
                Não envie ainda. Possíveis causas:
              </p>
              <ul className="list-disc pl-5 mt-1 text-muted-foreground space-y-1">
                <li>DNS do <code>vgvturbo.com.br</code> ainda não propagado.</li>
                <li>Página retorna 404 (rota não existe ou nome errado).</li>
                <li>Site exige login / não é público.</li>
                <li>SSL inválido ou certificado expirado.</li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                Tente trocar para o domínio <code>vgvturbo.lovable.app</code> que está sempre online.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
