import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useUserPermissions } from '@/hooks/usePermissions';
import { ContactWithColumn } from '@/types/crm';

export interface ContactFilters {
  search?: string;
  status?: string;
  funnelStage?: string;
  tagId?: string;
  dateField?: 'created_at' | 'last_message_at';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
}

export interface PaginatedContactsResult {
  contacts: ContactWithColumn[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function useContactsPaginated(
  page: number = 1,
  pageSize: number = 25,
  filters: ContactFilters = {}
) {
  const { data: orgData, isLoading: isOrgLoading } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  // Wait for permission data to be ready for viewers
  const isReady = !!organizationId && (isOwner || memberRole !== null);

  return useQuery({
    queryKey: ['contacts-paginated', organizationId, memberRole, userId, isOwner, page, pageSize, filters],
    queryFn: async (): Promise<PaginatedContactsResult> => {
      if (!organizationId) {
        return { contacts: [], totalCount: 0, totalPages: 0, currentPage: page };
      }

      // Build base query for counting
      let countQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Build data query
      let dataQuery = supabase
        .from('contacts')
        .select(`
          *,
          kanban_columns (*)
        `)
        .eq('organization_id', organizationId);

      // All organization members (including viewers/vendors) can now see all contacts
      // The RLS policy already handles organization-level filtering

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        countQuery = countQuery.eq('status', filters.status);
        dataQuery = dataQuery.eq('status', filters.status);
      }

      if (filters.funnelStage && filters.funnelStage !== 'all') {
        countQuery = countQuery.eq('funnel_stage', filters.funnelStage);
        dataQuery = dataQuery.eq('funnel_stage', filters.funnelStage);
      }

      // Search filter via RPC for accent-insensitive + flexible phone format support
      if (filters.search && filters.search.trim()) {
        const { data: searchIds } = await supabase.rpc('search_contacts_with_filters' as any, {
          p_organization_id: organizationId,
          p_search: filters.search.trim(),
          p_include_archived: false,
          p_limit: 5000,
        } as any);
        const ids = ((searchIds as any[]) || []).map((c: any) => c.id);
        if (ids.length === 0) {
          return { contacts: [], totalCount: 0, totalPages: 0, currentPage: page };
        }
        countQuery = countQuery.in('id', ids);
        dataQuery = dataQuery.in('id', ids);
      }

      // Date range filter (server-side)
      const dateField = filters.dateField || 'created_at';
      if (filters.dateFrom) {
        const fromIso = `${filters.dateFrom}T00:00:00`;
        countQuery = countQuery.gte(dateField, fromIso);
        dataQuery = dataQuery.gte(dateField, fromIso);
      }
      if (filters.dateTo) {
        const toIso = `${filters.dateTo}T23:59:59`;
        countQuery = countQuery.lte(dateField, toIso);
        dataQuery = dataQuery.lte(dateField, toIso);
      }

      // Get total count first
      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;
      
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      // Calculate range for pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Get paginated data
      const { data: contactsData, error: dataError } = await dataQuery
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (dataError) throw dataError;

      // If tag filter is active, we need to filter client-side (can be optimized with RPC later)
      let finalContacts = contactsData || [];

      if (filters.tagId && filters.tagId !== 'all') {
        // Fetch contact_tags for these contacts
        const contactIds = finalContacts.map(c => c.id);
        if (contactIds.length > 0) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .eq('tag_id', filters.tagId)
            .in('contact_id', contactIds);

          const taggedContactIds = new Set((contactTags || []).map(ct => ct.contact_id));
          finalContacts = finalContacts.filter(c => taggedContactIds.has(c.id));
        }
      }

      // Fetch tags for all contacts on this page
      const contactIds = finalContacts.map(c => c.id);
      let tagsMap = new Map<string, { id: string; name: string; color: string }[]>();

      if (contactIds.length > 0) {
        const { data: contactTags } = await supabase
          .from('contact_tags')
          .select(`
            contact_id,
            tags (id, name, color)
          `)
          .in('contact_id', contactIds);

        if (contactTags) {
          for (const ct of contactTags as any[]) {
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

      // Build final contacts with tags
      const contactsWithTags = finalContacts.map(contact => ({
        ...(contact as unknown as Record<string, unknown>),
        tags: tagsMap.get(contact.id) || [],
        last_message: null, // Skip last message fetch for performance
      })) as unknown as ContactWithColumn[];

      return {
        contacts: contactsWithTags,
        totalCount,
        totalPages,
        currentPage: page,
      };
    },
    enabled: isReady,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });
}

// Hook to prefetch next page
export function usePrefetchNextPage() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  return (page: number, pageSize: number, filters: ContactFilters) => {
    queryClient.prefetchQuery({
      queryKey: ['contacts-paginated', organizationId, memberRole, userId, isOwner, page, pageSize, filters],
      staleTime: 30000,
    });
  };
}

// Export all phones for duplicate detection during import
export function useAllContactPhones() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['contact-phones', organizationId],
    queryFn: async (): Promise<Set<string>> => {
      if (!organizationId) return new Set();

      const { data, error } = await supabase
        .from('contacts')
        .select('phone')
        .eq('organization_id', organizationId);

      if (error) throw error;

      return new Set((data || []).map(c => c.phone.replace(/\D/g, '')));
    },
    enabled: !!organizationId,
    staleTime: 60000, // 1 minute
  });
}
