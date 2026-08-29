import { useState } from 'react';
import { Bot, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentCard } from '@/components/squad-ai/AgentCard';
import { AgentFormDialog } from '@/components/squad-ai/AgentFormDialog';
import { SystemAgentChat } from '@/components/squad-ai/SystemAgentChat';
import { useAiAgents, AiAgent } from '@/hooks/useAiAgents';
import { OrionCashPanel } from '@/components/orioncash/OrionCashPanel';

export default function SquadAI() {
  const { data: agents, isLoading } = useAiAgents();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [chattingAgent, setChattingAgent] = useState<AiAgent | null>(null);

  const handleEdit = (agent: AiAgent) => {
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const handleChat = (agent: AiAgent) => {
    setChattingAgent(agent);
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Squad AI</h1>
            <p className="text-sm text-muted-foreground">Gerencie seu time de agentes de IA</p>
          </div>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />Novo Agente
        </Button>
      </div>

      {/* VGVCash */}
      <OrionCashPanel />

      {/* System Agent Chat */}
      {chattingAgent && (
        <SystemAgentChat
          agent={chattingAgent}
          onClose={() => setChattingAgent(null)}
        />
      )}

      {/* Agents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : agents && agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onEdit={handleEdit} onChat={handleChat} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Nenhum agente criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro agente de IA para começar a automatizar atendimentos.
            </p>
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />Criar Agente
            </Button>
          </CardContent>
        </Card>
      )}

      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editingAgent}
      />
    </div>
  );
}
