import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { Calendar } from '@/types/booking';

export function useCalendars() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useQuery({
    queryKey: ['calendars', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Calendar[]> => {
      const { data, error } = await supabase
        .from('calendars' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Calendar[];
    },
  });
}

export function useCalendar(id: string | null) {
  return useQuery({
    queryKey: ['calendar', id],
    enabled: !!id,
    queryFn: async (): Promise<Calendar | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('calendars' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Calendar | null;
    },
  });
}

export function useCreateCalendar() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: Partial<Calendar> & { name: string; slug: string }) => {
      if (!orgId) throw new Error('No org');
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No user');
      const { data, error } = await supabase
        .from('calendars' as any)
        .insert({
          ...input,
          organization_id: orgId,
          created_by: user.user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Calendar;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendars', orgId] });
      toast.success('Calendário criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar calendário'),
  });
}

export function useUpdateCalendar() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Calendar> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendars' as any)
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Calendar;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendars', orgId] });
      toast.success('Calendário atualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });
}

export function useDeleteCalendar() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendars' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendars', orgId] });
      toast.success('Calendário removido');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
  });
}
