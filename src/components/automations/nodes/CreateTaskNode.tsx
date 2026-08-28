import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface CreateTaskNodeData {
  label?: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string | null;
  areaId?: string | null;
  dueMode?: 'none' | 'in_days';
  dueDays?: number;
  assignMode?: 'assigned_user' | 'specific_user' | 'none';
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  linkContact?: boolean;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const CreateTaskNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as CreateTaskNodeData;
  const priority = d.priority || 'medium';
  return (
    <Card className={`w-56 shadow-md ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded bg-lime-600 text-white">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium truncate">
            {d.label || 'Criar Tarefa'}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {d.title || 'Sem título configurado'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Prioridade: {PRIORITY_LABEL[priority]}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Top} className="!bg-lime-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-lime-600 !w-3 !h-3" />
    </Card>
  );
});

CreateTaskNode.displayName = 'CreateTaskNode';
export default CreateTaskNode;
