import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export interface WinReason {
  id: string;
  organization_id: string;
  label: string;
  color: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWinReasons(opts?: { activeOnly?: boolean }) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['win-reasons', orgId, opts?.activeOnly ?? false],
    queryFn: async () => {
      if (!orgId) return [] as WinReason[];
      let q = supabase
        .from('win_reasons' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (opts?.activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as WinReason[];
    },
    enabled: !!orgId,
  });
}

export function useCreateWinReason() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (payload: { label: string; color?: string | null }) => {
      if (!orgId) throw new Error('Sem organização');
      const { data: existing } = await supabase
        .from('win_reasons' as any)
        .select('position')
        .eq('organization_id', orgId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = ((existing as any)?.position ?? -1) + 1;

      const { data, error } = await supabase
        .from('win_reasons' as any)
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
      qc.invalidateQueries({ queryKey: ['win-reasons'] });
    },
  });
}

export function useUpdateWinReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; label?: string; color?: string | null; is_active?: boolean; position?: number }) => {
      const { id, ...rest } = payload;
      const { data, error } = await supabase
        .from('win_reasons' as any)
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['win-reasons'] }),
  });
}

export function useDeleteWinReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('win_reasons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['win-reasons'] }),
  });
}

export const DEFAULT_WIN_QUESTION = 'O que ajudou a fechar essa venda?';
export const DEFAULT_LOSS_QUESTION = 'Por que esse negócio não fechou?';

export function useOutcomeQuestions() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['outcome-questions', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      if (!orgId) return { win: DEFAULT_WIN_QUESTION, loss: DEFAULT_LOSS_QUESTION };
      const { data, error } = await supabase
        .from('organizations')
        .select('win_reason_question, loss_reason_question' as any)
        .eq('id', orgId)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? {}) as any;
      return {
        win: (row.win_reason_question?.trim?.() || DEFAULT_WIN_QUESTION) as string,
        loss: (row.loss_reason_question?.trim?.() || DEFAULT_LOSS_QUESTION) as string,
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async (patch: { win?: string | null; loss?: string | null }) => {
      if (!orgId) throw new Error('Sem organização');
      const updates: Record<string, any> = {};
      if (patch.win !== undefined) updates.win_reason_question = patch.win;
      if (patch.loss !== undefined) updates.loss_reason_question = patch.loss;
      const { error } = await supabase
        .from('organizations')
        .update(updates as any)
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outcome-questions', orgId] }),
  });

  return { ...query, save: mutation };
}
