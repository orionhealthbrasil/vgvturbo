import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type {
  FinancialAccount,
  FinancialCategory,
  FinancialTransaction,
  FinancialRecurrence,
  TransactionType,
} from '@/types/financial';

// =================== ACCOUNTS ===================
export function useFinancialAccounts() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['fin-accounts', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<FinancialAccount[]> => {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .eq('organization_id', orgId!)
        .order('position');
      if (error) throw error;
      return (data || []) as FinancialAccount[];
    },
  });
}

export function useUpsertAccount() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  return useMutation({
    mutationFn: async (acc: Partial<FinancialAccount> & { id?: string }) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');
      if (acc.id) {
        const { error } = await supabase.from('financial_accounts').update(acc).eq('id', acc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_accounts').insert({
          ...acc,
          organization_id: orgId,
          name: acc.name || 'Nova conta',
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-accounts'] });
      toast.success('Conta salva');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar conta'),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-accounts'] });
      toast.success('Conta removida');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível remover (verifique lançamentos vinculados)'),
  });
}

// =================== CATEGORIES ===================
export function useFinancialCategories(type?: TransactionType) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['fin-categories', orgId, type ?? 'all'],
    enabled: !!orgId,
    queryFn: async (): Promise<FinancialCategory[]> => {
      let q = supabase
        .from('financial_categories')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .order('position');
      if (type) q = q.eq('category_type', type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FinancialCategory[];
    },
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  return useMutation({
    mutationFn: async (cat: Partial<FinancialCategory> & { id?: string }) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');
      if (cat.id) {
        const { error } = await supabase.from('financial_categories').update(cat).eq('id', cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_categories').insert({
          ...cat,
          organization_id: orgId,
          name: cat.name || 'Nova categoria',
          category_type: cat.category_type || 'expense',
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-categories'] });
      toast.success('Categoria salva');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar categoria'),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_categories').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-categories'] });
      toast.success('Categoria removida');
    },
  });
}

// =================== TRANSACTIONS ===================
export interface TxFilters {
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  status?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
}

export function useFinancialTransactions(filters: TxFilters = {}) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['fin-tx', orgId, filters],
    enabled: !!orgId,
    queryFn: async (): Promise<FinancialTransaction[]> => {
      let q = supabase
        .from('financial_transactions')
        .select(`
          *,
          account:financial_accounts!financial_transactions_account_id_fkey(name, color),
          category:financial_categories!financial_transactions_category_id_fkey(name, color, icon),
          contact:contacts!financial_transactions_contact_id_fkey(name)
        `)
        .eq('organization_id', orgId!)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.startDate) q = q.gte('transaction_date', filters.startDate);
      if (filters.endDate) q = q.lte('transaction_date', filters.endDate);
      if (filters.type) q = q.eq('transaction_type', filters.type);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.accountId) q = q.eq('account_id', filters.accountId);
      if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
      if (filters.search) q = q.ilike('description', `%${filters.search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any as FinancialTransaction[];
    },
  });
}

export function useUpsertTransaction() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  return useMutation({
    mutationFn: async (tx: Partial<FinancialTransaction> & { id?: string }) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');
      const { account, category, contact, ...payload } = tx as any;
      if (tx.id) {
        const { error } = await supabase.from('financial_transactions').update(payload).eq('id', tx.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from('financial_transactions').insert({
          ...payload,
          organization_id: orgId,
          created_by: userData.user?.id,
          source: payload.source || 'manual',
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-tx'] });
      qc.invalidateQueries({ queryKey: ['fin-summary'] });
      toast.success('Lançamento salvo');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar lançamento'),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-tx'] });
      qc.invalidateQueries({ queryKey: ['fin-summary'] });
      toast.success('Lançamento removido');
    },
  });
}

// =================== RECURRENCES ===================
export function useFinancialRecurrences() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['fin-recurrences', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<FinancialRecurrence[]> => {
      const { data, error } = await supabase
        .from('financial_recurrences')
        .select('*')
        .eq('organization_id', orgId!)
        .order('next_run_date');
      if (error) throw error;
      return (data || []) as FinancialRecurrence[];
    },
  });
}

export function useUpsertRecurrence() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  return useMutation({
    mutationFn: async (rec: Partial<FinancialRecurrence> & { id?: string }) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('Sem organização');
      if (rec.id) {
        const { error } = await supabase.from('financial_recurrences').update(rec).eq('id', rec.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from('financial_recurrences').insert({
          ...rec,
          organization_id: orgId,
          created_by: userData.user?.id,
          next_run_date: rec.next_run_date || rec.start_date,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-recurrences'] });
      toast.success('Recorrência salva');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar recorrência'),
  });
}

export function useDeleteRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_recurrences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-recurrences'] });
      toast.success('Recorrência removida');
    },
  });
}

// =================== SUMMARY (dashboard) ===================
export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingIncome: number;
  pendingExpense: number;
  byCategory: Array<{ name: string; color: string; type: TransactionType; total: number }>;
  byMonth: Array<{ month: string; income: number; expense: number }>;
  byAccount: Array<{ name: string; color: string; balance: number }>;
}

export function useFinancialSummary(startDate: string, endDate: string) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  return useQuery({
    queryKey: ['fin-summary', orgId, startDate, endDate],
    enabled: !!orgId,
    queryFn: async (): Promise<FinancialSummary> => {
      const { data: txs, error } = await supabase
        .from('financial_transactions')
        .select(`
          amount, transaction_type, status, transaction_date, account_id, category_id,
          account:financial_accounts!financial_transactions_account_id_fkey(name, color),
          category:financial_categories!financial_transactions_category_id_fkey(name, color, category_type)
        `)
        .eq('organization_id', orgId!)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      if (error) throw error;

      const { data: accs } = await supabase
        .from('financial_accounts')
        .select('id, name, color, initial_balance')
        .eq('organization_id', orgId!)
        .eq('is_active', true);

      let totalIncome = 0;
      let totalExpense = 0;
      let pendingIncome = 0;
      let pendingExpense = 0;
      const catMap = new Map<string, { name: string; color: string; type: TransactionType; total: number }>();
      const monthMap = new Map<string, { income: number; expense: number }>();
      const accBalance = new Map<string, number>();
      (accs || []).forEach((a: any) => accBalance.set(a.id, Number(a.initial_balance) || 0));

      (txs || []).forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        const isIncome = t.transaction_type === 'income';
        if (t.status === 'paid') {
          if (isIncome) totalIncome += amt;
          else totalExpense += amt;
          // account balance: only paid impacts
          const cur = accBalance.get(t.account_id) || 0;
          accBalance.set(t.account_id, cur + (isIncome ? amt : -amt));
        } else if (t.status === 'pending' || t.status === 'overdue') {
          if (isIncome) pendingIncome += amt;
          else pendingExpense += amt;
        }

        // by category
        if (t.category && t.status === 'paid') {
          const key = t.category.name;
          const ex = catMap.get(key);
          if (ex) ex.total += amt;
          else
            catMap.set(key, {
              name: t.category.name,
              color: t.category.color,
              type: t.transaction_type,
              total: amt,
            });
        }

        // by month
        if (t.status === 'paid') {
          const m = (t.transaction_date as string).slice(0, 7);
          const ex = monthMap.get(m) || { income: 0, expense: 0 };
          if (isIncome) ex.income += amt;
          else ex.expense += amt;
          monthMap.set(m, ex);
        }
      });

      return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        pendingIncome,
        pendingExpense,
        byCategory: Array.from(catMap.values()).sort((a, b) => b.total - a.total),
        byMonth: Array.from(monthMap.entries())
          .map(([month, v]) => ({ month, ...v }))
          .sort((a, b) => a.month.localeCompare(b.month)),
        byAccount: (accs || []).map((a: any) => ({
          name: a.name,
          color: a.color,
          balance: accBalance.get(a.id) || 0,
        })),
      };
    },
  });
}
