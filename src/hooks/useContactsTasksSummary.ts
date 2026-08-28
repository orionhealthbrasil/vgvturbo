import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

const sb = supabase as any;

export interface ContactTaskSummary {
  contact_id: string;
  total_open: number;
  due_soon: number; // due in next 24h, not done
  overdue: number; // past due, not done
}

/**
 * Returns a Map keyed by contact_id with task counters for the current org.
 * Only considers tasks not in 'done' state.
 */
export function useContactsTasksSummary() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['contacts-tasks-summary', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<Map<string, ContactTaskSummary>> => {
      const { data, error } = await sb
        .from('tasks')
        .select('contact_id, status, due_at')
        .eq('organization_id', orgId)
        .neq('status', 'done')
        .not('contact_id', 'is', null);
      if (error) throw error;

      const now = Date.now();
      const in24h = now + 24 * 60 * 60 * 1000;
      const map = new Map<string, ContactTaskSummary>();

      ((data ?? []) as any[]).forEach((t) => {
        const cur = map.get(t.contact_id) ?? {
          contact_id: t.contact_id,
          total_open: 0,
          due_soon: 0,
          overdue: 0,
        };
        cur.total_open += 1;
        if (t.due_at) {
          const due = new Date(t.due_at).getTime();
          if (due < now) cur.overdue += 1;
          else if (due <= in24h) cur.due_soon += 1;
        }
        map.set(t.contact_id, cur);
      });
      return map;
    },
  });
}
