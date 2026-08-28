CREATE OR REPLACE FUNCTION public.cancel_booking_by_token(p_token text, p_reason text DEFAULT NULL)
RETURNS TABLE(
  booking_id uuid,
  customer_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  calendar_name text,
  was_cancelled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  SELECT b.*, c.name AS cal_name INTO v_booking
  FROM public.bookings b
  JOIN public.calendars c ON c.id = b.calendar_id
  WHERE b.cancel_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN QUERY SELECT v_booking.id, v_booking.customer_name, v_booking.starts_at, v_booking.ends_at, v_booking.cal_name, false;
    RETURN;
  END IF;

  IF v_booking.starts_at < now() THEN
    RAISE EXCEPTION 'Cannot cancel past booking';
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Cancelado pelo cliente')
  WHERE id = v_booking.id;

  UPDATE public.booking_reminders
  SET status = 'skipped'
  WHERE booking_id = v_booking.id AND status = 'pending';

  RETURN QUERY SELECT v_booking.id, v_booking.customer_name, v_booking.starts_at, v_booking.ends_at, v_booking.cal_name, true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token(text, text) TO anon, authenticated;