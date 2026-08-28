import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type PaymentPlatform = 'hotmart' | 'stripe' | 'kiwify' | 'eduzz' | 'monetizze' | 'generic';

export interface PaymentIntegration {
  id: string;
  organization_id: string;
  name: string;
  platform: PaymentPlatform;
  webhook_token: string;
  secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntegrationEvent {
  id: string;
  integration_id: string | null;
  organization_id: string;
  platform: string;
  purchase_event: string | null;
  contact_id: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  product_name: string | null;
  value: number | null;
  status: 'processed' | 'error' | 'rejected';
  error_message: string | null;
  raw_payload: unknown;
  created_at: string;
}

export function usePaymentIntegrations() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['payment-integrations', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<PaymentIntegration[]> => {
      const { data, error } = await supabase
        .from('payment_integrations')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as PaymentIntegration[];
    },
  });
}

export function useCreatePaymentIntegration() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: { name: string; platform: PaymentPlatform; secret?: string | null }) => {
      if (!orgId) throw new Error('No org');
      const { data, error } = await supabase
        .from('payment_integrations')
        .insert({ ...input, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as PaymentIntegration;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-integrations', orgId] });
      toast.success('Integração criada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar integração'),
  });
}

export function useUpdatePaymentIntegration() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PaymentIntegration> & { id: string }) => {
      const { data, error } = await supabase
        .from('payment_integrations')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as PaymentIntegration;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-integrations', orgId] });
      toast.success('Integração atualizada');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });
}

export function useDeletePaymentIntegration() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_integrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-integrations', orgId] });
      toast.success('Integração removida');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
  });
}

export function usePaymentIntegrationEvents(integrationId: string | null) {
  return useQuery({
    queryKey: ['payment-integration-events', integrationId],
    enabled: !!integrationId,
    queryFn: async (): Promise<PaymentIntegrationEvent[]> => {
      const { data, error } = await supabase
        .from('payment_integration_events')
        .select('*')
        .eq('integration_id', integrationId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as PaymentIntegrationEvent[];
    },
  });
}
