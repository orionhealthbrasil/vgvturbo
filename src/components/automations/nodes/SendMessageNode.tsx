import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface SendMessageNodeData {
  label?: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

const SendMessageNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as SendMessageNodeData;
  
  const getDescription = () => {
    if (nodeData.message) {
      return nodeData.message.length > 40 
        ? nodeData.message.substring(0, 40) + '...' 
        : nodeData.message;
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
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-accent shadow-lg' : 'border-accent/60'} bg-gradient-to-br from-accent/10 to-accent/20`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent rounded-lg">
              <MessageSquare className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Enviar Mensagem
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {getDescription()}
              </p>
            </div>
          </div>
          {nodeData.mediaUrl && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              📎 Mídia anexada
            </div>
          )}
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

SendMessageNode.displayName = 'SendMessageNode';

export default SendMessageNode;
