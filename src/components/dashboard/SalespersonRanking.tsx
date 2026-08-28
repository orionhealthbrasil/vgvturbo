import { Trophy, Medal, Award, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ReviewWithSalesperson } from '@/types/database';

interface SalespersonRankingProps {
  reviews: ReviewWithSalesperson[];
}

interface SalespersonStats {
  name: string;
  totalReviews: number;
  positiveReviews: number;
  positivePercentage: number;
  avgResponseTime: number;
}

export function SalespersonRanking({ reviews }: SalespersonRankingProps) {
  // Group reviews by salesperson and calculate stats
  const salespersonMap = reviews.reduce((acc, review) => {
    const name = review.salespeople?.name || 'Desconhecido';
    if (!acc[name]) {
      acc[name] = {
        name,
        totalReviews: 0,
        positiveReviews: 0,
        totalResponseTime: 0,
      };
    }
    acc[name].totalReviews += 1;
    acc[name].totalResponseTime += review.response_time_minutes;
    if (review.defect_type === 'Good Service') {
      acc[name].positiveReviews += 1;
    }
    return acc;
  }, {} as Record<string, { name: string; totalReviews: number; positiveReviews: number; totalResponseTime: number }>);

  // Convert to array and calculate percentages
  const rankings: SalespersonStats[] = Object.values(salespersonMap)
    .map(sp => ({
      name: sp.name,
      totalReviews: sp.totalReviews,
      positiveReviews: sp.positiveReviews,
      positivePercentage: Math.round((sp.positiveReviews / sp.totalReviews) * 100),
      avgResponseTime: Math.round(sp.totalResponseTime / sp.totalReviews),
    }))
    .sort((a, b) => {
      // Sort by positive percentage first, then by total reviews as tiebreaker
      if (b.positivePercentage !== a.positivePercentage) {
        return b.positivePercentage - a.positivePercentage;
      }
      return b.totalReviews - a.totalReviews;
    });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-primary" />;
      case 1:
        return <Medal className="w-5 h-5 text-muted-foreground" />;
      case 2:
        return <Award className="w-5 h-5 text-accent-foreground" />;
      default:
        return <Star className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRankBadgeColor = (index: number) => {
    switch (index) {
      case 0:
        return 'bg-primary/10 text-primary border-primary/20';
      case 1:
        return 'bg-secondary text-secondary-foreground border-secondary';
      case 2:
        return 'bg-accent text-accent-foreground border-accent';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Ranking de Vendedores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rankings.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        ) : (
          <div className="space-y-4">
            {rankings.slice(0, 5).map((sp, index) => (
              <div 
                key={sp.name} 
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                {/* Rank Badge */}
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border ${getRankBadgeColor(index)}`}>
                  {index < 3 ? getRankIcon(index) : <span className="text-sm font-medium">{index + 1}</span>}
                </div>

                {/* Salesperson Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground truncate">{sp.name}</p>
                    <span className="text-sm font-semibold text-primary ml-2">
                      {sp.positivePercentage}%
                    </span>
                  </div>
                  <Progress 
                    value={sp.positivePercentage} 
                    className="h-2"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {sp.positiveReviews}/{sp.totalReviews} positivas
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ⏱️ {sp.avgResponseTime} min
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
