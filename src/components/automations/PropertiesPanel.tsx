import { useRef, useState, useCallback } from 'react';
import { Node } from '@xyflow/react';
import { X, Variable, Trash2, Copy, Mail, AlertCircle, Upload, ImageIcon, Video, XCircle, Loader2 } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TriggerNodeData } from './nodes/TriggerNode';
import { PURCHASE_EVENT_LABELS } from './nodes/TriggerNode';
import type { SendMessageNodeData } from './nodes/SendMessageNode';
import type { DelayNodeData } from './nodes/DelayNode';
import type { ManageTagNodeData } from './nodes/ManageTagNode';
import type { ConditionNodeData } from './nodes/ConditionNode';
import type { MoveColumnNodeData } from './nodes/MoveColumnNode';
import type { WebhookNodeData } from './nodes/WebhookNode';
import type { AssignNodeData } from './nodes/AssignNode';
import type { WaitResponseNodeData } from './nodes/WaitResponseNode';
import type { ConnectFlowNodeData } from './nodes/ConnectFlowNode';
import type { ToggleAiNodeData } from './nodes/ToggleAiNode';
import type { AnalyzeConversationNodeData } from './nodes/AnalyzeConversationNode';
import type { ScheduleMessageNodeData } from './nodes/ScheduleMessageNode';
import { supabase } from '@/integrations/supabase/client';
import { useAutomations } from '@/hooks/useAutomations';
import { useLeadForms } from '@/hooks/useLeadForms';
import { useLossReasons } from '@/hooks/useLossReasons';
import { useWinReasons } from '@/hooks/useWinReasons';
import { useEmailSettings } from '@/hooks/useEmailSettings';
import type { SendEmailNodeData } from './nodes/SendEmailNode';
import type { TriggerSdrNodeData } from './nodes/TriggerSdrNode';
import { useAiAgents } from '@/hooks/useAiAgents';
import { useTags } from '@/hooks/useTags';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useKanbanPipelines } from '@/hooks/useKanbanPipelines';
import { useCalendars } from '@/hooks/useCalendars';
import { usePaymentIntegrations } from '@/hooks/usePaymentIntegrations';
import { useAllKanbanColumns, usePipelines, useKanbanColumnsByPipeline } from '@/hooks/useCRM';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import { useCustomFieldNames } from '@/hooks/useCustomFields';
import { useProjects } from '@/hooks/useProjects';
import { useProjectAreas } from '@/hooks/useProjectAreas';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface Variable {
  key: string;
  label: string;
  description: string;
}

const availableVariables: Variable[] = [
  { key: '{nome}', label: 'Nome', description: 'Nome do contato' },
  { key: '{telefone}', label: 'Telefone', description: 'Número de telefone' },
  { key: '{email}', label: 'E-mail', description: 'E-mail do contato' },
  { key: '{primeiro_nome}', label: 'Primeiro Nome', description: 'Primeiro nome do contato' },
  { key: '{data_atual}', label: 'Data Atual', description: 'Data de hoje (DD/MM/AAAA)' },
  { key: '{hora_atual}', label: 'Hora Atual', description: 'Hora atual (HH:MM)' },
  { key: '{dia_semana}', label: 'Dia da Semana', description: 'Ex: Segunda-feira' },
  { key: '{saudacao}', label: 'Saudação', description: 'Bom dia/Boa tarde/Boa noite' },
  { key: '{ultima_resposta}', label: 'Última Resposta', description: 'Conteúdo da resposta do nó Aguardar Resposta' },
  { key: '{proximo_feriado}', label: 'Próximo Feriado', description: 'Nome do próximo feriado' },
  { key: '{data_feriado}', label: 'Data do Feriado', description: 'Data do próximo feriado' },
  { key: '{data_retorno}', label: 'Data de Retorno', description: 'Data de retorno após feriado' },
];

interface PropertiesPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onClose: () => void;
}

export function PropertiesPanel({ selectedNode, onUpdateNode, onDeleteNode, onDuplicateNode, onClose }: PropertiesPanelProps) {
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: automations } = useAutomations();
  const { data: leadForms } = useLeadForms();
  const { data: tags } = useTags();
  const { data: funnelStages } = useFunnelStages();
  const { data: kanbanPipelines } = useKanbanPipelines();
  const { data: calendars } = useCalendars();
  const { data: paymentIntegrations } = usePaymentIntegrations();
  const { data: lossReasons } = useLossReasons({ activeOnly: true });
  const { data: winReasons } = useWinReasons({ activeOnly: true });
  const { data: kanbanColumns } = useAllKanbanColumns();
  const { data: pipelines } = usePipelines();
  const { data: members } = useOrganizationMembers();
  const { data: customFieldNames } = useCustomFieldNames();
  const { data: aiAgents } = useAiAgents();
  const { data: emailSettings } = useEmailSettings();
  const { data: projects } = useProjects();
  const selectedProjectId = selectedNode?.type === 'createTask'
    ? ((selectedNode.data as any)?.projectId as string | null | undefined)
    : null;
  const { data: projectAreas } = useProjectAreas(selectedProjectId);
  
  // Get selected pipeline ID for condition node
  const selectedPipelineId = selectedNode?.type === 'condition' 
    ? (selectedNode.data as any)?.pipelineId 
    : null;
  const { data: pipelineColumns } = useKanbanColumnsByPipeline(selectedPipelineId);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!selectedNode) return null;

  const handleChange = (key: string, value: unknown) => {
    onUpdateNode(selectedNode.id, { [key]: value });
  };

  const insertVariable = (variable: string, currentValue: string, key: string) => {
    const textarea = messageTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      handleChange(key, newValue);
      // Restore cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      handleChange(key, currentValue + variable);
    }
  };

  const VariablesPopover = ({ currentValue, fieldKey }: { currentValue: string; fieldKey: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Variable className="w-3 h-3" />
          Variáveis
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Clique para inserir
          </p>
          {availableVariables.map((v) => (
            <button
              key={v.key}
              onClick={() => insertVariable(v.key, currentValue, fieldKey)}
              className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{v.label}</p>
                <p className="text-xs text-muted-foreground">{v.description}</p>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {v.key}
              </Badge>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const renderTriggerProperties = () => {
    const data = selectedNode.data as unknown as TriggerNodeData;
    const allSorted = [...(funnelStages || [])].sort((a, b) => a.position - b.position);
    const sortedStages = data.pipelineId
      ? allSorted.filter((s) => s.pipeline_id === data.pipelineId)
      : allSorted;
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de Gatilho</Label>
          <Select
            value={data.triggerType || ''}
            onValueChange={(value) => handleChange('triggerType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o gatilho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="message_received">Mensagem Recebida</SelectItem>
              <SelectItem value="media_received">Mídia Recebida (Foto/Vídeo/Áudio)</SelectItem>
              <SelectItem value="tag_added">Tag Adicionada</SelectItem>
              <SelectItem value="keyword">Palavra-chave Específica</SelectItem>
              <SelectItem value="funnel_stage_change">Entrada em Etapa do Funil</SelectItem>
              <SelectItem value="funnel_stage_exit">Saída de Etapa do Funil</SelectItem>
              <SelectItem value="conversation_closed">Conversa Finalizada</SelectItem>
              <SelectItem value="deal_won">Negócio Ganho</SelectItem>
              <SelectItem value="deal_lost">Negócio Perdido</SelectItem>
              <SelectItem value="form_submitted">Formulário Enviado</SelectItem>
              <SelectItem value="booking_created">Agendamento Criado</SelectItem>
              <SelectItem value="booking_cancelled">Agendamento Cancelado</SelectItem>
              <SelectItem value="external_purchase">Compra Externa (Hotmart/Stripe/etc) 💳</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {data.triggerType === 'keyword' && (
          <>
            <div className="space-y-2">
              <Label>Tipo de Correspondência</Label>
              <Select
                value={data.keywordMatchType || 'contains'}
                onValueChange={(value) => handleChange('keywordMatchType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="exact">Igual (exata)</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                  <SelectItem value="ends_with">Termina com</SelectItem>
                  <SelectItem value="regex">Expressão Regular (Regex)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Palavra-chave</Label>
              <Input
                value={data.keyword || ''}
                onChange={(e) => handleChange('keyword', e.target.value)}
                placeholder={data.keywordMatchType === 'regex' ? 'Ex: ^(oi|olá)$' : 'Ex: oi, olá, bom dia'}
              />
              {data.keywordMatchType === 'regex' && (
                <p className="text-xs text-muted-foreground">
                  Use expressões regulares para correspondências avançadas
                </p>
              )}
            </div>
          </>
        )}
        {data.triggerType === 'tag_added' && (
          <div className="space-y-2">
            <Label>Tag</Label>
            <Select
              value={data.tagName || ''}
              onValueChange={(value) => handleChange('tagName', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma tag" />
              </SelectTrigger>
              <SelectContent>
                {(tags || []).map((tag) => (
                  <SelectItem key={tag.id} value={tag.name}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(data.triggerType === 'funnel_stage_change' || data.triggerType === 'funnel_stage_exit') && (
          <div className="space-y-2">
            <Label>Funil (opcional)</Label>
            <Select
              value={data.pipelineId || '__any__'}
              onValueChange={(value) =>
                handleChange('pipelineId', value === '__any__' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer funil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Qualquer funil</SelectItem>
                {(kanbanPipelines || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.is_default ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Limita o gatilho às etapas deste funil. Deixe em branco para considerar qualquer funil.
            </p>
          </div>
        )}
        {data.triggerType === 'funnel_stage_change' && (
          <div className="space-y-2">
            <Label>Etapa do Funil</Label>
            <Select
              value={data.funnelStageName || ''}
              onValueChange={(value) => handleChange('funnelStageName', value)}
              disabled={sortedStages.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={sortedStages.length === 0 ? 'Nenhuma etapa disponível' : 'Selecione a etapa'} />
              </SelectTrigger>
              <SelectContent>
                {sortedStages.length > 0 ? (
                  sortedStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                        {stage.is_final && <span className="text-xs text-muted-foreground">(Fechamento)</span>}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none__" disabled>
                    Nenhuma etapa configurada
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {sortedStages.length === 0 ? (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Este funil não tem etapas criadas. Vá até <strong>Funil → Configurar Funil</strong> para adicionar etapas antes de usar este gatilho.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                Dispara quando um contato entra nesta etapa do funil
              </p>
            )}
          </div>
        )}
        {data.triggerType === 'funnel_stage_exit' && (
          <div className="space-y-2">
            <Label>Etapa do Funil (sair)</Label>
            <Select
              value={data.funnelStageExitName || ''}
              onValueChange={(value) => handleChange('funnelStageExitName', value)}
              disabled={sortedStages.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={sortedStages.length === 0 ? 'Nenhuma etapa disponível' : 'Selecione a etapa'} />
              </SelectTrigger>
              <SelectContent>
                {sortedStages.length > 0 ? (
                  sortedStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.name}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none__" disabled>Nenhuma etapa configurada</SelectItem>
                )}
              </SelectContent>
            </Select>
            {sortedStages.length === 0 ? (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Este funil não tem etapas criadas. Vá até <strong>Funil → Configurar Funil</strong> para adicionar etapas antes de usar este gatilho.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                Dispara quando o contato sai desta etapa para qualquer outra
              </p>
            )}
          </div>
        )}
        {data.triggerType === 'media_received' && (
          <div className="space-y-2">
            <Label>Tipo de Mídia</Label>
            <Select
              value={data.mediaType || 'any_media'}
              onValueChange={(value) => handleChange('mediaType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any_media">Qualquer mídia</SelectItem>
                <SelectItem value="image">Foto / Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="audio">Áudio</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Dispara quando o contato envia uma mídia do tipo selecionado
            </p>
          </div>
        )}
        {(data.triggerType === 'deal_won' || data.triggerType === 'deal_lost') && (
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Select
              value={data.reasonFilter || '__any__'}
              onValueChange={(value) => handleChange('reasonFilter', value === '__any__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Qualquer motivo</SelectItem>
                {(data.triggerType === 'deal_won' ? (winReasons || []) : (lossReasons || [])).map((r) => (
                  <SelectItem key={r.id} value={r.label}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.triggerType === 'deal_won'
                ? 'Dispara apenas quando o motivo de ganho selecionado for registrado. Cadastre opções em Configurações → Análise de Ganhos.'
                : 'Dispara apenas quando o motivo de perda selecionado for registrado. Cadastre opções em Configurações → Análise de Perdas.'}
            </p>
          </div>
        )}
        {data.triggerType === 'form_submitted' && (
          <div className="space-y-2">
            <Label>Formulário (opcional)</Label>
            <Select
              value={(data as any).formId || '__any__'}
              onValueChange={(value) => handleChange('formId', value === '__any__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer formulário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Qualquer formulário</SelectItem>
                {(leadForms || []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Dispara quando uma submissão é recebida em um formulário público
            </p>
          </div>
        )}
        {(data.triggerType === 'booking_created' || data.triggerType === 'booking_cancelled') && (
          <div className="space-y-2">
            <Label>Calendário (opcional)</Label>
            <Select
              value={(data as any).calendarId || '__any__'}
              onValueChange={(value) => handleChange('calendarId', value === '__any__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer calendário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Qualquer calendário</SelectItem>
                {(calendars || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.triggerType === 'booking_created'
                ? 'Dispara quando um agendamento é criado neste calendário'
                : 'Dispara quando um agendamento é cancelado neste calendário'}
            </p>
          </div>
        )}
        {data.triggerType === 'external_purchase' && (
          <>
            <div className="space-y-2">
              <Label>Integração (opcional)</Label>
              <Select
                value={(data as any).paymentIntegrationId || '__any__'}
                onValueChange={(value) => handleChange('paymentIntegrationId', value === '__any__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer integração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Qualquer integração</SelectItem>
                  {(paymentIntegrations || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cadastre integrações em Configurações → Pagamentos (Webhooks)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Evento (opcional)</Label>
              <Select
                value={(data as any).purchaseEvent || '__any__'}
                onValueChange={(value) => handleChange('purchaseEvent', value === '__any__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Qualquer evento</SelectItem>
                  {Object.entries(PURCHASE_EVENT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dispara quando uma compra externa é recebida com este status. Use {'{produto}'}, {'{valor}'}, {'{plataforma}'} no texto da mensagem.
              </p>
            </div>
          </>
        )}
      </div>
    );
  };

  const [mediaUploading, setMediaUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleMediaUpload = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) return;

    setMediaUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `automations/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-media').upload(path, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
      handleChange('mediaUrl', pub.publicUrl);
      handleChange('mediaType', isVideo ? 'video' : 'image');
    } finally {
      setMediaUploading(false);
    }
  }, []);

  const renderSendMessageProperties = () => {
    const data = selectedNode.data as unknown as SendMessageNodeData;
    const isVideo = data.mediaType === 'video';
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mensagem</Label>
            <VariablesPopover currentValue={data.message || ''} fieldKey="message" />
          </div>
          <Textarea
            ref={messageTextareaRef}
            value={data.message || ''}
            onChange={(e) => handleChange('message', e.target.value)}
            placeholder="Digite a mensagem a ser enviada..."
            rows={5}
          />
          <div className="p-2 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Exemplo com variáveis:</p>
            <p className="text-xs font-mono">
              {'{saudacao}'}, {'{primeiro_nome}'}! 👋
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mídia (opcional)</Label>

          {data.mediaUrl ? (
            <div className="relative rounded-lg border bg-muted overflow-hidden">
              {isVideo ? (
                <video
                  src={data.mediaUrl}
                  className="w-full max-h-40 object-contain"
                  controls={false}
                />
              ) : (
                <img
                  src={data.mediaUrl}
                  alt="preview"
                  className="w-full max-h-40 object-contain"
                />
              )}
              <button
                type="button"
                onClick={() => { handleChange('mediaUrl', ''); handleChange('mediaType', undefined); }}
                className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 hover:bg-background transition-colors"
              >
                <XCircle className="w-4 h-4 text-destructive" />
              </button>
              <div className="px-2 py-1 flex items-center gap-1 text-xs text-muted-foreground border-t">
                {isVideo ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                {isVideo ? 'Vídeo' : 'Imagem'} anexada
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={mediaUploading}
              onClick={() => mediaInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 py-6 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              {mediaUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              <span className="text-xs">
                {mediaUploading ? 'Enviando...' : 'Clique para enviar foto ou vídeo'}
              </span>
            </button>
          )}

          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleMediaUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    );
  };

  const renderDelayProperties = () => {
    const data = selectedNode.data as unknown as DelayNodeData;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Duração</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={data.duration || ''}
              onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-24"
            />
            <Select
              value={data.unit || 'minutes'}
              onValueChange={(value) => handleChange('unit', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };

  const renderManageTagProperties = () => {
    const data = selectedNode.data as unknown as ManageTagNodeData;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Ação</Label>
          <Select
            value={data.action || 'add'}
            onValueChange={(value) => handleChange('action', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Adicionar Tag</SelectItem>
              <SelectItem value="remove">Remover Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tag</Label>
          <Select
            value={data.tagName || ''}
            onValueChange={(value) => handleChange('tagName', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma tag" />
            </SelectTrigger>
            <SelectContent>
              {tags && tags.length > 0 ? (
                tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  Nenhuma tag cadastrada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {(!tags || tags.length === 0) && (
            <p className="text-xs text-muted-foreground">
              Crie tags no menu Contatos para usá-las aqui
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderConditionProperties = () => {
    // Ensure we have safe access to node data
    if (!selectedNode?.data) {
      return (
        <div className="p-4 text-center text-muted-foreground text-sm">
          Carregando propriedades...
        </div>
      );
    }
    
    const data = (selectedNode.data || {}) as ConditionNodeData;
    const conditionSource = data?.conditionSource || 'message';
    const logicOperator = data?.logicOperator || 'single';
    const secondConditionSource = data?.secondConditionSource || 'message';
    
    // Safely get pipeline columns for second condition if needed
    const secondPipelineId = (selectedNode?.data as any)?.secondPipelineId || null;
    
    const renderConditionFields = (isSecond: boolean = false) => {
      const prefix = isSecond ? 'second' : '';
      const source = isSecond ? secondConditionSource : conditionSource;
      
      const getValue = (key: string) => {
        try {
          const fullKey = isSecond ? `second${key.charAt(0).toUpperCase() + key.slice(1)}` : key;
          return (data as any)?.[fullKey] ?? null;
        } catch {
          return null;
        }
      };
      
      const setValue = (key: string, value: unknown) => {
        const fullKey = isSecond ? `second${key.charAt(0).toUpperCase() + key.slice(1)}` : key;
        handleChange(fullKey, value);
      };
      
      return (
        <>
          {/* Source Selection */}
          <div className="space-y-2">
            <Label>{isSecond ? 'Segunda Condição' : 'O que verificar?'}</Label>
            <Select
              value={source}
              onValueChange={(value) => setValue('conditionSource', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Mensagem</SelectItem>
                <SelectItem value="tag">Tag do Contato</SelectItem>
                <SelectItem value="kanban">Coluna do Kanban</SelectItem>
                <SelectItem value="assigned_user">Usuário Atribuído</SelectItem>
                <SelectItem value="custom_field">Campo Personalizado</SelectItem>
                <SelectItem value="business_hours">Horário de Funcionamento</SelectItem>
                <SelectItem value="holiday">Feriado</SelectItem>
                <SelectItem value="media_type">Tipo de Mídia</SelectItem>
                <SelectItem value="ai_enabled">IA do Contato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message Condition Options */}
          {source === 'message' && (
            <>
              <div className="space-y-2">
                <Label>Tipo de Condição</Label>
                <Select
                  value={getValue('conditionType') || 'contains'}
                  onValueChange={(value) => setValue('conditionType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="equals">É igual a</SelectItem>
                    <SelectItem value="starts_with">Começa com</SelectItem>
                    <SelectItem value="ends_with">Termina com</SelectItem>
                    <SelectItem value="regex">Expressão Regular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  value={getValue('value') || ''}
                  onChange={(e) => setValue('value', e.target.value)}
                  placeholder="Texto a comparar..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${prefix}caseSensitive`}
                  checked={getValue('caseSensitive') || false}
                  onCheckedChange={(checked) => setValue('caseSensitive', checked)}
                />
                <Label htmlFor={`${prefix}caseSensitive`} className="text-sm font-normal">
                  Diferenciar maiúsculas/minúsculas
                </Label>
              </div>
            </>
          )}

          {/* Tag Condition Options */}
          {source === 'tag' && (
            <>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={getValue('tagCondition') || 'has_tag'}
                  onValueChange={(value) => setValue('tagCondition', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has_tag">Contato TEM a tag</SelectItem>
                    <SelectItem value="not_has_tag">Contato NÃO tem a tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select
                  value={getValue('tagName') || ''}
                  onValueChange={(value) => setValue('tagName', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags && tags.length > 0 ? (
                      tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        Nenhuma tag cadastrada
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Kanban Condition Options */}
          {source === 'kanban' && (
            <>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={getValue('kanbanCondition') || 'is_in_column'}
                  onValueChange={(value) => setValue('kanbanCondition', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is_in_column">Contato ESTÁ na coluna</SelectItem>
                    <SelectItem value="not_in_column">Contato NÃO está na coluna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Funil</Label>
                <Select
                  value={getValue('pipelineId') || ''}
                  onValueChange={(value) => {
                    const pipeline = pipelines?.find(p => p.id === value);
                    setValue('pipelineId', value);
                    setValue('pipelineName', pipeline?.name || '');
                    setValue('columnName', '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines && pipelines.length > 0 ? (
                      pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        Nenhum funil cadastrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Coluna</Label>
                <Select
                  value={getValue('columnName') || ''}
                  onValueChange={(value) => setValue('columnName', value)}
                  disabled={!getValue('pipelineId')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={getValue('pipelineId') ? "Selecione uma coluna" : "Selecione um funil primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const columns = isSecond ? kanbanColumns : pipelineColumns;
                      const filteredColumns = (columns || []).filter(c => 
                        isSecond ? c.pipeline_id === getValue('pipelineId') : true
                      );
                      
                      if (filteredColumns.length > 0) {
                        return filteredColumns.map((column) => (
                          <SelectItem key={column.id} value={column.name}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: column.color || '#6366f1' }}
                              />
                              {column.name}
                            </div>
                          </SelectItem>
                        ));
                      }
                      
                      return (
                        <SelectItem value="" disabled>
                          {getValue('pipelineId') ? 'Nenhuma coluna neste funil' : 'Selecione um funil primeiro'}
                        </SelectItem>
                      );
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Assigned User Condition Options */}
          {source === 'assigned_user' && (
            <>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={getValue('assignedUserCondition') || 'has_assigned'}
                  onValueChange={(value) => {
                    setValue('assignedUserCondition', value);
                    if (value !== 'is_user') {
                      setValue('assignedUserId', '');
                      setValue('assignedUserName', '');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has_assigned">Tem usuário atribuído</SelectItem>
                    <SelectItem value="not_assigned">Não tem atribuição</SelectItem>
                    <SelectItem value="is_user">É usuário específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {getValue('assignedUserCondition') === 'is_user' && (
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select
                    value={getValue('assignedUserId') || ''}
                    onValueChange={(value) => {
                      const member = members?.find(m => m.user_id === value);
                      setValue('assignedUserId', value);
                      setValue('assignedUserName', member?.full_name || '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {members && members.length > 0 ? (
                        members.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(member.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              {member.full_name || member.email || 'Sem nome'}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          Nenhum membro encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Verifica:</p>
                <p>• Se o contato tem um usuário responsável atribuído</p>
                <p>• Ou se é um usuário específico da equipe</p>
              </div>
            </>
          )}

          {/* Custom Field Condition Options */}
          {source === 'custom_field' && (
            <>
              <div className="space-y-2">
                <Label>Nome do Campo</Label>
                {Array.isArray(customFieldNames) && customFieldNames.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {getValue('customFieldName') || 'Selecione ou digite...'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Buscar ou criar campo..." 
                          onValueChange={(search) => {
                            // Allow typing new field names
                            if (search && !customFieldNames?.includes(search)) {
                              setValue('customFieldName', search);
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <p className="text-sm text-muted-foreground p-2">
                              Nenhum campo encontrado. Digite para criar.
                            </p>
                          </CommandEmpty>
                          <CommandGroup heading="Campos existentes">
                            {(customFieldNames || []).map((fieldName) => (
                              <CommandItem
                                key={fieldName}
                                value={fieldName}
                                onSelect={() => setValue('customFieldName', fieldName)}
                              >
                                {fieldName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    value={getValue('customFieldName') || ''}
                    onChange={(e) => setValue('customFieldName', e.target.value)}
                    placeholder="Ex: cidade, interesse, cpf..."
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {Array.isArray(customFieldNames) && customFieldNames.length > 0 
                    ? 'Selecione um campo existente ou digite um novo'
                    : 'Nome do campo salvo pelo nó "Salvar Resposta"'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={getValue('customFieldCondition') || 'equals'}
                  onValueChange={(value) => setValue('customFieldCondition', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">É igual a</SelectItem>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="not_equals">É diferente de</SelectItem>
                    <SelectItem value="is_empty">Está vazio</SelectItem>
                    <SelectItem value="is_not_empty">Não está vazio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {getValue('customFieldCondition') !== 'is_empty' && getValue('customFieldCondition') !== 'is_not_empty' && (
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    value={getValue('customFieldValue') || ''}
                    onChange={(e) => setValue('customFieldValue', e.target.value)}
                    placeholder="Valor a comparar..."
                  />
                </div>
              )}
              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Verifica:</p>
                <p>• Campos salvos pelo nó "Salvar Resposta"</p>
                <p>• Cada contato pode ter valores diferentes</p>
              </div>
            </>
          )}

          {/* Business Hours Condition Options */}
          {source === 'business_hours' && (
            <>
              <div className="space-y-2">
                <Label>Verificar se...</Label>
                <Select
                  value={getValue('businessHoursCondition') || 'is_open'}
                  onValueChange={(value) => setValue('businessHoursCondition', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is_open">Está aberto (dentro do horário)</SelectItem>
                    <SelectItem value="is_closed">Está fechado (fora do horário)</SelectItem>
                    <SelectItem value="is_lunch_break">É horário de almoço</SelectItem>
                    <SelectItem value="is_working_day">É dia de funcionamento</SelectItem>
                    <SelectItem value="is_before_open">É antes de abrir</SelectItem>
                    <SelectItem value="is_after_close">É depois de fechar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Holiday Condition Options */}
          {source === 'holiday' && (
            <>
              <div className="space-y-2">
                <Label>Verificar se...</Label>
                <Select
                  value={getValue('holidayCondition') || 'is_holiday'}
                  onValueChange={(value) => setValue('holidayCondition', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is_holiday">Hoje é feriado</SelectItem>
                    <SelectItem value="is_not_holiday">Hoje NÃO é feriado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Media Type Condition Options */}
          {source === 'media_type' && (
            <div className="space-y-2">
              <Label>Tipo de Mídia</Label>
              <Select
                value={getValue('mediaTypeCondition') || 'is_any_media'}
                onValueChange={(value) => setValue('mediaTypeCondition', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is_any_media">É qualquer mídia</SelectItem>
                  <SelectItem value="is_image">É foto / imagem</SelectItem>
                  <SelectItem value="is_video">É vídeo</SelectItem>
                  <SelectItem value="is_audio">É áudio</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Verifica se a mensagem recebida é do tipo de mídia selecionado
              </p>
            </div>
          )}

          {/* AI Status Condition Options */}
          {source === 'ai_enabled' && (
            <>
              <div className="space-y-2">
                <Label>Verificar se...</Label>
                <Select
                  value={getValue('aiEnabledCondition') || 'is_enabled'}
                  onValueChange={(value) => setValue('aiEnabledCondition', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is_enabled">IA está ATIVA neste contato</SelectItem>
                    <SelectItem value="is_disabled">IA está DESATIVADA neste contato</SelectItem>
                    <SelectItem value="is_specific_agent">IA está ativa com agente específico</SelectItem>
                    <SelectItem value="is_not_specific_agent">IA NÃO está ativa com agente específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(getValue('aiEnabledCondition') === 'is_specific_agent' ||
                getValue('aiEnabledCondition') === 'is_not_specific_agent') && (
                <div className="space-y-2">
                  <Label>Agente</Label>
                  <Select
                    value={getValue('aiAgentId') || ''}
                    onValueChange={(value) => setValue('aiAgentId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(aiAgents || []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} {a.category === 'sdr' || a.is_sdr ? '(SDR)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Útil para fluxos de follow-up: se o agente SDR continua ativo, o cliente ainda não respondeu.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      );
    };
    
    return (
      <div className="space-y-4">
        {/* Logic Operator Selection */}
        <div className="space-y-2">
          <Label>Tipo de Condição</Label>
          <Select
            value={logicOperator}
            onValueChange={(value) => handleChange('logicOperator', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Condição única</SelectItem>
              <SelectItem value="and">AND (E) - Ambas devem ser verdadeiras</SelectItem>
              <SelectItem value="or">OR (OU) - Uma deve ser verdadeira</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />
        
        {/* First Condition */}
        <div className="space-y-3">
          {logicOperator !== 'single' && (
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Primeira Condição</Label>
          )}
          {renderConditionFields(false)}
        </div>
        
        {/* Second Condition (for AND/OR) */}
        {logicOperator !== 'single' && (
          <>
            <div className="flex items-center gap-2 py-2">
              <Separator className="flex-1" />
              <Badge variant="secondary" className="uppercase text-xs">
                {logicOperator === 'and' ? 'E' : 'OU'}
              </Badge>
              <Separator className="flex-1" />
            </div>
            <div className="space-y-3">
              {renderConditionFields(true)}
            </div>
          </>
        )}

        <Separator />

        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Saídas:</p>
          <p>• <span className="text-primary font-medium">Sim</span>: Se a condição for verdadeira</p>
          <p>• <span className="text-destructive font-medium">Não</span>: Se a condição for falsa</p>
          {logicOperator === 'and' && (
            <p className="mt-1">• <span className="font-medium">AND:</span> Ambas condições precisam ser verdadeiras</p>
          )}
          {logicOperator === 'or' && (
            <p className="mt-1">• <span className="font-medium">OR:</span> Pelo menos uma condição precisa ser verdadeira</p>
          )}
        </div>
      </div>
    );
  };

  const renderMoveColumnProperties = () => {
    const data = selectedNode.data as unknown as MoveColumnNodeData;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Coluna de Destino</Label>
          <Select
            value={data.columnName || ''}
            onValueChange={(value) => handleChange('columnName', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma coluna" />
            </SelectTrigger>
            <SelectContent>
              {kanbanColumns && kanbanColumns.length > 0 ? (
                kanbanColumns.map((column) => (
                  <SelectItem key={column.id} value={column.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: column.color || '#6366f1' }}
                      />
                      {column.name}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  Nenhuma coluna cadastrada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O contato será movido para esta coluna no Kanban
          </p>
          {(!kanbanColumns || kanbanColumns.length === 0) && (
            <p className="text-xs text-muted-foreground">
              Crie colunas no Kanban para usá-las aqui
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderWebhookProperties = () => {
    const data = selectedNode.data as unknown as WebhookNodeData;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Método HTTP</Label>
          <Select
            value={data.method || 'POST'}
            onValueChange={(value) => handleChange('method', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>URL do Webhook</Label>
          <Input
            value={data.url || ''}
            onChange={(e) => handleChange('url', e.target.value)}
            placeholder="https://api.exemplo.com/webhook"
          />
          <p className="text-xs text-muted-foreground">
            Os dados do contato e mensagem serão enviados no corpo da requisição
          </p>
        </div>
      </div>
    );
  };

  const renderAssignProperties = () => {
    const data = selectedNode.data as unknown as AssignNodeData;
    const selectedMemberIds = data.memberIds || [];
    
    const toggleMemberSelection = (userId: string, memberName: string) => {
      const currentIds = data.memberIds || [];
      const currentNames = data.memberNames || [];
      
      if (currentIds.includes(userId)) {
        // Remove member
        const newIds = currentIds.filter(id => id !== userId);
        const newNames = currentNames.filter(name => name !== memberName);
        handleChange('memberIds', newIds);
        handleChange('memberNames', newNames);
      } else {
        // Add member
        handleChange('memberIds', [...currentIds, userId]);
        handleChange('memberNames', [...currentNames, memberName]);
      }
    };
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de Atribuição</Label>
          <Select
            value={data.assignTo || 'specific'}
            onValueChange={(value) => handleChange('assignTo', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="specific">Membro Específico</SelectItem>
              <SelectItem value="random">Distribuição Aleatória</SelectItem>
              <SelectItem value="round_robin">Distribuição Rotativa</SelectItem>
              <SelectItem value="least_busy">Membro Menos Ocupado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {data.assignTo === 'specific' && (
          <div className="space-y-2">
            <Label>Membro da Equipe</Label>
            <Select
              value={data.memberId || ''}
              onValueChange={(value) => {
                const member = members?.find(m => m.user_id === value);
                handleChange('memberId', value);
                handleChange('memberName', member?.full_name || '');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {members && members.length > 0 ? (
                  members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.full_name || member.email || 'Sem nome'}</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    Nenhum membro encontrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {(!members || members.length === 0) && (
              <p className="text-xs text-muted-foreground">
                Convide membros nas configurações da organização
              </p>
            )}
          </div>
        )}
        
        {data.assignTo === 'random' && (
          <div className="space-y-2">
            <Label>Membros para Distribuição Aleatória</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecione os membros entre os quais as conversas serão distribuídas aleatoriamente
            </p>
            <ScrollArea className="h-48 border rounded-md p-2">
              {members && members.length > 0 ? (
                <div className="space-y-1">
                  {members.map((member) => {
                    const isSelected = selectedMemberIds.includes(member.user_id);
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => toggleMemberSelection(member.user_id, member.full_name || member.email || 'Sem nome')}
                        className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left ${
                          isSelected 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 truncate">
                          {member.full_name || member.email || 'Sem nome'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum membro encontrado
                </p>
              )}
            </ScrollArea>
            {selectedMemberIds.length > 0 && (
              <p className="text-xs text-primary">
                {selectedMemberIds.length} membro(s) selecionado(s)
              </p>
            )}
          </div>
        )}
        
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Modos:</p>
          <p>• <strong>Específico</strong>: Sempre atribui ao mesmo membro</p>
          <p>• <strong>Aleatório</strong>: Distribui aleatoriamente entre membros selecionados</p>
          <p>• <strong>Rotativo</strong>: Distribui igualmente entre toda a equipe</p>
          <p>• <strong>Menos Ocupado</strong>: Atribui ao membro com menos conversas abertas</p>
        </div>
      </div>
    );
  };

  const renderWaitResponseProperties = () => {
    const data = selectedNode.data as unknown as WaitResponseNodeData;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tempo Limite (Timeout)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={data.timeout || ''}
              onChange={(e) => handleChange('timeout', parseInt(e.target.value) || 0)}
              placeholder="5"
              className="w-24"
            />
            <Select
              value={data.timeoutUnit || 'minutes'}
              onValueChange={(value) => handleChange('timeoutUnit', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Saídas:</p>
          <p>• <span className="text-primary font-medium">Respondeu</span>: Quando o usuário responde</p>
          <p>• <span className="text-amber-500 font-medium">Timeout</span>: Se não responder no tempo limite</p>
        </div>
      </div>
    );
  };

  const renderConnectFlowProperties = () => {
    const data = selectedNode.data as unknown as ConnectFlowNodeData;
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Fluxo de Destino</Label>
          <Select
            value={data.targetFlowId || ''}
            onValueChange={(value) => {
              const selected = automations?.find(a => a.id === value);
              handleChange('targetFlowId', value);
              handleChange('targetFlowName', selected?.name || '');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um fluxo" />
            </SelectTrigger>
            <SelectContent>
              {automations?.map((automation) => (
                <SelectItem key={automation.id} value={automation.id}>
                  {automation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Comportamento:</p>
          <p>• O contato será transferido para o fluxo selecionado</p>
          <p>• O fluxo atual será encerrado</p>
          <p>• O novo fluxo começará do início (gatilho)</p>
        </div>
      </div>
    );
  };

  const renderSaveResponseProperties = () => {
    const data = selectedNode.data as { variableName?: string; timeout?: number; timeoutUnit?: string };
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome da Variável</Label>
          <Input
            value={data.variableName || ''}
            onChange={(e) => handleChange('variableName', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
            placeholder="Ex: nome_cliente"
          />
          <p className="text-xs text-muted-foreground">
            Use apenas letras minúsculas, números e underline
          </p>
        </div>
        
        {data.variableName && (
          <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-md border border-rose-200 dark:border-rose-800">
            <p className="text-xs text-rose-700 dark:text-rose-300">
              Variável: <span className="font-mono font-medium">{`{${data.variableName}}`}</span>
            </p>
          </div>
        )}
        
        <Separator />
        
        <div className="space-y-2">
          <Label>Tempo Limite (Timeout)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={data.timeout || ''}
              onChange={(e) => handleChange('timeout', parseInt(e.target.value) || 0)}
              placeholder="5"
              className="w-24"
            />
            <Select
              value={data.timeoutUnit || 'minutes'}
              onValueChange={(value) => handleChange('timeoutUnit', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Como usar:</p>
          <p>1. Envie uma pergunta antes deste bloco</p>
          <p>2. A resposta do usuário será salva na variável</p>
          <p>3. Use <span className="font-mono">{`{${data.variableName || 'variavel'}}`}</span> em mensagens seguintes</p>
          <Separator className="my-2" />
          <p className="font-medium mb-1">Saídas:</p>
          <p>• <span className="text-primary font-medium">Respondeu</span>: Quando o usuário responde</p>
          <p>• <span className="text-amber-500 font-medium">Timeout</span>: Se não responder no tempo limite</p>
        </div>
      </div>
    );
  };

  const renderSendSurveyProperties = () => {
    const data = selectedNode.data as Record<string, any>;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mensagem com Link</Label>
            <VariablesPopover currentValue={data.message || ''} fieldKey="message" />
          </div>
          <Textarea
            ref={messageTextareaRef}
            value={data.message || ''}
            onChange={(e) => handleChange('message', e.target.value)}
            placeholder="Mensagem enviada junto com o link da pesquisa..."
            rows={5}
          />
          <div className="p-2 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Variável especial:</p>
            <p className="text-xs font-mono">
              {'{link_pesquisa}'} — será substituído pelo link único
            </p>
          </div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium mb-1">ℹ️ Como funciona:</p>
          <p>1. Um link único é gerado para o contato</p>
          <p>2. O vendedor atribuído é registrado automaticamente</p>
          <p>3. A nota vai para a média geral e do vendedor</p>
          <p>4. Configure a pesquisa em <span className="font-medium">Ajustes → Pesquisa de Satisfação</span></p>
        </div>
      </div>
    );
  };

  const renderToggleAiProperties = () => {
    const data = selectedNode.data as Record<string, any>;
    const action = data.aiAction || 'enable';
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Ação</Label>
          <Select value={action} onValueChange={(v) => handleChange('aiAction', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="enable">Ativar IA</SelectItem>
              <SelectItem value="disable">Desativar IA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {action === 'enable' && (
          <div className="space-y-2">
            <Label>Agente</Label>
            <Select value={data.aiAgentId || ''} onValueChange={(v) => handleChange('aiAgentId', v)}>
              <SelectTrigger><SelectValue placeholder="Primeiro agente ativo" /></SelectTrigger>
              <SelectContent>
                {(aiAgents || []).filter(a => a.category === 'conversational').map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Se não selecionado, usa o primeiro agente conversacional ativo.</p>
          </div>
        )}
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p>Ativa ou desativa o atendente de IA para este contato.</p>
        </div>
      </div>
    );
  };

  const renderAnalyzeConversationProperties = () => {
    const data = selectedNode.data as unknown as AnalyzeConversationNodeData;
    const systemAgents = (aiAgents || []).filter((a: any) => a.category === 'system');
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Agente de Sistema</Label>
          <Select
            value={data.agentId || ''}
            onValueChange={(value) => handleChange('agentId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um agente" />
            </SelectTrigger>
            <SelectContent>
              {systemAgents.length > 0 ? (
                systemAgents.map((agent: any) => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>Nenhum agente de sistema cadastrado</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Use um agente com categoria "Sistema" para analisar a conversa.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Mensagens de Contexto</Label>
          <Input
            type="number"
            min={5}
            max={50}
            value={data.contextMessages || 20}
            onChange={(e) => handleChange('contextMessages', parseInt(e.target.value) || 20)}
          />
          <p className="text-xs text-muted-foreground">
            Quantidade de mensagens recentes a incluir na análise.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Prompt Adicional (opcional)</Label>
          <Textarea
            value={data.additionalPrompt || ''}
            onChange={(e) => handleChange('additionalPrompt', e.target.value)}
            placeholder="Instruções extras para a IA nesta análise..."
            rows={3}
          />
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium">A IA pode executar automaticamente:</p>
          <p>• Adicionar/remover tags</p>
          <p>• Mover etapa do funil</p>
          <p>• Atribuir conversa</p>
          <p>• Mover no Kanban</p>
        </div>
      </div>
    );
  };

  const renderTriggerSdrProperties = () => {
    const data = selectedNode.data as unknown as TriggerSdrNodeData;
    const sdrAgents = (aiAgents || []).filter((a: any) => a.category === 'sdr');

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Agente SDR</Label>
          <Select
            value={data.agentId || ''}
            onValueChange={(value) => handleChange('agentId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um agente SDR" />
            </SelectTrigger>
            <SelectContent>
              {sdrAgents.length > 0 ? (
                sdrAgents.map((agent: any) => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>Nenhum agente SDR cadastrado</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Agentes da categoria "SDR / Follow-up" no Squad AI.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Instruções adicionais (opcional)</Label>
          <Textarea
            value={data.additionalInstructions || ''}
            onChange={(e) => handleChange('additionalInstructions', e.target.value)}
            placeholder="Ex: foque em oferecer desconto de 10%, mencione promoção atual..."
            rows={3}
          />
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p>O agente SDR receberá as <strong>últimas 50 mensagens</strong> (com transcrições) e gerará uma mensagem proativa de retomada.</p>
          <p>A IA do contato será ativada — quando o cliente responder, o agente se desativa automaticamente (se "Pausar ao receber resposta" estiver ativo).</p>
        </div>
      </div>
    );
  };

  const renderMoveFunnelStageProperties = () => {
    const data = selectedNode.data as any;
    const allSorted = [...(funnelStages || [])].sort((a, b) => a.position - b.position);
    const sortedStages = data.pipelineId
      ? allSorted.filter((s) => s.pipeline_id === data.pipelineId)
      : allSorted;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Funil de destino (opcional)</Label>
          <Select
            value={data.pipelineId || '__keep__'}
            onValueChange={(value) => {
              handleChange('pipelineId', value === '__keep__' ? '' : value);
              // Reset stageName when funil changes to avoid invalid pairing
              handleChange('stageName', '');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Manter funil atual" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__keep__">Manter funil atual do contato</SelectItem>
              {(kanbanPipelines || []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.is_default ? ' (padrão)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Quando definido, o contato é movido para este funil antes de receber a etapa.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Etapa de destino</Label>
          <Select
            value={data.stageName || ''}
            onValueChange={(value) => handleChange('stageName', value)}
            disabled={sortedStages.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={sortedStages.length === 0 ? 'Nenhuma etapa disponível' : 'Selecione a etapa'} />
            </SelectTrigger>
            <SelectContent>
              {sortedStages.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  Nenhuma etapa neste funil
                </SelectItem>
              ) : (
                sortedStages.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {sortedStages.length === 0 && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Este funil não tem etapas criadas. Vá até <strong>Funil → Configurar Funil</strong> para adicionar etapas antes de usar esta ação.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  };

  const renderSetDealValueProperties = () => {
    const data = selectedNode.data as any;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Operação</Label>
          <Select
            value={data.operation || 'set'}
            onValueChange={(v) => handleChange('operation', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="set">Definir (substituir)</SelectItem>
              <SelectItem value="add">Somar</SelectItem>
              <SelectItem value="multiply">Multiplicar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor (R$ ou variável)</Label>
          <Input
            value={data.value || ''}
            onChange={(e) => handleChange('value', e.target.value)}
            placeholder="Ex.: 1500 ou {valor_orcamento}"
          />
          <p className="text-xs text-muted-foreground">
            Aceita números (ex.: 1500.50) ou variáveis do contexto.
          </p>
        </div>
      </div>
    );
  };

  const renderSetSaleResultProperties = () => {
    const data = selectedNode.data as any;
    const isLost = data.result === 'lost';
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Resultado</Label>
          <Select
            value={data.result || 'won'}
            onValueChange={(v) => handleChange('result', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="won">Ganho 🏆</SelectItem>
              <SelectItem value="lost">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLost && (
          <div className="space-y-2">
            <Label>Motivo da perda (opcional)</Label>
            <Textarea
              rows={3}
              value={data.lossReason || ''}
              onChange={(e) => handleChange('lossReason', e.target.value)}
              placeholder="Ex.: preço, prazo, escolheu concorrente..."
            />
          </div>
        )}
      </div>
    );
  };

  const renderScheduleMessageProperties = () => {
    const data = selectedNode.data as unknown as ScheduleMessageNodeData;
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mensagem</Label>
            <VariablesPopover currentValue={data.message || ''} fieldKey="message" />
          </div>
          <Textarea
            ref={messageTextareaRef}
            value={data.message || ''}
            onChange={(e) => handleChange('message', e.target.value)}
            placeholder="Digite a mensagem a ser agendada..."
            rows={5}
          />
        </div>
        <div className="space-y-2">
          <Label>Dias Úteis à Frente</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={data.offsetDays || 1}
            onChange={(e) => handleChange('offsetDays', parseInt(e.target.value) || 1)}
          />
          <p className="text-xs text-muted-foreground">
            Agenda para o próximo dia útil (pula fins de semana e feriados).
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p>A mensagem será inserida na fila de agendamento e enviada no horário de abertura do dia útil calculado.</p>
        </div>
      </div>
    );
  };

  const renderSendEmailProperties = () => {
    const data = selectedNode.data as unknown as SendEmailNodeData;
    const isConfigured = !!emailSettings?.resend_api_key;
    const toMode = data.to === 'custom' ? 'custom' : 'contact';

    return (
      <div className="space-y-4">
        {!isConfigured && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-2">
              <p>Sua organização ainda não tem chave do Resend configurada.</p>
              <Button asChild size="sm" variant="outline" className="gap-1">
                <RouterLink to="/email">
                  <Mail className="w-3 h-3" />
                  Configurar agora
                </RouterLink>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Para (To)</Label>
          <Select
            value={toMode}
            onValueChange={(value) => {
              if (value === 'contact') {
                handleChange('to', '{email}');
              } else {
                handleChange('to', 'custom');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contact">Email do contato ({'{email}'})</SelectItem>
              <SelectItem value="custom">Email customizado</SelectItem>
            </SelectContent>
          </Select>
          {toMode === 'custom' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Email destinatário</Label>
                <VariablesPopover currentValue={data.customTo || ''} fieldKey="customTo" />
              </div>
              <Input
                value={data.customTo || ''}
                onChange={(e) => handleChange('customTo', e.target.value)}
                placeholder="cliente@exemplo.com ou {email}"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Assunto</Label>
            <VariablesPopover currentValue={data.subject || ''} fieldKey="subject" />
          </div>
          <Input
            value={data.subject || ''}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder="Olá {primeiro_nome}, sua proposta chegou!"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Conteúdo</Label>
            <VariablesPopover currentValue={data.content || ''} fieldKey="content" />
          </div>
          <Textarea
            ref={messageTextareaRef}
            value={data.content || ''}
            onChange={(e) => handleChange('content', e.target.value)}
            placeholder={
              data.htmlMode
                ? '<p>Olá {primeiro_nome},</p><p>Segue sua proposta...</p>'
                : 'Olá {primeiro_nome},\n\nSegue sua proposta...\n\nAtenciosamente,\nEquipe'
            }
            rows={8}
          />
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
            <div className="space-y-0.5">
              <Label htmlFor="html-mode" className="text-xs">
                Modo HTML avançado
              </Label>
              <p className="text-xs text-muted-foreground">
                Cole HTML cru. Sem isso, parágrafos são preservados automaticamente.
              </p>
            </div>
            <Switch
              id="html-mode"
              checked={!!data.htmlMode}
              onCheckedChange={(checked) => handleChange('htmlMode', checked)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Opcionais</Label>
          <div className="space-y-2">
            <Label className="text-xs">CC</Label>
            <Input
              value={data.cc || ''}
              onChange={(e) => handleChange('cc', e.target.value)}
              placeholder="copia@exemplo.com (separe múltiplos por vírgula)"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">BCC</Label>
            <Input
              value={data.bcc || ''}
              onChange={(e) => handleChange('bcc', e.target.value)}
              placeholder="copia-oculta@exemplo.com"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderNotifyManagerProperties = () => {
    const data = selectedNode.data as Record<string, any>;
    const EVENT_OPTIONS = [
      { value: 'automation_trigger', label: 'Notificação de automação' },
      { value: 'sale_detected', label: '💰 Venda detectada' },
      { value: 'tension_detected', label: '⚠️ Tensão na conversa' },
    ];
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de evento</Label>
          <Select
            value={data.notifyEventType || 'automation_trigger'}
            onValueChange={(v) => handleChange('notifyEventType', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Classifica a notificação para o gestor.</p>
        </div>
        <div className="space-y-2">
          <Label>Contexto / mensagem</Label>
          <Textarea
            value={data.context || ''}
            onChange={(e) => handleChange('context', e.target.value)}
            placeholder="Ex: Contato {{nome}} avançou para etapa de proposta. Verifique o negócio."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Use <code>{'{{nome}}'}</code>, <code>{'{{telefone}}'}</code> e outras variáveis do contato. A IA vai reescrever isso numa mensagem natural para o gestor.
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p>O gestor precisa ter o número configurado em <strong>Configurações → Preferências → IA do Gestor</strong>.</p>
          <p>Throttle automático: no máximo 1 notificação por contato por evento a cada 1 hora.</p>
        </div>
      </div>
    );
  };

  const renderCreateTaskProperties = () => {
    const data = selectedNode.data as Record<string, any>;
    const priority = data.priority || 'medium';
    const dueMode = data.dueMode || 'none';
    const assignMode = data.assignMode || 'assigned_user';
    const linkContact = data.linkContact !== false;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título da tarefa</Label>
          <Input
            value={data.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Ex.: Ligar para {nome}"
          />
          <p className="text-xs text-muted-foreground">Suporta variáveis (ex.: {'{nome}'}).</p>
        </div>
        <div className="space-y-2">
          <Label>Descrição (opcional)</Label>
          <Textarea
            value={data.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            placeholder="Detalhes da tarefa..."
          />
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={(v) => handleChange('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Projeto (opcional)</Label>
          <Select
            value={data.projectId || '__none__'}
            onValueChange={(v) => {
              const newVal = v === '__none__' ? null : v;
              handleChange('projectId', newVal);
              handleChange('areaId', null);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem projeto</SelectItem>
              {(projects || []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data.projectId && (projectAreas || []).length > 0 && (
          <div className="space-y-2">
            <Label>Área do projeto (opcional)</Label>
            <Select
              value={data.areaId || '__none__'}
              onValueChange={(v) => handleChange('areaId', v === '__none__' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sem área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem área</SelectItem>
                {(projectAreas || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Prazo</Label>
          <Select value={dueMode} onValueChange={(v) => handleChange('dueMode', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem prazo</SelectItem>
              <SelectItem value="in_days">Em N dias</SelectItem>
            </SelectContent>
          </Select>
          {dueMode === 'in_days' && (
            <Input
              type="number"
              min={1}
              value={data.dueDays || 1}
              onChange={(e) => handleChange('dueDays', parseInt(e.target.value) || 1)}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>Atribuir a</Label>
          <Select value={assignMode} onValueChange={(v) => handleChange('assignMode', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="assigned_user">Responsável do contato</SelectItem>
              <SelectItem value="specific_user">Membro específico</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
            </SelectContent>
          </Select>
          {assignMode === 'specific_user' && (
            <Select
              value={data.assigneeUserId || ''}
              onValueChange={(v) => {
                const m = members?.find((mm) => mm.user_id === v);
                handleChange('assigneeUserId', v);
                handleChange('assigneeName', m?.full_name || '');
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
              <SelectContent>
                {(members || []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {assignMode === 'assigned_user' && (
            <p className="text-xs text-muted-foreground">
              Usa o vendedor já atribuído ao contato. Se não houver, a tarefa fica sem responsável.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="link-contact"
            checked={linkContact}
            onCheckedChange={(c) => handleChange('linkContact', !!c)}
          />
          <Label htmlFor="link-contact" className="cursor-pointer">
            Vincular tarefa ao contato em fluxo
          </Label>
        </div>
      </div>
    );
  };

  const renderProperties = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return renderTriggerProperties();
      case 'sendMessage':
        return renderSendMessageProperties();
      case 'delay':
        return renderDelayProperties();
      case 'manageTag':
        return renderManageTagProperties();
      case 'condition':
        return renderConditionProperties();
      case 'moveColumn':
        return renderMoveColumnProperties();
      case 'webhook':
        return renderWebhookProperties();
      case 'assign':
        return renderAssignProperties();
      case 'waitResponse':
        return renderWaitResponseProperties();
      case 'connectFlow':
        return renderConnectFlowProperties();
      case 'saveResponse':
        return renderSaveResponseProperties();
      case 'sendSurvey':
        return renderSendSurveyProperties();
      case 'toggleAi':
        return renderToggleAiProperties();
      case 'analyzeConversation':
        return renderAnalyzeConversationProperties();
      case 'triggerSdr':
        return renderTriggerSdrProperties();
      case 'scheduleMessage':
        return renderScheduleMessageProperties();
      case 'moveFunnelStage':
        return renderMoveFunnelStageProperties();
      case 'setDealValue':
        return renderSetDealValueProperties();
      case 'setSaleResult':
        return renderSetSaleResultProperties();
      case 'sendEmail':
        return renderSendEmailProperties();
      case 'createTask':
        return renderCreateTaskProperties();
      case 'notify_manager':
        return renderNotifyManagerProperties();
      default:
        return <p className="text-muted-foreground">Tipo de nó desconhecido</p>;
    }
  };

  const getNodeTitle = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return 'Configurar Gatilho';
      case 'sendMessage':
        return 'Configurar Mensagem';
      case 'delay':
        return 'Configurar Delay';
      case 'manageTag':
        return 'Configurar Tag';
      case 'condition':
        return 'Configurar Condição';
      case 'moveColumn':
        return 'Mover no Kanban';
      case 'webhook':
        return 'Configurar Webhook';
      case 'assign':
        return 'Atribuir Conversa';
      case 'waitResponse':
        return 'Aguardar Resposta';
      case 'connectFlow':
        return 'Conectar Fluxo';
      case 'saveResponse':
        return 'Salvar Resposta';
      case 'sendSurvey':
        return 'Pesquisa de Satisfação';
      case 'toggleAi':
        return 'IA do Contato';
      case 'analyzeConversation':
        return 'Analisar Conversa';
      case 'triggerSdr':
        return 'Acionar SDR';
      case 'scheduleMessage':
        return 'Agendar Mensagem';
      case 'moveFunnelStage':
        return 'Mover Etapa do Funil';
      case 'setDealValue':
        return 'Definir Valor Potencial';
      case 'setSaleResult':
        return 'Marcar Resultado';
      case 'sendEmail':
        return 'Enviar Email';
      case 'createTask':
        return 'Criar Tarefa';
      case 'notify_manager':
        return 'Notificar Gestor';
      default:
        return 'Propriedades';
    }
  };

  return (
    <Card className="w-80 h-full border-l rounded-none flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
        <CardTitle className="text-sm font-semibold">{getNodeTitle()}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="pb-6 space-y-6">
          {renderProperties()}
          
          <Separator />
          
          <div className="space-y-2">
            <Label className="text-muted-foreground">Ações</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => onDuplicateNode?.(selectedNode.id)}
              >
                <Copy className="w-4 h-4" />
                Duplicar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => onDeleteNode?.(selectedNode.id)}
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </Button>
            </div>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
