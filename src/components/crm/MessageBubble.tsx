import { useState } from 'react';
import { FileText, FileSpreadsheet, FileArchive, FileCode, FileImage, FileVideo, FileAudio, File as FileIcon, Download, CheckCheck, Clock, AlertCircle, RotateCcw, Reply, Upload, Bookmark, Trash2, User, Phone, MessageCircle, Pencil, Forward, MapPin, ExternalLink, Eye, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Message } from '@/types/crm';
import { ImageViewer } from './ImageViewer';
import { AudioPlayer } from './AudioPlayer';
import { cn } from '@/lib/utils';
import { linkifyPhoneNumbers } from '@/lib/phone-link';
import { linkifyText } from '@/lib/linkify';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (message: Message) => void;
  onReply?: (message: Message) => void;
  onSaveSticker?: (stickerUrl: string) => void;
  onDeleteMessage?: (messageId: string, deleteForEveryone: boolean) => void;
  onEditMessage?: (message: Message) => void;
  onPhoneClick?: (phone: string) => void;
  onQuoteClick?: (quotedMessageId: string) => void;
  onForward?: (message: Message) => void;
  quotedMessage?: Message;
  isSelecting?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function MessageBubble({ message, onRetry, onReply, onSaveSticker, onDeleteMessage, onEditMessage, onPhoneClick, onQuoteClick, onForward, quotedMessage, isSelecting, isSelected, onToggleSelect }: MessageBubbleProps) {
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { showSenderName } = useChatPreferences();
  const [showTranscription, setShowTranscription] = useState(false);
  const isOutbound = message.direction === 'outbound';
  const isFailed = message.status === 'failed';
  const isPending = message.status === 'pending';
  const isMediaMessage = ['image', 'audio', 'video', 'ig_reel', 'ig_post', 'ig_story', 'document', 'sticker'].includes(message.message_type);
  const isSticker = message.message_type === 'sticker';

  const getQuotedPreview = () => {
    if (!quotedMessage && !message.quoted_content) return null;
    
    const content = quotedMessage?.content || message.quoted_content;
    const type = quotedMessage?.message_type || message.quoted_type || 'text';
    
    const truncateText = (text: string, maxLength: number = 50) => {
      if (!text) return '';
      return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    };
    
    if (type === 'image') return '📷 Imagem';
    if (type === 'audio') return '🎵 Áudio';
    if (type === 'video') return '🎬 Vídeo';
    // INSTAGRAM_HIDDEN: if (type === 'ig_reel') return '🎬 Reel do Instagram';
    // INSTAGRAM_HIDDEN: if (type === 'ig_post') return '🖼️ Post do Instagram';
    // INSTAGRAM_HIDDEN: if (type === 'ig_story') return '⭕ Story do Instagram';
    if (type === 'document') return '📄 Documento';
    if (type === 'sticker') return '🎨 Figurinha';
    if (type === 'location') return '📍 Localização';
    if (type === 'contact') {
      try {
        const contactData = JSON.parse(content || '{}');
        return `👤 ${contactData.displayName || 'Contato'}`;
      } catch {
        return '👤 Contato';
      }
    }
    if (type === 'contacts') {
      try {
        const contactsData = JSON.parse(content || '{}');
        const count = contactsData.contacts?.length || 0;
        return `👥 ${count} contato${count !== 1 ? 's' : ''}`;
      } catch {
        return '👥 Contatos';
      }
    }
    return truncateText(content || '', 50);
  };

  const TranscriptionToggle = ({ transcription, type, isOutbound: outbound, showTranscription: show, setShowTranscription: setShow, messageCreatedAt }: {
    transcription?: string | null;
    type: 'audio' | 'image' | 'video';
    isOutbound: boolean;
    showTranscription: boolean;
    setShowTranscription: (v: boolean) => void;
    messageCreatedAt?: string;
  }) => {
    const label = type === 'audio' ? 'Transcrição' : 'Descrição IA';
    const Icon = type === 'audio' ? FileText : Eye;

    if (outbound && !transcription) return null;

    const isRecent = messageCreatedAt
      ? (Date.now() - new Date(messageCreatedAt).getTime()) < 2 * 60 * 1000
      : false;

    const isProcessing = !transcription && isRecent;
    const isUnavailable = !transcription && !isRecent;

    if (isUnavailable) return null;

    return (
      <div className="mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); if (!isProcessing) setShow(!show); }}
          className={cn(
            'flex items-center gap-1 text-[11px] transition-colors',
            outbound ? 'text-white/60 hover:text-white/90' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="w-3 h-3" />
          {label}
          {isProcessing ? (
            <Loader2 className="w-3 h-3 animate-spin ml-0.5" />
          ) : show ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
        {show && transcription && (
          <p className={cn(
            'text-xs mt-1 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed',
            outbound ? 'text-white/80' : 'text-foreground/80'
          )}>
            {transcription}
          </p>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // Upload progress overlay for pending media
    const uploadOverlay = isPending && isMediaMessage && (
      <div className="absolute inset-0 bg-black/40 rounded-lg flex flex-col items-center justify-center gap-2 z-10">
        <Upload className="w-6 h-6 text-white animate-pulse" />
        <div className="w-3/4 max-w-[150px]">
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full animate-progress-indeterminate" />
          </div>
        </div>
        <span className="text-xs text-white font-medium">Enviando...</span>
      </div>
    );

    switch (message.message_type) {
      case 'sticker':
        // Stickers render without bubble background
        return (
          <ContextMenu>
            <ContextMenuTrigger>
              <div 
                className="cursor-pointer"
                onClick={() => !isPending && setImageViewerOpen(true)}
              >
                <img
                  src={message.media_url || ''}
                  alt="Figurinha"
                  className={cn(
                    "max-w-[150px] max-h-[150px] object-contain transition-opacity",
                    isPending ? "opacity-70" : "hover:opacity-90"
                  )}
                />
                {uploadOverlay}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {onSaveSticker && message.media_url && !isOutbound && (
                <ContextMenuItem onClick={() => onSaveSticker(message.media_url!)}>
                  <Bookmark className="w-4 h-4 mr-2" />
                  Salvar figurinha
                </ContextMenuItem>
              )}
              {onDeleteMessage && (
                <>
                  {(onSaveSticker && message.media_url && !isOutbound) && <ContextMenuSeparator />}
                  <ContextMenuItem 
                    onClick={() => onDeleteMessage(message.id, false)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Apagar só para mim
                  </ContextMenuItem>
                  {isOutbound && message.whatsapp_message_id && (
                    <ContextMenuItem 
                      onClick={() => onDeleteMessage(message.id, true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Apagar para todos
                    </ContextMenuItem>
                  )}
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        );

      case 'image':
        const handleImageDownload = async (e: React.MouseEvent) => {
          e.stopPropagation();
          if (!message.media_url) return;
          try {
            const response = await fetch(message.media_url);
            const blob = await response.blob();
            const ext = blob.type.split('/')[1] || 'jpg';
            const filename = message.media_url.split('/').pop()?.split('?')[0] || `imagem.${ext}`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          } catch {
            window.open(message.media_url, '_blank');
          }
        };
        return (
          <ContextMenu>
            <ContextMenuTrigger>
              <>
                <div
                  className="cursor-pointer rounded-lg overflow-hidden relative group/img"
                  onClick={() => !isPending && setImageViewerOpen(true)}
                >
                  <img
                    src={message.media_url || ''}
                    alt="Imagem"
                    className={cn(
                      "max-w-[280px] max-h-[300px] object-cover rounded-lg transition-opacity",
                      isPending ? "opacity-70" : "hover:opacity-90"
                    )}
                  />
                  {!isPending && message.media_url && (
                    <button
                      type="button"
                      onClick={handleImageDownload}
                      className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-black/70"
                      title="Baixar imagem"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {uploadOverlay}
                </div>
                {message.content && (
                <p className="text-sm max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-2">{linkifyText(message.content)}</p>

                )}
                <TranscriptionToggle
                  transcription={message.transcription}
                  type="image"
                  isOutbound={isOutbound}
                  showTranscription={showTranscription}
                  setShowTranscription={setShowTranscription}
                  messageCreatedAt={message.created_at}
                />
                <ImageViewer
                  src={message.media_url || ''}
                  open={imageViewerOpen}
                  onOpenChange={setImageViewerOpen}
                />
              </>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {message.media_url && (
                <ContextMenuItem onClick={handleImageDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar imagem
                </ContextMenuItem>
              )}
              {onSaveSticker && message.media_url && !isOutbound && (
                <>
                  {message.media_url && <ContextMenuSeparator />}
                  <ContextMenuItem onClick={() => onSaveSticker(message.media_url!)}>
                    <Bookmark className="w-4 h-4 mr-2" />
                    Salvar como figurinha
                  </ContextMenuItem>
                </>
              )}
              {onDeleteMessage && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => onDeleteMessage(message.id, false)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Apagar só para mim
                  </ContextMenuItem>
                  {isOutbound && message.whatsapp_message_id && (
                    <ContextMenuItem
                      onClick={() => onDeleteMessage(message.id, true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Apagar para todos
                    </ContextMenuItem>
                  )}
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        );

      case 'audio':
        return (
          <div className="min-w-[250px] relative">
            {isPending ? (
              <div className="h-14 bg-primary-foreground/10 rounded-lg flex items-center justify-center gap-2">
                <Upload className="w-5 h-5 animate-pulse" />
                <div className="flex-1 max-w-[120px]">
                  <div className="h-1.5 bg-primary-foreground/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-foreground rounded-full animate-progress-indeterminate" />
                  </div>
                </div>
                <span className="text-xs opacity-70">Enviando...</span>
              </div>
            ) : (
              <AudioPlayer src={message.media_url || ''} isOutbound={isOutbound} />
            )}
            {!isPending && (
              <TranscriptionToggle
                transcription={message.transcription}
                type="audio"
                isOutbound={isOutbound}
                showTranscription={showTranscription}
                setShowTranscription={setShowTranscription}
                messageCreatedAt={message.created_at}
              />
            )}
          </div>
        );

      /* INSTAGRAM_HIDDEN:
      case 'ig_reel':
      case 'ig_post':
      case 'ig_story': {
        const igLabels: Record<string, string> = {
          ig_reel: 'Reel do Instagram',
          ig_post: 'Post do Instagram',
          ig_story: 'Story do Instagram',
        };
        return (
          <div className="rounded-lg overflow-hidden border border-border bg-muted/40 p-3 flex items-center gap-3 max-w-[280px]">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{igLabels[message.message_type] ?? 'Instagram'}</p>
              {message.media_url ? (
                <a
                  href={message.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir no Instagram
                </a>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {message.message_type === 'ig_story' ? 'Story expirado ou indisponível' : 'Link indisponível'}
                </p>
              )}
            </div>
          </div>
        );
      }
      */

      case 'video':
        return (
          <div className="rounded-lg overflow-hidden relative">
            <video
              src={message.media_url || ''}
              controls={!isPending}
              playsInline
              className={cn(
                "max-w-[320px] max-h-[240px] rounded-lg",
                isPending && "opacity-70"
              )}
              style={{ objectFit: 'contain' }}
            />
            {uploadOverlay}
            {message.content && (
              <p className="text-sm max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-2">{linkifyText(message.content)}</p>
            )}
            <TranscriptionToggle
              transcription={message.transcription}
              type="video"
              isOutbound={isOutbound}
              showTranscription={showTranscription}
              setShowTranscription={setShowTranscription}
              messageCreatedAt={message.created_at}
            />
          </div>
        );

      case 'document': {
        const filename = message.content || 'documento';
        const ext = (filename.split('.').pop() || '').toLowerCase();
        const getDocIcon = () => {
          if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) return FileSpreadsheet;
          if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
          if (['json', 'xml', 'html', 'js', 'ts', 'css', 'md', 'yaml', 'yml'].includes(ext)) return FileCode;
          if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return FileImage;
          if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return FileVideo;
          if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus'].includes(ext)) return FileAudio;
          if (['pdf', 'doc', 'docx', 'rtf', 'odt', 'txt', 'ppt', 'pptx'].includes(ext)) return FileText;
          return FileIcon;
        };
        const DocIcon = getDocIcon();
        const extLabel = ext ? ext.toUpperCase() : 'ARQUIVO';

        const handleDocumentDownload = async (e: React.MouseEvent) => {
          e.preventDefault();
          const url = message.media_url;
          if (!url) return;
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          } catch {
            window.open(url, '_blank');
          }
        };

        return isPending ? (
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg',
            isOutbound ? 'bg-primary-foreground/10' : 'bg-muted'
          )}>
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isOutbound ? 'bg-primary-foreground/20' : 'bg-background'
            )}>
              <Upload className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <p className="text-sm font-medium line-clamp-1 break-all [overflow-wrap:anywhere]" title={filename}>{filename}</p>
              <div className="mt-1 h-1.5 bg-primary-foreground/30 rounded-full overflow-hidden">
                <div className="h-full bg-primary-foreground rounded-full animate-progress-indeterminate" />
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleDocumentDownload}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg transition-colors w-full max-w-full min-w-0 text-left overflow-hidden',
              isOutbound
                ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            <div className={cn(
              'w-10 h-10 shrink-0 rounded-lg flex items-center justify-center',
              isOutbound ? 'bg-primary-foreground/20' : 'bg-background'
            )}>
              <DocIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <p className="text-sm font-medium line-clamp-1 break-all [overflow-wrap:anywhere]" title={filename}>{filename}</p>
              <p className={cn(
                'text-xs line-clamp-1 break-all',
                isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}>
                {extLabel} · Clique para baixar
              </p>
            </div>
            <Download className="w-4 h-4 shrink-0" />
          </button>
        );
      }

      case 'contact': {
        // Parse contact info from JSON content
        let contactData: { displayName?: string; phone?: string } = { displayName: 'Contato', phone: '' };
        try {
          contactData = JSON.parse(message.content || '{}');
        } catch {
          // Fallback if not JSON
          contactData.displayName = message.content || 'Contato';
        }
        return (
          <div className={cn(
            'rounded-lg overflow-hidden min-w-[200px]',
            isOutbound ? 'bg-white/10' : 'bg-muted/50'
          )}>
            <div className="flex items-center gap-3 p-3 border-b border-border/30">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isOutbound ? 'bg-white/20' : 'bg-muted'
              )}>
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{contactData.displayName}</p>
                {contactData.phone && (
                  <p className={cn(
                    'text-xs truncate',
                    isOutbound ? 'text-white/70' : 'text-muted-foreground'
                  )}>
                    {contactData.phone}
                  </p>
                )}
              </div>
            </div>
            {contactData.phone && onPhoneClick && (
              <button 
                onClick={() => onPhoneClick(contactData.phone!)}
                className={cn(
                  'w-full py-2 px-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  isOutbound 
                    ? 'text-white/90 hover:bg-white/10' 
                    : 'text-primary hover:bg-muted/80'
                )}
              >
                <MessageCircle className="w-4 h-4" />
                Conversar
              </button>
            )}
          </div>
        );
      }

      case 'contacts': {
        // Parse multiple contacts from JSON content
        let contactsData: { contacts?: Array<{ displayName?: string; phone?: string }> } = { contacts: [] };
        try {
          contactsData = JSON.parse(message.content || '{}');
        } catch {
          // Fallback
        }
        const contacts = contactsData.contacts || [];
        return (
          <div className={cn(
            'rounded-lg overflow-hidden min-w-[200px]',
            isOutbound ? 'bg-white/10' : 'bg-muted/50'
          )}>
            {contacts.map((contact, idx) => (
              <div key={idx} className={cn(
                'p-3',
                idx < contacts.length - 1 && 'border-b border-border/30'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isOutbound ? 'bg-white/20' : 'bg-muted'
                  )}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{contact.displayName}</p>
                  </div>
                  {contact.phone && onPhoneClick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onPhoneClick(contact.phone!)}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case 'location': {
        let locationData: { latitude?: number; longitude?: number; name?: string; address?: string } = {};
        try {
          locationData = JSON.parse(message.content || '{}');
        } catch {
          // fallback
        }
        const lat = locationData.latitude;
        const lng = locationData.longitude;
        const hasCoords = lat !== undefined && lng !== undefined;
        const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : '#';
        
        return (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'block rounded-lg overflow-hidden min-w-[220px] max-w-[280px] transition-opacity hover:opacity-90',
            )}
          >
            {hasCoords && (
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=280x150&markers=color:red%7C${lat},${lng}&key=`}
                alt="Mapa"
                className="w-full h-[120px] object-cover bg-muted"
                onError={(e) => {
                  // If static map fails (no API key), hide the image
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className={cn(
              'p-3 flex items-start gap-2',
              isOutbound ? 'bg-primary-foreground/10' : 'bg-muted/50'
            )}>
              <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {locationData.name || 'Localização'}
                </p>
                {locationData.address && (
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {locationData.address}
                  </p>
                )}
                {hasCoords && (
                  <p className={cn(
                    'text-xs mt-1 flex items-center gap-1',
                    isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  )}>
                    <ExternalLink className="w-3 h-3" />
                    Abrir no Google Maps
                  </p>
                )}
              </div>
            </div>
          </a>
        );
      }

      default:
        return (
          <p className="text-sm max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{linkifyText(message.content || '', { onPhoneClick })}</p>
        );
    }
  };

  const getStatusIcon = () => {
    const iconClass = "w-3.5 h-3.5";
    switch (message.status) {
      case 'pending':
        return <Clock className={iconClass} />;
      case 'failed':
        return <AlertCircle className={cn(iconClass, 'text-destructive')} />;
      default:
        // sent, delivered, read — all show ✓✓
        return <CheckCheck className={iconClass} />;
    }
  };

  const quotedPreview = getQuotedPreview();

  // Stickers have special rendering without bubble
  if (isSticker) {
    return (
      <div 
        className={cn('flex items-end gap-2 group', isOutbound && 'flex-row-reverse')}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {onReply && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 opacity-0 transition-opacity',
              showActions && 'opacity-100'
            )}
            onClick={() => onReply(message)}
          >
            <Reply className="w-4 h-4" />
          </Button>
        )}
        
        <div className="max-w-[70%]">
          {renderContent()}
          <div className={cn(
            'flex items-center gap-1 mt-1',
            isOutbound ? 'justify-end' : 'justify-start'
          )}>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.created_at), 'HH:mm')}
            </span>
            {isOutbound && getStatusIcon()}
          </div>
        </div>
        
        {isFailed && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRetry(message)}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}

        <ImageViewer
          src={message.media_url || ''}
          open={imageViewerOpen}
          onOpenChange={setImageViewerOpen}
        />
      </div>
    );
  }

  // Handle click in selection mode
  const handleBubbleClick = () => {
    if (isSelecting && onToggleSelect) {
      onToggleSelect();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'flex items-end gap-2 group max-w-full min-w-0',
            isOutbound && 'flex-row-reverse',
            isSelecting && 'cursor-pointer',
            isSelected && 'bg-primary/10 -mx-2 px-2 py-1 rounded-lg'
          )}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
          onClick={handleBubbleClick}
        >
          {/* Reply button - shown on hover */}
          {onReply && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 opacity-0 transition-opacity',
                showActions && 'opacity-100'
              )}
              onClick={() => onReply(message)}
            >
              <Reply className="w-4 h-4" />
            </Button>
          )}
          
          <div
            className={cn(
              'w-fit max-w-[calc(100vw-5rem)] sm:max-w-[80%] md:max-w-[70%] min-w-0 rounded-2xl shadow-sm overflow-hidden [overflow-wrap:anywhere]',
              isOutbound
                ? 'bg-chat-outbound text-white rounded-br-md'
                : 'bg-chat-inbound dark:text-foreground border border-border/50 rounded-bl-md',
              isFailed && 'opacity-70'
            )}
          >
            {/* Quoted Message Preview */}
            {quotedPreview && (
              <div 
                className={cn(
                  'mx-1 mt-1 px-3 py-2 rounded-lg border-l-4 text-xs transition-colors cursor-pointer min-w-0 max-w-full',
                  isOutbound 
                    ? 'bg-white/10 border-white/50 hover:bg-white/20' 
                    : 'bg-muted/50 border-primary/50 hover:bg-muted/70'
                )}
                onClick={() => {
                  if (onQuoteClick) {
                    onQuoteClick(message.quoted_message_id || quotedMessage?.id || '');
                  }
                }}
              >
                <p className={cn(
                  'font-medium mb-0.5 truncate',
                  isOutbound ? 'text-white/80' : 'text-muted-foreground'
                )}>
                  {quotedMessage ? (quotedMessage.direction === 'outbound' ? 'Você' : 'Contato') : (message.direction === 'outbound' ? 'Contato' : 'Você')}
                </p>
                <p className={cn(
                  'truncate max-w-full',
                  isOutbound ? 'text-white/70' : 'text-foreground/70'
                )}>
                  {quotedPreview}
                </p>
              </div>
            )}
            
            <div className="p-3 min-w-0 max-w-full overflow-hidden">
              {/* Forwarded header */}
              {(message as any).is_forwarded && (
                <p className={cn(
                  'text-[11px] italic mb-1 flex items-center gap-1',
                  isOutbound ? 'text-white/70' : 'text-muted-foreground'
                )}>
                  <Forward className="w-3 h-3" />
                  Encaminhada
                </p>
              )}
              {/* Sender name for group inbound messages */}
              {!isOutbound && message.sender_name && (
                <p className="text-xs font-semibold text-primary mb-1">
                  {message.sender_name}
                </p>
              )}
              {/* Sender name for outbound messages */}
              {isOutbound && showSenderName && message.sent_by_name && (
                <p className="text-xs font-semibold text-white/90 mb-1">
                  {message.sent_by_name}
                </p>
              )}
              {renderContent()}
              <div
                className={cn(
                  'flex items-center justify-end gap-1 mt-1',
                  isOutbound ? 'text-white/70' : 'text-muted-foreground'
                )}
              >
                <span className="text-[10px]">
                  {format(new Date(message.created_at), 'HH:mm')}
                </span>
                {isOutbound && getStatusIcon()}
              </div>
            </div>
          </div>
          
          {/* Retry button for failed messages */}
          {isFailed && onRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRetry(message)}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {/* Forward option */}
        {onForward && (
          <>
            <ContextMenuItem onClick={() => onForward(message)}>
              <Forward className="w-4 h-4 mr-2" />
              Encaminhar
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {/* Edit option - only for outbound text messages with whatsapp_message_id */}
        {onEditMessage && isOutbound && message.message_type === 'text' && message.whatsapp_message_id && (
          <>
            <ContextMenuItem onClick={() => onEditMessage(message)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar mensagem
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {onDeleteMessage && (
          <>
            <ContextMenuItem 
              onClick={() => onDeleteMessage(message.id, false)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar só para mim
            </ContextMenuItem>
            {isOutbound && message.whatsapp_message_id && (
              <ContextMenuItem 
                onClick={() => onDeleteMessage(message.id, true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar para todos
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
