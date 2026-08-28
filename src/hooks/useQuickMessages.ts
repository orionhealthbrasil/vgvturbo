import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface QuickMessage {
  id: string;
  user_id: string;
  organization_id: string;
  shortcut: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuickMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['quick-messages', user?.id],
    queryFn: async (): Promise<QuickMessage[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('quick_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('shortcut', { ascending: true });

      if (error) throw error;
      return (data || []) as QuickMessage[];
    },
    enabled: !!user?.id,
  });
}

interface CreateQuickMessageParams {
  shortcut: string;
  content?: string;
  mediaFile?: File;
}

export function useCreateQuickMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ shortcut, content, mediaFile }: CreateQuickMessageParams) => {
      if (!user?.id || !orgData?.organization?.id) {
        throw new Error('Usuário ou organização não encontrado');
      }

      // Normalize shortcut (lowercase, no spaces, no leading slash)
      const normalizedShortcut = shortcut.toLowerCase().replace(/^\//, '').replace(/\s+/g, '_');

      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Upload media if provided
      if (mediaFile) {
        const timestamp = Date.now();
        const ext = mediaFile.name.split('.').pop() || 'bin';
        const path = `${user.id}/${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('quick-messages')
          .upload(path, mediaFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('quick-messages')
          .getPublicUrl(path);

        mediaUrl = urlData.publicUrl;
        
        // Determine media type
        if (mediaFile.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (mediaFile.type.startsWith('video/')) {
          mediaType = 'video';
        } else if (mediaFile.type.startsWith('audio/')) {
          mediaType = 'audio';
        } else {
          mediaType = 'document';
        }
      }

      const { data, error } = await supabase
        .from('quick_messages')
        .insert({
          user_id: user.id,
          organization_id: orgData.organization.id,
          shortcut: normalizedShortcut,
          content: content || null,
          media_url: mediaUrl,
          media_type: mediaType,
        } as any)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`O atalho /${normalizedShortcut} já existe`);
        }
        throw error;
      }

      return data as QuickMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-messages'] });
      toast.success('Mensagem rápida criada!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar mensagem rápida');
    },
  });
}

export function useUpdateQuickMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      id, 
      shortcut, 
      content, 
      mediaFile,
      removeMedia 
    }: { 
      id: string; 
      shortcut?: string; 
      content?: string;
      mediaFile?: File;
      removeMedia?: boolean;
    }) => {
      if (!user?.id) throw new Error('Usuário não encontrado');

      const updates: any = {};

      if (shortcut !== undefined) {
        updates.shortcut = shortcut.toLowerCase().replace(/^\//, '').replace(/\s+/g, '_');
      }

      if (content !== undefined) {
        updates.content = content || null;
      }

      if (removeMedia) {
        updates.media_url = null;
        updates.media_type = null;
      }

      // Upload new media if provided
      if (mediaFile) {
        const timestamp = Date.now();
        const ext = mediaFile.name.split('.').pop() || 'bin';
        const path = `${user.id}/${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('quick-messages')
          .upload(path, mediaFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('quick-messages')
          .getPublicUrl(path);

        updates.media_url = urlData.publicUrl;
        
        if (mediaFile.type.startsWith('image/')) {
          updates.media_type = 'image';
        } else if (mediaFile.type.startsWith('video/')) {
          updates.media_type = 'video';
        } else if (mediaFile.type.startsWith('audio/')) {
          updates.media_type = 'audio';
        } else {
          updates.media_type = 'document';
        }
      }

      const { error } = await supabase
        .from('quick_messages')
        .update(updates)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          throw new Error(`O atalho já existe`);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-messages'] });
      toast.success('Mensagem rápida atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar mensagem rápida');
    },
  });
}

export function useDeleteQuickMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quick_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-messages'] });
      toast.success('Mensagem rápida excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir mensagem rápida');
    },
  });
}
