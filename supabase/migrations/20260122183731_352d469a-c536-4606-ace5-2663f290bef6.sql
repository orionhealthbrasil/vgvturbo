-- Adicionar campos de configuração SLA na tabela organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS sla_threshold_minutes integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS sla_alert_phone text,
ADD COLUMN IF NOT EXISTS sla_alert_template text NOT NULL DEFAULT '🚨 *ALERTA DE SLA* 🚨
O cliente *{{customer_name}}* está aguardando há *{{wait_time}}* minutos.
Vendedor responsável: *{{agent_name}}*.';

-- Adicionar campo para marcar se alerta já foi enviado para o contato
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS sla_alert_sent boolean NOT NULL DEFAULT false;

-- Criar índice para buscas eficientes de chats atrasados
CREATE INDEX IF NOT EXISTS idx_contacts_open_sla 
ON public.contacts (organization_id, status, last_message_at) 
WHERE status = 'open' AND sla_alert_sent = false;