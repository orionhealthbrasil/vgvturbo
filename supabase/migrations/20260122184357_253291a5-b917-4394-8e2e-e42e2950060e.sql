-- Adicionar vínculo entre vendedores e contas de usuário
ALTER TABLE public.salespeople 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para busca eficiente por user_id
CREATE INDEX IF NOT EXISTS idx_salespeople_user_id ON public.salespeople(user_id) WHERE user_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.salespeople.user_id IS 'Vínculo com conta de usuário do sistema para filtragem de dashboard';