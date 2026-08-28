// Base de conhecimento estruturada da VGV Turbo.
// Mantida densa e em bullets pra controlar tokens (~1500-2000 tokens).
// Usada como bloco fixo no system prompt do gerador de blog.

export const ORION_CONTEXT = `BASE DE CONHECIMENTO — AGÊNCIA ORION

QUEM:
VGV Turbo — IA aplicada a vendas e atendimento via WhatsApp e Instagram, focada em PMEs brasileiras. Site: vgvturbo.com.br.

PÚBLICO-ALVO:
Clínicas (estética, odontológica, médica, fisioterapia), advogados (trabalhista, criminal, família), contadores, corretores (seguros, imóveis), lojas (auto-peças, roupas, materiais de construção), prestadores de serviço (academia, salão, oficina), agências, e-commerce de pequeno/médio porte.

PRODUTO PRINCIPAL — VGV Turbo (CRM + IA):
• Caixa de entrada unificada: WhatsApp + Instagram DM no mesmo painel
• Squad AI: múltiplos agentes de IA configuráveis que atendem 24/7, qualificam lead, agendam, vendem, fazem follow-up
• Funil de vendas drag-and-drop com etapas customizáveis pelo próprio dono do negócio
• Pipeline de negócios com valor do deal, motivos de perda, ranking de vendedores
• Disparo em massa anti-bloqueio (jitter aleatório entre mensagens, lotes, respeito a horário comercial)
• Automações visuais (Flow Builder): gatilhos, condições, delays, ações em árvore
• Agendamento online estilo Calendly com confirmação automática via WhatsApp
• Lembretes automáticos 24h e 1h antes do compromisso, mais pedido de avaliação no Google após o atendimento
• Pesquisa de satisfação com NPS, estrelas, texto livre, emoji e múltipla escolha
• Dashboard com KPIs: total de leads, novos hoje, conversão, ticket médio, tempo médio de resposta, ranking de vendedores
• Análise de conversas com IA: audita atendimentos, dá nota, identifica pontos fracos do vendedor
• Transcrição automática de áudios recebidos e descrição de imagens/vídeos enviados pelo cliente
• Guardião de SLA: monitora tempo de resposta, alerta gestor quando lead está parado
• Chat interno entre membros da equipe (1:1 e grupos), com enquetes
• Tarefas e projetos vinculados a contatos
• Metas individuais e de equipe com progresso em tempo real e notificações de evolução
• Formulários públicos pra captura de lead em landing page
• Tags, campos personalizados, importação por CSV, integração via API/MCP
• Multi-canal, multi-usuário, controle de permissões granular por papel
• Suporte a grupos de WhatsApp (recebe e envia)

DIFERENCIAIS REAIS (use como ângulo, NUNCA cite literalmente):
• A IA conversa como humano brasileiro de verdade — nada de "Olá! Como posso ajudar?", responde no jeito do dono
• Anti-banimento sério: micro-jitter entre envios, respeita horário comercial da empresa, fora do horário programa pra mandar de manhã
• Agência monta tudo sob medida: cliente recebe operação rodando, não um software vazio pra configurar sozinho
• Suporte humano direto via chamado, sem ticket genérico de SaaS gringo

DORES QUE A ORION RESOLVE:
• Lead que entra de noite ou no domingo e quando atendem segunda já esfriou
• Vendedor demora 2h pra responder e perde pro concorrente que respondeu em 2 minutos
• Atendente cansado dá resposta ruim no fim do dia
• Gestor não sabe quem deixou o lead cair
• Cliente esquece consulta e dá no-show, queimando horário
• Não tem follow-up automático com quem não fechou
• Time pequeno tentando atender em escala sem qualidade

ÂNGULOS DE PAUTA RECORRENTES:
• Cálculo de ROI de IA no atendimento (lead/mês × ticket × conversão antes vs depois)
• Comparativo: agente IA vs SDR humano (custo, escala, consistência)
• Casos por segmento (clínica de estética em BH, advogado trabalhista em SP, loja de auto-peças no interior)
• Diferença entre WhatsApp Business API real e número comum (banimento, oficial vs não-oficial)
• Por que disparo em massa barato banca o número e queima o CNPJ
• Métricas que importam de verdade: TMR (tempo médio de resposta), taxa de fechamento, taxa de no-show
• Por que chatbot de árvore (botão 1, botão 2) morreu — IA conversacional toma o lugar
• Recuperação de carrinho/orçamento abandonado via WhatsApp
• Pré-venda automatizada pra liberar vendedor pro fechamento

NUNCA DIZER (proibido absoluto):
• Termos técnicos internos: "MCP", "OpenAI", "GPT", "Whisper", "Stevo", "Evolution", "Supabase", "Edge Function"
• Clichês de IA: "revolucionário", "disruptivo", "no mundo digital", "transforme seu negócio", "potencialize"
• Inventar nome de módulo (ex: "Módulo de Conversão de Prospectos") — só use os nomes reais listados acima
• Estatística falsa atribuída a Harvard, McKinsey, Gartner — se citar dado, marque como estimativa de mercado ou observação prática
• Tradução de termos técnicos consagrados (mantém WhatsApp, Instagram, lead, pipeline, follow-up)

CTA PADRÃO:
• "Fala com a VGV Turbo no WhatsApp" ou "Chama a VGV Turbo" → leva pra vgvturbo.com.br
• Tom do CTA: convite natural, jeito de quem manda mensagem pra um conhecido, nunca "entre em contato hoje mesmo"
`;
