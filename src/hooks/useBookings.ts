import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { Booking, BookingReminder, BookingStatus } from '@/types/booking';

export function useBookings(params: {
  calendarId?: string | null;
  from?: string;
  to?: string;
  contactId?: string | null;
}) {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const qc = useQueryClient();

  // Realtime
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`bookings-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `organization_id=eq.${orgId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['bookings'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orgId, qc]);

  return useQuery({
    queryKey: ['bookings', orgId, params.calendarId ?? 'all', params.from, params.to, params.contactId ?? null],
    enabled: !!orgId,
    queryFn: async (): Promise<Booking[]> => {
      if (!orgId) return [];
      let q = supabase
        .from('bookings' as any)
        .select('id, organization_id, calendar_id, event_type_id, contact_id, customer_name, customer_phone, customer_email, starts_at, ends_at, status, notes, cancellation_reason, cancelled_at, source, created_by_user_id, cancel_token, created_at, updated_at')
        .eq('organization_id', orgId)
        .order('starts_at', { ascending: true });
      if (params.calendarId) q = q.eq('calendar_id', params.calendarId);
      if (params.contactId) q = q.eq('contact_id', params.contactId);
      if (params.from) q = q.gte('starts_at', params.from);
      if (params.to) q = q.lte('starts_at', params.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Booking[];
    },
  });
}

export function useBookingReminders(bookingId: string | null) {
  return useQuery({
    queryKey: ['booking-reminders', bookingId],
    enabled: !!bookingId,
    queryFn: async (): Promise<BookingReminder[]> => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from('booking_reminders' as any)
        .select('*')
        .eq('booking_id', bookingId)
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BookingReminder[];
    },
  });
}

export function useCreateInternalBooking() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      calendar_id: string;
      event_type_id: string;
      starts_at: string;
      contact_id?: string | null;
      customer_name: string;
      customer_phone: string;
      customer_email?: string | null;
      notes?: string | null;
      skip_reminders?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('create_internal_booking' as any, {
        p_calendar_id: input.calendar_id,
        p_event_type_id: input.event_type_id,
        p_starts_at: input.starts_at,
        p_contact_id: input.contact_id ?? null,
        p_customer_name: input.customer_name,
        p_customer_phone: input.customer_phone,
        p_customer_email: input.customer_email ?? null,
        p_notes: input.notes ?? null,
        p_skip_reminders: input.skip_reminders ?? false,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['available-slots'] });
      toast.success('Agendamento criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar agendamento'),
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      cancellation_reason,
    }: {
      id: string;
      status: BookingStatus;
      cancellation_reason?: string;
    }) => {
      const patch: any = { status };
      if (status === 'cancelled') {
        patch.cancelled_at = new Date().toISOString();
        if (cancellation_reason) patch.cancellation_reason = cancellation_reason;
      }
      const { data, error } = await supabase
        .from('bookings' as any)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Skip pending reminders if cancelled or no_show
      if (status === 'cancelled' || status === 'no_show') {
        await supabase
          .from('booking_reminders' as any)
          .update({ status: 'skipped' })
          .eq('booking_id', id)
          .eq('status', 'pending');
      }

      return data as unknown as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-reminders'] });
      toast.success('Agendamento atualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useRescheduleBooking() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      starts_at,
      ends_at,
    }: {
      id: string;
      starts_at: string;
      ends_at: string;
    }) => {
      // Skip pending reminders for old slot
      await supabase
        .from('booking_reminders' as any)
        .update({ status: 'skipped' })
        .eq('booking_id', id)
        .in('reminder_type', ['24h', '1h', 'review_10min'])
        .eq('status', 'pending');

      const { data, error } = await supabase
        .from('bookings' as any)
        .update({ starts_at, ends_at })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      const booking = data as unknown as Booking;

      // Recreate reminders for new slot (whatsapp always; email if applicable)
      const newReminders: any[] = [
        { booking_id: id, reminder_type: '24h', channel: 'whatsapp', scheduled_for: new Date(new Date(starts_at).getTime() - 24 * 3600_000).toISOString() },
        { booking_id: id, reminder_type: '1h', channel: 'whatsapp', scheduled_for: new Date(new Date(starts_at).getTime() - 3600_000).toISOString() },
        { booking_id: id, reminder_type: 'review_10min', channel: 'whatsapp', scheduled_for: new Date(new Date(ends_at).getTime() + 10 * 60_000).toISOString() },
      ];

      if (booking.customer_email) {
        const { data: org } = await supabase
          .from('organizations')
          .select('bookings_email_enabled')
          .eq('id', booking.organization_id)
          .maybeSingle();
        if ((org as any)?.bookings_email_enabled) {
          newReminders.push(
            { booking_id: id, reminder_type: '24h', channel: 'email', scheduled_for: new Date(new Date(starts_at).getTime() - 24 * 3600_000).toISOString() },
            { booking_id: id, reminder_type: '1h', channel: 'email', scheduled_for: new Date(new Date(starts_at).getTime() - 3600_000).toISOString() },
            { booking_id: id, reminder_type: 'review_10min', channel: 'email', scheduled_for: new Date(new Date(ends_at).getTime() + 10 * 60_000).toISOString() }
          );
        }
      }

      await supabase.from('booking_reminders' as any).upsert(newReminders, {
        onConflict: 'booking_id,reminder_type,channel',
      } as any);

      return booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking-reminders'] });
      qc.invalidateQueries({ queryKey: ['available-slots'] });
      toast.success('Agendamento reagendado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao reagendar'),
  });
}
