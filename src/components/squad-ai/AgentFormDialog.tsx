import { useState, useEffect } from 'react';
import { Bot, Save, Loader2, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AiAgent, useCreateAiAgent, useUpdateAiAgent, AVAILABLE_AGENT_TOOLS } from '@/hooks/useAiAgents';
import { useAutomations } from '@/hooks/useAutomations';
import { TrainingTab } from './TrainingTab';

const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `# Identidade
Você é um(a) assistente virtual da empresa, atuando como agente de atendimento via WhatsApp. Seja cordial, prestativo(a) e profissional.

# Idioma e tom de voz
- Responda SEMPRE em Português do Brasil (Pt-Br).
- Tom: humano, próximo e educado. Evite frases longas, jargões ou linguagem robótica.
- Use no máximo 2-3 frases curtas por mensagem. Formatação amigável para WhatsApp (sem markdown pesado).

# Fontes de verdade
- Use as informações de "Sobre a empresa" e "FAQ" como suas únicas fontes oficiais.
- Se a resposta NÃO estiver nas fontes acima, NUNCA invente. Diga que vai verificar com um atendente humano.

# Mídia (imagens, áudios, vídeos)
- Quando o histórico contiver linhas como [Descrição da imagem]:, [Transcrição do áudio]: ou [Descrição do vídeo]:, você DEVE citar literalmente esse conteúdo na sua resposta, pois ele não fica em memória entre as próximas mensagens.

# Fora de escopo
- Pedidos de cancelamento, reclamações sérias, negociação de valores fora da tabela, ou qualquer assunto sensível: encaminhe educadamente para um atendente humano.

# Objetivo
- Qualificar o lead, responder dúvidas comuns e conduzir a conversa até um próximo passo claro (agendamento, envio de proposta ou transferência para humano).
`;



interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AiAgent | null;
}

export function AgentFormDialog({ open, onOpenChange, agent }: AgentFormDialogProps) {
  const createAgent = useCreateAiAgent();
  const updateAgent = useUpdateAiAgent();
  const { data: automations } = useAutomations();
  const isEditing = !!agent;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('conversational');
  const [department, setDepartment] = useState('Vendas');
  const [model, setModel] = useState('gpt-4o-mini');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT_TEMPLATE);
  const [faqContent, setFaqContent] = useState('');
  const [aboutCompany, setAboutCompany] = useState('');
  const [maxContext, setMaxContext] = useState(20);
  const [pauseOnHuman, setPauseOnHuman] = useState(true);
  const [splitLong, setSplitLong] = useState(true);
  const [splitTargetChars, setSplitTargetChars] = useState(350);
  const [splitMaxParts, setSplitMaxParts] = useState(3);
  const [splitDelayMs, setSplitDelayMs] = useState(1200);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [isSquadMember, setIsSquadMember] = useState(false);
  const [isFollowup, setIsFollowup] = useState(false);
  const [inactivityTriggerHours, setInactivityTriggerHours] = useState<number>(24);
  const [maxFollowupAttempts, setMaxFollowupAttempts] = useState<number>(3);
  const [followupExhaustedAutomationId, setFollowupExhaustedAutomationId] = useState<string>('');

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setCategory(agent.category);
      setDepartment(agent.department || 'Vendas');
      setModel(agent.model);
      setSystemPrompt(agent.system_prompt);
      setFaqContent(agent.faq_content || '');
      setAboutCompany(agent.about_company || '');
      setMaxContext(agent.max_context_messages);
      setPauseOnHuman(agent.pause_on_human_reply);
      setSplitLong(agent.split_long_messages ?? true);
      setSplitTargetChars(agent.split_target_chars ?? 350);
      setSplitMaxParts(agent.split_max_parts ?? 3);
      setSplitDelayMs(agent.split_delay_ms ?? 1200);
      setEnabledTools(agent.enabled_tools || []);
      setIsSquadMember(agent.is_squad_member ?? false);
      setIsFollowup(agent.is_followup ?? false);
      setInactivityTriggerHours(agent.inactivity_trigger_hours ?? 24);
      setMaxFollowupAttempts(agent.max_followup_attempts ?? 3);
      setFollowupExhaustedAutomationId(agent.followup_exhausted_automation_id ?? '');
    } else {
      setName('');
      setDescription('');
      setCategory('conversational');
      setDepartment('Vendas');
      setModel('gpt-4o-mini');
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT_TEMPLATE);
      setFaqContent('');
      setAboutCompany('');
      setMaxContext(20);
      setPauseOnHuman(true);
      setSplitLong(true);
      setSplitTargetChars(350);
      setSplitMaxParts(3);
      setSplitDelayMs(1200);
      setEnabledTools([]);
      setIsSquadMember(false);
      setIsFollowup(false);
      setInactivityTriggerHours(24);
      setMaxFollowupAttempts(3);
      setFollowupExhaustedAutomationId('');
    }
  }, [agent, open]);

  const isPending = createAgent.isPending || updateAgent.isPending;

  const toggleTool = (toolName: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      department: department.trim() || 'Vendas',
      model,
      system_prompt: systemPrompt,
      faq_content: faqContent.trim() || null,
      about_company: aboutCompany.trim() || null,
      max_context_messages: maxContext,
      pause_on_human_reply: pauseOnHuman,
      split_long_messages: splitLong,
      split_target_chars: Math.max(120, Math.min(800, splitTargetChars || 350)),
      split_max_parts: Math.max(1, Math.min(5, splitMaxParts || 3)),
      split_delay_ms: Math.max(0, Math.min(8000, splitDelayMs || 1200)),
      is_sdr: category === 'sdr',
      enabled_tools: enabledTools,
      is_squad_member: isSquadMember,
      is_followup: category === 'sdr' ? isFollowup : false,
      inactivity_trigger_hours: category === 'sdr' && isFollowup ? Math.max(1, inactivityTriggerHours) : null,
      max_followup_attempts: category === 'sdr' && isFollowup ? Math.max(1, maxFollowupAttempts) : null,
      followup_exhausted_automation_id: category === 'sdr' && isFollowup && followupExhaustedAutomationId
        ? followupExhaustedAutomationId
        : null,
    };

    if (isEditing) {
      updateAgent.mutate({ id: agent!.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createAgent.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {isEditing ? 'Editar Agente' : 'Novo Agente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edite as configurações deste agente de IA.' : 'Configure um novo agente de IA para seu time.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="flex flex-col flex-1 min-h-0 mt-2">
          <TabsList className="shrink-0 w-full grid grid-cols-2">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="training" disabled={!isEditing}>
              Treinamento{!isEditing && ' (salve o agente primeiro)'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="flex-1 min-h-0 overflow-y-auto mt-4 px-1">
            {isEditing && agent?.id && <TrainingTab agentId={agent.id} />}
          </TabsContent>

          <TabsContent value="config" className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nome do Agente *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Maria" />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex: Vendas" />
              <p className="text-[11px] text-muted-foreground">Aparece como "Nome | Setor" nas mensagens</p>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversational">Conversacional</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="sdr">SDR / Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do agente" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Máx. turnos lembrados</Label>
              <Input type="number" min={1} max={100} value={maxContext} onChange={(e) => setMaxContext(Number(e.target.value))} />
              <p className="text-[11px] text-muted-foreground">Pares pergunta-resposta mantidos. Turnos antigos são resumidos automaticamente.</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Pausar quando humano responder</Label>
              <p className="text-xs text-muted-foreground">Desativa a IA quando um atendente envia mensagem</p>
            </div>
            <Switch checked={pauseOnHuman} onCheckedChange={setPauseOnHuman} />
          </div>

          {category === 'sdr' && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Ativação por inatividade (Follow-up)</Label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Ativar automaticamente por tempo sem resposta</Label>
                    <p className="text-xs text-muted-foreground">O agente dispara sozinho quando o lead fica X horas sem responder</p>
                  </div>
                  <Switch checked={isFollowup} onCheckedChange={setIsFollowup} />
                </div>

                {isFollowup && (
                  <div className="space-y-4 pl-1 border-l-2 border-muted ml-1">
                    <div className="grid grid-cols-2 gap-4 pl-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Horas sem resposta para disparar</Label>
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          value={inactivityTriggerHours}
                          onChange={(e) => setInactivityTriggerHours(Number(e.target.value))}
                        />
                        <p className="text-[11px] text-muted-foreground">Ex: 24 = dispara após 1 dia sem resposta</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Máximo de tentativas</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={maxFollowupAttempts}
                          onChange={(e) => setMaxFollowupAttempts(Number(e.target.value))}
                        />
                        <p className="text-[11px] text-muted-foreground">Após atingir o limite, a automação abaixo é disparada</p>
                      </div>
                    </div>

                    <div className="space-y-1 pl-3">
                      <Label className="text-xs">Automação ao esgotar tentativas</Label>
                      <Select
                        value={followupExhaustedAutomationId || 'none'}
                        onValueChange={(v) => setFollowupExhaustedAutomationId(v === 'none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar automação..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma (encerra silenciosamente)</SelectItem>
                          {(automations || []).filter(a => a.is_active).map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Use esta automação para arquivar o lead, notificar um humano ou mudar etapa do funil
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {category === 'conversational' && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Participa do Squad (handoff automático)</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando 2+ agentes estiverem marcados, um roteador decide automaticamente qual agente responde cada mensagem, podendo trocar durante a conversa.
                  </p>
                </div>
                <Switch checked={isSquadMember} onCheckedChange={setIsSquadMember} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Ferramentas habilitadas</Label>
                <p className="text-xs text-muted-foreground">
                  Nenhuma marcada = todas habilitadas (padrão). Marque para restringir este agente só ao necessário e reduzir custo por mensagem.
                </p>
                <ScrollArea className="h-48 border rounded-md p-2">
                  <div className="space-y-1">
                    {AVAILABLE_AGENT_TOOLS.map((tool) => {
                      const isSelected = enabledTools.includes(tool.name);
                      return (
                        <button
                          key={tool.name}
                          type="button"
                          onClick={() => toggleTool(tool.name)}
                          className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left ${
                            isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
                          }`}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <span className="text-sm flex-1 truncate">{tool.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                {enabledTools.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {enabledTools.length} de {AVAILABLE_AGENT_TOOLS.length} ferramentas selecionadas. Transferência por automação continua sempre disponível.
                  </p>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Dividir respostas longas em várias mensagens</Label>
                <p className="text-xs text-muted-foreground">Faz a IA quebrar blocos longos em mensagens curtas, como uma pessoa digitando.</p>
              </div>
              <Switch checked={splitLong} onCheckedChange={setSplitLong} />
            </div>

            {splitLong && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Tamanho-alvo (chars)</Label>
                  <Input type="number" min={120} max={800} value={splitTargetChars} onChange={(e) => setSplitTargetChars(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máx. partes</Label>
                  <Input type="number" min={1} max={5} value={splitMaxParts} onChange={(e) => setSplitMaxParts(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Delay entre partes (ms)</Label>
                  <Input type="number" min={0} max={8000} step={100} value={splitDelayMs} onChange={(e) => setSplitDelayMs(Number(e.target.value))} />
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instruções principais da IA..."
              className="min-h-[100px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Sobre a empresa</Label>
            <Textarea
              value={aboutCompany}
              onChange={(e) => setAboutCompany(e.target.value)}
              placeholder="Informações sobre a empresa..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>FAQ</Label>
            <Textarea
              value={faqContent}
              onChange={(e) => setFaqContent(e.target.value)}
              placeholder="P: Pergunta?&#10;R: Resposta."
              className="min-h-[100px]"
            />
          </div>

          <Button onClick={handleSave} disabled={isPending || !name.trim()} className="w-full">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Agente'}
          </Button>
        </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
