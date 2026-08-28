import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import type { ProjectArea } from '@/types/tasks';

const sb = supabase as any;

export function useProjectAreas(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['project-areas', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectArea[]> => {
      if (!projectId) return [];
      const { data, error } = await sb
        .from('project_areas')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectArea[];
    },
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: { project_id: string; name: string; color?: string; icon?: string | null }) => {
      if (!orgId) throw new Error('Sem organização');
      const { data: existing } = await sb
        .from('project_areas')
        .select('position')
        .eq('project_id', input.project_id)
        .order('position', { ascending: false })
        .limit(1);
      const nextPos = ((existing as any[])?.[0]?.position ?? -1) + 1;
      const { error } = await sb.from('project_areas').insert({
        organization_id: orgId,
        project_id: input.project_id,
        name: input.name.trim(),
        color: input.color ?? '#6366f1',
        icon: input.icon ?? null,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['project-areas', vars.project_id] });
    },
  });
}

export function useUpdateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; project_id: string; name?: string; color?: string; icon?: string | null }) => {
      const { id, project_id, ...patch } = input;
      const { error } = await sb.from('project_areas').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['project-areas', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; project_id: string }) => {
      const { error } = await sb.from('project_areas').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['project-areas', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
