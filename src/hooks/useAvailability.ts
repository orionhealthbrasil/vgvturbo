import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CalendarAvailability, CalendarBlock } from '@/types/booking';

export function useAvailability(calendarId: string | null) {
  return useQuery({
    queryKey: ['availability', calendarId],
    enabled: !!calendarId,
    queryFn: async (): Promise<CalendarAvailability[]> => {
      if (!calendarId) return [];
      const { data, error } = await supabase
        .from('calendar_availability' as any)
        .select('*')
        .eq('calendar_id', calendarId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CalendarAvailability[];
    },
  });
}

export function useReplaceAvailability() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      calendar_id,
      windows,
    }: {
      calendar_id: string;
      windows: Array<{ day_of_week: number; start_time: string; end_time: string }>;
    }) => {
      // Replace all windows for the calendar
      const { error: delErr } = await supabase
        .from('calendar_availability' as any)
        .delete()
        .eq('calendar_id', calendar_id);
      if (delErr) throw delErr;

      if (windows.length > 0) {
        const { error: insErr } = await supabase
          .from('calendar_availability' as any)
          .insert(windows.map((w) => ({ ...w, calendar_id })) as any);
        if (insErr) throw insErr;
      }

      return { calendar_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['availability', data.calendar_id] });
      toast.success('Disponibilidade salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useCalendarBlocks(calendarId: string | null) {
  return useQuery({
    queryKey: ['calendar-blocks', calendarId],
    enabled: !!calendarId,
    queryFn: async (): Promise<CalendarBlock[]> => {
      if (!calendarId) return [];
      const { data, error } = await supabase
        .from('calendar_blocks' as any)
        .select('*')
        .eq('calendar_id', calendarId)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CalendarBlock[];
    },
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      calendar_id: string;
      organization_id: string;
      starts_at: string;
      ends_at: string;
      reason?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('calendar_blocks' as any)
        .insert({ ...input, created_by: user.user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CalendarBlock;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['calendar-blocks', data.calendar_id] });
      toast.success('Bloqueio criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, calendar_id }: { id: string; calendar_id: string }) => {
      const { error } = await supabase.from('calendar_blocks' as any).delete().eq('id', id);
      if (error) throw error;
      return { calendar_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['calendar-blocks', data.calendar_id] });
      toast.success('Bloqueio removido');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}
