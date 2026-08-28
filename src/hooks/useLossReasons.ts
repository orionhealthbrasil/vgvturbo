import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export interface LossReason {
  id: string;
  organization_id: string;
  label: string;
  color: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useLossReasons(opts?: { activeOnly?: boolean }) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['loss-reasons', orgId, opts?.activeOnly ?? false],
    queryFn: async () => {
      if (!orgId) return [] as LossReason[];
      let q = supabase
        .from('loss_reasons' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (opts?.activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LossReason[];
    },
    enabled: !!orgId,
  });
}

export function useCreateLossReason() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (payload: { label: string; color?: string | null }) => {
      if (!orgId) throw new Error('Sem organização');
      const { data: existing } = await supabase
        .from('loss_reasons' as any)
        .select('position')
        .eq('organization_id', orgId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = ((existing as any)?.position ?? -1) + 1;

      const { data, error } = await supabase
        .from('loss_reasons' as any)
        .insert({
          organization_id: orgId,
          label: payload.label.trim(),
          color: payload.color ?? null,
          position: nextPos,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loss-reasons'] });
    },
  });
}

export function useUpdateLossReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; label?: string; color?: string | null; is_active?: boolean; position?: number }) => {
      const { id, ...rest } = payload;
      const { data, error } = await supabase
        .from('loss_reasons' as any)
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loss-reasons'] }),
  });
}

export function useDeleteLossReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loss_reasons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loss-reasons'] }),
  });
}
