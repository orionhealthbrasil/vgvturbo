import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles } from 'lucide-react';

export interface TriggerSdrNodeData {
  label?: string;
  agentId?: string;
  additionalInstructions?: string;
}

export default function TriggerSdrNode({ selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-card shadow-md min-w-[180px] transition-all ${
        selected ? 'border-pink-500 ring-2 ring-pink-500/20' : 'border-pink-500/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-pink-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-pink-500 text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium">Acionar SDR</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-pink-500 !w-3 !h-3" />
    </div>
  );
}
