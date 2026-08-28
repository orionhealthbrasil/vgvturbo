export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type BookingSource = 'public' | 'internal';
export type ReminderType = 'confirmation' | '24h' | '1h' | 'review_10min';
export type ReminderChannel = 'whatsapp' | 'email';
export type ReminderStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'skipped';

export interface Calendar {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  color: string;
  google_review_url: string | null;
  owner_user_id: string | null;
  contact_phone: string | null;
  timezone: string;
  is_active: boolean;
  reminders_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  calendar_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  slot_interval_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  requires_confirmation: boolean;
  reminders_enabled: boolean;
  google_review_url: string | null;
  confirmation_message_whatsapp: string | null;
  reminder_24h_message_whatsapp: string | null;
  reminder_1h_message_whatsapp: string | null;
  review_message_whatsapp: string | null;
  cancellation_message_whatsapp: string | null;
  reschedule_message_whatsapp: string | null;
  confirmation_subject_email: string | null;
  reminder_24h_subject_email: string | null;
  reminder_1h_subject_email: string | null;
  review_subject_email: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarAvailability {
  id: string;
  calendar_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface CalendarBlock {
  id: string;
  calendar_id: string;
  organization_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  organization_id: string;
  calendar_id: string;
  event_type_id: string;
  contact_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  source: BookingSource;
  created_by_user_id: string | null;
  cancel_token: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingReminder {
  id: string;
  booking_id: string;
  reminder_type: ReminderType;
  channel: ReminderChannel;
  scheduled_for: string;
  status: ReminderStatus;
  scheduled_message_id: string | null;
  email_log_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface PublicCalendarData {
  calendar_id: string;
  calendar_name: string;
  calendar_description: string | null;
  calendar_avatar_url: string | null;
  calendar_color: string;
  calendar_timezone: string;
  calendar_reminders_enabled: boolean;
  organization_id: string;
  organization_name: string;
  bookings_email_enabled: boolean;
  event_types: Array<{
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    min_notice_hours: number;
    max_advance_days: number;
    requires_confirmation: boolean;
    reminders_enabled: boolean;
  }>;
}

export type CalendarTemplateScope = 'global' | 'organization';

export interface CalendarTemplateAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface CalendarTemplateEventType {
  name: string;
  description?: string | null;
  duration_minutes: number;
  slot_interval_minutes?: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  min_notice_hours?: number;
  max_advance_days?: number;
  requires_confirmation?: boolean;
  reminders_enabled?: boolean;
  confirmation_message_whatsapp?: string | null;
  confirmation_subject_email?: string | null;
  reminder_24h_message_whatsapp?: string | null;
  reminder_24h_subject_email?: string | null;
  reminder_1h_message_whatsapp?: string | null;
  reminder_1h_subject_email?: string | null;
  review_message_whatsapp?: string | null;
  review_subject_email?: string | null;
  cancellation_message_whatsapp?: string | null;
  reschedule_message_whatsapp?: string | null;
  google_review_url?: string | null;
  position?: number;
}

export interface CalendarTemplate {
  id: string;
  scope: CalendarTemplateScope;
  organization_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  reminders_enabled: boolean;
  default_color: string | null;
  default_timezone: string;
  availability: CalendarTemplateAvailability[];
  event_types: CalendarTemplateEventType[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  confirmation: 'Confirmação',
  '24h': 'Lembrete 24h antes',
  '1h': 'Lembrete 1h antes',
  review_10min: 'Pedido de avaliação',
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
};

export const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  confirmed: 'bg-primary/15 text-primary',
  cancelled: 'bg-destructive/15 text-destructive',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  no_show: 'bg-muted text-muted-foreground',
};

export const DAYS_OF_WEEK: { value: number; label: string; short: string }[] = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
];

export interface ChannelReminderSummary {
  confirmation: ReminderStatus | null;
  '24h': ReminderStatus | null;
  '1h': ReminderStatus | null;
  review_10min: ReminderStatus | null;
}

export function summarizeRemindersByChannel(
  reminders: BookingReminder[],
  channel: ReminderChannel
): ChannelReminderSummary {
  const result: ChannelReminderSummary = {
    confirmation: null,
    '24h': null,
    '1h': null,
    review_10min: null,
  };
  reminders
    .filter((r) => r.channel === channel)
    .forEach((r) => {
      result[r.reminder_type] = r.status;
    });
  return result;
}
