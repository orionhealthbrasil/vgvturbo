import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, LayoutList, Kanban, User, FolderOpen, EyeOff, Eye, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTasks, useTasksRealtime, useUpdateTask } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { ProjectAreasBar } from '@/components/tasks/ProjectAreasBar';
import { useDebounce } from '@/hooks/useDebounce';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, type Task, type TaskStatus } from '@/types/tasks';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban' | 'mine';

const HIDE_DONE_KEY = 'tasks_hide_done';

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = searchParams.get('project');
  const areaFilter = searchParams.get('area');
  const taskFromUrl = searchParams.get('task');

  useTasksRealtime();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(taskFromUrl);
  const [hideDone, setHideDone] = useState<boolean>(() => {
    try { return localStorage.getItem(HIDE_DONE_KEY) === '1'; } catch { return false; }
  });

  // sync deep link
  useEffect(() => {
    if (taskFromUrl && taskFromUrl !== detailTaskId) {
      setDetailTaskId(taskFromUrl);
    }
  }, [taskFromUrl]);

  useEffect(() => {
    try { localStorage.setItem(HIDE_DONE_KEY, hideDone ? '1' : '0'); } catch {}
  }, [hideDone]);

  const debouncedSearch = useDebounce(search, 300);

  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();

  const { data: rawTasks = [], isLoading } = useTasks({
    projectId: projectFilter,
    areaId: areaFilter,
    status: statusFilter === 'all' ? null : statusFilter,
    search: debouncedSearch,
    onlyMine: viewMode === 'mine',
  });

  // Concluídas vão para o fim — foco no que falta. Urgentes vão para o topo.
  const tasks = useMemo(() => {
    const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const filtered = hideDone ? rawTasks.filter((t) => t.status !== 'done') : rawTasks;
    return [...filtered].sort((a, b) => {
      const doneDiff = Number(a.status === 'done') - Number(b.status === 'done');
      if (doneDiff !== 0) return doneDiff;
      return (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
    });
  }, [rawTasks, hideDone]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [], in_progress: [], in_review: [], done: [],
    };
    rawTasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [rawTasks]);

  const currentProject = projects.find((p) => p.id === projectFilter);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const setProjectFilter = (val: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('project', val); else next.delete('project');
    next.delete('area'); // reset área ao mudar de projeto
    setSearchParams(next, { replace: true });
  };

  const setAreaFilter = (val: string | null) => updateParam('area', val);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const t = rawTasks.find((x) => x.id === taskId);
    if (!t || t.status === status) return;
    await updateTask.mutateAsync({ id: taskId, patch: { status } });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          {currentProject && (
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentProject.color }}
              />
              <h2 className="text-lg font-semibold">{currentProject.name}</h2>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {currentProject ? 'Tarefas deste projeto' : 'Todas as tarefas da sua organização'}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 h-9"
          />
        </div>

        <Select
          value={projectFilter ?? 'all'}
          onValueChange={(v) => setProjectFilter(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <FolderOpen className="w-4 h-4 mr-1" />
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
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

        {viewMode !== 'kanban' && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px] h-9">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHideDone((v) => !v)}
          className="h-9 text-xs text-muted-foreground"
          title={hideDone ? 'Mostrar tarefas concluídas' : 'Ocultar tarefas concluídas'}
        >
          {hideDone ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
          {hideDone ? 'Mostrar concluídas' : 'Ocultar concluídas'}
        </Button>
      </div>

      {/* Areas bar — visível quando há um projeto selecionado */}
      {projectFilter && (
        <div className="mb-4">
          <ProjectAreasBar
            projectId={projectFilter}
            selectedAreaId={areaFilter}
            onSelect={setAreaFilter}
          />
        </div>
      )}

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="list"><LayoutList className="w-4 h-4 mr-1" />Lista</TabsTrigger>
          <TabsTrigger value="kanban"><Kanban className="w-4 h-4 mr-1" />Kanban</TabsTrigger>
          <TabsTrigger value="mine"><User className="w-4 h-4 mr-1" />Minhas</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            currentProject ? (
              <ProjectEmptyState
                projectName={currentProject.name}
                projectColor={currentProject.color}
                onCreate={() => setFormOpen(true)}
              />
            ) : (
              <EmptyState onCreate={() => setFormOpen(true)} />
            )
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => setDetailTaskId(t.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 h-full">
              {TASK_STATUS_ORDER.map((status) => (
                <div
                  key={status}
                  className="bg-muted/30 rounded-lg p-2 flex flex-col min-h-[200px]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  <div className="flex items-center justify-between px-2 py-1 mb-2">
                    <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
                    <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                      {tasksByStatus[status].length}
                    </span>
                  </div>
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {tasksByStatus[status].map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                      >
                        <TaskCard task={t} onClick={() => setDetailTaskId(t.id)} compact />
                      </div>
                    ))}
                    {tasksByStatus[status].length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8 px-2">
                        Arraste tarefas aqui
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4 flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <Card className="p-12 text-center">
              <User className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída a você</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => setDetailTaskId(t.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultProjectId={projectFilter}
      />
      <TaskDetailDialog
        taskId={detailTaskId}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-12 text-center">
      <LayoutList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
      <h3 className="font-semibold mb-1">Nenhuma tarefa ainda</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Crie sua primeira tarefa para começar
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        Criar Tarefa
      </Button>
    </Card>
  );
}

function ProjectEmptyState({
  projectName, projectColor, onCreate,
}: { projectName: string; projectColor: string; onCreate: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div
        className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: `${projectColor}20` }}
      >
        <FolderPlus className="w-7 h-7" style={{ color: projectColor }} />
      </div>
      <h3 className="font-semibold mb-1">
        Nenhuma tarefa em <span style={{ color: projectColor }}>{projectName}</span> ainda
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Crie a primeira tarefa deste projeto para começar a organizar o trabalho.
      </p>
      <Button onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        Criar tarefa neste projeto
      </Button>
    </Card>
  );
}
