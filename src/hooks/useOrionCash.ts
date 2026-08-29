import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

// 1 OC = $0.10 USD de custo de API · 100 OC = $10
export const OC_PER_USD = 10; // 10 OC = $1 → 1 OC = $0.10

export function usdToOc(usd: number) { return usd * OC_PER_USD; }
export function ocToUsd(oc: number) { return oc / OC_PER_USD; }
export function fmtOc(oc: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(oc) + ' OC';
}

export interface CreditTransaction {
  id: string;
  organization_id: string;
  amount: number; // USD interno
  transaction_type: 'credit' | 'debit' | 'adjustment';
  credit_subtype: 'purchased' | 'bonus' | null; // null em débitos
  description: string | null;
  added_by_user_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export function useOrionCash() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  const query = useQuery({
    queryKey: ['orioncash', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as CreditTransaction[];
    },
    refetchInterval: 30_000,
  });

  const balance = (query.data || []).reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    transactions: query.data || [],
    balance,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useAddCredits() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ amount, description, credit_subtype }: { amount: number; description?: string; credit_subtype: 'purchased' | 'bonus' }) => {
      const { data, error } = await supabase.functions.invoke('admin-add-credits', {
        body: {
          organization_id: orgData?.organization.id,
          amount,
          description,
          credit_subtype,
        },
      });
      if (error) throw new Error(data?.error || error.message || 'Erro ao adicionar créditos');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orioncash'] });
    },
  });
}
