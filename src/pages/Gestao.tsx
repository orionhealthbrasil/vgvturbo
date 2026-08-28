import { useSearchParams } from 'react-router-dom';
import { ListChecks, FolderOpen, Target } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserPermissions } from '@/hooks/usePermissions';
import Tasks from '@/pages/Tasks';
import Projects from '@/pages/Projects';
import Goals from '@/pages/Goals';

type View = 'tarefas' | 'projetos' | 'metas';

export default function Gestao() {
  const [params, setParams] = useSearchParams();
  const { permissions, isOwner } = useUserPermissions();

  const can = (p: 'tasks' | 'projects' | 'goals') =>
    isOwner || permissions[p]?.canView;

  const tabs: { value: View; label: string; icon: typeof ListChecks; allowed: boolean }[] = [
    { value: 'projetos', label: 'Projetos', icon: FolderOpen, allowed: !!can('projects') },
    { value: 'tarefas', label: 'Tarefas', icon: ListChecks, allowed: !!can('tasks') },
    { value: 'metas', label: 'Metas', icon: Target, allowed: !!can('goals') },
  ];
  const visibleTabs = tabs.filter((t) => t.allowed);
  const requested = (params.get('view') as View | null) ?? null;
  const current: View = visibleTabs.find((t) => t.value === requested)?.value
    ?? visibleTabs[0]?.value
    ?? 'tarefas';

  const handleChange = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('view', v);
    // Limpa filtros específicos da view "tarefas" ao trocar para outra
    if (v !== 'tarefas') {
      next.delete('project');
      next.delete('area');
      next.delete('task');
    }
    setParams(next, { replace: true });
  };

  if (visibleTabs.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Você não tem acesso a nenhum módulo de gestão.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-bold">Gestão</h1>
        <p className="text-sm text-muted-foreground">
          Tarefas, projetos e metas da sua equipe em um só lugar.
        </p>
      </div>

      <Tabs value={current} onValueChange={handleChange} className="flex-1 flex flex-col">
        <div className="px-6 pt-4">
          <TabsList>
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2">
                <t.icon className="w-4 h-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {visibleTabs.some((t) => t.value === 'tarefas') && (
          <TabsContent value="tarefas" className="flex-1 mt-0 data-[state=inactive]:hidden">
            <Tasks />
          </TabsContent>
        )}
        {visibleTabs.some((t) => t.value === 'projetos') && (
          <TabsContent value="projetos" className="flex-1 mt-0 data-[state=inactive]:hidden">
            <Projects />
          </TabsContent>
        )}
        {visibleTabs.some((t) => t.value === 'metas') && (
          <TabsContent value="metas" className="flex-1 mt-0 data-[state=inactive]:hidden">
            <Goals />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
