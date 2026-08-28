import { Users, UserPlus, Target, Clock, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { KPICard } from '@/components/dashboard/KPICard';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { TagsChart } from '@/components/dashboard/TagsChart';
import { LeadTrendChart } from '@/components/dashboard/LeadTrendChart';
import { ClosedTrendChart } from '@/components/dashboard/ClosedTrendChart';
import { SlaNotificationsCard } from '@/components/dashboard/SlaNotificationsCard';
import { MyTasksWidget } from '@/components/dashboard/MyTasksWidget';
import { MyGoalsWidget } from '@/components/dashboard/MyGoalsWidget';
import { UpcomingBookingsWidget } from '@/components/dashboard/UpcomingBookingsWidget';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { metrics, isLoading } = useDashboardData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel</h1>
          <p className="text-muted-foreground">Carregando métricas...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel</h1>
        <p className="text-muted-foreground">Visão geral dos seus leads e funil de vendas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total de Leads"
          value={metrics.totalContacts}
          subtitle={`${metrics.newContactsThisWeek} novos esta semana`}
          icon={Users}
        />
        <KPICard
          title="Novos Hoje"
          value={metrics.newContactsToday}
          subtitle="Leads adicionados hoje"
          icon={UserPlus}
        />
        <KPICard
          title="Em Atendimento"
          value={metrics.openContacts}
          subtitle="Leads com status aberto"
          icon={Target}
        />
        <KPICard
          title="Encerradas Hoje"
          value={metrics.closedToday}
          subtitle="Conversas encerradas hoje"
          icon={CheckCircle2}
        />
        <KPICard
          title="Tempo Médio Fechamento"
          value={metrics.avgClosingDays > 0 ? `${metrics.avgClosingDays}d` : 'N/A'}
          subtitle="Dias até fechar o lead"
          icon={Clock}
        />
      </div>
      {/* SLA + My Tasks + My Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SlaNotificationsCard />
        <MyTasksWidget />
        <MyGoalsWidget />
      </div>

      {/* Upcoming bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UpcomingBookingsWidget />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadTrendChart data={metrics.leadTrend} />
        <ClosedTrendChart data={metrics.closedTrend} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelChart stages={metrics.funnelStages} />
        <TagsChart tags={metrics.tagCounts} />
      </div>
    </div>
  );
}
