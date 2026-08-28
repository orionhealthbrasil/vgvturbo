import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Webhook } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface WebhookNodeData {
  label?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT';
}

const WebhookNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as WebhookNodeData;
  
  const getDescription = () => {
    if (nodeData.url) {
      const method = nodeData.method || 'POST';
      return `${method}: ${nodeData.url.length > 25 ? nodeData.url.substring(0, 25) + '...' : nodeData.url}`;
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
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-secondary shadow-lg' : 'border-secondary/60'} bg-gradient-to-br from-secondary/20 to-secondary/40`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-lg">
              <Webhook className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Webhook
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

WebhookNode.displayName = 'WebhookNode';

export default WebhookNode;
