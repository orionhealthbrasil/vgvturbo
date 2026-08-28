import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface SendEmailNodeData {
  label?: string;
  to?: string;
  customTo?: string;
  subject?: string;
  content?: string;
  htmlMode?: boolean;
  cc?: string;
  bcc?: string;
}

const SendEmailNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as SendEmailNodeData;

  const getDescription = () => {
    if (nodeData.subject) {
      return nodeData.subject.length > 40
        ? nodeData.subject.substring(0, 40) + '...'
        : nodeData.subject;
    }
    return 'Clique para configurar';
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !-top-2"
      />
      <Card
        className={`w-64 border-2 transition-all ${
          selected ? 'border-primary shadow-lg' : 'border-primary/60'
        } bg-gradient-to-br from-primary/10 to-primary/20`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Mail className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">Enviar Email</h4>
              <p className="text-xs text-muted-foreground truncate">{getDescription()}</p>
            </div>
          </div>
          {(nodeData.to || nodeData.customTo) && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              📧 Para: {nodeData.to === 'custom' ? nodeData.customTo : nodeData.to || '{email}'}
            </div>
          )}
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

SendEmailNode.displayName = 'SendEmailNode';

export default SendEmailNode;
