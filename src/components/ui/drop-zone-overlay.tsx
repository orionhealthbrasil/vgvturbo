import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function DropZoneOverlay({ isVisible, message = 'Solte os arquivos aqui' }: DropZoneOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "absolute inset-0 z-50 flex items-center justify-center",
      "bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg",
      "animate-in fade-in duration-200"
    )}>
      <div className="flex flex-col items-center gap-3 text-primary">
        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Upload className="h-8 w-8" />
        </div>
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">Imagens, vídeos, documentos e mais</p>
      </div>
    </div>
  );
}
