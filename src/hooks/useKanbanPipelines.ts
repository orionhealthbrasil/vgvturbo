import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';

export interface KanbanPipeline {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export function useKanbanPipelines() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['kanban-pipelines', organizationId],
    queryFn: async (): Promise<KanbanPipeline[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('kanban_pipelines')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanPipeline[];
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}

/**
 * Hook to fetch the user's preferred default pipeline for the current org.
 * Returns the pipeline_id if set, otherwise null.
 */
export function useUserDefaultPipelinePreference() {
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();
  const organizationId = orgData?.organization.id;
  const userId = user?.id;

  return useQuery({
    queryKey: ['user-pipeline-preference', organizationId, userId],
    queryFn: async (): Promise<string | null> => {
      if (!organizationId || !userId) return null;
      const { data, error } = await supabase
        .from('user_pipeline_preferences')
        .select('default_pipeline_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.default_pipeline_id ?? null;
    },
    enabled: !!organizationId && !!userId,
    staleTime: 60_000,
  });
}

/**
 * Upsert the user's default pipeline preference.
 */
export function useSetUserDefaultPipelinePreference() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();
  const organizationId = orgData?.organization.id;
  const userId = user?.id;

  return useMutation({
    mutationFn: async (pipelineId: string) => {
      if (!organizationId || !userId) throw new Error('Sem organização ou usuário');
      // Try update first, then insert if no row exists
      const { error: updErr } = await supabase
        .from('user_pipeline_preferences')
        .update({ default_pipeline_id: pipelineId })
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (updErr) throw updErr;

      // Upsert doesn't work well with auth RLS sometimes, so explicit insert on conflict
      // Check if row exists
      const { data: existing } = await supabase
        .from('user_pipeline_preferences')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabase
          .from('user_pipeline_preferences')
          .insert({
            organization_id: organizationId,
            user_id: userId,
            default_pipeline_id: pipelineId,
          });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-pipeline-preference'] });
    },
  });
}

/**
 * Creates a new sales pipeline AND seeds the 3 default funnel stages
 * (Triagem / Negociação / Fechamento) so the user can start using it
 * immediately.
 */
export function useCreatePipeline() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string | null }) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');

      const { data: pipeline, error } = await supabase
        .from('kanban_pipelines')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          description: description?.trim() || null,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;

      // Seed default stages
      const ts = Date.now();
      const { error: stagesErr } = await supabase.from('funnel_stages').insert([
        { organization_id: orgId, pipeline_id: pipeline.id, name: 'Triagem', slug: `lead_${ts}`, color: '#6366f1', position: 0, is_final: false, stage_type: 'in_progress' },
        { organization_id: orgId, pipeline_id: pipeline.id, name: 'Negociação', slug: `negotiation_${ts}`, color: '#f59e0b', cta_text: 'Orçamento Enviado', position: 1, is_final: false, stage_type: 'in_progress' },
        { organization_id: orgId, pipeline_id: pipeline.id, name: 'Fechamento', slug: `closed_${ts}`, color: '#22c55e', cta_text: 'Finalizar Venda', position: 2, is_final: true, stage_type: 'won' },
      ] as any);
      if (stagesErr) throw stagesErr;

      return pipeline as KanbanPipeline;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban-pipelines'] });
      qc.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
  });
}

export function useUpdatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string | null }) => {
      const { error } = await supabase.from('kanban_pipelines').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-pipelines'] }),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');

      // Find another pipeline (preferably default) to move contacts to
      const { data: others } = await supabase
        .from('kanban_pipelines')
        .select('id, is_default')
        .eq('organization_id', orgId)
        .neq('id', id)
        .order('is_default', { ascending: false });
      const target = others?.[0];
      if (!target) throw new Error('Não é possível excluir o único funil');

      // Find first stage of target pipeline to assign contacts to
      const { data: targetStages } = await supabase
        .from('funnel_stages')
        .select('slug')
        .eq('pipeline_id', target.id)
        .order('position', { ascending: true })
        .limit(1);
      const targetSlug = targetStages?.[0]?.slug || 'lead';

      // Reassign contacts of the deleted pipeline
      await supabase
        .from('contacts')
        .update({ pipeline_id: target.id, funnel_stage: targetSlug })
        .eq('organization_id', orgId)
        .eq('pipeline_id', id);

      const { error } = await supabase.from('kanban_pipelines').delete().eq('id', id);
      if (error) throw error;
      return target.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban-pipelines'] });
      qc.invalidateQueries({ queryKey: ['funnel-stages'] });
      qc.invalidateQueries({ queryKey: ['pipeline-contacts'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useSetDefaultPipeline() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const setUserPref = useSetUserDefaultPipelinePreference();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');
      // Unset previous default first to respect partial unique index
      await supabase
        .from('kanban_pipelines')
        .update({ is_default: false })
        .eq('organization_id', orgId)
        .eq('is_default', true);
      const { error } = await supabase
        .from('kanban_pipelines')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
      // Also persist as user preference so it loads for this user
      await setUserPref.mutateAsync(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban-pipelines'] }),
  });
}
