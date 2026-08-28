import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useProjects';
import { useProjectAreas } from '@/hooks/useProjectAreas';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type Task, type TaskPriority, type TaskStatus } from '@/types/tasks';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultProjectId?: string | null;
  defaultContactId?: string | null;
}

export function TaskFormDialog({ open, onOpenChange, task, defaultProjectId, defaultContactId }: Props) {
  const isEditing = !!task;
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useOrganizationMembers();
  const create = useCreateTask();
  const update = useUpdateTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assignees, setAssignees] = useState<string[]>([]);

  const { data: areas = [] } = useProjectAreas(projectId);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setStatus(task?.status ?? 'todo');
      setPriority(task?.priority ?? 'medium');
      setProjectId(task?.project_id ?? defaultProjectId ?? null);
      setAreaId(task?.area_id ?? null);
      setDueDate(task?.due_at ? new Date(task.due_at) : undefined);
      setAssignees(task?.assignees?.map((a) => a.user_id) ?? []);
    }
  }, [open, task, defaultProjectId]);

  // Se o projeto mudar e a área atual não pertencer a ele, limpa
  useEffect(() => {
    if (areaId && areas.length > 0 && !areas.find((a) => a.id === areaId)) {
      setAreaId(null);
    }
  }, [areas, areaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Título obrigatório');
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        project_id: projectId,
        area_id: projectId ? areaId : null,
        contact_id: defaultContactId ?? task?.contact_id ?? null,
        due_at: dueDate ? dueDate.toISOString() : null,
        assignee_user_ids: assignees,
      };
      if (isEditing && task) {
        await update.mutateAsync({ id: task.id, patch: payload as any });
        toast.success('Tarefa atualizada');
      } else {
        await create.mutateAsync(payload);
        toast.success('Tarefa criada');
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar tarefa');
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize os detalhes da tarefa.' : 'Preencha as informações para criar uma nova tarefa.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O que precisa ser feito?"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalhes adicionais..."
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select
                value={projectId ?? 'none'}
                onValueChange={(v) => setProjectId(v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn('w-full justify-start font-normal', !dueDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {dueDate ? format(dueDate, "dd 'de' MMM", { locale: ptBR }) : 'Sem prazo'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>
                        Remover prazo
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {projectId && areas.length > 0 && (
            <div className="space-y-2">
              <Label>Área</Label>
              <Select
                value={areaId ?? 'none'}
                onValueChange={(v) => setAreaId(v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem área</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const selected = assignees.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => toggleAssignee(m.user_id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-colors',
                      selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
                    )}
                  >
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px]">
                        {(m.full_name ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{m.full_name ?? m.email}</span>
                    {selected && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
