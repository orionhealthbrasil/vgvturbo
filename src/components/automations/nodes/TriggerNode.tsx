import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type KeywordMatchType = 'contains' | 'exact' | 'starts_with' | 'ends_with' | 'regex';
export type MediaType = 'image' | 'video' | 'audio' | 'any_media';

export interface TriggerNodeData {
  label?: string;
  triggerType?:
    | 'message_received'
    | 'tag_added'
    | 'keyword'
    | 'funnel_stage_change'
    | 'funnel_stage_exit'
    | 'media_received'
    | 'conversation_closed'
    | 'deal_won'
    | 'deal_lost'
    | 'form_submitted'
    | 'booking_created'
    | 'booking_cancelled'
    | 'external_purchase'
    | '';
  keyword?: string;
  keywordMatchType?: KeywordMatchType;
  tagName?: string;
  pipelineId?: string;
  funnelStageName?: string;
  funnelStageExitName?: string;
  mediaType?: MediaType;
  formId?: string;
  calendarId?: string;
  reasonFilter?: string;
  paymentIntegrationId?: string;
  purchaseEvent?: string;
}

export const PURCHASE_EVENT_LABELS: Record<string, string> = {
  approved: 'Aprovada',
  refunded: 'Reembolsada',
  cancelled: 'Cancelada',
  chargeback: 'Chargeback',
};

const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as TriggerNodeData;
  
  const getMatchTypeLabel = (matchType?: KeywordMatchType) => {
    switch (matchType) {
      case 'exact': return 'igual a';
      case 'starts_with': return 'começa com';
      case 'ends_with': return 'termina com';
      case 'regex': return 'regex';
      case 'contains':
      default: return 'contém';
    }
  };

  const getMediaTypeLabel = (mediaType?: MediaType) => {
    switch (mediaType) {
      case 'image': return 'Foto';
      case 'video': return 'Vídeo';
      case 'audio': return 'Áudio';
      case 'any_media': return 'Qualquer mídia';
      default: return 'Mídia';
    }
  };

  const getTriggerDescription = () => {
    switch (nodeData.triggerType) {
      case 'message_received':
        return 'Quando mensagem recebida';
      case 'tag_added':
        return nodeData.tagName ? `Quando tag "${nodeData.tagName}" adicionada` : 'Quando tag adicionada';
      case 'keyword':
        if (nodeData.keyword) {
          return `${getMatchTypeLabel(nodeData.keywordMatchType)}: "${nodeData.keyword}"`;
        }
        return 'Palavra-chave específica';
      case 'funnel_stage_change':
        return nodeData.funnelStageName 
          ? `Ao entrar em "${nodeData.funnelStageName}"` 
          : 'Ao mudar de etapa';
      case 'funnel_stage_exit':
        return nodeData.funnelStageExitName
          ? `Ao sair de "${nodeData.funnelStageExitName}"`
          : 'Ao sair de uma etapa';
      case 'media_received':
        return `Quando ${getMediaTypeLabel(nodeData.mediaType).toLowerCase()} recebida`;
      case 'conversation_closed':
        return 'Quando conversa finalizada';
      case 'deal_won':
        return nodeData.reasonFilter
          ? `Negócio ganho 🏆 — ${nodeData.reasonFilter}`
          : 'Quando negócio ganho 🏆';
      case 'deal_lost':
        return nodeData.reasonFilter
          ? `Negócio perdido — ${nodeData.reasonFilter}`
          : 'Quando negócio perdido';
      case 'form_submitted':
        return nodeData.formId ? 'Quando formulário enviado 📝' : 'Quando qualquer formulário enviado';
      case 'booking_created':
        return nodeData.calendarId ? 'Quando agendamento criado 📅' : 'Quando qualquer agendamento criado';
      case 'booking_cancelled':
        return nodeData.calendarId ? 'Quando agendamento cancelado ❌' : 'Quando qualquer agendamento cancelado';
      case 'external_purchase': {
        const eventLabel = nodeData.purchaseEvent ? PURCHASE_EVENT_LABELS[nodeData.purchaseEvent] : null;
        return eventLabel ? `Compra externa ${eventLabel.toLowerCase()} 💳` : 'Quando compra externa recebida 💳';
      }
      default:
        return 'Clique para configurar';
    }
  };

  return (
    <div className="relative">
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-primary shadow-lg' : 'border-primary/60'} bg-gradient-to-br from-primary/10 to-primary/20`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Gatilho
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {getTriggerDescription()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';

export default TriggerNode;
