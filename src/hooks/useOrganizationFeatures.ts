import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type FeatureKey = 'financial';

export interface OrganizationFeature {
  id: string;
  organization_id: string;
  feature_key: string;
  is_enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
}

/** Para usuário comum: verifica se a feature está liberada para sua org */
export function useHasFeature(feature: FeatureKey) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['org-feature', orgId, feature],
    enabled: !!orgId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('organization_features')
        .select('is_enabled')
        .eq('organization_id', orgId!)
        .eq('feature_key', feature)
        .maybeSingle();
      if (error) throw error;
      return !!data?.is_enabled;
    },
  });
}

/** Super Admin: lista features de uma org específica */
export function useOrganizationFeatures(orgId: string | null) {
  return useQuery({
    queryKey: ['org-features', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrganizationFeature[]> => {
      const { data, error } = await supabase
        .from('organization_features')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data || []) as OrganizationFeature[];
    },
  });
}

/** Super Admin: ativar/desativar feature pra uma org */
export function useToggleFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { orgId: string; feature: FeatureKey; enabled: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('organization_features')
        .upsert(
          {
            organization_id: params.orgId,
            feature_key: params.feature,
            is_enabled: params.enabled,
            enabled_at: params.enabled ? new Date().toISOString() : null,
            enabled_by: params.enabled ? userData.user?.id : null,
          },
          { onConflict: 'organization_id,feature_key' },
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['org-features', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['org-feature'] });
      toast.success(vars.enabled ? 'Módulo ativado para a organização' : 'Módulo desativado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao alterar módulo'),
  });
}
