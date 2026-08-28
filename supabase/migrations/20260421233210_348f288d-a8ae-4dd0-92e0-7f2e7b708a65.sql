-- =====================================================
-- PARTE 1: Calendários silenciosos
-- =====================================================

ALTER TABLE public.calendars
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.create_internal_booking(
  p_calendar_id uuid,
  p_event_type_id uuid,
  p_starts_at timestamp with time zone,
  p_contact_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_notes text,
  p_skip_reminders boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_reminders_on BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_cal FROM public.calendars WHERE id = p_calendar_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calendar not found'; END IF;

  SELECT * INTO v_et FROM public.event_types WHERE id = p_event_type_id AND calendar_id = p_calendar_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event type not found'; END IF;

  v_org_id := v_cal.organization_id;

  SELECT (
    EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = v_user AND om.organization_id = v_org_id
        AND (om.role IN ('owner','admin') OR om.member_role IN ('admin','analyst')))
    OR v_cal.owner_user_id = v_user
  ) INTO v_can;
  IF NOT v_can THEN RAISE EXCEPTION 'Permission denied'; END IF;

  v_ends_at := p_starts_at + (v_et.duration_minutes || ' minutes')::INTERVAL;

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

  IF p_contact_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = p_contact_id AND organization_id = v_org_id) THEN
      RAISE EXCEPTION 'Contact not in organization';
    END IF;
  END IF;

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

  v_reminders_on := COALESCE(v_cal.reminders_enabled, true) AND COALESCE(v_et.reminders_enabled, true);

  IF NOT p_skip_reminders AND v_reminders_on THEN
    SELECT bookings_email_enabled INTO v_email_enabled FROM public.organizations WHERE id = v_org_id;

    INSERT INTO public.booking_reminders (booking_id, reminder_type, channel, scheduled_for) VALUES
      (v_booking_id, 'confirmation', 'whatsapp', now()),
      (v_booking_id, '24h', 'whatsapp', p_starts_at - INTERVAL '24 hours'),
      (v_booking_id, '1h', 'whatsapp', p_starts_at - INTERVAL '1 hour'),
      (v_booking_id, 'review_10min', 'whatsapp', v_ends_at + INTERVAL '10 minutes');

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
$function$;

DROP FUNCTION IF EXISTS public.get_public_calendar(text);

CREATE FUNCTION public.get_public_calendar(p_slug text)
RETURNS TABLE(
  calendar_id uuid,
  calendar_name text,
  calendar_description text,
  calendar_avatar_url text,
  calendar_color text,
  calendar_timezone text,
  calendar_reminders_enabled boolean,
  organization_id uuid,
  organization_name text,
  bookings_email_enabled boolean,
  event_types jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.name,
    c.description,
    c.avatar_url,
    c.color,
    c.timezone,
    c.reminders_enabled,
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
        'requires_confirmation', et.requires_confirmation,
        'reminders_enabled', et.reminders_enabled
      ) ORDER BY et.position, et.created_at)
      FROM public.event_types et
      WHERE et.calendar_id = c.id AND et.is_active = true
    ), '[]'::jsonb)
  FROM public.calendars c
  JOIN public.organizations o ON o.id = c.organization_id
  WHERE c.slug = p_slug AND c.is_active = true
  LIMIT 1;
$function$;

-- =====================================================
-- PARTE 2: Templates de calendário
-- =====================================================

CREATE TABLE IF NOT EXISTS public.calendar_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','organization')),
  organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  default_color TEXT DEFAULT '#6366f1',
  default_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_templates_org_consistent CHECK (
    (scope = 'global' AND organization_id IS NULL) OR
    (scope = 'organization' AND organization_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_calendar_templates_scope ON public.calendar_templates(scope, is_active);
CREATE INDEX IF NOT EXISTS idx_calendar_templates_org ON public.calendar_templates(organization_id) WHERE organization_id IS NOT NULL;

ALTER TABLE public.calendar_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View global active templates and own org templates"
ON public.calendar_templates FOR SELECT
TO authenticated
USING (
  (scope = 'global' AND is_active = true)
  OR (scope = 'organization' AND public.user_belongs_to_org(auth.uid(), organization_id))
);

CREATE POLICY "Super admin can insert global templates"
ON public.calendar_templates FOR INSERT
TO authenticated
WITH CHECK (scope = 'global' AND public.is_super_admin());

CREATE POLICY "Org owners/admins can insert org templates"
ON public.calendar_templates FOR INSERT
TO authenticated
WITH CHECK (
  scope = 'organization'
  AND organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = calendar_templates.organization_id
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "Super admin can update global templates"
ON public.calendar_templates FOR UPDATE
TO authenticated
USING (scope = 'global' AND public.is_super_admin())
WITH CHECK (scope = 'global' AND public.is_super_admin());

CREATE POLICY "Org owners/admins can update org templates"
ON public.calendar_templates FOR UPDATE
TO authenticated
USING (
  scope = 'organization'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = calendar_templates.organization_id
      AND om.role IN ('owner','admin')
  )
)
WITH CHECK (
  scope = 'organization'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = calendar_templates.organization_id
      AND om.role IN ('owner','admin')
  )
);

CREATE POLICY "Super admin can delete global templates"
ON public.calendar_templates FOR DELETE
TO authenticated
USING (scope = 'global' AND public.is_super_admin());

CREATE POLICY "Org owners/admins can delete org templates"
ON public.calendar_templates FOR DELETE
TO authenticated
USING (
  scope = 'organization'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = calendar_templates.organization_id
      AND om.role IN ('owner','admin')
  )
);

CREATE TRIGGER calendar_templates_updated_at
BEFORE UPDATE ON public.calendar_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_calendar_template(
  p_template_id uuid,
  p_calendar_name text,
  p_slug text,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org_id UUID;
  v_template RECORD;
  v_calendar_id UUID;
  v_avail JSONB;
  v_et JSONB;
  v_can BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_calendar_name IS NULL OR btrim(p_calendar_name) = '' THEN
    RAISE EXCEPTION 'Calendar name is required';
  END IF;
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'Slug is required';
  END IF;

  v_org_id := public.get_user_organization_id(v_user);
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = v_user
      AND om.organization_id = v_org_id
      AND om.role IN ('owner','admin')
  ) INTO v_can;
  IF NOT v_can THEN RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT * INTO v_template
  FROM public.calendar_templates
  WHERE id = p_template_id
    AND is_active = true
    AND (scope = 'global' OR (scope = 'organization' AND organization_id = v_org_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found or not accessible'; END IF;

  INSERT INTO public.calendars (
    organization_id, name, slug, description, color, timezone,
    reminders_enabled, owner_user_id, created_by, is_active
  ) VALUES (
    v_org_id,
    btrim(p_calendar_name),
    btrim(p_slug),
    v_template.description,
    COALESCE(v_template.default_color, '#6366f1'),
    COALESCE(v_template.default_timezone, 'America/Sao_Paulo'),
    COALESCE(v_template.reminders_enabled, true),
    COALESCE(p_owner_user_id, v_user),
    v_user,
    true
  ) RETURNING id INTO v_calendar_id;

  IF v_template.availability IS NOT NULL AND jsonb_array_length(v_template.availability) > 0 THEN
    FOR v_avail IN SELECT * FROM jsonb_array_elements(v_template.availability)
    LOOP
      INSERT INTO public.calendar_availability (
        calendar_id, day_of_week, start_time, end_time
      ) VALUES (
        v_calendar_id,
        (v_avail->>'day_of_week')::int,
        (v_avail->>'start_time')::time,
        (v_avail->>'end_time')::time
      );
    END LOOP;
  END IF;

  IF v_template.event_types IS NOT NULL AND jsonb_array_length(v_template.event_types) > 0 THEN
    FOR v_et IN SELECT * FROM jsonb_array_elements(v_template.event_types)
    LOOP
      INSERT INTO public.event_types (
        organization_id, calendar_id, name, description,
        duration_minutes, slot_interval_minutes,
        buffer_before_minutes, buffer_after_minutes,
        min_notice_hours, max_advance_days,
        requires_confirmation, reminders_enabled,
        confirmation_message_whatsapp, confirmation_subject_email,
        reminder_24h_message_whatsapp, reminder_24h_subject_email,
        reminder_1h_message_whatsapp, reminder_1h_subject_email,
        review_message_whatsapp, review_subject_email,
        cancellation_message_whatsapp, reschedule_message_whatsapp,
        google_review_url, position, is_active
      ) VALUES (
        v_org_id, v_calendar_id,
        v_et->>'name',
        v_et->>'description',
        COALESCE((v_et->>'duration_minutes')::int, 30),
        COALESCE((v_et->>'slot_interval_minutes')::int, 30),
        COALESCE((v_et->>'buffer_before_minutes')::int, 0),
        COALESCE((v_et->>'buffer_after_minutes')::int, 0),
        COALESCE((v_et->>'min_notice_hours')::int, 2),
        COALESCE((v_et->>'max_advance_days')::int, 60),
        COALESCE((v_et->>'requires_confirmation')::boolean, false),
        COALESCE((v_et->>'reminders_enabled')::boolean, true),
        v_et->>'confirmation_message_whatsapp',
        v_et->>'confirmation_subject_email',
        v_et->>'reminder_24h_message_whatsapp',
        v_et->>'reminder_24h_subject_email',
        v_et->>'reminder_1h_message_whatsapp',
        v_et->>'reminder_1h_subject_email',
        v_et->>'review_message_whatsapp',
        v_et->>'review_subject_email',
        v_et->>'cancellation_message_whatsapp',
        v_et->>'reschedule_message_whatsapp',
        v_et->>'google_review_url',
        COALESCE((v_et->>'position')::int, 0),
        true
      );
    END LOOP;
  END IF;

  RETURN v_calendar_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_calendar_as_template(
  p_calendar_id uuid,
  p_template_name text,
  p_scope text,
  p_category text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_icon text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_cal RECORD;
  v_org_id UUID;
  v_template_id UUID;
  v_availability JSONB;
  v_event_types JSONB;
  v_can BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_template_name IS NULL OR btrim(p_template_name) = '' THEN
    RAISE EXCEPTION 'Template name is required';
  END IF;
  IF p_scope NOT IN ('global','organization') THEN
    RAISE EXCEPTION 'Invalid scope';
  END IF;

  SELECT * INTO v_cal FROM public.calendars WHERE id = p_calendar_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calendar not found'; END IF;
  v_org_id := v_cal.organization_id;

  IF p_scope = 'global' THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only super admin can create global templates';
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = v_user
        AND om.organization_id = v_org_id
        AND om.role IN ('owner','admin')
    ) INTO v_can;
    IF NOT v_can THEN RAISE EXCEPTION 'Permission denied'; END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day_of_week', day_of_week,
    'start_time', start_time::text,
    'end_time', end_time::text
  ) ORDER BY day_of_week, start_time), '[]'::jsonb)
  INTO v_availability
  FROM public.calendar_availability
  WHERE calendar_id = p_calendar_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', name,
    'description', description,
    'duration_minutes', duration_minutes,
    'slot_interval_minutes', slot_interval_minutes,
    'buffer_before_minutes', buffer_before_minutes,
    'buffer_after_minutes', buffer_after_minutes,
    'min_notice_hours', min_notice_hours,
    'max_advance_days', max_advance_days,
    'requires_confirmation', requires_confirmation,
    'reminders_enabled', reminders_enabled,
    'confirmation_message_whatsapp', confirmation_message_whatsapp,
    'confirmation_subject_email', confirmation_subject_email,
    'reminder_24h_message_whatsapp', reminder_24h_message_whatsapp,
    'reminder_24h_subject_email', reminder_24h_subject_email,
    'reminder_1h_message_whatsapp', reminder_1h_message_whatsapp,
    'reminder_1h_subject_email', reminder_1h_subject_email,
    'review_message_whatsapp', review_message_whatsapp,
    'review_subject_email', review_subject_email,
    'cancellation_message_whatsapp', cancellation_message_whatsapp,
    'reschedule_message_whatsapp', reschedule_message_whatsapp,
    'google_review_url', google_review_url,
    'position', position
  ) ORDER BY position, created_at), '[]'::jsonb)
  INTO v_event_types
  FROM public.event_types
  WHERE calendar_id = p_calendar_id;

  INSERT INTO public.calendar_templates (
    scope, organization_id, name, description, category, icon,
    reminders_enabled, default_color, default_timezone,
    availability, event_types, created_by
  ) VALUES (
    p_scope,
    CASE WHEN p_scope = 'organization' THEN v_org_id ELSE NULL END,
    btrim(p_template_name),
    p_description,
    p_category,
    p_icon,
    COALESCE(v_cal.reminders_enabled, true),
    v_cal.color,
    v_cal.timezone,
    v_availability,
    v_event_types,
    v_user
  ) RETURNING id INTO v_template_id;

  RETURN v_template_id;
END;
$$;