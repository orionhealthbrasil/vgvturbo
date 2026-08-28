-- Adiciona o campo resume_at na tabela contacts para controle de delays
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS resume_at TIMESTAMP WITH TIME ZONE;

-- Cria índice para buscas eficientes de contatos com delays expirados
CREATE INDEX IF NOT EXISTS idx_contacts_resume_at ON public.contacts(resume_at)
WHERE resume_at IS NOT NULL;