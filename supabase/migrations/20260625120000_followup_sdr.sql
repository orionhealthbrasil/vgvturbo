-- Follow-up SDR por inatividade
-- ai_agents: configuração do agente de follow-up
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS is_followup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inactivity_trigger_hours integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_followup_attempts integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS followup_exhausted_automation_id uuid DEFAULT NULL
    REFERENCES automations(id) ON DELETE SET NULL;

-- contacts: controle de estado do ciclo de follow-up
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS sdr_last_triggered_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sdr_attempt_count integer NOT NULL DEFAULT 0;

-- Índice para o guardian escanear eficientemente
CREATE INDEX IF NOT EXISTS idx_contacts_followup_sdr
  ON contacts (organization_id, last_message_at, sdr_last_triggered_at)
  WHERE is_archived = false AND status = 'open';
