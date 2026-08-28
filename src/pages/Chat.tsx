import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { ContactList } from '@/components/crm/ContactList';
import { ChatWindow } from '@/components/crm/ChatWindow';
import { ContactSearchDialog } from '@/components/crm/ContactSearchDialog';
import { useUpdateContact, useCreateContact, useArchiveContact } from '@/hooks/useCRM';
import { useConversationContactsPaginated, useArchivedContacts } from '@/hooks/useConversationContacts';
import { useScheduledContacts } from '@/hooks/useScheduledContacts';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { supabase } from '@/integrations/supabase/client';
import { ContactWithColumn } from '@/types/crm';
import { normalizePhone } from '@/lib/phone-link';
import { toast } from 'sonner';

interface ChatProps {
  channelFilter?: 'whatsapp' | 'instagram';
}

export default function Chat({ channelFilter = 'whatsapp' }: ChatProps = {}) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<ContactWithColumn | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const selectedContactRef = useRef<string | null>(null);
  const lastResyncRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use optimized hook that fetches all statuses for conversation view
  const { contacts: allContacts, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useConversationContactsPaginated(channelFilter);
  const { data: orgData } = useUserOrganization();
  const updateContact = useUpdateContact();
  const createContact = useCreateContact();
  const archiveContact = useArchiveContact();
  const { data: allArchivedContacts = [], isLoading: isLoadingArchived } = useArchivedContacts();
  const { data: allScheduledContacts = [] } = useScheduledContacts();
  const { playNotificationSound, isSoundEnabled, toggleSound } = useNotificationSound();
  const { showNotification } = useBrowserNotifications();

  // Filter by channel: 'instagram' shows only IG; 'whatsapp' shows everything else (whatsapp/null)
  const matchesChannel = useCallback((c: { channel?: string | null }) => {
    if (channelFilter === 'instagram') return c.channel === 'instagram';
    return c.channel !== 'instagram';
  }, [channelFilter]);

  const contacts = allContacts.filter(matchesChannel);
  const archivedContacts = allArchivedContacts.filter(matchesChannel);
  // Scheduled messages are WhatsApp-only; hide on Instagram view
  const scheduledContacts = channelFilter === 'instagram' ? [] : allScheduledContacts;

  // Handle clicking on a phone number in a message
  const handlePhoneClick = useCallback(async (phone: string) => {
    if (!orgData?.organization.id) return;

    const normalizedPhone = normalizePhone(phone);

    // First, search in the current contacts list (cached, fast)
    let existingContact = contacts.find(c => {
      const contactPhone = c.phone.replace(/\D/g, '');
      return contactPhone === normalizedPhone || 
             contactPhone.endsWith(normalizedPhone) ||
             normalizedPhone.endsWith(contactPhone);
    });

    // If not found in cache, search directly in database (includes contacts without messages)
    if (!existingContact) {
      const { data: dbContact } = await supabase
        .from('contacts')
        .select('*, kanban_columns(*), profiles:assigned_to(full_name, avatar_url)')
        .eq('organization_id', orgData.organization.id)
        .or(`phone.eq.${normalizedPhone},phone.ilike.%${normalizedPhone}`)
        .maybeSingle();

      if (dbContact) {
        existingContact = dbContact as unknown as ContactWithColumn;
      }
    }

    if (existingContact) {
      // Contact exists, select it
      handleSelectContact(existingContact);
      toast.success(`Conversa com ${existingContact.name} aberta`);
    } else {
      // Contact doesn't exist, create it
      try {
        const newContact = await createContact.mutateAsync({
          phone: normalizedPhone,
          name: normalizedPhone, // Use phone as initial name
          last_message_at: new Date().toISOString(), // garante visibilidade imediata na lista de Abertos
        } as any);

        // Garantia defensiva: caso o hook ignore o campo, força o update.
        if (!('last_message_at' in (newContact as any)) || !(newContact as any).last_message_at) {
          await supabase
            .from('contacts')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', newContact.id);
        }

        // Refresh contacts list first
        await queryClient.invalidateQueries({ queryKey: ['conversation-contacts-paginated'] });
        await queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });
        
        // Fetch the full contact with column info and profiles
        const { data: fullContact } = await supabase
          .from('contacts')
          .select('*, kanban_columns(*), profiles:assigned_to(full_name, avatar_url)')
          .eq('id', newContact.id)
          .maybeSingle();
        
        if (fullContact) {
          // Cast with proper typing and open the chat
          const contactWithColumn = fullContact as unknown as ContactWithColumn;
          setSelectedContact(contactWithColumn);
          toast.success('Novo contato criado e conversa aberta');
        } else {
          // Fallback: create a minimal contact object to open the chat
          const minimalContact: ContactWithColumn = {
            ...newContact,
            kanban_columns: null,
            profiles: null,
          } as ContactWithColumn;
          setSelectedContact(minimalContact);
          toast.success('Novo contato criado');
        }
      } catch (error: any) {
        console.error('Error creating contact:', error);
        // Check if it's a duplicate error
        if (error?.code === '23505' || error?.message?.includes('duplicate')) {
          // Contact exists but wasn't found before - try to fetch and open it
          const { data: existingDbContact } = await supabase
            .from('contacts')
            .select('*, kanban_columns(*), profiles:assigned_to(full_name, avatar_url)')
            .eq('organization_id', orgData.organization.id)
            .ilike('phone', `%${normalizedPhone.slice(-9)}%`)
            .maybeSingle();
          
          if (existingDbContact) {
            handleSelectContact(existingDbContact as unknown as ContactWithColumn);
            toast.info('Conversa aberta com contato existente');
          } else {
            toast.error('Este contato já existe');
          }
        } else {
          toast.error('Erro ao criar contato');
        }
      }
    }
  }, [contacts, orgData?.organization.id, createContact, queryClient]);

  // Keep ref in sync with selected contact
  useEffect(() => {
    selectedContactRef.current = selectedContact?.id || null;
  }, [selectedContact?.id]);

  // Realtime subscription for contacts (unread_count, last_message_at, etc.)
  useEffect(() => {
    if (!orgData?.organization.id) return;

    // Throttled resync: refetch 1st page of conversations + counts
    const resync = (reason: string) => {
      const now = Date.now();
      if (now - lastResyncRef.current < 5000) return;
      lastResyncRef.current = now;
      console.log('[Chat] resync realtime caches:', reason);
      queryClient.invalidateQueries({ queryKey: ['conversation-contacts-paginated'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['conversation-counts'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-total'], refetchType: 'active' });
    };

    const channel = supabase
      .channel('contacts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `organization_id=eq.${orgData.organization.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          const oldUnread = oldData?.unread_count;
          const newUnread = newData?.unread_count;
          
          // Play sound ONLY if unread_count explicitly increased and not selected contact
          const shouldPlaySound = 
            typeof oldUnread === 'number' && 
            typeof newUnread === 'number' &&
            newUnread > oldUnread &&
            newData?.id !== selectedContactRef.current;
          
          if (shouldPlaySound) {
            playNotificationSound();
          }
          
          // Detect if last_message_at changed → need to re-sort the list
          const lastMsgChanged =
            oldData?.last_message_at !== newData?.last_message_at;

          // Helper: sort by last_message_at desc, nulls last
          const sortByLastMsg = (list: ContactWithColumn[]) =>
            [...list].sort((a, b) => {
              const av = (a as any).last_message_at as string | null;
              const bv = (b as any).last_message_at as string | null;
              if (!av && !bv) return 0;
              if (!av) return 1;
              if (!bv) return -1;
              return bv.localeCompare(av);
            });

          // UPDATE CACHE IN-PLACE for paginated contacts
          queryClient.setQueriesData(
            { queryKey: ['conversation-contacts-paginated'] },
            (old: any) => {
              if (!old?.pages) return old;
              // First, in-place update across pages
              let found = false;
              const updatedPages = old.pages.map((page: ContactWithColumn[]) => {
                const idx = page.findIndex(c => c.id === newData?.id);
                if (idx === -1) return page;
                found = true;
                const updated = [...page];
                updated[idx] = { ...updated[idx], ...newData };
                return updated;
              });

              // If last_message_at didn't change, just return in-place update
              if (!lastMsgChanged || !found) {
                return { ...old, pages: updatedPages };
              }

              // Otherwise: flatten, re-sort by last_message_at desc, re-slice into pages
              const pageSizes = updatedPages.map((p: ContactWithColumn[]) => p.length);
              const flat = updatedPages.flat() as ContactWithColumn[];
              const sorted = sortByLastMsg(flat);
              const newPages: ContactWithColumn[][] = [];
              let cursor = 0;
              for (const size of pageSizes) {
                newPages.push(sorted.slice(cursor, cursor + size));
                cursor += size;
              }
              return { ...old, pages: newPages };
            }
          );
          // Also update legacy flat cache
          queryClient.setQueriesData(
            { queryKey: ['conversation-contacts'] },
            (old: ContactWithColumn[] | undefined) => {
              if (!old) return old;
              const idx = old.findIndex(c => c.id === newData?.id);
              if (idx === -1) return old;
              const updated = [...old];
              updated[idx] = { ...updated[idx], ...newData };
              return lastMsgChanged ? sortByLastMsg(updated) : updated;
            }
          );

          // Update conversation counts from cache instead of refetching
          queryClient.setQueriesData(
            { queryKey: ['conversation-counts'] },
            (old: any) => {
              if (!old || !oldData) return old;
              const result = { ...old };
              const oldStatus = oldData.status;
              const newStatus = newData.status;
              if (oldStatus && newStatus && oldStatus !== newStatus) {
                if (result[oldStatus] !== undefined) result[oldStatus] = Math.max(0, result[oldStatus] - 1);
                if (result[newStatus] !== undefined) result[newStatus] = (result[newStatus] || 0) + 1;
              }
              if (typeof oldUnread === 'number' && typeof newUnread === 'number') {
                if (oldUnread === 0 && newUnread > 0) result.unread = (result.unread || 0) + 1;
                if (oldUnread > 0 && newUnread === 0) result.unread = Math.max(0, (result.unread || 0) - 1);
              }
              return result;
            }
          );

          // Badge global (`unread-messages-total`) é controlado APENAS pelo
          // hook useUnreadMessages via realtime — não duplicamos aqui para
          // evitar decremento duplo (que causava flicker no badge).

          
          // If the updated contact is currently selected, update the selectedContact state
          if (selectedContactRef.current === newData?.id) {
            setSelectedContact((prev) => prev ? { ...prev, ...newData } : null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `organization_id=eq.${orgData.organization.id}`,
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (!newMessage?.contact_id) return;

          const lastMsg = {
              content: newMessage.content,
              message_type: newMessage.message_type,
              direction: newMessage.direction,
              created_at: newMessage.created_at,
            };

          // Race fix: if contact isn't in any cached page, fetch & inject it
          let foundInCache = false;
          queryClient.setQueriesData(
            { queryKey: ['conversation-contacts-paginated'] },
            (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: ContactWithColumn[]) => {
                  const idx = page.findIndex(c => c.id === newMessage.contact_id);
                  if (idx === -1) return page;
                  foundInCache = true;
                  const updated = [...page];
                  updated[idx] = { ...updated[idx], last_message: lastMsg } as ContactWithColumn;
                  return updated;
                }),
              };
            }
          );

          queryClient.setQueriesData(
            { queryKey: ['conversation-contacts'] },
            (old: ContactWithColumn[] | undefined) => {
              if (!old) return old;
              const idx = old.findIndex(c => c.id === newMessage.contact_id);
              if (idx === -1) return old;
              const updated = [...old];
              updated[idx] = { ...updated[idx], last_message: lastMsg } as ContactWithColumn;
              return updated;
            }
          );

          // Browser notification helper — usa dados do contato (cache ou fetch)
          const maybeNotify = (contact: ContactWithColumn | null) => {
            if (!contact) return;
            if (newMessage.direction !== 'inbound') return;
            if (selectedContactRef.current === contact.id) return;
            showNotification({
              contactId: contact.id,
              title: contact.name || contact.phone || 'Nova mensagem',
              body: newMessage.content,
              messageType: newMessage.message_type,
              icon: (contact as any).profile_picture_url || (contact as any).avatar_url || null,
            });
          };

          // Procura contato já em cache para notificar imediatamente
          if (foundInCache) {
            const cachedPaginated = queryClient.getQueriesData({ queryKey: ['conversation-contacts-paginated'] });
            let cachedContact: ContactWithColumn | null = null;
            for (const [, data] of cachedPaginated) {
              const pages = (data as any)?.pages as ContactWithColumn[][] | undefined;
              if (!pages) continue;
              for (const page of pages) {
                const f = page.find(c => c.id === newMessage.contact_id);
                if (f) { cachedContact = f; break; }
              }
              if (cachedContact) break;
            }
            maybeNotify(cachedContact);
          }

          // Race: contact not yet in cache → fetch and inject in 1st page
          if (!foundInCache) {
            supabase
              .from('contacts')
              .select('*, kanban_columns(*), profiles:assigned_to(full_name, avatar_url)')
              .eq('id', newMessage.contact_id)
              .maybeSingle()
              .then(({ data }) => {
                if (!data) return;
                const contactWithExtras = {
                  ...data,
                  tags: [],
                  last_message: lastMsg,
                } as unknown as ContactWithColumn;
                queryClient.setQueriesData(
                  { queryKey: ['conversation-contacts-paginated'] },
                  (old: any) => {
                    if (!old?.pages?.[0]) return old;
                    if (old.pages.some((p: ContactWithColumn[]) => p.some((c: ContactWithColumn) => c.id === data.id))) return old;
                    return {
                      ...old,
                      pages: [[contactWithExtras, ...old.pages[0]], ...old.pages.slice(1)],
                    };
                  }
                );
                queryClient.setQueriesData(
                  { queryKey: ['conversation-contacts'] },
                  (old: ContactWithColumn[] | undefined) => {
                    if (!old) return old;
                    if (old.some(c => c.id === data.id)) return old;
                    return [contactWithExtras, ...old];
                  }
                );
                // Notify if inbound and not currently selected
                if (
                  newMessage.direction === 'inbound' &&
                  selectedContactRef.current !== data.id
                ) {
                  playNotificationSound();
                  maybeNotify(contactWithExtras);
                }
              });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
          filter: `organization_id=eq.${orgData.organization.id}`,
        },
        (payload) => {
          const newContact = payload.new as any;
          // For new contacts, do a targeted fetch of just this contact
          // Much cheaper than refetching the entire list
          if (newContact?.id) {
            supabase
              .from('contacts')
              .select('*, kanban_columns (*)')
              .eq('id', newContact.id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  const contactWithExtras = { ...data, tags: [], last_message: null } as unknown as ContactWithColumn;
                  // Add to paginated cache (first page)
                  queryClient.setQueriesData(
                    { queryKey: ['conversation-contacts-paginated'] },
                    (old: any) => {
                      if (!old?.pages?.[0]) return old;
                      if (old.pages.some((p: ContactWithColumn[]) => p.some((c: ContactWithColumn) => c.id === data.id))) return old;
                      return {
                        ...old,
                        pages: [[contactWithExtras, ...old.pages[0]], ...old.pages.slice(1)],
                      };
                    }
                  );
                  // Also update legacy flat cache
                  queryClient.setQueriesData(
                    { queryKey: ['conversation-contacts'] },
                    (old: ContactWithColumn[] | undefined) => {
                      if (!old) return old;
                      if (old.some(c => c.id === data.id)) return old;
                      return [contactWithExtras, ...old];
                    }
                  );
                }
              });
          }
          // Update counts
          queryClient.setQueriesData(
            { queryKey: ['conversation-counts'] },
            (old: any) => {
              if (!old) return old;
              return { ...old, open: (old.open || 0) + 1 };
            }
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Clear pending "reconnecting" indicator
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          // If we were previously disconnected, resync to recover lost events
          if (!isRealtimeConnected) {
            resync('realtime SUBSCRIBED after drop');
          }
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Delay flagging as disconnected to avoid flapping during quick reconnects
          if (!reconnectTimerRef.current) {
            reconnectTimerRef.current = setTimeout(() => {
              setIsRealtimeConnected(false);
              reconnectTimerRef.current = null;
            }, 3000);
          }
        }
      });

    // Resync when tab regains focus (WebSocket may have died silently)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resync('tab visible');
      }
    };
    const onOnline = () => resync('network online');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgData?.organization.id, queryClient, playNotificationSound, showNotification]);

  const [searchParams, setSearchParams] = useSearchParams();

  // Handle contact passed via query param (e.g., from Analytics)
  useEffect(() => {
    const contactId = searchParams.get('contact');
    if (!contactId || isLoading) return;

    // Try to find in already-loaded contacts
    const found = contacts.find(c => c.id === contactId);
    if (found) {
      handleSelectContact(found);
      setSearchParams({}, { replace: true });
      return;
    }

    // Contact not in current list – fetch directly from DB
    (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, kanban_columns(*), profiles:assigned_to(full_name, avatar_url)')
        .eq('id', contactId)
        .maybeSingle();

      if (error) {
        console.error('[Chat deep-link] error fetching contact', error);
      }

      let contact = data as unknown as ContactWithColumn | null;

      // Fallback without joins (in case of RLS/relationship issues)
      if (!contact) {
        const { data: basic } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .maybeSingle();
        if (basic) {
          contact = { ...basic, kanban_columns: null, profiles: null } as unknown as ContactWithColumn;
        }
      }

      if (contact) {
        handleSelectContact(contact);
      } else {
        toast.error('Conversa não encontrada ou sem acesso');
      }
      setSearchParams({}, { replace: true });
    })();
  }, [searchParams, contacts, isLoading]);

  // Handle contact passed via navigation state (e.g., from Kanban)
  useEffect(() => {
    const stateContact = location.state?.selectedContact as ContactWithColumn | undefined;
    if (stateContact) {
      setSelectedContact(stateContact);
      // Mark as read if needed
      if (stateContact.unread_count > 0) {
        updateContact.mutate({ id: stateContact.id, unread_count: 0 });
      }
      // Clear state to avoid re-selecting on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Mark messages as read when opening a contact
  const handleSelectContact = (contact: ContactWithColumn) => {
    setSelectedContact(contact);
    
    // If contact has unread messages, mark them as read
    if (contact.unread_count > 0) {
      updateContact.mutate({ id: contact.id, unread_count: 0 });
    }
  };

  const handleArchiveContact = useCallback((contactId: string, archive: boolean) => {
    archiveContact.mutate(
      { id: contactId, is_archived: archive },
      {
        onSuccess: () => {
          toast.success(archive ? 'Contato arquivado' : 'Contato desarquivado');
          if (selectedContact?.id === contactId) {
            setSelectedContact(null);
          }
        },
        onError: () => toast.error('Erro ao arquivar contato'),
      }
    );
  }, [archiveContact, selectedContact]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Contact list - on mobile, hide when a contact is selected */}
      <div className={`${isMobile ? (selectedContact ? 'hidden' : 'w-full') : 'w-96'} shrink-0 relative z-10`}>
        <ContactList
          contacts={contacts}
          selectedContactId={selectedContact?.id || null}
          onSelectContact={handleSelectContact}
          onNewConversation={() => setIsSearchOpen(true)}
          isLoading={isLoading}
          isSoundEnabled={isSoundEnabled}
          onToggleSound={toggleSound}
          archivedContacts={archivedContacts}
          isLoadingArchived={isLoadingArchived}
          onArchiveContact={handleArchiveContact}
          scheduledContacts={scheduledContacts}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          channelFilter={channelFilter}
          isRealtimeConnected={isRealtimeConnected}
        />
      </div>
      {/* Chat window - on mobile, hide when no contact is selected */}
      <div className={`${isMobile ? (selectedContact ? 'w-full' : 'hidden') : 'flex-1'} min-w-0 relative z-0`}>
        <ChatWindow
          contact={selectedContact}
          onViewDetails={() => {}}
          onPhoneClick={handlePhoneClick}
          onBack={isMobile ? () => setSelectedContact(null) : undefined}
        />
      </div>

      <ContactSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectContact={handleSelectContact}
      />
    </div>
  );
}
