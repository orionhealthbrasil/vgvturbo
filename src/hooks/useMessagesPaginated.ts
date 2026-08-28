import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/crm';

const PAGE_SIZE = 30;

export function useMessagesPaginated(contactId: string | null) {
  return useInfiniteQuery({
    queryKey: ['messages', contactId],
    queryFn: async ({ pageParam }): Promise<{ messages: Message[]; nextCursor: string | null; nextCursorSeq: number | null }> => {
      if (!contactId) return { messages: [], nextCursor: null, nextCursorSeq: null };

      let query = supabase
        .from('messages')
        // NOTE: Avoid embedded join here; some environments still fail with:
        // "Could not find a relationship between 'messages' and 'sent_by_user_id' in the schema cache".
        // We'll fetch sender names in a second query from `profiles`.
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false }) // Primary: server timestamp
        .order('sequence_id', { ascending: false }) // Secondary: insertion order for same-second messages
        .limit(PAGE_SIZE);

      // Compound cursor: use both created_at AND sequence_id to avoid skipping
      // messages that share the same timestamp at a page boundary.
      if (pageParam) {
        const { ts, seq } = pageParam as { ts: string; seq: number | null };
        if (seq != null) {
          // Fetch rows older than the cursor: same timestamp but lower seq, OR earlier timestamp
          query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},sequence_id.lt.${seq})`);
        } else {
          query = query.lt('created_at', ts);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Messages] Failed to load messages', { contactId, pageParam, error });
        throw error;
      }

      const rows = (data || []) as any[];

      // Fetch sender names (outbound messages) in one extra query
      const senderIds = Array.from(
        new Set(
          rows
            .map((m) => m.sent_by_user_id)
            .filter(Boolean)
        )
      ) as string[];

      let nameByUserId = new Map<string, string>();
      if (senderIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', senderIds);

        if (profilesError) {
          console.warn('[Messages] Failed to load sender names', { profilesError });
        } else {
          for (const p of profiles || []) {
            if (p.user_id) nameByUserId.set(p.user_id, p.full_name || '');
          }
        }
      }

      // Fetch AI agent names for messages sent by AI
      const agentIds = Array.from(
        new Set(
          rows
            .map((m) => m.ai_agent_id)
            .filter(Boolean)
        )
      ) as string[];

      let agentInfoById = new Map<string, { name: string; department: string }>();
      if (agentIds.length > 0) {
        const { data: agents, error: agentsError } = await supabase
          .from('ai_agents')
          .select('id, name, department')
          .in('id', agentIds);

        if (!agentsError) {
          for (const a of agents || []) {
            agentInfoById.set(a.id, { name: a.name, department: (a as any).department || 'Vendas' });
          }
        }
      }

      // Compound cursor: store created_at + sequence_id of the oldest row in this batch.
      // Using both prevents skipping messages that share the same timestamp at a page boundary.
      const oldestRow = rows.length === PAGE_SIZE ? rows[rows.length - 1] : null;
      const nextCursor = oldestRow ? oldestRow.created_at : null;
      const nextCursorSeq = oldestRow ? (oldestRow.sequence_id ?? null) : null;

      // Now reverse to get ascending order for display (oldest first in UI)
      const messages = rows
        .map((msg: any) => {
          let sentByName: string | null = null;
          if (msg.sent_by_user_id) {
            sentByName = nameByUserId.get(msg.sent_by_user_id) || null;
          } else if (msg.ai_agent_id) {
            const info = agentInfoById.get(msg.ai_agent_id);
            sentByName = info ? `${info.name} | ${info.department}` : null;
          }
          return { ...msg, sent_by_name: sentByName };
        })
        .reverse() as Message[];

      return { messages, nextCursor, nextCursorSeq };
    },
    initialPageParam: null as { ts: string; seq: number | null } | null,
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor ? { ts: lastPage.nextCursor, seq: lastPage.nextCursorSeq } : null,
    enabled: !!contactId,
    staleTime: 5_000, // Realtime handles live updates; baixo para pegar mensagens perdidas na reconexão
    refetchOnWindowFocus: true, // Re-sincroniza ao retornar à aba
  });
}

// Helper to flatten paginated messages
// Pages are in reverse chronological order (page 0 = newest, page 1 = older, etc.)
// We need to reverse them to get chronological order (oldest pages first)
export function flattenMessages(data: { pages: { messages: Message[] }[] } | undefined): Message[] {
  if (!data?.pages) return [];
  const all = [...data.pages].reverse().flatMap((page) => page.messages);
  // Deduplicate by id: keep first occurrence (oldest page wins over newer refetch duplicates).
  // Also filters out stale temp-* optimistic messages that survived a refetch.
  const seen = new Set<string>();
  return all.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
