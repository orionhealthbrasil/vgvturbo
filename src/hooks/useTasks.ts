import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import type { Task, TaskInput, TaskStatus, TaskAssignee, TaskSubtask, TaskComment, TaskAttachment } from '@/types/tasks';

const sb = supabase as any;

export interface TaskFilters {
  projectId?: string | null;
  areaId?: string | null;
  contactId?: string | null;
  assigneeUserId?: string | null;
  status?: TaskStatus | null;
  search?: string;
  onlyMine?: boolean;
}

async function hydrateTasks(rawTasks: any[]): Promise<Task[]> {
  if (rawTasks.length === 0) return [];
  const taskIds = rawTasks.map((t) => t.id);
  const projectIds = Array.from(new Set(rawTasks.map((t) => t.project_id).filter(Boolean)));
  const areaIds = Array.from(new Set(rawTasks.map((t) => t.area_id).filter(Boolean)));
  const contactIds = Array.from(new Set(rawTasks.map((t) => t.contact_id).filter(Boolean)));

  const [assigneesRes, projectsRes, areasRes, contactsRes, subtasksRes, commentsRes] = await Promise.all([
    sb.from('task_assignees').select('task_id, user_id').in('task_id', taskIds),
    projectIds.length
      ? sb.from('projects').select('id, name, color').in('id', projectIds)
      : Promise.resolve({ data: [] }),
    areaIds.length
      ? sb.from('project_areas').select('id, name, color, icon').in('id', areaIds)
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabase.from('contacts').select('id, name, phone').in('id', contactIds)
      : Promise.resolve({ data: [] }),
    sb.from('task_subtasks').select('task_id, completed').in('task_id', taskIds),
    sb.from('task_comments').select('task_id').in('task_id', taskIds),
  ]);

  const assigneeRows = (assigneesRes.data ?? []) as { task_id: string; user_id: string }[];
  const allUserIds = Array.from(new Set(assigneeRows.map((a) => a.user_id)));
  const profilesRes = allUserIds.length
    ? await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', allUserIds)
    : { data: [] };
  const profileMap = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.user_id, p]));
  const projectMap = new Map(((projectsRes.data ?? []) as any[]).map((p) => [p.id, p]));
  const areaMap = new Map(((areasRes.data ?? []) as any[]).map((a) => [a.id, a]));
  const contactMap = new Map(((contactsRes.data ?? []) as any[]).map((c) => [c.id, c]));

  const assigneesByTask = new Map<string, TaskAssignee[]>();
  assigneeRows.forEach((row) => {
    const profile = profileMap.get(row.user_id);
    const list = assigneesByTask.get(row.task_id) ?? [];
    list.push({
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    });
    assigneesByTask.set(row.task_id, list);
  });

  const subtaskCount = new Map<string, { total: number; completed: number }>();
  ((subtasksRes.data ?? []) as { task_id: string; completed: boolean }[]).forEach((s) => {
    const cur = subtaskCount.get(s.task_id) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (s.completed) cur.completed += 1;
    subtaskCount.set(s.task_id, cur);
  });

  const commentCount = new Map<string, number>();
  ((commentsRes.data ?? []) as { task_id: string }[]).forEach((c) => {
    commentCount.set(c.task_id, (commentCount.get(c.task_id) ?? 0) + 1);
  });

  return rawTasks.map((t) => ({
    ...t,
    project: t.project_id ? projectMap.get(t.project_id) ?? null : null,
    area: t.area_id ? areaMap.get(t.area_id) ?? null : null,
    contact: t.contact_id ? contactMap.get(t.contact_id) ?? null : null,
    assignees: assigneesByTask.get(t.id) ?? [],
    subtask_count: subtaskCount.get(t.id) ?? { total: 0, completed: 0 },
    comment_count: commentCount.get(t.id) ?? 0,
  })) as Task[];
}

export function useTasks(filters: TaskFilters = {}) {
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['tasks', orgId, filters, user?.id],
    enabled: !!orgId,
    queryFn: async (): Promise<Task[]> => {
      let query = sb.from('tasks').select('*').eq('organization_id', orgId);
      if (filters.projectId) query = query.eq('project_id', filters.projectId);
      if (filters.areaId) query = query.eq('area_id', filters.areaId);
      if (filters.contactId) query = query.eq('contact_id', filters.contactId);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.search && filters.search.trim()) {
        query = query.ilike('title', `%${filters.search.trim()}%`);
      }
      query = query.order('position', { ascending: true }).order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      let raw = (data ?? []) as any[];

      // assignee filter (post-hydration since it's a join)
      if (filters.onlyMine && user) {
        const { data: myTaskIds } = await sb
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);
        const ids = new Set(((myTaskIds ?? []) as { task_id: string }[]).map((r) => r.task_id));
        raw = raw.filter((t) => ids.has(t.id) || t.created_by === user.id);
      } else if (filters.assigneeUserId) {
        const { data: filtered } = await sb
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', filters.assigneeUserId);
        const ids = new Set(((filtered ?? []) as { task_id: string }[]).map((r) => r.task_id));
        raw = raw.filter((t) => ids.has(t.id));
      }

      return hydrateTasks(raw);
    },
  });
}

export function useTaskDetail(taskId: string | null) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['task-detail', taskId],
    enabled: !!taskId && !!orgId,
    queryFn: async (): Promise<Task | null> => {
      if (!taskId) return null;
      const { data, error } = await sb.from('tasks').select('*').eq('id', taskId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [hydrated] = await hydrateTasks([data]);

      const [subRes, attRes] = await Promise.all([
        sb.from('task_subtasks').select('*').eq('task_id', taskId).order('position'),
        sb.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      ]);
      hydrated.subtasks = ((subRes.data ?? []) as TaskSubtask[]);
      (hydrated as any).attachments = ((attRes.data ?? []) as TaskAttachment[]);
      return hydrated;
    },
  });
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskComment[]> => {
      if (!taskId) return [];
      const { data, error } = await sb
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as TaskComment[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length === 0) return rows;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      const map = new Map(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));
      return rows.map((r) => ({
        ...r,
        user_full_name: map.get(r.user_id)?.full_name ?? null,
        user_avatar_url: map.get(r.user_id)?.avatar_url ?? null,
      }));
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: TaskInput) => {
      if (!orgId || !user) throw new Error('Sem organização');
      const { assignee_user_ids, ...rest } = input;
      const { data, error } = await sb
        .from('tasks')
        .insert({
          organization_id: orgId,
          created_by: user.id,
          status: rest.status ?? 'todo',
          priority: rest.priority ?? 'medium',
          ...rest,
        })
        .select()
        .single();
      if (error) throw error;

      if (assignee_user_ids && assignee_user_ids.length > 0) {
        await sb.from('task_assignees').insert(
          assignee_user_ids.map((uid) => ({ task_id: data.id, user_id: uid })),
        );
      }
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Task> & { assignee_user_ids?: string[] } }) => {
      const { id, patch } = input;
      const { assignee_user_ids, ...rest } = patch as any;

      // If marking as done, fill completed_at
      if (rest.status === 'done' && !('completed_at' in rest)) {
        rest.completed_at = new Date().toISOString();
      }
      if (rest.status && rest.status !== 'done') {
        rest.completed_at = null;
      }

      if (Object.keys(rest).length > 0) {
        const { error } = await sb.from('tasks').update(rest).eq('id', id);
        if (error) throw error;
      }

      if (assignee_user_ids) {
        await sb.from('task_assignees').delete().eq('task_id', id);
        if (assignee_user_ids.length > 0) {
          await sb.from('task_assignees').insert(
            assignee_user_ids.map((uid: string) => ({ task_id: id, user_id: uid })),
          );
        }
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-detail', vars.id] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Subtasks
export function useCreateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { task_id: string; title: string }) => {
      const { data: existing } = await sb
        .from('task_subtasks')
        .select('position')
        .eq('task_id', input.task_id)
        .order('position', { ascending: false })
        .limit(1);
      const nextPos = ((existing as any[])?.[0]?.position ?? -1) + 1;
      const { error } = await sb.from('task_subtasks').insert({
        task_id: input.task_id,
        title: input.title,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useToggleSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; completed: boolean; task_id: string }) => {
      const { error } = await sb
        .from('task_subtasks')
        .update({ completed: input.completed })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; task_id: string }) => {
      const { error } = await sb.from('task_subtasks').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Comments
export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { task_id: string; content: string; mentioned_user_ids?: string[] }) => {
      if (!user) throw new Error('Não autenticado');
      const mentions = input.mentioned_user_ids?.filter((id) => id !== user.id) ?? [];
      const { error } = await sb.from('task_comments').insert({
        task_id: input.task_id,
        user_id: user.id,
        content: input.content,
        mentioned_user_ids: mentions.length > 0 ? mentions : null,
      });
      if (error) throw error;

      // Notificar mencionados via Chat Interno (1:1)
      if (mentions.length > 0) {
        try {
          const [{ data: task }, { data: profile }] = await Promise.all([
            sb.from('tasks').select('id, title').eq('id', input.task_id).maybeSingle(),
            supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
          ]);
          const authorName = profile?.full_name ?? 'Alguém';
          const taskTitle = task?.title ?? 'tarefa';
          const snippet = input.content.slice(0, 140) + (input.content.length > 140 ? '…' : '');

          await Promise.all(
            mentions.map(async (uid) => {
              const { data: convId } = await supabase.rpc('create_internal_conversation', {
                p_participant_ids: [uid],
                p_is_group: false,
                p_name: null,
              });
              if (!convId) return;
              await supabase.from('internal_messages').insert({
                conversation_id: convId as string,
                sender_id: user.id,
                content: `📋 *${authorName}* te mencionou na tarefa **${taskTitle}**\n\n${snippet}\n\n→ /tarefas?task=${input.task_id}`,
                message_type: 'text',
                mentioned_user_ids: [uid],
              });
            }),
          );
        } catch (err) {
          // não falha o comentário se notificação der erro
          console.warn('[useCreateComment] mention notification failed', err);
        }
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', vars.task_id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Subscreve Realtime nas tabelas de tarefas e invalida caches relevantes.
 * Chamado uma vez no AppLayout/Tasks page.
 */
export function useTasksRealtime() {
  const queryClient = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`tasks-realtime-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.organization_id && row.organization_id !== orgId) return;
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['contacts-tasks-summary'] });
        if (row?.id) queryClient.invalidateQueries({ queryKey: ['task-detail', row.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_subtasks' }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.task_id) queryClient.invalidateQueries({ queryKey: ['task-detail', row.task_id] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.task_id) {
          queryClient.invalidateQueries({ queryKey: ['task-comments', row.task_id] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments' }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.task_id) queryClient.invalidateQueries({ queryKey: ['task-detail', row.task_id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);
}
