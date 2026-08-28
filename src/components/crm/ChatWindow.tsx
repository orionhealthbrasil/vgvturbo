import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Send,
  Paperclip,
  MoreVertical,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  FileText,
  Loader2,
  X,
  Reply,
  Video,
  ChevronDown,
  RotateCcw,
  AlarmClock,
  RefreshCw,
  Trash2,
  Camera,
  Zap,
  Pencil,
  Pause,
  Play,
  Search,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Users,
  Bot,
  PanelRight,
  CalendarClock,
  Package,
  EyeOff,
  Eye,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useAutomations } from '@/hooks/useAutomations';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DropZoneOverlay } from '@/components/ui/drop-zone-overlay';
import { ContactWithColumn, Message, MessageType } from '@/types/crm';
import { useSendMessage, useSendWhatsAppMessage, useSendWhatsAppMedia, useSendInstagramMessage, useReopenContact, useDeleteMessage, useEditMessage, useCloseContact, useUpdateContact } from '@/hooks/useCRM';
import { useSnoozeContact, useUnsnoozeContact } from '@/hooks/useSnooze';
import { useMessagesPaginated, flattenMessages } from '@/hooks/useMessagesPaginated';
import { useFileDropPaste } from '@/hooks/useFileDropPaste';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { triggerConfetti } from '@/lib/confetti';
import { MessageBubble } from './MessageBubble';
import { DateSeparator, shouldShowDateSeparator } from './DateSeparator';
import { AudioRecorder } from './AudioRecorder';
import { MediaCaptionDialog } from './MediaCaptionDialog';
import { ContactTagsEditor } from './ContactTagsEditor';
import { AssignContact } from './AssignContact';
import { FunnelStageActions } from './FunnelStageActions';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { ContactCustomFields } from './ContactCustomFields';
import { ContactTasksTab } from '@/components/tasks/ContactTasksTab';
import { ContactDetailsPanel } from './ContactDetailsPanel';
import { useUserPermissions } from '@/hooks/usePermissions';
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
import { DeferScheduleDialog } from './DeferScheduleDialog';
import { ScheduledMessagesPanel } from './ScheduledMessagesPanel';

import { WebcamCaptureDialog } from './WebcamCaptureDialog';
import { EditContactDialog } from './EditContactDialog';
import { QuickMessagePicker } from './QuickMessagePicker';
import { StickerPicker } from './StickerPicker';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { AnimatedStickerDialog } from '@/components/ui/animated-sticker-dialog';
import { useQuickMessages, QuickMessage } from '@/hooks/useQuickMessages';
import { useAddSticker, useStickers } from '@/hooks/useStickers';
import { detectAnimatedImage, mightBeAnimated } from '@/lib/animated-image-detector';
import { Sticker } from 'lucide-react';
import { useMessageSelection, SelectedMessage } from '@/hooks/useMessageSelection';
import { useForwardMessages } from '@/hooks/useForwardMessages';
import { MessageSelectionBar } from '@/components/shared/MessageSelectionBar';
import { ForwardMessageDialog } from '@/components/shared/ForwardMessageDialog';
import { SaleOutcomeReasonDialog } from '@/components/pipeline/SaleOutcomeReasonDialog';
import { triggerDealResultAutomation } from '@/hooks/usePipeline';
import { MessageSearch } from './MessageSearch';
import { useConversationalAgents } from '@/hooks/useAiAgents';
import { CatalogSidePanel, CatalogItemCard } from './CatalogSidePanel';
import { useProducts, Product } from '@/hooks/useCatalog';
import { brl } from '@/lib/catalog/format';

interface ChatWindowProps {
  contact: ContactWithColumn | null;
  onViewDetails: () => void;
  onPhoneClick?: (phone: string) => void;
  onBack?: () => void;
}

function loadLameJs(): Promise<{ Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => { encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array; flush: () => Int8Array } }> {
  const existing = (window as any).lamejs;
  if (existing?.Mp3Encoder) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const currentScript = document.querySelector<HTMLScriptElement>('script[data-lamejs="true"]');
    if (currentScript) {
      currentScript.addEventListener('load', () => resolve((window as any).lamejs), { once: true });
      currentScript.addEventListener('error', () => reject(new Error('Falha ao carregar conversor de áudio')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = '/vendor/lame.all.js';
    script.async = true;
    script.dataset.lamejs = 'true';
    script.onload = () => {
      const loaded = (window as any).lamejs;
      if (loaded?.Mp3Encoder) resolve(loaded);
      else reject(new Error('Conversor de áudio indisponível'));
    };
    script.onerror = () => reject(new Error('Falha ao carregar conversor de áudio'));
    document.head.appendChild(script);
  });
}

async function prepareWhatsAppAudioFile(audioBlob: Blob): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const startedAt = Date.now();
  const blobType = (audioBlob.type || '').toLowerCase();
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;

  if (AudioContextCtor) {
    const ctx = new AudioContextCtor();
    try {
      const decoded = await ctx.decodeAudioData(await audioBlob.arrayBuffer());
      const channelCount = Math.max(1, decoded.numberOfChannels);
      const mono = new Float32Array(decoded.length);
      for (let ch = 0; ch < channelCount; ch++) {
        const data = decoded.getChannelData(ch);
        for (let i = 0; i < data.length; i++) mono[i] += data[i] / channelCount;
      }

      const pcm = new Int16Array(mono.length);
      for (let i = 0; i < mono.length; i++) {
        const s = Math.max(-1, Math.min(1, mono[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const lamejs = await loadLameJs();
      const encoder = new lamejs.Mp3Encoder(1, decoded.sampleRate, 64);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < pcm.length; i += 1152) {
        const encoded = encoder.encodeBuffer(pcm.subarray(i, i + 1152));
        if (encoded.length) chunks.push(new Uint8Array(encoded));
      }
      const flushed = encoder.flush();
      if (flushed.length) chunks.push(new Uint8Array(flushed));

      const mp3Parts = chunks.map((chunk) => {
        const copy = new Uint8Array(new ArrayBuffer(chunk.byteLength));
        copy.set(chunk);
        return copy.buffer;
      });
      const mp3Blob = new Blob(mp3Parts, { type: 'audio/mpeg' });
      if (mp3Blob.size > 0) {
        return { blob: mp3Blob, fileName: `audio_${startedAt}.mp3`, contentType: 'audio/mpeg' };
      }
    } catch (error) {
      console.warn('Falha ao converter áudio para MP3:', error);
    } finally {
      ctx.close?.();
    }
  }

  if (blobType.includes('ogg')) return { blob: audioBlob, fileName: `audio_${startedAt}.ogg`, contentType: 'audio/ogg' };
  if (blobType.includes('mp4')) return { blob: audioBlob, fileName: `audio_${startedAt}.m4a`, contentType: 'audio/mp4' };
  if (blobType.includes('mpeg') || blobType.includes('mp3')) return { blob: audioBlob, fileName: `audio_${startedAt}.mp3`, contentType: 'audio/mpeg' };
  if (blobType.includes('aac')) return { blob: audioBlob, fileName: `audio_${startedAt}.aac`, contentType: 'audio/aac' };

  throw new Error('Não foi possível preparar o áudio em um formato aceito pelo WhatsApp Oficial.');
}

// Separate component so useDroppable runs as a real descendant of DndContext
function MessageDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'chat-message-dropzone' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex-1 min-h-0 transition-colors',
        isOver && 'ring-2 ring-inset ring-primary bg-primary/5',
      )}
    >
      {children}
    </div>
  );
}

export function ChatWindow({ contact, onViewDetails, onPhoneClick, onBack }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<{ kind: 'won' | 'lost' } | null>(null);
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  // Media caption dialog state (supports batch)
  const [mediaCaptionOpen, setMediaCaptionOpen] = useState(false);
  const [pendingMediaFile, setPendingMediaFile] = useState<File | null>(null);
  const [pendingMediaType, setPendingMediaType] = useState<'image' | 'video'>('image');
  const [pendingMediaFiles, setPendingMediaFiles] = useState<File[]>([]);
  
  // Scroll tracking state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  
  // Quick messages state
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [quickMessageSearch, setQuickMessageSearch] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Holds File refs for failed media so the user can retry without re-picking
  const failedMediaRef = useRef<Map<string, { file: File; type: MessageType; caption?: string; tempUrl: string }>>(new Map());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastSeenTimestampRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  
  // Use paginated messages hook
  const { 
    data: messagesData, 
    isLoading, 
    isError,
    error,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage 
  } = useMessagesPaginated(contact?.id || null);
  
  const messages = flattenMessages(messagesData);
  const sendMessage = useSendMessage();
  const sendWhatsAppMessage = useSendWhatsAppMessage();
  const sendWhatsAppMedia = useSendWhatsAppMedia();
  const sendInstagramMessage = useSendInstagramMessage();
  const isInstagram = contact?.channel === 'instagram';
  const reopenContact = useReopenContact();
  const updateContact = useUpdateContact();
  const deleteMessage = useDeleteMessage();
  const editMessage = useEditMessage();
  const snoozeContact = useSnoozeContact();
  const unsnoozeContact = useUnsnoozeContact();
  const { isOwner, role } = useUserPermissions();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isDeferScheduleDialogOpen, setIsDeferScheduleDialogOpen] = useState(false);
  const [isScheduledPanelOpen, setIsScheduledPanelOpen] = useState(false);

  const [isWebcamDialogOpen, setIsWebcamDialogOpen] = useState(false);
  const [isEditNameDialogOpen, setIsEditNameDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isTriggeringAutomation, setIsTriggeringAutomation] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [showAnimatedStickerDialog, setShowAnimatedStickerDialog] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('chat-details-panel-open') === '1';
  });

  // Reset textarea height when message is cleared
  useEffect(() => {
    if (!message && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [message]);

  const toggleDetailsPanel = useCallback(() => {
    setDetailsPanelOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('chat-details-panel-open', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Catalog drag-and-drop panel
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('chat-catalog-panel-open') === '1';
  });
  const [activeDragProduct, setActiveDragProduct] = useState<Product | null>(null);
  const { data: catalogProducts = [], isLoading: catalogLoading } = useProducts({ available: 'yes' });
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const toggleCatalogPanel = useCallback(() => {
    setCatalogPanelOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('chat-catalog-panel-open', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleCatalogDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (!id.startsWith('catalog:')) return;
    const productId = id.slice('catalog:'.length);
    setActiveDragProduct(catalogProducts.find((p) => p.id === productId) || null);
  }, [catalogProducts]);

  // Message selection & forwarding
  const { isSelecting, selectedMessages, selectedCount, startSelecting, stopSelecting, toggleMessage, getOrderedMessages } = useMessageSelection();
  const { forwardToWhatsApp, forwardToInternal } = useForwardMessages();
  
  // Fetch available automations
  const { data: automations = [] } = useAutomations();
  const activeAutomations = automations.filter(a => a.is_active);
  
  // Funnel stages for mobile menu
  const { data: funnelStages = [] } = useFunnelStages();
  const sortedStages = [...funnelStages].sort((a, b) => a.position - b.position);
  const currentStage = sortedStages.find(s => s.slug === contact?.funnel_stage) || sortedStages[0];
  const currentStageIndex = sortedStages.findIndex(s => s.slug === contact?.funnel_stage);
  const nextStage = currentStageIndex >= 0 && currentStageIndex < sortedStages.length - 1 
    ? sortedStages[currentStageIndex + 1] 
    : null;
  const isFinalStage = currentStage?.is_final;
  const closeContact = useCloseContact();
  
  // Check if user is admin (owner or admin role)
  const isAdmin = isOwner || role === 'admin';
  
  // Check if contact has an active flow or any flow-related state
  // This includes: active_flow_id, current_node_id, or waiting_response
  const hasActiveFlow = !!(
    contact?.active_flow_id || 
    contact?.current_node_id || 
    contact?.waiting_response
  );
  
  // Message queue to ensure sequential sending and preserve order
  const { enqueue } = useMessageQueue();
  
  // Quick messages data
  const { data: quickMessages = [] } = useQuickMessages();
  
  // Stickers
  const { data: stickers = [] } = useStickers();
  const addSticker = useAddSticker();
  
  // Profile picture hook with caching
  const { 
    profilePictureUrl, 
    isLoading: isLoadingProfilePic, 
    refreshProfilePicture 
  } = useProfilePicture({
    contactId: contact?.id || '',
    phone: contact?.phone || '',
    organizationId: contact?.organization_id || '',
    currentUrl: contact?.profile_picture_url || null,
  });

  const handleReopenTicket = async () => {
    if (!contact) return;
    try {
      await reopenContact.mutateAsync(contact.id);
      toast.success('Atendimento reaberto!');
    } catch (error) {
      toast.error('Erro ao reabrir atendimento');
    }
  };

  const handleSnoozeContact = async () => {
    if (!contact) return;
    await snoozeContact.mutateAsync(contact.id);
  };

  const handleUnsnoozeContact = async () => {
    if (!contact) return;
    await unsnoozeContact.mutateAsync(contact.id);
  };

  const handleClearConversation = async () => {
    if (!contact) return;
    
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('contact_id', contact.id);
      
      if (error) throw error;
      
      // Invalidate messages cache
      queryClient.invalidateQueries({ queryKey: ['messages', contact.id] });
      toast.success('Conversa limpa com sucesso');
      setIsClearDialogOpen(false);
    } catch (error: any) {
      console.error('Error clearing conversation:', error);
      toast.error('Erro ao limpar conversa');
    } finally {
      setIsClearing(false);
    }
  };

  // Mark conversation as unread
  const handleMarkAsUnread = async () => {
    if (!contact) return;

    // Pausa o guard de Realtime que zera unread_count enquanto a conversa está aberta
    manualUnreadRef.current = true;

    // Cancela qualquer reset debounced em andamento
    if (resetUnreadTimerRef.current) {
      clearTimeout(resetUnreadTimerRef.current);
      resetUnreadTimerRef.current = null;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ unread_count: 1 })
        .eq('id', contact.id);

      if (error) throw error;

      // Patch otimista: badge aparece instantâneo no contato e no sidebar
      queryClient.setQueriesData(
        { queryKey: ['conversation-contacts'] },
        (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((c: any) =>
            c.id === contact.id ? { ...c, unread_count: 1 } : c
          );
        }
      );
      // Badge global é atualizado pelo useUnreadMessages via realtime.


      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Conversa marcada como não lida');
    } catch (error: any) {
      manualUnreadRef.current = false;
      console.error('Error marking as unread:', error);
      toast.error('Erro ao marcar como não lida');
    }
  };

  // Toggle automations pause status
  const handleToggleAutomationsPause = async () => {
    if (!contact) return;
    
    setIsTogglingPause(true);
    try {
      const newPausedState = !contact.automations_paused;
      
      const { error } = await supabase
        .from('contacts')
        .update({
          automations_paused: newPausedState,
        })
        .eq('id', contact.id);
      
      if (error) throw error;
      
      // Invalidate contacts cache
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
      
      toast.success(newPausedState 
        ? 'Automações pausadas para este contato' 
        : 'Automações reativadas para este contato'
      );
    } catch (error: any) {
      console.error('Error toggling automations pause:', error);
      toast.error('Erro ao alterar status de automações');
    } finally {
      setIsTogglingPause(false);
    }
  };

  // Toggle AI agent for this contact
  const { data: conversationalAgents } = useConversationalAgents();
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);

  const handleToggleAi = async () => {
    if (!contact) return;
    
    // If AI is already enabled, just disable
    if (contact.ai_enabled) {
      setIsTogglingAi(true);
      try {
        const { error } = await supabase
          .from('contacts')
          .update({ ai_enabled: false, ai_agent_id: null } as any)
          .eq('id', contact.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
        toast.success('IA desativada para este contato');
      } catch {
        toast.error('Erro ao desativar IA');
      } finally {
        setIsTogglingAi(false);
      }
      return;
    }

    // If only one agent, activate directly
    if (conversationalAgents && conversationalAgents.length === 1) {
      await activateAgentForContact(conversationalAgents[0].id);
      return;
    }

    // Multiple agents: open popover
    setAiPopoverOpen(true);
  };

  const activateAgentForContact = async (agentId: string) => {
    if (!contact) return;
    setIsTogglingAi(true);
    setAiPopoverOpen(false);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ ai_enabled: true, ai_agent_id: agentId } as any)
        .eq('id', contact.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
      toast.success('IA ativada para este contato');
    } catch {
      toast.error('Erro ao ativar IA');
    } finally {
      setIsTogglingAi(false);
    }
  };
  const scrollToBottom = useCallback((instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
    setHasNewMessages(false);
    setNewMessagesCount(0);
  }, []);
  
  // State for highlighting a message when scrolled to
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isLoadingQuotedMessage, setIsLoadingQuotedMessage] = useState(false);
  
  // Scroll to a specific quoted message, loading more history if needed
  const scrollToMessage = useCallback(async (messageId: string) => {
    // Helper: poll DOM up to `maxMs` for the message element (uses rAF for responsiveness)
    const waitForElement = (id: string, maxMs = 600): Promise<HTMLElement | null> => {
      return new Promise((resolve) => {
        const start = performance.now();
        const tick = () => {
          const el = document.getElementById(`message-${id}`);
          if (el) return resolve(el);
          if (performance.now() - start >= maxMs) return resolve(null);
          requestAnimationFrame(tick);
        };
        tick();
      });
    };

    // Already loaded?
    const existing = document.getElementById(`message-${messageId}`);
    if (existing) {
      existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
      return;
    }

    if (!hasNextPage) {
      toast.info('Mensagem não encontrada no histórico');
      return;
    }

    setIsLoadingQuotedMessage(true);

    const maxAttempts = 15; // ~450 messages
    let found: HTMLElement | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      const result = await fetchNextPage();
      // Wait for the DOM to render the freshly loaded page
      found = await waitForElement(messageId, 600);
      if (found) break;
      // Use the freshest result rather than a stale closure to decide if more pages exist
      const lastPage: any = result?.data?.pages?.[result.data.pages.length - 1];
      if (!lastPage?.nextCursor) break;
    }

    setIsLoadingQuotedMessage(false);

    if (found) {
      found.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    } else {
      toast.info('Mensagem não encontrada no histórico');
    }
  }, [hasNextPage, fetchNextPage]);
  
  // Find quoted message by content when quoted_message_id is not available
  const findQuotedMessageId = useCallback((msg: Message): string | null => {
    // First try the direct quoted_message_id
    if (msg.quoted_message_id) {
      return msg.quoted_message_id;
    }
    
    // If we have quoted_content but no quoted_message_id, try to find the message
    if (msg.quoted_content && msg.quoted_type) {
      // Look for a message with matching content and type
      const quotedMsg = messages.find(m => {
        // For media types, content is usually "Imagem", "Áudio", etc. - match by type and media_url existence
        if (['image', 'audio', 'video', 'document', 'sticker'].includes(msg.quoted_type || '')) {
          return m.message_type === msg.quoted_type && m.media_url;
        }
        // For text messages, match by content
        return m.message_type === msg.quoted_type && m.content === msg.quoted_content;
      });
      return quotedMsg?.id || null;
    }
    
    return null;
  }, [messages]);
  
  // Check if user is near bottom of scroll
  const checkIfNearBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return true;
    
    // 200px threshold compensates for macOS trackpad inertial scroll
    const threshold = 200;
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
    
    // Load older messages when scrolling to top
    const viewport = scrollViewportRef.current;
    if (viewport && viewport.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      const prevScrollHeight = viewport.scrollHeight;
      fetchNextPage().then(() => {
        // Maintain scroll position after loading older messages
        requestAnimationFrame(() => {
          if (viewport) {
            const newScrollHeight = viewport.scrollHeight;
            viewport.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      });
    }
  }, [checkIfNearBottom, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Helper: force unread_count=0 for the open contact, debounced, and patch all caches.
  const resetUnreadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetAtRef = useRef<number>(0);
  // Flag: usuário marcou manualmente como não lida — pausa o auto-reset reativo
  const manualUnreadRef = useRef<boolean>(false);
  const forceResetUnread = useCallback((immediate = false) => {
    if (!contact?.id) return;
    // Só dispara o UPDATE no banco se realmente houver não lidas — evita
    // que abrir uma conversa já lida gere um realtime UPDATE redundante,
    // que poderia causar flicker no badge global.
    const wasUnread = (contact.unread_count ?? 0) > 0;
    if (!wasUnread) return;
    const run = () => {
      lastResetAtRef.current = Date.now();
      supabase
        .from('contacts')
        .update({ unread_count: 0 })
        .eq('id', contact.id)
        .then(() => {
          // Atualiza apenas o cache local da lista de contatos.
          // O badge global (`unread-messages-total`) é controlado pelo hook
          // useUnreadMessages via realtime — não tocamos aqui para evitar
          // decremento duplicado.
          queryClient.setQueriesData(
            { queryKey: ['conversation-contacts'] },
            (old: any[] | undefined) => {
              if (!old) return old;
              return old.map((c: any) =>
                c.id === contact.id ? { ...c, unread_count: 0 } : c
              );
            }
          );
          queryClient.setQueriesData(
            { queryKey: ['conversation-contacts-paginated'] },
            (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: any[]) =>
                  page.map((c: any) =>
                    c.id === contact.id ? { ...c, unread_count: 0 } : c
                  )
                ),
              };
            }
          );
        });
    };
    if (resetUnreadTimerRef.current) {
      clearTimeout(resetUnreadTimerRef.current);
      resetUnreadTimerRef.current = null;
    }
    if (immediate) {
      run();
    } else {
      resetUnreadTimerRef.current = setTimeout(run, 150);
    }
  }, [contact?.id, contact?.unread_count, queryClient]);


  // Reset unread on contact open / mount (idempotent — covers stale select state)
  useEffect(() => {
    if (!contact?.id) return;
    // Ao abrir/trocar de contato, comportamento padrão volta: marca como lida
    manualUnreadRef.current = false;
    forceResetUnread(true);
    return () => {
      if (resetUnreadTimerRef.current) clearTimeout(resetUnreadTimerRef.current);
    };
  }, [contact?.id, forceResetUnread]);

  // Realtime subscription - track new incoming messages directly
  useEffect(() => {
    if (!contact?.id) return;

    const channel = supabase
      .channel(`messages:${contact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `contact_id=eq.${contact.id}`,
        },
        (payload) => {
          console.log('[Realtime] New message received:', payload.new);
          const newMessage = payload.new as any;
          const isOutbound = newMessage?.direction === 'outbound';

          // Compute scroll position BEFORE refetch
          const viewport = scrollViewportRef.current;
          let nearBottom = true;
          if (viewport) {
            const threshold = 200;
            const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            nearBottom = distanceFromBottom < threshold;
          }

          // "Novas mensagens" indicator should NEVER fire for outbound messages
          // (echoes from external WhatsApp clients or our own optimistic confirmations).
          if (
            !isOutbound &&
            lastSeenTimestampRef.current &&
            newMessage.created_at > lastSeenTimestampRef.current &&
            !nearBottom
          ) {
            setHasNewMessages(true);
            setNewMessagesCount((prev) => prev + 1);
          }

          // For outbound, advance lastSeen so the counter doesn't accumulate stale deltas
          if (isOutbound) {
            lastSeenTimestampRef.current = newMessage.created_at;
          }

          // Since this conversation is open, mark as read (debounced — handles bursts)
          if (newMessage.direction === 'inbound') {
            // Nova mensagem inbound invalida o "marcar como não lida" manual
            manualUnreadRef.current = false;
            forceResetUnread();
          }

          // Skip refetch if this outbound message is already in cache —
          // onSuccess already replaced the temp-* ID with the real UUID.
          // This prevents a duplicate bubble when realtime races with onSuccess.
          const cached = flattenMessages(queryClient.getQueryData(['messages', contact.id]));
          const alreadyInCache = cached.some((m) => m.id === newMessage.id);

          if (alreadyInCache) {
            // Update created_at to server timestamp so ordering stays consistent
            // with DB after any future refetch (onSuccess kept browser time).
            queryClient.setQueryData(['messages', contact.id], (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  messages: page.messages.map((msg: any) =>
                    msg.id === newMessage.id
                      ? { ...msg, created_at: newMessage.created_at, sequence_id: newMessage.sequence_id ?? msg.sequence_id }
                      : msg
                  ),
                })),
              };
            });
            if (nearBottom) {
              requestAnimationFrame(() => {
                const v = scrollViewportRef.current;
                if (v) v.scrollTop = v.scrollHeight;
              });
            }
            return;
          }

          // Inject the message immediately from the realtime payload so it appears
          // without waiting for a DB round-trip (WAL lag can delay refetch by seconds).
          // The refetch runs in the background to hydrate sender names and clean temp-* IDs.
          queryClient.setQueryData(['messages', contact.id], (old: any) => {
            if (!old?.pages?.length) return old;
            // Page 0 = newest page; messages within it are stored in ascending order (oldest→newest).
            // Append new message at the end so it shows at the bottom of the chat.
            const page0 = old.pages[0];
            if (page0.messages.some((m: any) => m.id === newMessage.id)) return old;
            return {
              ...old,
              pages: [
                { ...page0, messages: [...page0.messages, { ...newMessage, sent_by_name: null }] },
                ...old.pages.slice(1),
              ],
            };
          });
          if (nearBottom) {
            requestAnimationFrame(() => {
              const v = scrollViewportRef.current;
              if (v) v.scrollTop = v.scrollHeight;
            });
          }

          // Background refetch: hydrates sent_by_name and removes confirmed temp-* optimistic msgs.
          // Delays handle WAL lag — realtime fires before the row is visible to read queries.
          const doRefetchAndClean = () => refetch().then(() => {
            queryClient.setQueryData(['messages', contact.id], (old: any) => {
              if (!old?.pages) return old;
              const allReal = old.pages.flatMap((p: any) => p.messages).filter((m: any) => !String(m.id).startsWith('temp-'));
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  messages: page.messages.filter((m: any) => {
                    if (!String(m.id).startsWith('temp-')) return true;
                    const confirmed = allReal.some(
                      (r: any) =>
                        r.direction === 'outbound' &&
                        r.content === m.content &&
                        Math.abs(new Date(r.created_at).getTime() - new Date(m.created_at).getTime()) < 10_000
                    );
                    return !confirmed;
                  }),
                })),
              };
            });
            if (nearBottom) {
              requestAnimationFrame(() => {
                const v = scrollViewportRef.current;
                if (v) v.scrollTop = v.scrollHeight;
              });
            }
          });

          setTimeout(() => doRefetchAndClean(), 300);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `contact_id=eq.${contact.id}`,
        },
        (payload) => {
          console.log('[Realtime] Message updated:', payload.new);
          queryClient.invalidateQueries({ queryKey: ['messages', contact.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `contact_id=eq.${contact.id}`,
        },
        (payload) => {
          console.log('[Realtime] Message deleted:', payload.old);
          queryClient.invalidateQueries({ queryKey: ['messages', contact.id] });
        }
      )
      // Guard: if the webhook re-increments unread_count while this conversation
      // is open (race with multi-message bursts), zero it out reactively.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${contact.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData && (newData.unread_count ?? 0) > 0) {
            // Se o usuário marcou manualmente como não lida, NÃO zera
            if (manualUnreadRef.current) return;
            forceResetUnread();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Channel status:', status);
        // Refetch when subscription connects to catch messages that arrived
        // during the setup window (before the channel was ready).
        if (status === 'SUBSCRIBED') {
          refetch();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contact?.id, queryClient, refetch, forceResetUnread]);


  // Track previous contact to detect contact change
  const prevContactIdRef = useRef<string | null>(null);

  // Attach scroll listener to viewport
  useEffect(() => {
    // Find the actual scrollable viewport inside ScrollArea
    const scrollArea = scrollAreaRef.current;
    const viewport = scrollArea?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    
    if (viewport) {
      scrollViewportRef.current = viewport;
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, contact?.id]);

  // Auto scroll to bottom on contact change and update last seen timestamp
  useEffect(() => {
    // Instant scroll when opening a new contact (first load or contact switch)
    const isContactChange = prevContactIdRef.current !== contact?.id;

    if (isContactChange && !isLoading && messages.length > 0) {
      const forceScroll = () => {
        const v = scrollViewportRef.current;
        if (v) {
          v.scrollTop = v.scrollHeight;
        } else if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
      };

      // Multiple retries to handle late layout shifts (images/avatars loading,
      // bubbles measured after fonts/icons paint). Cheap and idempotent.
      requestAnimationFrame(() => {
        forceScroll();
        requestAnimationFrame(forceScroll);
      });
      const t1 = setTimeout(forceScroll, 100);
      const t2 = setTimeout(forceScroll, 300);
      const t3 = setTimeout(forceScroll, 700);

      prevContactIdRef.current = contact?.id || null;
      // Set the last seen timestamp to the newest message
      const newestMessage = messages[messages.length - 1];
      if (newestMessage) {
        lastSeenTimestampRef.current = newestMessage.created_at;
      }
      // Clear editing state when switching contacts
      setEditingMessage(null);
      setReplyingTo(null);
      setMessage('');
      // Reset new messages state
      setHasNewMessages(false);
      setNewMessagesCount(0);
      // Close search when switching contacts
      setIsSearchOpen(false);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [messages.length, contact?.id, isLoading, scrollToBottom]);

  
  // Update last seen timestamp when user scrolls to bottom
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      const newestMessage = messages[messages.length - 1];
      if (newestMessage) {
        lastSeenTimestampRef.current = newestMessage.created_at;
      }
    }
  }, [isNearBottom, messages]);

  const handleSend = async () => {
    if (!message.trim() || !contact) return;

    const messageText = message.trim();
    
    // If editing a message, handle edit flow
    if (editingMessage) {
      setMessage('');
      setEditingMessage(null);
      
      // Only call API if content actually changed
      if (messageText !== editingMessage.content) {
        editMessage.mutate(
          { message_id: editingMessage.id, contact_id: contact.id, new_text: messageText },
          {
            onSuccess: () => {
              toast.success('Mensagem editada');
            },
            onError: (error) => {
              toast.error('Erro ao editar mensagem');
              console.error('Edit error:', error);
            },
          }
        );
      }
      return;
    }
    
    const tempId = `temp-${Date.now()}`;
    const currentReplyingTo = replyingTo;
    // Capture timestamp at the moment user clicks send
    const clientTimestamp = new Date().toISOString();
    
    // Clear input and reply immediately
    setMessage('');
    setReplyingTo(null);

    // Create optimistic message
    const optimisticMessage = {
      id: tempId,
      contact_id: contact.id,
      content: messageText,
      message_type: 'text' as const,
      media_url: null,
      direction: 'outbound' as const,
      status: 'pending' as const,
      organization_id: '',
      created_at: clientTimestamp,
      quoted_message_id: currentReplyingTo?.id || null,
      quoted_content: currentReplyingTo?.content || null,
      quoted_type: currentReplyingTo?.message_type || null,
    };

    // Add optimistic message to cache immediately (for infinite query structure)
    queryClient.setQueryData(['messages', contact.id], (old: any) => {
      if (!old?.pages) return old;
      const lastPageIndex = old.pages.length - 1;
      return {
        ...old,
        pages: old.pages.map((page: any, index: number) => 
          index === lastPageIndex 
            ? { ...page, messages: [...page.messages, optimisticMessage] }
            : page
        ),
      };
    });

    // Force scroll to bottom after sending a message (after DOM updates)
    requestAnimationFrame(() => {
      scrollToBottom(true);
    });

    // Enqueue the message to ensure sequential sending
    enqueue(async () => {
      try {
        if (isInstagram) {
          // Send via Instagram
          const result = await sendInstagramMessage.mutateAsync({
            contact_id: contact.id,
            message: messageText,
            client_timestamp: clientTimestamp,
          });
          queryClient.setQueryData(['messages', contact.id], (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                messages: page.messages.map((msg: any) =>
                  msg.id === tempId 
                    ? { ...msg, id: result?.message_id || tempId, status: 'sent' } 
                    : msg
                ),
              })),
            };
          });
        } else {
          // Send via WhatsApp (with quote info if replying, and client timestamp)
          const result = await sendWhatsAppMessage.mutateAsync({
            contact_id: contact.id,
            phone: contact.phone,
            message: messageText,
            client_timestamp: clientTimestamp,
            quoted_message_id: currentReplyingTo?.id,
            quoted_content: currentReplyingTo?.content || undefined,
            quoted_type: currentReplyingTo?.message_type,
          });
        
          // On success, update the optimistic message status to 'sent' (for infinite query structure)
          queryClient.setQueryData(['messages', contact.id], (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                messages: page.messages.map((msg: any) =>
                  msg.id === tempId 
                    ? { ...msg, id: result?.message_id || tempId, status: 'sent' } 
                    : msg
                ),
              })),
            };
          });
        }
      } catch (whatsappError: any) {
        console.warn('WhatsApp send failed:', whatsappError);
        
        // Update optimistic message to failed status (for infinite query structure)
        queryClient.setQueryData(['messages', contact.id], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === tempId ? { ...msg, status: 'failed' } : msg
              ),
            })),
          };
        });
      }
    });
  };

  // Send a plain text message programmatically (used by the catalog drag-and-drop flow)
  const sendTextMessage = useCallback((text: string) => {
    if (!contact || !text.trim()) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const clientTimestamp = new Date().toISOString();

    const optimisticMessage = {
      id: tempId,
      contact_id: contact.id,
      content: text,
      message_type: 'text' as const,
      media_url: null,
      direction: 'outbound' as const,
      status: 'pending' as const,
      organization_id: '',
      created_at: clientTimestamp,
      quoted_message_id: null,
      quoted_content: null,
      quoted_type: null,
    };

    queryClient.setQueryData(['messages', contact.id], (old: any) => {
      if (!old?.pages) return old;
      const lastPageIndex = old.pages.length - 1;
      return {
        ...old,
        pages: old.pages.map((page: any, index: number) =>
          index === lastPageIndex
            ? { ...page, messages: [...page.messages, optimisticMessage] }
            : page
        ),
      };
    });

    requestAnimationFrame(() => {
      scrollToBottom(true);
    });

    enqueue(async () => {
      try {
        const result = isInstagram
          ? await sendInstagramMessage.mutateAsync({
              contact_id: contact.id,
              message: text,
              client_timestamp: clientTimestamp,
            })
          : await sendWhatsAppMessage.mutateAsync({
              contact_id: contact.id,
              phone: contact.phone,
              message: text,
              client_timestamp: clientTimestamp,
            });

        queryClient.setQueryData(['messages', contact.id], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === tempId
                  ? { ...msg, id: (result as any)?.message_id || tempId, status: 'sent' }
                  : msg
              ),
            })),
          };
        });
      } catch (error: any) {
        console.warn('Catalog text send failed:', error);
        queryClient.setQueryData(['messages', contact.id], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === tempId ? { ...msg, status: 'failed' } : msg
              ),
            })),
          };
        });
      }
    });
  }, [contact, isInstagram, sendInstagramMessage, sendWhatsAppMessage, queryClient, enqueue, scrollToBottom]);

  const handleRetry = async (failedMessage: any) => {
    if (!contact) return;

    const oldId = failedMessage.id;
    const isMedia = ['image', 'video', 'audio', 'document', 'sticker'].includes(failedMessage.message_type);

    // Media retry: re-use the cached File reference, no re-pick required
    if (isMedia) {
      const cached = failedMediaRef.current.get(oldId);
      if (!cached) {
        toast.error('Arquivo não disponível para reenvio. Selecione novamente.');
        return;
      }

      // Remove the failed bubble; handleSendMedia will recreate an optimistic one
      queryClient.setQueryData(['messages', contact.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.filter((m: any) => m.id !== oldId),
          })),
        };
      });
      URL.revokeObjectURL(cached.tempUrl);
      failedMediaRef.current.delete(oldId);

      handleSendMedia(cached.file, cached.type, cached.caption);
      return;
    }

    // Text retry (legacy)
    if (!failedMessage.content) return;
    const messageText = failedMessage.content;

    // Update the failed message to pending status
    queryClient.setQueryData(['messages', contact.id], (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          messages: page.messages.map((msg: any) =>
            msg.id === oldId ? { ...msg, status: 'pending' } : msg
          ),
        })),
      };
    });

    try {
      await sendWhatsAppMessage.mutateAsync({
        contact_id: contact.id,
        phone: contact.phone,
        message: messageText,
      });
      queryClient.invalidateQueries({ queryKey: ['messages', contact.id] });
    } catch (error: any) {
      console.warn('Retry failed:', error);
      queryClient.setQueryData(['messages', contact.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === oldId ? { ...msg, status: 'failed' } : msg
            ),
          })),
        };
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Close quick message picker on Escape
    if (e.key === 'Escape' && showQuickMessages) {
      e.preventDefault();
      setShowQuickMessages(false);
      return;
    }
    
    // Navigate quick messages with arrow keys
    if (showQuickMessages && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      // Let the Command component handle navigation
      return;
    }
    
    // Close picker and send on Enter (if picker not selecting)
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showQuickMessages) {
        // Picker handles its own Enter selection
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  // Handle message input change - detect "/" for quick messages
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    
    // Check if message starts with "/"
    if (value.startsWith('/') && value.length >= 1) {
      setShowQuickMessages(true);
      setQuickMessageSearch(value.slice(1)); // Remove the "/" for search
    } else {
      setShowQuickMessages(false);
      setQuickMessageSearch('');
    }
  };

  // Handle quick message selection
  const handleQuickMessageSelect = async (quickMessage: QuickMessage) => {
    setShowQuickMessages(false);
    
    // If has media, send it
    if (quickMessage.media_url) {
      // For media quick messages, fetch the file and send
      try {
        const response = await fetch(quickMessage.media_url);
        const blob = await response.blob();
        const filename = quickMessage.media_url.split('/').pop() || 'file';
        const file = new File([blob], filename, { type: blob.type });
        
        // Determine media type
        let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
        if (quickMessage.media_type === 'image') mediaType = 'image';
        else if (quickMessage.media_type === 'video') mediaType = 'video';
        else if (quickMessage.media_type === 'audio') mediaType = 'audio';
        
        // Send with caption if there's content
        if (mediaType === 'image' || mediaType === 'video') {
          handleSendMedia(file, mediaType, quickMessage.content || undefined);
        } else {
          handleSendMedia(file, mediaType);
        }
        
        setMessage('');
      } catch (error) {
        console.error('Error loading quick message media:', error);
        toast.error('Erro ao carregar mídia da mensagem rápida');
      }
    } else if (quickMessage.content) {
      // Just text - set it in input and send
      setMessage(quickMessage.content);
      // Auto-send after a brief moment to show the content
      setTimeout(() => {
        if (contact) {
          // Manually trigger send with the quick message content
          const msgToSend = quickMessage.content || '';
          setMessage('');
          
          const tempId = `temp-${Date.now()}`;
          const clientTimestamp = new Date().toISOString();
          
          const optimisticMessage = {
            id: tempId,
            contact_id: contact.id,
            content: msgToSend,
            message_type: 'text' as const,
            media_url: null,
            direction: 'outbound' as const,
            status: 'pending' as const,
            organization_id: '',
            created_at: clientTimestamp,
            quoted_message_id: null,
            quoted_content: null,
            quoted_type: null,
          };

          queryClient.setQueryData(['messages', contact.id], (old: any) => {
            if (!old?.pages) return old;
            const lastPageIndex = old.pages.length - 1;
            return {
              ...old,
              pages: old.pages.map((page: any, index: number) => 
                index === lastPageIndex 
                  ? { ...page, messages: [...page.messages, optimisticMessage] }
                  : page
              ),
            };
          });

          enqueue(async () => {
            try {
              const result = await sendWhatsAppMessage.mutateAsync({
                contact_id: contact.id,
                phone: contact.phone,
                message: msgToSend,
                client_timestamp: clientTimestamp,
              });
              
              queryClient.setQueryData(['messages', contact.id], (old: any) => {
                if (!old?.pages) return old;
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    messages: page.messages.map((msg: any) =>
                      msg.id === tempId 
                        ? { ...msg, id: result?.message_id || tempId, status: 'sent' } 
                        : msg
                    ),
                  })),
                };
              });
            } catch (whatsappError) {
              console.warn('WhatsApp send failed:', whatsappError);
              queryClient.setQueryData(['messages', contact.id], (old: any) => {
                if (!old?.pages) return old;
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    messages: page.messages.map((msg: any) =>
                      msg.id === tempId ? { ...msg, status: 'failed' } : msg
                    ),
                  })),
                };
              });
            }
          });
        }
      }, 100);
    }
  };

  // Size limits per WhatsApp
  const MEDIA_LIMITS: Record<MessageType, number> = {
    image: 16 * 1024 * 1024,
    video: 64 * 1024 * 1024,
    audio: 16 * 1024 * 1024,
    document: 100 * 1024 * 1024,
    text: 0, sticker: 16 * 1024 * 1024, contact: 0, contacts: 0, location: 0,
  };

  const validateFileSize = (file: File, type: MessageType): boolean => {
    const limit = MEDIA_LIMITS[type] || 16 * 1024 * 1024;
    if (file.size > limit) {
      const mb = Math.round(limit / 1024 / 1024);
      toast.error(`"${file.name}" excede o limite de ${mb}MB para ${type === 'document' ? 'documento' : type}`);
      return false;
    }
    return true;
  };

  const detectFileType = (file: File): MessageType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !contact) return;
    const files = Array.from(fileList).filter((f) => validateFileSize(f, type));
    if (files.length === 0) {
      e.target.value = '';
      return;
    }

    setAttachmentOpen(false);

    // For images and videos, open caption dialog (batch-aware)
    if (type === 'image' || type === 'video') {
      setPendingMediaFiles(files);
      setPendingMediaFile(files[0]);
      setPendingMediaType(type);
      setMediaCaptionOpen(true);
      e.target.value = '';
      return;
    }

    // For audio and documents, send all directly (sequentially via enqueue)
    files.forEach((file) => handleSendMedia(file, type));
    e.target.value = '';
  };

  // Handle files from drag & drop or paste
  const handleDroppedFiles = useCallback((files: File[]) => {
    if (!contact || files.length === 0) return;

    const visualFiles: File[] = [];
    const otherFiles: { file: File; type: MessageType }[] = [];

    for (const file of files) {
      const type = detectFileType(file);
      if (!validateFileSize(file, type)) continue;
      if (type === 'image' || type === 'video') {
        visualFiles.push(file);
      } else {
        otherFiles.push({ file, type });
      }
    }

    // Send audio/documents straight away
    otherFiles.forEach(({ file, type }) => handleSendMedia(file, type));

    // Open caption dialog for image/video batch
    if (visualFiles.length > 0) {
      const firstType: 'image' | 'video' = visualFiles[0].type.startsWith('video/') ? 'video' : 'image';
      setPendingMediaFiles(visualFiles);
      setPendingMediaFile(visualFiles[0]);
      setPendingMediaType(firstType);
      setMediaCaptionOpen(true);
    }
  }, [contact]);

  // Handle webcam capture
  const handleWebcamCapture = useCallback((file: File, caption?: string) => {
    if (!contact) return;
    handleSendMedia(file, 'image', caption);
  }, [contact]);

  // Drag & drop and paste support
  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    dropZoneRef
  } = useFileDropPaste({
    onFilesAdded: handleDroppedFiles,
    enabled: !!contact
  });

  const handleSendMedia = async (file: File, type: MessageType, caption?: string) => {
    if (!contact) return;

    setIsUploading(true);

    // Map MessageType to media_type for the API
    const mediaTypeMap: Record<MessageType, 'image' | 'audio' | 'video' | 'document'> = {
      image: 'image',
      audio: 'audio',
      video: 'video',
      document: 'document',
      text: 'document', // fallback
      sticker: 'image', // stickers sent as images
      contact: 'document', // contacts not sent as media, fallback
      contacts: 'document', // contacts not sent as media, fallback
      location: 'document', // location not sent as media, fallback
    };

    const tempId = `temp-media-${Date.now()}`;
    const tempUrl = URL.createObjectURL(file);
    // Capture timestamp at the moment user sends media
    const clientTimestamp = new Date().toISOString();

    // Create optimistic message
    const optimisticMessage = {
      id: tempId,
      contact_id: contact.id,
      content: caption || file.name,
      message_type: type,
      media_url: tempUrl, // Temporary local URL for preview
      direction: 'outbound' as const,
      status: 'pending' as const,
      organization_id: '',
      created_at: clientTimestamp,
      quoted_message_id: null,
      quoted_content: null,
      quoted_type: null,
    };

    // Add optimistic message to cache (for infinite query structure)
    queryClient.setQueryData(['messages', contact.id], (old: any) => {
      if (!old?.pages) return old;
      const lastPageIndex = old.pages.length - 1;
      return {
        ...old,
        pages: old.pages.map((page: any, index: number) => 
          index === lastPageIndex 
            ? { ...page, messages: [...page.messages, optimisticMessage] }
            : page
        ),
      };
    });

    // Enqueue the media send to ensure sequential delivery
    enqueue(async () => {
      try {
        const preparedMedia = type === 'audio' && !isInstagram
          ? await prepareWhatsAppAudioFile(file)
          : { blob: file, fileName: file.name, contentType: file.type || 'application/octet-stream' };

        // Convert file to base64 for edge function upload (bypasses storage RLS)
        const arrayBuffer = await preparedMedia.blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const fileBase64 = btoa(binary);

        const result = isInstagram
          ? await sendInstagramMessage.mutateAsync({
              contact_id: contact.id,
              message: caption || file.name,
              file_base64: fileBase64,
              file_name: preparedMedia.fileName,
              file_content_type: preparedMedia.contentType,
              media_type: mediaTypeMap[type],
              client_timestamp: clientTimestamp,
            })
          : await sendWhatsAppMedia.mutateAsync({
              contact_id: contact.id,
              phone: contact.phone,
              file_base64: fileBase64,
              file_name: preparedMedia.fileName,
              file_content_type: preparedMedia.contentType,
              media_type: mediaTypeMap[type],
              caption: (type === 'image' || type === 'video') ? caption : undefined,
              filename: type === 'document' ? preparedMedia.fileName : undefined,
              client_timestamp: clientTimestamp,
            });

        // Update optimistic message with real data (for infinite query structure)
        queryClient.setQueryData(['messages', contact.id], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === tempId 
                  ? { ...msg, id: result?.message_id || tempId, media_url: result?.media_url || tempUrl, status: 'sent' } 
                  : msg
              ),
            })),
          };
        });

        // Success: cleanup local preview & ref
        URL.revokeObjectURL(tempUrl);
        failedMediaRef.current.delete(tempId);
      } catch (error: any) {
        console.error('Upload/send error:', error);

        // Keep the File reference so the user can retry without re-picking
        failedMediaRef.current.set(tempId, { file, type, caption, tempUrl });

        // Update optimistic message to failed status (for infinite query structure)
        queryClient.setQueryData(['messages', contact.id], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === tempId ? { ...msg, status: 'failed' } : msg
              ),
            })),
          };
        });

        toast.error(`Falha ao enviar "${file.name}". Clique em tentar novamente.`);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  };

  // Send a catalog product's photos + description into the conversation
  const handleSendCatalogProduct = useCallback(async (product: Product) => {
    if (!contact) return;

    const images = [...(product.images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const priceLabel = product.is_available ? ` — ${brl(product.base_price)}` : ' (indisponível)';
    const titleLine = `*${product.name}*${priceLabel}`;

    if (images.length === 0) {
      sendTextMessage([titleLine, product.description].filter(Boolean).join('\n\n'));
      toast.success(`Enviando "${product.name}"...`);
      return;
    }

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const ext = (img.url.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
        const safeName = product.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const file = new File([blob], `${safeName}-${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' });
        handleSendMedia(file, 'image', i === 0 ? titleLine : undefined);
      } catch (error) {
        console.error('Failed to fetch catalog image for sending:', error);
        toast.error(`Falha ao carregar uma foto de "${product.name}"`);
      }
    }

    if (product.description) {
      sendTextMessage(product.description);
    }

    toast.success(`Enviando "${product.name}"...`);
  }, [contact, sendTextMessage, handleSendMedia, brl]);

  const handleCatalogDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragProduct(null);
    const { active, over } = event;
    if (!over || over.id !== 'chat-message-dropzone') return;
    const id = String(active.id);
    if (!id.startsWith('catalog:')) return;
    const productId = id.slice('catalog:'.length);
    const product = catalogProducts.find((p) => p.id === productId);
    if (product) handleSendCatalogProduct(product);
  }, [catalogProducts, handleSendCatalogProduct]);

  const handleMediaCaptionSend = (caption: string) => {
    if (!pendingMediaFile) return;
    const fileToSend = pendingMediaFile;
    const typeToSend = pendingMediaType;
    setMediaCaptionOpen(false);
    setPendingMediaFile(null);
    setPendingMediaFiles([]);
    handleSendMedia(fileToSend, typeToSend, caption);
  };

  const handleMediaCaptionSendBatch = (items: { file: File; caption: string }[]) => {
    if (items.length === 0) return;
    setMediaCaptionOpen(false);
    setPendingMediaFile(null);
    setPendingMediaFiles([]);
    items.forEach(({ file, caption }) => {
      const type: MessageType = file.type.startsWith('video/') ? 'video' : 'image';
      handleSendMedia(file, type, caption);
    });
  };

  const handleAudioRecordingComplete = async (audioBlob: Blob, duration: number) => {
    if (!contact) return;

    setIsUploading(true);

    const tempId = `temp-audio-${Date.now()}`;
    const tempUrl = URL.createObjectURL(audioBlob);

    // Create optimistic message
    const optimisticMessage = {
      id: tempId,
      contact_id: contact.id,
      content: `Áudio (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
      message_type: 'audio' as const,
      media_url: tempUrl,
      direction: 'outbound' as const,
      status: 'pending' as const,
      organization_id: '',
      created_at: new Date().toISOString(),
      quoted_message_id: null,
      quoted_content: null,
      quoted_type: null,
    };

    // Add optimistic message to cache (for infinite query structure)
    queryClient.setQueryData(['messages', contact.id], (old: any) => {
      if (!old?.pages) return old;
      const lastPageIndex = old.pages.length - 1;
      return {
        ...old,
        pages: old.pages.map((page: any, index: number) => 
          index === lastPageIndex 
            ? { ...page, messages: [...page.messages, optimisticMessage] }
            : page
        ),
      };
    });

    // Close recorder UI
    setIsRecordingAudio(false);

    try {
      // Converte para MP3 antes de enviar à API Oficial, evitando rejeição de WebM/codec incompatível.
      const preparedAudio = isInstagram
        ? { blob: audioBlob, fileName: `audio_${Date.now()}.webm`, contentType: audioBlob.type || 'audio/webm' }
        : await prepareWhatsAppAudioFile(audioBlob);

      // Convert blob to base64 for edge function upload (bypasses storage RLS)
      const arrayBuffer = await preparedAudio.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      const result = isInstagram
        ? await sendInstagramMessage.mutateAsync({
            contact_id: contact.id,
            message: `Áudio (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
            file_base64: fileBase64,
            file_name: preparedAudio.fileName,
            file_content_type: preparedAudio.contentType,
            media_type: 'audio',
            client_timestamp: optimisticMessage.created_at,
          })
        : await sendWhatsAppMedia.mutateAsync({
            contact_id: contact.id,
            phone: contact.phone,
            file_base64: fileBase64,
            file_name: preparedAudio.fileName,
            file_content_type: preparedAudio.contentType,
            media_type: 'audio',
            client_timestamp: optimisticMessage.created_at,
          });

      // Update optimistic message with real data (for infinite query structure)
      queryClient.setQueryData(['messages', contact.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === tempId 
                ? { ...msg, id: result?.message_id || tempId, media_url: result?.media_url || tempUrl, status: 'sent' } 
                : msg
            ),
          })),
        };
      });
    } catch (error: any) {
      console.error('Audio upload/send error:', error);
      
      // Update optimistic message to failed status (for infinite query structure)
      queryClient.setQueryData(['messages', contact.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === tempId ? { ...msg, status: 'failed' } : msg
            ),
          })),
        };
      });
      
      toast.error(error.message || 'Erro ao enviar áudio');
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(tempUrl);
    }
  };

  // Send sticker via WhatsApp
  const handleSendSticker = async (stickerUrl: string) => {
    if (!contact) return;
    
    setShowStickerPicker(false);
    setIsUploading(true);

    const tempId = `temp-sticker-${Date.now()}`;
    const clientTimestamp = new Date().toISOString();

    // Create optimistic message
    const optimisticMessage = {
      id: tempId,
      contact_id: contact.id,
      content: null,
      message_type: 'sticker' as const,
      media_url: stickerUrl,
      direction: 'outbound' as const,
      status: 'pending' as const,
      organization_id: '',
      created_at: clientTimestamp,
      quoted_message_id: null,
      quoted_content: null,
      quoted_type: null,
    };

    // Add optimistic message to cache
    queryClient.setQueryData(['messages', contact.id], (old: any) => {
      if (!old?.pages) return old;
      const lastPageIndex = old.pages.length - 1;
      return {
        ...old,
        pages: old.pages.map((page: any, index: number) => 
          index === lastPageIndex 
            ? { ...page, messages: [...page.messages, optimisticMessage] }
            : page
        ),
      };
    });

    try {
      const data = isInstagram
        ? await sendInstagramMessage.mutateAsync({
            contact_id: contact.id,
            message: 'Figurinha',
            media_url: stickerUrl,
            media_type: 'image',
            client_timestamp: clientTimestamp,
          })
        : await (async () => {
            const { data, error } = await supabase.functions.invoke('stevo-send-sticker', {
              body: {
                contact_id: contact.id,
                phone: contact.phone,
                sticker_url: stickerUrl,
                client_timestamp: clientTimestamp,
              }
            });

            if (error) throw error;
            return data;
          })();

      // Update optimistic message
      queryClient.setQueryData(['messages', contact.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === tempId 
                ? { ...msg, id: data?.message_id || tempId, status: 'sent' } 
                : msg
            ),
          })),
        };
      });
    } catch (error: any) {
      console.error('Sticker send error:', error);
      
      // Update to failed status
      queryClient.setQueryData(['messages', contact.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === tempId ? { ...msg, status: 'failed' } : msg
            ),
          })),
        };
      });
      
      toast.error('Erro ao enviar figurinha');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAuditConversation = async () => {
    if (!contact || messages.length === 0) {
      toast.error('Nenhuma conversa para auditar');
      return;
    }

    setIsAuditing(true);
    
    try {
      // Build conversation text
      const conversationText = messages
        .map((m) => `[${m.direction === 'inbound' ? 'Cliente' : 'Vendedor'}]: ${m.content || '[mídia]'}`)
        .join('\n');

      toast.info('Funcionalidade de auditoria com IA será implementada em breve');
      
      // TODO: Call edge function for AI audit
      // const { data, error } = await supabase.functions.invoke('audit-conversation', {
      //   body: { conversation: conversationText, contact_id: contact.id }
      // });
      
    } catch (error) {
      toast.error('Erro ao auditar conversa');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleTriggerAutomation = async (automationId: string, automationName: string) => {
    if (!contact) return;
    
    setIsTriggeringAutomation(true);
    try {
      const { error } = await supabase.functions.invoke('automation-engine', {
        body: {
          event_type: 'manual_trigger',
          contact_id: contact.id,
          organization_id: contact.organization_id,
          automation_id: automationId,
        }
      });
      
      if (error) throw error;
      
      toast.success(`Automação "${automationName}" iniciada!`);
      
      // Refresh contact data to show active flow
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
    } catch (error: any) {
      console.error('Error triggering automation:', error);
      toast.error(error.message || 'Erro ao iniciar automação');
    } finally {
      setIsTriggeringAutomation(false);
    }
  };

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10 h-full overflow-hidden">
        <div className="text-center text-muted-foreground">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
            <MessageSquare className="w-12 h-12 opacity-50" />
          </div>
          <p className="text-xl font-medium mb-2">Selecione uma conversa</p>
          <p className="text-sm max-w-[240px]">
            Escolha um contato da lista para iniciar ou continuar uma conversa
          </p>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DndContext sensors={dndSensors} onDragStart={handleCatalogDragStart} onDragEnd={handleCatalogDragEnd}>
    <div
      ref={dropZoneRef}
      className="flex-1 flex flex-row bg-chat-bg h-full min-h-0 overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <DropZoneOverlay isVisible={isDragging} />
      {/* Main column: header + messages + composer */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card shadow-sm shrink-0">
      <div className="px-3 md:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-2 h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="w-8 h-8 md:w-10 md:h-10 border-2 border-primary/20 shrink-0">
            {profilePictureUrl && (
              <AvatarImage 
                src={profilePictureUrl} 
                alt={contact.name}
                className="object-cover"
              />
            )}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
              {(contact as any).is_group 
                ? <Users className="w-5 h-5" />
                : getInitials(contact.name)
              }
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <button 
              onClick={() => setIsEditNameDialogOpen(true)}
              className="flex items-center gap-1.5 group hover:bg-muted/60 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
              title="Editar nome"
            >
              <h3 className="font-semibold text-foreground truncate text-sm">{contact.name}</h3>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
            <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Desktop-only action buttons */}
          <span className="hidden xl:inline-flex"><AssignContact contact={contact} /></span>
          {contact.status === 'open' && (
            <div className="hidden lg:flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDeferScheduleDialogOpen(true)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/60 h-8 w-8"
                  >
                    <AlarmClock className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Adiar ou agendar
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsScheduledPanelOpen(true)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/60 h-8 w-8"
                  >
                    <CalendarClock className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Ver agendamentos
                </TooltipContent>
              </Tooltip>
              <FunnelStageActions contact={contact} messagesCount={messages.length} />

            </div>
          )}
          {contact.status === 'snoozed' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUnsnoozeContact}
              disabled={unsnoozeContact.isPending}
              className="hidden lg:inline-flex rounded-full px-4 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 transition-all duration-200"
            >
              {unsnoozeContact.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <AlarmClock className="w-4 h-4 mr-1.5" />
                  Reativar
                </>
              )}
            </Button>
          )}
          {contact.status === 'closed' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReopenTicket}
              disabled={reopenContact.isPending}
              className="hidden lg:inline-flex rounded-full px-4 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30 transition-all duration-200"
            >
              {reopenContact.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Reabrir
                </>
              )}
            </Button>
          )}
          {/* Pause automations - desktop only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleToggleAutomationsPause}
                disabled={isTogglingPause}
                className={cn(
                  "h-8 w-8 transition-colors hidden lg:inline-flex",
                  contact.automations_paused
                    ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isTogglingPause ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : contact.automations_paused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {contact.automations_paused 
                ? 'Reativar automações' 
                : 'Pausar automações (imune a todos os fluxos)'
              }
            </TooltipContent>
          </Tooltip>
          {/* Toggle AI agent - desktop only */}
          {contact.ai_enabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleToggleAi}
                  disabled={isTogglingAi}
                  className="h-8 w-8 transition-colors hidden lg:inline-flex text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                >
                  {isTogglingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Desativar IA neste contato</TooltipContent>
            </Tooltip>
          ) : (
            <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    if (conversationalAgents && conversationalAgents.length === 1) {
                      activateAgentForContact(conversationalAgents[0].id);
                    } else if (conversationalAgents && conversationalAgents.length > 1) {
                      setAiPopoverOpen(true);
                    } else {
                      toast.error('Nenhum agente conversacional ativo');
                    }
                  }}
                  disabled={isTogglingAi || !conversationalAgents?.length}
                  className="h-8 w-8 transition-colors hidden lg:inline-flex text-muted-foreground hover:text-foreground"
                >
                  {isTogglingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                </Button>
              </PopoverTrigger>
              {conversationalAgents && conversationalAgents.length > 1 && (
                <PopoverContent className="w-56 p-1" align="end">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Selecione o agente</p>
                  {conversationalAgents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => activateAgentForContact(agent.id)}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2"
                    >
                      <Bot className="w-3.5 h-3.5 text-violet-500" />
                      {agent.name}
                    </button>
                  ))}
                </PopoverContent>
              )}
            </Popover>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSearchOpen(prev => !prev)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hidden lg:inline-flex",
                  isSearchOpen && "bg-muted text-foreground"
                )}
              >
                <Search className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Pesquisar mensagens</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCatalogPanel}
                className={cn(
                  "text-muted-foreground hover:text-foreground hidden lg:inline-flex",
                  catalogPanelOpen && "bg-muted text-foreground"
                )}
                aria-label="Catálogo"
              >
                <Package className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Catálogo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDetailsPanel}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  detailsPanelOpen && "bg-muted text-foreground"
                )}
                aria-label="Detalhes do contato"
              >
                <PanelRight className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Detalhes do contato</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsSearchOpen(prev => !prev)} className="lg:hidden">
                <Search className="w-4 h-4 mr-2" />
                Pesquisar mensagens
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleCatalogPanel} className="lg:hidden">
                <Package className="w-4 h-4 mr-2" />
                Catálogo
              </DropdownMenuItem>
              {contact.status === 'open' && (
                <DropdownMenuItem onClick={() => setIsDeferScheduleDialogOpen(true)} className="lg:hidden">
                  <AlarmClock className="w-4 h-4 mr-2" />
                  Adiar ou agendar
                </DropdownMenuItem>
              )}
              {/* Funnel stage actions - mobile only */}
              {contact.status === 'open' && sortedStages.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="lg:hidden">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Etapa: {currentStage?.name || 'N/A'}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover">
                    {nextStage && !isFinalStage && (
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await updateContact.mutateAsync({ id: contact.id, funnel_stage: nextStage.slug as any });
                            toast.success(`Movido para ${nextStage.name}`);
                            await supabase.functions.invoke('automation-engine', {
                              body: { contact_id: contact.id, organization_id: contact.organization_id, event_type: 'funnel_stage_change', funnel_stage_name: nextStage.name },
                            });
                          } catch { toast.error('Erro ao avançar etapa'); }
                        }}
                        disabled={messages.length === 0}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        {nextStage.cta_text || `Avançar para ${nextStage.name}`}
                      </DropdownMenuItem>
                    )}
                    {isFinalStage && (
                      <>
                        <DropdownMenuItem
                          onClick={() => setPendingOutcome({ kind: 'won' })}
                          disabled={messages.length === 0}
                          className="text-emerald-600"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Venda Realizada
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setPendingOutcome({ kind: 'lost' })}
                          disabled={messages.length === 0}
                          className="text-rose-600"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Venda Perdida
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {contact.status === 'snoozed' && (
                <DropdownMenuItem onClick={handleUnsnoozeContact} disabled={unsnoozeContact.isPending} className="lg:hidden">
                  <AlarmClock className="w-4 h-4 mr-2" />
                  Reativar
                </DropdownMenuItem>
              )}
              {contact.status === 'closed' && (
                <DropdownMenuItem onClick={handleReopenTicket} disabled={reopenContact.isPending} className="lg:hidden">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reabrir
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleToggleAutomationsPause} disabled={isTogglingPause} className="lg:hidden">
                {contact.automations_paused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {contact.automations_paused ? 'Reativar automações' : 'Pausar automações'}
              </DropdownMenuItem>
              {contact.ai_enabled ? (
                <DropdownMenuItem onClick={handleToggleAi} disabled={isTogglingAi} className="lg:hidden">
                  <Bot className="w-4 h-4 mr-2" />Desativar IA
                </DropdownMenuItem>
              ) : conversationalAgents && conversationalAgents.length > 1 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="lg:hidden">
                    <Bot className="w-4 h-4 mr-2" />Ativar IA
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {conversationalAgents.map(agent => (
                      <DropdownMenuItem key={agent.id} onClick={() => activateAgentForContact(agent.id)}>
                        {agent.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  onClick={() => conversationalAgents?.[0] && activateAgentForContact(conversationalAgents[0].id)}
                  disabled={isTogglingAi || !conversationalAgents?.length}
                  className="lg:hidden"
                >
                  <Bot className="w-4 h-4 mr-2" />Ativar IA
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="lg:hidden" />
              <DropdownMenuItem
                onClick={handleMarkAsUnread}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Marcar como não lida
              </DropdownMenuItem>
              {/* Profile photo update is automatic via Realtime */}
              {activeAutomations.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={isTriggeringAutomation || hasActiveFlow}>
                    {isTriggeringAutomation ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Enviar automação
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover">
                    {activeAutomations.map((automation) => (
                      <DropdownMenuItem
                        key={automation.id}
                        onClick={() => handleTriggerAutomation(automation.id, automation.name)}
                        disabled={isTriggeringAutomation || hasActiveFlow}
                      >
                        {automation.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  const next = !contact.hidden_from_funnel;
                  await updateContact.mutateAsync({ id: contact.id, hidden_from_funnel: next });
                  toast.success(next ? 'Contato ocultado do funil comercial' : 'Contato visível no funil comercial');
                }}
              >
                {contact.hidden_from_funnel ? (
                  <><Eye className="w-4 h-4 mr-2" />Mostrar no funil</>
                ) : (
                  <><EyeOff className="w-4 h-4 mr-2" />Ocultar do funil</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Arquivar conversa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setIsClearDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear conversation confirmation dialog */}
          <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar conversa</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja apagar todas as mensagens desta conversa? 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearConversation}
                  disabled={isClearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isClearing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {/* Tags row: linha própria, não disputa espaço com nome/telefone/botões */}
      <div className="hidden lg:flex items-center gap-1.5 px-3 md:px-4 pb-2">
        <ContactTagsEditor contactId={contact.id} showLabel={false} compact />
      </div>
      </div>

      {/* Message Search Bar */}
      {isSearchOpen && (
        <MessageSearch
          contactId={contact.id}
          onResultSelect={(messageId) => {
            scrollToMessage(messageId);
          }}
          onClose={() => setIsSearchOpen(false)}
        />
      )}



      {/* Messages Area — wrapped in MessageDropZone so useDroppable runs inside DndContext */}
      <MessageDropZone>
        <ScrollArea ref={scrollAreaRef} className="h-full [&_[data-radix-scroll-area-viewport]]:!overflow-x-hidden">
          <div className="px-4 py-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[70%] rounded-2xl p-4 animate-pulse',
                    i % 2 === 0 ? 'ml-auto bg-chat-outbound/30' : 'bg-card'
                  )}
                >
                  <div className="h-4 bg-muted rounded w-32" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center bg-card/80 backdrop-blur rounded-lg px-6 py-4 shadow-sm max-w-md">
                <p className="text-sm font-medium text-foreground">Não foi possível carregar as mensagens</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  {(error as any)?.message || 'Tente novamente em instantes.'}
                </p>
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground bg-card/80 backdrop-blur rounded-lg px-6 py-4 shadow-sm">
                <p className="text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs mt-1">Envie uma mensagem para iniciar a conversa</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Loading indicator for older messages */}
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {/* Load more button (fallback) */}
              {hasNextPage && !isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    className="text-xs text-muted-foreground"
                  >
                    Carregar mensagens anteriores
                  </Button>
                </div>
              )}
              
              <div ref={messagesStartRef} />
              
              {messages.map((msg, index) => {
                const previousMsg = index > 0 ? messages[index - 1] : null;
                const showDateSeparator = shouldShowDateSeparator(
                  new Date(msg.created_at),
                  previousMsg ? new Date(previousMsg.created_at) : null
                );
                
                return (
                  <div 
                    key={msg.id} 
                    id={`message-${msg.id}`}
                    className={cn(
                      'transition-all duration-500',
                      highlightedMessageId === msg.id && 'bg-primary/20 rounded-lg -mx-2 px-2 py-1'
                    )}
                  >
                    {showDateSeparator && (
                      <DateSeparator date={new Date(msg.created_at)} />
                    )}
                    <MessageBubble 
                      message={msg} 
                      onRetry={handleRetry}
                      onReply={(m) => {
                        setReplyingTo(m);
                        inputRef.current?.focus();
                      }}
                      onPhoneClick={onPhoneClick}
                      onQuoteClick={(quotedId) => {
                        const targetId = quotedId || findQuotedMessageId(msg);
                        if (targetId) {
                          scrollToMessage(targetId);
                        } else {
                          toast.info('Não foi possível localizar a mensagem original');
                        }
                      }}
                      onSaveSticker={async (url) => {
                        if (mightBeAnimated(url)) {
                          const result = await detectAnimatedImage(url);
                          if (result.isAnimated) {
                            setShowAnimatedStickerDialog(true);
                            return;
                          }
                        }
                        addSticker.mutate({ existingUrl: url });
                      }}
                      onDeleteMessage={(messageId, deleteForEveryone) => {
                        deleteMessage.mutate(
                          { message_id: messageId, contact_id: contact.id, delete_for_everyone: deleteForEveryone },
                          {
                            onSuccess: () => {
                              toast.success(deleteForEveryone ? 'Mensagem apagada para todos' : 'Mensagem apagada');
                            },
                            onError: (error) => {
                              toast.error('Erro ao apagar mensagem');
                              console.error('Delete error:', error);
                            },
                          }
                        );
                      }}
                      onEditMessage={(msg) => {
                        setEditingMessage(msg);
                        setMessage(msg.content || '');
                        setReplyingTo(null);
                        inputRef.current?.focus();
                      }}
                      onForward={(m) => {
                        startSelecting({
                          id: m.id,
                          content: m.content,
                          message_type: m.message_type,
                          media_url: m.media_url,
                          created_at: m.created_at,
                          senderName: m.direction === 'inbound' ? contact.name : m.sent_by_name || 'Você',
                          direction: m.direction,
                        });
                      }}
                      isSelecting={isSelecting}
                      isSelected={selectedMessages.has(msg.id)}
                      onToggleSelect={() => toggleMessage({
                        id: msg.id,
                        content: msg.content,
                        message_type: msg.message_type,
                        media_url: msg.media_url,
                        created_at: msg.created_at,
                        senderName: msg.direction === 'inbound' ? contact.name : msg.sent_by_name || 'Você',
                        direction: msg.direction,
                      })}
                      quotedMessage={(() => {
                        if (!msg.quoted_message_id && !msg.quoted_content) return undefined;
                        // Prefer the real message object when loaded in the current paginated set
                        if (msg.quoted_message_id) {
                          const found = messages.find(m => m.id === msg.quoted_message_id);
                          if (found) return found;
                        }
                        // Fallback: synthesize a stub from persisted quoted_* fields so the bubble still renders
                        if (msg.quoted_content || msg.quoted_type) {
                          return {
                            id: msg.quoted_message_id || `stub-${msg.id}`,
                            content: msg.quoted_content || '',
                            message_type: msg.quoted_type || 'text',
                            media_url: (msg as any).quoted_media_url || null,
                            direction: 'inbound',
                            created_at: msg.created_at,
                          } as any;
                        }
                        return undefined;
                      })()}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
          </div>
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
      </MessageDropZone>

      {/* Input Area */}
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-card border-t space-y-2 shrink-0">
        {/* Edit Preview */}
        {editingMessage && !isRecordingAudio && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg border-l-4 border-amber-500">
            <Pencil className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Editando mensagem
              </p>
              <p className="text-sm text-foreground truncate">
                {editingMessage.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => {
                setEditingMessage(null);
                setMessage('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && !isRecordingAudio && !editingMessage && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border-l-4 border-primary">
            <Reply className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium">
                {replyingTo.direction === 'inbound' ? contact?.name : 'Você'}
              </p>
              <p className="text-sm text-foreground truncate">
                {replyingTo.message_type === 'text' 
                  ? replyingTo.content 
                  : replyingTo.message_type === 'image' 
                    ? '📷 Imagem' 
                    : replyingTo.message_type === 'audio' 
                      ? '🎵 Áudio'
                      : replyingTo.message_type === 'video'
                        ? '🎬 Vídeo'
                        : '📄 Documento'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setReplyingTo(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {/* Audio Recorder */}
        {isRecordingAudio ? (
          <AudioRecorder
            onRecordingComplete={handleAudioRecordingComplete}
            onCancel={() => setIsRecordingAudio(false)}
            isUploading={isUploading}
          />
        ) : (
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <Popover open={attachmentOpen} onOpenChange={setAttachmentOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  disabled={isUploading}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-2 overflow-hidden">
                <div className="grid gap-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e) => handleFileSelect(e as any, 'image');
                      input.click();
                    }}
                  >
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Imagem
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.multiple = true;
                      input.onchange = (e) => handleFileSelect(e as any, 'video');
                      input.click();
                    }}
                  >
                    <Video className="w-4 h-4 text-primary" />
                    Vídeo
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'audio/*';
                      input.multiple = true;
                      input.onchange = (e) => handleFileSelect(e as any, 'audio');
                      input.click();
                    }}
                  >
                    <Mic className="w-4 h-4 text-primary" />
                    Áudio
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '*/*';
                      input.multiple = true;
                      input.onchange = (e) => handleFileSelect(e as any, 'document');
                      input.click();
                    }}
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    Documento / Arquivo
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setAttachmentOpen(false);
                      setIsWebcamDialogOpen(true);
                    }}
                  >
                    <Camera className="w-4 h-4 text-primary" />
                    Câmera
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

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
                className="text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setShowStickerPicker(!showStickerPicker)}
                title={stickers.length === 0 ? 'Nenhuma figurinha salva' : 'Figurinhas'}
              >
                <Sticker className="w-5 h-5" />
              </Button>
              
              {showStickerPicker && (
                <StickerPicker
                  onSelect={handleSendSticker}
                  onClose={() => setShowStickerPicker(false)}
                />
              )}
            </div>

            {/* Message Input with Quick Messages Picker */}
            <div className="relative flex-1">
              <Textarea
                ref={inputRef}
                placeholder="Digite / para mensagens rápidas..."
                value={message}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay hiding to allow click on picker items
                  setTimeout(() => setShowQuickMessages(false), 200);
                }}
                rows={1}
                className="w-full min-h-[40px] max-h-[200px] bg-muted/50 border-0 focus-visible:ring-1 resize-none py-2.5 text-base"
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

            {/* Record Audio Button - shows when input is empty or only "/" */}
            {!message.trim() || showQuickMessages ? (
              <Button
                onClick={() => setIsRecordingAudio(true)}
                disabled={isUploading || showQuickMessages}
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Mic className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!message.trim() || showQuickMessages}
                size="icon"
                className="shrink-0 bg-chat-outbound hover:bg-chat-outbound-hover text-white"
              >
                <Send className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </div>
      {/* End main column */}
      </div>

      {/* Catalog drag-and-drop panel (right side) */}
      {contact && (
        <CatalogSidePanel
          open={catalogPanelOpen}
          onOpenChange={(o) => {
            setCatalogPanelOpen(o);
            try {
              localStorage.setItem('chat-catalog-panel-open', o ? '1' : '0');
            } catch {
              // ignore
            }
          }}
          products={catalogProducts}
          isLoading={catalogLoading}
          onSendProduct={handleSendCatalogProduct}
          onSendMultiple={(products) => products.forEach(handleSendCatalogProduct)}
        />
      )}

      {/* Contact Details Panel (right side) */}
      {contact && (
        <ContactDetailsPanel
          contact={contact}
          open={detailsPanelOpen}
          onOpenChange={(o) => {
            setDetailsPanelOpen(o);
            try {
              localStorage.setItem('chat-details-panel-open', o ? '1' : '0');
            } catch {
              // ignore
            }
          }}
        />
      )}

      {/* Media Caption Dialog */}
      <MediaCaptionDialog
        open={mediaCaptionOpen}
        onOpenChange={(open) => {
          setMediaCaptionOpen(open);
          if (!open) {
            setPendingMediaFile(null);
            setPendingMediaFiles([]);
          }
        }}
        file={pendingMediaFile}
        files={pendingMediaFiles}
        mediaType={pendingMediaType}
        onSend={handleMediaCaptionSend}
        onSendBatch={handleMediaCaptionSendBatch}
        isSending={isUploading}
      />

      {/* Defer/Schedule Dialog */}
      {contact && (
        <DeferScheduleDialog
          open={isDeferScheduleDialogOpen}
          onOpenChange={setIsDeferScheduleDialogOpen}
          contactId={contact.id}
          contactName={contact.name}
          organizationId={contact.organization_id}
        />
      )}

      {/* Scheduled Messages Panel */}
      {contact && (
        <ScheduledMessagesPanel
          open={isScheduledPanelOpen}
          onOpenChange={setIsScheduledPanelOpen}
          contactId={contact.id}
          contactName={contact.name}
          organizationId={contact.organization_id}
        />
      )}


      {/* Webcam Capture Dialog */}
      <WebcamCaptureDialog
        open={isWebcamDialogOpen}
        onOpenChange={setIsWebcamDialogOpen}
        onCapture={handleWebcamCapture}
      />

      {/* Edit Contact Dialog */}
      {contact && (
        <EditContactDialog
          open={isEditNameDialogOpen}
          onOpenChange={setIsEditNameDialogOpen}
          contact={contact as any}
        />
      )}

      {/* Animated Sticker Warning Dialog */}
      <AnimatedStickerDialog
        open={showAnimatedStickerDialog}
        onOpenChange={setShowAnimatedStickerDialog}
      />

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

      <SaleOutcomeReasonDialog
        open={!!pendingOutcome}
        onOpenChange={(o) => !o && !submittingOutcome && setPendingOutcome(null)}
        loading={submittingOutcome}
        kind={pendingOutcome?.kind ?? 'lost'}
        onConfirm={async (reason) => {
          if (!pendingOutcome) return;
          setSubmittingOutcome(true);
          try {
            const isWon = pendingOutcome.kind === 'won';
            const finalStage = sortedStages.find((s) => s.is_final);
            const updates: any = {
              id: contact.id,
              funnel_stage: (finalStage?.slug || 'closed') as any,
              sale_result: isWon ? 'won' : 'lost',
            };
            if (isWon) updates.win_reason = reason;
            else updates.loss_reason = reason;
            await updateContact.mutateAsync(updates);
            await supabase.functions.invoke('automation-engine', {
              body: {
                contact_id: contact.id,
                organization_id: contact.organization_id,
                event_type: 'funnel_stage_change',
                funnel_stage_name: finalStage?.name || 'Fechamento',
              },
            });
            triggerDealResultAutomation({
              contactId: contact.id,
              organizationId: contact.organization_id,
              result: isWon ? 'won' : 'lost',
            });
            await closeContact.mutateAsync({ contactId: contact.id, phone: contact.phone });
            if (isWon) {
              triggerConfetti();
              toast.success('🎉 Venda realizada!');
            } else {
              toast.success('Venda perdida registrada.');
            }
            setPendingOutcome(null);
          } catch {
            toast.error('Erro ao finalizar');
          } finally {
            setSubmittingOutcome(false);
          }
        }}
      />
    </div>
    <DragOverlay>
      {activeDragProduct ? <CatalogItemCard product={activeDragProduct} dragging /> : null}
    </DragOverlay>
    </DndContext>
  );
}
