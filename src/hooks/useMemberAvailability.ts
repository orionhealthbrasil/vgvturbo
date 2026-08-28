import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';

/**
 * Hook para ler/atualizar o status "Disponível" (On/Off) do próprio
 * usuário dentro da organização atual. Quando OFF, o usuário não é
 * considerado em atribuições automáticas (random/round-robin/least-busy).
 */
export function useMemberAvailability() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const queryClient = useQueryClient();
  const orgId = orgData?.organization.id;
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['member-availability', orgId, userId],
    enabled: !!orgId && !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('is_available, offline_until, offline_set_by_admin')
        .eq('organization_id', orgId!)
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as any;
      // Auto-reactivate if offline_until has passed and admin didn't force this
      if (row && !row.is_available && !row.offline_set_by_admin && row.offline_until) {
        const until = new Date(row.offline_until);
        if (until <= new Date()) {
          await supabase
            .from('organization_members')
            .update({ is_available: true, offline_until: null } as any)
            .eq('organization_id', orgId!)
            .eq('user_id', userId!);
          return true;
        }
      }
      return row?.is_available ?? true;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ next, offlineUntil }: { next: boolean; offlineUntil?: string | null }) => {
      const patch: Record<string, unknown> = {
        is_available: next,
        offline_set_by_admin: false,
        offline_until: next ? null : (offlineUntil ?? null),
      };
      const { error } = await supabase
        .from('organization_members')
        .update(patch as any)
        .eq('organization_id', orgId!)
        .eq('user_id', userId!);
      if (error) throw error;
      return next;
    },
    onMutate: async ({ next }: { next: boolean; offlineUntil?: string | null }) => {
      await queryClient.cancelQueries({ queryKey: ['member-availability', orgId, userId] });
      const prev = queryClient.getQueryData<boolean>(['member-availability', orgId, userId]);
      queryClient.setQueryData(['member-availability', orgId, userId], next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(['member-availability', orgId, userId], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['member-availability', orgId, userId] });
      queryClient.invalidateQueries({ queryKey: ['organization-members', orgId] });
    },
  });

  // Realtime: sincroniza alterações feitas em outras abas/dispositivos
  useEffect(() => {
    if (!orgId || !userId) return;
    const channel = supabase
      .channel(`member-availability-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organization_members',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as any)?.is_available;
          if (typeof next === 'boolean') {
            queryClient.setQueryData(['member-availability', orgId, userId], next);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, userId, queryClient]);

  const getOfflineUntil = useCallback((next: boolean): string | null => {
    if (next) return null;
    const org = (orgData?.organization as any);
    if (!org?.vendor_offline_auto_reactivate) return null;
    const minutes = org.vendor_offline_reactivate_minutes ?? 30;
    const until = new Date(Date.now() + minutes * 60 * 1000);
    return until.toISOString();
  }, [orgData]);

  return {
    isAvailable: query.data ?? true,
    isLoading: query.isLoading,
    setAvailable: (next: boolean) => mutation.mutate({ next, offlineUntil: getOfflineUntil(next) }),
    toggleAvailable: () => {
      const next = !(query.data ?? true);
      mutation.mutate({ next, offlineUntil: getOfflineUntil(next) });
    },
    isUpdating: mutation.isPending,
  };
}

/**
 * Hook auxiliar: retorna o is_available de um membro arbitrário a partir
 * da lista de membros (útil para mostrar badges "Off" no dropdown de
 * atribuição manual).
 */
export function useMembersAvailability() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['members-availability', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, is_available')
        .eq('organization_id', orgId!);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((m: any) => {
        map[m.user_id] = m.is_available ?? true;
      });
      return map;
    },
  });
}
