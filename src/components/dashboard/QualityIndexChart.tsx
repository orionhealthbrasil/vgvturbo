import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReviewWithSalesperson } from '@/types/database';

interface QualityIndexChartProps {
  reviews: ReviewWithSalesperson[];
}

export function QualityIndexChart({ reviews }: QualityIndexChartProps) {
  const positiveCount = reviews.filter(r => r.defect_type === 'Good Service').length;
  const attentionCount = reviews.length - positiveCount;

  const data = [
    { name: 'Positivo', value: positiveCount, color: 'hsl(142, 76%, 36%)' },
    { name: 'Pontos de Atenção', value: attentionCount, color: 'hsl(45, 93%, 47%)' },
  ].filter(d => d.value > 0);

  const positivePercentage = reviews.length > 0 
    ? Math.round((positiveCount / reviews.length) * 100) 
    : 0;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Índice de Qualidade
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string) => [
                    `${value} (${Math.round((value / reviews.length) * 100)}%)`,
                    name
                  ]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => (
                    <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: '36px' }}>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{positivePercentage}%</p>
                <p className="text-xs text-muted-foreground">Positivo</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
