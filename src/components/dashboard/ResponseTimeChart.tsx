import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReviewWithSalesperson } from '@/types/database';

interface ResponseTimeChartProps {
  reviews: ReviewWithSalesperson[];
}

export function ResponseTimeChart({ reviews }: ResponseTimeChartProps) {
  // Group by salesperson and calculate averages
  const salespersonStats = reviews.reduce((acc, review) => {
    const name = review.salespeople?.name || 'Desconhecido';
    if (!acc[name]) {
      acc[name] = { total: 0, count: 0 };
    }
    acc[name].total += review.response_time_minutes;
    acc[name].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const data = Object.entries(salespersonStats).map(([name, stats]) => ({
    name: name.split(' ')[0], // First name only for chart
    avgTime: Math.round(stats.total / stats.count),
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Tempo Médio de Resposta por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: 'Minutos', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value} min`, 'Tempo Médio']}
              />
              <Bar 
                dataKey="avgTime" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="Tempo Médio de Resposta (min)"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
