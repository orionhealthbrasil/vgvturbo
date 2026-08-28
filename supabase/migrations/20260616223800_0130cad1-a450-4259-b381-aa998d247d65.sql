ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS sla_alert_destinations jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill from sla_alert_phones (and legacy sla_alert_phone) as type=phone
UPDATE public.organizations
SET sla_alert_destinations = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('type','phone','value', p, 'label', p))
    FROM (
      SELECT DISTINCT unnest(
        CASE
          WHEN sla_alert_phones IS NOT NULL AND array_length(sla_alert_phones,1) > 0 THEN sla_alert_phones
          WHEN sla_alert_phone IS NOT NULL AND sla_alert_phone <> '' THEN ARRAY[sla_alert_phone]
          ELSE ARRAY[]::text[]
        END
      ) AS p
    ) s
    WHERE p IS NOT NULL AND p <> ''
  ),
  '[]'::jsonb
)
WHERE (sla_alert_destinations IS NULL OR sla_alert_destinations = '[]'::jsonb)
  AND (
    (sla_alert_phones IS NOT NULL AND array_length(sla_alert_phones,1) > 0)
    OR (sla_alert_phone IS NOT NULL AND sla_alert_phone <> '')
  );