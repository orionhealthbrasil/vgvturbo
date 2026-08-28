import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface ImportHistoryRecord {
  id: string;
  organization_id: string;
  imported_by: string;
  status: 'in_progress' | 'completed' | 'failed';
  total_contacts: number;
  imported_count: number;
  duplicates_count: number;
  failed_count: number;
  tags_applied: number;
  file_name: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  // Joined
  importer_name?: string | null;
}

export function useImportHistory() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['import-history', organizationId],
    queryFn: async (): Promise<ImportHistoryRecord[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .eq('organization_id', organizationId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch importer names
      const importerIds = [...new Set((data || []).map(d => d.imported_by).filter(Boolean))];
      let nameMap = new Map<string, string>();

      if (importerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', importerIds);

        if (profiles) {
          profiles.forEach(p => {
            if (p.user_id) nameMap.set(p.user_id, p.full_name || 'Usuário');
          });
        }
      }

      return (data || []).map(record => ({
        ...record,
        status: record.status as 'in_progress' | 'completed' | 'failed',
        importer_name: nameMap.get(record.imported_by) || 'Usuário',
      }));
    },
    enabled: !!organizationId,
    refetchInterval: 5000, // Poll every 5 seconds for ongoing imports
  });
}

export function useActiveImports() {
  const { data: history } = useImportHistory();
  
  return {
    activeImports: (history || []).filter(h => h.status === 'in_progress'),
    hasActiveImport: (history || []).some(h => h.status === 'in_progress'),
  };
}

export function useCreateImportRecord() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (data: {
      total_contacts: number;
      file_name?: string;
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user.id) throw new Error('No user');

      const { data: record, error } = await supabase
        .from('import_history')
        .insert({
          organization_id: orgData.organization.id,
          imported_by: session.session.user.id,
          total_contacts: data.total_contacts,
          file_name: data.file_name || null,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;
      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    },
  });
}

export function useUpdateImportRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      status?: 'in_progress' | 'completed' | 'failed';
      imported_count?: number;
      duplicates_count?: number;
      failed_count?: number;
      tags_applied?: number;
      completed_at?: string;
      error_message?: string;
    }) => {
      const { error } = await supabase
        .from('import_history')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    },
  });
}
