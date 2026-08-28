import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface ToggleAiNodeData {
  label?: string;
  aiAction?: 'enable' | 'disable';
  aiAgentId?: string;
}

const ToggleAiNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ToggleAiNodeData;
  const action = nodeData.aiAction || 'enable';

  return (
    <Card className={`w-56 shadow-md ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded bg-violet-500 text-white">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium truncate">
            {nodeData.label || 'IA do Contato'}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {action === 'enable' ? '✅ Ativar IA' : '⛔ Desativar IA'}
        </p>
      </CardContent>
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3" />
    </Card>
  );
});

ToggleAiNode.displayName = 'ToggleAiNode';
export default ToggleAiNode;
