import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import type { FormSubmission } from '@/types/forms';

const TABLE = 'form_submissions' as any;

export function useFormSubmissions(formId: string | null | undefined) {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  const query = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async (): Promise<FormSubmission[]> => {
      if (!formId) return [];
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  // Realtime
  useEffect(() => {
    if (!formId || !orgId) return;
    const channel = supabase
      .channel(`form-submissions-${formId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'form_submissions',
          filter: `form_id=eq.${formId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['form-submissions', formId] });
          qc.invalidateQueries({ queryKey: ['lead-forms', orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [formId, orgId, qc]);

  return query;
}
