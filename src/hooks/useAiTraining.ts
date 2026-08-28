import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';

export interface TrainingMessage {
  id?: string;
  role: 'inbound' | 'outbound';
  content: string;
  position: number;
}

export interface TrainingConversation {
  id: string;
  agent_id: string | null;
  title: string;
  source: string;
  created_at: string;
  messages?: TrainingMessage[];
}

export function useTrainingConversations(agentId: string) {
  const { data: org } = useUserOrganization();
  return useQuery({
    queryKey: ['training_conversations', agentId],
    enabled: !!org?.id && !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_training_conversations')
        .select('*, ai_training_messages(id, role, content, position)')
        .eq('organization_id', org!.id)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        messages: (c.ai_training_messages || []).sort((a: any, b: any) => a.position - b.position),
      })) as TrainingConversation[];
    },
  });
}

export function useCreateTrainingConversation() {
  const queryClient = useQueryClient();
  const { data: org } = useUserOrganization();
  return useMutation({
    mutationFn: async ({
      agentId,
      title,
      source,
      messages,
    }: {
      agentId: string;
      title: string;
      source: string;
      messages: TrainingMessage[];
    }) => {
      const { data: conv, error: convErr } = await supabase
        .from('ai_training_conversations')
        .insert({ organization_id: org!.id, agent_id: agentId, title, source })
        .select('id')
        .single();
      if (convErr) throw convErr;

      if (messages.length > 0) {
        const rows = messages.map((m, i) => ({
          conversation_id: conv.id,
          role: m.role,
          content: m.content,
          position: i,
        }));
        const { error: msgErr } = await supabase.from('ai_training_messages').insert(rows);
        if (msgErr) throw msgErr;
      }
      return conv;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['training_conversations', vars.agentId] });
    },
  });
}

export function useDeleteTrainingConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const { error } = await supabase.from('ai_training_conversations').delete().eq('id', id);
      if (error) throw error;
      return agentId;
    },
    onSuccess: (agentId) => {
      queryClient.invalidateQueries({ queryKey: ['training_conversations', agentId] });
    },
  });
}

export function useExtractConversationFromImage() {
  return useMutation({
    mutationFn: async (imageBase64: string): Promise<TrainingMessage[]> => {
      const { data, error } = await supabase.functions.invoke('ai-vision-extract', {
        body: { image_base64: imageBase64 },
      });
      if (error) throw error;
      return (data?.messages || []).map((m: any, i: number) => ({
        role: m.role as 'inbound' | 'outbound',
        content: m.content,
        position: i,
      }));
    },
  });
}
