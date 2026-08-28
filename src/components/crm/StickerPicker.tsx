import { useStickers } from '@/hooks/useStickers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
  onClose: () => void;
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const { data: stickers, isLoading } = useStickers();

  if (isLoading) {
    return (
      <div className="absolute bottom-full left-0 mb-2 bg-popover border rounded-lg shadow-lg p-4 w-72">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!stickers || stickers.length === 0) {
    return (
      <div className="absolute bottom-full left-0 mb-2 bg-popover border rounded-lg shadow-lg p-4 w-72">
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma figurinha salva.
          <br />
          <span className="text-xs">
            Clique com botão direito em figurinhas recebidas para salvar.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-popover border rounded-lg shadow-lg w-72 z-50">
      <div className="p-2 border-b">
        <p className="text-sm font-medium">Minhas Figurinhas</p>
      </div>
      <ScrollArea className="h-64">
        <div className="grid grid-cols-4 gap-1 p-2">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => {
                onSelect(sticker.sticker_url);
                onClose();
              }}
              className="aspect-square rounded hover:bg-muted transition-colors p-1"
              title={sticker.name || 'Figurinha'}
            >
              <img
                src={sticker.sticker_url}
                alt={sticker.name || 'Sticker'}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
