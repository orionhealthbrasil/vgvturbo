import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface AiAgent {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
  model: string;
  system_prompt: string;
  faq_content: string | null;
  about_company: string | null;
  max_context_messages: number;
  pause_on_human_reply: boolean;
  position: number;
  department: string;
  split_long_messages: boolean;
  split_target_chars: number;
  split_max_parts: number;
  split_delay_ms: number;
  enabled_tools: string[];
  is_squad_member: boolean;
  is_followup: boolean;
  inactivity_trigger_hours: number | null;
  max_followup_attempts: number | null;
  followup_exhausted_automation_id: string | null;
  created_at: string;
  updated_at: string;
}

// Nomes das tools MCP que o agente conversacional pode usar (devem corresponder
// exatamente aos nomes em MCP_TOOLS na edge function ai-agent-respond).
export const AVAILABLE_AGENT_TOOLS = [
  { name: 'search_contacts', label: 'Buscar contatos' },
  { name: 'get_contact', label: 'Ver detalhes de contato' },
  { name: 'list_tags', label: 'Listar tags' },
  { name: 'add_tag', label: 'Adicionar tag' },
  { name: 'remove_tag', label: 'Remover tag' },
  { name: 'move_funnel_stage', label: 'Mover etapa do funil' },
  { name: 'assign_contact', label: 'Atribuir contato a atendente' },
  { name: 'get_custom_fields', label: 'Ver campos personalizados' },
  { name: 'set_custom_field', label: 'Definir campo personalizado' },
  { name: 'list_custom_field_definitions', label: 'Listar campos personalizados disponíveis' },
  { name: 'register_analysis', label: 'Registrar análise de conversa' },
] as const;

export function useAiAgents() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['ai-agents', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as AiAgent[];
    },
    enabled: !!orgId,
  });
}

export function useConversationalAgents() {
  const { data: agents, ...rest } = useAiAgents();
  return {
    ...rest,
    data: (agents || []).filter(a => a.category === 'conversational' && a.is_active),
  };
}

export function useOrgOpenAiKey() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['org-openai-key', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .rpc('get_org_openai_api_key' as any, { p_org: orgId });
      if (error) throw error;
      const persistedKey = data as unknown as string | null;
      return typeof persistedKey === 'string' && persistedKey.trim().length > 0
        ? persistedKey.trim()
        : null;
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrgOpenAiKey() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (key: string | null) => {
      if (!orgId) throw new Error('No organization');
      const normalizedKey = typeof key === 'string' && key.trim().length > 0
        ? key.trim()
        : null;

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ openai_api_key: normalizedKey } as any)
        .eq('id', orgId);

      if (updateError) throw updateError;

      const { data: keyData, error: readError } = await supabase
        .rpc('get_org_openai_api_key' as any, { p_org: orgId });
      if (readError) throw readError;

      const persistedKey = keyData as unknown as string | null;
      return typeof persistedKey === 'string' && persistedKey.trim().length > 0
        ? persistedKey.trim()
        : null;
    },
    onSuccess: (persistedKey) => {
      if (orgId) {
        queryClient.setQueryData(['org-openai-key', orgId], persistedKey);
        queryClient.invalidateQueries({ queryKey: ['org-openai-key', orgId] });
      }
      toast.success(persistedKey ? 'Chave da OpenAI salva e confirmada.' : 'Chave da OpenAI removida.');
    },
    onError: (error: any) => toast.error(error?.message || 'Erro ao salvar chave'),
  });
}

export function useCreateAiAgent() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (agent: Partial<AiAgent>) => {
      const orgId = orgData?.organization.id;
      if (!orgId) throw new Error('No organization');
      const { error, data } = await supabase
        .from('ai_agents')
        .insert({ organization_id: orgId, ...agent } as any)
        .select();
      if (error) {
        console.error('Error creating agent:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente criado!');
    },
    onError: (error: any) => {
      console.error('Create agent error details:', error);
      toast.error(`Erro ao criar agente: ${error?.message || 'Erro desconhecido'}`);
    },
  });
}

export function useUpdateAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AiAgent> & { id: string }) => {
      const { error } = await supabase
        .from('ai_agents')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar agente'),
  });
}

export function useDeleteAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente removido!');
    },
    onError: () => toast.error('Erro ao remover agente'),
  });
}
