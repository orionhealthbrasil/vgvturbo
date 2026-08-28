import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CurationExample {
  id: string;
  organization_id: string;
  analysis_id: string | null;
  contact_id: string | null;
  conversation_excerpt: string | null;
  wrong_values: Record<string, any> | null;
  correct_values: Record<string, any>;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CurationRules {
  id: string;
  organization_id: string;
  rules_text: string;
  updated_at: string;
}

export function useCurationRules(orgId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['analysis-curation-rules', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('analysis_curation_rules')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data as CurationRules | null;
    },
    enabled: !!orgId,
  });

  const save = useMutation({
    mutationFn: async (rules_text: string) => {
      if (!orgId) throw new Error('No org');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from('analysis_curation_rules')
          .update({ rules_text, updated_by: user.id })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('analysis_curation_rules')
          .insert({ organization_id: orgId, rules_text, updated_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analysis-curation-rules', orgId] }),
  });

  return { rules: query.data, isLoading: query.isLoading, saveRules: save.mutateAsync, isSaving: save.isPending };
}

export function useCurationExamples(orgId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['analysis-curation-examples', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('analysis_curation_examples')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as CurationExample[];
    },
    enabled: !!orgId,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('analysis_curation_examples').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analysis-curation-examples', orgId] }),
  });

  return { examples: query.data ?? [], isLoading: query.isLoading, removeExample: remove.mutate };
}
