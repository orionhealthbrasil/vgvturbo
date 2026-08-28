import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface SlaNotification {
  id: string;
  organization_id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  agent_name: string | null;
  assigned_to: string | null;
  wait_time_minutes: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useSlaNotifications() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['sla-notifications', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sla_notifications')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as SlaNotification[];
    },
    enabled: !!orgId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel('sla-notifications-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sla_notifications',
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['sla-notifications', orgId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('sla_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-notifications', orgId] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sla_notifications')
        .update({ is_read: true })
        .eq('organization_id', orgId!)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-notifications', orgId] });
    },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
