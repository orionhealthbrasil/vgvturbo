import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VGVTurboLogo } from '@/components/brand/VGVTurboLogo';
import {
  MessageSquare, Zap, Users, BarChart3, Clock, Bot,
  CheckCircle2, ArrowRight, Sun, Phone, Send, Star,
  Shield, TrendingUp, Target, Workflow, Tag, Calendar,
  AlertTriangle, Info, CreditCard
} from 'lucide-react';

const limitations = [
  {
    icon: AlertTriangle,
    text: 'Utilizamos API não oficial do WhatsApp devido ao alto custo da API oficial. Isso traz um risco de bloqueio temporário do número.',
  },
  {
    icon: Info,
    text: 'As mensagens antigas não aparecem todas de uma vez — só ficam disponíveis a partir do momento em que o QR Code é conectado.',
  },
  {
    icon: Phone,
    text: 'Não há suporte para ligações de voz/vídeo. O VGV Turbo funciona exclusivamente com mensagens.',
  },
  {
    icon: Bot,
    text: 'O módulo de IA que responde conversas automaticamente ainda está em desenvolvimento e não está disponível neste momento.',
  },
];

const features = [
  {
    icon: Users,
    title: 'CRM Integrado',
    description: 'Funil de vendas visual com etapas 100% personalizadas! Organize cada cliente no estágio certo.',
  },
  {
    icon: Calendar,
    title: 'Agendamento de Mensagens',
    description: 'Agende mensagens para serem enviadas no momento ideal. Nunca esqueça de retornar um cliente ou enviar uma proposta no prazo.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard e Métricas',
    description: 'Dashboards com tempo de resposta, taxa de conversão, performance por vendedor e volume de atendimentos em tempo real.',
  },
  {
    icon: Tag,
    title: 'Tags e Organização',
    description: 'Classifique leads com tags personalizadas: Residencial, Comercial, Industrial, Alto Potencial, Reaquecimento e muito mais.',
  },
  {
    icon: Clock,
    title: 'SLA e Alertas',
    description: 'Alertas automáticos quando um lead fica sem resposta. Nunca mais perca uma venda por demora no atendimento.',
  },
  {
    icon: Workflow,
    title: 'Exportação de Leads',
    description: 'Exporte seus leads e use em campanhas de marketing, como Look-a-Like no Facebook.',
  },
];

const automationExamples = [
  {
    title: '🔥 Captação de Leads',
    trigger: 'Cliente envia mensagem pela primeira vez',
    steps: [
      'Mensagem de boas-vindas personalizada da Solar Executive',
      'Pergunta automática: "Qual o valor da sua conta de luz?"',
      'Salva a resposta como campo personalizado no CRM',
      'Classifica o lead por potencial (Residencial/Comercial/Industrial)',
      'Move para a coluna correta no Kanban automaticamente',
    ],
  },
  {
    title: '⚡ Qualificação Inteligente',
    trigger: 'Lead responde valor da conta de luz',
    steps: [
      'Se conta > R$500: Tag "Alto Potencial" + prioridade máxima',
      'Se conta R$200-500: Tag "Médio Potencial" + fila normal',
      'Se conta < R$200: Envia conteúdo educativo automaticamente',
      'Move para coluna correta no Kanban',
      'Notifica o vendedor responsável',
    ],
  },
  {
    title: '📋 Organização Automática',
    trigger: 'Lead movido para etapa "Proposta Enviada"',
    steps: [
      'Adiciona tag "Proposta Enviada" automaticamente',
      'Registra data da proposta como campo personalizado',
      'Alerta o gestor sobre novo orçamento enviado',
      'Se não houver resposta em 7 dias, move para "Reaquecimento"',
    ],
  },
  {
    title: '🔄 Pós-Venda',
    trigger: 'Cliente movido para "Instalação Concluída"',
    steps: [
      'Adiciona tag "Cliente Ativo"',
      'Envia mensagem de agradecimento personalizada',
      'Pede indicação com desconto exclusivo',
      'Move para coluna "Pós-Venda" no Kanban',
    ],
  },
];

const painPoints = [
  { problem: 'Leads chegam e ninguém acompanha o progresso', solution: 'CRM visual com funil completo e tags de organização' },
  { problem: 'Vendedores esquecem de retornar clientes', solution: 'Agendamento de mensagens no horário ideal' },
  { problem: 'Não sabe qual vendedor performa melhor', solution: 'Rankings e métricas em tempo real no dashboard' },
  { problem: 'Perde o histórico das conversas', solution: 'Tudo registrado e pesquisável no CRM' },
  { problem: 'Difícil mapear em que etapa cada lead está', solution: 'Kanban personalizado com colunas por etapa' },
  { problem: 'Clientes antigos não são reativados', solution: 'Tags e agendamentos para manter contato' },
];

export default function PropostaSolarExecutive() {
  const [activeAutomation, setActiveAutomation] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <VGVTurboLogo size="sm" variant="full" />
          <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
            Proposta Comercial Exclusiva
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(160_84%_25%)] via-[hsl(160_70%_20%)] to-[hsl(215_30%_12%)] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-[hsl(45_100%_60%)] blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-[hsl(160_84%_39%)] blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="flex items-center gap-2 mb-6">
            <Sun className="h-5 w-5 text-[hsl(45_100%_70%)]" />
            <span className="text-sm font-semibold tracking-wide uppercase opacity-90">
              Proposta para Solar Executive — Feira de Santana
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 max-w-3xl">
            Organize seus leads e{' '}
            <span className="text-[hsl(45_100%_70%)]">venda mais painéis solares</span>
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl leading-relaxed">
            O VGV Turbo dá à Solar Executive um CRM completo dentro do WhatsApp.
            Mapeie leads, agende mensagens, acompanhe o funil de vendas e saiba exatamente onde cada cliente está.
          </p>
        </div>
      </section>

      {/* Limitations Banner */}
      <section className="bg-[hsl(45_100%_96%)] dark:bg-[hsl(45_30%_12%)] border-b border-[hsl(45_80%_80%)] dark:border-[hsl(45_30%_20%)]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-[hsl(45_90%_40%)]" />
            <h2 className="text-lg font-bold text-foreground">Transparência Total — Limitações Atuais</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Acreditamos que a confiança começa com honestidade. Conheça as limitações atuais da plataforma:
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {limitations.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
                <item.icon className="h-4 w-4 text-[hsl(45_90%_40%)] shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 md:py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Você se identifica com esses problemas?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A maioria das empresas de energia solar perde vendas por falta de organização. O VGV Turbo resolve isso.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {painPoints.map((item, i) => (
              <Card key={i} className="border-border hover:border-primary/30 transition-colors group">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-destructive text-xs font-bold">✕</span>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">{item.problem}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <p className="text-sm text-foreground font-semibold">{item.solution}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-primary font-semibold text-sm uppercase tracking-wide">Funcionalidades</span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2 mb-4">
              Tudo que a Solar Executive precisa
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="border-border hover:shadow-lg transition-shadow group">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2 mb-4">
              Investimento
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Comece a organizar suas vendas hoje.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <Card className="border-primary shadow-xl relative overflow-hidden">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-foreground mb-1">Essencial</h3>
                  <p className="text-sm text-muted-foreground">CRM + Organização + Dashboard</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-sm text-muted-foreground">Implantação:</span>
                    <span className="text-2xl font-bold text-primary">Grátis</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">Mensalidade:</span>
                    <span className="text-3xl font-bold text-foreground">R$ 247</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 mb-3">
                  <p className="text-sm font-semibold text-primary">🎁 7 dias de teste grátis</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-6">
                  <p className="text-sm font-semibold text-green-700">🔓 Sem fidelidade — cancele quando quiser</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {[
                    'CRM com funil Kanban personalizado',
                    'Agendamento de mensagens',
                    'Dashboard com métricas em tempo real',
                    'Tags e campos personalizados',
                    'Histórico completo de conversas',
                    'Alertas de SLA',
                    'Múltiplos atendentes',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full font-semibold"
                  size="lg"
                  onClick={() => window.open('https://wa.me/5575999999999?text=Quero%20o%20plano%20Essencial%20do%20VGV%20Turbo', '_blank')}
                >
                  Começar Teste Grátis
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 md:py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">3x</div>
              <p className="text-muted-foreground font-medium">mais leads organizados com CRM visual</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">0</div>
              <p className="text-muted-foreground font-medium">leads esquecidos com agendamento e SLA</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">100%</div>
              <p className="text-muted-foreground font-medium">visibilidade sobre cada vendedor e cliente</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why VGV Turbo */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Por que a Solar Executive deveria escolher o VGV Turbo?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Target, title: 'Organização total dos leads', desc: 'Cada vendedor mantém seu WhatsApp, mas todos os leads ficam mapeados e organizados no CRM central.' },
              { icon: Shield, title: 'Histórico sempre acessível', desc: 'Mesmo com WhatsApps separados, todo o histórico fica registrado e pesquisável no VGV Turbo.' },
              { icon: TrendingUp, title: 'Visão gerencial completa', desc: 'Saiba exatamente quantos leads cada vendedor tem, em que etapa estão e quem está performando melhor.' },
              { icon: Star, title: 'Suporte dedicado', desc: 'Implantação assistida com configuração personalizada para o mercado de energia solar.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-6 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[hsl(160_84%_25%)] via-[hsl(160_70%_20%)] to-[hsl(215_30%_12%)] text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Sun className="h-12 w-12 mx-auto mb-6 text-[hsl(45_100%_70%)]" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para organizar as vendas da Solar Executive?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto leading-relaxed">
            Agende uma demonstração gratuita e veja na prática como o VGV Turbo pode multiplicar seus resultados em Feira de Santana.
          </p>
          <Button
            size="lg"
            className="bg-[hsl(45_100%_55%)] text-[hsl(215_30%_12%)] hover:bg-[hsl(45_100%_50%)] font-bold text-lg px-10 py-6 h-auto border-none"
            onClick={() => window.open('https://wa.me/5575999999999?text=Quero%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20do%20VGV%20Turbo', '_blank')}
          >
            <Calendar className="h-5 w-5 mr-2" />
            Agendar Demonstração Gratuita
          </Button>
          <p className="mt-4 text-sm opacity-70">Sem compromisso • Configuração em 24h • Suporte incluso</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <VGVTurboLogo size="sm" variant="full" />
          <p className="text-xs text-muted-foreground">
            Proposta exclusiva para Solar Executive — Válida por 15 dias
          </p>
        </div>
      </footer>
    </div>
  );
}
