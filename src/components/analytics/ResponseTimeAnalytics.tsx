import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useResponseTimeStats, type EndedBy } from '@/hooks/useResponseTimeStats';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ENDED_BY_LABEL: Record<EndedBy, string> = {
  human: 'Vendedor',
  automation: 'Automação',
  ai_agent: 'Agente IA',
  conversation_closed: 'Finalizado',
};

const ENDED_BY_TONE: Record<EndedBy, string> = {
  human: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  automation: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  ai_agent: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  conversation_closed: 'bg-muted text-muted-foreground',
};

function fmtMin(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '0m';
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export function ResponseTimeAnalytics() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data: stats, isLoading } = useResponseTimeStats(days);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!stats || stats.totalCount === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum dado de tempo de atendimento no período. Os ciclos serão registrados conforme as conversas avançarem.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
        <TabsList>
          <TabsTrigger value="7">Últimos 7 dias</TabsTrigger>
          <TabsTrigger value="30">Últimos 30 dias</TabsTrigger>
          <TabsTrigger value="90">Últimos 90 dias</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="w-4 h-4" />} label="Conversas medidas" value={String(stats.totalCount)} />
        <KpiCard icon={<Clock className="w-4 h-4" />} label="Tempo médio (úteis)" value={fmtMin(stats.avgMinutes)} />
        <KpiCard icon={<Clock className="w-4 h-4 text-amber-500" />} label="Maior atraso" value={fmtMin(stats.maxMinutes)} />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          label="Dentro do SLA"
          value={`${stats.withinSlaPct.toFixed(0)}%`}
        />
      </div>

      {/* Trend chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Evolução do tempo médio</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => format(new Date(d + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v)}m`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                formatter={(v: any) => [fmtMin(Number(v)), 'Tempo médio']}
                labelFormatter={(d) => format(new Date(d + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              />
              <Line type="monotone" dataKey="avg_minutes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ranking by agent */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Por vendedor</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Conversas</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
                <TableHead className="text-right">Mediana</TableHead>
                <TableHead className="text-right">P90</TableHead>
                <TableHead className="text-right">Maior</TableHead>
                <TableHead className="text-right">Dentro do SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byAgent.map((a) => (
                <TableRow key={a.user_id || 'unassigned'}>
                  <TableCell className="font-medium">{a.agent_name}</TableCell>
                  <TableCell className="text-right">{a.count}</TableCell>
                  <TableCell className="text-right">{fmtMin(a.avg_minutes)}</TableCell>
                  <TableCell className="text-right">{fmtMin(a.median_minutes)}</TableCell>
                  <TableCell className="text-right">{fmtMin(a.p90_minutes)}</TableCell>
                  <TableCell className="text-right">{fmtMin(a.max_minutes)}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={a.within_sla_pct >= 80 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : a.within_sla_pct >= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-destructive/15 text-destructive'}
                    >
                      {a.within_sla_pct.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Últimos atendimentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
                <TableHead>Encerrado por</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.events.slice(0, 50).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(e.ended_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{e.agent_name || 'Não atribuído'}</TableCell>
                  <TableCell className="text-right">{fmtMin(e.duration_minutes)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={ENDED_BY_TONE[e.ended_by]}>
                      {ENDED_BY_LABEL[e.ended_by]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {e.breached_sla ? (
                      <span className="inline-flex items-center gap-1 text-destructive text-xs">
                        <AlertTriangle className="w-3 h-3" /> Estourou
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                        <CheckCircle2 className="w-3 h-3" /> Ok
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
