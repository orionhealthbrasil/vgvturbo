-- Função que vincula automaticamente vendedores a salespeople com mesmo nome
CREATE OR REPLACE FUNCTION public.auto_link_salesperson_on_member_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
  v_salesperson_id UUID;
BEGIN
  -- Só executa para membros com cargo 'viewer' (vendedores)
  IF NEW.member_role != 'viewer' THEN
    RETURN NEW;
  END IF;

  -- Buscar o nome do usuário no perfil
  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_user_name IS NULL OR v_user_name = '' THEN
    RETURN NEW;
  END IF;

  -- Buscar salesperson com mesmo nome (case insensitive) que ainda não tem vínculo
  SELECT id INTO v_salesperson_id
  FROM public.salespeople
  WHERE organization_id = NEW.organization_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(v_user_name))
    AND user_id IS NULL
  LIMIT 1;

  -- Se encontrou, vincular
  IF v_salesperson_id IS NOT NULL THEN
    UPDATE public.salespeople
    SET user_id = NEW.user_id
    WHERE id = v_salesperson_id;
    
    RAISE NOTICE 'Auto-linked salesperson % to user %', v_salesperson_id, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger que dispara após inserção de novo membro
DROP TRIGGER IF EXISTS trigger_auto_link_salesperson ON public.organization_members;

CREATE TRIGGER trigger_auto_link_salesperson
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_salesperson_on_member_join();

-- Comentário explicativo
COMMENT ON FUNCTION public.auto_link_salesperson_on_member_join() IS 
  'Vincula automaticamente novos membros Vendedor a salespeople com mesmo nome';