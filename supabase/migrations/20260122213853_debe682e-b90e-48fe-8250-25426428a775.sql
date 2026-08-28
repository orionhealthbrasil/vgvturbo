-- Adicionar campo funnel_stage na tabela contacts
ALTER TABLE public.contacts
ADD COLUMN funnel_stage text NOT NULL DEFAULT 'lead';

-- Adicionar constraint para validar valores aceitos
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_funnel_stage_check 
CHECK (funnel_stage IN ('lead', 'negotiation', 'closed'));

-- Adicionar campo para armazenar resultado da venda (ganho/perdido)
ALTER TABLE public.contacts
ADD COLUMN sale_result text;

-- Constraint para sale_result
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_sale_result_check 
CHECK (sale_result IS NULL OR sale_result IN ('won', 'lost'));

-- Comentários para documentação
COMMENT ON COLUMN public.contacts.funnel_stage IS 'Etapa do funil: lead (Triagem), negotiation (Negociação), closed (Finalizado)';
COMMENT ON COLUMN public.contacts.sale_result IS 'Resultado da venda: won (Ganho), lost (Perdido)';