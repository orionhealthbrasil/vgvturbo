import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useUserPermissions } from '@/hooks/usePermissions';
import { ContactWithColumn, ContactStatus } from '@/types/crm';

// Helper to check if a tag name matches "fornecedor" or "colaborador" (case insensitive, handles singular/plural)
const isSharedTag = (tagName: string): boolean => {
  const normalized = tagName.toLowerCase().trim();
  return (
    normalized.startsWith('fornecedor') ||
    normalized.startsWith('colaborador')
  );
};


/**
 * Hook optimized for the Chat/Conversations page.
 * Fetches contacts with active conversations (status = 'open' or 'snoozed' by default).
 * Uses server-side filtering to avoid fetching thousands of closed contacts.
 */
export function useConversationContacts(status?: ContactStatus, enabled = true) {
  const { data: orgData } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  // Wait for permission data to be ready
  const isReady = !!organizationId && (isOwner || memberRole !== null);

  return useQuery({
    queryKey: ['conversation-contacts', organizationId, memberRole, userId, isOwner, status],
    queryFn: async (): Promise<ContactWithColumn[]> => {
      if (!organizationId) return [];

      // Build query - use last_message_at NOT NULL filter instead of scanning messages table
      // This is much faster as it uses the contacts table index directly
      let query = supabase
        .from('contacts')
        .select(`*, kanban_columns (*)`)
        .eq('organization_id', organizationId)
        .not('last_message_at', 'is', null)
        .eq('is_archived', false); // Exclude archived contacts

      // Viewer (Vendedor) can see:
      // 1. Contacts assigned to them
      // 2. Contacts with "fornecedor" or "colaborador" tags (shared contacts)
      if (!isOwner && memberRole === 'viewer' && userId) {
        // Find shared tags (fornecedor/colaborador)
        const { data: allTags } = await supabase
          .from('tags')
          .select('id, name')
          .eq('organization_id', organizationId);
        
        const sharedTagIds = (allTags || [])
          .filter(t => isSharedTag(t.name))
          .map(t => t.id);
        
        if (sharedTagIds.length > 0) {
          // Find contacts with shared tags
          const { data: taggedContacts } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', sharedTagIds);
          
          const sharedContactIds = [...new Set((taggedContacts || []).map(ct => ct.contact_id))];
          
          if (sharedContactIds.length > 0) {
            // Filter: assigned to user OR has shared tag
            const orFilter = `assigned_to.eq.${userId},id.in.(${sharedContactIds.join(',')})`;
            query = query.or(orFilter);
          } else {
            query = query.eq('assigned_to', userId);
          }
        } else {
          query = query.eq('assigned_to', userId);
        }
      }

      // Filter by status if specified, otherwise get all statuses for conversation view
      if (status) {
        query = query.eq('status', status);
      }

      // Order by last_message_at descending
      const { data: contactsData, error } = await query
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(500); // Reasonable limit for conversation list

      if (error) throw error;

      if (!contactsData || contactsData.length === 0) return [];

      const contactIds = contactsData.map(c => c.id);

      // Fetch tags and last messages in PARALLEL
      // Tags: batch in groups of 100
      const BATCH_SIZE = 100;
      const tagPromises: Promise<{ data: any[] | null }>[] = [];

      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batchIds = contactIds.slice(i, i + BATCH_SIZE);
        tagPromises.push(
          Promise.resolve(
            supabase
              .from('contact_tags')
              .select('contact_id, tags (id, name, color)')
              .in('contact_id', batchIds)
          )
        );
      }

      // Last messages: use efficient RPC with DISTINCT ON
      const lastMsgPromise = supabase.rpc('get_last_messages_for_contacts', {
        p_contact_ids: contactIds
      });

      // Run ALL in parallel
      const [tagResults, msgResult] = await Promise.all([
        Promise.all(tagPromises),
        lastMsgPromise,
      ]);

      // Build tags map
      const tagsMap = new Map<string, { id: string; name: string; color: string }[]>();
      for (const result of tagResults) {
        if (result.data) {
          for (const ct of result.data) {
            const contactId = ct.contact_id;
            const tag = ct.tags;
            if (!tagsMap.has(contactId)) {
              tagsMap.set(contactId, []);
            }
            if (tag) {
              tagsMap.get(contactId)!.push(tag);
            }
          }
        }
      }

      // Build last message map from RPC result
      const lastMessageMap = new Map<string, any>();
      if (msgResult.data) {
        for (const msg of msgResult.data as any[]) {
          lastMessageMap.set(msg.contact_id, msg);
        }
      }

      // Build final contacts with tags and last message
      return contactsData.map(contact => ({
        ...(contact as unknown as Record<string, unknown>),
        tags: tagsMap.get(contact.id) || [],
        last_message: lastMessageMap.get(contact.id) || null,
      })) as unknown as ContactWithColumn[];
    },
    enabled: isReady && enabled,
    staleTime: 60000, // 60 seconds - Realtime handles updates
  });
}

const PAGE_SIZE = 50;

/**
 * Paginated version of useConversationContacts using infinite scroll.
 * Loads PAGE_SIZE contacts per page for better initial load performance.
 */
export function useConversationContactsPaginated(channelFilter?: 'whatsapp' | 'instagram') {
  const { data: orgData } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  const isReady = !!organizationId && (isOwner || memberRole !== null);

  // Pre-compute shared contact IDs for vendedor (viewer) users
  // This avoids re-fetching shared tags on every page
  const sharedContactIdsQuery = useQuery({
    queryKey: ['shared-contact-ids', organizationId, memberRole, userId, isOwner],
    queryFn: async (): Promise<string[] | null> => {
      if (!organizationId) return null;
      if (isOwner || memberRole !== 'viewer' || !userId) return null;

      const { data: allTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('organization_id', organizationId);

      const sharedTagIds = (allTags || [])
        .filter(t => isSharedTag(t.name))
        .map(t => t.id);

      if (sharedTagIds.length === 0) return [];

      const { data: taggedContacts } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', sharedTagIds);

      return [...new Set((taggedContacts || []).map(ct => ct.contact_id))];
    },
    enabled: isReady && !isOwner && memberRole === 'viewer' && !!userId,
    staleTime: 120000,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey: ['conversation-contacts-paginated', organizationId, memberRole, userId, isOwner, channelFilter ?? 'all', sharedContactIdsQuery.data ?? null],
    queryFn: async ({ pageParam = 0 }): Promise<ContactWithColumn[]> => {
      if (!organizationId) return [];

      let query = supabase
        .from('contacts')
        .select(`*, kanban_columns (*)`)
        .eq('organization_id', organizationId)
        .not('last_message_at', 'is', null)
        .eq('is_archived', false);

      // Channel filter (DB-level) — prevents IG contacts being hidden by WA-only first page
      if (channelFilter === 'instagram') {
        query = query.eq('channel', 'instagram');
      } else if (channelFilter === 'whatsapp') {
        query = query.or('channel.neq.instagram,channel.is.null');
      }

      // Vendedor filter
      if (!isOwner && memberRole === 'viewer' && userId) {
        const sharedIds = sharedContactIdsQuery.data;
        if (sharedIds && sharedIds.length > 0) {
          query = query.or(`assigned_to.eq.${userId},id.in.(${sharedIds.join(',')})`);
        } else {
          query = query.eq('assigned_to', userId);
        }
      }

      const from = pageParam as number;
      const to = from + PAGE_SIZE - 1;

      const { data: contactsData, error } = await query
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) throw error;
      if (!contactsData || contactsData.length === 0) return [];

      const contactIds = contactsData.map(c => c.id);

      // Fetch tags and last messages in parallel
      const BATCH_SIZE = 100;
      const tagPromises: Promise<{ data: any[] | null }>[] = [];
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batchIds = contactIds.slice(i, i + BATCH_SIZE);
        tagPromises.push(
          Promise.resolve(
            supabase
              .from('contact_tags')
              .select('contact_id, tags (id, name, color)')
              .in('contact_id', batchIds)
          )
        );
      }

      const lastMsgPromise = supabase.rpc('get_last_messages_for_contacts', {
        p_contact_ids: contactIds
      });

      const [tagResults, msgResult] = await Promise.all([
        Promise.all(tagPromises),
        lastMsgPromise,
      ]);

      const tagsMap = new Map<string, { id: string; name: string; color: string }[]>();
      for (const result of tagResults) {
        if (result.data) {
          for (const ct of result.data) {
            const contactId = ct.contact_id;
            const tag = ct.tags;
            if (!tagsMap.has(contactId)) tagsMap.set(contactId, []);
            if (tag) tagsMap.get(contactId)!.push(tag);
          }
        }
      }

      const lastMessageMap = new Map<string, any>();
      if (msgResult.data) {
        for (const msg of msgResult.data as any[]) {
          lastMessageMap.set(msg.contact_id, msg);
        }
      }

      return contactsData.map(contact => ({
        ...(contact as unknown as Record<string, unknown>),
        tags: tagsMap.get(contact.id) || [],
        last_message: lastMessageMap.get(contact.id) || null,
      })) as unknown as ContactWithColumn[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: isReady && (isOwner || memberRole !== 'viewer' || sharedContactIdsQuery.data !== undefined),
    staleTime: 60000,
    placeholderData: (prev: any) => prev,
  });

  const queryClient = useQueryClient();

  // Realtime: invalidate contact list when any contact's last_message_at changes.
  // Debounced at 2s to batch rapid bursts (e.g. 20 messages arriving at once → 1 refetch).
  useEffect(() => {
    if (!organizationId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`contact-list-updates:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          const prev = payload.old as any;
          if (updated.last_message_at !== prev.last_message_at) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['conversation-contacts-paginated'] });
              queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  // Flatten pages into a single array
  const contacts = infiniteQuery.data?.pages.flatMap(p => p) ?? [];

  return {
    contacts,
    isLoading: infiniteQuery.isLoading,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: !!infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
  };
}

/**
 * Hook to get counts for each status tab without fetching all data
 */
export function useConversationCounts(channelFilter?: 'whatsapp' | 'instagram') {
  const { data: orgData } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  const isReady = !!organizationId && (isOwner || memberRole !== null);

  return useQuery({
    queryKey: ['conversation-counts', organizationId, memberRole, userId, isOwner, channelFilter ?? 'all'],
    queryFn: async () => {
      if (!organizationId) return { open: 0, snoozed: 0, closed: 0, unread: 0 };

      // Vendedor sees assigned contacts + contacts with shared tags
      const vendedorFilter = !isOwner && memberRole === 'viewer' && userId;
      let orFilter: string | null = null;

      if (vendedorFilter) {
        // Find shared tags (fornecedor/colaborador)
        const { data: allTags } = await supabase
          .from('tags')
          .select('id, name')
          .eq('organization_id', organizationId);
        
        const sharedTagIds = (allTags || [])
          .filter(t => isSharedTag(t.name))
          .map(t => t.id);
        
        if (sharedTagIds.length > 0) {
          const { data: taggedContacts } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', sharedTagIds);
          
          const sharedContactIds = [...new Set((taggedContacts || []).map(ct => ct.contact_id))];
          
          if (sharedContactIds.length > 0) {
            orFilter = `assigned_to.eq.${userId},id.in.(${sharedContactIds.join(',')})`;
          }
        }
      }

      // Use last_message_at NOT NULL filter - much faster than scanning messages table
      let openQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'open')
        .eq('is_archived', false)
        .not('last_message_at', 'is', null);

      let snoozedQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'snoozed')
        .eq('is_archived', false)
        .not('last_message_at', 'is', null);

      let closedQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'closed')
        .eq('is_archived', false)
        .not('last_message_at', 'is', null);

      let unreadQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'open')
        .eq('is_archived', false)
        .gt('unread_count', 0)
        .not('last_message_at', 'is', null);

      if (vendedorFilter) {
        if (orFilter) {
          openQuery = openQuery.or(orFilter);
          snoozedQuery = snoozedQuery.or(orFilter);
          closedQuery = closedQuery.or(orFilter);
          unreadQuery = unreadQuery.or(orFilter);
        } else {
          openQuery = openQuery.eq('assigned_to', userId);
          snoozedQuery = snoozedQuery.eq('assigned_to', userId);
          closedQuery = closedQuery.eq('assigned_to', userId);
          unreadQuery = unreadQuery.eq('assigned_to', userId);
        }
      }

      // Apply channel filter
      if (channelFilter === 'instagram') {
        openQuery = openQuery.eq('channel', 'instagram');
        snoozedQuery = snoozedQuery.eq('channel', 'instagram');
        closedQuery = closedQuery.eq('channel', 'instagram');
        unreadQuery = unreadQuery.eq('channel', 'instagram');
      } else if (channelFilter === 'whatsapp') {
        const notIg = 'channel.neq.instagram,channel.is.null';
        openQuery = openQuery.or(notIg);
        snoozedQuery = snoozedQuery.or(notIg);
        closedQuery = closedQuery.or(notIg);
        unreadQuery = unreadQuery.or(notIg);
      }

      const [openResult, snoozedResult, closedResult, unreadResult] = await Promise.all([
        openQuery,
        snoozedQuery,
        closedQuery,
        unreadQuery,
      ]);

      return {
        open: openResult.count || 0,
        snoozed: snoozedResult.count || 0,
        closed: closedResult.count || 0,
        unread: unreadResult.count || 0,
      };
    },
    enabled: isReady,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch archived contacts
 */
export function useArchivedContacts() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['archived-contacts', organizationId],
    queryFn: async (): Promise<ContactWithColumn[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('contacts')
        .select(`*, kanban_columns (*)`)
        .eq('organization_id', organizationId)
        .eq('is_archived', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch tags
      const contactIds = data.map(c => c.id);
      const { data: contactTags } = await supabase
        .from('contact_tags')
        .select('contact_id, tags (id, name, color)')
        .in('contact_id', contactIds);

      const tagsMap = new Map<string, { id: string; name: string; color: string }[]>();
      if (contactTags) {
        for (const ct of contactTags as any[]) {
          if (!tagsMap.has(ct.contact_id)) tagsMap.set(ct.contact_id, []);
          if (ct.tags) tagsMap.get(ct.contact_id)!.push(ct.tags);
        }
      }

      return data.map(contact => ({
        ...(contact as unknown as Record<string, unknown>),
        tags: tagsMap.get(contact.id) || [],
        last_message: null,
      })) as unknown as ContactWithColumn[];
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });
}

/**
 * Server-side search across the entire contacts table for the org.
 * Used when the user types a search term or activates tag/assignee filters
 * in the chat list — bypasses pagination so results aren't limited to
 * what's already loaded into memory.
 */
export interface ContactsServerSearchParams {
  searchTerm?: string;
  tagIds?: string[];
  assigneeId?: string | null;
  channelFilter?: 'whatsapp' | 'instagram';
  includeArchived?: boolean;
  statusFilter?: ContactStatus | null;
}

export function useContactsServerSearch(params: ContactsServerSearchParams) {
  const { data: orgData } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  const term = (params.searchTerm || '').trim();
  const tagIds = params.tagIds || [];
  const assigneeId = params.assigneeId || null;
  const channelFilter = params.channelFilter;
  const includeArchived = !!params.includeArchived;
  const statusFilter = params.statusFilter ?? null;

  const hasSearch = term.length >= 2;
  const hasFilters = tagIds.length > 0 || !!assigneeId;
  const isActive = hasSearch || hasFilters;

  const isReady = !!organizationId && (isOwner || memberRole !== null);

  return useQuery({
    queryKey: [
      'contacts-server-search',
      organizationId,
      memberRole,
      userId,
      isOwner,
      term,
      tagIds.slice().sort().join(','),
      assigneeId,
      channelFilter ?? 'all',
      includeArchived,
      statusFilter ?? 'any',
    ],
    enabled: isReady && isActive,
    staleTime: 30000,
    queryFn: async (): Promise<ContactWithColumn[]> => {
      if (!organizationId) return [];

      const viewerUserId =
        !isOwner && memberRole === 'viewer' && userId ? userId : null;

      const { data: contactsData, error } = await supabase.rpc(
        'search_contacts_with_filters' as any,
        {
          p_organization_id: organizationId,
          p_tag_ids: tagIds.length > 0 ? tagIds : null,
          p_assignee_id: assigneeId,
          p_search: hasSearch ? term : null,
          p_channel: channelFilter ?? null,
          p_status: statusFilter,
          p_include_archived: includeArchived,
          p_viewer_user_id: viewerUserId,
          p_limit: 200,
        } as any
      );

      if (error) throw error;
      const rows = (contactsData as any[]) || [];
      if (rows.length === 0) return [];

      const contactIds = rows.map((c) => c.id);

      // Hydrate kanban columns
      const columnIds = Array.from(
        new Set(rows.map((c) => c.kanban_column_id).filter(Boolean))
      ) as string[];

      const columnsPromise: Promise<{ data: any[] | null }> =
        columnIds.length > 0
          ? (supabase.from('kanban_columns').select('*').in('id', columnIds) as any)
          : Promise.resolve({ data: [] });

      // Tags in batches
      const BATCH_SIZE = 100;
      const tagPromises: Promise<{ data: any[] | null }>[] = [];
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batchIds = contactIds.slice(i, i + BATCH_SIZE);
        tagPromises.push(
          Promise.resolve(
            supabase
              .from('contact_tags')
              .select('contact_id, tags (id, name, color)')
              .in('contact_id', batchIds)
          )
        );
      }
      const lastMsgPromise = supabase.rpc('get_last_messages_for_contacts', {
        p_contact_ids: contactIds,
      });

      const [tagResults, msgResult, columnsResult] = await Promise.all([
        Promise.all(tagPromises),
        lastMsgPromise,
        columnsPromise,
      ]);

      const tagsMap = new Map<string, { id: string; name: string; color: string }[]>();
      for (const result of tagResults) {
        if (result.data) {
          for (const ct of result.data) {
            const cid = ct.contact_id;
            const tag = ct.tags;
            if (!tagsMap.has(cid)) tagsMap.set(cid, []);
            if (tag) tagsMap.get(cid)!.push(tag);
          }
        }
      }
      const lastMessageMap = new Map<string, any>();
      if (msgResult.data) {
        for (const msg of msgResult.data as any[]) {
          lastMessageMap.set(msg.contact_id, msg);
        }
      }
      const columnsMap = new Map<string, any>();
      for (const col of (columnsResult.data as any[]) || []) {
        columnsMap.set(col.id, col);
      }

      return rows.map((contact: any) => ({
        ...contact,
        kanban_columns: contact.kanban_column_id
          ? columnsMap.get(contact.kanban_column_id) || null
          : null,
        tags: tagsMap.get(contact.id) || [],
        last_message: lastMessageMap.get(contact.id) || null,
      })) as unknown as ContactWithColumn[];
    },
  });
}

