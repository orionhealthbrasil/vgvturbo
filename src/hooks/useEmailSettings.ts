import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface EmailSettings {
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
  resend_reply_to: string | null;
}

export function useEmailSettings() {
  const { data: org } = useUserOrganization();
  const orgId = org?.organization?.id;

  return useQuery({
    queryKey: ['email-settings', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<EmailSettings | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .rpc('get_org_email_settings' as any, { p_org: orgId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? {
        resend_api_key: null,
        resend_from_email: null,
        resend_from_name: null,
        resend_reply_to: null,
      }) as EmailSettings;
    },
  });
}

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();
  const { data: org } = useUserOrganization();
  const orgId = org?.organization?.id;

  return useMutation({
    mutationFn: async (settings: Partial<EmailSettings>) => {
      if (!orgId) throw new Error('Organização não encontrada');
      const { error } = await supabase
        .from('organizations')
        .update({
          resend_api_key: settings.resend_api_key ?? null,
          resend_from_email: settings.resend_from_email ?? null,
          resend_from_name: settings.resend_from_name ?? null,
          resend_reply_to: settings.resend_reply_to ?? null,
        })
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings', orgId] });
      toast.success('Configurações de email salvas');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar configurações', { description: err.message });
    },
  });
}

export function useSendTestEmail() {
  const { data: org } = useUserOrganization();
  const orgId = org?.organization?.id;

  return useMutation({
    mutationFn: async (to: string) => {
      if (!orgId) throw new Error('Organização não encontrada');
      const { data, error } = await supabase.functions.invoke('send-resend-email', {
        body: { to, organization_id: orgId },
      });
      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data?.error_detail || data?.error || 'Falha no envio');
      }
      return data;
    },
  });
}
