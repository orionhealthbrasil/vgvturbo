import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useOrganization';

export interface FlowData {
  nodes: unknown[];
  edges: unknown[];
}

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: string | null;
  flow_data: FlowData;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export function useAutomations() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['automations', orgData?.organization.id],
    queryFn: async (): Promise<Automation[]> => {
      if (!orgData?.organization.id) return [];

      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('organization_id', orgData.organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Automation[];
    },
    enabled: !!orgData?.organization.id,
  });
}

export function useAutomation(id: string | undefined) {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['automation', id],
    queryFn: async (): Promise<Automation | null> => {
      if (!id || !orgData?.organization.id) return null;

      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgData.organization.id)
        .single();

      if (error) throw error;
      return data as unknown as Automation;
    },
    enabled: !!id && !!orgData?.organization.id,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (name: string = 'Nova Automação'): Promise<Automation> => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('automations')
        .insert({
          organization_id: orgData.organization.id,
          name,
          flow_data: { nodes: [], edges: [] },
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Automation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      trigger_type,
      flow_data,
      is_active,
      priority,
    }: {
      id: string;
      name?: string;
      trigger_type?: string | null;
      flow_data?: FlowData;
      is_active?: boolean;
      priority?: number;
    }): Promise<Automation> => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (trigger_type !== undefined) updates.trigger_type = trigger_type;
      if (flow_data !== undefined) updates.flow_data = flow_data;
      if (is_active !== undefined) updates.is_active = is_active;
      if (priority !== undefined) updates.priority = priority;

      const { data, error } = await supabase
        .from('automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Automation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation', data.id] });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useDuplicateAutomation() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();

  return useMutation({
    mutationFn: async (automation: Automation): Promise<Automation> => {
      if (!orgData?.organization.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('automations')
        .insert({
          organization_id: orgData.organization.id,
          name: `${automation.name} (Cópia)`,
          flow_data: JSON.parse(JSON.stringify(automation.flow_data)),
          trigger_type: automation.trigger_type,
          is_active: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Automation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
