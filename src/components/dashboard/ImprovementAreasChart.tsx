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

interface ImprovementAreasChartProps {
  reviews: ReviewWithSalesperson[];
}

export function ImprovementAreasChart({ reviews }: ImprovementAreasChartProps) {
  // Filter out Good Service - only show improvement areas
  const defectTypesWithoutGood = DEFECT_TYPES.filter(type => type !== 'Good Service');
  
  // Count defects by type (excluding Good Service)
  const defectCounts = reviews.reduce((acc, review) => {
    if (review.defect_type !== 'Good Service') {
      acc[review.defect_type] = (acc[review.defect_type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const data = defectTypesWithoutGood
    .map((type) => ({
      name: getDefectLabel(type),
      count: defectCounts[type] || 0,
      fill: getDefectChartColor(type),
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const hasData = data.some(d => d.count > 0);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Principais Motivos de Melhoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p>Nenhum ponto de melhoria registrado</p>
            </div>
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
