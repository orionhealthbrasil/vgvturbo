import { useEffect, useState } from 'react';
import { Plus, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useProjectAreas, useCreateArea, useUpdateArea, useDeleteArea } from '@/hooks/useProjectAreas';
import type { ProjectArea } from '@/types/tasks';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  selectedAreaId: string | null;
  onSelect: (areaId: string | null) => void;
}

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#0ea5e9', '#ef4444', '#64748b'];

export function ProjectAreasBar({ projectId, selectedAreaId, onSelect }: Props) {
  const { data: areas = [], isLoading } = useProjectAreas(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectArea | null>(null);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (area: ProjectArea) => { setEditing(area); setDialogOpen(true); };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'inline-flex items-center px-2.5 h-7 rounded-full border text-xs font-medium transition-colors',
          selectedAreaId === null
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background hover:bg-muted border-border',
        )}
      >
        Todas as áreas
      </button>
      {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      {areas.map((area) => (
        <AreaChip
          key={area.id}
          area={area}
          active={selectedAreaId === area.id}
          onSelect={() => onSelect(area.id)}
          onEdit={() => openEdit(area)}
        />
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={openNew}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="w-3 h-3 mr-1" />
        Nova área
      </Button>

      <AreaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        area={editing}
        onDeleted={() => {
          if (editing && selectedAreaId === editing.id) onSelect(null);
        }}
      />
    </div>
  );
}

function AreaChip({
  area, active, onSelect, onEdit,
}: { area: ProjectArea; active: boolean; onSelect: () => void; onEdit: () => void }) {
  return (
    <div className="inline-flex items-stretch">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 rounded-l-full border-y border-l text-xs font-medium transition-colors',
          active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background hover:bg-muted border-border',
        )}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
        {area.name}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center w-5 h-7 rounded-r-full border-y border-r transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                : 'bg-background hover:bg-muted border-border text-muted-foreground',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Editar / Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AreaDialog({
  open, onOpenChange, projectId, area, onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  area: ProjectArea | null;
  onDeleted: () => void;
}) {
  const create = useCreateArea();
  const update = useUpdateArea();
  const del = useDeleteArea();
  const isEditing = !!area;

  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (open) {
      setName(area?.name ?? '');
      setColor(area?.color ?? '#6366f1');
    }
  }, [open, area?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    try {
      if (isEditing && area) {
        await update.mutateAsync({ id: area.id, project_id: projectId, name: name.trim(), color });
        toast.success('Área atualizada');
      } else {
        await create.mutateAsync({ project_id: projectId, name: name.trim(), color });
        toast.success('Área criada');
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar área');
    }
  };

  const handleDelete = async () => {
    if (!area) return;
    if (!confirm(`Excluir a área "${area.name}"? As tarefas nela ficarão sem área.`)) return;
    try {
      await del.mutateAsync({ id: area.id, project_id: projectId });
      toast.success('Área excluída');
      onDeleted();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar área' : 'Nova área'}</DialogTitle>
          <DialogDescription>
            Áreas ajudam a organizar tarefas dentro do projeto (ex: Jurídico, Tráfego, Social Media).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {isEditing && (
              <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                <Trash2 className="w-4 h-4 mr-1" />
                Excluir
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
