import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface SupportTicket {
  id: string;
  organization_id: string;
  subject: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  organization_name?: string;
  last_message_at?: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  message_type: string;
  created_at: string;
  sender?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const MSG_PAGE_SIZE = 50;

export function useSupportTickets() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;

  return useQuery({
    queryKey: ['support-tickets', orgId],
    queryFn: async (): Promise<SupportTicket[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
    enabled: !!orgId && !!user,
  });
}

export function useAllSupportTickets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-tickets-all'],
    queryFn: async (): Promise<SupportTicket[]> => {
      // Get all tickets (super admin RLS allows this)
      const { data: tickets, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      if (!tickets?.length) return [];

      // Get org names
      const orgIds = [...new Set(tickets.map(t => t.organization_id))];
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

      return tickets.map(t => ({
        ...t,
        organization_name: orgMap.get(t.organization_id) || 'Desconhecida',
      })) as SupportTicket[];
    },
    enabled: !!user,
  });
}

export function useSupportMessages(ticketId: string | null) {
  return useInfiniteQuery({
    queryKey: ['support-messages', ticketId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!ticketId) return { messages: [], nextPage: null };
      const from = pageParam * MSG_PAGE_SIZE;
      const to = from + MSG_PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      const messages = (data || []) as SupportMessage[];

      // Fetch sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', senderIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        messages.forEach(m => {
          const profile = profileMap.get(m.sender_id);
          if (profile) {
            m.sender = { full_name: profile.full_name, avatar_url: profile.avatar_url };
          }
        });
      }

      return {
        messages: messages.reverse(),
        nextPage: messages.length === MSG_PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ subject, firstMessage }: { subject: string; firstMessage: string }) => {
      const orgId = orgData?.organization?.id;
      if (!orgId || !user) throw new Error('Missing org or user');

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({ organization_id: orgId, subject, created_by: user.id })
        .select()
        .single();
      if (ticketError) throw ticketError;

      const { error: msgError } = await supabase
        .from('support_messages')
        .insert({ ticket_id: ticket.id, sender_id: user.id, content: firstMessage });
      if (msgError) throw msgError;

      // Fire-and-forget email notification to the agency
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', user.id)
          .maybeSingle();

        const notifyPayload = {
          event: 'new_ticket' as const,
          ticket_id: ticket.id,
          subject,
          first_message: firstMessage,
          organization_name: orgData?.organization?.name || null,
          created_by_name: profile?.full_name || null,
          created_by_email: profile?.email || user.email || null,
        };
        console.log('[notify-support-ticket] invoking new_ticket', notifyPayload);
        const { data: notifyData, error: notifyError } = await supabase.functions.invoke(
          'notify-support-ticket',
          { body: notifyPayload },
        );
        if (notifyError) {
          console.error('[notify-support-ticket] invoke error (new_ticket):', notifyError);
        } else if (notifyData && (notifyData as { ok?: boolean; error?: string }).ok === false) {
          console.error('[notify-support-ticket] function returned error (new_ticket):', notifyData);
        } else {
          console.log('[notify-support-ticket] success (new_ticket):', notifyData);
        }
      } catch (notifyErr) {
        // Don't block ticket creation if email fails
        console.warn('[notify-support-ticket] exception (new_ticket):', notifyErr);
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

const SUPER_ADMIN_EMAIL = 'agenciaorion2560@gmail.com';

export function useSendSupportMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({
      ticketId,
      content,
      mediaUrl,
      messageType = 'text',
    }: {
      ticketId: string;
      content?: string;
      mediaUrl?: string;
      messageType?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          content: content || null,
          media_url: mediaUrl || null,
          message_type: messageType,
        });
      if (error) throw error;

      // Update ticket updated_at
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      // Fire-and-forget email to agency, only if sender is NOT the super admin
      if (user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
        try {
          const [{ data: ticket }, { data: profile }] = await Promise.all([
            supabase
              .from('support_tickets')
              .select('subject, organization_id')
              .eq('id', ticketId)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', user.id)
              .maybeSingle(),
          ]);

          if (ticket) {
            const notifyPayload = {
              event: 'new_message' as const,
              ticket_id: ticketId,
              subject: ticket.subject,
              message_content: content || null,
              message_type: messageType,
              organization_name: orgData?.organization?.name || null,
              sender_name: profile?.full_name || null,
              sender_email: profile?.email || user.email || null,
            };
            console.log('[notify-support-ticket] invoking new_message', notifyPayload);
            const { data: notifyData, error: notifyError } = await supabase.functions.invoke(
              'notify-support-ticket',
              { body: notifyPayload },
            );
            if (notifyError) {
              console.error('[notify-support-ticket] invoke error (new_message):', notifyError);
            } else if (notifyData && (notifyData as { ok?: boolean; error?: string }).ok === false) {
              console.error('[notify-support-ticket] function returned error (new_message):', notifyData);
            } else {
              console.log('[notify-support-ticket] success (new_message):', notifyData);
            }
          }
        } catch (notifyErr) {
          console.warn('[notify-support-ticket] exception (new_message):', notifyErr);
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', vars.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

export function useResolveTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-all'] });
    },
  });
}

export function useReopenTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'open', resolved_at: null })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-all'] });
    },
  });
}

export async function uploadSupportMedia(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('support-media').upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('support-media').getPublicUrl(path);
  return urlData.publicUrl;
}
