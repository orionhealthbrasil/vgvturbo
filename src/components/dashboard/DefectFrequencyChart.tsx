import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReviewWithSalesperson, DefectType } from '@/types/database';
import { DEFECT_TYPES, getDefectChartColor, getDefectLabel } from '@/types/database';

interface DefectFrequencyChartProps {
  reviews: ReviewWithSalesperson[];
}

export function DefectFrequencyChart({ reviews }: DefectFrequencyChartProps) {
  // Count defects by type
  const defectCounts = reviews.reduce((acc, review) => {
    acc[review.defect_type] = (acc[review.defect_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = DEFECT_TYPES.map((type) => ({
    name: getDefectLabel(type),
    count: defectCounts[type] || 0,
    fill: getDefectChartColor(type),
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Frequência de Defeitos por Tipo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={data} 
              layout="vertical"
              margin={{ top: 20, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [value, 'Quantidade']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Quantidade">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
