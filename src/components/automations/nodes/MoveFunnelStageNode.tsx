import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface MoveFunnelStageNodeData {
  label?: string;
  pipelineId?: string;
  stageName?: string;
}

const MoveFunnelStageNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as MoveFunnelStageNodeData;
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-background !-top-2"
      />
      <Card
        className={`w-64 border-2 transition-all ${
          selected ? 'border-emerald-500 shadow-lg' : 'border-emerald-500/40'
        } bg-gradient-to-br from-emerald-500/10 to-emerald-500/5`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">Mover Etapa do Funil</h4>
              <p className="text-xs text-muted-foreground truncate">
                {nodeData.stageName ? `→ ${nodeData.stageName}` : 'Clique para configurar'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

MoveFunnelStageNode.displayName = 'MoveFunnelStageNode';

export default MoveFunnelStageNode;
