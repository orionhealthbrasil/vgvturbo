import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const CATEGORIES = [
  "Vendas no WhatsApp",
  "IA para PMEs",
  "Atendimento",
  "Automação",
  "Cases",
];
const TONES = [
  { value: "educativo", label: "Educativo" },
  { value: "vendas", label: "Direto / Vendas" },
  { value: "case", label: "História / Case" },
];
const LENGTHS = [
  { value: "short", label: "Curto (~600 palavras)" },
  { value: "medium", label: "Médio (~1200 palavras)" },
  { value: "long", label: "Longo (~2000 palavras)" },
];

interface GeneratePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (post: any) => void;
}

export function GeneratePostDialog({ open, onOpenChange, onGenerated }: GeneratePostDialogProps) {
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tone, setTone] = useState("educativo");
  const [length, setLength] = useState("medium");
  const [keywords, setKeywords] = useState("");
  const [generateCover, setGenerateCover] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Informe o tópico do post");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
        body: {
          topic: topic.trim(),
          category,
          tone,
          length,
          keywords: keywords.trim(),
          generate_cover: generateCover,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Post gerado com sucesso!");
      onGenerated(data);
      onOpenChange(false);
      // reset
      setTopic("");
      setKeywords("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Gerar post com IA
          </DialogTitle>
          <DialogDescription>
            Configure os parâmetros e a IA cria um rascunho completo para você revisar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="topic">Tópico ou título sugerido *</Label>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Como uma clínica odontológica triplicou agendamentos com IA no WhatsApp"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tom</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tamanho</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTHS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Palavras-chave SEO (opcional)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ia whatsapp, automação atendimento, agendamento clínica"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="cover"
              checked={generateCover}
              onCheckedChange={(v) => setGenerateCover(!!v)}
            />
            <Label htmlFor="cover" className="cursor-pointer text-sm font-normal">
              Gerar imagem de capa com IA (DALL·E)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Gerar post</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
