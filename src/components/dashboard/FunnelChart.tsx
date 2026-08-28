import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { FunnelStageCount } from '@/hooks/useDashboardData';
import { Filter } from 'lucide-react';

interface FunnelChartProps {
  stages: FunnelStageCount[];
}

export function FunnelChart({ stages }: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Leads por Etapa do Funil
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Nenhuma etapa configurada
        </CardContent>
      </Card>
    );
  }

  const data = stages
    .sort((a, b) => a.position - b.position)
    .map(s => ({ name: s.name, leads: s.count, color: s.color }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="w-4 h-4" />
          Leads por Etapa do Funil
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 13 }} />
            <Tooltip
              formatter={(value: number) => [`${value} leads`, 'Quantidade']}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}
            />
            <Bar dataKey="leads" radius={[0, 6, 6, 0]} barSize={28}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
