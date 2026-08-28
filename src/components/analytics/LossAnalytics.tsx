import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingDown, DollarSign, Trophy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useLossReasons } from '@/hooks/useLossReasons';

type PeriodKey = '7d' | '30d' | '90d' | '365d' | 'all';

const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: '7d', label: 'Últimos 7 dias', days: 7 },
  { key: '30d', label: 'Últimos 30 dias', days: 30 },
  { key: '90d', label: 'Últimos 90 dias', days: 90 },
  { key: '365d', label: 'Último ano', days: 365 },
  { key: 'all', label: 'Todo o período', days: null },
];

const FALLBACK_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
const OTHER_COLOR = '#94a3b8';
const CHART_TOP_N = 6;

const truncateLabel = (label: string, max = 18) =>
  label.length > max ? `${label.slice(0, max).trimEnd()}…` : label;

const currency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function LossAnalytics() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const { data: reasonsCatalog = [] } = useLossReasons();

  const cutoff = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days;
    if (!days) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [period]);

  const { data: lostDeals = [], isLoading } = useQuery({
    queryKey: ['loss-analytics', orgId, period],
    queryFn: async () => {
      if (!orgId) return [] as Array<{ loss_reason: string | null; deal_value: number | null; closed_at: string | null }>;
      let q = supabase
        .from('contacts')
        .select('loss_reason, deal_value, closed_at')
        .eq('organization_id', orgId)
        .eq('sale_result', 'lost')
        .limit(5000);
      if (cutoff) q = q.gte('closed_at', cutoff);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const aggregated = useMemo(() => {
    const colorMap = new Map<string, string>();
    reasonsCatalog.forEach((r, i) => {
      colorMap.set(r.label, r.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]);
    });

    const map = new Map<string, { label: string; count: number; value: number; color: string }>();
    let total = 0;
    let totalValue = 0;
    for (const d of lostDeals) {
      const label = (d.loss_reason && String(d.loss_reason).trim()) || 'Sem motivo';
      const existing = map.get(label) || {
        label,
        count: 0,
        value: 0,
        color: colorMap.get(label) || FALLBACK_COLORS[map.size % FALLBACK_COLORS.length],
      };
      existing.count += 1;
      existing.value += Number(d.deal_value || 0);
      map.set(label, existing);
      total += 1;
      totalValue += Number(d.deal_value || 0);
    }

    const rows = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const top = rows[0]?.label ?? '—';
    const avgTicket = total > 0 ? totalValue / total : 0;
    return { rows, total, totalValue, top, avgTicket };
  }, [lostDeals, reasonsCatalog]);

  // Motivos de perda podem ser texto livre, gerando muitas categorias únicas;
  // os gráficos agrupam o "rabo longo" em "Outros" para não ficarem ilegíveis.
  const chartRows = useMemo(() => {
    const { rows } = aggregated;
    if (rows.length <= CHART_TOP_N + 1) return rows;
    const top = rows.slice(0, CHART_TOP_N);
    const rest = rows.slice(CHART_TOP_N);
    const otherCount = rest.reduce((s, r) => s + r.count, 0);
    const otherValue = rest.reduce((s, r) => s + r.value, 0);
    return [...top, { label: `Outros (${rest.length})`, count: otherCount, value: otherValue, color: OTHER_COLOR }];
  }, [aggregated]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            Análises das Perdas
          </h2>
          <p className="text-sm text-muted-foreground">
            Distribuição dos motivos de venda perdida no período selecionado.
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
          label="Vendas perdidas"
          value={String(aggregated.total)}
          loading={isLoading}
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5 text-amber-500" />}
          label="Valor total perdido"
          value={currency(aggregated.totalValue)}
          loading={isLoading}
        />
        <KpiCard
          icon={<Trophy className="w-5 h-5 text-indigo-500" />}
          label="Motivo mais frequente"
          value={aggregated.top}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contagem por motivo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="w-full h-[280px]" />
            ) : aggregated.rows.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                    tickFormatter={(v: string) => truncateLabel(v, 14)}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: any) => [v, 'Perdas']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartRows.map((r) => (
                      <Cell key={r.label} fill={r.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição %</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="w-full h-[280px]" />
            ) : aggregated.rows.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartRows}
                    dataKey="count"
                    nameKey="label"
                    cx="38%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {chartRows.map((r) => (
                      <Cell key={r.label} fill={r.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(value: number, name: string) => [
                      `${value} (${aggregated.total > 0 ? ((value / aggregated.total) * 100).toFixed(1) : 0}%)`,
                      name,
                    ]}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: 12, lineHeight: '20px' }}
                    formatter={(value: string) => truncateLabel(value, 24)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">% do total</TableHead>
                  <TableHead className="text-right">Valor perdido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ) : aggregated.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma venda perdida registrada no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  aggregated.rows.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                          {r.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">
                        {aggregated.total > 0 ? `${((r.count / aggregated.total) * 100).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right">{currency(r.value)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted/40 p-2">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-24 mt-1" />
            ) : (
              <p className="text-xl font-semibold truncate">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
      Nenhum dado no período.
    </div>
  );
}
