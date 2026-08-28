import { useState, useRef } from 'react';
import { Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnimatedStickerDialog } from '@/components/ui/animated-sticker-dialog';
import { useStickers, useAddSticker, useDeleteSticker } from '@/hooks/useStickers';
import { toast } from 'sonner';

export function StickersManager() {
  const { data: stickers, isLoading } = useStickers();
  const addSticker = useAddSticker();
  const deleteSticker = useDeleteSticker();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAnimatedStickerDialog, setShowAnimatedStickerDialog] = useState(false);

  const isAnimatedFile = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        
        // Check for animated WebP (ANIM/ANMF chunks)
        const riff = String.fromCharCode(...bytes.slice(0, 4));
        const webp = bytes.length > 11 ? String.fromCharCode(...bytes.slice(8, 12)) : '';
        
        if (riff === 'RIFF' && webp === 'WEBP') {
          for (let i = 12; i < Math.min(bytes.length - 4, 16384); i++) {
            const chunk = String.fromCharCode(...bytes.slice(i, i + 4));
            if (chunk === 'ANIM' || chunk === 'ANMF') {
              resolve(true);
              return;
            }
          }
          resolve(false);
          return;
        }
        
        // Check for animated GIF (multiple image blocks)
        const gif = String.fromCharCode(...bytes.slice(0, 6));
        if (gif.startsWith('GIF')) {
          let imageBlockCount = 0;
          for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] === 0x2C) {
              imageBlockCount++;
              if (imageBlockCount > 1) {
                resolve(true);
                return;
              }
            }
            if (bytes[i] === 0x3B) break;
          }
          resolve(false);
          return;
        }
        
        resolve(false);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue;
      }

      // Check if the file is animated
      const isAnimated = await isAnimatedFile(file);
      if (isAnimated) {
        setShowAnimatedStickerDialog(true);
        continue;
      }

      await addSticker.mutateAsync({ file });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Minhas Figurinhas
        </CardTitle>
        <CardDescription>
          Figurinhas salvas para enviar no WhatsApp e Chat Interno
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={addSticker.isPending}
              className="w-full"
            >
              {addSticker.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Adicionar Figurinha
            </Button>
          </div>

          {/* Stickers grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !stickers || stickers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma figurinha salva</p>
              <p className="text-xs mt-1">
                Adicione imagens ou salve figurinhas recebidas no chat
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {stickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className="relative group aspect-square rounded-lg border bg-muted/50 p-1"
                  >
                    <img
                      src={sticker.sticker_url}
                      alt={sticker.name || 'Sticker'}
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={() => deleteSticker.mutate(sticker.id)}
                      className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={deleteSticker.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>

      {/* Animated Sticker Warning Dialog */}
      <AnimatedStickerDialog
        open={showAnimatedStickerDialog}
        onOpenChange={setShowAnimatedStickerDialog}
      />
    </Card>
  );
}
