-- Agenda o Follow-up SDR Guardian para rodar a cada 30 minutos
SELECT cron.unschedule('followup-sdr-guardian') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'followup-sdr-guardian'
);

SELECT cron.schedule(
  'followup-sdr-guardian',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://welindpmuqdnuazgaetz.supabase.co/functions/v1/followup-sdr-guardian',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
