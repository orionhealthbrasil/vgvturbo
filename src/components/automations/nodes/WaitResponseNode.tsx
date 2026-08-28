import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface WaitResponseNodeData {
  label?: string;
  timeout?: number;
  timeoutUnit?: 'minutes' | 'hours' | 'days';
}

const WaitResponseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as WaitResponseNodeData;

  const getTimeoutLabel = () => {
    if (nodeData.timeout && nodeData.timeoutUnit) {
      const unitLabels: Record<string, string> = {
        minutes: 'min',
        hours: 'h',
        days: 'd',
      };
      return `${nodeData.timeout}${unitLabels[nodeData.timeoutUnit] || nodeData.timeoutUnit}`;
    }
    return 'Não configurado';
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-teal-500 !border-2 !border-background !-top-2"
      />
      <Card className={`w-72 border-2 transition-all ${selected ? 'border-teal-500 shadow-lg' : 'border-teal-500/60'} bg-gradient-to-br from-teal-500/5 to-teal-500/15`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500 rounded-lg">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Aguardar Resposta
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                Timeout: {getTimeoutLabel()}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-status-success" />
              <span className="text-muted-foreground">Respondeu</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Timeout</span>
              <div className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Responded handle - left bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="responded"
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-status-success !border-2 !border-background !-bottom-2"
        style={{ left: '25%' }}
      />
      {/* Timeout handle - right bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="timeout"
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-background !-bottom-2"
        style={{ left: '75%' }}
      />
    </div>
  );
});

WaitResponseNode.displayName = 'WaitResponseNode';

export default WaitResponseNode;
