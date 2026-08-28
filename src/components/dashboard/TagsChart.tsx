import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { TagCount } from '@/hooks/useDashboardData';
import { Tag } from 'lucide-react';

interface TagsChartProps {
  tags: TagCount[];
}

export function TagsChart({ tags }: TagsChartProps) {
  if (tags.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4" />
            Leads por Tag
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Nenhuma tag com contatos
        </CardContent>
      </Card>
    );
  }

  // Show top 10 tags
  const data = tags.slice(0, 10).map(t => ({
    name: t.name,
    value: t.count,
    color: t.color,
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="w-4 h-4" />
          Leads por Tag
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={{ strokeWidth: 1 }}
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} leads`, 'Quantidade']}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Tag list below chart */}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.map((t, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
              {t.name} ({t.value})
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
