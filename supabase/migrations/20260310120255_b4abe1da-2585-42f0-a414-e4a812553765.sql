
-- Schedule SLA Guardian to run every 10 minutes
SELECT cron.schedule(
  'monitor-sla-guardian',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xcpqftfprwllkmziesvo.supabase.co/functions/v1/monitor-sla-guardian',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
