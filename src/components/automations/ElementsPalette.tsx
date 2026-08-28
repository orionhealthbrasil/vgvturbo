import { Zap, MessageSquare, Clock, Tag, GitBranch, ArrowRightLeft, Webhook, UserPlus, MessageCircle, Link, Save, Star, Bot, Brain, CalendarClock, TrendingUp, DollarSign, Trophy, Mail, Sparkles, CheckSquare, BellRing } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface PaletteItem {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: 'trigger' | 'action' | 'logic';
}

const paletteItems: PaletteItem[] = [
  // Triggers
  {
    type: 'trigger',
    label: 'Gatilho',
    description: 'Inicia a automação',
    icon: <Zap className="w-4 h-4" />,
    color: 'bg-emerald-500',
    category: 'trigger',
  },
  // Logic
  {
    type: 'condition',
    label: 'Condição',
    description: 'Ramifica o fluxo',
    icon: <GitBranch className="w-4 h-4" />,
    color: 'bg-orange-500',
    category: 'logic',
  },
  // Actions
  {
    type: 'sendMessage',
    label: 'Enviar Mensagem',
    description: 'Envia texto ou mídia',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'bg-blue-500',
    category: 'action',
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Aguarda um tempo',
    icon: <Clock className="w-4 h-4" />,
    color: 'bg-amber-500',
    category: 'action',
  },
  {
    type: 'manageTag',
    label: 'Gerenciar Tag',
    description: 'Adiciona ou remove tag',
    icon: <Tag className="w-4 h-4" />,
    color: 'bg-purple-500',
    category: 'action',
  },
  {
    type: 'moveColumn',
    label: 'Mover no Kanban',
    description: 'Move para outra coluna',
    icon: <ArrowRightLeft className="w-4 h-4" />,
    color: 'bg-cyan-500',
    category: 'action',
  },
  {
    type: 'assign',
    label: 'Atribuir Conversa',
    description: 'Atribui a um membro',
    icon: <UserPlus className="w-4 h-4" />,
    color: 'bg-indigo-500',
    category: 'action',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    description: 'Chama API externa',
    icon: <Webhook className="w-4 h-4" />,
    color: 'bg-pink-500',
    category: 'action',
  },
  {
    type: 'waitResponse',
    label: 'Aguardar Resposta',
    description: 'Espera resposta do usuário',
    icon: <MessageCircle className="w-4 h-4" />,
    color: 'bg-teal-500',
    category: 'logic',
  },
  {
    type: 'connectFlow',
    label: 'Conectar Fluxo',
    description: 'Redireciona para outro fluxo',
    icon: <Link className="w-4 h-4" />,
    color: 'bg-violet-500',
    category: 'action',
  },
  {
    type: 'saveResponse',
    label: 'Salvar Resposta',
    description: 'Aguarda e salva resposta em variável',
    icon: <Save className="w-4 h-4" />,
    color: 'bg-rose-500',
    category: 'logic',
  },
  {
    type: 'sendSurvey',
    label: 'Pesquisa de Satisfação',
    description: 'Envia link de avaliação',
    icon: <Star className="w-4 h-4" />,
    color: 'bg-yellow-500',
    category: 'action',
  },
  {
    type: 'toggleAi',
    label: 'IA do Contato',
    description: 'Ativa ou desativa IA',
    icon: <Bot className="w-4 h-4" />,
    color: 'bg-violet-500',
    category: 'action',
  },
  {
    type: 'analyzeConversation',
    label: 'Analisar Conversa',
    description: 'IA analisa e executa ações',
    icon: <Brain className="w-4 h-4" />,
    color: 'bg-fuchsia-500',
    category: 'action',
  },
  {
    type: 'triggerSdr',
    label: 'Acionar SDR',
    description: 'IA envia mensagem proativa',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'bg-pink-500',
    category: 'action',
  },
  {
    type: 'scheduleMessage',
    label: 'Agendar Mensagem',
    description: 'Agenda para N dias úteis',
    icon: <CalendarClock className="w-4 h-4" />,
    color: 'bg-sky-500',
    category: 'action',
  },
  {
    type: 'moveFunnelStage',
    label: 'Mover Etapa do Funil',
    description: 'Move o contato para outra etapa',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'bg-emerald-500',
    category: 'action',
  },
  {
    type: 'setDealValue',
    label: 'Definir Valor Potencial',
    description: 'Atualiza o valor do negócio',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'bg-emerald-600',
    category: 'action',
  },
  {
    type: 'setSaleResult',
    label: 'Marcar Resultado',
    description: 'Define ganho ou perdido',
    icon: <Trophy className="w-4 h-4" />,
    color: 'bg-amber-500',
    category: 'action',
  },
  {
    type: 'sendEmail',
    label: 'Enviar Email',
    description: 'Envia email via Resend',
    icon: <Mail className="w-4 h-4" />,
    color: 'bg-indigo-500',
    category: 'action',
  },
  {
    type: 'createTask',
    label: 'Criar Tarefa',
    description: 'Cria tarefa vinculada ao contato',
    icon: <CheckSquare className="w-4 h-4" />,
    color: 'bg-lime-600',
    category: 'action',
  },
  {
    type: 'notify_manager',
    label: 'Notificar Gestor',
    description: 'IA avisa o gestor via WhatsApp',
    icon: <BellRing className="w-4 h-4" />,
    color: 'bg-amber-500',
    category: 'action',
  },
];

interface ElementsPaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

export function ElementsPalette({ onDragStart }: ElementsPaletteProps) {
  const triggers = paletteItems.filter((i) => i.category === 'trigger');
  const logic = paletteItems.filter((i) => i.category === 'logic');
  const actions = paletteItems.filter((i) => i.category === 'action');

  const renderItem = (item: PaletteItem) => (
    <div
      key={item.type}
      draggable
      onDragStart={(e) => onDragStart(e, item.type)}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing hover:bg-accent transition-colors"
    >
      <div className={`p-2 rounded-lg ${item.color} text-white`}>
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );

  return (
    <Card className="h-full border-r rounded-none flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-semibold">Elementos</CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4 pb-6">
          {/* Triggers */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gatilhos</p>
            {triggers.map(renderItem)}
          </div>

          <Separator />

          {/* Logic */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lógica</p>
            {logic.map(renderItem)}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</p>
            {actions.map(renderItem)}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
