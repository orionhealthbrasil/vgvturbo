import { useState } from 'react';
import { format } from 'date-fns';
import { Paperclip, Download, X, Image as ImageIcon, FileText, File as FileIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadTaskAttachment, useDeleteTaskAttachment } from '@/hooks/useTaskAttachments';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { TaskAttachment } from '@/types/tasks';

interface Props {
  taskId: string;
  attachments: TaskAttachment[];
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}
function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

export function TaskAttachmentsList({ taskId, attachments }: Props) {
  const { user } = useAuth();
  const upload = useUploadTaskAttachment();
  const del = useDeleteTaskAttachment();
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: arquivo > 25MB`);
        continue;
      }
      try {
        await upload.mutateAsync({ task_id: taskId, file });
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message ?? 'falha no upload'}`);
      }
    }
  };

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Anexos ({attachments.length})</h4>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={
          'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground transition-colors ' +
          (dragOver ? 'bg-accent border-primary' : 'hover:bg-muted/50')
        }
      >
        <label className="cursor-pointer flex items-center justify-center gap-2">
          <Paperclip className="w-4 h-4" />
          <span>Arraste arquivos ou clique para anexar</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {upload.isPending && (
          <div className="mt-2 flex items-center justify-center gap-1 text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Enviando...
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {attachments.map((a) => {
            const img = isImage(a.file_name);
            const pdf = isPdf(a.file_name);
            const Icon = img ? ImageIcon : pdf ? FileText : FileIcon;
            const canDelete = user?.id === a.uploaded_by;
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 p-2 rounded-md border bg-card group hover:bg-accent/40 transition-colors"
              >
                {img ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(a.file_url)}
                    className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0"
                  >
                    <img src={a.file_url} alt={a.file_name} className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{a.file_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatBytes(a.file_size)} · {format(new Date(a.created_at), 'dd/MM HH:mm')}
                  </div>
                </div>
                <a href={a.file_url} target="_blank" rel="noreferrer" download>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </a>
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      del.mutate({ id: a.id, file_url: a.file_url, task_id: taskId })
                    }
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
