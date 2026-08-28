import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { Tag } from '@/types/crm';

// Fetch all tags for the organization
export function useTags() {
  const { data: orgData } = useUserOrganization();
  const organizationId = orgData?.organization.id;

  return useQuery({
    queryKey: ['tags', organizationId],
    queryFn: async (): Promise<Tag[]> => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!organizationId,
  });
}

// Create a new tag
export function useCreateTag() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('tags')
        .insert({
          ...tag,
          organization_id: orgData.organization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

// Update a tag
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tag> & { id: string }) => {
      const { error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
    },
  });
}

// Delete a tag
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Fetch tags for a specific contact with realtime subscription
export function useContactTags(contactId: string | null) {
  const queryClient = useQueryClient();

  // Realtime subscription for contact_tags changes
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`contact-tags:${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_tags',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          // Refetch tags when any change occurs
          queryClient.invalidateQueries({ queryKey: ['contact-tags', contactId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, queryClient]);

  return useQuery({
    queryKey: ['contact-tags', contactId],
    queryFn: async (): Promise<Tag[]> => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('contact_tags')
        .select(`
          tag_id,
          tags (*)
        `)
        .eq('contact_id', contactId);

      if (error) throw error;
      return (data || []).map((ct: any) => ct.tags).filter(Boolean) as Tag[];
    },
    enabled: !!contactId,
  });
}

// Add tag to contact
export function useAddTagToContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });

      if (error) throw error;

      // Fetch tag name and contact org to fire tag_added automation
      const [{ data: tag }, { data: contact }] = await Promise.all([
        supabase.from('tags').select('name').eq('id', tagId).single(),
        supabase.from('contacts').select('organization_id').eq('id', contactId).single(),
      ]);

      if (tag?.name && contact?.organization_id) {
        supabase.functions.invoke('automation-engine', {
          body: {
            contact_id: contactId,
            organization_id: contact.organization_id,
            event_type: 'tag_added',
            tag_name: tag.name,
          },
        }).catch(() => {});
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// Remove tag from contact
export function useRemoveTagFromContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
