import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Brain } from 'lucide-react';

export interface AnalyzeConversationNodeData {
  label?: string;
  agentId?: string;
  contextMessages?: number;
  additionalPrompt?: string;
}

export default function AnalyzeConversationNode({ selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-card shadow-md min-w-[180px] transition-all ${
        selected ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/20' : 'border-fuchsia-500/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-fuchsia-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-fuchsia-500 text-white">
          <Brain className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium">Analisar Conversa</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-fuchsia-500 !w-3 !h-3" />
    </div>
  );
}
