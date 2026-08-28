-- Add support for multiple SLA alert phones
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS sla_alert_phones text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill from existing single phone
UPDATE public.organizations
SET sla_alert_phones = ARRAY[sla_alert_phone]
WHERE sla_alert_phone IS NOT NULL
  AND sla_alert_phone <> ''
  AND (sla_alert_phones IS NULL OR array_length(sla_alert_phones, 1) IS NULL);