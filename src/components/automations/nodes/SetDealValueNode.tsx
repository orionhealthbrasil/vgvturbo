import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type DealValueOperation = 'set' | 'add' | 'multiply';

export interface SetDealValueNodeData {
  label?: string;
  operation?: DealValueOperation;
  value?: string;
}

const opLabel: Record<DealValueOperation, string> = {
  set: 'Definir',
  add: 'Somar',
  multiply: 'Multiplicar',
};

const SetDealValueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as SetDealValueNodeData;
  const op = nodeData.operation || 'set';
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-emerald-600 !border-2 !border-background !-top-2"
      />
      <Card
        className={`w-64 border-2 transition-all ${
          selected ? 'border-emerald-600 shadow-lg' : 'border-emerald-600/40'
        } bg-gradient-to-br from-emerald-600/10 to-emerald-600/5`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">Definir Valor Potencial</h4>
              <p className="text-xs text-muted-foreground truncate">
                {nodeData.value
                  ? `${opLabel[op]}: ${nodeData.value}`
                  : 'Clique para configurar'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-emerald-600 !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

SetDealValueNode.displayName = 'SetDealValueNode';

export default SetDealValueNode;
