import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SnoozeResult {
  snoozedUntil: Date;
  formattedDate: string;
}

export function useSnoozeContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string): Promise<SnoozeResult> => {
      // First, get the contact's organization
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('organization_id')
        .eq('id', contactId)
        .single();

      if (contactError || !contact) {
        throw new Error('Contato não encontrado');
      }

      // Call the database function to get next open slot
      const { data: nextOpenSlot, error: funcError } = await supabase
        .rpc('get_next_open_slot', { p_organization_id: contact.organization_id });

      if (funcError) {
        console.error('Error calling get_next_open_slot:', funcError);
        throw new Error('Erro ao calcular próxima abertura');
      }

      const snoozedUntil = new Date(nextOpenSlot);

      // Update the contact
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          snoozed_until: snoozedUntil.toISOString(),
          status: 'snoozed',
        })
        .eq('id', contactId);

      if (updateError) {
        throw new Error('Erro ao adiar atendimento');
      }

      // Format the date for display
      const formattedDate = format(
        snoozedUntil,
        "EEEE 'às' HH:mm",
        { locale: ptBR }
      );

      return { snoozedUntil, formattedDate };
    },
    onSuccess: (result, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success(`Agendado para ${result.formattedDate}, quando a loja abrir.`, {
        icon: '💤',
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adiar atendimento');
    },
  });
}

export function useUnsnoozeContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({
          snoozed_until: null,
          status: 'open',
        })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Atendimento reativado!');
    },
    onError: () => {
      toast.error('Erro ao reativar atendimento');
    },
  });
}
