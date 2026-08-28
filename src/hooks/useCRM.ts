import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useUserPermissions } from '@/hooks/usePermissions';
import { KanbanColumn, Contact, ContactWithColumn, Message } from '@/types/crm';

/** Invoca uma edge function com retry automático em caso de JWT expirado (403/401). */
async function invokeWithAuthRetry(fnName: string, body: Record<string, unknown>) {
  let { data, error } = await supabase.functions.invoke(fnName, { body });

  const isAuthError = (e: any, d: any) =>
    (e && (e.message?.includes('401') || e.message?.includes('403') ||
      e.message?.toLowerCase().includes('auth') || e.message?.toLowerCase().includes('jwt'))) ||
    (d?.error && (
      String(d.error).toLowerCase().includes('token') ||
      String(d.error).toLowerCase().includes('jwt') ||
      String(d.error).toLowerCase().includes('auth') ||
      String(d.error).toLowerCase().includes('expired') ||
      String(d.error).toLowerCase().includes('unauthorized')
    ));

  if (isAuthError(error, data)) {
    await supabase.auth.refreshSession();
    const retry = await supabase.functions.invoke(fnName, { body });
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Detecta o provedor WhatsApp configurado para a organização.
// 'meta' = API Oficial Meta; 'stevo' = provedor não-oficial (default).
export function useWhatsAppProvider() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['whatsapp-provider', organizationId],
    queryFn: async (): Promise<'meta' | 'stevo'> => {
      if (!organizationId) return 'stevo';
      const { data } = await supabase
        .from('whatsapp_meta_instances')
        .select('id, access_token, phone_number_id, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle();
      if (data?.access_token && data?.phone_number_id) return 'meta';
      return 'stevo';
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}

async function resolveWhatsAppProvider(organizationId: string): Promise<'meta' | 'stevo'> {
  const { data } = await supabase
    .from('whatsapp_meta_instances')
    .select('id, access_token, phone_number_id, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();
  if (data?.access_token && data?.phone_number_id) return 'meta';
  return 'stevo';
}

// Kanban Columns
export function useKanbanColumns() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['kanban-columns', organizationId],
    queryFn: async (): Promise<KanbanColumn[]> => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as KanbanColumn[];
    },
    enabled: !!organizationId,
  });
}

export function useUpdateKanbanColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KanbanColumn> & { id: string }) => {
      const { error } = await supabase
        .from('kanban_columns')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns'] });
    },
  });
}

// Contacts
export function useContacts() {
  const { data: orgData, isLoading: isOrgLoading } = useUserOrganization();
  const { role: memberRole, isOwner } = useUserPermissions();
  const organizationId = orgData?.organization.id;
  const userId = orgData?.membership.user_id;

  // Wait for permission data to be ready for viewers
  const isReady = !!organizationId && (isOwner || memberRole !== null);

  return useQuery({
    queryKey: ['contacts', organizationId, memberRole, userId, isOwner],
    queryFn: async (): Promise<ContactWithColumn[]> => {
      if (!organizationId) return [];
      
      // Build query based on user role
      let query = supabase
        .from('contacts')
        .select(`
          *,
          kanban_columns (*)
        `)
        .eq('organization_id', organizationId);

      // Viewer (Vendedor) can only see:
      // 1. Contacts assigned to them
      // 2. Contacts with "colaboradores" or "fornecedores" tags (shared contacts)
      if (!isOwner && memberRole === 'viewer' && userId) {
        // Find special shared tags
        const { data: allTags } = await supabase
          .from('tags')
          .select('id, name')
          .eq('organization_id', organizationId);
        
        const specialTagIds = (allTags || [])
          .filter(t => 
            t.name.toLowerCase() === 'colaboradores' || 
            t.name.toLowerCase() === 'fornecedores'
          )
          .map(t => t.id);
        
        if (specialTagIds.length > 0) {
          // Find contacts with special tags
          const { data: taggedContacts } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', specialTagIds);
          
          const specialContactIds = [...new Set((taggedContacts || []).map(ct => ct.contact_id))];
          
          if (specialContactIds.length > 0) {
            // Filter: assigned to user OR has special tag
            const orFilter = `assigned_to.eq.${userId},id.in.(${specialContactIds.join(',')})`;
            query = query.or(orFilter);
          } else {
            query = query.eq('assigned_to', userId);
          }
        } else {
          query = query.eq('assigned_to', userId);
        }
      }

      const { data: contactsData, error: contactsError } = await query
        .order('last_message_at', { ascending: false });

      if (contactsError) throw contactsError;
      
      if (contactsData.length === 0) return [];

      // For large contact lists, skip fetching last messages to avoid performance issues
      // The last message preview is a nice-to-have, not critical
      const MAX_CONTACTS_FOR_MESSAGE_FETCH = 200;
      
      let lastMessageMap = new Map<string, any>();
      
      if (contactsData.length <= MAX_CONTACTS_FOR_MESSAGE_FETCH) {
        // Only fetch last messages for smaller datasets
        const contactIds = contactsData.map(c => c.id);
        
        // Get the last message for each contact using a single query
        const { data: lastMessages, error: messagesError } = await supabase
          .from('messages')
          .select('contact_id, content, message_type, direction, created_at')
          .in('contact_id', contactIds)
          .order('created_at', { ascending: false })
          .limit(2000); // Explicit limit to avoid hitting defaults

        if (!messagesError && lastMessages) {
          // Create a map of contact_id -> last message (first occurrence due to ordering)
          for (const msg of lastMessages) {
            if (!lastMessageMap.has(msg.contact_id)) {
              lastMessageMap.set(msg.contact_id, msg);
            }
          }
        }
      }

      // Merge contacts with their last message (if available)
      // Cast through unknown because DB has status/closed_at but types.ts may not be updated yet
      return contactsData.map(contact => ({
        ...(contact as unknown as Record<string, unknown>),
        last_message: lastMessageMap.get(contact.id) || null,
      })) as unknown as ContactWithColumn[];
    },
    enabled: isReady,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (contact: { name: string; phone: string } & Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'unread_count' | 'status' | 'closed_at'>>) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contact,
          organization_id: orgData.organization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      // Ensure JWT is fresh — expired sessions cause silent RLS failures (0 rows updated, no error)
      await supabase.auth.getSession();

      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Não foi possível atualizar o contato (sem linhas afetadas). Recarregue a página e tente novamente.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-counts'] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useArchiveContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_archived }: { id: string; is_archived: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ is_archived })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['archived-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-counts'] });
    },
  });
}

// Close/Finalize a contact (ticket)
export function useCloseContact() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ contactId, phone }: { contactId: string; phone: string }) => {
      const organizationId = orgData?.organization.id;
      if (!organizationId) throw new Error('No organization');

      // NOTE: Farewell message removed to allow user to audit conversation before any automatic message is sent

      // Update contact status to closed
      const { error } = await supabase
        .from('contacts')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        } as any)
        .eq('id', contactId);

      if (error) throw error;

      // Trigger the audit-conversation edge function
      // Fire and forget - don't wait for completion
      supabase.functions.invoke('audit-conversation', {
        body: {
          contact_id: contactId,
          organization_id: organizationId,
        },
      }).then(({ error: auditError }) => {
        if (auditError) {
          console.error('Audit error:', auditError);
        } else {
          console.log('Audit started successfully');
        }
      });

      // Trigger conversation_closed automations
      supabase.functions.invoke('automation-engine', {
        body: {
          contact_id: contactId,
          organization_id: organizationId,
          event_type: 'conversation_closed',
        },
      }).catch((err: unknown) => {
        console.error('Automation engine error on conversation_closed:', err);
      });

      return { contactId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-counts'] });
    },
  });
}

// Reopen a closed contact
export function useReopenContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({
          status: 'open',
          closed_at: null,
        } as any)
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Messages
export function useMessages(contactId: string | null) {
  return useQuery({
    queryKey: ['messages', contactId],
    queryFn: async (): Promise<Message[]> => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('messages')
        // Avoid embedded join; fetch sender names via profiles in a second query.
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = (data || []) as any[];
      const senderIds = Array.from(
        new Set(rows.map((m) => m.sent_by_user_id).filter(Boolean))
      ) as string[];

      let nameByUserId = new Map<string, string>();
      if (senderIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', senderIds);

        if (!profilesError) {
          for (const p of profiles || []) {
            if (p.user_id) nameByUserId.set(p.user_id, p.full_name || '');
          }
        }
      }

      // Fetch AI agent names
      const agentIds = Array.from(
        new Set(rows.map((m) => m.ai_agent_id).filter(Boolean))
      ) as string[];

      let agentInfoById = new Map<string, { name: string; department: string }>();
      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from('ai_agents')
          .select('id, name, department')
          .in('id', agentIds);

        for (const a of agents || []) {
          agentInfoById.set(a.id, { name: a.name, department: (a as any).department || 'Vendas' });
        }
      }

      return rows.map((msg: any) => {
        let sentByName: string | null = null;
        if (msg.sent_by_user_id) {
          sentByName = nameByUserId.get(msg.sent_by_user_id) || null;
        } else if (msg.ai_agent_id) {
          const info = agentInfoById.get(msg.ai_agent_id);
          sentByName = info ? `${info.name} | ${info.department}` : null;
        }
        return { ...msg, sent_by_name: sentByName };
      }) as Message[];
    },
    enabled: !!contactId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (message: Omit<Message, 'id' | 'created_at' | 'organization_id' | 'status' | 'quoted_message_id' | 'quoted_content' | 'quoted_type'> & { quoted_message_id?: string; quoted_content?: string; quoted_type?: string }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          ...message,
          organization_id: orgData.organization.id,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Update contact's last_message_at
      await supabase
        .from('contacts')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', message.contact_id);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Send message via WhatsApp (Stevo API)
export function useSendWhatsAppMessage() {
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ 
      contact_id, 
      phone, 
      message,
      client_timestamp,
      quoted_message_id,
      quoted_content,
      quoted_type,
    }: { 
      contact_id: string; 
      phone: string; 
      message: string;
      client_timestamp?: string;
      quoted_message_id?: string;
      quoted_content?: string;
      quoted_type?: string;
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const includeSenderName =
        typeof window !== 'undefined'
          ? localStorage.getItem('chat_show_sender_name') !== 'false'
          : true;

      const provider = await resolveWhatsAppProvider(orgData.organization.id);
      const fnName = provider === 'meta' ? 'whatsapp-meta-send' : 'stevo-send-message';

      const body = {
        organization_id: orgData.organization.id,
        contact_id,
        phone,
        message,
        client_timestamp,
        quoted_message_id,
        quoted_content,
        quoted_type,
        include_sender_name: includeSenderName,
      };

      return await invokeWithAuthRetry(fnName, body);
    },
    // onSuccess: Realtime handles message and contact list updates
    // No need for invalidateQueries here - reduces redundant REST calls
  });
}

// Send media via WhatsApp (Stevo API)
// Supports both media_url (for already-uploaded files) and file_base64 (for direct upload via edge function)
export function useSendWhatsAppMedia() {
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ 
      contact_id, 
      phone, 
      media_url,
      file_base64,
      file_name,
      file_content_type,
      media_type,
      caption,
      filename,
      client_timestamp,
      quoted_message_id,
      quoted_content,
      quoted_type,
    }: { 
      contact_id: string; 
      phone: string; 
      media_url?: string;
      file_base64?: string;
      file_name?: string;
      file_content_type?: string;
      media_type: 'image' | 'audio' | 'video' | 'document';
      caption?: string;
      filename?: string;
      client_timestamp?: string;
      quoted_message_id?: string;
      quoted_content?: string;
      quoted_type?: string;
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const includeSenderName =
        typeof window !== 'undefined'
          ? localStorage.getItem('chat_show_sender_name') !== 'false'
          : true;

      const provider = await resolveWhatsAppProvider(orgData.organization.id);
      const fnName = provider === 'meta' ? 'whatsapp-meta-send' : 'stevo-send-media';

      const body = {
        organization_id: orgData.organization.id,
        contact_id,
        phone,
        media_url,
        file_base64,
        file_name,
        file_content_type,
        media_type,
        caption,
        filename,
        client_timestamp,
        quoted_message_id,
        quoted_content,
        quoted_type,
        include_sender_name: includeSenderName,
      };

      return await invokeWithAuthRetry(fnName, body);
    },
    // onSuccess: Realtime handles message and contact list updates
    // No need for invalidateQueries here - reduces redundant REST calls
  });
}

// Send message via Instagram
export function useSendInstagramMessage() {
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ 
      contact_id, 
      message,
      client_timestamp,
      media_url,
      file_base64,
      file_name,
      file_content_type,
      media_type,
    }: { 
      contact_id: string; 
      message?: string;
      client_timestamp?: string;
      media_url?: string;
      file_base64?: string;
      file_name?: string;
      file_content_type?: string;
      media_type?: 'image' | 'audio' | 'video' | 'document';
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('instagram-send-message', {
        body: {
          organization_id: orgData.organization.id,
          contact_id,
          message,
          client_timestamp,
          media_url,
          file_base64,
          file_name,
          file_content_type,
          media_type,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}

// Pipeline and Kanban Column Hooks (for automations)
export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  organization_id: string;
  created_at: string;
}

export function usePipelines() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['pipelines', organizationId],
    queryFn: async (): Promise<Pipeline[]> => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('kanban_pipelines')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: !!organizationId,
  });
}

export function useAllKanbanColumns() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['all-kanban-columns', organizationId],
    queryFn: async (): Promise<KanbanColumn[]> => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as KanbanColumn[];
    },
    enabled: !!organizationId,
  });
}

export function useKanbanColumnsByPipeline(pipelineId: string | null) {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['kanban-columns-by-pipeline', organizationId, pipelineId],
    queryFn: async (): Promise<KanbanColumn[]> => {
      if (!organizationId || !pipelineId) return [];
      
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('pipeline_id', pipelineId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as KanbanColumn[];
    },
    enabled: !!organizationId && !!pipelineId,
  });
}

// Delete message (local only or via WhatsApp)
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ 
      message_id, 
      contact_id, 
      delete_for_everyone 
    }: { 
      message_id: string; 
      contact_id: string; 
      delete_for_everyone: boolean;
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('stevo-delete-message', {
        body: {
          organization_id: orgData.organization.id,
          message_id,
          contact_id,
          delete_for_everyone,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.contact_id] });
    },
  });
}

// Edit message (text only, outbound only)
export function useEditMessage() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ 
      message_id, 
      contact_id, 
      new_text 
    }: { 
      message_id: string; 
      contact_id: string; 
      new_text: string;
    }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('stevo-edit-message', {
        body: {
          organization_id: orgData.organization.id,
          message_id,
          contact_id,
          new_text,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.contact_id] });
    },
  });
}
