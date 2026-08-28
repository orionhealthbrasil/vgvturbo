import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';
import { Search, Plus, User, Users, Image as ImageIcon, Mic, FileText, Video, Volume2, VolumeX, Filter, X, CheckCircle2, XCircle, CircleDollarSign, AlarmClock, Tag, Instagram, Archive, ArchiveRestore, CalendarClock, ListTodo, Power, PowerOff, Trash2, Pin, PinOff, EyeOff, Eye, SquareCheck } from 'lucide-react';
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
import { useDeleteContact, useUpdateContact } from '@/hooks/useCRM';
import { useMemberAvailability } from '@/hooks/useMemberAvailability';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ContactWithColumn, ContactStatus } from '@/types/crm';
import { useConversationCounts, useContactsServerSearch, useConversationContacts } from '@/hooks/useConversationContacts';
import { useTags } from '@/hooks/useTags';
import { useDebounce } from '@/hooks/useDebounce';

import { ScheduledContactInfo } from '@/hooks/useScheduledContacts';
import { useFunnelStages, FunnelStage } from '@/hooks/useFunnelStages';
import { useKanbanPipelines } from '@/hooks/useKanbanPipelines';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization, useOrganizationMembers } from '@/hooks/useOrganization';
import { useOrganizationHolidays } from '@/hooks/useOrganizationHolidays';
import { useUserPermissions } from '@/hooks/usePermissions';
import { useContactsTasksSummary } from '@/hooks/useContactsTasksSummary';
import { useChatPreferences } from '@/hooks/useChatPreferences';
import { SlaClockBadge } from './SlaClockBadge';

type QuickFilter = 'all' | 'unread' | 'assigned_to_me' | string; // string for dynamic stage slugs or user IDs

function isSharedTagName(tagName: string): boolean {
  const normalized = tagName.toLowerCase().trim();
  return normalized.startsWith('fornecedor') || normalized.startsWith('colaborador');
}

function isSharedContact(contact: ContactWithColumn): boolean {
  return (contact.tags || []).some((t) => isSharedTagName(t.name));
}

function formatChatTimestamp(value: string) {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  return format(date, 'dd/MM');
}

function getContactTimestamp(contact: ContactWithColumn, useClosed = false) {
  if (useClosed && contact.closed_at) {
    return formatChatTimestamp(contact.closed_at);
  }
  const raw = contact.last_message_at || (contact as any)?.last_message?.created_at;
  return raw ? formatChatTimestamp(raw) : null;
}

interface ContactListProps {
  contacts: ContactWithColumn[];
  selectedContactId: string | null;
  onSelectContact: (contact: ContactWithColumn) => void;
  onNewConversation: () => void;
  isLoading: boolean;
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
  archivedContacts?: ContactWithColumn[];
  isLoadingArchived?: boolean;
  onArchiveContact?: (contactId: string, archive: boolean) => void;
  scheduledContacts?: ScheduledContactInfo[];
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  channelFilter?: 'whatsapp' | 'instagram';
  isRealtimeConnected?: boolean;
}

export function ContactList({
  contacts,
  selectedContactId,
  onSelectContact,
  onNewConversation,
  isLoading,
  isSoundEnabled = true,
  onToggleSound,
  archivedContacts = [],
  isLoadingArchived = false,
  onArchiveContact,
  scheduledContacts = [],
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
  channelFilter,
  isRealtimeConnected = true,
}: ContactListProps) {
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<ContactStatus | 'archived'>('open');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [contactToDelete, setContactToDelete] = useState<{ id: string; name: string | null } | null>(null);
  const [contactToClear, setContactToClear] = useState<{ id: string; name: string | null } | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const queryClient = useQueryClient();
  const handleClearConversation = async () => {
    if (!contactToClear) return;
    setIsClearing(true);
    try {
      const { error } = await supabase.from('messages').delete().eq('contact_id', contactToClear.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['messages', contactToClear.id] });
      toast.success('Conversa limpa com sucesso');
      setContactToClear(null);
    } catch {
      toast.error('Erro ao limpar conversa');
    } finally {
      setIsClearing(false);
    }
  };

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deleteContact = useDeleteContact();
  const updateContact = useUpdateContact();
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [filterByAssignee, setFilterByAssignee] = useState<string | null>(null);
  const [filterByTagIds, setFilterByTagIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const currentUserId = user?.id || null;
  const { data: orgData } = useUserOrganization();
  const { data: holidaysData } = useOrganizationHolidays();
  const { data: members = [] } = useOrganizationMembers();
  const { role } = useUserPermissions();
  const { data: pipelines = [] } = useKanbanPipelines();
  const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const activePipelineId = selectedPipelineId ?? defaultPipeline?.id ?? null;
  const { data: funnelStages = [] } = useFunnelStages(activePipelineId);
  const { data: tasksSummaryMap } = useContactsTasksSummary();
  const { data: dbCounts } = useConversationCounts(channelFilter);

  // Dedicated fetch for closed contacts — only triggers when the user opens the
  // 'closed' tab, because the paginated list (ordered by last_message_at across
  // all statuses) never loads old closed contacts.
  const { data: closedContactsData, isLoading: isLoadingClosed } = useConversationContacts(
    'closed',
    statusTab === 'closed'
  );
  const closedContacts: ContactWithColumn[] = closedContactsData ?? [];

  // Get sorted stages (skip first as it's the entry point)
  const sortedStages = [...funnelStages].sort((a, b) => a.position - b.position);
  const filterableStages = sortedStages.filter((s, idx) => idx > 0 && !s.is_final); // Exclude first and final
  
  // Check if user is admin/owner/analyst (sees all) or vendedor/viewer (sees only assigned to them)
  const isAdmin = orgData?.membership.role === 'owner' || orgData?.membership.role === 'admin';
  const isVendedor = role === 'viewer'; // Vendedor só vê atribuídos a ele

  // Build a set of contact IDs with pending scheduled messages
  const scheduledContactIdSet = useMemo(
    () => new Set(scheduledContacts.map(sc => sc.contact_id)),
    [scheduledContacts]
  );

  // Build a map for scheduled info (contact_id -> scheduled_at)
  const scheduledInfoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sc of scheduledContacts) {
      map.set(sc.contact_id, sc.scheduled_at);
    }
    return map;
  }, [scheduledContacts]);

  // Server-side search/filter: when user types or picks a tag/assignee,
  // query the entire org's contacts table (not just what's loaded).
  const debouncedSearch = useDebounce(search, 300);
  const serverSearchActive =
    debouncedSearch.trim().length >= 2 ||
    filterByTagIds.length > 0 ||
    !!filterByAssignee;

  const { data: serverSearchResults, isFetching: isServerSearching } = useContactsServerSearch({
    searchTerm: debouncedSearch,
    tagIds: filterByTagIds,
    assigneeId: filterByAssignee,
    channelFilter,
    includeArchived: statusTab === 'archived',
    statusFilter: statusTab === 'archived' ? null : (statusTab as ContactStatus),
  });

  // Pick the contact source: server results when searching/filtering, otherwise
  // use the dedicated closed fetch for 'closed' tab (paginated list only loads
  // the most recent contacts and misses old closed ones), archived list for
  // 'archived' tab, and the paginated list for everything else.
  const sourceContacts: ContactWithColumn[] = serverSearchActive
    ? (serverSearchResults ?? [])
    : statusTab === 'archived'
    ? archivedContacts
    : statusTab === 'closed'
    ? closedContacts
    : contacts;

  // Filter by status (open / closed / snoozed / archived).
  // When server-search is active, status is already filtered server-side, so skip
  // the client filter (otherwise tag/responsible filters with many results lose rows).
  const contactsByStatus = serverSearchActive
    ? sourceContacts
    : statusTab === 'archived'
    ? sourceContacts
    : statusTab === 'snoozed'
    ? sourceContacts.filter((c) => c.status === 'snoozed' || scheduledContactIdSet.has(c.id))
    : sourceContacts.filter((c) => c.status === statusTab);

  // Sort: open by last_message_at desc, closed by closed_at desc
  // For open contacts, prioritize stages with unread messages at top (using stage position)
  const { unreadOnTop } = useChatPreferences();

  const sortedContacts = [...contactsByStatus].sort((a, b) => {
    // Pinned always on top (within any tab)
    const aPinned = (a as any).is_pinned ? 1 : 0;
    const bPinned = (b as any).is_pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    if (statusTab === 'closed') {
      const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0;
      const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0;
      return bTime - aTime;
    }

    if (unreadOnTop && statusTab === 'open') {
      const aUnread = (a.unread_count || 0) > 0 ? 1 : 0;
      const bUnread = (b.unread_count || 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
    }

    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });

  // Permission filter: Vendedor (viewer) sees assigned or shared tagged.
  // Already enforced server-side in both paginated and server-search hooks,
  // but kept as a defensive client filter.
  const permissionFilteredContacts = isVendedor
    ? sortedContacts.filter((c) => {
        if (!currentUserId) return false;
        return c.assigned_to === currentUserId || isSharedContact(c);
      })
    : sortedContacts;

  // Remaining client-only filters: quickFilter and showUnassigned chips
  const filteredContacts = permissionFilteredContacts.filter((contact) => {
    if (statusTab === 'open') {
      switch (quickFilter) {
        case 'unread':
          if (contact.unread_count <= 0) return false;
          break;
        case 'assigned_to_me':
          if (!currentUserId || contact.assigned_to !== currentUserId) return false;
          break;
        case 'all':
          break;
        default:
          if (contact.funnel_stage !== quickFilter) return false;
          break;
      }

      if (showUnassigned && contact.assigned_to !== null) return false;
    }

    return true;
  });


  // Counts for badges (respect permission filtering for vendedor)
  const baseContacts = isVendedor
    ? contacts.filter((c) => {
        if (!currentUserId) return false;
        return c.assigned_to === currentUserId || isSharedContact(c);
      })
    : contacts;
  const openContacts = baseContacts.filter((c) => c.status === 'open');
  const closedContactsInBase = baseContacts.filter((c) => c.status === 'closed');
  const snoozedContacts = baseContacts.filter((c) => c.status === 'snoozed' || scheduledContactIdSet.has(c.id));

  const openCount = dbCounts?.open ?? openContacts.length;
  const closedCount = dbCounts?.closed ?? closedContacts.length;
  const snoozedCount = dbCounts?.snoozed ?? snoozedContacts.length;
  const unreadCount = dbCounts?.unread ?? openContacts.filter((c) => c.unread_count > 0).length;
  const assignedToMeCount = openContacts.filter((c) => !!currentUserId && c.assigned_to === currentUserId).length;
  const unassignedCount = openContacts.filter((c) => c.assigned_to === null).length;
  
  // Dynamic stage counts
  const stageCounts = filterableStages.reduce((acc, stage) => {
    acc[stage.slug] = openContacts.filter((c) => c.funnel_stage === stage.slug).length;
    return acc;
  }, {} as Record<string, number>);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAssignedMember = (userId: string | null) => {
    if (!userId) return null;
    return members.find((m) => m.user_id === userId);
  };

  const truncateText = (text: string, maxChars: number) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  };

  const getLastMessagePreview = (contact: ContactWithColumn) => {
    if (!contact.last_message) {
      return '';
    }

    const { message_type, content, direction } = contact.last_message;
    const prefix = direction === 'outbound' ? 'Você: ' : '';

    switch (message_type) {
      case 'image':
        return (
          <span className="flex items-center gap-1">
            {prefix}<ImageIcon className="w-3.5 h-3.5 inline" /> Imagem
          </span>
        );
      case 'audio':
        return (
          <span className="flex items-center gap-1">
            {prefix}<Mic className="w-3.5 h-3.5 inline" /> Áudio
          </span>
        );
      case 'video':
        return (
          <span className="flex items-center gap-1">
            {prefix}<Video className="w-3.5 h-3.5 inline" /> Vídeo
          </span>
        );
      case 'document':
        return (
          <span className="flex items-center gap-1">
            {prefix}<FileText className="w-3.5 h-3.5 inline" /> Documento
          </span>
        );
      case 'sticker':
        return (
          <span className="flex items-center gap-1">
            {prefix}🎨 Figurinha
          </span>
        );
      case 'contact': {
        try {
          const contactData = JSON.parse(content || '{}');
          return (
            <span className="flex items-center gap-1">
              {prefix}<User className="w-3.5 h-3.5 inline" /> {truncateText(contactData.displayName || 'Contato', 10)}
            </span>
          );
        } catch {
          return (
            <span className="flex items-center gap-1">
              {prefix}<User className="w-3.5 h-3.5 inline" /> Contato
            </span>
          );
        }
      }
      case 'contacts': {
        try {
          const contactsData = JSON.parse(content || '{}');
          const count = contactsData.contacts?.length || 0;
          return (
            <span className="flex items-center gap-1">
              {prefix}<User className="w-3.5 h-3.5 inline" /> {count} contato{count !== 1 ? 's' : ''}
            </span>
          );
        } catch {
          return (
            <span className="flex items-center gap-1">
              {prefix}<User className="w-3.5 h-3.5 inline" /> Contatos
            </span>
          );
        }
      }
      default:
        return truncateText(`${prefix}${content || contact.phone}`, 15);
    }
  };

  // Collect all unique tags from visible contacts for the filter
  // Use full org tag list (not just tags present on loaded contacts) so the filter
  // dropdown always shows every available tag, even when a tag has many contacts.
  const { data: orgTags = [] } = useTags();
  const allTags = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const c of openContacts) {
      for (const t of (c.tags || [])) {
        countMap.set(t.id, (countMap.get(t.id) || 0) + 1);
      }
    }
    return orgTags
      .map((t) => ({ id: t.id, name: t.name, color: t.color, count: countMap.get(t.id) || 0 }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  }, [orgTags, openContacts]);

  const clearFilters = () => {
    setQuickFilter('all');
    setShowUnassigned(false);
    setFilterByAssignee(null);
    setFilterByTagIds([]);
    setSearch('');
  };

  const hasActiveFilters = quickFilter !== 'all' || showUnassigned || filterByAssignee || filterByTagIds.length > 0 || search;
  
  // Get members with viewer role (vendedores) for the filter dropdown
  const vendedorMembers = members.filter(m => m.member_role === 'viewer');

  return (
    <>
    <div className="flex flex-col h-full border-r w-96 shrink-0">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-lg">Conversas</h2>
            {!isRealtimeConnected && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground animate-pulse">
                Reconectando…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <AvailabilityToggle />
            {onToggleSound && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={onToggleSound}
                    className="h-8 w-8 p-0"
                  >
                    {isSoundEnabled ? (
                      <Volume2 className="w-4 h-4 text-primary" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isSoundEnabled ? 'Som ativado' : 'Som desativado'}
                </TooltipContent>
              </Tooltip>
            )}
            <Button size="sm" onClick={onNewConversation}>
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        {/* Status tabs: Abertos / Agendados / Finalizados */}
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as ContactStatus | 'archived')} className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="open" className="text-xs">
              Abertos
              {openCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {openCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="snoozed" className="text-xs">
              <AlarmClock className="w-3 h-3 mr-1" />
              Agend.
              {snoozedCount > 0 && (
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {snoozedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Finaliz.
              {closedCount > 0 && (
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {closedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs">
              <Archive className="w-3 h-3 mr-1" />
              Arquiv.
              {archivedContacts.length > 0 && (
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {archivedContacts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search with filter button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {statusTab === 'open' && (
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant={hasActiveFilters ? 'default' : 'outline'} 
                  size="icon"
                  className="shrink-0"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0">
                <div className="space-y-3 p-3 max-h-[min(480px,80vh)] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filtros</span>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-7 text-xs"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="unassigned"
                        checked={showUnassigned}
                        onCheckedChange={(checked) => {
                          setShowUnassigned(checked === true);
                          if (checked) setFilterByAssignee(null);
                        }}
                      />
                      <Label htmlFor="unassigned" className="text-sm flex-1 cursor-pointer">
                        Sem responsável
                      </Label>
                      <Badge variant="secondary" className="text-xs">
                        {unassignedCount}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Filter by assignee - only show for non-vendedor users */}
                  {!isVendedor && vendedorMembers.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Por responsável</span>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                          {vendedorMembers.map((member) => {
                            const memberContactCount = openContacts.filter(c => c.assigned_to === member.user_id).length;
                            return (
                              <div key={member.user_id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`assignee-${member.user_id}`}
                                  checked={filterByAssignee === member.user_id}
                                  onCheckedChange={(checked) => {
                                    setFilterByAssignee(checked ? member.user_id : null);
                                    if (checked) setShowUnassigned(false);
                                  }}
                                />
                                <Label 
                                  htmlFor={`assignee-${member.user_id}`} 
                                  className="text-sm flex-1 cursor-pointer truncate"
                                >
                                  {member.full_name || member.email || 'Usuário'}
                                </Label>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {memberContactCount}
                                </Badge>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Filter by tag */}
                  {allTags.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Por etiqueta
                      </span>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                          {allTags.map((tag) => (
                            <div key={tag.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`tag-${tag.id}`}
                                checked={filterByTagIds.includes(tag.id)}
                                onCheckedChange={(checked) => {
                                  setFilterByTagIds(prev =>
                                    checked
                                      ? [...prev, tag.id]
                                      : prev.filter(id => id !== tag.id)
                                  );
                                }}
                              />
                              <Label
                                htmlFor={`tag-${tag.id}`}
                                className="text-sm flex-1 cursor-pointer truncate flex items-center gap-1.5"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                              </Label>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {tag.count}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Quick filter chips (only for open tab) */}
        {statusTab === 'open' && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setQuickFilter('all')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                quickFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setQuickFilter('unread')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1',
                quickFilter === 'unread'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Não lidas
              {unreadCount > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] rounded-full",
                  quickFilter === 'unread' 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-status-success text-status-success-foreground"
                )}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setQuickFilter('assigned_to_me')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1',
                quickFilter === 'assigned_to_me'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Minhas
              {assignedToMeCount > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] rounded-full",
                  quickFilter === 'assigned_to_me' 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-muted-foreground/20"
                )}>
                  {assignedToMeCount}
                </span>
              )}
            </button>
            {/* Pipeline selector + dynamic stage filters */}
            {pipelines.length > 1 && (
              <select
                value={activePipelineId ?? ''}
                onChange={(e) => {
                  setSelectedPipelineId(e.target.value || null);
                  setQuickFilter('all');
                }}
                className="h-7 px-2 text-xs rounded-full border bg-muted text-muted-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {filterableStages.map((stage) => (
              <button
                key={stage.slug}
                onClick={() => setQuickFilter(stage.slug)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1',
                  quickFilter === stage.slug
                    ? 'text-white'
                    : 'hover:opacity-80'
                )}
                style={{
                  backgroundColor: quickFilter === stage.slug ? stage.color : `${stage.color}30`,
                  color: quickFilter === stage.slug ? 'white' : stage.color,
                }}
              >
                <CircleDollarSign className="w-3 h-3" />
                {stage.name}
                {(stageCounts[stage.slug] || 0) > 0 && (
                  <span
                    className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] rounded-full"
                    style={{
                      backgroundColor: quickFilter === stage.slug ? 'rgba(255,255,255,0.2)' : `${stage.color}50`,
                    }}
                  >
                    {stageCounts[stage.slug]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk select toggle — visible only on open tab */}
      {statusTab === 'open' && (
        <div className="flex items-center justify-end px-3 pb-1">
          <button
            onClick={() => { setBulkMode((p) => !p); setSelectedIds(new Set()); }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              bulkMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <SquareCheck className="w-3.5 h-3.5" />
            {bulkMode ? 'Cancelar seleção' : 'Selecionar'}
          </button>
        </div>
      )}

      <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]]:touch-manipulation" onScrollCapture={(e) => {
        // Disable infinite scroll while a server-side search/filter is active —
        // we already fetched up to 200 matches from the DB and don't need more.
        if (serverSearchActive) return;
        const target = e.target as HTMLDivElement;
        if (!target) return;
        const { scrollTop, scrollHeight, clientHeight } = target;
        if (scrollHeight - scrollTop - clientHeight < 300 && hasNextPage && !isFetchingNextPage && fetchNextPage) {
          fetchNextPage();
        }
      }}>
        {(isLoading || isLoadingClosed || (serverSearchActive && isServerSearching && (serverSearchResults?.length ?? 0) === 0)) ? (

          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="mb-2">
              {statusTab === 'closed' 
                ? 'Nenhum atendimento finalizado' 
                : 'Nenhum contato encontrado'}
            </p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredContacts.map((contact) => {
              // Get the contact's current stage for styling
              const contactStage = sortedStages.find(s => s.slug === contact.funnel_stage);
              const stageColor = contactStage?.color;
              const isNotFirstStage = contactStage && contactStage.position > 0;
              
              return (
                <div
                  key={contact.id}
                  className="relative group"
                >
                  {bulkMode && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30">
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(contact.id) : next.delete(contact.id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (bulkMode) {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          next.has(contact.id) ? next.delete(contact.id) : next.add(contact.id);
                          return next;
                        });
                        return;
                      }
                      onSelectContact(contact);
                    }}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-3 p-3 overflow-hidden [@media(hover:hover)]:hover:bg-muted/50 active:bg-muted/50 transition-colors text-left touch-manipulation',
                      selectedContactId === contact.id && !bulkMode && 'bg-muted',
                      bulkMode && selectedIds.has(contact.id) && 'bg-primary/5',
                      bulkMode && 'pl-9',
                    )}
                    style={{
                      borderLeft: isNotFirstStage && statusTab === 'open' ? `2px solid ${stageColor}` : undefined,
                    }}
                  >
                <div className="relative shrink-0">
                    <Avatar 
                      className="w-12 h-12"
                      style={{
                        boxShadow: isNotFirstStage && statusTab === 'open' 
                          ? `0 0 0 2px var(--background), 0 0 0 4px ${stageColor}` 
                          : undefined,
                      }}
                    >
                      {contact.profile_picture_url && (
                        <AvatarImage 
                          src={contact.profile_picture_url} 
                          alt={contact.name}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className={cn(
                        "text-primary",
                        statusTab === 'closed' ? "bg-muted" : "bg-primary/10"
                      )}>
                        {(contact as any).is_group 
                          ? <Users className="w-5 h-5" />
                          : getInitials(contact.name)
                        }
                      </AvatarFallback>
                    </Avatar>
                    {contact.assigned_to && (() => {
                      const assignedMember = getAssignedMember(contact.assigned_to);
                      if (!assignedMember) return null;
                      const avatarDiv = (
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-background overflow-hidden bg-muted">
                          {assignedMember.avatar_url ? (
                            <img
                              src={assignedMember.avatar_url}
                              alt={assignedMember.full_name || 'Atribuído'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground text-[8px] font-medium">
                              {getInitials(assignedMember.full_name || 'U')}
                            </div>
                          )}
                        </div>
                      );
                      if (isMobile) return avatarDiv;
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>{avatarDiv}</TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {assignedMember.full_name || 'Sem nome'}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                    {statusTab === 'open' && isNotFirstStage && stageColor && (
                      <div 
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: stageColor }}
                      >
                        <CircleDollarSign className="w-3 h-3 text-white" />
                      </div>
                    )}
                  {statusTab === 'closed' && contact.sale_result === 'won' && (
                    <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 w-5 h-5 text-status-success bg-background rounded-full" />
                  )}
                  {statusTab === 'closed' && contact.sale_result === 'lost' && (
                    <XCircle className="absolute -bottom-0.5 -right-0.5 w-5 h-5 text-destructive bg-background rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-medium truncate flex items-center gap-1",
                    contact.unread_count > 0 && statusTab === 'open' && "font-semibold"
                  )}>
                    {(contact as any).is_pinned && (
                      <Pin className="w-3 h-3 text-primary shrink-0 fill-primary" />
                    )}
                    <span className="truncate">{truncateText(contact.name, 20)}</span>
                    {/* INSTAGRAM_HIDDEN: contact.channel === 'instagram' icon */}
                    {(() => {
                      const summary = tasksSummaryMap?.get(contact.id);
                      if (!summary || (summary.overdue === 0 && summary.due_soon === 0)) return null;
                      const isOverdue = summary.overdue > 0;
                      const badge = (
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5 px-1 rounded text-[10px] font-medium shrink-0',
                            isOverdue
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                          )}
                        >
                          <ListTodo className="w-2.5 h-2.5" />
                          {summary.total_open}
                        </span>
                      );
                      if (isMobile) return badge;
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>{badge}</TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {summary.total_open} {summary.total_open === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
                            {summary.overdue > 0 && ` — ${summary.overdue} vencida${summary.overdue > 1 ? 's' : ''}`}
                            {summary.overdue === 0 && summary.due_soon > 0 && ` — ${summary.due_soon} vence em 24h`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </h3>
                  <p className={cn(
                    "text-sm truncate mt-0.5",
                    contact.unread_count > 0 && statusTab === 'open' 
                      ? "text-foreground font-medium" 
                      : "text-muted-foreground"
                  )}>
                    <span className="block min-w-0 truncate">
                      {getLastMessagePreview(contact)}
                    </span>
                  </p>
                  {/* Show scheduled time for contacts with pending scheduled messages */}
                  {statusTab === 'snoozed' && scheduledInfoMap.has(contact.id) && (
                    <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                      <CalendarClock className="w-3 h-3" />
                      {format(new Date(scheduledInfoMap.get(contact.id)!), "dd/MM 'às' HH:mm")}
                    </p>
                  )}
                  {/* Show snoozed until time for snoozed contacts */}
                  {statusTab === 'snoozed' && contact.status === 'snoozed' && (contact as any).snoozed_until && !scheduledInfoMap.has(contact.id) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <AlarmClock className="w-3 h-3" />
                      {format(new Date((contact as any).snoozed_until), "dd/MM 'às' HH:mm")}
                    </p>
                  )}
                </div>

                <div className="flex-none w-16 flex flex-col items-end gap-1 relative z-10">
                  {getContactTimestamp(contact, statusTab === 'closed') && (
                    <span className={cn(
                      "text-xs whitespace-nowrap relative z-20",
                      contact.unread_count > 0 && statusTab === 'open' 
                        ? "text-primary font-medium" 
                        : "text-muted-foreground"
                    )}>
                      {getContactTimestamp(contact, statusTab === 'closed')}
                    </span>
                  )}
                  {statusTab === 'open' && !(contact as any).is_group && (
                    <SlaClockBadge
                      startedAt={(contact as any).sla_clock_started_at}
                      thresholdMinutes={
                        contactStage?.sla_threshold_minutes ??
                        (orgData?.organization as any)?.sla_threshold_minutes
                      }
                      businessHours={orgData?.organization as any}
                      holidays={holidaysData as any}
                    />
                  )}
                  {contact.unread_count > 0 && statusTab === 'open' && (
                    <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-success text-[10px] font-medium text-success-foreground">
                      {contact.unread_count > 99 ? '99+' : contact.unread_count}
                    </span>
                  )}
                </div>
                  </button>

                  {/* Pin + Archive/Unarchive + Delete buttons on hover */}
                  <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateContact.mutate({ id: contact.id, is_pinned: !(contact as any).is_pinned });
                          }}
                          className="p-1.5 rounded-md hover:bg-muted"
                        >
                          {(contact as any).is_pinned
                            ? <PinOff className="w-3.5 h-3.5 text-primary" />
                            : <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {(contact as any).is_pinned ? 'Desafixar' : 'Fixar conversa'}
                      </TooltipContent>
                    </Tooltip>
                    {onArchiveContact && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchiveContact(contact.id, statusTab !== 'archived');
                            }}
                            className="p-1.5 rounded-md hover:bg-muted"
                          >
                            {statusTab === 'archived' ? (
                              <ArchiveRestore className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {statusTab === 'archived' ? 'Desarquivar' : 'Arquivar'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactToClear({ id: contact.id, name: contact.name });
                          }}
                          className="p-1.5 rounded-md hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        Limpar conversa
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="border-t border-primary/20 px-3 py-2.5 bg-primary/5 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] flex items-center gap-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            onClick={() => {
              const visible = filteredContacts.map(c => c.id);
              setSelectedIds(prev => {
                const allSelected = visible.every(id => prev.has(id));
                const next = new Set(prev);
                if (allSelected) visible.forEach(id => next.delete(id));
                else visible.forEach(id => next.add(id));
                return next;
              });
            }}
          >
            {filteredContacts.every(c => selectedIds.has(c.id)) ? 'Desmarcar todos' : 'Selec. todos'}
          </button>
          <span className="text-xs font-medium text-primary flex-1 text-center">
            {selectedIds.size === 0 ? 'Nenhum selecionado' : `${selectedIds.size} selecionado${selectedIds.size !== 1 ? 's' : ''}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={selectedIds.size === 0}
            onClick={async () => {
              const ids = Array.from(selectedIds);
              await Promise.all(ids.map(id => {
                const contact = filteredContacts.find(c => c.id === id);
                const next = !contact?.hidden_from_funnel;
                return updateContact.mutateAsync({ id, hidden_from_funnel: next });
              }));
              setBulkMode(false);
              setSelectedIds(new Set());
            }}
          >
            <EyeOff className="w-3.5 h-3.5" />
            Ocultar do funil
          </Button>
        </div>
      )}
    </div>

    <AlertDialog open={!!contactToClear} onOpenChange={(o) => !o && setContactToClear(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpar conversa?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as mensagens de <strong>{contactToClear?.name || 'este contato'}</strong> serão apagadas permanentemente. O contato não será excluído. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleClearConversation}
            disabled={isClearing}
          >
            {isClearing ? 'Limpando...' : 'Limpar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!contactToDelete} onOpenChange={(o) => !o && setContactToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar contato?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{contactToDelete?.name || 'Este contato'}</strong> e todo o histórico de mensagens serão apagados permanentemente. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              if (!contactToDelete) return;
              await deleteContact.mutateAsync(contactToDelete.id);
              setContactToDelete(null);
            }}
          >
            {deleteContact.isPending ? 'Apagando...' : 'Apagar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function AvailabilityToggle() {
  const { isAvailable, toggleAvailable, isUpdating } = useMemberAvailability();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => toggleAvailable()}
          disabled={isUpdating}
          className="h-8 w-8 p-0"
          aria-label={isAvailable ? 'Disponível (On)' : 'Indisponível (Off)'}
        >
          {isAvailable ? (
            <Power className="w-4 h-4 text-emerald-500" />
          ) : (
            <PowerOff className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isAvailable
          ? 'On — recebendo atribuições automáticas'
          : 'Off — pulado nas atribuições automáticas'}
      </TooltipContent>
    </Tooltip>
  );
}
