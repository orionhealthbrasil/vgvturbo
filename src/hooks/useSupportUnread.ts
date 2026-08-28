import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';

export function useSupportUnread() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['support-unread', orgId, user?.id],
    queryFn: async () => {
      if (!orgId || !user?.id) return 0;
      // Get all open tickets for this org
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'open');
      if (!tickets || tickets.length === 0) return 0;
      const ticketIds = tickets.map(t => t.id);
      // Count tickets whose latest message was sent by someone other than current user
      const { data: messages } = await supabase
        .from('support_messages')
        .select('ticket_id, sender_id, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false });
      if (!messages) return 0;
      const lastByTicket = new Map<string, string>();
      for (const m of messages) {
        if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m.sender_id);
      }
      let count = 0;
      lastByTicket.forEach((senderId) => { if (senderId !== user.id) count++; });
      return count;
    },
    enabled: !!orgId && !!user,
  });

  // Listen for new support messages
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('support-messages-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        (payload) => {
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            queryClient.invalidateQueries({ queryKey: ['support-unread'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-all'] });
            queryClient.invalidateQueries({ queryKey: ['support-messages'] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return { unreadCount };
}

export function useSuperAdminSupportUnread() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['support-unread-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('status', 'open');
      if (!tickets || tickets.length === 0) return 0;
      const ticketIds = tickets.map(t => t.id);
      const { data: messages } = await supabase
        .from('support_messages')
        .select('ticket_id, sender_id, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false });
      if (!messages) return 0;
      const lastByTicket = new Map<string, string>();
      for (const m of messages) {
        if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m.sender_id);
      }
      let count = 0;
      lastByTicket.forEach((senderId) => { if (senderId !== user.id) count++; });
      return count;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('support-messages-admin-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        (payload) => {
          if (payload.new && (payload.new as any).sender_id !== user.id) {
            queryClient.invalidateQueries({ queryKey: ['support-unread-admin'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-all'] });
            queryClient.invalidateQueries({ queryKey: ['support-messages'] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return { unreadCount };
}
