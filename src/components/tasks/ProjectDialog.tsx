import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects';
import type { Project } from '@/types/tasks';
import { toast } from 'sonner';

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#22c55e', '#10b981', '#06b6d4',
  '#3b82f6', '#64748b',
];

const schema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100, 'Máximo 100 caracteres'),
  description: z.string().trim().max(500, 'Máximo 500 caracteres'),
  color: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}

export function ProjectDialog({ open, onOpenChange, project }: Props) {
  const create = useCreateProject();
  const update = useUpdateProject();
  const isEditing = !!project;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      color: project?.color ?? PROJECT_COLORS[0],
    },
  });

  const selectedColor = form.watch('color');

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && project) {
        await update.mutateAsync({ id: project.id, name: values.name, description: values.description, color: values.color });
        toast.success('Projeto atualizado');
      } else {
        await create.mutateAsync({ name: values.name, description: values.description, color: values.color });
        toast.success('Projeto criado');
      }
      onOpenChange(false);
      form.reset();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar projeto');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
          <DialogDescription>Organize suas tarefas em projetos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...form.register('name')} placeholder="Ex: Lançamento Q1" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea id="description" {...form.register('description')} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue('color', c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
