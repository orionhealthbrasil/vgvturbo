import { useState } from 'react';
import { Plus, X, Tag as TagIcon, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from '@/hooks/useTags';
import { Tag } from '@/types/crm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
];

export function TagManager({ open, onOpenChange }: TagManagerProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }

    try {
      if (editingTag) {
        await updateTag.mutateAsync({
          id: editingTag.id,
          name: name.trim(),
          color,
        });
        toast.success('Tag atualizada com sucesso!');
        setEditingTag(null);
      } else {
        await createTag.mutateAsync({
          name: name.trim(),
          color,
        });
        toast.success('Tag criada com sucesso!');
      }
      resetForm();
    } catch (error) {
      toast.error(editingTag ? 'Erro ao atualizar tag' : 'Erro ao criar tag');
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
  };

  const handleDelete = async (tag: Tag) => {
    try {
      await deleteTag.mutateAsync(tag.id);
      toast.success('Tag excluída com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir tag');
    }
  };

  const resetForm = () => {
    setName('');
    setColor(TAG_COLORS[0]);
    setEditingTag(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="w-5 h-5" />
            Gerenciar Tags
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">
              {editingTag ? 'Editar Tag' : 'Nova Tag'}
            </Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da tag"
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {editingTag && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={createTag.isPending || updateTag.isPending}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              {editingTag ? 'Salvar' : 'Criar Tag'}
            </Button>
          </div>
        </form>

        <div className="border-t pt-4 mt-4">
          <Label className="text-sm text-muted-foreground">Tags existentes</Label>
          <ScrollArea className="h-48 mt-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tag criada
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <Badge
                      style={{
                        backgroundColor: tag.color,
                        color: '#fff',
                      }}
                    >
                      {tag.name}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEdit(tag)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tag)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
