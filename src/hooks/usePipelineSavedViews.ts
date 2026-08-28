import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export type PipelineViewMode = 'kanban' | 'table';
export type PipelineStatusFilter = 'all' | 'open' | 'won' | 'lost';
export type PipelinePeriodPreset = 'all' | '7d' | '30d' | '90d' | 'custom';

export interface PipelineFilters {
  view: PipelineViewMode;
  search: string;
  status: PipelineStatusFilter;
  stages: string[]; // funnel_stage slugs; empty = all
  period: PipelinePeriodPreset;
  date_from?: string | null; // ISO date (yyyy-mm-dd) when period === 'custom'
  date_to?: string | null;
}

export const defaultPipelineFilters: PipelineFilters = {
  view: 'kanban',
  search: '',
  status: 'all',
  stages: [],
  period: 'all',
  date_from: null,
  date_to: null,
};

export interface PipelineSavedView {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  filters: PipelineFilters;
  created_at: string;
  updated_at: string;
}

export function usePipelineSavedViews() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  return useQuery({
    queryKey: ['pipeline-saved-views', orgId, userId],
    queryFn: async (): Promise<PipelineSavedView[]> => {
      if (!orgId || !userId) return [];
      const { data, error } = await supabase
        .from('pipeline_saved_views')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PipelineSavedView[];
    },
    enabled: !!orgId && !!userId,
    staleTime: 60_000,
  });
}

export function useCreatePipelineSavedView() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  return useMutation({
    mutationFn: async (payload: { name: string; filters: PipelineFilters; is_default?: boolean }) => {
      if (!orgId || !userId) throw new Error('Sem organização');
      // If marking as default, clear previous default first
      if (payload.is_default) {
        await supabase
          .from('pipeline_saved_views')
          .update({ is_default: false })
          .eq('user_id', userId)
          .eq('organization_id', orgId);
      }
      const { data, error } = await supabase
        .from('pipeline_saved_views')
        .insert({
          user_id: userId,
          organization_id: orgId,
          name: payload.name,
          filters: payload.filters as any,
          is_default: payload.is_default ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PipelineSavedView;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-saved-views'] });
    },
  });
}

export function useSetDefaultPipelineView() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  return useMutation({
    mutationFn: async (viewId: string) => {
      if (!orgId || !userId) throw new Error('Sem organização');
      // Clear previous defaults
      await supabase
        .from('pipeline_saved_views')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('organization_id', orgId);
      // Set new default
      const { error } = await supabase
        .from('pipeline_saved_views')
        .update({ is_default: true })
        .eq('id', viewId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-saved-views'] });
    },
  });
}

export function useDeletePipelineSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_saved_views').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-saved-views'] });
    },
  });
}
