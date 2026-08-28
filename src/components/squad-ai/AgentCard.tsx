import { Bot, Pencil, Trash2, MessageCircle, Cpu, MessageSquare, Users, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AiAgent, useUpdateAiAgent, useDeleteAiAgent } from '@/hooks/useAiAgents';

interface AgentCardProps {
  agent: AiAgent;
  onEdit: (agent: AiAgent) => void;
  onChat?: (agent: AiAgent) => void;
}

export function AgentCard({ agent, onEdit, onChat }: AgentCardProps) {
  const updateAgent = useUpdateAiAgent();
  const deleteAgent = useDeleteAiAgent();

  return (
    <Card className="group relative">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${agent.is_active ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
              {agent.description && (
                <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
              )}
            </div>
          </div>
          <Switch
            checked={agent.is_active}
            onCheckedChange={(checked) => updateAgent.mutate({ id: agent.id, is_active: checked })}
          />
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {agent.category === 'conversational' ? (
              <><MessageCircle className="w-3 h-3 mr-1" />Conversacional</>
            ) : (
              <><Cpu className="w-3 h-3 mr-1" />Sistema</>
            )}
          </Badge>
          <Badge variant="secondary" className="text-xs">{agent.model}</Badge>
          {agent.is_squad_member && (
            <Badge variant="outline" className="text-xs border-violet-400 text-violet-600">
              <Users className="w-3 h-3 mr-1" />Squad
            </Badge>
          )}
          {agent.enabled_tools?.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <Wrench className="w-3 h-3 mr-1" />{agent.enabled_tools.length} tools
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {agent.system_prompt}
        </p>

        <div className="flex items-center gap-1 mt-3 pt-3 border-t">
          {agent.category === 'system' && onChat && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChat(agent)}>
              <MessageSquare className="w-3.5 h-3.5 mr-1" />Conversar
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit(agent)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm('Remover este agente?')) deleteAgent.mutate(agent.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
