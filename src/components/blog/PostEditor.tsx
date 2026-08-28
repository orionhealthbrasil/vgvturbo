import { useState, useEffect } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Save, Eye, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUpsertPost, slugify, type BlogPost } from "@/hooks/useBlogPosts";

const CATEGORIES = [
  "Vendas no WhatsApp",
  "IA para PMEs",
  "Atendimento",
  "Automação",
  "Cases",
];

interface PostEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPost: Partial<BlogPost> | null;
}

export function PostEditor({ open, onOpenChange, initialPost }: PostEditorProps) {
  const [post, setPost] = useState<Partial<BlogPost>>({});
  const upsert = useUpsertPost();

  useEffect(() => {
    if (open) {
      setPost(initialPost || {
        title: "",
        slug: "",
        excerpt: "",
        content_md: "",
        category: CATEGORIES[0],
        tags: [],
        status: "draft",
        author_name: "Equipe VGV Turbo",
        reading_minutes: 5,
      });
    }
  }, [open, initialPost]);

  const update = (patch: Partial<BlogPost>) => setPost((p) => ({ ...p, ...patch }));

  const handleSave = async () => {
    if (!post.title?.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (!post.slug?.trim()) {
      update({ slug: slugify(post.title) });
    }
    try {
      const finalPost = {
        ...post,
        slug: post.slug?.trim() || slugify(post.title),
        published_at: post.status === "published" && !post.published_at
          ? new Date().toISOString()
          : post.published_at,
      };
      await upsert.mutateAsync(finalPost);
      toast.success("Post salvo!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post.id ? "Editar post" : "Novo post"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={post.title || ""}
                onChange={(e) => {
                  const title = e.target.value;
                  update({
                    title,
                    slug: post.slug || slugify(title),
                    meta_title: post.meta_title || title,
                  });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input
                value={post.slug || ""}
                onChange={(e) => update({ slug: slugify(e.target.value) })}
                placeholder="meu-post-incrivel"
              />
            </div>

            <div className="space-y-2">
              <Label>Resumo</Label>
              <Textarea
                value={post.excerpt || ""}
                onChange={(e) => update({ excerpt: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo (Markdown)</Label>
              <Tabs defaultValue="edit">
                <TabsList>
                  <TabsTrigger value="edit"><Pencil className="mr-1 h-3 w-3" />Editar</TabsTrigger>
                  <TabsTrigger value="preview"><Eye className="mr-1 h-3 w-3" />Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea
                    value={post.content_md || ""}
                    onChange={(e) => update({ content_md: e.target.value })}
                    rows={20}
                    className="font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="prose prose-sm max-w-none rounded-md border bg-card p-6 dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {post.content_md || "*Sem conteúdo*"}
                    </ReactMarkdown>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Publicado</Label>
                <Switch
                  checked={post.status === "published"}
                  onCheckedChange={(v) => update({ status: v ? "published" : "draft" })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {post.status === "published"
                  ? "Visível publicamente em /blog"
                  : "Rascunho — não aparece no site"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={post.category || CATEGORIES[0]}
                onValueChange={(v) => update({ category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Capa (URL da imagem)</Label>
              <Input
                value={post.cover_url || ""}
                onChange={(e) => update({ cover_url: e.target.value })}
                placeholder="https://..."
              />
              {post.cover_url && (
                <img src={post.cover_url} alt="" className="mt-2 rounded-md border" />
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <Label className="text-sm font-semibold">Chamada para ação (CTA)</Label>
              <p className="text-xs text-muted-foreground">
                Aparece no fim do post. Deixe em branco para usar o CTA padrão da VGV Turbo.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Texto do botão</Label>
                <Input
                  value={post.cta_text || ""}
                  onChange={(e) => update({ cta_text: e.target.value })}
                  placeholder="Falar com a VGV Turbo no WhatsApp"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">URL de destino</Label>
                <Input
                  value={post.cta_url || ""}
                  onChange={(e) => update({ cta_url: e.target.value })}
                  placeholder="https://wa.me/55..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags (vírgula)</Label>
              <Input
                value={(post.tags || []).join(", ")}
                onChange={(e) =>
                  update({
                    tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Autor</Label>
              <Input
                value={post.author_name || ""}
                onChange={(e) => update({ author_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Tempo de leitura (min)</Label>
              <Input
                type="number"
                value={post.reading_minutes || 5}
                onChange={(e) => update({ reading_minutes: parseInt(e.target.value) || 5 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Meta title (SEO)</Label>
              <Input
                value={post.meta_title || ""}
                onChange={(e) => update({ meta_title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Meta description (SEO)</Label>
              <Textarea
                value={post.meta_description || ""}
                onChange={(e) => update({ meta_description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Salvar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
