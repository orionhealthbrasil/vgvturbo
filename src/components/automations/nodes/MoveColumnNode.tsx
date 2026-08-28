import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface MoveColumnNodeData {
  label?: string;
  columnName?: string;
}

const MoveColumnNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as MoveColumnNodeData;
  
  const getDescription = () => {
    if (nodeData.columnName) {
      return `Mover para "${nodeData.columnName}"`;
    }
    return 'Clique para configurar';
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-accent !border-2 !border-background !-top-2"
      />
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-accent shadow-lg' : 'border-accent/60'} bg-gradient-to-br from-accent/20 to-accent/40`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Mover no Kanban
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
        className="!w-4 !h-4 !bg-accent !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

MoveColumnNode.displayName = 'MoveColumnNode';

export default MoveColumnNode;
