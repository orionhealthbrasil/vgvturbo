import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface AssignNodeData {
  label?: string;
  assignTo?: 'specific' | 'round_robin' | 'least_busy' | 'random';
  memberId?: string;
  memberName?: string;
  memberIds?: string[]; // For random distribution - multiple members
  memberNames?: string[]; // Names of selected members for display
}

const AssignNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as AssignNodeData;
  
  const getDescription = () => {
    switch (nodeData.assignTo) {
      case 'specific':
        return nodeData.memberName ? `Atribuir para ${nodeData.memberName}` : 'Membro específico';
      case 'round_robin':
        return 'Distribuição rotativa';
      case 'least_busy':
        return 'Membro menos ocupado';
      case 'random':
        const count = nodeData.memberIds?.length || 0;
        return count > 0 ? `Aleatório entre ${count} membros` : 'Distribuição aleatória';
      default:
        return 'Clique para configurar';
    }
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !-top-2"
      />
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-primary shadow-lg' : 'border-primary/60'} bg-gradient-to-br from-primary/10 to-primary/25`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <UserPlus className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Atribuir Conversa
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
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

AssignNode.displayName = 'AssignNode';

export default AssignNode;
