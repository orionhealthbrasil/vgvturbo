import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CalendarClock } from 'lucide-react';

export interface ScheduleMessageNodeData {
  label?: string;
  message?: string;
  offsetDays?: number;
}

export default function ScheduleMessageNode({ selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-card shadow-md min-w-[180px] transition-all ${
        selected ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-sky-500/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-sky-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-sky-500 text-white">
          <CalendarClock className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium">Agendar Mensagem</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !w-3 !h-3" />
    </div>
  );
}
