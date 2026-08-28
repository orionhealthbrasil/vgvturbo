import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Goal } from '@/types/goals';
import { Skeleton } from '@/components/ui/skeleton';

interface GoalEvolutionChartProps {
  goal: Goal;
}

export function GoalEvolutionChart({ goal }: GoalEvolutionChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['goal-evolution', goal.id],
    queryFn: async () => {
      // Carrega contatos fechados no período da meta para reconstruir progresso temporal
      let q = supabase
        .from('contacts')
        .select('id, deal_value, sale_result, closed_at, assigned_to')
        .eq('organization_id', goal.organization_id)
        .gte('closed_at', goal.period_start)
        .lte('closed_at', `${goal.period_end}T23:59:59`)
        .not('sale_result', 'is', null);
      if (goal.pipeline_id) q = q.eq('pipeline_id', goal.pipeline_id);

      const { data: contacts, error } = await q;
      if (error) throw error;

      let rows = (contacts ?? []) as any[];
      if (goal.scope !== 'team') {
        const ids = (goal.participants ?? []).map((p) => p.user_id);
        rows = rows.filter((c) => c.assigned_to && ids.includes(c.assigned_to));
      }

      const days = eachDayOfInterval({ start: parseISO(goal.period_start), end: parseISO(goal.period_end) });
      let cumulative = 0;
      let cumulativeWon = 0;
      let cumulativeTotal = 0;
      return days.map((d) => {
        const dayStr = format(d, 'yyyy-MM-dd');
        const todays = rows.filter((c) => c.closed_at && c.closed_at.startsWith(dayStr));
        const wonToday = todays.filter((c) => c.sale_result === 'won');
        cumulative += wonToday.reduce((sum, c) => sum + (Number(c.deal_value) || 0), 0);
        cumulativeWon += wonToday.length;
        cumulativeTotal += todays.length;

        let value = 0;
        if (goal.goal_type === 'revenue') value = cumulative;
        else if (goal.goal_type === 'deals_count') value = cumulativeWon;
        else value = cumulativeTotal > 0 ? (cumulativeWon / cumulativeTotal) * 100 : 0;

        return { day: format(d, 'dd/MM', { locale: ptBR }), value: Number(value.toFixed(2)) };
      });
    },
    enabled: !!goal.id,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir.</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <ReferenceLine y={goal.target_value} stroke="hsl(var(--status-success))" strokeDasharray="4 4" label={{ value: 'Meta', fill: 'hsl(var(--status-success))', fontSize: 10, position: 'right' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
