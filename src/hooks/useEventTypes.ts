import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { EventType } from '@/types/booking';

export function useEventTypes(calendarId: string | null) {
  return useQuery({
    queryKey: ['event-types', calendarId],
    enabled: !!calendarId,
    queryFn: async (): Promise<EventType[]> => {
      if (!calendarId) return [];
      const { data, error } = await supabase
        .from('event_types' as any)
        .select('*')
        .eq('calendar_id', calendarId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EventType[];
    },
  });
}

export function useCreateEventType() {
  const qc = useQueryClient();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;

  return useMutation({
    mutationFn: async (input: Partial<EventType> & { calendar_id: string; name: string }) => {
      if (!orgId) throw new Error('No org');
      const { data, error } = await supabase
        .from('event_types' as any)
        .insert({ ...input, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EventType;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['event-types', vars.calendar_id] });
      toast.success('Tipo de evento criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useUpdateEventType() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EventType> & { id: string }) => {
      const { data, error } = await supabase
        .from('event_types' as any)
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EventType;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['event-types', data.calendar_id] });
      toast.success('Tipo atualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useDeleteEventType() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, calendar_id }: { id: string; calendar_id: string }) => {
      const { error } = await supabase.from('event_types' as any).delete().eq('id', id);
      if (error) throw error;
      return { calendar_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['event-types', data.calendar_id] });
      toast.success('Tipo removido');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}
