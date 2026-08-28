import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HiddenFromEntry {
  id: string;
  user_id: string;
}

export function useContactHiddenFrom(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-hidden-from', contactId],
    queryFn: async (): Promise<HiddenFromEntry[]> => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('contact_hidden_from')
        .select('id, user_id')
        .eq('contact_id', contactId);
      if (error) throw error;
      return data as HiddenFromEntry[];
    },
    enabled: !!contactId,
  });
}

export function useSetContactHiddenFrom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      userIds,
    }: {
      contactId: string;
      userIds: string[];
    }) => {
      // Fetch existing entries
      const { data: existing, error: fetchErr } = await supabase
        .from('contact_hidden_from')
        .select('id, user_id')
        .eq('contact_id', contactId);
      if (fetchErr) throw fetchErr;

      const existingIds = new Set((existing || []).map((e) => e.user_id));
      const targetIds = new Set(userIds);

      const toAdd = userIds.filter((uid) => !existingIds.has(uid));
      const toRemove = (existing || []).filter((e) => !targetIds.has(e.user_id)).map((e) => e.id);

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('contact_hidden_from')
          .insert(toAdd.map((uid) => ({ contact_id: contactId, user_id: uid })));
        if (error) throw error;
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('contact_hidden_from')
          .delete()
          .in('id', toRemove);
        if (error) throw error;
      }
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-hidden-from', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
    },
  });
}
