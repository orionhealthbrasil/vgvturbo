import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface Sticker {
  id: string;
  user_id: string;
  organization_id: string;
  name: string | null;
  sticker_url: string;
  created_at: string;
}

export function useStickers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stickers', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_stickers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Sticker[];
    },
    enabled: !!user?.id
  });
}

export function useAddSticker() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async ({ 
      file, 
      name,
      existingUrl 
    }: { 
      file?: File; 
      name?: string;
      existingUrl?: string;
    }) => {
      if (!user?.id || !orgData?.organization?.id) {
        throw new Error('Usuário não autenticado');
      }

      let stickerUrl = existingUrl;

      // If file provided, upload it
      if (file && !existingUrl) {
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'webp';
        const path = `${user.id}/${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('stickers')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('stickers')
          .getPublicUrl(path);

        stickerUrl = urlData.publicUrl;
      }

      if (!stickerUrl) {
        throw new Error('URL do sticker não fornecida');
      }

      const { data, error } = await supabase
        .from('user_stickers')
        .insert({
          user_id: user.id,
          organization_id: orgData.organization.id,
          name: name || null,
          sticker_url: stickerUrl
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stickers'] });
      toast.success('Figurinha salva!');
    },
    onError: (error) => {
      console.error('Error saving sticker:', error);
      toast.error('Erro ao salvar figurinha');
    }
  });
}

export function useDeleteSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stickerId: string) => {
      const { error } = await supabase
        .from('user_stickers')
        .delete()
        .eq('id', stickerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stickers'] });
      toast.success('Figurinha removida');
    },
    onError: (error) => {
      console.error('Error deleting sticker:', error);
      toast.error('Erro ao remover figurinha');
    }
  });
}
