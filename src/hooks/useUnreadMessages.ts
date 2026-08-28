import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useUserPermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadMessages(channelFilter?: 'whatsapp' | 'instagram') {
  const { data: orgData } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const { user } = useAuth();
  const organizationId = orgData?.organization.id;
  const userId = user?.id;

  const { data: totalUnread = 0, refetch } = useQuery({
    queryKey: ['unread-messages-total', organizationId, memberRole, userId, isOwner, channelFilter ?? 'all'],
    queryFn: async () => {
      if (!organizationId) return 0;

      let query = supabase
        .from('contacts')
        .select('unread_count')
        .eq('organization_id', organizationId)
        .eq('status', 'open')
        .eq('is_archived', false)
        .gt('unread_count', 0)
        .not('last_message_at', 'is', null);

      if (channelFilter === 'instagram') {
        query = query.eq('channel', 'instagram');
      } else if (channelFilter === 'whatsapp') {
        query = query.or('channel.neq.instagram,channel.is.null');
      }

      // Viewer (Vendedor) can only see unread from contacts assigned to them
      if (!isOwner && memberRole === 'viewer' && userId) {
        query = query.eq('assigned_to', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).filter(c => (c.unread_count || 0) > 0).length;
    },
    enabled: !!organizationId && (isOwner || memberRole !== null),
  });

  // Global realtime: keep badge live regardless of which page the user is on.
  // The /chat page also updates this cache, but this hook runs from the sidebar
  // (mounted in AppLayout), so it works across the whole app.
  useEffect(() => {
    if (!organizationId) return;

    const matchesChannel = (channel: string | null | undefined) => {
      const isInstagram = channel === 'instagram';
      if (channelFilter === 'instagram') return isInstagram;
      if (channelFilter === 'whatsapp') return !isInstagram;
      return true;
    };

    const matchesAssignee = (assignedTo: string | null | undefined) => {
      if (isOwner || memberRole !== 'viewer') return true;
      return assignedTo === userId;
    };

    const channel = supabase
      .channel(`unread-badge-${channelFilter ?? 'all'}-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const oldData = payload.old as any;
          const newData = payload.new as any;
          if (!newData) return;

          if (!matchesChannel(newData.channel)) return;
          if (!matchesAssignee(newData.assigned_to)) return;

          // Only count contacts that are open + not archived + have last_message_at
          const wasEligible =
            oldData?.status === 'open' &&
            oldData?.is_archived === false &&
            oldData?.last_message_at != null;
          const isEligible =
            newData.status === 'open' &&
            newData.is_archived === false &&
            newData.last_message_at != null;

          const oldUnread = typeof oldData?.unread_count === 'number' ? oldData.unread_count : 0;
          const newUnread = typeof newData.unread_count === 'number' ? newData.unread_count : 0;

          const wasCounted = wasEligible && oldUnread > 0;
          const isCounted = isEligible && newUnread > 0;

          // Use refetch instead of delta to avoid permanent drift when Realtime
          // events are missed (connection drops, reconnects, late delivery).
          if (wasCounted !== isCounted) refetch();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (!newData) return;
          if (!matchesChannel(newData.channel)) return;
          if (!matchesAssignee(newData.assigned_to)) return;
          const isEligible =
            newData.status === 'open' &&
            newData.is_archived === false &&
            newData.last_message_at != null;
          if (isEligible && (newData.unread_count ?? 0) > 0) refetch();
        },
      )
      .subscribe();

    // Safety net: refetch when tab regains focus or network returns
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    const onOnline = () => refetch();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      supabase.removeChannel(channel);
    };
  }, [organizationId, memberRole, userId, isOwner, channelFilter, refetch]);

  return {
    totalUnread,
    refetch,
  };
}
