import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch, MessageSquare, Tag, Columns, Clock, CalendarDays, User, FileText, Image, Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface ConditionNodeData {
  label?: string;
  // Logic operator for combining conditions
  logicOperator?: 'single' | 'and' | 'or';
  // Source of condition check
  conditionSource?: 'message' | 'tag' | 'kanban' | 'business_hours' | 'holiday' | 'assigned_user' | 'custom_field' | 'media_type' | 'ai_enabled';
  // For message conditions
  conditionType?: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  value?: string;
  caseSensitive?: boolean;
  // For tag conditions
  tagCondition?: 'has_tag' | 'not_has_tag';
  tagName?: string;
  // For kanban conditions
  kanbanCondition?: 'is_in_column' | 'not_in_column';
  pipelineId?: string;
  pipelineName?: string;
  columnName?: string;
  // For business hours conditions
  businessHoursCondition?: 'is_open' | 'is_closed' | 'is_lunch_break' | 'is_working_day' | 'is_before_open' | 'is_after_close';
  // For holiday conditions
  holidayCondition?: 'is_holiday' | 'is_not_holiday';
  // For assigned user conditions
  assignedUserCondition?: 'has_assigned' | 'not_assigned' | 'is_user';
  assignedUserId?: string;
  assignedUserName?: string;
  // For custom field conditions
  customFieldName?: string;
  customFieldCondition?: 'equals' | 'contains' | 'not_equals' | 'is_empty' | 'is_not_empty';
  customFieldValue?: string;
  // For media type conditions
  mediaTypeCondition?: 'is_image' | 'is_video' | 'is_audio' | 'is_any_media';
  // For AI enabled condition
  aiEnabledCondition?: 'is_enabled' | 'is_disabled';
  // Second condition (for AND/OR logic)
  secondConditionSource?: 'message' | 'tag' | 'kanban' | 'business_hours' | 'holiday' | 'assigned_user' | 'custom_field' | 'media_type' | 'ai_enabled';
  secondConditionType?: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  secondValue?: string;
  secondCaseSensitive?: boolean;
  secondTagCondition?: 'has_tag' | 'not_has_tag';
  secondTagName?: string;
  secondKanbanCondition?: 'is_in_column' | 'not_in_column';
  secondPipelineId?: string;
  secondPipelineName?: string;
  secondColumnName?: string;
  secondBusinessHoursCondition?: 'is_open' | 'is_closed' | 'is_lunch_break' | 'is_working_day' | 'is_before_open' | 'is_after_close';
  secondHolidayCondition?: 'is_holiday' | 'is_not_holiday';
  secondAssignedUserCondition?: 'has_assigned' | 'not_assigned' | 'is_user';
  secondAssignedUserId?: string;
  secondAssignedUserName?: string;
  secondCustomFieldName?: string;
  secondCustomFieldCondition?: 'equals' | 'contains' | 'not_equals' | 'is_empty' | 'is_not_empty';
  secondCustomFieldValue?: string;
  secondMediaTypeCondition?: 'is_image' | 'is_video' | 'is_audio' | 'is_any_media';
  secondAiEnabledCondition?: 'is_enabled' | 'is_disabled';
}

const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ConditionNodeData;
  
  const getSourceIcon = () => {
    switch (nodeData.conditionSource) {
      case 'tag': return Tag;
      case 'kanban': return Columns;
      case 'business_hours': return Clock;
      case 'holiday': return CalendarDays;
      case 'assigned_user': return User;
      case 'custom_field': return FileText;
      case 'media_type': return Image;
      case 'ai_enabled': return Bot;
      default: return MessageSquare;
    }
  };

  const getBusinessHoursLabel = (condition: string) => {
    switch (condition) {
      case 'is_open': return 'Está aberto';
      case 'is_closed': return 'Está fechado';
      case 'is_lunch_break': return 'É horário de almoço';
      case 'is_working_day': return 'É dia de funcionamento';
      case 'is_before_open': return 'Antes de abrir';
      case 'is_after_close': return 'Depois de fechar';
      default: return condition;
    }
  };

  const getConditionLabel = (type: string) => {
    switch (type) {
      case 'contains': return 'Contém';
      case 'equals': return 'É igual a';
      case 'starts_with': return 'Começa com';
      case 'ends_with': return 'Termina com';
      case 'regex': return 'Regex';
      default: return type;
    }
  };

  const getAssignedUserLabel = (condition: string, userName?: string) => {
    switch (condition) {
      case 'has_assigned': return 'Tem usuário atribuído';
      case 'not_assigned': return 'Não tem atribuição';
      case 'is_user': return userName ? `Atribuído a: ${userName}` : 'Usuário específico';
      default: return condition;
    }
  };

  const getCustomFieldConditionLabel = (condition: string) => {
    switch (condition) {
      case 'equals': return 'é igual a';
      case 'contains': return 'contém';
      case 'not_equals': return 'é diferente de';
      case 'is_empty': return 'está vazio';
      case 'is_not_empty': return 'não está vazio';
      default: return condition;
    }
  };

  const getDescription = () => {
    const source = nodeData.conditionSource || 'message';
    const logicOp = nodeData.logicOperator || 'single';
    
    let firstDesc = '';
    
    if (source === 'message') {
      if (nodeData.conditionType && nodeData.value) {
        firstDesc = `Mensagem ${getConditionLabel(nodeData.conditionType).toLowerCase()}: "${nodeData.value}"`;
      } else {
        firstDesc = 'Verifica a mensagem';
      }
    } else if (source === 'tag') {
      if (nodeData.tagCondition && nodeData.tagName) {
        firstDesc = nodeData.tagCondition === 'has_tag' 
          ? `Tem a tag: "${nodeData.tagName}"`
          : `Não tem a tag: "${nodeData.tagName}"`;
      } else {
        firstDesc = 'Verifica tags do contato';
      }
    } else if (source === 'kanban') {
      if (nodeData.kanbanCondition && nodeData.columnName) {
        const pipelineInfo = nodeData.pipelineName ? ` (${nodeData.pipelineName})` : '';
        firstDesc = nodeData.kanbanCondition === 'is_in_column'
          ? `Está na coluna: "${nodeData.columnName}"${pipelineInfo}`
          : `Não está na coluna: "${nodeData.columnName}"${pipelineInfo}`;
      } else {
        firstDesc = 'Verifica coluna do Kanban';
      }
    } else if (source === 'business_hours') {
      firstDesc = nodeData.businessHoursCondition 
        ? getBusinessHoursLabel(nodeData.businessHoursCondition)
        : 'Verifica horário de funcionamento';
    } else if (source === 'holiday') {
      firstDesc = nodeData.holidayCondition 
        ? (nodeData.holidayCondition === 'is_holiday' ? 'É feriado' : 'Não é feriado')
        : 'Verifica se é feriado';
    } else if (source === 'assigned_user') {
      firstDesc = nodeData.assignedUserCondition
        ? getAssignedUserLabel(nodeData.assignedUserCondition, nodeData.assignedUserName)
        : 'Verifica usuário atribuído';
    } else if (source === 'custom_field') {
      if (nodeData.customFieldName && nodeData.customFieldCondition) {
        const condLabel = getCustomFieldConditionLabel(nodeData.customFieldCondition);
        if (nodeData.customFieldCondition === 'is_empty' || nodeData.customFieldCondition === 'is_not_empty') {
          firstDesc = `Campo "${nodeData.customFieldName}" ${condLabel}`;
        } else {
          firstDesc = `Campo "${nodeData.customFieldName}" ${condLabel} "${nodeData.customFieldValue || ''}"`;
        }
      } else {
        firstDesc = 'Verifica campo personalizado';
      }
    } else if (source === 'media_type') {
      const mediaLabels: Record<string, string> = {
        is_image: 'É foto', is_video: 'É vídeo', is_audio: 'É áudio', is_any_media: 'É qualquer mídia',
      };
      firstDesc = nodeData.mediaTypeCondition ? (mediaLabels[nodeData.mediaTypeCondition] || 'Verifica tipo de mídia') : 'Verifica tipo de mídia';
    } else if (source === 'ai_enabled') {
      firstDesc = nodeData.aiEnabledCondition === 'is_disabled' ? 'IA desativada' : 'IA ativada';
    } else {
      firstDesc = 'Clique para configurar';
    }
    
    // If AND/OR logic, add indicator
    if (logicOp !== 'single' && nodeData.secondConditionSource) {
      const opLabel = logicOp === 'and' ? 'E' : 'OU';
      return `${firstDesc} ${opLabel} ...`;
    }
    
    return firstDesc;
  };

  const getSourceLabel = () => {
    const logicOp = nodeData.logicOperator || 'single';
    if (logicOp !== 'single') {
      return logicOp === 'and' ? 'AND' : 'OR';
    }
    switch (nodeData.conditionSource) {
      case 'tag': return 'Tag';
      case 'kanban': return 'Kanban';
      case 'business_hours': return 'Horário';
      case 'holiday': return 'Feriado';
      case 'assigned_user': return 'Atribuição';
      case 'custom_field': return 'Campo';
      case 'media_type': return 'Mídia';
      case 'ai_enabled': return 'IA';
      default: return 'Mensagem';
    }
  };

  const SourceIcon = getSourceIcon();

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !-top-2"
      />
      <Card className={`w-72 border-2 transition-all ${selected ? 'border-primary shadow-lg' : 'border-primary/60'} bg-gradient-to-br from-primary/5 to-primary/15`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <GitBranch className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-foreground">
                  Condição
                </h4>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
                  <SourceIcon className="w-3 h-3" />
                  {getSourceLabel()}
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {getDescription()}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-status-success" />
              <span className="text-muted-foreground">Sim</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Não</span>
              <div className="w-2 h-2 rounded-full bg-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Yes handle - left bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-status-success !border-2 !border-background !-bottom-2"
        style={{ left: '25%' }}
      />
      {/* No handle - right bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-destructive !border-2 !border-background !-bottom-2"
        style={{ left: '75%' }}
      />
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

export default ConditionNode;
