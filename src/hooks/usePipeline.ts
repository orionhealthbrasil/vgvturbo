import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { ContactWithColumn } from '@/types/crm';

/**
 * Loads contacts for the Pipeline view. When `pipelineId` is provided,
 * filters server-side to drastically reduce payload. Uses parallel pagination
 * (4 concurrent requests) to bypass the 1000-row cap quickly.
 */
export function usePipelineContacts(pipelineId?: string | null) {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['pipeline-contacts', organizationId, pipelineId ?? 'all'],
    queryFn: async (): Promise<ContactWithColumn[]> => {
      if (!organizationId) return [];

      const PAGE = 1000;
      const CONCURRENCY = 4;

      const buildQuery = (from: number, to: number, withCount: boolean) => {
        let q = supabase
          .from('contacts')
          .select('*', withCount ? { count: 'exact' } : undefined)
          .eq('organization_id', organizationId)
          .eq('is_archived', false)
          .eq('hidden_from_funnel', false);
        if (pipelineId) q = q.eq('pipeline_id', pipelineId);
        return q.order('updated_at', { ascending: false }).range(from, to);
      };

      // First page + total count
      const { data: firstPage, error: firstErr, count } = await buildQuery(0, PAGE - 1, true);
      if (firstErr) throw firstErr;
      const all: any[] = firstPage ? [...firstPage] : [];

      const total = count ?? all.length;
      if (total <= PAGE) return all as ContactWithColumn[];

      // Remaining pages — fire in parallel batches
      const totalPages = Math.ceil(total / PAGE);
      const remaining: number[] = [];
      for (let p = 1; p < totalPages; p++) remaining.push(p);

      for (let i = 0; i < remaining.length; i += CONCURRENCY) {
        const batch = remaining.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map((p) => buildQuery(p * PAGE, (p + 1) * PAGE - 1, false))
        );
        for (const r of results) {
          if (r.error) throw r.error;
          if (r.data) all.push(...r.data);
        }
      }

      return all as ContactWithColumn[];
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}


export function useUpdateDealFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: { id: string; deal_value?: number | null; deal_notes?: string | null; loss_reason?: string | null }
    ) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from('contacts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-contacts'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

/**
 * Centralized helpers to fire pipeline-related automation triggers.
 * Use these whenever a contact's funnel_stage or sale_result changes,
 * regardless of where the change happens (UI, drag-drop, dialog, API).
 */
export async function triggerFunnelStageAutomation(params: {
  contactId: string;
  organizationId: string;
  newStageName: string;
  previousStageName?: string | null;
  pipelineId?: string | null;
  previousPipelineId?: string | null;
}) {
  const {
    contactId,
    organizationId,
    newStageName,
    previousStageName,
    pipelineId,
    previousPipelineId,
  } = params;
  try {
    // Fire EXIT first (if changed)
    if (previousStageName && previousStageName !== newStageName) {
      await supabase.functions.invoke('automation-engine', {
        body: {
          contact_id: contactId,
          organization_id: organizationId,
          event_type: 'funnel_stage_exit',
          funnel_stage_name: previousStageName,
          pipeline_id: previousPipelineId ?? pipelineId ?? null,
        },
      });
    }
    // Then ENTRY into the new stage
    await supabase.functions.invoke('automation-engine', {
      body: {
        contact_id: contactId,
        organization_id: organizationId,
        event_type: 'funnel_stage_change',
        funnel_stage_name: newStageName,
        pipeline_id: pipelineId ?? null,
      },
    });
  } catch (err) {
    console.error('[Pipeline] Error triggering funnel stage automation:', err);
  }
}

export async function triggerDealResultAutomation(params: {
  contactId: string;
  organizationId: string;
  result: 'won' | 'lost';
}) {
  try {
    await supabase.functions.invoke('automation-engine', {
      body: {
        contact_id: params.contactId,
        organization_id: params.organizationId,
        event_type: params.result === 'won' ? 'deal_won' : 'deal_lost',
      },
    });
  } catch (err) {
    console.error('[Pipeline] Error triggering deal result automation:', err);
  }
}

