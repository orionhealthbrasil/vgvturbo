import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface ManageTagNodeData {
  label?: string;
  action?: 'add' | 'remove';
  tagName?: string;
}

const ManageTagNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ManageTagNodeData;
  
  const getDescription = () => {
    if (nodeData.tagName) {
      return `${nodeData.action === 'add' ? 'Adicionar' : 'Remover'} tag "${nodeData.tagName}"`;
    }
    return 'Clique para configurar';
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-muted-foreground !border-2 !border-background !-top-2"
      />
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-muted-foreground shadow-lg' : 'border-muted'} bg-gradient-to-br from-muted/50 to-muted`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted-foreground rounded-lg">
              <Tag className="w-5 h-5 text-background" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Gerenciar Tag
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
        className="!w-4 !h-4 !bg-muted-foreground !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

ManageTagNode.displayName = 'ManageTagNode';

export default ManageTagNode;
