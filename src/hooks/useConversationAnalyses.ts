import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ConversationAnalysis {
  id: string;
  analysis_date: string;
  customer_name: string;
  phone: string | null;
  lead_source: string | null;
  sale_status: string | null;
  product_line: string | null;
  part_searched: string | null;
  quantity: number | null;
  sale_value: number | null;
  created_at: string;
  created_by: string | null;
  contact_id: string | null;
  organization_id: string;
  is_corrected?: boolean | null;
  original_values?: Record<string, any> | null;
  correction_note?: string | null;
  corrected_by?: string | null;
  corrected_at?: string | null;
}

export function useConversationAnalyses(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversation-analyses', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('conversation_analyses')
        .select('*')
        .eq('organization_id', organizationId)
        .order('analysis_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ConversationAnalysis[];
    },
    enabled: !!organizationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('conversation_analyses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-analyses', organizationId] });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`analyses-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_analyses',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-analyses', organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  return {
    analyses: query.data ?? [],
    isLoading: query.isLoading,
    deleteAnalysis: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

export function useShareAnalysisToken(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['share-analysis-token', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('shared_analysis_views')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createToken = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No org');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('shared_analysis_views')
        .insert({ organization_id: organizationId, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-analysis-token', organizationId] });
    },
  });

  const deactivateToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shared_analysis_views')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-analysis-token', organizationId] });
    },
  });

  return {
    shareToken: query.data,
    isLoading: query.isLoading,
    createToken: createToken.mutate,
    deactivateToken: deactivateToken.mutate,
    isCreating: createToken.isPending,
  };
}
