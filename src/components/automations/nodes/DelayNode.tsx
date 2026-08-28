import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface DelayNodeData {
  label?: string;
  duration?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days';
}

const DelayNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DelayNodeData;
  
  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'seconds': return 'segundo(s)';
      case 'minutes': return 'minuto(s)';
      case 'hours': return 'hora(s)';
      case 'days': return 'dia(s)';
      default: return unit;
    }
  };

  const getDescription = () => {
    if (nodeData.duration && nodeData.duration > 0) {
      return `Aguardar ${nodeData.duration} ${getUnitLabel(nodeData.unit || 'minutes')}`;
    }
    return 'Clique para configurar';
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-secondary-foreground !border-2 !border-background !-top-2"
      />
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-secondary shadow-lg' : 'border-secondary/60'} bg-gradient-to-br from-secondary/30 to-secondary/50`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-lg">
              <Clock className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Delay
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {getDescription()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-secondary-foreground !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

DelayNode.displayName = 'DelayNode';

export default DelayNode;
