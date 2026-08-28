import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateSeparator, shouldShowDateSeparator } from '@/components/crm/DateSeparator';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Users, AtSign, X, Image as ImageIcon, FileText, Loader2, Mic, Sticker, Bookmark, BarChart3, PanelRightClose, PanelRight, ChevronDown, Trash2, Pencil, Forward, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { DropZoneOverlay } from '@/components/ui/drop-zone-overlay';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ImageViewer } from '@/components/crm/ImageViewer';
import { AudioRecorder } from '@/components/crm/AudioRecorder';
import { QuickMessagePicker } from '@/components/crm/QuickMessagePicker';
import { StickerPicker } from '@/components/crm/StickerPicker';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { AnimatedStickerDialog } from '@/components/ui/animated-sticker-dialog';
import { CreatePollDialog } from './CreatePollDialog';
import { PollList } from './PollList';
import { InternalMessageSearch } from './InternalMessageSearch';
import { ConversationWithDetails, MessageWithSender } from '@/types/internal-chat';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalMessages, useSendInternalMessage, useMarkConversationRead, useDeleteInternalMessage, useEditInternalMessage, useRemoveGroupParticipant } from '@/hooks/useInternalChat';
import { AddGroupMembersDialog } from './AddGroupMembersDialog';
import { useFileDropPaste } from '@/hooks/useFileDropPaste';
import { useQuickMessages, QuickMessage } from '@/hooks/useQuickMessages';
import { useStickers, useAddSticker } from '@/hooks/useStickers';
import { detectAnimatedImage, mightBeAnimated } from '@/lib/animated-image-detector';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMessageSelection, SelectedMessage } from '@/hooks/useMessageSelection';
import { useForwardMessages } from '@/hooks/useForwardMessages';
import { MessageSelectionBar } from '@/components/shared/MessageSelectionBar';
import { ForwardMessageDialog } from '@/components/shared/ForwardMessageDialog';
import { linkifyText } from '@/lib/linkify';

interface InternalChatWindowProps {
  conversation: ConversationWithDetails | null;
  onBack?: () => void;
}

interface PendingFile {
  file: File;
  preview?: string;
  progress: number;
}

export function InternalChatWindow({ conversation, onBack }: InternalChatWindowProps) {
  const { user } = useAuth();
  const isCurrentUserAdmin = !!conversation?.participants.some(p => p.user_id === user?.id && p.is_admin);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [quotedMessage, setQuotedMessage] = useState<MessageWithSender | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Scroll tracking state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  
  // Quick messages and stickers state
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [quickMessageSearch, setQuickMessageSearch] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showAnimatedStickerDialog, setShowAnimatedStickerDialog] = useState(false);
  
  // Poll state
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showPollPanel, setShowPollPanel] = useState(false);

  // Group members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const removeParticipant = useRemoveGroupParticipant();
  
  // Edit/Delete state
  const [messageToDelete, setMessageToDelete] = useState<MessageWithSender | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState<MessageWithSender | null>(null);
  const [editContent, setEditContent] = useState('');
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  // Message selection & forwarding
  const { isSelecting, selectedMessages, selectedCount, startSelecting, stopSelecting, toggleMessage, getOrderedMessages } = useMessageSelection();
  const { forwardToWhatsApp, forwardToInternal } = useForwardMessages();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const prevConversationIdRef = useRef<string | null>(null);
  const lastSeenTimestampRef = useRef<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInternalMessages(conversation?.id || null);
  const sendMessage = useSendInternalMessage();
  const markRead = useMarkConversationRead();
  const deleteMessage = useDeleteInternalMessage();
  const editMessage = useEditInternalMessage();
  
  // Quick messages and stickers data
  const { data: quickMessages = [] } = useQuickMessages();
  const { data: stickers = [] } = useStickers();
  const addSticker = useAddSticker();

  const messages = useMemo(() => {
    return data?.pages.flatMap(p => p.messages).reverse() || [];
  }, [data]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
    setHasNewMessages(false);
    setNewMessagesCount(0);
  }, []);
  
  // Check if user is near bottom of scroll
  const checkIfNearBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return true;
    
    const threshold = 150;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return distanceFromBottom < threshold;
  }, []);
  
  // Handle scroll events
  const handleScroll = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);
    
    // Clear new messages indicator when user scrolls to bottom
    if (nearBottom) {
      setHasNewMessages(false);
      setNewMessagesCount(0);
    }
  }, [checkIfNearBottom]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (conversation?.id) {
      markRead.mutate(conversation.id);
    }
  }, [conversation?.id]);

  // Instant scroll when opening a conversation (first load or switch)
  useEffect(() => {
    const isConversationChange = prevConversationIdRef.current !== conversation?.id;
    
    if (isConversationChange && !isLoading && messages.length > 0) {
      // Use instant scroll when switching conversations
      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
      prevConversationIdRef.current = conversation?.id || null;
      // Set the last seen timestamp to the newest message
      const newestMessage = messages[messages.length - 1];
      if (newestMessage) {
        lastSeenTimestampRef.current = newestMessage.created_at;
      }
      // Reset new messages state
      setHasNewMessages(false);
      setNewMessagesCount(0);
    }
  }, [conversation?.id, isLoading, messages.length, scrollToBottom]);
  
  // Update last seen timestamp when user scrolls to bottom
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      const newestMessage = messages[messages.length - 1];
      if (newestMessage) {
        lastSeenTimestampRef.current = newestMessage.created_at;
      }
    }
  }, [isNearBottom, messages]);
  
  // Attach scroll listener to viewport
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const viewport = scrollArea?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    
    if (viewport) {
      scrollViewportRef.current = viewport;
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, conversation?.id]);

  // Realtime subscription - track new incoming messages directly
  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`internal-chat-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Check if this is a genuinely new message (after our last seen timestamp)
          // and if user is not at bottom, increment the new messages counter
          if (lastSeenTimestampRef.current && newMessage.created_at > lastSeenTimestampRef.current) {
            // Check current scroll position
            const viewport = scrollViewportRef.current;
            if (viewport) {
              const threshold = 150;
              const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
              const nearBottom = distanceFromBottom < threshold;
              
              if (!nearBottom) {
                setHasNewMessages(true);
                setNewMessagesCount((prev) => prev + 1);
              }
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['internal-messages', conversation.id] });
          if (conversation.id) {
            markRead.mutate(conversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  // Cleanup file previews on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(pf => {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      });
    };
  }, []);

  const getConversationName = () => {
    if (!conversation) return '';
    if (conversation.is_group) return conversation.name || 'Grupo';
    const other = conversation.participants.find(p => p.user_id !== user?.id);
    return other?.profile?.full_name || 'Usuário';
  };

  const getConversationAvatar = () => {
    if (!conversation || conversation.is_group) return null;
    const other = conversation.participants.find(p => p.user_id !== user?.id);
    return other?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getMessageType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const addFilesToPending = useCallback((files: File[]) => {
    const newPendingFiles: PendingFile[] = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0
    }));
    setPendingFiles(prev => [...prev, ...newPendingFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    addFilesToPending(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag & drop and paste support
  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    dropZoneRef
  } = useFileDropPaste({
    onFilesAdded: addFilesToPending,
    enabled: !!conversation
  });

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFile = async (file: File): Promise<string> => {
    if (!conversation || !user) throw new Error('No conversation or user');

    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${conversation.id}/${user.id}/${timestamp}.${ext}`;

    const { error } = await supabase.storage
      .from('internal-chat-media')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('internal-chat-media')
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleSend = async () => {
    if ((!message.trim() && pendingFiles.length === 0) || !conversation) return;

    // Extract mentions from message
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentionedIds: string[] = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
      mentionedIds.push(match[2]);
    }

    // Clean message (remove mention markup)
    const cleanMessage = message.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');

    const hasFiles = pendingFiles.length > 0;
    const savedQuotedMessageId = quotedMessage?.id;

    // Clear input immediately for snappy UX
    setMessage('');
    setQuotedMessage(null);

    // Update last seen timestamp to now
    lastSeenTimestampRef.current = new Date().toISOString();

    // For text-only messages: fire-and-forget (optimistic update handles UI)
    if (cleanMessage.trim() && !hasFiles) {
      sendMessage.mutate({
        conversationId: conversation.id,
        content: cleanMessage,
        mentionedUserIds: mentionedIds,
        quotedMessageId: savedQuotedMessageId
      });
      
      textareaRef.current?.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      });
      return;
    }

    // For files: use await with loading state
    try {
      setIsUploading(true);

      // Send text message first if exists alongside files
      if (cleanMessage.trim()) {
        await sendMessage.mutateAsync({
          conversationId: conversation.id,
          content: cleanMessage,
          mentionedUserIds: mentionedIds,
          quotedMessageId: savedQuotedMessageId
        });
      }

      // Upload and send files
      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i];
        
        setPendingFiles(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 30 } : p
        ));

        const mediaUrl = await uploadFile(pf.file);
        
        setPendingFiles(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 70 } : p
        ));

        await sendMessage.mutateAsync({
          conversationId: conversation.id,
          content: pf.file.name,
          messageType: getMessageType(pf.file),
          mediaUrl
        });

        setPendingFiles(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 100 } : p
        ));
      }

      setPendingFiles([]);
      
      textareaRef.current?.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAudioComplete = async (audioBlob: Blob, duration: number) => {
    if (!conversation || !user) return;

    try {
      setIsUploading(true);
      
      const timestamp = Date.now();
      const isOgg = audioBlob.type.includes('ogg');
      const audioExt = isOgg ? 'ogg' : 'webm';
      const audioContentType = isOgg ? 'audio/ogg;codecs=opus' : 'audio/webm;codecs=opus';
      const path = `${conversation.id}/${user.id}/${timestamp}.${audioExt}`;

      const { error } = await supabase.storage
        .from('internal-chat-media')
        .upload(path, audioBlob, {
          cacheControl: '3600',
          contentType: audioContentType,
          upsert: false
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('internal-chat-media')
        .getPublicUrl(path);

      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        content: `Áudio (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
        messageType: 'audio',
        mediaUrl: urlData.publicUrl
      });

      setIsRecording(false);
    } catch (error) {
      console.error('Error sending audio:', error);
      toast.error('Erro ao enviar áudio');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle message input change for quick messages (/ trigger)
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);
    
    // Check for / trigger
    if (val.startsWith('/')) {
      setShowQuickMessages(true);
      setQuickMessageSearch(val.slice(1));
    } else {
      setShowQuickMessages(false);
      setQuickMessageSearch('');
    }
  };

  // Handle quick message selection
  const handleQuickMessageSelect = async (qm: QuickMessage) => {
    setShowQuickMessages(false);
    setMessage('');
    
    if (!conversation) return;

    try {
      setIsUploading(true);
      
      // If quick message has media, upload and send as media
      if (qm.media_url && qm.media_type) {
        // Send media message
        await sendMessage.mutateAsync({
          conversationId: conversation.id,
          content: qm.content || qm.media_url.split('/').pop() || 'Arquivo',
          messageType: qm.media_type,
          mediaUrl: qm.media_url,
          quotedMessageId: quotedMessage?.id
        });
      } else if (qm.content) {
        // Send text message
        await sendMessage.mutateAsync({
          conversationId: conversation.id,
          content: qm.content,
          quotedMessageId: quotedMessage?.id
        });
      }

      setQuotedMessage(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    } catch (error) {
      console.error('Error sending quick message:', error);
      toast.error('Erro ao enviar mensagem rápida');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle sticker selection
  const handleStickerSelect = async (stickerUrl: string) => {
    setShowStickerPicker(false);
    
    if (!conversation) return;

    try {
      setIsUploading(true);
      
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        content: 'Figurinha',
        messageType: 'sticker',
        mediaUrl: stickerUrl
      });

      setTimeout(() => textareaRef.current?.focus(), 0);
    } catch (error) {
      console.error('Error sending sticker:', error);
      toast.error('Erro ao enviar figurinha');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!showQuickMessages) {
        handleSend();
      }
    }
    if (e.key === '@') {
      setShowMentions(true);
      setMentionSearch('');
    }
  };

  const insertMention = (userId: string, name: string) => {
    const mention = `@[${name}](${userId}) `;
    setMessage(prev => prev + mention);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredParticipants = conversation?.participants.filter(p => {
    if (p.user_id === user?.id) return false;
    if (!mentionSearch) return true;
    return p.profile?.full_name?.toLowerCase().includes(mentionSearch.toLowerCase());
  }) || [];

  const renderMessageContent = (msg: MessageWithSender, isOwn: boolean) => {
    const messageType = msg.message_type;

    if (messageType === 'image' && msg.media_url) {
      return (
        <div className="space-y-1">
          <img 
            src={msg.media_url} 
            alt="Imagem"
            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: '300px' }}
            onClick={() => setLightboxImage(msg.media_url!)}
          />
          {msg.content && msg.content !== msg.media_url && (
            <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{linkifyText(msg.content)}</p>
          )}
        </div>
      );
    }

    if (messageType === 'document' && msg.media_url) {
      return (
        <a 
          href={msg.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 p-2 rounded-lg w-full max-w-full min-w-0 ${
            isOwn ? 'bg-primary-foreground/10' : 'bg-background/50'
          } hover:opacity-80 transition-opacity`}
        >
          <FileText className="h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate" title={msg.content || 'Documento'}>{msg.content || 'Documento'}</p>
            <p className={`text-xs truncate ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
              Clique para baixar
            </p>
          </div>
        </a>
      );
    }

    if (messageType === 'video' && msg.media_url) {
      return (
        <video 
          src={msg.media_url} 
          controls 
          playsInline
          className="max-w-full rounded-lg"
          style={{ maxHeight: '300px', objectFit: 'contain' }}
        />
      );
    }

    if (messageType === 'audio' && msg.media_url) {
      return (
        <audio src={msg.media_url} controls className="max-w-full" />
      );
    }

    if (messageType === 'sticker' && msg.media_url) {
      return (
        <div className="relative group/sticker">
          <img 
            src={msg.media_url} 
            alt="Figurinha"
            className="w-32 h-32 object-contain cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setLightboxImage(msg.media_url!)}
          />
          {/* Save sticker button on hover (only for received stickers) */}
          {!isOwn && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                // Check if sticker is animated before saving
                if (mightBeAnimated(msg.media_url!)) {
                  const result = await detectAnimatedImage(msg.media_url!);
                  if (result.isAnimated) {
                    setShowAnimatedStickerDialog(true);
                    return;
                  }
                }
                addSticker.mutate({ existingUrl: msg.media_url! });
              }}
              className="absolute top-0 right-0 p-1.5 bg-background/80 rounded-full opacity-0 group-hover/sticker:opacity-100 transition-opacity hover:bg-background shadow-sm"
              title="Salvar figurinha"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    }

    return <p className="whitespace-pre-wrap break-words max-w-full [overflow-wrap:anywhere]">{linkifyText(msg.content)}</p>;
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !conversation) return;
    
    try {
      await deleteMessage.mutateAsync({
        messageId: messageToDelete.id,
        conversationId: conversation.id
      });
      toast.success(deleteForEveryone ? 'Mensagem apagada para todos' : 'Mensagem apagada');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erro ao apagar mensagem');
    } finally {
      setMessageToDelete(null);
      setDeleteForEveryone(false);
    }
  };

  const handleEditMessage = async () => {
    if (!messageToEdit || !conversation || !editContent.trim()) return;
    
    try {
      await editMessage.mutateAsync({
        messageId: messageToEdit.id,
        content: editContent.trim(),
        conversationId: conversation.id
      });
      toast.success('Mensagem editada');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Erro ao editar mensagem');
    } finally {
      setMessageToEdit(null);
      setEditContent('');
    }
  };

  const openEditDialog = (msg: MessageWithSender) => {
    setMessageToEdit(msg);
    setEditContent(msg.content || '');
  };

  const handleSearchResultSelect = useCallback(async (messageId: string) => {
    // First check if message is already in DOM
    const el = document.getElementById(`internal-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
      return;
    }

    // Message not loaded yet - load more pages until found
    let attempts = 0;
    const maxAttempts = 50;

    const loadUntilFound = async (): Promise<boolean> => {
      if (attempts >= maxAttempts) return false;
      attempts++;

      await fetchNextPage();
      await new Promise(resolve => setTimeout(resolve, 50));

      const element = document.getElementById(`internal-msg-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 2000);
        return true;
      }

      // Check if there are more pages
      const canLoadMore = data?.pages && data.pages[data.pages.length - 1]?.nextCursor;
      if (canLoadMore) {
        return loadUntilFound();
      }

      return false;
    };

    const found = await loadUntilFound();
    if (!found) {
      toast.info('Mensagem não encontrada no histórico carregado');
    }
  }, [fetchNextPage, data?.pages]);

  if (!conversation) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-chat-bg">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  const name = getConversationName();
  const avatar = getConversationAvatar();

  return (
    <div 
      ref={dropZoneRef}
      className="flex flex-col bg-chat-bg relative h-full overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Lightbox */}
      <ImageViewer 
        src={lightboxImage || ''} 
        alt="Imagem"
        open={!!lightboxImage} 
        onOpenChange={(open) => !open && setLightboxImage(null)} 
      />
      {/* Drag overlay */}
      <DropZoneOverlay isVisible={isDragging} />
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback className={conversation.is_group ? 'bg-primary/20' : ''}>
              {conversation.is_group ? <Users className="h-5 w-5" /> : getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{name}</h3>
            {conversation.is_group && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors">
                    {conversation.participants.length} participantes
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Participantes</p>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {conversation.participants.map((p) => {
                      const isSelf = p.user_id === user?.id;
                      const canRemove = isCurrentUserAdmin || isSelf;
                      return (
                        <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 group">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={p.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(p.profile?.full_name || p.profile?.email || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{p.profile?.full_name || p.profile?.email || 'Usuário'}</p>
                          </div>
                          {p.is_admin && (
                            <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 shrink-0">admin</span>
                          )}
                          {canRemove && (
                            <button
                              title={isSelf ? 'Sair do grupo' : 'Remover do grupo'}
                              onClick={() => {
                                if (confirm(isSelf ? 'Sair deste grupo?' : `Remover ${p.profile?.full_name || 'este membro'} do grupo?`)) {
                                  removeParticipant.mutate({ conversationId: conversation.id, userId: p.user_id });
                                }
                              }}
                              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isCurrentUserAdmin && (
                    <>
                      <div className="border-t my-2" />
                      <button
                        onClick={() => setShowAddMembers(true)}
                        className="w-full text-left text-sm text-primary hover:underline px-2 py-1"
                      >
                        + Adicionar membros
                      </button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            title="Pesquisar mensagens"
          >
            <Search className="h-5 w-5" />
          </Button>
          {/* Poll actions (only for groups) */}
          {conversation.is_group && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreatePoll(true)}
                title="Criar enquete"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPollPanel(!showPollPanel)}
                title={showPollPanel ? 'Fechar enquetes' : 'Ver enquetes'}
              >
                {showPollPanel ? (
                  <PanelRightClose className="h-5 w-5" />
                ) : (
                  <PanelRight className="h-5 w-5" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && conversation && (
        <InternalMessageSearch
          conversationId={conversation.id}
          onResultSelect={handleSearchResultSelect}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Main content area with optional poll panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Messages column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Messages */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 p-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground">Carregando...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground">
            Nenhuma mensagem ainda. Seja o primeiro a dizer olá!
          </div>
        ) : (
          <div className="space-y-4">
            {hasNextPage && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isOwn = msg.sender_id === user?.id;
              const showAvatar = !isOwn && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
              const previousMessage = idx > 0 ? messages[idx - 1] : null;
              const showDateSeparator = shouldShowDateSeparator(
                new Date(msg.created_at),
                previousMessage ? new Date(previousMessage.created_at) : null
              );

              return (
                <div key={msg.id} id={`internal-msg-${msg.id}`}>
                  {showDateSeparator && (
                    <DateSeparator date={new Date(msg.created_at)} />
                  )}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div 
                        className={cn(
                          `flex ${isOwn ? 'justify-end' : 'justify-start'} transition-colors duration-500`,
                          isSelecting && 'cursor-pointer',
                          selectedMessages.has(msg.id) && 'bg-primary/10 -mx-2 px-2 py-1 rounded-lg',
                          highlightedMessageId === msg.id && 'bg-primary/20 -mx-2 px-2 py-1 rounded-lg'
                        )}
                        onClick={() => {
                          if (isSelecting) {
                            toggleMessage({
                              id: msg.id,
                              content: msg.content,
                              message_type: msg.message_type,
                              media_url: msg.media_url,
                              created_at: msg.created_at,
                              senderName: msg.sender?.full_name || 'Usuário',
                            });
                          }
                        }}
                      >
                        {!isOwn && showAvatar && (
                          <Avatar className="h-8 w-8 mr-2 mt-auto">
                            <AvatarImage src={msg.sender?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getInitials(msg.sender?.full_name || 'U')}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {!isOwn && !showAvatar && <div className="w-10" />}
                        
                        <div className={`min-w-0 [max-width:min(90%,calc(100%_-_2.5rem))] sm:max-w-[80%] md:max-w-[70%] group`}>
                          {!isOwn && showAvatar && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {msg.sender?.full_name}
                            </p>
                          )}
                          
                          {msg.quotedMessage && (
                            <div 
                              className="text-xs bg-muted/50 p-2 rounded-t-lg border-l-2 border-primary mb-1 cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (msg.quoted_message_id) {
                                  handleSearchResultSelect(msg.quoted_message_id);
                                }
                              }}
                            >
                              <p className="font-medium text-muted-foreground">
                                {msg.quotedMessage.content?.slice(0, 50)}
                                {(msg.quotedMessage.content?.length || 0) > 50 ? '...' : ''}
                              </p>
                            </div>
                          )}
                          
                          <div
                            className={`px-4 py-2 rounded-2xl min-w-0 overflow-hidden ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted rounded-bl-sm'
                            }`}
                          >
                            {/* Forwarded header */}
                            {(msg as any).is_forwarded && (
                              <p className={`text-[11px] italic mb-1 flex items-center gap-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                <Forward className="w-3 h-3" />
                                Encaminhada
                              </p>
                            )}
                            {renderMessageContent(msg, isOwn)}
                            <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                            onClick={(e) => { e.stopPropagation(); setQuotedMessage(msg); }}
                          >
                            Responder
                          </Button>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {/* Forward option */}
                      <ContextMenuItem onClick={() => {
                        startSelecting({
                          id: msg.id,
                          content: msg.content,
                          message_type: msg.message_type,
                          media_url: msg.media_url,
                          created_at: msg.created_at,
                          senderName: msg.sender?.full_name || 'Usuário',
                        });
                      }}>
                        <Forward className="w-4 h-4 mr-2" />
                        Encaminhar
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      {/* Edit option - only for own text messages */}
                      {isOwn && msg.message_type === 'text' && (
                        <>
                          <ContextMenuItem onClick={() => openEditDialog(msg)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar mensagem
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </>
                      )}
                      {/* Delete for me - available to everyone */}
                      <ContextMenuItem 
                        onClick={() => {
                          setMessageToDelete(msg);
                          setDeleteForEveryone(false);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Apagar para mim
                      </ContextMenuItem>
                      {/* Delete for everyone - only for own messages */}
                      {isOwn && (
                        <ContextMenuItem 
                          onClick={() => {
                            setMessageToDelete(msg);
                            setDeleteForEveryone(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Apagar para todos
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
          </ScrollArea>
          
          {/* New messages indicator */}
          {hasNewMessages && !isNearBottom && (
            <button
              onClick={() => scrollToBottom(false)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2 z-10"
            >
              <span className="text-sm font-medium">
                {newMessagesCount === 1 
                  ? 'Nova mensagem' 
                  : `${newMessagesCount} novas mensagens`}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Pending files preview */}
          {pendingFiles.length > 0 && (
            <div className="px-4 py-2 bg-muted/50 border-t">
              <div className="flex gap-2 flex-wrap">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="relative group">
                    {pf.preview ? (
                      <img 
                        src={pf.preview} 
                        alt="Preview" 
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {pf.progress > 0 && pf.progress < 100 && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Progress value={pf.progress} className="w-12 h-1" />
                      </div>
                    )}
                    <button
                      onClick={() => removePendingFile(idx)}
                      className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quote preview */}
          {quotedMessage && (
            <div className="px-4 py-2 bg-muted/50 border-t flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  Respondendo a {quotedMessage.sender?.full_name}
                </p>
                <p className="text-sm truncate">{quotedMessage.content}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setQuotedMessage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t bg-card shrink-0">
            {isRecording ? (
              <AudioRecorder
                onRecordingComplete={handleAudioComplete}
                onCancel={() => setIsRecording(false)}
                isUploading={isUploading}
              />
            ) : (
              <div className="relative flex items-center gap-2">
                {/* Attachment button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>

                {/* Emoji Picker Button */}
                <EmojiPicker
                  onEmojiSelect={(emoji) => setMessage((prev) => prev + emoji)}
                  disabled={isUploading}
                />

                {/* Sticker Picker Button */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isUploading || stickers.length === 0}
                    className="h-10 w-10 shrink-0"
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    title={stickers.length === 0 ? 'Nenhuma figurinha salva' : 'Figurinhas'}
                  >
                    <Sticker className="h-5 w-5" />
                  </Button>
                  
                  {showStickerPicker && (
                    <StickerPicker
                      onSelect={handleStickerSelect}
                      onClose={() => setShowStickerPicker(false)}
                    />
                  )}
                </div>

                <div className="relative flex-1">
                  <Popover open={showMentions} onOpenChange={setShowMentions}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      >
                        <AtSign className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <Input
                        placeholder="Buscar membro..."
                        value={mentionSearch}
                        onChange={(e) => setMentionSearch(e.target.value)}
                        className="mb-2"
                      />
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {filteredParticipants.map(p => (
                          <button
                            key={p.user_id}
                            onClick={() => insertMention(p.user_id, p.profile?.full_name || 'Usuário')}
                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={p.profile?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(p.profile?.full_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{p.profile?.full_name}</span>
                          </button>
                        ))}
                        {filteredParticipants.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Nenhum membro encontrado
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleMessageChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      setTimeout(() => setShowQuickMessages(false), 200);
                    }}
                    placeholder="Digite / para atalhos..."
                    className="min-h-[44px] max-h-32 pl-12 pr-4 resize-none"
                    rows={1}
                    disabled={isUploading}
                  />
                  
                  {/* Quick Messages Picker Dropdown */}
                  {showQuickMessages && quickMessages.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
                      <QuickMessagePicker 
                        search={quickMessageSearch}
                        onSelect={handleQuickMessageSelect}
                      />
                    </div>
                  )}
                </div>

                {/* Mic / Send button */}
                {(!message.trim() && pendingFiles.length === 0) || showQuickMessages ? (
                  <Button
                    onClick={() => setIsRecording(true)}
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    disabled={isUploading || showQuickMessages}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={sendMessage.isPending || isUploading}
                    size="icon"
                    className="h-10 w-10 shrink-0"
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Poll panel (only for groups) */}
        {conversation.is_group && showPollPanel && (
          <div className="w-80 border-l bg-card shrink-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Enquetes
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowPollPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <PollList
                conversationId={conversation.id}
                participants={conversation.participants}
              />
            </div>
          </div>
        )}
      </div>

      {/* Animated Sticker Warning Dialog */}
      <AnimatedStickerDialog
        open={showAnimatedStickerDialog}
        onOpenChange={setShowAnimatedStickerDialog}
      />

      {/* Create Poll Dialog */}
      {conversation.is_group && (
        <CreatePollDialog
          open={showCreatePoll}
          onOpenChange={setShowCreatePoll}
          conversationId={conversation.id}
        />
      )}

      {/* Add Group Members Dialog */}
      {conversation.is_group && (
        <AddGroupMembersDialog
          open={showAddMembers}
          onOpenChange={setShowAddMembers}
          conversationId={conversation.id}
          existingParticipantIds={conversation.participants.map(p => p.user_id)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteForEveryone ? 'Apagar para todos?' : 'Apagar para mim?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteForEveryone 
                ? 'Esta mensagem será apagada para todos os participantes da conversa. Esta ação não pode ser desfeita.'
                : 'Esta mensagem será apagada apenas para você. Outros participantes ainda poderão vê-la.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Message Dialog */}
      <Dialog open={!!messageToEdit} onOpenChange={(open) => !open && setMessageToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Digite a nova mensagem..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageToEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditMessage} disabled={!editContent.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Selection Bar */}
      {isSelecting && (
        <MessageSelectionBar
          selectedCount={selectedCount}
          onForward={() => setForwardDialogOpen(true)}
          onCancel={stopSelecting}
        />
      )}

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={forwardDialogOpen}
        onOpenChange={(open) => {
          setForwardDialogOpen(open);
          if (!open) stopSelecting();
        }}
        messages={getOrderedMessages()}
        onForwardToWhatsApp={async (contactId, phone) => {
          await forwardToWhatsApp(getOrderedMessages(), contactId, phone);
          stopSelecting();
        }}
        onForwardToInternal={async (conversationId) => {
          await forwardToInternal(getOrderedMessages(), conversationId);
          stopSelecting();
        }}
      />
    </div>
  );
}
