import { Forward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageSelectionBarProps {
  selectedCount: number;
  onForward: () => void;
  onCancel: () => void;
}

export function MessageSelectionBar({ selectedCount, onForward, onCancel }: MessageSelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bg-card border rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onCancel}
      >
        <X className="w-4 h-4" />
      </Button>
      <span className="text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'mensagem' : 'mensagens'}
      </span>
      <Button
        size="sm"
        className="gap-2"
        onClick={onForward}
      >
        <Forward className="w-4 h-4" />
        Encaminhar
      </Button>
    </div>
  );
}
