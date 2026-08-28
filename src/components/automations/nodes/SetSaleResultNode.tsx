import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type SaleResult = 'won' | 'lost';

export interface SetSaleResultNodeData {
  label?: string;
  result?: SaleResult;
  lossReason?: string;
}

const SetSaleResultNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as SetSaleResultNodeData;
  const isWon = nodeData.result === 'won';
  const color = isWon ? 'emerald-500' : 'rose-500';
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableEnd={true}
        className={`!w-4 !h-4 !bg-${color} !border-2 !border-background !-top-2`}
      />
      <Card
        className={`w-64 border-2 transition-all ${
          selected
            ? isWon
              ? 'border-emerald-500 shadow-lg'
              : 'border-rose-500 shadow-lg'
            : isWon
            ? 'border-emerald-500/40'
            : 'border-rose-500/40'
        } ${
          isWon
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
            : 'bg-gradient-to-br from-rose-500/10 to-rose-500/5'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${isWon ? 'bg-emerald-500' : 'bg-rose-500'} rounded-lg`}>
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">Marcar Resultado</h4>
              <p className="text-xs text-muted-foreground truncate">
                {nodeData.result
                  ? isWon
                    ? '🏆 Venda ganha'
                    : `Venda perdida${nodeData.lossReason ? ` — ${nodeData.lossReason}` : ''}`
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
        className={`!w-4 !h-4 !bg-${color} !border-2 !border-background !-bottom-2`}
      />
    </div>
  );
});

SetSaleResultNode.displayName = 'SetSaleResultNode';

export default SetSaleResultNode;
