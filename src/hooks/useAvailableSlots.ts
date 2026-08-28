import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAvailableSlots(params: {
  calendarId: string | null;
  eventTypeId: string | null;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}) {
  return useQuery({
    queryKey: ['available-slots', params.calendarId, params.eventTypeId, params.from, params.to],
    enabled: !!params.calendarId && !!params.eventTypeId,
    queryFn: async (): Promise<string[]> => {
      if (!params.calendarId || !params.eventTypeId) return [];
      const { data, error } = await supabase.rpc('get_available_slots' as any, {
        p_calendar_id: params.calendarId,
        p_event_type_id: params.eventTypeId,
        p_from: params.from,
        p_to: params.to,
      });
      if (error) throw error;
      return ((data as any[]) || []).map((r: any) => r.slot as string);
    },
  });
}

export function usePublicCalendar(slug: string | null) {
  return useQuery({
    queryKey: ['public-calendar', slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase.rpc('get_public_calendar' as any, { p_slug: slug });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return row || null;
    },
  });
}
