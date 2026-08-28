import { useState } from 'react';
import { Bot, Plus, Eye, EyeOff, Save, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentCard } from '@/components/squad-ai/AgentCard';
import { AgentFormDialog } from '@/components/squad-ai/AgentFormDialog';
import { SystemAgentChat } from '@/components/squad-ai/SystemAgentChat';
import { useAiAgents, useOrgOpenAiKey, useUpdateOrgOpenAiKey, AiAgent } from '@/hooks/useAiAgents';
import { useUserOrganization } from '@/hooks/useOrganization';

export default function SquadAI() {
  const { data: agents, isLoading } = useAiAgents();
  const { data: apiKey, isLoading: isLoadingKey } = useOrgOpenAiKey();
  const updateKey = useUpdateOrgOpenAiKey();
  const { data: orgData } = useUserOrganization();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [localKey, setLocalKey] = useState<string | null>(null);
  const [chattingAgent, setChattingAgent] = useState<AiAgent | null>(null);

  const isOwner = orgData?.membership.role === 'owner';
  const persistedKey = apiKey || '';
  const displayKey = localKey !== null ? localKey : persistedKey;
  const hasUnsavedChanges = localKey !== null && localKey !== persistedKey;

  const handleSaveKey = () => {
    updateKey.mutate(displayKey || null, {
      onSuccess: () => setLocalKey(null),
    });
  };

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

      {/* Shared API Key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Chave da OpenAI (compartilhada)</CardTitle>
          <CardDescription className="text-xs">
            {isOwner
              ? 'Todos os agentes usam esta chave para chamadas à API. O status abaixo reflete o valor salvo no backend.'
              : 'Todos os agentes usam esta chave para chamadas à API. Apenas o proprietário da organização pode alterar esse valor.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingKey ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={displayKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="sk-..."
                  className="font-mono text-sm"
                  disabled={!isOwner}
                />
                <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveKey}
                  disabled={updateKey.isPending || !hasUnsavedChanges || !isOwner}
                >
                  {updateKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {!isOwner
                  ? 'Somente o proprietário da organização pode salvar ou remover a chave compartilhada.'
                  : hasUnsavedChanges
                    ? 'Há alterações não salvas nesta chave.'
                    : persistedKey
                      ? 'Chave salva e confirmada no backend da organização.'
                      : 'Nenhuma chave compartilhada salva para esta organização.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
