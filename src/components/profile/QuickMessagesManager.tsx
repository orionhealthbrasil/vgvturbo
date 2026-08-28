import { useState, useRef } from 'react';
import { Plus, Trash2, Edit2, FileText, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useQuickMessages,
  useCreateQuickMessage,
  useUpdateQuickMessage,
  useDeleteQuickMessage,
  QuickMessage,
} from '@/hooks/useQuickMessages';

export function QuickMessagesManager() {
  const { data: quickMessages = [], isLoading } = useQuickMessages();
  const createQuickMessage = useCreateQuickMessage();
  const updateQuickMessage = useUpdateQuickMessage();
  const deleteQuickMessage = useDeleteQuickMessage();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<QuickMessage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setShortcut('');
    setContent('');
    setMediaFile(null);
    setMediaPreview(null);
    setRemoveMedia(false);
    setEditingMessage(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (msg: QuickMessage) => {
    setEditingMessage(msg);
    setShortcut(msg.shortcut);
    setContent(msg.content || '');
    setMediaPreview(msg.media_url);
    setMediaFile(null);
    setRemoveMedia(false);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 50MB.');
      return;
    }

    setMediaFile(file);
    setRemoveMedia(false);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
    } else {
      setMediaPreview(null);
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setRemoveMedia(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!shortcut.trim()) return;

    if (editingMessage) {
      await updateQuickMessage.mutateAsync({
        id: editingMessage.id,
        shortcut: shortcut.trim(),
        content: content.trim(),
        mediaFile: mediaFile || undefined,
        removeMedia,
      });
    } else {
      await createQuickMessage.mutateAsync({
        shortcut: shortcut.trim(),
        content: content.trim(),
        mediaFile: mediaFile || undefined,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteQuickMessage.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const isSaving = createQuickMessage.isPending || updateQuickMessage.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Mensagens Rápidas</CardTitle>
            <CardDescription>
              Use atalhos como /orcamento no chat para enviar rapidamente
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : quickMessages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma mensagem rápida configurada.</p>
            <p className="text-sm mt-1">Clique em "Nova" para criar sua primeira.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {quickMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        /{msg.shortcut}
                      </Badge>
                      {msg.media_type && (
                        <Badge variant="outline" className="text-xs">
                          {msg.media_type === 'image' && <ImageIcon className="mr-1 w-3 h-3" />}
                          {msg.media_type === 'document' && <FileText className="mr-1 w-3 h-3" />}
                          {msg.media_type}
                        </Badge>
                      )}
                    </div>

                    {msg.content && (
                      <p className="text-sm text-muted-foreground truncate">
                        {msg.content}
                      </p>
                    )}

                    {msg.media_url && msg.media_type === 'image' && (
                      <img
                        src={msg.media_url}
                        alt={`Preview da mensagem rápida /${msg.shortcut}`}
                        className="mt-2 h-16 w-auto rounded object-cover"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(msg)}
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirm(msg.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Apagar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? 'Editar Mensagem Rápida' : 'Nova Mensagem Rápida'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shortcut">Atalho</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  /
                </span>
                <Input
                  id="shortcut"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value.replace(/\s/g, '_'))}
                  placeholder="orcamento"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digite no chat: /{shortcut || 'atalho'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Mensagem (opcional)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Texto da mensagem..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Mídia (opcional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />

              {mediaPreview || mediaFile ? (
                <div className="relative inline-block">
                  {mediaPreview && mediaFile?.type?.startsWith('image/') || 
                   (mediaPreview && !mediaFile && editingMessage?.media_type === 'image') ? (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="h-24 w-auto rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <FileText className="w-6 h-6" />
                      <span className="text-sm">
                        {mediaFile?.name || 'Arquivo anexado'}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveMedia}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Arquivo
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!shortcut.trim() || isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMessage ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
