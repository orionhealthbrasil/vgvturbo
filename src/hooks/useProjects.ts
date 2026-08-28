import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import type { Project } from '@/types/tasks';

const sb = supabase as any;

export function useProjects() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['projects', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await sb
        .from('projects')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const projects = (data ?? []) as Project[];

      // Get task counts per project (best-effort)
      if (projects.length > 0) {
        const ids = projects.map((p) => p.id);
        const { data: counts } = await sb
          .from('tasks')
          .select('project_id')
          .in('project_id', ids);
        const map = new Map<string, number>();
        ((counts ?? []) as { project_id: string }[]).forEach((row) => {
          map.set(row.project_id, (map.get(row.project_id) ?? 0) + 1);
        });
        projects.forEach((p) => {
          p.task_count = map.get(p.id) ?? 0;
        });
      }

      return projects;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: { name: string; color?: string; description?: string | null }) => {
      if (!orgId || !user) throw new Error('Sem organização');
      const { data, error } = await sb
        .from('projects')
        .insert({
          organization_id: orgId,
          name: input.name,
          color: input.color ?? '#6366f1',
          description: input.description ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string; description?: string | null }) => {
      const { id, ...patch } = input;
      const { error } = await sb.from('projects').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
