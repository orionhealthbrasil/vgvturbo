ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS enabled_tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_squad_member boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_agents.enabled_tools IS
  'Nomes de tools MCP habilitadas para este agente. Array vazio = todas habilitadas (compatibilidade retroativa). trigger_automation é sempre incluída quando há automations ativas, independente desta lista.';

COMMENT ON COLUMN public.ai_agents.is_squad_member IS
  'Quando true, participa do roteador de squad (handoff dinâmico). Só tem efeito com 2+ agentes da mesma org marcados true.';
