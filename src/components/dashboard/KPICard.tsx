import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DEFECT_LABELS, DefectType } from '@/types/database';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon }: KPICardProps) {
  // Translate defect type if it's a known type
  const displayValue = typeof value === 'string' && value in DEFECT_LABELS 
    ? DEFECT_LABELS[value as DefectType] 
    : value;

  return (
    <Card className="glass-card hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{displayValue}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
