import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface BroadcastCampaign {
  id: string;
  organization_id: string;
  name: string;
  message_content: string;
  media_url: string | null;
  media_type: string | null;
  min_interval_seconds: number;
  max_interval_seconds: number;
  batch_size: number;
  batch_pause_min_seconds: number;
  batch_pause_max_seconds: number;
  messages_per_hour_limit: number;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  current_batch: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_send_at: string | null;
  paused_until: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BroadcastRecipient {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  phone: string;
  name: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  error_message: string | null;
  message_id: string | null;
  position: number;
  created_at: string;
}

export function useBroadcastCampaigns() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['broadcast-campaigns', orgData?.organization?.id],
    queryFn: async (): Promise<BroadcastCampaign[]> => {
      if (!orgData?.organization?.id) return [];

      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('organization_id', orgData.organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BroadcastCampaign[];
    },
    enabled: !!orgData?.organization?.id,
  });
}

export function useBroadcastRecipients(campaignId: string | null) {
  return useQuery({
    queryKey: ['broadcast-recipients', campaignId],
    queryFn: async (): Promise<BroadcastRecipient[]> => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('broadcast_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as BroadcastRecipient[];
    },
    enabled: !!campaignId,
  });
}

export function useCreateBroadcastCampaign() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (campaign: Partial<BroadcastCampaign>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !orgData?.organization?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .insert({
          name: campaign.name || 'Nova Campanha',
          message_content: campaign.message_content || '',
          media_url: campaign.media_url,
          media_type: campaign.media_type,
          min_interval_seconds: campaign.min_interval_seconds || 300,
          max_interval_seconds: campaign.max_interval_seconds || 900,
          batch_size: campaign.batch_size || 20,
          batch_pause_min_seconds: campaign.batch_pause_min_seconds || 300,
          batch_pause_max_seconds: campaign.batch_pause_max_seconds || 600,
          messages_per_hour_limit: campaign.messages_per_hour_limit || 30,
          organization_id: orgData.organization.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BroadcastCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha criada com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar campanha: ' + error.message);
    },
  });
}

export function useUpdateBroadcastCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BroadcastCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BroadcastCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
    },
  });
}

export function useDeleteBroadcastCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('broadcast_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha excluída');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir campanha: ' + error.message);
    },
  });
}

export function useAddBroadcastRecipients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      campaignId, 
      recipients 
    }: { 
      campaignId: string; 
      recipients: { phone: string; name?: string; contact_id?: string }[] 
    }) => {
      // Get current max position
      const { data: existingRecipients } = await supabase
        .from('broadcast_recipients')
        .select('position')
        .eq('campaign_id', campaignId)
        .order('position', { ascending: false })
        .limit(1);

      let startPosition = (existingRecipients?.[0]?.position ?? -1) + 1;

      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize).map((r, idx) => ({
          campaign_id: campaignId,
          phone: r.phone,
          name: r.name || null,
          contact_id: r.contact_id || null,
          position: startPosition + i + idx,
        }));

        const { error } = await supabase
          .from('broadcast_recipients')
          .insert(batch);

        if (error) throw error;
      }

      // Update total contacts count
      const { count } = await supabase
        .from('broadcast_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      await supabase
        .from('broadcast_campaigns')
        .update({ total_contacts: count || 0 })
        .eq('id', campaignId);

      return recipients.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-recipients'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success(`${count} contatos adicionados`);
    },
    onError: (error: any) => {
      toast.error('Erro ao adicionar contatos: ' + error.message);
    },
  });
}

export function useClearBroadcastRecipients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('broadcast_recipients')
        .delete()
        .eq('campaign_id', campaignId);

      if (error) throw error;

      await supabase
        .from('broadcast_campaigns')
        .update({ total_contacts: 0, sent_count: 0, failed_count: 0 })
        .eq('id', campaignId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-recipients'] });
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Contatos removidos');
    },
  });
}

export function useStartBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('process-broadcast', {
        body: { campaignId, action: 'start' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Disparo iniciado');
    },
    onError: (error: any) => {
      toast.error('Erro ao iniciar disparo: ' + error.message);
    },
  });
}

export function usePauseBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('broadcast_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Disparo pausado');
    },
  });
}

export function useCancelBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('broadcast_campaigns')
        .update({ status: 'cancelled' })
        .eq('id', campaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Disparo cancelado');
    },
  });
}
