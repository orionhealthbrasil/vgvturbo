import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReviewWithSalesperson } from '@/types/database';
import { getDefectColor, getDefectLabel } from '@/types/database';

interface RecentActivityTableProps {
  reviews: ReviewWithSalesperson[];
}

export function RecentActivityTable({ reviews }: RecentActivityTableProps) {
  const recentReviews = reviews.slice(0, 5);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tempo de Resposta</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhuma avaliação ainda. Crie sua primeira avaliação!
                </TableCell>
              </TableRow>
            ) : (
              recentReviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="font-medium">
                    {review.salespeople?.name || 'Desconhecido'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getDefectColor(review.defect_type)}>
                      {getDefectLabel(review.defect_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{review.response_time_minutes} min</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(review.review_date), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
