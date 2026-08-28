import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { format, parseISO, subDays, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, ShoppingCart, FileText, DollarSign, Receipt, Megaphone, Target, Percent } from 'lucide-react';

const isAdsSource = (src?: string | null) => {
  if (!src) return false;
  const s = src.toLowerCase().trim();
  return s === 'google' || s === 'instagram';
};

interface Analysis {
  id: string;
  analysis_date: string;
  customer_name: string;
  phone?: string | null;
  lead_source?: string | null;
  sale_status?: string | null;
  product_line?: string | null;
  part_searched?: string | null;
  quantity?: number | null;
  sale_value?: number | null;
  created_by?: string | null;
}

interface AnalysesDashboardProps {
  analyses: Analysis[];
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(0 84% 60%)',
  'hsl(262 83% 58%)',
  'hsl(199 89% 48%)',
  'hsl(24 95% 53%)',
  'hsl(173 58% 39%)',
  'hsl(330 81% 60%)',
  'hsl(220 9% 46%)',
];

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

type Period = 'today' | '7d' | '30d' | 'all';

export function AnalysesDashboard({ analyses }: AnalysesDashboardProps) {
  const [period, setPeriod] = useState<Period>('30d');

  const filtered = useMemo(() => {
    if (period === 'all') return analyses;
    const now = new Date();
    let cutoff: Date;
    if (period === 'today') cutoff = startOfDay(now);
    else if (period === '7d') cutoff = subDays(now, 7);
    else cutoff = subDays(now, 30);
    return analyses.filter((a) => {
      try {
        return isAfter(parseISO(a.analysis_date), cutoff) ||
          parseISO(a.analysis_date).getTime() === cutoff.getTime();
      } catch {
        return false;
      }
    });
  }, [analyses, period]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const sales = filtered.filter((a) => a.sale_status === 'VENDA');
    const budgets = filtered.filter((a) => a.sale_status === 'ORCAMENTO');
    const totalValue = sales.reduce((sum, a) => sum + (Number(a.sale_value) || 0), 0);
    const avgTicket = sales.length > 0 ? totalValue / sales.length : 0;
    const budgetsValue = budgets.reduce((sum, a) => sum + (Number(a.sale_value) || 0), 0);

    // Métricas de Ads (Google + Instagram)
    const adsAll = filtered.filter((a) => isAdsSource(a.lead_source));
    const adsSales = adsAll.filter((a) => a.sale_status === 'VENDA');
    const adsBudgets = adsAll.filter((a) => a.sale_status === 'ORCAMENTO');
    const adsTotalValue = adsSales.reduce((sum, a) => sum + (Number(a.sale_value) || 0), 0);
    const adsBudgetsValue = adsBudgets.reduce((sum, a) => sum + (Number(a.sale_value) || 0), 0);
    const adsAvgTicket = adsSales.length > 0 ? adsTotalValue / adsSales.length : 0;
    const adsConversion = adsAll.length > 0 ? (adsSales.length / adsAll.length) * 100 : 0;

    // Breakdown por fonte de Ads
    const googleAll = filtered.filter((a) => (a.lead_source || '').toLowerCase().trim() === 'google');
    const instaAll = filtered.filter((a) => (a.lead_source || '').toLowerCase().trim() === 'instagram');
    const googleSales = googleAll.filter((a) => a.sale_status === 'VENDA');
    const instaSales = instaAll.filter((a) => a.sale_status === 'VENDA');
    const googleValue = googleSales.reduce((s, a) => s + (Number(a.sale_value) || 0), 0);
    const instaValue = instaSales.reduce((s, a) => s + (Number(a.sale_value) || 0), 0);

    return {
      total,
      salesCount: sales.length,
      salesPct: total > 0 ? (sales.length / total) * 100 : 0,
      budgetsCount: budgets.length,
      budgetsPct: total > 0 ? (budgets.length / total) * 100 : 0,
      totalValue,
      avgTicket,
      budgetsValue,
      adsCount: adsAll.length,
      adsSalesCount: adsSales.length,
      adsTotalValue,
      adsBudgetsValue,
      adsBudgetsCount: adsBudgets.length,
      adsAvgTicket,
      adsConversion,
      googleCount: googleAll.length,
      googleSalesCount: googleSales.length,
      googleValue,
      instaCount: instaAll.length,
      instaSalesCount: instaSales.length,
      instaValue,
    };
  }, [filtered]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((a) => {
      const k = a.sale_status || 'SEM STATUS';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const attendantData = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    filtered.forEach((a) => {
      const k = a.created_by || 'Não identificado';
      const cur = map.get(k) || { count: 0, value: 0 };
      cur.count += 1;
      if (a.sale_status === 'VENDA') cur.value += Number(a.sale_value) || 0;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, count: v.count, value: v.value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  const dailyData = useMemo(() => {
    const days = 30;
    const now = new Date();
    const buckets: { date: string; label: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'yyyy-MM-dd');
      buckets.push({ date: key, label: format(d, 'dd/MM'), count: 0 });
    }
    const map = new Map(buckets.map((b) => [b.date, b]));
    analyses.forEach((a) => {
      const b = map.get(a.analysis_date);
      if (b) b.count += 1;
    });
    return buckets;
  }, [analyses]);

  const productLineData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((a) => {
      if (!a.product_line) return;
      map.set(a.product_line, (map.get(a.product_line) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((a) => {
      const k = a.lead_source || 'Não informado';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex justify-end">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="7d">7 dias</TabsTrigger>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
            <TabsTrigger value="all">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total de Análises"
          value={String(stats.total)}
        />
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4 text-green-600" />}
          label="Vendas"
          value={String(stats.salesCount)}
          sub={`${stats.salesPct.toFixed(1)}%`}
        />
        <KpiCard
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          label="Orçamentos"
          value={String(stats.budgetsCount)}
          sub={`${stats.budgetsPct.toFixed(1)}%`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          label="Valor Total"
          value={formatBRL(stats.totalValue)}
        />
        <KpiCard
          icon={<Receipt className="h-4 w-4 text-primary" />}
          label="Ticket Médio"
          value={formatBRL(stats.avgTicket)}
        />
        <KpiCard
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          label="Valor em Orçamentos"
          value={formatBRL(stats.budgetsValue)}
          sub={`${stats.budgetsCount} orç.`}
        />
      </div>

      {/* KPIs de Ads (Google) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Métricas de Ads (Google)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={<DollarSign className="h-4 w-4 text-primary" />}
            label="Valor Vendas Ads"
            value={formatBRL(stats.adsTotalValue)}
            sub={`${stats.adsSalesCount} venda${stats.adsSalesCount === 1 ? '' : 's'}`}
          />
          <KpiCard
            icon={<FileText className="h-4 w-4 text-blue-600" />}
            label="Valor Orç. Ads"
            value={formatBRL(stats.adsBudgetsValue)}
            sub={`${stats.adsBudgetsCount} orç.`}
          />
          <KpiCard
            icon={<Receipt className="h-4 w-4 text-primary" />}
            label="Ticket Médio Ads"
            value={formatBRL(stats.adsAvgTicket)}
          />
          <KpiCard
            icon={<Percent className="h-4 w-4 text-primary" />}
            label="Conversão Ads"
            value={`${stats.adsConversion.toFixed(1)}%`}
            sub={`${stats.adsSalesCount}/${stats.adsCount} leads`}
          />
          <KpiCard
            icon={<Target className="h-4 w-4 text-primary" />}
            label="Google Ads"
            value={formatBRL(stats.googleValue)}
            sub={`${stats.googleSalesCount} vendas · ${stats.googleCount} leads`}
          />
          {/* INSTAGRAM_HIDDEN:
          <KpiCard
            icon={<Target className="h-4 w-4 text-primary" />}
            label="Instagram Ads"
            value={formatBRL(stats.instaValue)}
            sub={`${stats.instaSalesCount} vendas · ${stats.instaCount} leads`}
          />
          */}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {statusData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => `${e.value}`}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Atendentes</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {attendantData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendantData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Análises" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Evolução Diária (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Análises"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Linhas de Produto</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {productLineData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productLineData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" name="Buscas" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origem do Lead</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {sourceData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Análises">
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
      Sem dados no período
    </div>
  );
}
