import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;

export interface ScheduledMessage {
  id: string;
  organization_id: string;
  contact_id: string;
  scheduled_by: string;
  message_content: string;
  scheduled_at: string;
  status: string;
  recurrence_rule: RecurrenceRule;
  recurrence_interval: number;
  recurrence_end_at: string | null;
  parent_schedule_id: string | null;
  sent_at: string | null;
  error_message: string | null;
}

export function useScheduledMessagesForContact(contactId: string | null | undefined) {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['scheduled-messages', organizationId, contactId],
    queryFn: async (): Promise<ScheduledMessage[]> => {
      if (!organizationId || !contactId) return [];
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('contact_id', contactId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!organizationId && !!contactId,
    staleTime: 15000,
  });
}

export interface ScheduledMessageInput {
  scheduled_at: string;
  message_content: string;
  recurrence_rule?: RecurrenceRule;
  recurrence_interval?: number;
  recurrence_end_at?: string | null;
}

export function useUpdateScheduledMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ScheduledMessageInput>) => {
      const { error } = await (supabase as any)
        .from('scheduled_messages')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-contacts'] });
      toast.success('Agendamento atualizado');
    },
    onError: (e: any) => toast.error(`Erro ao atualizar: ${e?.message || 'desconhecido'}`),
  });
}

export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-contacts'] });
      toast.success('Agendamento cancelado');
    },
    onError: (e: any) => toast.error(`Erro ao cancelar: ${e?.message || 'desconhecido'}`),
  });
}

export function recurrenceLabel(rule: RecurrenceRule, interval: number): string {
  if (!rule) return 'Não repete';
  const i = Math.max(1, interval || 1);
  const map: Record<Exclude<RecurrenceRule, null>, [string, string]> = {
    daily: ['dia', 'dias'],
    weekly: ['semana', 'semanas'],
    monthly: ['mês', 'meses'],
    yearly: ['ano', 'anos'],
  };
  const [s, p] = map[rule];
  return i === 1 ? `A cada ${s}` : `A cada ${i} ${p}`;
}
