import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export type FunnelStageType = 'in_progress' | 'won' | 'lost';

export interface FunnelStage {
  id: string;
  organization_id: string;
  pipeline_id: string;
  name: string;
  slug: string;
  color: string;
  cta_text: string | null;
  position: number;
  is_final: boolean;
  stage_type: FunnelStageType;
  auto_close_conversation?: boolean;
  sla_threshold_minutes?: number | null;
  canvas_x?: number | null;
  canvas_y?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches funnel stages for the user's organization.
 * If `pipelineId` is provided, only stages of that pipeline are returned.
 * If omitted, ALL stages from the org are returned (used by automation editor
 * to allow cross-pipeline lookups).
 */
export function useFunnelStages(pipelineId?: string | null) {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['funnel-stages', organizationId, pipelineId ?? 'all'],
    queryFn: async (): Promise<FunnelStage[]> => {
      if (!organizationId) return [];

      let q = supabase
        .from('funnel_stages')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (pipelineId) {
        q = q.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        stage_type: (s.stage_type as FunnelStageType) || 'in_progress',
      })) as FunnelStage[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateFunnelStage() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (
      stage: Omit<FunnelStage, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
    ) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('funnel_stages')
        .insert({
          ...stage,
          organization_id: orgData.organization.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
  });
}

export function useUpdateFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FunnelStage> & { id: string }) => {
      const { error } = await supabase
        .from('funnel_stages')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
  });
}

export function useDeleteFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funnel_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
  });
}

export function useReorderFunnelStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stages: { id: string; position: number }[]) => {
      // Two-pass to avoid unique conflicts
      for (let i = 0; i < stages.length; i++) {
        const { error } = await supabase
          .from('funnel_stages')
          .update({ position: -(i + 1000) })
          .eq('id', stages[i].id);

        if (error) throw error;
      }

      for (const stage of stages) {
        const { error } = await supabase
          .from('funnel_stages')
          .update({ position: stage.position })
          .eq('id', stage.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
  });
}
