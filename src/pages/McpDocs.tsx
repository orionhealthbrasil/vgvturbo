import { useState } from 'react';
import { 
  Book, Copy, Check, ChevronDown, ChevronRight, Search, 
  MessageSquare, Users, Tag, BarChart3, ArrowRightLeft, 
  Send, UserPlus, Pencil, Eye, Trash2, Key, ExternalLink, Clock,
  Code2, Zap, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface ToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
  default?: string;
}

interface ToolDoc {
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  params: ToolParam[];
  exampleRequest: Record<string, unknown>;
  exampleResponse: unknown;
}

const TOOLS: ToolDoc[] = [
  {
    name: 'search_contacts',
    description: 'Busca contatos por nome, telefone ou email. Permite filtrar por status e etapa do funil.',
    category: 'Contatos',
    icon: <Search className="h-4 w-4" />,
    params: [
      { name: 'query', type: 'string', required: false, description: 'Termo de busca (nome, telefone ou email)' },
      { name: 'status', type: 'string', required: false, description: 'Filtrar por status', enum: ['open', 'closed'] },
      { name: 'funnel_stage', type: 'string', required: false, description: 'Filtrar por slug da etapa do funil' },
      { name: 'limit', type: 'number', required: false, description: 'Máximo de resultados (padrão: 20, máx: 100)', default: '20' },
    ],
    exampleRequest: { query: 'João', status: 'open', limit: 10 },
    exampleResponse: [
      { id: 'uuid-1', name: 'João Silva', phone: '5511999999999', status: 'open', funnel_stage: 'lead', last_message_at: '2024-01-15T10:30:00Z' },
    ],
  },
  {
    name: 'get_contact',
    description: 'Retorna detalhes completos de um contato, incluindo tags e campos customizados.',
    category: 'Contatos',
    icon: <Eye className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato' },
    exampleResponse: {
      id: 'uuid-1', name: 'João Silva', phone: '5511999999999', email: 'joao@email.com',
      status: 'open', funnel_stage: 'negotiation',
      contact_tags: [{ tag_id: 'tag-1', tags: { name: 'VIP', color: '#f59e0b' } }],
      contact_custom_fields: [{ field_name: 'empresa', field_value: 'Acme Corp' }],
    },
  },
  {
    name: 'create_contact',
    description: 'Cria um novo contato no CRM.',
    category: 'Contatos',
    icon: <UserPlus className="h-4 w-4" />,
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nome do contato' },
      { name: 'phone', type: 'string', required: true, description: 'Telefone com código do país' },
      { name: 'email', type: 'string', required: false, description: 'Email (opcional)' },
      { name: 'notes', type: 'string', required: false, description: 'Observações (opcional)' },
    ],
    exampleRequest: { name: 'Maria Oliveira', phone: '5511988887777', email: 'maria@email.com' },
    exampleResponse: { id: 'uuid-novo', name: 'Maria Oliveira', phone: '5511988887777', status: 'open', funnel_stage: 'lead' },
  },
  {
    name: 'update_contact',
    description: 'Atualiza dados de um contato existente.',
    category: 'Contatos',
    icon: <Pencil className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'name', type: 'string', required: false, description: 'Novo nome' },
      { name: 'phone', type: 'string', required: false, description: 'Novo telefone' },
      { name: 'email', type: 'string', required: false, description: 'Novo email' },
      { name: 'notes', type: 'string', required: false, description: 'Novas observações' },
      { name: 'status', type: 'string', required: false, description: 'Novo status', enum: ['open', 'closed'] },
      { name: 'funnel_stage', type: 'string', required: false, description: 'Nova etapa do funil' },
      { name: 'assigned_to', type: 'string', required: false, description: 'UUID do usuário para atribuir' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', notes: 'Cliente interessado no plano Pro' },
    exampleResponse: { id: 'uuid-do-contato', name: 'João Silva', notes: 'Cliente interessado no plano Pro' },
  },
  {
    name: 'get_conversation',
    description: 'Retorna o histórico de mensagens de um contato.',
    category: 'Mensagens',
    icon: <MessageSquare className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'limit', type: 'number', required: false, description: 'Máximo de mensagens (padrão: 50, máx: 200)', default: '50' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', limit: 10 },
    exampleResponse: [
      { id: 'msg-1', content: 'Olá, gostaria de um orçamento', direction: 'inbound', message_type: 'text', created_at: '2024-01-15T10:00:00Z' },
      { id: 'msg-2', content: 'Claro! Vou enviar agora', direction: 'outbound', message_type: 'text', created_at: '2024-01-15T10:05:00Z' },
    ],
  },
  {
    name: 'send_message',
    description: 'Envia uma mensagem de texto via WhatsApp para um contato.',
    category: 'Mensagens',
    icon: <Send className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'content', type: 'string', required: true, description: 'Texto da mensagem' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', content: 'Olá! Segue o orçamento solicitado.' },
    exampleResponse: { message_id: 'msg-uuid', status: 'sent' },
  },
  {
    name: 'list_tags',
    description: 'Lista todas as etiquetas disponíveis na organização.',
    category: 'Etiquetas',
    icon: <Tag className="h-4 w-4" />,
    params: [],
    exampleRequest: {},
    exampleResponse: [
      { id: 'tag-1', name: 'VIP', color: '#f59e0b' },
      { id: 'tag-2', name: 'Novo Lead', color: '#22c55e' },
    ],
  },
  {
    name: 'add_tag',
    description: 'Adiciona uma etiqueta a um contato.',
    category: 'Etiquetas',
    icon: <Tag className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'tag_id', type: 'string', required: true, description: 'UUID da etiqueta' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', tag_id: 'uuid-da-tag' },
    exampleResponse: { success: true },
  },
  {
    name: 'remove_tag',
    description: 'Remove uma etiqueta de um contato.',
    category: 'Etiquetas',
    icon: <Trash2 className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'tag_id', type: 'string', required: true, description: 'UUID da etiqueta' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', tag_id: 'uuid-da-tag' },
    exampleResponse: { success: true },
  },
  {
    name: 'move_funnel_stage',
    description: 'Move um contato para uma etapa diferente do funil de vendas.',
    category: 'Funil',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'funnel_stage', type: 'string', required: true, description: 'Slug da etapa (ex: lead, negotiation, closed)' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', funnel_stage: 'negotiation' },
    exampleResponse: { id: 'uuid-do-contato', funnel_stage: 'negotiation' },
  },
  {
    name: 'assign_contact',
    description: 'Atribui um contato a um membro da equipe (ou remove atribuição).',
    category: 'Equipe',
    icon: <Users className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'user_id', type: 'string', required: false, description: 'UUID do usuário (omitir para desatribuir)' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', user_id: 'uuid-do-usuario' },
    exampleResponse: { id: 'uuid-do-contato', assigned_to: 'uuid-do-usuario' },
  },
  {
    name: 'list_members',
    description: 'Lista todos os membros da equipe na organização.',
    category: 'Equipe',
    icon: <Users className="h-4 w-4" />,
    params: [],
    exampleRequest: {},
    exampleResponse: [
      { user_id: 'user-1', role: 'owner', member_role: 'admin', profiles: { full_name: 'Admin', email: 'admin@email.com' } },
    ],
  },
  {
    name: 'get_funnel_stages',
    description: 'Lista todas as etapas do funil de vendas.',
    category: 'Funil',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    params: [],
    exampleRequest: {},
    exampleResponse: [
      { id: 'stage-1', name: 'Triagem', slug: 'lead', color: '#6366f1', position: 0, is_final: false },
      { id: 'stage-2', name: 'Negociação', slug: 'negotiation', color: '#f59e0b', position: 1, is_final: false },
      { id: 'stage-3', name: 'Fechamento', slug: 'closed', color: '#22c55e', position: 2, is_final: true },
    ],
  },
  {
    name: 'get_daily_stats',
    description: 'Retorna estatísticas do dia (total de contatos, mensagens hoje, fechados hoje).',
    category: 'Métricas',
    icon: <BarChart3 className="h-4 w-4" />,
    params: [],
    exampleRequest: {},
    exampleResponse: { total_contacts: 1250, messages_today: 347, closed_today: 12 },
  },
  {
    name: 'schedule_message',
    description: 'Agenda uma mensagem de texto via WhatsApp para ser enviada em uma data/hora específica.',
    category: 'Mensagens',
    icon: <Clock className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'content', type: 'string', required: true, description: 'Texto da mensagem' },
      { name: 'scheduled_at', type: 'string', required: true, description: 'Data/hora ISO 8601 para envio (deve ser no futuro)' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', content: 'Bom dia! Lembrete do nosso meeting às 14h.', scheduled_at: '2024-01-16T09:00:00-03:00' },
    exampleResponse: { id: 'sched-uuid', scheduled_at: '2024-01-16T12:00:00+00:00', status: 'pending' },
  },
  {
    name: 'get_today_conversations',
    description: 'Lista todas as conversas que tiveram atividade hoje (fuso horário de São Paulo). Mostra dados do contato, contagem de mensagens e vendedor atribuído.',
    category: 'Mensagens',
    icon: <MessageSquare className="h-4 w-4" />,
    params: [],
    exampleRequest: {},
    exampleResponse: {
      conversations: [
        { contact_id: 'uuid-contato', contact_name: 'João Silva', contact_phone: '5511999999999', status: 'open', funnel_stage: 'negotiation', assigned_to: 'Maria Oliveira', messages_inbound: 5, messages_outbound: 3, messages_total: 8, last_message_at: '2024-01-15T14:30:00Z' },
        { contact_id: 'uuid-contato-2', contact_name: 'Ana Costa', contact_phone: '5521988888888', status: 'open', funnel_stage: 'lead', assigned_to: null, messages_inbound: 1, messages_outbound: 0, messages_total: 1, last_message_at: '2024-01-15T10:00:00Z' },
      ],
      total: 2,
    },
  },
  {
    name: 'get_conversations_by_date',
    description: 'Lista todas as conversas que tiveram atividade em uma data específica (fuso horário de São Paulo). Aceita data no formato YYYY-MM-DD.',
    category: 'Mensagens',
    icon: <MessageSquare className="h-4 w-4" />,
    params: [
      { name: 'date', type: 'string', required: true, description: 'Data no formato YYYY-MM-DD (fuso de São Paulo)' },
    ],
    exampleRequest: { date: '2024-01-10' },
    exampleResponse: {
      date: '2024-01-10',
      conversations: [
        { contact_id: 'uuid-contato', contact_name: 'João Silva', contact_phone: '5511999999999', status: 'open', funnel_stage: 'negotiation', assigned_to: 'Maria Oliveira', messages_inbound: 5, messages_outbound: 3, messages_total: 8, last_message_at: '2024-01-10T14:30:00Z' },
      ],
      total: 1,
    },
  },
  {
    name: 'get_conversation_messages',
    description: 'Retorna as mensagens de um contato em uma data específica (fuso horário de São Paulo). Se a data não for informada, usa o dia atual.',
    category: 'Mensagens',
    icon: <MessageSquare className="h-4 w-4" />,
    params: [
      { name: 'contact_id', type: 'string', required: true, description: 'UUID do contato' },
      { name: 'date', type: 'string', required: false, description: 'Data no formato YYYY-MM-DD (opcional, padrão: hoje)' },
    ],
    exampleRequest: { contact_id: 'uuid-do-contato', date: '2024-01-10' },
    exampleResponse: {
      contact_name: 'João Silva',
      contact_phone: '5511999999999',
      messages: [
        { id: 'msg-uuid', direction: 'inbound', message_type: 'text', content: 'Olá, quero um orçamento', created_at: '2024-01-10T10:30:00Z', agent_name: null },
        { id: 'msg-uuid-2', direction: 'outbound', message_type: 'text', content: 'Bom dia João! Vou preparar agora.', created_at: '2024-01-10T10:32:00Z', agent_name: 'Maria Oliveira' },
      ],
      total: 2,
    },
  },
];

const CATEGORIES = ['Todos', 'Contatos', 'Mensagens', 'Etiquetas', 'Funil', 'Equipe', 'Métricas'];

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-[hsl(var(--muted))] border rounded-lg p-3 overflow-x-auto text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-1.5 right-1.5 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDoc }) {
  const [expanded, setExpanded] = useState(false);

  const mcpRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: tool.name,
      arguments: tool.exampleRequest,
    },
  }, null, 2);

  const curlExample = `curl -X POST \\
  "$MCP_ENDPOINT" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $API_KEY" \\
  -d '${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool.name, arguments: tool.exampleRequest } })}'`;

  return (
    <Card className="border">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary shrink-0">
          {tool.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-semibold">{tool.name}</code>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {tool.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{tool.description}</p>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <Separator />

          {/* Parameters */}
          {tool.params.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Parâmetros</h4>
              <div className="space-y-1.5">
                {tool.params.map((param) => (
                  <div key={param.name} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/30">
                    <code className="font-semibold text-primary whitespace-nowrap">{param.name}</code>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{param.type}</Badge>
                    {param.required && <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">obrigatório</Badge>}
                    <span className="text-muted-foreground flex-1">{param.description}</span>
                    {param.enum && (
                      <span className="text-muted-foreground shrink-0">
                        [{param.enum.map(e => `"${e}"`).join(', ')}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tool.params.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Esta tool não recebe parâmetros.</p>
          )}

          <Tabs defaultValue="mcp" className="w-full">
            <TabsList className="h-8">
              <TabsTrigger value="mcp" className="text-xs h-7">JSON-RPC</TabsTrigger>
              <TabsTrigger value="curl" className="text-xs h-7">cURL</TabsTrigger>
              <TabsTrigger value="response" className="text-xs h-7">Resposta</TabsTrigger>
            </TabsList>
            <TabsContent value="mcp" className="mt-2">
              <CodeBlock code={mcpRequest} />
            </TabsContent>
            <TabsContent value="curl" className="mt-2">
              <CodeBlock code={curlExample} language="bash" />
            </TabsContent>
            <TabsContent value="response" className="mt-2">
              <CodeBlock code={JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(tool.exampleResponse, null, 2) }] } }, null, 2)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

export default function McpDocs() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filteredTools = TOOLS.filter((tool) => {
    const matchesSearch = !search || 
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'Todos' || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const initializeExample = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
  }, null, 2);

  const configExample = `{
  "mcpServers": {
    "vgvturbo": {
      "url": "$MCP_ENDPOINT",
      "headers": {
        "x-api-key": "$SUA_API_KEY"
      }
    }
  }
}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">VGV Turbo MCP Server</h1>
              <p className="text-sm text-muted-foreground">Documentação da API para agentes externos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <Card className="bg-muted/30 border">
              <CardContent className="p-3 flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Autenticação</p>
                  <p className="text-[11px] text-muted-foreground">API Key via header <code className="bg-background px-1 rounded">x-api-key</code></p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border">
              <CardContent className="p-3 flex items-start gap-2.5">
                <Code2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Protocolo</p>
                  <p className="text-[11px] text-muted-foreground">MCP (JSON-RPC 2.0) via HTTP POST</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border">
              <CardContent className="p-3 flex items-start gap-2.5">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">17 Tools</p>
                  <p className="text-[11px] text-muted-foreground">CRUD completo de contatos, mensagens, tags e funil</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Book className="h-5 w-5" />
              Início Rápido
            </CardTitle>
            <CardDescription>Configure o MCP Server do VGV Turbo em 3 passos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Crie uma API Key</p>
                  <p className="text-xs text-muted-foreground">Vá em <strong>Ajustes da Organização → API Keys</strong> e crie uma nova chave.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Configure seu cliente MCP</p>
                  <p className="text-xs text-muted-foreground mb-2">Adicione o VGV Turbo ao seu arquivo de configuração MCP:</p>
                  <CodeBlock code={configExample} />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Inicialize a conexão</p>
                  <p className="text-xs text-muted-foreground mb-2">Envie o request de inicialização:</p>
                  <CodeBlock code={initializeExample} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tools Reference */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Referência de Tools</h2>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={activeCategory === cat ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                  {cat !== 'Todos' && (
                    <span className="ml-1 opacity-60">
                      ({TOOLS.filter(t => t.category === cat).length})
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
            {filteredTools.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma tool encontrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Códigos de Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <Badge variant="destructive" className="text-[10px] px-1.5 font-mono">401</Badge>
                <span>API Key inválida, expirada ou não informada</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <Badge variant="destructive" className="text-[10px] px-1.5 font-mono">-32601</Badge>
                <span>Método MCP não encontrado</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <Badge variant="destructive" className="text-[10px] px-1.5 font-mono">-32700</Badge>
                <span>Erro de parse no JSON do request</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/30">
                <Badge variant="outline" className="text-[10px] px-1.5 font-mono">isError</Badge>
                <span>Erro na execução da tool (ex: contato não encontrado, campo obrigatório faltando)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-6">
          VGV Turbo MCP Server v1.0.0 • Protocolo MCP 2024-11-05
        </p>
      </div>
    </div>
  );
}
