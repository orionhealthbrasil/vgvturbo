import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, X, Image as ImageIcon, Video, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaCaptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single file (legacy). Prefer `files` for batch. */
  file?: File | null;
  /** Multiple files for batch send. Takes precedence over `file`. */
  files?: File[];
  mediaType?: 'image' | 'video';
  /** Single-file send (legacy). */
  onSend?: (caption: string) => void;
  /** Batch send. Receives one caption per file (same length/order). */
  onSendBatch?: (items: { file: File; caption: string }[]) => void;
  isSending: boolean;
}

interface PreviewItem {
  file: File;
  url: string;
  type: 'image' | 'video';
}

export function MediaCaptionDialog({
  open,
  onOpenChange,
  file,
  files,
  mediaType,
  onSend,
  onSendBatch,
  isSending,
}: MediaCaptionDialogProps) {
  // Normalize incoming files into a single array
  const incoming = useMemo<File[]>(() => {
    if (files && files.length > 0) return files;
    if (file) return [file];
    return [];
  }, [files, file]);

  const [items, setItems] = useState<PreviewItem[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [shareCaption, setShareCaption] = useState(false);

  // Build previews when files change / dialog opens
  useEffect(() => {
    if (!open) return;
    const built: PreviewItem[] = incoming.map((f) => {
      const isVideo = f.type.startsWith('video/') || mediaType === 'video';
      return {
        file: f,
        url: URL.createObjectURL(f),
        type: isVideo ? 'video' : 'image',
      };
    });
    setItems(built);
    setCaptions(built.map(() => ''));
    setActiveIdx(0);
    setShareCaption(false);
    return () => {
      built.forEach((it) => URL.revokeObjectURL(it.url));
    };
  }, [open, incoming, mediaType]);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setCaptions([]);
      setActiveIdx(0);
      setShareCaption(false);
    }
  }, [open]);

  const total = items.length;
  const active = items[activeIdx];
  const activeCaption = captions[activeIdx] || '';

  const updateCaption = (value: string) => {
    setCaptions((prev) => {
      if (shareCaption) return prev.map(() => value);
      const next = [...prev];
      next[activeIdx] = value;
      return next;
    });
  };

  const removeAt = (idx: number) => {
    if (total <= 1) return;
    URL.revokeObjectURL(items[idx].url);
    const nextItems = items.filter((_, i) => i !== idx);
    const nextCaps = captions.filter((_, i) => i !== idx);
    setItems(nextItems);
    setCaptions(nextCaps);
    setActiveIdx((cur) => Math.max(0, Math.min(cur, nextItems.length - 1)));
  };

  const handleSend = () => {
    if (total === 0) return;
    if (total === 1 && onSend) {
      onSend(activeCaption.trim());
      return;
    }
    if (onSendBatch) {
      onSendBatch(
        items.map((it, i) => ({ file: it.file, caption: (captions[i] || '').trim() }))
      );
    } else if (onSend) {
      // Fallback: caller didn't provide batch handler; send first only
      onSend(activeCaption.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const titleIcon =
    active?.type === 'video' ? (
      <Video className="w-5 h-5 text-primary" />
    ) : (
      <ImageIcon className="w-5 h-5 text-primary" />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {titleIcon}
            {total > 1
              ? `Enviar ${total} arquivos`
              : `Enviar ${active?.type === 'video' ? 'vídeo' : 'imagem'}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Active preview */}
          {active && (
            <div className="relative rounded-lg overflow-hidden bg-muted h-56 flex items-center justify-center">
              {active.type === 'image' ? (
                <img
                  src={active.url}
                  alt="Preview"
                  className="max-h-56 w-auto object-contain"
                />
              ) : (
                <video
                  src={active.url}
                  className="max-h-56 w-auto object-contain"
                  controls
                  muted
                />
              )}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                    disabled={activeIdx === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIdx((i) => Math.min(total - 1, i + 1))}
                    disabled={activeIdx === total - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-0.5 rounded-full text-xs">
                    {activeIdx + 1} / {total}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Thumbnails strip */}
          {total > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'relative shrink-0 rounded-md overflow-hidden cursor-pointer border-2 group',
                    idx === activeIdx ? 'border-primary' : 'border-transparent'
                  )}
                  onClick={() => setActiveIdx(idx)}
                >
                  {it.type === 'image' ? (
                    <img src={it.url} alt="" className="w-14 h-14 object-cover" />
                  ) : (
                    <div className="w-14 h-14 bg-black flex items-center justify-center">
                      <Video className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAt(idx);
                    }}
                    className="absolute top-0 right-0 bg-black/60 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remover"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Caption input */}
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione uma legenda (opcional)..."
              value={activeCaption}
              onChange={(e) => updateCaption(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none min-h-[70px]"
              maxLength={1024}
              autoFocus
            />
            <div className="flex items-center justify-between">
              {total > 1 ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={shareCaption}
                    onCheckedChange={(v) => {
                      const checked = v === true;
                      setShareCaption(checked);
                      if (checked) {
                        setCaptions((prev) => prev.map(() => activeCaption));
                      }
                    }}
                  />
                  Aplicar mesma legenda a todos
                </label>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground">{activeCaption.length}/1024</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || total === 0}
            className="bg-chat-outbound hover:bg-chat-outbound-hover text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSending
              ? 'Enviando...'
              : total > 1
                ? `Enviar ${total}`
                : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
