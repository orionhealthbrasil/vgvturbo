-- Update get_next_open_slot function with 60-minute "Golden Hour" spread
CREATE OR REPLACE FUNCTION public.get_next_open_slot(p_organization_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_working_days INTEGER[];
  v_open_time TIME;
  v_check_date DATE;
  v_day_of_week INTEGER;
  v_is_holiday BOOLEAN;
  v_result TIMESTAMP WITH TIME ZONE;
  v_days_checked INTEGER := 0;
  v_now TIMESTAMP WITH TIME ZONE;
  v_jitter_seconds INTEGER;
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
    v_jitter_seconds := floor(random() * 3600)::INTEGER; -- 0-60 min in seconds
    RETURN (DATE_TRUNC('week', v_now) + INTERVAL '7 days' + INTERVAL '1 day')::DATE 
           + '09:00:00'::TIME 
           + (v_jitter_seconds || ' seconds')::INTERVAL 
           AT TIME ZONE 'America/Sao_Paulo';
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
        -- GOLDEN HOUR SPREAD: Random offset between 0-60 minutes (in seconds for precision)
        -- This distributes contacts uniformly across the first hour of business
        v_jitter_seconds := floor(random() * 3600)::INTEGER;
        
        v_result := (v_check_date + v_open_time + (v_jitter_seconds || ' seconds')::INTERVAL) AT TIME ZONE 'America/Sao_Paulo';
        RETURN v_result;
      END IF;
    END IF;
    
    -- Move to next day
    v_check_date := v_check_date + INTERVAL '1 day';
    v_days_checked := v_days_checked + 1;
  END LOOP;
  
  -- Fallback: next Monday at 09:00 if no open day found (with jitter)
  v_check_date := (v_now::DATE) + INTERVAL '1 day';
  WHILE EXTRACT(DOW FROM v_check_date) <> 1 LOOP
    v_check_date := v_check_date + INTERVAL '1 day';
  END LOOP;
  
  v_jitter_seconds := floor(random() * 3600)::INTEGER;
  RETURN (v_check_date + '09:00:00'::TIME + (v_jitter_seconds || ' seconds')::INTERVAL) AT TIME ZONE 'America/Sao_Paulo';
END;
$function$;