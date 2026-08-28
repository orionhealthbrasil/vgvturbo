import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Link } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface ConnectFlowNodeData {
  label?: string;
  targetFlowId?: string;
  targetFlowName?: string;
}

const ConnectFlowNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ConnectFlowNodeData;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-background !-top-2"
      />
      <Card className={`w-72 border-2 transition-all ${selected ? 'border-violet-500 shadow-lg' : 'border-violet-500/60'} bg-gradient-to-br from-violet-500/5 to-violet-500/15`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500 rounded-lg">
              <Link className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Conectar Fluxo
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {nodeData.targetFlowName || 'Selecione um fluxo'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* No source handle - this node redirects to another flow */}
    </div>
  );
});

ConnectFlowNode.displayName = 'ConnectFlowNode';

export default ConnectFlowNode;
