import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface ScheduledContactInfo {
  contact_id: string;
  scheduled_at: string;
  message_content: string;
}

/**
 * Fetches contacts that have pending scheduled messages.
 * Returns a map of contact_id -> earliest scheduled_at for display in the "Agend." tab.
 */
export function useScheduledContacts() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['scheduled-contacts', organizationId],
    queryFn: async (): Promise<ScheduledContactInfo[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('contact_id, scheduled_at, message_content')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      // Deduplicate by contact_id, keeping the earliest scheduled_at
      const map = new Map<string, ScheduledContactInfo>();
      for (const row of data || []) {
        if (!map.has(row.contact_id)) {
          map.set(row.contact_id, row);
        }
      }

      return Array.from(map.values());
    },
    enabled: !!organizationId,
    staleTime: 30000,
  });
}
