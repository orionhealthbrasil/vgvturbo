-- ============================================================
-- FASE 4 — Sistema de Agendamento (Calendly-like)
-- ============================================================

-- 0) Flag de email em organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS bookings_email_enabled BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 1) Tabela: calendars
-- ============================================================
CREATE TABLE public.calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  google_review_url TEXT,
  owner_user_id UUID,
  contact_phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);
CREATE INDEX idx_calendars_org ON public.calendars(organization_id, is_active);
CREATE INDEX idx_calendars_slug ON public.calendars(slug);
CREATE INDEX idx_calendars_owner ON public.calendars(owner_user_id);
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_calendars_updated BEFORE UPDATE ON public.calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members view calendars" ON public.calendars FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Owners/admins manage calendars" ON public.calendars FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=calendars.organization_id
    AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=calendars.organization_id
    AND om.role IN ('owner','admin')));

-- ============================================================
-- 2) Tabela: event_types
-- ============================================================
CREATE TABLE public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 30,
  buffer_before_minutes INT NOT NULL DEFAULT 0,
  buffer_after_minutes INT NOT NULL DEFAULT 0,
  slot_interval_minutes INT NOT NULL DEFAULT 30,
  min_notice_hours INT NOT NULL DEFAULT 2,
  max_advance_days INT NOT NULL DEFAULT 60,
  requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  google_review_url TEXT,
  -- Mensagens customizáveis (com placeholders {nome},{hora},{data},{profissional},{link_avaliacao})
  confirmation_message_whatsapp TEXT,
  reminder_24h_message_whatsapp TEXT,
  reminder_1h_message_whatsapp TEXT,
  review_message_whatsapp TEXT,
  cancellation_message_whatsapp TEXT,
  reschedule_message_whatsapp TEXT,
  confirmation_subject_email TEXT,
  reminder_24h_subject_email TEXT,
  reminder_1h_subject_email TEXT,
  review_subject_email TEXT,
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_types_cal ON public.event_types(calendar_id, is_active);
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_event_types_updated BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members view event types" ON public.event_types FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Owners/admins manage event types" ON public.event_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=event_types.organization_id
    AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=event_types.organization_id
    AND om.role IN ('owner','admin')));

-- ============================================================
-- 3) Tabela: calendar_availability
-- ============================================================
CREATE TABLE public.calendar_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX idx_avail_cal ON public.calendar_availability(calendar_id, day_of_week);
ALTER TABLE public.calendar_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view availability" ON public.calendar_availability FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.calendars c
    WHERE c.id=calendar_availability.calendar_id
    AND public.user_belongs_to_org(auth.uid(), c.organization_id)));
CREATE POLICY "Owners/admins manage availability" ON public.calendar_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM public.calendars c
    JOIN public.organization_members om ON om.organization_id=c.organization_id
    WHERE c.id=calendar_availability.calendar_id
    AND om.user_id=auth.uid() AND om.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.calendars c
    JOIN public.organization_members om ON om.organization_id=c.organization_id
    WHERE c.id=calendar_availability.calendar_id
    AND om.user_id=auth.uid() AND om.role IN ('owner','admin')));

-- ============================================================
-- 4) Tabela: calendar_blocks
-- ============================================================
CREATE TABLE public.calendar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_blocks_cal_range ON public.calendar_blocks(calendar_id, starts_at, ends_at);
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view blocks" ON public.calendar_blocks FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "Owners/admins/calendar owner manage blocks" ON public.calendar_blocks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id=auth.uid() AND om.organization_id=calendar_blocks.organization_id
      AND om.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.calendars c
      WHERE c.id=calendar_blocks.calendar_id AND c.owner_user_id=auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id=auth.uid() AND om.organization_id=calendar_blocks.organization_id
      AND om.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.calendars c
      WHERE c.id=calendar_blocks.calendar_id AND c.owner_user_id=auth.uid())
  );

-- ============================================================
-- 5) Tabela: bookings
-- ============================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE RESTRICT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'public' CHECK (source IN ('public','internal')),
  created_by_user_id UUID,
  cancel_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_cal_range ON public.bookings(calendar_id, starts_at) WHERE status IN ('confirmed','pending');
CREATE INDEX idx_bookings_org_range ON public.bookings(organization_id, starts_at);
CREATE INDEX idx_bookings_contact ON public.bookings(contact_id);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
CREATE TRIGGER tg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members view bookings" ON public.bookings FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Members with permission manage bookings" ON public.bookings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id=auth.uid() AND om.organization_id=bookings.organization_id
      AND (om.role IN ('owner','admin') OR om.member_role IN ('admin','analyst')))
    OR EXISTS (SELECT 1 FROM public.calendars c
      WHERE c.id=bookings.calendar_id AND c.owner_user_id=auth.uid())
  );

CREATE POLICY "Members with permission insert bookings" ON public.bookings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id=auth.uid() AND om.organization_id=bookings.organization_id
      AND (om.role IN ('owner','admin') OR om.member_role IN ('admin','analyst')))
    OR EXISTS (SELECT 1 FROM public.calendars c
      WHERE c.id=bookings.calendar_id AND c.owner_user_id=auth.uid())
  );

CREATE POLICY "Owners/admins delete bookings" ON public.bookings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.organization_members om
    WHERE om.user_id=auth.uid() AND om.organization_id=bookings.organization_id
    AND om.role IN ('owner','admin')));

-- ============================================================
-- 6) Tabela: booking_reminders
-- ============================================================
CREATE TABLE public.booking_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL
    CHECK (reminder_type IN ('confirmation','24h','1h','review_10min')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','failed','skipped')),
  scheduled_message_id UUID,
  email_log_id UUID,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(booking_id, reminder_type, channel)
);
CREATE INDEX idx_reminders_pending ON public.booking_reminders(scheduled_for) WHERE status='pending';
CREATE INDEX idx_reminders_booking ON public.booking_reminders(booking_id);
ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view reminders" ON public.booking_reminders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bookings b
    WHERE b.id=booking_reminders.booking_id
    AND public.user_belongs_to_org(auth.uid(), b.organization_id)));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_reminders;

-- ============================================================
-- 7) RPC pública: get_public_calendar
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_calendar(p_slug TEXT)
RETURNS TABLE(
  calendar_id UUID,
  calendar_name TEXT,
  calendar_description TEXT,
  calendar_avatar_url TEXT,
  calendar_color TEXT,
  calendar_timezone TEXT,
  organization_id UUID,
  organization_name TEXT,
  bookings_email_enabled BOOLEAN,
  event_types JSONB
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.description,
    c.avatar_url,
    c.color,
    c.timezone,
    c.organization_id,
    o.name,
    o.bookings_email_enabled,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', et.id,
        'name', et.name,
        'description', et.description,
        'duration_minutes', et.duration_minutes,
        'min_notice_hours', et.min_notice_hours,
        'max_advance_days', et.max_advance_days,
        'requires_confirmation', et.requires_confirmation
      ) ORDER BY et.position, et.created_at)
      FROM public.event_types et
      WHERE et.calendar_id = c.id AND et.is_active = true
    ), '[]'::jsonb)
  FROM public.calendars c
  JOIN public.organizations o ON o.id = c.organization_id
  WHERE c.slug = p_slug AND c.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_calendar(TEXT) TO anon, authenticated;

-- ============================================================
-- 8) RPC pública: get_available_slots
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_calendar_id UUID,
  p_event_type_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE(slot TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cal RECORD;
  v_et RECORD;
  v_day DATE;
  v_dow INT;
  v_avail RECORD;
  v_slot TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_min_notice TIMESTAMPTZ;
  v_max_date DATE;
  v_loop_end DATE;
BEGIN
  -- Limita a 14 dias por chamada
  v_loop_end := LEAST(p_to, p_from + INTERVAL '14 days')::DATE;

  SELECT * INTO v_cal FROM public.calendars WHERE id = p_calendar_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_et FROM public.event_types WHERE id = p_event_type_id AND calendar_id = p_calendar_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  v_min_notice := v_now + (v_et.min_notice_hours || ' hours')::INTERVAL;
  v_max_date := (v_now::DATE) + v_et.max_advance_days;

  v_day := GREATEST(p_from, v_now::DATE);
  WHILE v_day <= LEAST(v_loop_end, v_max_date) LOOP
    v_dow := EXTRACT(DOW FROM v_day)::INT;

    -- Pula feriados fechados
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_holidays h
      WHERE h.organization_id = v_cal.organization_id
        AND h.holiday_date = v_day
        AND h.is_closed = true
    ) THEN
      FOR v_avail IN
        SELECT start_time, end_time FROM public.calendar_availability
        WHERE calendar_id = p_calendar_id AND day_of_week = v_dow
        ORDER BY start_time
      LOOP
        v_slot := (v_day + v_avail.start_time) AT TIME ZONE v_cal.timezone;
        WHILE v_slot + (v_et.duration_minutes || ' minutes')::INTERVAL <= (v_day + v_avail.end_time) AT TIME ZONE v_cal.timezone LOOP
          v_slot_end := v_slot + (v_et.duration_minutes || ' minutes')::INTERVAL;

          IF v_slot >= v_min_notice
             AND NOT EXISTS (
               SELECT 1 FROM public.bookings b
               WHERE b.calendar_id = p_calendar_id
                 AND b.status IN ('confirmed','pending')
                 AND tstzrange(
                   b.starts_at - (v_et.buffer_before_minutes || ' minutes')::INTERVAL,
                   b.ends_at + (v_et.buffer_after_minutes || ' minutes')::INTERVAL,
                   '[)'
                 ) && tstzrange(v_slot, v_slot_end, '[)')
             )
             AND NOT EXISTS (
               SELECT 1 FROM public.calendar_blocks cb
               WHERE cb.calendar_id = p_calendar_id
                 AND tstzrange(cb.starts_at, cb.ends_at, '[)') && tstzrange(v_slot, v_slot_end, '[)')
             )
          THEN
            slot := v_slot;
            RETURN NEXT;
          END IF;

          v_slot := v_slot + (v_et.slot_interval_minutes || ' minutes')::INTERVAL;
        END LOOP;
      END LOOP;
    END IF;

    v_day := v_day + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, DATE, DATE) TO anon, authenticated;

-- ============================================================
-- 9) RPC interna: create_internal_booking
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_internal_booking(
  p_calendar_id UUID,
  p_event_type_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_contact_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_notes TEXT,
  p_skip_reminders BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_cal RECORD;
  v_et RECORD;
  v_org_id UUID;
  v_can BOOLEAN;
  v_ends_at TIMESTAMPTZ;
  v_booking_id UUID;
  v_slot_free BOOLEAN;
  v_email_enabled BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_cal FROM public.calendars WHERE id = p_calendar_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calendar not found'; END IF;

  SELECT * INTO v_et FROM public.event_types WHERE id = p_event_type_id AND calendar_id = p_calendar_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event type not found'; END IF;

  v_org_id := v_cal.organization_id;

  -- Permissão: owner/admin OU member_role admin/analyst OU calendar owner
  SELECT (
    EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = v_user AND om.organization_id = v_org_id
        AND (om.role IN ('owner','admin') OR om.member_role IN ('admin','analyst')))
    OR v_cal.owner_user_id = v_user
  ) INTO v_can;
  IF NOT v_can THEN RAISE EXCEPTION 'Permission denied'; END IF;

  v_ends_at := p_starts_at + (v_et.duration_minutes || ' minutes')::INTERVAL;

  -- Re-check slot livre
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.calendar_id = p_calendar_id
      AND b.status IN ('confirmed','pending')
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.calendar_blocks cb
    WHERE cb.calendar_id = p_calendar_id
      AND tstzrange(cb.starts_at, cb.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) INTO v_slot_free;

  IF NOT v_slot_free THEN RAISE EXCEPTION 'Slot not available'; END IF;

  -- Validar contact_id se fornecido
  IF p_contact_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = p_contact_id AND organization_id = v_org_id) THEN
      RAISE EXCEPTION 'Contact not in organization';
    END IF;
  END IF;

  -- Inserir booking
  INSERT INTO public.bookings (
    organization_id, calendar_id, event_type_id, contact_id,
    customer_name, customer_phone, customer_email,
    starts_at, ends_at, status, notes, source, created_by_user_id
  ) VALUES (
    v_org_id, p_calendar_id, p_event_type_id, p_contact_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_starts_at, v_ends_at,
    CASE WHEN v_et.requires_confirmation THEN 'pending' ELSE 'confirmed' END,
    p_notes, 'internal', v_user
  ) RETURNING id INTO v_booking_id;

  -- Criar reminders se não pulado
  IF NOT p_skip_reminders THEN
    SELECT bookings_email_enabled INTO v_email_enabled FROM public.organizations WHERE id = v_org_id;

    -- WhatsApp reminders (sempre)
    INSERT INTO public.booking_reminders (booking_id, reminder_type, channel, scheduled_for) VALUES
      (v_booking_id, 'confirmation', 'whatsapp', now()),
      (v_booking_id, '24h', 'whatsapp', p_starts_at - INTERVAL '24 hours'),
      (v_booking_id, '1h', 'whatsapp', p_starts_at - INTERVAL '1 hour'),
      (v_booking_id, 'review_10min', 'whatsapp', v_ends_at + INTERVAL '10 minutes');

    -- Email reminders (se org liberou e email presente)
    IF v_email_enabled AND p_customer_email IS NOT NULL AND p_customer_email <> '' THEN
      INSERT INTO public.booking_reminders (booking_id, reminder_type, channel, scheduled_for) VALUES
        (v_booking_id, 'confirmation', 'email', now()),
        (v_booking_id, '24h', 'email', p_starts_at - INTERVAL '24 hours'),
        (v_booking_id, '1h', 'email', p_starts_at - INTERVAL '1 hour'),
        (v_booking_id, 'review_10min', 'email', v_ends_at + INTERVAL '10 minutes');
    END IF;
  END IF;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_internal_booking(UUID, UUID, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;