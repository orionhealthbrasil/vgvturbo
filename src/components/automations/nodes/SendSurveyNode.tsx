import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface SendSurveyNodeData {
  label?: string;
  message?: string;
}

const SendSurveyNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as SendSurveyNodeData;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={true}
        className="!w-4 !h-4 !bg-yellow-500 !border-2 !border-background !-top-2"
      />
      <Card className={`w-64 border-2 transition-all ${selected ? 'border-yellow-500 shadow-lg' : 'border-yellow-500/60'} bg-gradient-to-br from-yellow-500/10 to-yellow-500/20`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500 rounded-lg">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">
                Pesquisa de Satisfação
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {nodeData.message
                  ? nodeData.message.length > 40
                    ? nodeData.message.substring(0, 40) + '...'
                    : nodeData.message
                  : 'Envia link de avaliação'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableEnd={true}
        className="!w-4 !h-4 !bg-yellow-500 !border-2 !border-background !-bottom-2"
      />
    </div>
  );
});

SendSurveyNode.displayName = 'SendSurveyNode';

export default SendSurveyNode;
