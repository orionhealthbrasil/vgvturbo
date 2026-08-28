import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BellRing } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface NotifyManagerNodeData {
  label?: string;
  notifyEventType?: string;
  context?: string;
}

const NotifyManagerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NotifyManagerNodeData;

  const getDescription = () => {
    if (nodeData.context) {
      return nodeData.context.length > 30 ? nodeData.context.substring(0, 30) + '...' : nodeData.context;
    }
    return 'Clique para configurar';
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-background !-top-2"
      />
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-amber-500 shadow-lg' : 'border-amber-500/60'} bg-gradient-to-br from-amber-500/20 to-amber-500/40`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">Notificar Gestor</h4>
              <p className="text-xs text-muted-foreground truncate">{getDescription()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

NotifyManagerNode.displayName = 'NotifyManagerNode';

export default NotifyManagerNode;
