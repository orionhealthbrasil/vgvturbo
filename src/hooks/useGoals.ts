import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import type { Goal, GoalInput, GoalParticipant, GoalProgress, GoalStatus } from '@/types/goals';

const sb = supabase as any;

async function hydrateGoals(rawGoals: any[]): Promise<Goal[]> {
  if (rawGoals.length === 0) return [];
  const goalIds = rawGoals.map((g) => g.id);

  const [participantsRes, progressRes] = await Promise.all([
    sb.from('goal_participants').select('id, goal_id, user_id, created_at').in('goal_id', goalIds),
    sb.from('goal_progress').select('id, goal_id, user_id, current_value, deals_count, updated_at').in('goal_id', goalIds),
  ]);

  const participantRows = (participantsRes.data ?? []) as GoalParticipant[];
  const progressRows = (progressRes.data ?? []) as GoalProgress[];

  const allUserIds = Array.from(
    new Set([
      ...participantRows.map((p) => p.user_id),
      ...progressRows.map((p) => p.user_id).filter((u): u is string => !!u),
    ]),
  );

  const profilesRes = allUserIds.length
    ? await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', allUserIds)
    : { data: [] };
  const profileMap = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.user_id, p]));

  const participantsByGoal = new Map<string, GoalParticipant[]>();
  participantRows.forEach((p) => {
    const profile = profileMap.get(p.user_id);
    const list = participantsByGoal.get(p.goal_id) ?? [];
    list.push({ ...p, full_name: profile?.full_name ?? null, avatar_url: profile?.avatar_url ?? null });
    participantsByGoal.set(p.goal_id, list);
  });

  const totalByGoal = new Map<string, GoalProgress>();
  const byUserByGoal = new Map<string, GoalProgress[]>();
  progressRows.forEach((p) => {
    if (p.user_id == null) {
      totalByGoal.set(p.goal_id, p);
    } else {
      const list = byUserByGoal.get(p.goal_id) ?? [];
      list.push(p);
      byUserByGoal.set(p.goal_id, list);
    }
  });

  return rawGoals.map((g) => ({
    ...g,
    participants: participantsByGoal.get(g.id) ?? [],
    progress_total: totalByGoal.get(g.id) ?? null,
    progress_by_user: byUserByGoal.get(g.id) ?? [],
  })) as Goal[];
}

export function useGoals(status?: GoalStatus) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['goals', orgId, status ?? 'all'],
    queryFn: async (): Promise<Goal[]> => {
      if (!orgId) return [];
      let q = sb
        .from('goals')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return hydrateGoals(data ?? []);
    },
    enabled: !!orgId,
  });

  // Realtime: invalida cache quando muda goals/goal_progress da org
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`goals-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `organization_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['goals', orgId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_progress' }, () => {
        queryClient.invalidateQueries({ queryKey: ['goals', orgId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  return query;
}

export function useGoal(goalId: string | null | undefined) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['goal', goalId],
    queryFn: async (): Promise<Goal | null> => {
      if (!goalId) return null;
      const { data, error } = await sb.from('goals').select('*').eq('id', goalId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [hydrated] = await hydrateGoals([data]);
      return hydrated;
    },
    enabled: !!goalId && !!orgId,
  });
}

export function useCreateGoal() {
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GoalInput) => {
      if (!orgData?.organization.id) throw new Error('Sem organização');
      if (!user) throw new Error('Sem usuário');

      const { participant_user_ids, ...goalFields } = input;

      const { data: goal, error } = await sb
        .from('goals')
        .insert({
          ...goalFields,
          organization_id: orgData.organization.id,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.scope !== 'team' && participant_user_ids && participant_user_ids.length > 0) {
        const rows = participant_user_ids.map((uid) => ({ goal_id: goal.id, user_id: uid }));
        const { error: pErr } = await sb.from('goal_participants').insert(rows);
        if (pErr) throw pErr;
      }

      // Calcula progresso inicial
      await sb.rpc('recalculate_goal_progress', { p_goal_id: goal.id });

      return goal as Goal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<GoalInput> & { id: string }) => {
      const { participant_user_ids, ...goalFields } = input as any;
      const { data, error } = await sb.from('goals').update(goalFields).eq('id', id).select().single();
      if (error) throw error;

      if (participant_user_ids !== undefined) {
        await sb.from('goal_participants').delete().eq('goal_id', id);
        if (participant_user_ids.length > 0) {
          const rows = participant_user_ids.map((uid: string) => ({ goal_id: id, user_id: uid }));
          const { error: pErr } = await sb.from('goal_participants').insert(rows);
          if (pErr) throw pErr;
        }
      }

      await sb.rpc('recalculate_goal_progress', { p_goal_id: id });
      return data as Goal;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', vars.id] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useArchiveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: GoalStatus }) => {
      const { error } = await sb.from('goals').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

/** Lista membros da organização (para selecionar participantes). */
export function useOrganizationMembers() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['org-members-basic', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id, role, member_role')
        .eq('organization_id', orgId);
      if (error) throw error;
      const userIds = (members ?? []).map((m: any) => m.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);
      const profMap = new Map(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));
      return (members ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        member_role: m.member_role,
        full_name: profMap.get(m.user_id)?.full_name ?? null,
        avatar_url: profMap.get(m.user_id)?.avatar_url ?? null,
        email: profMap.get(m.user_id)?.email ?? null,
      }));
    },
    enabled: !!orgId,
  });
}

/** Metas do usuário logado (em que ele participa OU de equipe). */
export function useMyGoals() {
  const { data: orgData } = useUserOrganization();
  const { user } = useAuth();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['my-goals', orgId, user?.id],
    queryFn: async (): Promise<Goal[]> => {
      if (!orgId || !user) return [];
      const { data: allGoals, error } = await sb
        .from('goals')
        .select('*')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('period_end', { ascending: true });
      if (error) throw error;

      const goals = (allGoals ?? []) as any[];
      const ids = goals.map((g) => g.id);
      if (ids.length === 0) return [];

      const { data: parts } = await sb
        .from('goal_participants')
        .select('goal_id, user_id')
        .in('goal_id', ids)
        .eq('user_id', user.id);
      const myParticipantGoals = new Set(((parts ?? []) as any[]).map((p) => p.goal_id));

      const filtered = goals.filter((g) => g.scope === 'team' || myParticipantGoals.has(g.id));
      return hydrateGoals(filtered);
    },
    enabled: !!orgId && !!user,
  });
}
