import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoals, useDeleteGoal, useArchiveGoal } from '@/hooks/useGoals';
import { useUserOrganization } from '@/hooks/useOrganization';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalFormDialog } from '@/components/goals/GoalFormDialog';
import { GoalDetailDialog } from '@/components/goals/GoalDetailDialog';
import type { Goal, GoalStatus } from '@/types/goals';
import { toast } from 'sonner';

export default function Goals() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<GoalStatus>('active');
  const { data: orgData } = useUserOrganization();
  const role = orgData?.membership.role;
  const memberRole = orgData?.membership.member_role;
  const canManage = role === 'owner' || role === 'admin' || memberRole === 'admin';

  const { data: goals = [], isLoading } = useGoals(tab);
  const deleteGoal = useDeleteGoal();
  const archiveGoal = useArchiveGoal();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const g = params.get('goal');
    if (g) setDetailId(g);
  }, [params]);

  const closeDetail = (open: boolean) => {
    if (!open) {
      setDetailId(null);
      if (params.get('goal')) {
        params.delete('goal');
        setParams(params, { replace: true });
      }
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground">Defina objetivos e acompanhe o progresso da equipe em tempo real</p>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova meta
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as GoalStatus)}>
        <TabsList>
          <TabsTrigger value="active">Ativas</TabsTrigger>
          <TabsTrigger value="completed">Concluídas</TabsTrigger>
          <TabsTrigger value="archived">Arquivadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma meta {tab === 'active' ? 'ativa' : tab === 'completed' ? 'concluída' : 'arquivada'}.</p>
              {canManage && tab === 'active' && (
                <Button variant="outline" className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira meta
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  canManage={canManage}
                  onOpen={() => setDetailId(g.id)}
                  onEdit={() => { setEditing(g); setFormOpen(true); }}
                  onDelete={async () => {
                    try { await deleteGoal.mutateAsync(g.id); toast.success('Meta excluída'); }
                    catch (e: any) { toast.error(e?.message || 'Erro ao excluir'); }
                  }}
                  onArchive={async () => {
                    const newStatus: GoalStatus = g.status === 'archived' ? 'active' : 'archived';
                    try { await archiveGoal.mutateAsync({ id: g.id, status: newStatus }); toast.success(newStatus === 'archived' ? 'Arquivada' : 'Reativada'); }
                    catch (e: any) { toast.error(e?.message || 'Erro'); }
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GoalFormDialog open={formOpen} onOpenChange={setFormOpen} goal={editing} />
      <GoalDetailDialog goalId={detailId} onOpenChange={closeDetail} />
    </div>
  );
}
