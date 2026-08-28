import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Save } from 'lucide-react';

export interface SaveResponseNodeData {
  label?: string;
  variableName?: string;
  timeout?: number;
  timeoutUnit?: string;
}

export const SaveResponseNode = memo(function SaveResponseNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as SaveResponseNodeData;
  const variableName = nodeData.variableName || 'resposta';

  return (
    <Card
      className={`w-64 shadow-md transition-shadow ${
        selected ? 'ring-2 ring-primary shadow-lg' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-rose-500" />
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-rose-500 text-white">
            <Save className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">Salvar Resposta</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Salvar como: <span className="font-mono text-rose-600 dark:text-rose-400">{`{${variableName}}`}</span>
          </p>
          {nodeData.timeout && (
            <p>Timeout: {nodeData.timeout} {nodeData.timeoutUnit === 'hours' ? 'hora(s)' : nodeData.timeoutUnit === 'days' ? 'dia(s)' : 'min'}</p>
          )}
        </div>
        <div className="mt-2 pt-2 border-t flex justify-between text-[10px] text-muted-foreground">
          <span className="text-primary">✓ Respondeu</span>
          <span className="text-amber-500">⏱ Timeout</span>
        </div>
      </CardContent>
      {/* Responded handle (left side) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="responded"
        className="!bg-primary !left-[25%]"
      />
      {/* Timeout handle (right side) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="timeout"
        className="!bg-amber-500 !left-[75%]"
      />
    </Card>
  );
});
