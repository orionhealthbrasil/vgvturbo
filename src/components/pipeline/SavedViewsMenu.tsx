import { useState } from 'react';
import { Bookmark, Star, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  PipelineFilters,
  PipelineSavedView,
  useCreatePipelineSavedView,
  useDeletePipelineSavedView,
  useSetDefaultPipelineView,
} from '@/hooks/usePipelineSavedViews';

interface Props {
  views: PipelineSavedView[];
  currentFilters: PipelineFilters;
  onApply: (filters: PipelineFilters, viewId: string | null) => void;
  activeViewId: string | null;
}

export function SavedViewsMenu({ views, currentFilters, onApply, activeViewId }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [asDefault, setAsDefault] = useState(false);

  const createView = useCreatePipelineSavedView();
  const setDefault = useSetDefaultPipelineView();
  const deleteView = useDeletePipelineSavedView();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Dê um nome para a visão');
      return;
    }
    try {
      const created = await createView.mutateAsync({
        name: trimmed,
        filters: currentFilters,
        is_default: asDefault,
      });
      toast.success('Visão salva');
      setOpen(false);
      setName('');
      setAsDefault(false);
      onApply(created.filters, created.id);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar visão');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault.mutateAsync(id);
      toast.success('Visão padrão definida');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao definir padrão');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteView.mutateAsync(id);
      toast.success('Visão removida');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="w-4 h-4" />
            Visões
            {views.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {views.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Visões salvas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {views.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              Nenhuma visão salva ainda
            </p>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onApply(v.filters, v.id);
                }}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`text-sm truncate ${
                      activeViewId === v.id ? 'font-semibold text-primary' : ''
                    }`}
                  >
                    {v.name}
                  </span>
                  {v.is_default && (
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100">
                  {!v.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(v.id);
                      }}
                      title="Definir como padrão"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(v.id);
                    }}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className="text-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar visão atual
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar visão</DialogTitle>
            <DialogDescription>
              Guarde os filtros e o modo de exibição atuais para reutilizar depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="view-name">Nome</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Fechamentos da semana"
                maxLength={80}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={asDefault}
                onCheckedChange={(v) => setAsDefault(!!v)}
              />
              <span className="text-sm">Definir como padrão (carrega ao abrir)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createView.isPending}>
              {createView.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
