import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';

const sb = supabase as any;
const BUCKET = 'task-attachments';

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 80);
}

export function useUploadTaskAttachment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: { task_id: string; file: File }) => {
      if (!user || !orgId) throw new Error('Sem autenticação');
      const safeName = sanitizeFileName(input.file.name);
      const path = `${orgId}/${input.task_id}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, {
          contentType: input.file.type || 'application/octet-stream',
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const file_url = urlData.publicUrl;

      const { error: insErr } = await sb.from('task_attachments').insert({
        task_id: input.task_id,
        file_url,
        file_name: input.file.name,
        file_size: input.file.size,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', vars.task_id] });
    },
  });
}

export function useDeleteTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; file_url: string; task_id: string }) => {
      // extract path from public URL
      const marker = `/object/public/${BUCKET}/`;
      const idx = input.file_url.indexOf(marker);
      const path = idx >= 0 ? input.file_url.slice(idx + marker.length) : null;

      if (path) {
        await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
      }
      const { error } = await sb.from('task_attachments').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', vars.task_id] });
    },
  });
}
