-- Add snoozed_until column to contacts
ALTER TABLE public.contacts
ADD COLUMN snoozed_until TIMESTAMP WITH TIME ZONE;

-- Create function to get next open slot based on organization business hours
CREATE OR REPLACE FUNCTION public.get_next_open_slot(p_organization_id UUID)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_working_days INTEGER[];
  v_open_time TIME;
  v_check_date DATE;
  v_day_of_week INTEGER;
  v_is_holiday BOOLEAN;
  v_result TIMESTAMP WITH TIME ZONE;
  v_days_checked INTEGER := 0;
  v_now TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current time in Brazil timezone (UTC-3)
  v_now := NOW() AT TIME ZONE 'America/Sao_Paulo';
  
  -- Get organization business hours settings
  SELECT 
    COALESCE(working_days, ARRAY[1,2,3,4,5]),
    COALESCE(business_hours_start, '08:00:00'::TIME)
  INTO v_working_days, v_open_time
  FROM organizations
  WHERE id = p_organization_id;
  
  -- If no organization found, return fallback
  IF v_working_days IS NULL THEN
    RETURN (DATE_TRUNC('week', v_now) + INTERVAL '7 days' + INTERVAL '1 day')::DATE + '09:00:00'::TIME AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  
  -- Start checking from tomorrow
  v_check_date := (v_now::DATE) + INTERVAL '1 day';
  
  -- Loop through next 14 days to find an open slot
  WHILE v_days_checked < 14 LOOP
    -- Get day of week (0=Sunday, 6=Saturday)
    v_day_of_week := EXTRACT(DOW FROM v_check_date)::INTEGER;
    
    -- Check if it's a working day
    IF v_day_of_week = ANY(v_working_days) THEN
      -- Check if it's a holiday
      SELECT EXISTS(
        SELECT 1 FROM organization_holidays
        WHERE organization_id = p_organization_id
        AND holiday_date = v_check_date
        AND is_closed = true
      ) INTO v_is_holiday;
      
      -- If not a holiday, this is our target date
      IF NOT v_is_holiday THEN
        v_result := (v_check_date + v_open_time) AT TIME ZONE 'America/Sao_Paulo';
        RETURN v_result;
      END IF;
    END IF;
    
    -- Move to next day
    v_check_date := v_check_date + INTERVAL '1 day';
    v_days_checked := v_days_checked + 1;
  END LOOP;
  
  -- Fallback: next Monday at 09:00 if no open day found
  v_check_date := (v_now::DATE) + INTERVAL '1 day';
  WHILE EXTRACT(DOW FROM v_check_date) <> 1 LOOP
    v_check_date := v_check_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN (v_check_date + '09:00:00'::TIME) AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_open_slot(UUID) TO authenticated;