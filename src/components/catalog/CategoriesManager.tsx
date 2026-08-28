import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProductCategories,
  useUpsertCategory,
  useDeleteCategory,
} from '@/hooks/useCatalog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CategoriesManager({ open, onOpenChange }: Props) {
  const { data: categories = [] } = useProductCategories();
  const upsert = useUpsertCategory();
  const del = useDeleteCategory();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await upsert.mutateAsync({ name: newName.trim() });
      setNewName('');
      toast.success('Categoria criada');
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    }
  };

  const save = async (id: string) => {
    try {
      await upsert.mutateAsync({ id, name: editingName.trim() });
      setEditingId(null);
      toast.success('Categoria atualizada');
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Categoria excluída');
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Categorias</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova categoria"
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <Button onClick={add} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2 border rounded-md">
                {editingId === c.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && save(c.id)}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => save(c.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{c.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditingName(c.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma categoria ainda.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
