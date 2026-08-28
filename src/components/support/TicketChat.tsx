import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Paperclip, Loader2, ArrowLeft, CheckCircle2, RotateCcw, Mic, Image as ImageIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DropZoneOverlay } from '@/components/ui/drop-zone-overlay';
import { ImageViewer } from '@/components/crm/ImageViewer';
import { AudioPlayer } from '@/components/crm/AudioPlayer';
import { AudioRecorder } from '@/components/crm/AudioRecorder';
import { MediaCaptionDialog } from '@/components/crm/MediaCaptionDialog';
import { useFileDropPaste } from '@/hooks/useFileDropPaste';
import { SupportTicket, SupportMessage, useSupportMessages, useSendSupportMessage, useResolveTicket, useReopenTicket, uploadSupportMedia } from '@/hooks/useSupport';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TicketChatProps {
  ticket: SupportTicket;
  onBack?: () => void;
  canResolve?: boolean;
}

export function TicketChat({ ticket, onBack, canResolve }: TicketChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaCaptionFile, setMediaCaptionFile] = useState<File | null>(null);
  const [mediaCaptionType, setMediaCaptionType] = useState<'image' | 'video'>('image');
  const [showMediaCaption, setShowMediaCaption] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messagesData, isLoading } = useSupportMessages(ticket.id);
  const sendMessage = useSendSupportMessage();
  const resolveTicket = useResolveTicket();
  const reopenTicket = useReopenTicket();

  const allMessages = messagesData?.pages.flatMap(p => p.messages) || [];

  const handleFilesAdded = useCallback(async (files: File[]) => {
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (isImage || isVideo) {
        setMediaCaptionFile(file);
        setMediaCaptionType(isImage ? 'image' : 'video');
        setShowMediaCaption(true);
        return;
      }

      // Direct upload for documents/audio
      try {
        setIsSending(true);
        const url = await uploadSupportMedia(file);
        const type = file.type.startsWith('audio/') ? 'audio' : 'document';
        await sendMessage.mutateAsync({ ticketId: ticket.id, mediaUrl: url, messageType: type, content: file.name });
      } catch {
        toast.error('Erro ao enviar arquivo');
      } finally {
        setIsSending(false);
      }
    }
  }, [ticket.id, sendMessage]);

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, handlePaste, dropZoneRef } = useFileDropPaste({ onFilesAdded: handleFilesAdded });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    const text = message.trim();
    setMessage('');
    try {
      await sendMessage.mutateAsync({ ticketId: ticket.id, content: text });
    } catch {
      toast.error('Erro ao enviar mensagem');
      setMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMediaCaptionSend = async (caption: string) => {
    if (!mediaCaptionFile) return;
    try {
      setIsSending(true);
      setShowMediaCaption(false);
      const url = await uploadSupportMedia(mediaCaptionFile);
      const type = mediaCaptionFile.type.startsWith('image/') ? 'image' : 'video';
      await sendMessage.mutateAsync({ ticketId: ticket.id, mediaUrl: url, messageType: type, content: caption || undefined });
    } catch {
      toast.error('Erro ao enviar mídia');
    } finally {
      setIsSending(false);
      setMediaCaptionFile(null);
    }
  };

  const handleAudioRecorded = async (blob: Blob) => {
    setIsRecording(false);
    try {
      setIsSending(true);
      const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
      const url = await uploadSupportMedia(file);
      await sendMessage.mutateAsync({ ticketId: ticket.id, mediaUrl: url, messageType: 'audio' });
    } catch {
      toast.error('Erro ao enviar áudio');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFilesAdded(files);
    e.target.value = '';
  };

  const handleResolve = async () => {
    try {
      await resolveTicket.mutateAsync(ticket.id);
      toast.success('Chamado resolvido!');
    } catch {
      toast.error('Erro ao resolver chamado');
    }
  };

  const handleReopen = async () => {
    try {
      await reopenTicket.mutateAsync(ticket.id);
      toast.success('Chamado reaberto');
    } catch {
      toast.error('Erro ao reabrir chamado');
    }
  };

  return (
    <div ref={dropZoneRef} className="flex flex-col h-full min-h-0 overflow-hidden relative" onDragEnter={handleDragEnter as any} onDragLeave={handleDragLeave as any} onDragOver={handleDragOver as any} onDrop={handleDrop as any}>
      <DropZoneOverlay isVisible={isDragging} />

      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{ticket.subject}</h3>
          <div className="flex items-center gap-2">
            {ticket.organization_name && (
              <span className="text-xs text-muted-foreground">{ticket.organization_name}</span>
            )}
            <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'} className="text-xs">
              {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}
            </Badge>
          </div>
        </div>
        {canResolve && ticket.status === 'open' && (
          <Button size="sm" variant="outline" onClick={handleResolve}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Resolver
          </Button>
        )}
        {canResolve && ticket.status === 'resolved' && (
          <Button size="sm" variant="outline" onClick={handleReopen}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reabrir
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {allMessages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
              <div className={cn('flex gap-2 max-w-[75%]', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={msg.sender?.avatar_url || ''} />
                  <AvatarFallback className="text-xs">
                    {(msg.sender?.full_name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2 text-sm',
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-tr-md'
                      : 'bg-muted rounded-tl-md'
                  )}
                >
                  <p className="text-xs font-medium mb-1 opacity-70">
                    {msg.sender?.full_name || 'Usuário'}
                  </p>
                  {renderMessageContent(msg, setImageViewerUrl)}
                  <p className={cn('text-[10px] mt-1', isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                    {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        {isRecording ? (
          <AudioRecorder
            onRecordingComplete={(blob) => handleAudioRecorded(blob)}
            onCancel={() => setIsRecording(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              onChange={handleFileSelect}
              multiple
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setIsRecording(true)}
              disabled={isSending}
            >
              <Mic className="w-5 h-5" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste as any}
              placeholder="Digite sua mensagem... (Ctrl+V para colar print)"
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
              disabled={isSending}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || isSending}
              className="shrink-0"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </div>

      <ImageViewer src={imageViewerUrl || ''} open={!!imageViewerUrl} onOpenChange={(open) => { if (!open) setImageViewerUrl(null); }} />

      <MediaCaptionDialog
        open={showMediaCaption}
        onOpenChange={setShowMediaCaption}
        file={mediaCaptionFile}
        mediaType={mediaCaptionType}
        onSend={handleMediaCaptionSend}
        isSending={isSending}
      />
    </div>
  );
}

function renderMessageContent(
  msg: SupportMessage,
  onImageClick: (url: string) => void
) {
  switch (msg.message_type) {
    case 'image':
      return (
        <div className="space-y-1">
          {msg.media_url && (
            <img
              src={msg.media_url}
              alt="Imagem"
              className="rounded-lg max-w-full max-h-64 cursor-pointer object-cover"
              onClick={() => onImageClick(msg.media_url!)}
            />
          )}
          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
        </div>
      );
    case 'video':
      return (
        <div className="space-y-1">
          {msg.media_url && (
            <video src={msg.media_url} controls className="rounded-lg max-w-full max-h-64" />
          )}
          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
        </div>
      );
    case 'audio':
      return msg.media_url ? <AudioPlayer src={msg.media_url} isOutbound={false} /> : null;
    case 'document':
      return (
        <a
          href={msg.media_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 underline"
        >
          <FileText className="w-4 h-4" />
          {msg.content || 'Documento'}
        </a>
      );
    default:
      return msg.content ? <p className="whitespace-pre-wrap break-words">{msg.content}</p> : null;
  }
}
