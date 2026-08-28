
-- Fix search_path mutable warning for trigger_audit_on_close function
CREATE OR REPLACE FUNCTION public.trigger_audit_on_close()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  service_role_key text;
  supabase_url text;
BEGIN
  -- Only trigger when status changes TO 'closed'
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    -- Get environment variables (these are available in pg_net context)
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Use pg_net to call the audit edge function asynchronously
    SELECT net.http_post(
      url := concat(coalesce(supabase_url, 'https://xcpqftfprwllkmziesvo.supabase.co'), '/functions/v1/audit-conversation'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', coalesce(service_role_key, current_setting('supabase.service_role_key', true)))
      ),
      body := jsonb_build_object(
        'contact_id', NEW.id::text,
        'organization_id', NEW.organization_id::text
      )
    ) INTO request_id;
    
    RAISE LOG 'Audit triggered for contact % with request_id %', NEW.id, request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
